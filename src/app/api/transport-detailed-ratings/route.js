// src/app/api/transport-detailed-ratings/route.js - ZAKTUALIZOWANA WERSJA Z POWIADOMIENIAMI
import { NextResponse } from 'next/server';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  try {
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first();
    
    return session?.user_id;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
};

// Funkcja do wysyłania powiadomienia email
const sendRatingNotification = async (transportId, ratingId) => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-rating-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transportId,
        ratingId
      })
    });
    
    const result = await response.json();
    console.log('Wynik wysyłania powiadomienia:', result);
    return result;
  } catch (error) {
    console.error('Błąd wysyłania powiadomienia email:', error);
    return { success: false, error: error.message };
  }
};

// GET /api/transport-detailed-ratings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transportId = searchParams.get('transportId');
    const raterEmail = searchParams.get('raterEmail');
    
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!transportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport ID is required' 
      }, { status: 400 });
    }
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('transport_detailed_ratings');
    if (!tableExists) {
      return NextResponse.json({ 
        success: true, 
        rating: null,
        stats: { totalRatings: 0, overallRatingPercentage: null },
        canBeRated: userId ? true : false,
        hasUserRated: false,
        allRatings: []
      });
    }
    
    // Pobierz wszystkie oceny dla transportu
    const allDetailedRatings = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .orderBy('created_at', 'desc')
      .select('*');
    
    const totalRatings = allDetailedRatings.length;
    
    // Oblicz procent pozytywnych ocen
    let overallRatingPercentage = null;
    
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
      allRatings: allDetailedRatings
    });
  } catch (error) {
    console.error('Error fetching detailed rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/transport-detailed-ratings - ZAKTUALIZOWANA WERSJA Z POWIADOMIENIAMI
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
    
    for (const field of requiredRatings) {
      if (ratings[field] === undefined || ratings[field] === null) {
        return NextResponse.json({ 
          success: false, 
          error: `Pole "${field}" jest wymagane` 
        }, { status: 400 });
      }
    }
    
    // Sprawdź czy transport istnieje i ma odpowiedni status
    const transport = await db('transports')
      .where('id', transportId)
      .select('status')
      .first();
    
    if (!transport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport nie istnieje' 
      }, { status: 404 });
    }
    
    if (transport.status !== 'completed') {
      return NextResponse.json({ 
        success: false, 
        error: 'Można ocenić tylko ukończone transporty' 
      }, { status: 400 });
    }
    
    // Sprawdź czy tabela istnieje, jeśli nie - utwórz ją
    const tableExists = await db.schema.hasTable('transport_detailed_ratings');
    if (!tableExists) {
      await db.schema.createTable('transport_detailed_ratings', table => {
        table.increments('id').primary();
        table.integer('transport_id').notNullable();
        table.string('rater_email').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        
        // Kategoria: Kierowca
        table.boolean('driver_professional');
        table.boolean('driver_tasks_completed');
        
        // Kategoria: Towar
        table.boolean('cargo_complete');
        table.boolean('cargo_correct');
        
        // Kategoria: Organizacja dostawy
        table.boolean('delivery_notified');
        table.boolean('delivery_on_time');
        
        // Dodatkowy komentarz
        table.text('comment');
        
        // Upewnij się, że jeden użytkownik może ocenić transport tylko raz
        table.unique(['transport_id', 'rater_email']);
        
        // Indeksy
        table.index('transport_id');
        table.index('rater_email');
        
        // Klucz obcy do tabeli transportów
        table.foreign('transport_id').references('id').inTable('transports');
      });
    }
    
    // Sprawdź czy użytkownik już ocenił ten transport
    const existingRating = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .where('rater_email', userId)
      .first();
    
    // Sprawdź czy już istnieją jakieś oceny dla tego transportu (jeśli nie edytujemy istniejącej)
    if (!existingRating) {
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
    }
    
    // Przygotuj dane oceny
    const ratingData = {
      transport_id: transportId,
      rater_email: userId,
      driver_professional: ratings.driverProfessional,
      driver_tasks_completed: ratings.driverTasksCompleted,
      cargo_complete: ratings.cargoComplete,
      cargo_correct: ratings.cargoCorrect,
      delivery_notified: ratings.deliveryNotified,
      delivery_on_time: ratings.deliveryOnTime,
      comment: comment || '',
      created_at: new Date()
    };
    
    console.log('Dane do zapisu:', ratingData);
    
    let ratingId;
    let isNewRating = false;
    
    if (existingRating) {
      // Aktualizuj istniejącą ocenę
      console.log('Aktualizowanie szczegółowej oceny dla użytkownika:', userId);
      await db('transport_detailed_ratings')
        .where('id', existingRating.id)
        .update(ratingData);
      
      ratingId = existingRating.id;
    } else {
      // Dodaj nową ocenę
      console.log('Dodawanie nowej szczegółowej oceny dla użytkownika:', userId);
      const insertResult = await db('transport_detailed_ratings')
        .insert(ratingData)
        .returning('id');
      
      ratingId = insertResult[0]?.id || insertResult[0];
      isNewRating = true;
    }
    
    // NOWE: Wyślij powiadomienie email tylko dla nowych ocen
    if (isNewRating && ratingId) {
      console.log('Wysyłanie powiadomienia email o nowej ocenie...');
      try {
        // Wywołaj endpoint do wysyłania powiadomień (wewnętrzne API call)
        const notificationResult = await sendRatingNotification(transportId, ratingId);
        console.log('Powiadomienie email wysłane:', notificationResult);
      } catch (emailError) {
        // Nie przerywaj procesu jeśli email się nie wyśle
        console.error('Błąd wysyłania powiadomienia email (nie przerywa procesu):', emailError);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: existingRating ? 'Szczegółowa ocena została zaktualizowana' : 'Szczegółowa ocena została dodana i powiadomienie wysłane',
      ratingId: ratingId
    });
    
  } catch (error) {
    console.error('Error adding detailed transport rating:', error);
    
    // Sprawdź czy błąd to duplikat klucza
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Już oceniłeś ten transport. Spróbuj odświeżyć stronę.' 
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas zapisywania oceny: ' + error.message 
    }, { status: 500 });
  }
}