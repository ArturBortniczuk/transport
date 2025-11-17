import { NextResponse } from 'next/server'
import db from '@/database/db'

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

export async function GET(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak wymaganych parametrów' 
      }, { status: 400 })
    }

    let transports = []

    if (type === 'wlasny') {
      transports = await db('transports')
        .where('status', 'completed')
        .whereBetween('delivery_date', [startDate, endDate])
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
        Object.keys(ratingsByTransport).forEach(transportId => {
          const ratings = ratingsByTransport[transportId]
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

        transports = transports.map(transport => ({
          ...transport,
          has_rating: !!ratingsByTransport[transport.id],
          rating_percentage: percentagesByTransport[transport.id] === null ? null : percentagesByTransport[transport.id]
        }))
      } else {
        transports = transports.map(transport => ({
          ...transport,
          has_rating: false,
          rating_percentage: null
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

    } else if (type === 'spedycyjny') {
      transports = await db('spedycje')
        .where('status', 'completed')
        .whereBetween('delivery_date', [startDate, endDate])
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
          Object.keys(ratingsByTransport).forEach(transportId => {
            const ratings = ratingsByTransport[transportId]
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

          transports = transports.map(transport => ({
            ...transport,
            has_rating: !!ratingsByTransport[transport.id],
            rating_percentage: percentagesByTransport[transport.id] === null ? null : percentagesByTransport[transport.id]
          }))
        } catch (error) {
          console.log('Tabela spedition_detailed_ratings nie istnieje:', error.message)
          transports = transports.map(transport => ({
            ...transport,
            has_rating: false,
            rating_percentage: null
          }))
        }
      } else {
        transports = transports.map(transport => ({
          ...transport,
          has_rating: false,
          rating_percentage: null
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