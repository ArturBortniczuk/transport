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

export async function GET(request, { params }) {
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
    
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie podano ID zlecenia' 
      }, { status: 400 });
    }
    
    // Pobierz dane spedycji
    const spedycja = await db('spedycje')
      .where('id', id)
      .first();
    
    if (!spedycja) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono zlecenia o podanym ID' 
      }, { status: 404 });
    }
    
    // Przetwórz dane przed wysłaniem (parsowanie JSONa)
    try {
      if (spedycja.location_data) {
        spedycja.location_data = JSON.parse(spedycja.location_data);
      }
      if (spedycja.delivery_data) {
        spedycja.delivery_data = JSON.parse(spedycja.delivery_data);
      }
      if (spedycja.response_data) {
        spedycja.response_data = JSON.parse(spedycja.response_data);
      }
    } catch (e) {
      console.error('Error parsing JSON data in spedycje:', e);
    }
    
    // Przygotuj dane w formacie zgodnym z frontendem
    const processedSpedycja = {
      id: spedycja.id,
      status: spedycja.status,
      createdBy: spedycja.created_by,
      createdByEmail: spedycja.created_by_email,
      responsiblePerson: spedycja.responsible_person,
      responsibleEmail: spedycja.responsible_email,
      mpk: spedycja.mpk,
      location: spedycja.location,
      producerAddress: spedycja.location_data,
      delivery: spedycja.delivery_data,
      loadingContact: spedycja.loading_contact,
      unloadingContact: spedycja.unloading_contact,
      deliveryDate: spedycja.delivery_date,
      documents: spedycja.documents,
      notes: spedycja.notes,
      response: spedycja.response_data,
      completedAt: spedycja.completed_at,
      createdAt: spedycja.created_at,
      distanceKm: spedycja.distance_km || (spedycja.response_data ? spedycja.response_data.distanceKm : 0)
    };
    
    return NextResponse.json({ 
      success: true, 
      spedycja: processedSpedycja
    });
  } catch (error) {
    console.error('Error fetching spedycja:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}