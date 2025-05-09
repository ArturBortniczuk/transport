// src/app/api/transport-ratings/route.js
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

// GET /api/transport-ratings?transportId=X
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transportId = searchParams.get('transportId');
    
    if (!transportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport ID is required' 
      }, { status: 400 });
    }
    
    // Pobierz wszystkie oceny dla danego transportu wraz z informacjami o oceniających
    const ratings = await db('transport_ratings')
      .where('transport_id', transportId)
      .orderBy('created_at', 'desc')
      .select('*');
    
    // Oblicz średnią ocenę
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length
      : 0;
    
    return NextResponse.json({ 
      success: true, 
      ratings,
      averageRating: parseFloat(averageRating.toFixed(1)),
      count: ratings.length
    });
  } catch (error) {
    console.error('Error fetching transport ratings:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/transport-ratings
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
    
    // Pobierz dane oceny z żądania
    const ratingData = await request.json();
    
    // Walidacja danych
    if (!ratingData.transportId || !ratingData.rating) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane: wymagane transport ID i ocena' 
      }, { status: 400 });
    }
    
    if (ratingData.rating < 1 || ratingData.rating > 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ocena musi być liczbą od 1 do 5' 
      }, { status: 400 });
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
    
    // Sprawdź czy transport istnieje
    const transport = await db('transports')
      .where('id', ratingData.transportId)
      .first();
    
    if (!transport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport nie istnieje' 
      }, { status: 404 });
    }
    
    // Sprawdź czy użytkownik już ocenił ten transport
    const existingRating = await db('transport_ratings')
      .where({
        transport_id: ratingData.transportId,
        rater_email: userId
      })
      .first();
    
    if (existingRating) {
      // Aktualizuj istniejącą ocenę
      await db('transport_ratings')
        .where('id', existingRating.id)
        .update({
          rating: ratingData.rating,
          comment: ratingData.comment || existingRating.comment,
          created_at: db.fn.now()
        });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Ocena została zaktualizowana' 
      });
    }
    
    // Dodaj nową ocenę
    const [id] = await db('transport_ratings').insert({
      transport_id: ratingData.transportId,
      rating: ratingData.rating,
      comment: ratingData.comment || '',
      rater_email: userId,
      rater_name: user.name
    }).returning('id');
    
    return NextResponse.json({ 
      success: true, 
      id,
      message: 'Ocena została dodana' 
    });
  } catch (error) {
    console.error('Error adding transport rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE /api/transport-ratings?id=X
export async function DELETE(request) {
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
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rating ID is required' 
      }, { status: 400 });
    }
    
    // Pobierz ocenę, aby sprawdzić, czy należy do użytkownika
    const rating = await db('transport_ratings')
      .where('id', id)
      .first();
    
    if (!rating) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ocena nie istnieje' 
      }, { status: 404 });
    }
    
    // Sprawdź czy to ocena użytkownika lub czy jest adminem
    const user = await db('users')
      .where('email', userId)
      .select('is_admin', 'role')
      .first();
    
    const isAdmin = user.is_admin === true || 
                  user.is_admin === 1 || 
                  user.is_admin === 't' || 
                  user.is_admin === 'TRUE' ||
                  user.is_admin === 'true' ||
                  user.role === 'admin';
    
    if (rating.rater_email !== userId && !isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie masz uprawnień do usunięcia tej oceny' 
      }, { status: 403 });
    }
    
    // Usuń ocenę
    await db('transport_ratings')
      .where('id', id)
      .delete();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Ocena została usunięta' 
    });
  } catch (error) {
    console.error('Error deleting transport rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}