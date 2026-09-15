// src/app/api/transport-ratings/comment/route.js
import { NextResponse } from 'next/server'
import db from '@/database/db'
import { validateSession } from '@/lib/auth'

export async function POST(request) {
  try {
    console.log('Comment endpoint called');
    
    const authToken = request.cookies.get('authToken')?.value;
    const userEmail = await validateSession(request) || await validateSession(authToken);
    
    if (!userEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak autoryzacji lub nieprawidłowa sesja' 
      }, { status: 401 });
    }
    
    if (!userEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowa sesja' 
      }, { status: 401 })
    }

    const { transportId, comment } = await request.json()
    console.log('Comment data:', { transportId, comment });
    
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

    // Sprawdź czy tabela komentarzy istnieje
    const tableExists = async (tableName) => {
      try {
        await db.raw(`SELECT 1 FROM ${tableName} LIMIT 1`);
        return true;
      } catch (error) {
        return false;
      }
    };

    const commentsTableExists = await tableExists('transport_comments');
    
    if (!commentsTableExists) {
      console.log('Creating transport_comments table...');
      await db.schema.createTable('transport_comments', (table) => {
        table.increments('id').primary()
        table.integer('transport_id').notNullable()
        table.string('commenter_email').notNullable()
        table.text('comment').notNullable()
        table.timestamp('created_at').defaultTo(db.fn.now())
        
        table.index(['transport_id'])
        table.index(['commenter_email'])
        // Brak unique constraint - pozwalamy na wiele komentarzy od jednego użytkownika
      })
      console.log('transport_comments table created');
    }

    // Dodaj komentarz do oddzielnej tabeli
    const commentData = {
      transport_id: transportId,
      commenter_email: userEmail,
      comment: comment.trim(),
      created_at: new Date()
    };

    console.log('Inserting comment:', commentData);
    
    await db('transport_comments').insert(commentData);

    console.log('Comment inserted successfully');

    return NextResponse.json({
      success: true,
      message: 'Komentarz został dodany'
    })

  } catch (error) {
    console.error('Błąd dodawania komentarza:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas dodawania komentarza: ' + error.message 
    }, { status: 500 })
  }
}
