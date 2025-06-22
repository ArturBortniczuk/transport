// src/app/api/transport-comments/route.js
import { NextResponse } from 'next/server'
import db from '@/database/db'

// Funkcja pomocnicza do weryfikacji sesji
const getUserEmailFromToken = async (authToken) => {
  if (!authToken) return null;
  
  try {
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first();
    
    return session?.user_id || null;
  } catch (error) {
    console.error('Błąd walidacji sesji:', error)
    return null
  }
};

// Funkcja sprawdzania czy tabela istnieje
const tableExists = async (tableName) => {
  try {
    await db.raw(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch (error) {
    return false;
  }
};

// Pobierz komentarze do transportu
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const transportId = searchParams.get('transportId')
    
    if (!transportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak ID transportu' 
      }, { status: 400 })
    }

    // Sprawdź czy tabela komentarzy istnieje
    const commentsTableExists = await tableExists('transport_comments');
    
    if (!commentsTableExists) {
      return NextResponse.json({
        success: true,
        comments: []
      })
    }

    // Pobierz komentarze
    const comments = await db('transport_comments')
      .where('transport_id', transportId)
      .orderBy('created_at', 'desc')
      .select('*');

    return NextResponse.json({
      success: true,
      comments
    })

  } catch (error) {
    console.error('Błąd pobierania komentarzy:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd serwera' 
    }, { status: 500 })
  }
}

// Dodaj komentarz do transportu
export async function POST(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value
    
    if (!authToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak autoryzacji' 
      }, { status: 401 })
    }

    const userEmail = await getUserEmailFromToken(authToken);
    if (!userEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowa sesja' 
      }, { status: 401 })
    }

    const { transportId, comment } = await request.json()
    
    if (!transportId || !comment || !comment.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak wymaganych danych' 
      }, { status: 400 })
    }

    // Sprawdź czy transport istnieje
    const transport = await db('transports')
      .where('id', transportId)
      .select('status')
      .first();
    
    if (!transport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport nie istnieje' 
      }, { status: 404 })
    }

    if (transport.status !== 'completed') {
      return NextResponse.json({ 
        success: false, 
        error: 'Można komentować tylko ukończone transporty' 
      }, { status: 400 })
    }

    // Sprawdź czy tabela komentarzy istnieje, jeśli nie - utwórz ją
    const commentsTableExists = await tableExists('transport_comments');
    
    if (!commentsTableExists) {
      await db.schema.createTable('transport_comments', (table) => {
        table.increments('id').primary()
        table.integer('transport_id').notNullable()
        table.string('commenter_email').notNullable()
        table.text('comment').notNullable()
        table.timestamp('created_at').defaultTo(db.fn.now())
        
        table.index(['transport_id'])
        table.index(['commenter_email'])
      })
    }

    // Dodaj komentarz
    const commentData = {
      transport_id: transportId,
      commenter_email: userEmail,
      comment: comment.trim(),
      created_at: new Date()
    };

    await db('transport_comments').insert(commentData);

    return NextResponse.json({
      success: true,
      message: 'Komentarz został dodany'
    })

  } catch (error) {
    console.error('Błąd dodawania komentarza:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas dodawania komentarza' 
    }, { status: 500 })
  }
}
