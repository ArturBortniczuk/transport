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
    
    // Informacja czy transport już został oceniony
    const canBeRated = ratings.length === 0;
    
    // Sprawdzamy czy ocena jest pozytywna (przy nowym systemie z łapkami zamiast gwiazdek)
    const isPositive = ratings.length > 0 ? ratings[0].is_positive : null;
    
    return NextResponse.json({ 
      success: true, 
      ratings,
      isPositive,
      canBeRated // Dodajemy informację, czy transport może być oceniony
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
    if (!ratingData.transportId || ratingData.isPositive === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane: wymagane transport ID i ocena' 
      }, { status: 400 });
    }
    
    // Sprawdź czy użytkownik już ocenił ten transport
    const existingUserRating = await db('transport_ratings')
      .where('transport_id', ratingData.transportId)
      .where('rater_email', userId)
      .first();
    
    if (existingUserRating) {
      // Aktualizuj istniejącą ocenę użytkownika
      console.log('Aktualizowanie istniejącej oceny dla użytkownika:', userId);
      
      try {
        await db('transport_ratings')
          .where('id', existingUserRating.id)
          .update({
            is_positive: ratingData.isPositive,
            rating: numericRating,
            comment: ratingData.comment || '',
            created_at: db.fn.now() // Zaktualizuj datę
          });
        
        return NextResponse.json({ 
          success: true, 
          message: 'Ocena została zaktualizowana' 
        });
      } catch (updateError) {
        console.error('Błąd podczas aktualizacji oceny:', updateError);
        return NextResponse.json({ 
          success: false, 
          error: `Błąd podczas aktualizacji oceny: ${updateError.message}` 
        }, { status: 500 });
      }
    }
    
    // Sprawdź czy ktoś inny już ocenił ten transport (tylko pierwszy może oceniać)
    const existingOtherRatings = await db('transport_ratings')
      .where('transport_id', ratingData.transportId)
      .where('rater_email', '!=', userId)
      .count('id as count')
      .first();
    
    if (existingOtherRatings && existingOtherRatings.count > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ten transport został już oceniony przez inną osobę i nie może być oceniony ponownie' 
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
    
    // Konwersja oceny boolowskiej na numeryczną (dla kompatybilności)
    const numericRating = ratingData.isPositive ? 5 : 1;
    
    // Dodaj nową ocenę z wartościami dla obu kolumn
    try {
      await db('transport_ratings').insert({
        transport_id: ratingData.transportId,
        is_positive: ratingData.isPositive,
        rating: numericRating, // Dodajemy wartość dla kolumny rating
        comment: ratingData.comment || '',
        rater_email: userId,
        rater_name: user.name
      });
    
      return NextResponse.json({ 
        success: true, 
        message: 'Ocena została dodana' 
      });
    } catch (insertError) {
      console.error('Błąd podczas wstawiania oceny:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: `Błąd podczas wstawiania oceny: ${insertError.message}` 
      }, { status: 500 });
    }
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
