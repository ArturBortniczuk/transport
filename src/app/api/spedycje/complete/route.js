// src/app/api/spedycje/complete/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

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

// Funkcja do wysyłania SMS
const sendSms = async (phoneNumber, message) => {
  try {
    // Sprawdź czy istnieją wymagane dane
    if (!phoneNumber || !message) {
      console.error('Brak numeru telefonu lub treści wiadomości do wysłania SMS');
      return false;
    }
    
    // Konfiguracja API MultiInfo
    const login = 'ArturBortniczuk';  // Używamy danych, które już działają
    const password = 'ArtBor.2024';
    const serviceId = '21370';
    
    // Przygotowanie URL do API
    const smsUrl = `https://api2.multiinfo.plus.pl/sendsms.aspx?serviceId=${serviceId}&login=${login}&password=${password}&dest=${phoneNumber}&text=${encodeURIComponent(message)}&stat=spedycja-SMS`;
    
    // Wysłanie SMS-a
    const response = await fetch(smsUrl);
    const result = await response.text();
    
    // Sprawdzenie wyniku
    if (result && result.startsWith('0')) {
      console.log('SMS został wysłany pomyślnie');
      return true;
    } else {
      console.error('Błąd wysyłania SMS:', result);
      return false;
    }
  } catch (error) {
    console.error('Błąd podczas wysyłania SMS:', error);
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
        .select('phone', 'name')
        .first();
      
      if (creator && creator.phone) {
        // Przygotuj informacje potrzebne do SMS-a
        const orderNumber = currentSpedycja.order_number || id;
        const deliveryDateObj = new Date(currentSpedycja.delivery_date);
        const deliveryDate = format(deliveryDateObj, 'dd.MM.yyyy', { locale: pl });
        
        // Przygotuj informacje o kierowcy (jeśli dostępne)
        let driverInfo = '';
        if (responseData.driverName && responseData.driverSurname) {
          driverInfo = `${responseData.driverName} ${responseData.driverSurname}`;
          if (responseData.driverPhone) {
            driverInfo += `, tel. ${responseData.driverPhone}`;
          }
        } else {
          driverInfo = 'Informacje niedostępne';
        }
        
        // Przygotuj treść wiadomości
        let message = `Zlecenie spedycji ${orderNumber} zostało zrealizowane. Auto zostało znalezione na ${deliveryDate}. Kierowca: ${driverInfo}`;
        
        // Wyślij SMS
        const smsSent = await sendSms(creator.phone, message);
        console.log(`SMS wysłany do ${creator.name} (${creator.phone}): ${smsSent ? 'sukces' : 'błąd'}`);
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
