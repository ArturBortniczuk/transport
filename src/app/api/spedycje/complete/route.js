// Modyfikacja pliku api/spedycje/complete/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first();
  
  return session?.user_id;
};

// Funkcja do wysyłania SMS po oznaczeniu spedycji jako zrealizowanej
const sendCompletionSms = async (phoneNumber, orderNumber, deliveryDate, driverInfo) => {
  try {
    // Przygotuj treść wiadomości
    const message = `Zlecenie spedycji ${orderNumber} zostało zrealizowane. Auto zostało znalezione na ${deliveryDate}. ${driverInfo ? 'Kierowca: ' + driverInfo : ''}`;
    
    // Wywołaj API do wysyłania SMS
    const response = await fetch(new URL('/api/sms', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber, message })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Błąd wysyłania SMS:', data.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Błąd podczas próby wysłania SMS:', error);
    return false;
  }
};

export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdzamy czy użytkownik ma uprawnienia
    const user = await db('users')
      .where('email', userId)
      .select('role', 'is_admin', 'name')
      .first();
    
    const isAdmin = user?.is_admin === true || user?.is_admin === 1 || user?.role === 'admin';
    
    if (!user || !isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do oznaczania zleceń jako zrealizowane' 
      }, { status: 403 });
    }
    
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie podano ID zlecenia' 
      }, { status: 400 });
    }
    
    // Pobierz bieżące dane zlecenia, aby zachować istniejącą odpowiedź
    const currentSpedycja = await db('spedycje')
      .where('id', id)
      .first();
    
    if (!currentSpedycja) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono zlecenia spedycji o podanym ID' 
      }, { status: 404 });
    }
    
    // Przygotuj dane odpowiedzi
    let responseData = {
      completedManually: true,
      completedBy: user.name || userId,
      completedAt: new Date().toISOString()
    };
    
    // Jeśli zlecenie już ma odpowiedź, zachowaj jej dane
    if (currentSpedycja.response_data) {
      try {
        const existingResponseData = JSON.parse(currentSpedycja.response_data);
        // Zachowaj istniejące dane i dodaj informacje o ręcznym zakończeniu
        responseData = {
          ...existingResponseData,
          completedManually: true,
          completedBy: user.name || userId,
          completedAt: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error parsing existing response data:', error);
        // Jeśli wystąpi błąd podczas parsowania, użyjemy domyślnych danych
      }
    }
    
    console.log('Aktualizacja zlecenia z ID:', id);
    console.log('Dane odpowiedzi do zapisania:', responseData);
    
    // Aktualizujemy rekord w bazie
    const updated = await db('spedycje')
      .where('id', id)
      .update({
        status: 'completed',
        response_data: JSON.stringify(responseData),
        completed_at: db.fn.now(),
        completed_by: userId
      });
    
    if (updated === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie udało się zaktualizować zlecenia spedycji' 
      }, { status: 500 });
    }
    
    // Teraz wyślij SMS do osoby, która utworzyła spedycję
    try {
      // Pobierz numer telefonu osoby, która utworzyła spedycję
      const creatorEmail = currentSpedycja.created_by_email;
      const creator = await db('users')
        .where('email', creatorEmail)
        .select('phone')
        .first();
      
      if (creator && creator.phone) {
        // Przygotuj informacje potrzebne do SMS-a
        const orderNumber = currentSpedycja.order_number || id;
        const deliveryDate = new Date(currentSpedycja.delivery_date).toLocaleDateString('pl-PL');
        
        // Przygotuj informacje o kierowcy (jeśli dostępne)
        let driverInfo = '';
        if (responseData.driverName && responseData.driverSurname) {
          driverInfo = `${responseData.driverName} ${responseData.driverSurname}`;
          if (responseData.driverPhone) {
            driverInfo += `, tel. ${responseData.driverPhone}`;
          }
        }
        
        // Wyślij SMS
        const smsSent = await sendCompletionSms(creator.phone, orderNumber, deliveryDate, driverInfo);
        console.log('SMS wysłany:', smsSent);
      } else {
        console.log('Nie znaleziono numeru telefonu dla twórcy spedycji:', creatorEmail);
      }
    } catch (smsError) {
      console.error('Błąd podczas wysyłania SMS:', smsError);
      // Nie zwracamy błędu, bo oznaczenie jako zrealizowane się udało
    }
    
    return NextResponse.json({ 
      success: true
    });
  } catch (error) {
    console.error('Error completing spedycja:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
