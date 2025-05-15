// src/app/api/spedycje/edit/route.js
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

export async function PUT(request) {
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
    
    const { id, ...data } = await request.json();
    
    // Sprawdź czy zlecenie istnieje i czy użytkownik jest jego twórcą
    const spedycja = await db('spedycje')
      .where('id', id)
      .first();
    
    if (!spedycja) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono zlecenia o podanym ID' 
      }, { status: 404 });
    }
    
    // Sprawdź uprawnienia - jest twórcą lub adminem
    const user = await db('users')
      .where('email', userId)
      .select('role', 'is_admin')
      .first();
      
    const isAdmin = user?.is_admin === true || 
                    user?.is_admin === 1 || 
                    user?.is_admin === 't' || 
                    user?.is_admin === 'TRUE' ||
                    user?.is_admin === 'true' ||
                    user?.role === 'admin';
    
    // Czy użytkownik jest twórcą zlecenia lub adminem
    if (spedycja.created_by_email !== userId && !isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do edycji tego zlecenia' 
      }, { status: 403 });
    }
    
    // Jeśli zlecenie ma już odpowiedź, nie pozwalamy na edycję
    if (spedycja.response_data && spedycja.response_data !== '{}' && spedycja.response_data !== 'null') {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie można edytować zlecenia, które ma już odpowiedź' 
      }, { status: 400 });
    }
    
    // Przygotowujemy dane do aktualizacji
    const dataToUpdate = {
      location: data.location,
      location_data: data.producerAddress ? JSON.stringify(data.producerAddress) : null,
      delivery_data: data.delivery ? JSON.stringify(data.delivery) : null,
      loading_contact: data.loadingContact,
      unloading_contact: data.unloadingContact,
      delivery_date: data.deliveryDate,
      documents: data.documents,
      notes: data.notes,
      distance_km: data.distanceKm || 0
    };
    
    // Aktualizujemy rekord w bazie
    await db('spedycje')
      .where('id', id)
      .update(dataToUpdate);
    
    return NextResponse.json({ 
      success: true,
      message: 'Zlecenie zostało zaktualizowane'
    });
  } catch (error) {
    console.error('Error updating spedycja:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}