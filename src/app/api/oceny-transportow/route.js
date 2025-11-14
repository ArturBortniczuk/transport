// src/app/api/oceny-transportow/route.js - API DO POBIERANIA TRANSPORTÓW DO OCENY (POPRAWIONE)
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

export async function GET(request) {
  try {
    // Sprawdź uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    // Pobierz parametry
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'wlasny' lub 'spedycyjny'
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
      // Pobierz transporty własne
      transports = await db('transports')
        .where('status', 'completed')
        .whereBetween('delivery_date', [startDate, endDate])
        .orderBy('delivery_date', 'desc')
        .select('*')

      // Sprawdź które transporty mają ocenę
      const transportIds = transports.map(t => t.id)
      
      if (transportIds.length > 0) {
        const ratings = await db('transport_detailed_ratings')
          .whereIn('transport_id', transportIds)
          .select('transport_id')
          .groupBy('transport_id')

        const ratedTransportIds = new Set(ratings.map(r => r.transport_id))

        // Dodaj flagę has_rating do każdego transportu
        transports = transports.map(transport => ({
          ...transport,
          has_rating: ratedTransportIds.has(transport.id)
        }))
      } else {
        transports = transports.map(transport => ({
          ...transport,
          has_rating: false
        }))
      }

      // Pobierz nazwy użytkowników (osób odpowiedzialnych)
      const emails = [...new Set(transports.map(t => t.requester_email).filter(Boolean))]
      let users = []
      if (emails.length > 0) {
        users = await db('users')
          .whereIn('email', emails)
          .select('email', 'name')
      }

      // Dodaj nazwy użytkowników do transportów (NIE pobieramy kierowców z bazy!)
      transports = transports.map(transport => {
        const user = users.find(u => u.email === transport.requester_email)
        
        return {
          ...transport,
          requester_name: user ? user.name : null
          // driver_id pozostaje jako ID - mapowanie na nazwę będzie w komponencie
        }
      })

    } else if (type === 'spedycyjny') {
      // Pobierz transporty spedycyjne (POPRAWIONA NAZWA TABELI: spedycje)
      transports = await db('spedycje')
        .where('status', 'completed')
        .whereBetween('delivery_date', [startDate, endDate]) // UŻYWAMY delivery_date zamiast created_at
        .orderBy('delivery_date', 'desc')
        .select('*')

      // Sprawdź które transporty mają ocenę
      const transportIds = transports.map(t => t.id)
      
      if (transportIds.length > 0) {
        // Sprawdź w tabeli spedition_ratings (jeśli istnieje)
        try {
          const ratings = await db('spedition_detailed_ratings')
            .whereIn('spedition_id', transportIds)
            .select('spedition_id')
            .groupBy('spedition_id')

          const ratedTransportIds = new Set(ratings.map(r => r.spedition_id))

          transports = transports.map(transport => ({
            ...transport,
            has_rating: ratedTransportIds.has(transport.id)
          }))
        } catch (error) {
          // Tabela nie istnieje - oznacz wszystkie jako nieocenione
          console.log('Tabela spedition_detailed_ratings nie istnieje:', error.message)
          transports = transports.map(transport => ({
            ...transport,
            has_rating: false
          }))
        }
      } else {
        transports = transports.map(transport => ({
          ...transport,
          has_rating: false
        }))
      }

      // Pobierz nazwy użytkowników (osób odpowiedzialnych)
      const emails = [...new Set(transports.map(t => t.responsible_email).filter(Boolean))]
      let users = []
      if (emails.length > 0) {
        users = await db('users')
          .whereIn('email', emails)
          .select('email', 'name')
      }

      // Dodaj nazwy do transportów
      transports = transports.map(transport => {
        const user = users.find(u => u.email === transport.responsible_email)
        
        // Parsuj response_data jeśli istnieje
        let response = null
        if (transport.response_data) {
          try {
            response = JSON.parse(transport.response_data)
          } catch (e) {
            console.error('Błąd parsowania response_data:', e)
          }
        }

        // Parsuj delivery_data
        let delivery = null
        if (transport.delivery_data) {
          try {
            delivery = JSON.parse(transport.delivery_data)
          } catch (e) {
            console.error('Błąd parsowania delivery_data:', e)
          }
        }

        // Parsuj location_data
        let producerAddress = null
        if (transport.location_data) {
          try {
            producerAddress = JSON.parse(transport.location_data)
          } catch (e) {
            console.error('Błąd parsowania location_data:', e)
          }
        }
        
        return {
          ...transport,
          requester_name: user ? user.name : null,
          requester_email: transport.responsible_email,
          response,
          delivery,
          producerAddress
        }
      })
    }

    return NextResponse.json({ 
      success: true, 
      transports 
    })

  } catch (error) {
    console.error('Błąd API oceny-transportow:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 })
  }
}