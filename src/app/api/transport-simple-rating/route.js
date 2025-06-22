// src/app/api/transport-simple-rating/route.js - SUPER PROSTE API
import { NextResponse } from 'next/server'
import db from '@/database/db'

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

    // Sprawdź status transportu
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

    // Można ocenić tylko ukończone transporty
    const canBeRated = transport.status === 'completed'
    
    // PROSTE sprawdzenie czy są jakieś oceny (bez skomplikowanych joinów)
    let totalRatings = 0
    let overallPercentage = null
    
    try {
      // Sprawdź czy tabela istnieje
      const ratingsCount = await db('transport_detailed_ratings')
        .where('transport_id', transportId)
        .count('* as count')
        .first();
      
      totalRatings = parseInt(ratingsCount?.count || 0)
      
      if (totalRatings > 0) {
        // Prosta kalkulacja procentu pozytywnych ocen
        const ratings = await db('transport_detailed_ratings')
          .where('transport_id', transportId)
          .select('driver_professional', 'driver_tasks_completed', 'cargo_complete', 'cargo_correct', 'delivery_notified', 'delivery_on_time');
        
        let totalCriteria = 0
        let positiveCriteria = 0
        
        ratings.forEach(rating => {
          const criteria = [rating.driver_professional, rating.driver_tasks_completed, rating.cargo_complete, rating.cargo_correct, rating.delivery_notified, rating.delivery_on_time]
          criteria.forEach(criterion => {
            if (criterion !== null) {
              totalCriteria++
              if (criterion === true) positiveCriteria++
            }
          })
        })
        
        overallPercentage = totalCriteria > 0 ? Math.round((positiveCriteria / totalCriteria) * 100) : null
      }
    } catch (error) {
      // Tabela może nie istnieć - to OK
      console.log('Tabela transport_detailed_ratings nie istnieje:', error.message)
      totalRatings = 0
      overallPercentage = null
    }

    return NextResponse.json({
      success: true,
      canBeRated,
      totalRatings,
      overallPercentage
    })

  } catch (error) {
    console.error('Błąd API transport-simple-rating:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera' 
    }, { status: 500 })
  }
}
