// src/app/api/kurier/tracking/[trackingNumber]/route.js
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

// GET - Pobierz status śledzenia przesyłki
export async function GET(request, { params }) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { trackingNumber } = params;
    
    if (!trackingNumber) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak numeru śledzenia' 
      }, { status: 400 });
    }

    console.log('Tracking request for:', trackingNumber);

    // Pobierz status z DHL
    const { default: DHLApiService } = await import('@/app/services/dhl-api');
    const trackingResult = await DHLApiService.getShipmentStatus(trackingNumber);
    
    if (!trackingResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie udało się pobrać statusu przesyłki: ' + trackingResult.error 
      }, { status: 500 });
    }

    // Opcjonalnie: zaktualizuj status w lokalnej bazie danych
    try {
      // Znajdź zamówienie po numerze śledzenia w notatkach
      const zamowienia = await db('kuriers')
        .whereRaw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.trackingNumber')) = ?", [trackingNumber])
        .select('id', 'status', 'notes');

      if (zamowienia.length > 0) {
        const zamowienie = zamowienia[0];
        const notes = JSON.parse(zamowienie.notes || '{}');
        
        // Zaktualizuj status śledzenia w notatkach
        notes.dhl.lastTracked = new Date().toISOString();
        notes.dhl.trackingStatus = trackingResult.status;
        notes.dhl.trackingEvents = trackingResult.events;
        
        // Zaktualizuj główny status zamówienia na podstawie statusu DHL
        let newStatus = zamowienie.status;
        if (trackingResult.status === 'DELIVERED') {
          newStatus = 'delivered';
        } else if (trackingResult.status === 'IN_TRANSIT') {
          newStatus = 'sent';
        }
        
        await db('kuriers')
          .where('id', zamowienie.id)
          .update({
            status: newStatus,
            notes: JSON.stringify(notes)
          });
        
        console.log('Updated local tracking status for order:', zamowienie.id);
      }
    } catch (updateError) {
      console.warn('Failed to update local tracking status:', updateError);
      // Nie przerywaj żądania jeśli aktualizacja lokalna nie powiedzie się
    }

    return NextResponse.json({ 
      success: true, 
      trackingNumber: trackingNumber,
      status: trackingResult.status,
      events: trackingResult.events,
      estimatedDelivery: trackingResult.estimatedDelivery,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error tracking shipment:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// POST - Wymuś odświeżenie statusu śledzenia
export async function POST(request, { params }) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { trackingNumber } = params;
    
    if (!trackingNumber) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak numeru śledzenia' 
      }, { status: 400 });
    }

    console.log('Force refresh tracking for:', trackingNumber, 'by user:', userId);

    // Pobierz świeży status z DHL
    const { default: DHLApiService } = await import('@/app/services/dhl-api');
    const trackingResult = await DHLApiService.getShipmentStatus(trackingNumber);
    
    if (!trackingResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie udało się odświeżyć statusu przesyłki: ' + trackingResult.error 
      }, { status: 500 });
    }

    // Wymuś aktualizację w lokalnej bazie
    const zamowienia = await db('kuriers')
      .whereRaw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.trackingNumber')) = ?", [trackingNumber])
      .select('id', 'status', 'notes');

    if (zamowienia.length > 0) {
      const zamowienie = zamowienia[0];
      const notes = JSON.parse(zamowienie.notes || '{}');
      
      // Zaktualizuj wszystkie dane śledzenia
      notes.dhl.lastTracked = new Date().toISOString();
      notes.dhl.lastTrackedBy = userId;
      notes.dhl.trackingStatus = trackingResult.status;
      notes.dhl.trackingEvents = trackingResult.events;
      notes.dhl.estimatedDelivery = trackingResult.estimatedDelivery;
      
      // Zaktualizuj główny status
      let newStatus = zamowienie.status;
      if (trackingResult.status === 'DELIVERED') {
        newStatus = 'delivered';
      } else if (trackingResult.status === 'IN_TRANSIT') {
        newStatus = 'sent';
      }
      
      await db('kuriers')
        .where('id', zamowienie.id)
        .update({
          status: newStatus,
          notes: JSON.stringify(notes)
        });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Status śledzenia został odświeżony',
        trackingNumber: trackingNumber,
        status: trackingResult.status,
        events: trackingResult.events,
        estimatedDelivery: trackingResult.estimatedDelivery,
        updatedOrderId: zamowienie.id
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono zamówienia z tym numerem śledzenia' 
      }, { status: 404 });
    }

  } catch (error) {
    console.error('Error force refreshing tracking:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}
