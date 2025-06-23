// src/app/api/transport-ratings-bulk/route.js
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

// Funkcja do obliczania procentów na podstawie szczegółowych ocen
const calculateDetailedPercentage = async (transportId) => {
  try {
    // Sprawdź czy tabela szczegółowych ocen istnieje
    const hasTable = await db.schema.hasTable('transport_detailed_ratings');
    if (!hasTable) {
      return null;
    }
    
    // Pobierz szczegółowe oceny dla tego transportu
    const detailedRatings = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .select('*');
    
    if (detailedRatings.length === 0) {
      return null;
    }
    
    // Oblicz procent na podstawie szczegółowych kryteriów
    let totalCriteria = 0;
    let positiveCriteria = 0;
    
    detailedRatings.forEach(rating => {
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
    
    return totalCriteria > 0 ? Math.round((positiveCriteria / totalCriteria) * 100) : null;
  } catch (error) {
    console.error('Błąd obliczania szczegółowego procentu:', error);
    return null;
  }
};

// POST /api/transport-ratings-bulk
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
    
    const { transportIds } = await request.json();
    
    if (!transportIds || !Array.isArray(transportIds) || transportIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport IDs are required' 
      }, { status: 400 });
    }
    
    console.log(`Pobieranie ocen dla ${transportIds.length} transportów`);
    
    const ratingsData = {};
    
    try {
      // Pobierz wszystkie oceny w jednym zapytaniu
      const allRatings = await db('transport_ratings')
        .whereIn('transport_id', transportIds)
        .select('*')
        .orderBy('created_at', 'desc');
      
      console.log(`Znaleziono ${allRatings.length} ocen`);
      
      // Grupuj oceny według transport_id
      const ratingsByTransport = {};
      allRatings.forEach(rating => {
        const transportId = rating.transport_id;
        if (!ratingsByTransport[transportId]) {
          ratingsByTransport[transportId] = [];
        }
        ratingsByTransport[transportId].push(rating);
      });
      
      // Przygotuj dane dla każdego transportu
      for (const transportId of transportIds) {
        const ratings = ratingsByTransport[transportId] || [];
        const canBeRated = ratings.length === 0;
        const hasUserRated = ratings.some(r => r.rater_email === userId);
        const userRating = ratings.find(r => r.rater_email === userId) || null;
        
        // Oblicz statystyki - POPRAWIONA WERSJA
        let overallRatingPercentage = null;
        
        if (ratings.length > 0) {
          // Najpierw spróbuj obliczyć na podstawie szczegółowych ocen
          const detailedPercentage = await calculateDetailedPercentage(transportId);
          
          if (detailedPercentage !== null) {
            overallRatingPercentage = detailedPercentage;
            console.log(`Transport ${transportId}: Szczegółowy procent = ${detailedPercentage}%`);
          } else {
            // Fallback - oblicz na podstawie prostych ocen pozytywnych/negatywnych
            const positiveRatings = ratings.filter(r => r.is_positive === true || r.is_positive === 1).length;
            overallRatingPercentage = Math.round((positiveRatings / ratings.length) * 100);
            console.log(`Transport ${transportId}: Prosty procent = ${overallRatingPercentage}% (${positiveRatings}/${ratings.length})`);
          }
        }
        
        ratingsData[transportId] = {
          canBeRated,
          hasUserRated,
          userRating,
          ratings,
          stats: {
            totalRatings: ratings.length,
            overallRatingPercentage
          }
        };
      }
      
    } catch (error) {
      console.error('Błąd pobierania ocen z bazy:', error);
      // Ustaw domyślne wartości w przypadku błędu
      transportIds.forEach(transportId => {
        ratingsData[transportId] = {
          canBeRated: true,
          hasUserRated: false,
          userRating: null,
          ratings: [],
          stats: { totalRatings: 0, overallRatingPercentage: null }
        };
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      ratings: ratingsData
    });
    
  } catch (error) {
    console.error('Error fetching bulk ratings:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
