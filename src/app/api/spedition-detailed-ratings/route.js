// src/app/api/spedition-detailed-ratings/route.js - ROZSZERZONE O ROZWIĄZANIE PROBLEMU
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

// NOWA FUNKCJA: Sprawdzanie czy użytkownik jest adminem
const checkAdminStatus = async (userId) => {
  if (!userId) {
    return false
  }
  
  try {
    const user = await db('users')
      .where('email', userId)
      .select('is_admin', 'role')
      .first()
    
    const isAdmin = 
      user?.is_admin === true || 
      user?.is_admin === 1 || 
      user?.is_admin === 't' || 
      user?.is_admin === 'TRUE' || 
      user?.is_admin === 'true' ||
      user?.role === 'admin'
    
    return isAdmin
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// GET - Pobierz oceny transportu spedycyjnego - POPRAWIONE SPRAWDZANIE RESOLUTION
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
    
    const tableExists = await db.schema.hasTable('spedition_detailed_ratings')
    if (!tableExists) {
      return NextResponse.json({ 
        success: true, 
        rating: null,
        stats: { totalRatings: 0, overallRatingPercentage: null },
        canBeRated: userId ? true : false,
        hasUserRated: false,
        allRatings: [],
        hasResolution: false
      })
    }
    
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
    
    let overallRatingPercentage = null
    if (totalRatings > 0) {
      let totalCriteria = 0
      let positiveCriteria = 0
      
      allDetailedRatings.forEach(rating => {
        if (rating.other_problem === true) {
          totalCriteria += 8 
          positiveCriteria += 0
          return
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
    
    // =================================================================
    // POPRAWIONA LOGIKA SPRAWDZANIA RESOLUTION
    // Sprawdzamy w bazie, czy istnieje jakikolwiek wpis z rozwiązaniem.
    // =================================================================
    const resolutionCheck = await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .whereNotNull('admin_resolution') // Szukamy wpisu, gdzie resolution nie jest puste
      .orderBy('resolution_added_at', 'desc')
      .select('admin_resolution', 'resolution_added_by', 'resolution_added_at')
      .first();

    const hasResolution = resolutionCheck ? true : false;
    
    // ZMIENIONE: Sprawdzanie czy można ocenić lub edytować - używa hasResolution
    const canBeRated = userId ? (totalRatings === 0 && !hasResolution) : false
    const hasUserRated = userId ? 
      allDetailedRatings.some(r => r.rater_email === userId) : false
    
    let rating = null
    if (raterEmail) {
      rating = allDetailedRatings.find(r => r.rater_email === raterEmail)
    } else if (userId) {
      rating = allDetailedRatings.find(r => r.rater_email === userId)
    }
    
    // DODANE: Informacje o rozwiązaniu (używa resolutionCheck)
    const resolutionInfo = hasResolution ? {
      text: resolutionCheck.admin_resolution,
      addedBy: resolutionCheck.resolution_added_by,
      addedAt: resolutionCheck.resolution_added_at
    } : null
    
    const latestRating = allDetailedRatings.length > 0 ? allDetailedRatings[0] : null;

    return NextResponse.json({ 
      success: true, 
      rating,
      latestRating,
      stats: {
        totalRatings,
        overallRatingPercentage
      },
      canBeRated,
      hasUserRated,
      allRatings: allDetailedRatings,
      hasResolution,        // PRAWIDŁOWA FLAGA
      resolutionInfo        // PRAWIDŁOWY OBIEKT
    })
  } catch (error) {
    console.error('Error fetching spedition rating:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// POST - Dodaj/aktualizuj ocenę transportu spedycyjnego - BEZ ZMIAN
export async function POST(request) {
  try {
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

    // DODANE: Sprawdzenie czy istnieje rozwiązanie - blokada edycji
    const existingRating = await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .where('rater_email', userId)
      .first()

    if (existingRating?.admin_resolution) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie można edytować oceny - administrator dodał już rozwiązanie problemu' 
      }, { status: 403 })
    }

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
      await db('spedition_detailed_ratings')
        .where('id', existingRating.id)
        .update(ratingData)
      
      ratingId = existingRating.id
    } else {
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

// NOWY ENDPOINT PUT - Dodanie rozwiązania problemu przez administratora
export async function PUT(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }
    
    // Sprawdzenie czy użytkownik jest adminem
    const isAdmin = await checkAdminStatus(userId)
    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tylko administrator może dodać rozwiązanie problemu' 
      }, { status: 403 })
    }
    
    const { speditionId, resolution } = await request.json()
    
    if (!speditionId || !resolution || resolution.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        error: 'Spedition ID i treść rozwiązania są wymagane' 
      }, { status: 400 })
    }
    
    // Sprawdź czy ocena istnieje
    const rating = await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .first()
    
    if (!rating) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono oceny dla tego transportu spedycyjnego' 
      }, { status: 404 })
    }
    
    // Sprawdź czy rozwiązanie już istnieje
    if (rating.admin_resolution) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rozwiązanie zostało już dodane dla tego transportu' 
      }, { status: 409 })
    }
    
    // Zapisz rozwiązanie
    await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .update({
        admin_resolution: resolution,
        resolution_added_by: userId,
        resolution_added_at: new Date()
      })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Rozwiązanie problemu zostało dodane. Ocena jest teraz zablokowana.'
    })
    
  } catch (error) {
    console.error('Error adding resolution:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas zapisywania rozwiązania: ' + error.message 
    }, { status: 500 })
  }
}