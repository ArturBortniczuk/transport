import { NextResponse } from 'next/server'
import db from '@/database/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSessionUser(request)
    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const user = session.user
    const canView = user.isAdmin || user.permissions?.ratings?.view !== false
    if (!canView) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do przeglądania ocen transportów'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateBasis = searchParams.get('dateBasis') || 'delivery_date' // 'delivery_date' | 'rated_at'
    const sortBy = searchParams.get('sortBy') || 'delivery_date' // 'delivery_date' | 'rated_at'

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak wymaganych parametrów' 
      }, { status: 400 })
    }

    let transports = []

    if (type === 'wlasny') {
      let query = db('transports').where('status', 'completed')

      if (dateBasis === 'rated_at') {
        const ratedIds = await db('transport_detailed_ratings')
          .where('rated_at', '>=', `${startDate} 00:00:00`)
          .where('rated_at', '<=', `${endDate} 23:59:59`)
          .distinct('transport_id')
          .pluck('transport_id')

        query = query.whereIn('id', ratedIds.length > 0 ? ratedIds : [-1])
      } else {
        query = query.whereBetween('delivery_date', [startDate, endDate])
      }

      transports = await query
        .orderBy('delivery_date', 'desc')
        .select(
          'id',
          'source_warehouse',
          'destination_city',
          'postal_code',
          'street',
          'distance',
          'driver_id',
          'vehicle_id',
          'status',
          'wz_number',
          'client_name',
          'market',
          'loading_level',
          'notes',
          'is_cyclical',
          'delivery_date',
          'completed_at',
          'requester_name',
          'requester_email',
          'mpk',
          'goods_description',
          'responsible_constructions',
          'real_client_name',
          'latitude',
          'longitude',
          'connected_transport_id'
        )

      const transportIds = transports.map(t => t.id)
      
      if (transportIds.length > 0) {
        const allRatings = await db('transport_detailed_ratings')
          .whereIn('transport_id', transportIds)
          .select('*')

        const ratingsByTransport = {}
        allRatings.forEach(rating => {
          if (!ratingsByTransport[rating.transport_id]) {
            ratingsByTransport[rating.transport_id] = []
          }
          ratingsByTransport[rating.transport_id].push(rating)
        })

        const percentagesByTransport = {}
        const latestRatingByTransport = {}

        Object.keys(ratingsByTransport).forEach(transportId => {
          const ratings = ratingsByTransport[transportId]
          const sortedRatings = [...ratings].sort((a, b) => new Date(b.rated_at || 0) - new Date(a.rated_at || 0))
          latestRatingByTransport[transportId] = sortedRatings[0] || null

          let totalCriteria = 0
          let positiveCriteria = 0
          
          ratings.forEach(rating => {
            // START POPRAWKI 1 (Transport Własny)
            if (rating.other_problem === true) {
              totalCriteria += 6; // 6 kryteriów dla transportu własnego
              positiveCriteria += 0; // 0 punktów pozytywnych
              return; // Pomiń sprawdzanie kryteriów dla tej oceny
            }
            // KONIEC POPRAWKI 1
            
            const criteria = [
              rating.driver_professional,
              rating.driver_tasks_completed,
              rating.cargo_complete,
              rating.cargo_correct,
              rating.delivery_notified,
              rating.delivery_on_time
            ]
            
            criteria.forEach(criterion => {
              if (criterion !== null) {
                totalCriteria++
                if (criterion === true || criterion === 1) positiveCriteria++
              }
            })
          })
          
          percentagesByTransport[transportId] = totalCriteria > 0 
            ? Math.round((positiveCriteria / totalCriteria) * 100) 
            : null
        })

        transports = transports.map(transport => {
          const latest = latestRatingByTransport[transport.id]
          return {
            ...transport,
            has_rating: !!ratingsByTransport[transport.id],
            rating_percentage: percentagesByTransport[transport.id] === null ? null : percentagesByTransport[transport.id],
            rated_at: latest?.rated_at ? new Date(latest.rated_at).toISOString() : null,
            rater_name: latest?.rater_name || null,
            rating_comment: latest?.comment || null
          }
        })
      } else {
        transports = transports.map(transport => ({
          ...transport,
          has_rating: false,
          rating_percentage: null,
          rated_at: null,
          rater_name: null,
          rating_comment: null
        }))
      }

      // Pobierz nazwy użytkowników
      const emails = [...new Set(transports.map(t => t.requester_email).filter(Boolean))]
      let users = []
      if (emails.length > 0) {
        users = await db('users')
          .whereIn('email', emails)
          .select('email', 'name')
      }

      transports = transports.map(transport => {
        const user = users.find(u => u.email === transport.requester_email)
        
        return {
          ...transport,
          requester_name: user ? user.name : null
        }
      })

      if (sortBy === 'rated_at') {
        transports.sort((a, b) => {
          if (a.rated_at && b.rated_at) {
            return new Date(b.rated_at) - new Date(a.rated_at)
          }
          if (a.rated_at) return -1
          if (b.rated_at) return 1
          return new Date(b.delivery_date || 0) - new Date(a.delivery_date || 0)
        })
      }

    } else if (type === 'spedycyjny') {
      let query = db('spedycje').where('status', 'completed')

      if (dateBasis === 'rated_at') {
        const ratedIds = await db('spedition_detailed_ratings')
          .where('rated_at', '>=', `${startDate} 00:00:00`)
          .where('rated_at', '<=', `${endDate} 23:59:59`)
          .distinct('spedition_id')
          .pluck('spedition_id')

        query = query.whereIn('id', ratedIds.length > 0 ? ratedIds : [-1])
      } else {
        query = query.whereBetween('delivery_date', [startDate, endDate])
      }

      transports = await query
        .orderBy('delivery_date', 'desc')
        .select('*')

      const transportIds = transports.map(t => t.id)
      
      if (transportIds.length > 0) {
        try {
          const allRatings = await db('spedition_detailed_ratings')
            .whereIn('spedition_id', transportIds)
            .select('*')

          const ratingsByTransport = {}
          allRatings.forEach(rating => {
            if (!ratingsByTransport[rating.spedition_id]) {
              ratingsByTransport[rating.spedition_id] = []
            }
            ratingsByTransport[rating.spedition_id].push(rating)
          })

          const percentagesByTransport = {}
          const latestRatingByTransport = {}

          Object.keys(ratingsByTransport).forEach(transportId => {
            const ratings = ratingsByTransport[transportId]
            const sortedRatings = [...ratings].sort((a, b) => new Date(b.rated_at || 0) - new Date(a.rated_at || 0))
            latestRatingByTransport[transportId] = sortedRatings[0] || null

            let totalCriteria = 0
            let positiveCriteria = 0
            
            ratings.forEach(rating => {
              // START POPRAWKI 2 (Transport Spedycyjny)
              if (rating.other_problem === true) {
                totalCriteria += 8; // 8 kryteriów dla spedycji
                positiveCriteria += 0;
                return; // Pomiń sprawdzanie kryteriów
              }
              // KONIEC POPRAWKI 2

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
                  if (criterion === true || criterion === 1) positiveCriteria++
                }
              })
            })
            
            percentagesByTransport[transportId] = totalCriteria > 0 
              ? Math.round((positiveCriteria / totalCriteria) * 100) 
              : null
          })

          transports = transports.map(transport => {
            const latest = latestRatingByTransport[transport.id]
            return {
              ...transport,
              has_rating: !!ratingsByTransport[transport.id],
              rating_percentage: percentagesByTransport[transport.id] === null ? null : percentagesByTransport[transport.id],
              rated_at: latest?.rated_at ? new Date(latest.rated_at).toISOString() : null,
              rater_name: latest?.rater_name || null,
              rating_comment: latest?.comment || null
            }
          })
        } catch (error) {
          console.log('Tabela spedition_detailed_ratings nie istnieje:', error.message)
          transports = transports.map(transport => ({
            ...transport,
            has_rating: false,
            rating_percentage: null,
            rated_at: null,
            rater_name: null,
            rating_comment: null
          }))
        }
      } else {
        transports = transports.map(transport => ({
          ...transport,
          has_rating: false,
          rating_percentage: null,
          rated_at: null,
          rater_name: null,
          rating_comment: null
        }))
      }

      // Pobierz nazwy użytkowników
      const emails = [...new Set(transports.map(t => t.responsible_email).filter(Boolean))]
      let users = []
      if (emails.length > 0) {
        users = await db('users')
          .whereIn('email', emails)
          .select('email', 'name')
      }

      transports = transports.map(transport => {
        const user = users.find(u => u.email === transport.responsible_email)
        
        // Parsuj dane JSON
        let response = null
        if (transport.response_data) {
          try {
            response = JSON.parse(transport.response_data)
          } catch (e) {
            console.error('Błąd parsowania response_data:', e)
          }
        }

        let delivery = null
        if (transport.delivery_data) {
          try {
            delivery = JSON.parse(transport.delivery_data)
          } catch (e) {
            console.error('Błąd parsowania delivery_data:', e)
          }
        }

        let producerAddress = null
        if (transport.location_data) {
          try {
            producerAddress = JSON.parse(transport.location_data)
          } catch (e) {
            console.error('Błąd parsowania location_data:', e)
          }
        }

        // Parsuj goods_description
        let goodsDescription = null
        if (transport.goods_description) {
          try {
            goodsDescription = typeof transport.goods_description === 'string'
              ? JSON.parse(transport.goods_description)
              : transport.goods_description
          } catch (e) {
            console.error('Błąd parsowania goods_description:', e)
            goodsDescription = transport.goods_description
          }
        }
        
        return {
          ...transport,
          responsible_name: user ? user.name : null,
          response,
          delivery,
          producerAddress,
          goods_description: goodsDescription
        }
      })

      if (sortBy === 'rated_at') {
        transports.sort((a, b) => {
          if (a.rated_at && b.rated_at) {
            return new Date(b.rated_at) - new Date(a.rated_at)
          }
          if (a.rated_at) return -1
          if (b.rated_at) return 1
          return new Date(b.delivery_date || 0) - new Date(a.delivery_date || 0)
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      transports 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Błąd API oceny-transportow:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  }
}