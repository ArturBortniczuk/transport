// src/app/api/spedition-comments/route.js - API dla komentarzy spedycji
import { NextResponse } from 'next/server'
import db from '@/database/db'
import { validateSession } from '@/lib/auth'

// Funkcja sprawdzająca czy tabela istnieje
const tableExists = async (tableName) => {
  try {
    await db.raw(`SELECT 1 FROM ${tableName} LIMIT 1`)
    return true
  } catch (error) {
    return false
  }
}

// GET - Pobierz komentarze do transportu spedycyjnego
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const speditionId = searchParams.get('speditionId')
    
    console.log('🔍 GET komentarze spedycji dla ID:', speditionId)
    
    if (!speditionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak ID transportu spedycyjnego' 
      }, { status: 400 })
    }

    // Sprawdź czy tabela komentarzy spedycji istnieje
    const commentsTableExists = await tableExists('spedition_comments')
    
    if (!commentsTableExists) {
      console.log('📝 Tabela spedition_comments nie istnieje - zwracam pustą listę')
      return NextResponse.json({
        success: true,
        comments: []
      })
    }

    // Pobierz komentarze
    const comments = await db('spedition_comments')
      .where('spedition_id', speditionId)
      .orderBy('created_at', 'desc')
      .select('*')

    console.log(`📦 Znaleziono ${comments.length} komentarzy spedycji`)

    return NextResponse.json({
      success: true,
      comments
    })

  } catch (error) {
    console.error('❌ Błąd pobierania komentarzy spedycji:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd serwera: ' + error.message 
    }, { status: 500 })
  }
}

// POST - Dodaj komentarz do transportu spedycyjnego
export async function POST(request) {
  try {
    console.log('🔔 Dodawanie komentarza spedycji...')
    
    const authToken = request.cookies.get('authToken')?.value
    
    const userEmail = await validateSession(request) || await validateSession(authToken)
    if (!userEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowa sesja lub brak autoryzacji' 
      }, { status: 401 })
    }

    const { speditionId, comment } = await request.json()
    
    if (!speditionId || !comment || !comment.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak wymaganych danych' 
      }, { status: 400 })
    }

    // Sprawdź czy transport spedycyjny istnieje
    const spedition = await db('spedycje')
      .where('id', speditionId)
      .select('*')
      .first()
    
    if (!spedition) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport spedycyjny nie istnieje' 
      }, { status: 404 })
    }

    if (spedition.status !== 'completed') {
      return NextResponse.json({ 
        success: false, 
        error: 'Można komentować tylko ukończone transporty' 
      }, { status: 400 })
    }

    // Sprawdź czy tabela komentarzy istnieje, jeśli nie - utwórz ją
    const commentsTableExists = await tableExists('spedition_comments')
    
    if (!commentsTableExists) {
      console.log('🗂️ Tworzenie tabeli spedition_comments...')
      await db.schema.createTable('spedition_comments', (table) => {
        table.increments('id').primary()
        table.integer('spedition_id').notNullable()
        table.string('commenter_email').notNullable()
        table.text('comment').notNullable()
        table.timestamp('created_at').defaultTo(db.fn.now())
        
        table.index(['spedition_id'])
        table.index(['commenter_email'])
      })
      console.log('✅ Tabela spedition_comments utworzona')
    }

    // Dodaj komentarz
    const commentData = {
      spedition_id: speditionId,
      commenter_email: userEmail,
      comment: comment.trim(),
      created_at: new Date()
    }

    console.log('💾 Zapisywanie komentarza spedycji do bazy danych...')
    await db('spedition_comments').insert(commentData)
    console.log('✅ Komentarz spedycji zapisany w bazie danych')

    return NextResponse.json({
      success: true,
      message: 'Komentarz został dodany'
    })

  } catch (error) {
    console.error('❌ Błąd dodawania komentarza spedycji:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas dodawania komentarza: ' + error.message 
    }, { status: 500 })
  }
}