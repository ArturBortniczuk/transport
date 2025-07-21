// src/app/api/transport-ratings-bulk/route.js - Z CACHE
import { NextResponse } from 'next/server';
import db from '@/database/db';

// Cache w pamięci - w produkcji można użyć Redis
const ratingsCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minut cache

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
    
    const requestBody = await request.json();
    const { transportIds } = requestBody || {};
    
    if (!transportIds || !Array.isArray(transportIds) || transportIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport IDs are required and must be an array' 
      }, { status: 400 });
    }
    
    // CACHE: Sprawdź cache dla tego zestawu transportów
    const cacheKey = `${userId}-${transportIds.sort().join(',')}`;
    const cached = ratingsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit dla ${transportIds.length} transportów`);
      return NextResponse.json({ 
        success: true, 
        ratings: cached.data
      });
    }
    
    console.log(`Cache miss - pobieranie ocen dla ${transportIds.length} transportów z bazy`);
    
    const ratingsData = {};
    
    try {
      // OPTYMALIZACJA: Pobierz wszystkie oceny w jednym zapytaniu
      const allRatings = await db('transport_ratings')
        .whereIn('transport_id', transportIds)
        .select('*')
        .orderBy('created_at', 'desc');
      
      console.log(`Znaleziono ${allRatings.length} ocen w bazie`);
      
      // OPTYMALIZACJA: Pobierz wszystkie szczegółowe oceny w jednym zapytaniu
      let allDetailedRatings = [];
      try {
        const hasDetailedTable = await db.schema.hasTable('transport_detailed_ratings');
        if (hasDetailedTable) {
          allDetailedRatings = await db('transport_detailed_ratings')
            .whereIn('transport_id', transportIds)
            .select('*');
          console.log(`Znaleziono ${allDetailedRatings.length} szczegółowych ocen`);
        }
      } catch (error) {
        console.log('Tabela transport_detailed_ratings nie istnieje lub błąd:', error.message);
      }
      
      // Grupuj oceny według transport_id
      const ratingsByTransport = {};
      allRatings.forEach(rating => {
        const transportId = rating.transport_id;
        if (!ratingsByTransport[transportId]) {
          ratingsByTransport[transportId] = [];
        }
        ratingsByTransport[transportId].push(rating);
      });
      
      // Grupuj szczegółowe oceny według transport_id
      const detailedRatingsByTransport = {};
      allDetailedRatings.forEach(rating => {
        const transportId = rating.transport_id;
        if (!detailedRatingsByTransport[transportId]) {
          detailedRatingsByTransport[transportId] = [];
        }
        detailedRatingsByTransport[transportId].push(rating);
      });
      
      // Przygotuj dane dla każdego transportu
      for (const transportId of transportIds) {
        const ratings = ratingsByTransport[transportId] || [];
        const detailedRatings = detailedRatingsByTransport[transportId] || [];
        const canBeRated = ratings.length === 0 && detailedRatings.length === 0; // Poprawiona logika
        const hasUserRated = ratings.some(r => r.rater_email === userId) || detailedRatings.some(r => r.rater_email === userId); // Poprawiona logika
        const userRating = ratings.find(r => r.rater_email === userId) || null;
        
        // OPTYMALIZACJA: Oblicz statystyki lokalnie
        let overallRatingPercentage = null;
        
        // ZMIANA TUTAJ: Użyj `detailedRatings.length` do obliczenia liczby ocen
        const totalRatings = detailedRatings.length > 0 ? detailedRatings.length : ratings.length;
        
        if (totalRatings > 0) {
          // Najpierw spróbuj obliczyć na podstawie szczegółowych ocen
          if (detailedRatings.length > 0) {
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
            
            overallRatingPercentage = totalCriteria > 0 ? Math.round((positiveCriteria / totalCriteria) * 100) : null;
          } else {
            // Fallback - oblicz na podstawie prostych ocen pozytywnych/negatywnych
            const positiveRatings = ratings.filter(r => r.is_positive === true || r.is_positive === 1).length;
            overallRatingPercentage = Math.round((positiveRatings / ratings.length) * 100);
          }
        }
        
        ratingsData[transportId] = {
          canBeRated,
          hasUserRated,
          userRating,
          ratings,
          stats: {
            totalRatings: totalRatings, // Użycie nowej, poprawnej wartości
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
    
    // CACHE: Zapisz wyniki w cache
    ratingsCache.set(cacheKey, {
      data: ratingsData,
      timestamp: Date.now()
    });
    
    // OPTYMALIZACJA: Czyść stary cache co jakiś czas
    if (ratingsCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of ratingsCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          ratingsCache.delete(key);
        }
      }
    }
    
    console.log(`Zwracanie danych dla ${transportIds.length} transportów (cache size: ${ratingsCache.size})`);
    
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

// Opcjonalnie: endpoint do czyszczenia cache (dla adminów)
export async function DELETE(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź czy użytkownik jest adminem
    const user = await db('users')
      .where('email', userId)
      .select('is_admin', 'role')
      .first();
    
    const isAdmin = user?.is_admin === true || 
                  user?.is_admin === 1 || 
                  user?.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin privileges required' 
      }, { status: 403 });
    }
    
    // Wyczyść cache
    ratingsCache.clear();
    console.log('Cache ratings został wyczyszczony przez admina');
    
    return NextResponse.json({ 
      success: true,
      message: 'Cache został wyczyszczony'
    });
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
