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

// GET /api/transport-detailed-ratings?transportId=X
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transportId = searchParams.get('transportId');
    const raterEmail = searchParams.get('raterEmail');
    
    // Sprawdzamy uwierzytelnienie dla pełnych statystyk
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
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
          rating: null,
          stats: {
            totalRatings: 0,
            overallRatingPercentage: null
          },
          canBeRated: true,
          hasUserRated: false
        });
      }
    } catch (error) {
      return NextResponse.json({ 
        success: true, 
        rating: null,
        stats: {
          totalRatings: 0,
          overallRatingPercentage: null
        },
        canBeRated: true,
        hasUserRated: false
      });
    }
    
    // Pobierz wszystkie szczegółowe oceny dla tego transportu
    const allDetailedRatings = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .select('*');
    
    console.log(`Znaleziono ${allDetailedRatings.length} szczegółowych ocen dla transportu ${transportId}`);
    
    // Oblicz statystyki
    let overallRatingPercentage = null;
    const totalRatings = allDetailedRatings.length;
    
    if (totalRatings > 0) {
      let totalCriteria = 0;
      let positiveCriteria = 0;
      
      allDetailedRatings.forEach(rating => {
        const criteria = [
          rating.driver_professional, 
          rating.driver_tasks_completed, 
          rating.cargo_complete, 
          rating.cargo_correct, 
          rating.delivery_notified, 
          rating.delivery_on_time
        ];
        
        criteria.forEach(criterion => {
          if (criterion !== null && criterion !== undefined) {
            totalCriteria++;
            if (criterion === true || criterion === 1) {
              positiveCriteria++;
            }
          }
        });
      });
      
      overallRatingPercentage = totalCriteria > 0 ? 
        Math.round((positiveCriteria / totalCriteria) * 100) : null;
    }
    
    // Sprawdź czy użytkownik może ocenić i czy już ocenił
    const canBeRated = userId ? totalRatings === 0 : false;
    const hasUserRated = userId ? 
      allDetailedRatings.some(r => r.rater_email === userId) : false;
    
    // Pobierz konkretną ocenę użytkownika jeśli podano raterEmail
    let rating = null;
    if (raterEmail) {
      rating = allDetailedRatings.find(r => r.rater_email === raterEmail);
    } else if (userId) {
      rating = allDetailedRatings.find(r => r.rater_email === userId);
    }
    
    return NextResponse.json({ 
      success: true, 
      rating,
      stats: {
        totalRatings,
        overallRatingPercentage
      },
      canBeRated,
      hasUserRated,
      allRatings: allDetailedRatings // Wszystkie oceny dla dodatkowego kontekstu
    });
  } catch (error) {
    console.error('Error fetching detailed rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/transport-detailed-ratings - NAPRAWIONA WERSJA
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
    
    console.log('Otrzymane dane oceny:', { transportId, ratings, comment });
    
    if (!transportId || !ratings) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane: wymagane transport ID i oceny' 
      }, { status: 400 });
    }
    
    // WALIDACJA OCEN - sprawdź czy wszystkie wymagane pola są wypełnione
    const requiredRatings = [
      'driverProfessional',
      'driverTasksCompleted', 
      'cargoComplete',
      'cargoCorrect',
      'deliveryNotified',
      'deliveryOnTime'
    ];
    
    const hasAllRatings = requiredRatings.every(key => ratings[key] !== null && ratings[key] !== undefined);
    
    if (!hasAllRatings) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wszystkie kryteria oceny muszą być wypełnione (tak/nie)' 
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
      
      console.log('Dane do zapisu:', ratingData);
      
      if (existingRating) {
        // Aktualizuj istniejącą ocenę
        console.log('Aktualizowanie szczegółowej oceny dla użytkownika:', userId);
        await db('transport_detailed_ratings')
          .where('id', existingRating.id)
          .update(ratingData);
      } else {
        // Sprawdź czy już istnieją jakieś oceny dla tego transportu
        const existingRatingsCount = await db('transport_detailed_ratings')
          .where('transport_id', transportId)
          .count('* as count')
          .first();
        
        const ratingsCount = parseInt(existingRatingsCount?.count || 0);
        
        if (ratingsCount > 0) {
          return NextResponse.json({ 
            success: false, 
            error: 'Transport został już oceniony przez innego użytkownika' 
          }, { status: 400 });
        }
        
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
