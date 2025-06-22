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
      transportIds.forEach(transportId => {
        const ratings = ratingsByTransport[transportId] || [];
        const canBeRated = ratings.length === 0;
        const hasUserRated = ratings.some(r => r.rater_email === userId);
        const userRating = ratings.find(r => r.rater_email === userId) || null;
        
        // Oblicz statystyki
        let overallRatingPercentage = null;
        if (ratings.length > 0) {
          const positiveRatings = ratings.filter(r => r.is_positive === true).length;
          overallRatingPercentage = Math.round((positiveRatings / ratings.length) * 100);
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
      });
      
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
