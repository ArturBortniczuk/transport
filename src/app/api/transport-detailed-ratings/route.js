// src/app/api/transport-detailed-ratings/route.js
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

// GET /api/transport-detailed-ratings?transportId=X&raterEmail=Y
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transportId = searchParams.get('transportId');
    const raterEmail = searchParams.get('raterEmail');
    
    if (!transportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport ID is required' 
      }, { status: 400 });
    }
    
    // Sprawdź czy tabela istnieje
    try {
      const hasTable = await db.schema.hasTable('transport_detailed_ratings');
      if (!hasTable) {
        return NextResponse.json({ 
          success: true, 
          rating: null 
        });
      }
    } catch (error) {
      return NextResponse.json({ 
        success: true, 
        rating: null 
      });
    }
    
    let query = db('transport_detailed_ratings')
      .where('transport_id', transportId);
    
    if (raterEmail) {
      query = query.where('rater_email', raterEmail);
    }
    
    const rating = await query.first();
    
    return NextResponse.json({ 
      success: true, 
      rating 
    });
  } catch (error) {
    console.error('Error fetching detailed rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/transport-detailed-ratings (istniejący kod...)
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
    
    const { transportId, ratings, comment } = await request.json();
    
    if (!transportId || !ratings) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane: wymagane transport ID i oceny' 
      }, { status: 400 });
    }
    
    // Sprawdź czy transport istnieje
    const transport = await db('transports')
      .where('id', transportId)
      .first();
    
    if (!transport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport nie istnieje' 
      }, { status: 404 });
    }
    
    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('name', 'email')
      .first();
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono użytkownika' 
      }, { status: 404 });
    }
    
    try {
      // Sprawdź czy użytkownik już ocenił szczegółowo ten transport
      const existingRating = await db('transport_detailed_ratings')
        .where('transport_id', transportId)
        .where('rater_email', userId)
        .first();
      
      const ratingData = {
        transport_id: transportId,
        rater_email: userId,
        rater_name: user.name,
        driver_professional: ratings.driverProfessional,
        driver_tasks_completed: ratings.driverTasksCompleted,
        cargo_complete: ratings.cargoComplete,
        cargo_correct: ratings.cargoCorrect,
        delivery_notified: ratings.deliveryNotified,
        delivery_on_time: ratings.deliveryOnTime,
        comment: comment || ''
      };
      
      if (existingRating) {
        // Aktualizuj istniejącą ocenę
        console.log('Aktualizowanie szczegółowej oceny dla użytkownika:', userId);
        await db('transport_detailed_ratings')
          .where('id', existingRating.id)
          .update(ratingData);
      } else {
        // Dodaj nową ocenę
        console.log('Dodawanie nowej szczegółowej oceny dla użytkownika:', userId);
        await db('transport_detailed_ratings')
          .insert(ratingData);
      }
    
      return NextResponse.json({ 
        success: true, 
        message: 'Szczegółowa ocena została zapisana' 
      });
      
    } catch (dbError) {
      console.error('Błąd bazy danych:', dbError);
      return NextResponse.json({ 
        success: false, 
        error: `Błąd zapisu do bazy: ${dbError.message}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error adding detailed transport rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
