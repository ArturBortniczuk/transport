// src/app/api/spedition-detailed-ratings/route.js - API DLA SPEDYCJI z obsługą "Inny problem"
import { NextResponse } from 'next/server'
import db from '@/database/db'

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null
  }
  
  try {
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first()
    
    return session?.user_id
  } catch (error) {
    console.error('Session validation error:', error)
    return null
  }
}

// GET - Pobierz oceny transportu spedycyjnego
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const speditionId = searchParams.get('speditionId')
    const raterEmail = searchParams.get('raterEmail')
    
    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)
    
    if (!speditionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Spedition ID is required' 
      }, { status: 400 })
    }
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('spedition_detailed_ratings')
    if (!tableExists) {
      return NextResponse.json({ 
        success: true, 
        rating: null,
        stats: { totalRatings: 0, overallRatingPercentage: null },
        canBeRated: userId ? true : false,
        hasUserRated: false,
        allRatings: []
      })
    }
    
    // Pobierz wszystkie oceny dla transportu spedycyjnego
    let allDetailedRatings = []
    try {
      allDetailedRatings = await db('spedition_detailed_ratings')
        .where('spedition_id', speditionId)
        .orderBy('id', 'desc')
        .select('*')
    } catch (error) {
      console.error('Błąd pobierania ocen spedycji:', error)
      allDetailedRatings = []
    }
    
    const totalRatings = allDetailedRatings.length
    
    // Oblicz ogólny procent pozytywnych ocen
    let overallRatingPercentage = null
    if (totalRatings > 0) {
      let totalCriteria = 0
      let positiveCriteria = 0
      
      allDetailedRatings.forEach(rating => {
        // Jeśli zaznaczono "Inny problem", uznajemy ocenę za negatywną
        if (rating.other_problem === true) {
          totalCriteria += 8 // 8 kryteriów dla spedycji
          positiveCriteria += 0 // żadne punkty pozytywne
          return // pomijamy dalsze sprawdzanie
        }
        
        const criteria = [
          rating.carrier_professional,
          rating.loading_on_time,
          rating.cargo_complete,
          rating.cargo_undamaged,
          rating.delivery_notified,
          rating.delivery_on_time,
          rating.documents_complete,
          rating.documents_correct
        ]
        
        criteria.forEach(criterion => {
          if (criterion !== null) {
            totalCriteria++
            if (criterion === true) positiveCriteria++
          }
        })
      })
      
      overallRatingPercentage = totalCriteria > 0 ?
        Math.round((positiveCriteria / totalCriteria) * 100) : null
    }
    
    // Sprawdź czy użytkownik może ocenić i czy już ocenił
    const canBeRated = userId ? totalRatings === 0 : false
    const hasUserRated = userId ? 
      allDetailedRatings.some(r => r.rater_email === userId) : false
    
    // Pobierz konkretną ocenę użytkownika jeśli podano raterEmail
    let rating = null
    if (raterEmail) {
      rating = allDetailedRatings.find(r => r.rater_email === raterEmail)
    } else if (userId) {
      rating = allDetailedRatings.find(r => r.rater_email === userId)
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
    })
  } catch (error) {
    console.error('Error fetching spedition rating:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// POST - Dodaj/aktualizuj ocenę transportu spedycyjnego
export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }
    
    const { speditionId, ratings, comment, otherProblem } = await request.json()
    
    if (!speditionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane: wymagane spedition ID' 
      }, { status: 400 })
    }
    
    // Walidacja: albo wszystkie oceny, albo "inny problem" z komentarzem
    if (otherProblem) {
      if (!comment || comment.trim() === '') {
        return NextResponse.json({ 
          success: false, 
          error: 'Przy wyborze "Inny problem" komentarz jest wymagany' 
        }, { status: 400 })
      }
    } else {
      if (!ratings || Object.values(ratings).some(r => r === null || r === undefined)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Wszystkie kryteria muszą być ocenione' 
        }, { status: 400 })
      }
    }
    
    // Sprawdź czy transport spedycyjny istnieje i można go ocenić
    const spedition = await db('spedycje')
      .where('id', speditionId)
      .select('status')
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
        error: 'Można ocenić tylko ukończone transporty' 
      }, { status: 400 })
    }

    // Sprawdź czy tabela szczegółowych ocen istnieje, jeśli nie - utwórz ją
    const detailedRatingsExist = await db.schema.hasTable('spedition_detailed_ratings')
    
    if (!detailedRatingsExist) {
      await db.schema.createTable('spedition_detailed_ratings', (table) => {
        table.increments('id').primary()
        table.integer('spedition_id').notNullable()
        table.string('rater_email').notNullable()
        table.string('rater_name')
        table.boolean('carrier_professional')
        table.boolean('loading_on_time')
        table.boolean('cargo_complete')
        table.boolean('cargo_undamaged')
        table.boolean('delivery_notified')
        table.boolean('delivery_on_time')
        table.boolean('documents_complete')
        table.boolean('documents_correct')
        table.boolean('other_problem').defaultTo(false)
        table.text('comment')
        table.timestamp('rated_at').defaultTo(db.fn.now())
        
        table.index(['spedition_id'])
        table.unique(['spedition_id', 'rater_email'])
      })
    }

    // Sprawdź czy użytkownik już ocenił ten transport
    const existingRating = await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .where('rater_email', userId)
      .first()

    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('name')
      .first()

    const ratingData = {
      spedition_id: speditionId,
      rater_email: userId,
      rater_name: user?.name || userId,
      carrier_professional: otherProblem ? null : ratings.carrierProfessional,
      loading_on_time: otherProblem ? null : ratings.loadingOnTime,
      cargo_complete: otherProblem ? null : ratings.cargoComplete,
      cargo_undamaged: otherProblem ? null : ratings.cargoUndamaged,
      delivery_notified: otherProblem ? null : ratings.deliveryNotified,
      delivery_on_time: otherProblem ? null : ratings.deliveryOnTime,
      documents_complete: otherProblem ? null : ratings.documentsComplete,
      documents_correct: otherProblem ? null : ratings.documentsCorrect,
      other_problem: otherProblem || false,
      comment: comment || ''
    }
    
    let ratingId
    let isNewRating = false
    
    if (existingRating) {
      // Aktualizuj istniejącą ocenę
      await db('spedition_detailed_ratings')
        .where('id', existingRating.id)
        .update(ratingData)
      
      ratingId = existingRating.id
    } else {
      // Dodaj nową ocenę
      const insertResult = await db('spedition_detailed_ratings')
        .insert(ratingData)
        .returning('id')
      
      ratingId = insertResult[0]?.id || insertResult[0]
      isNewRating = true
    }
    
    return NextResponse.json({ 
      success: true, 
      message: existingRating ? 'Ocena spedycji została zaktualizowana' : 'Ocena spedycji została dodana',
      ratingId: ratingId
    })
    
  } catch (error) {
    console.error('Error adding spedition rating:', error)
    
    // Sprawdź czy błąd to duplikat klucza
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Już oceniłeś ten transport spedycyjny. Spróbuj odświeżyć stronę.' 
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas zapisywania oceny: ' + error.message 
    }, { status: 500 })
  }
}