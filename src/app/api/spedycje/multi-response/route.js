// src/app/api/spedycje/multi-response/route.js
import { NextResponse } from 'next/server'
import db from '@/database/db'

export async function POST(request) {
  try {
    const requestData = await request.json()
    console.log('=== MULTI-RESPONSE API START ===')
    console.log('Otrzymane dane:', JSON.stringify(requestData, null, 2))

    const {
      transportIds,
      routeSequence,
      driverInfo,
      totalPrice,
      priceBreakdown,
      transportDate,
      notes,
      cargoDescription,
      totalWeight,
      totalDistance,
      isMerged,
      goodsPrice,
      // NOWE POLA
      vehicleType,
      transportType
    } = requestData

    // Walidacja danych
    if (!transportIds || !Array.isArray(transportIds) || transportIds.length === 0) {
      console.log('❌ Błąd: Nie wybrano transportów')
      return NextResponse.json({
        success: false,
        error: 'Nie wybrano żadnych transportów'
      }, { status: 400 })
    }

    if (!driverInfo?.name || !driverInfo?.phone || !totalPrice || !transportDate) {
      console.log('❌ Błąd: Brak wymaganych pól:', { 
        driverName: driverInfo?.name, 
        driverPhone: driverInfo?.phone, 
        totalPrice, 
        transportDate 
      })
      return NextResponse.json({
        success: false,
        error: 'Wymagane pola nie zostały wypełnione'
      }, { status: 400 })
    }

    // Walidacja nowych pól
    if (!vehicleType) {
      console.log('❌ Błąd: Brak rodzaju pojazdu')
      return NextResponse.json({
        success: false,
        error: 'Rodzaj pojazdu jest wymagany'
      }, { status: 400 })
    }

    if (!transportType) {
      console.log('❌ Błąd: Brak rodzaju transportu')
      return NextResponse.json({
        success: false,
        error: 'Rodzaj transportu jest wymagany'
      }, { status: 400 })
    }

    // Sprawdź wszystkie transporty w bazie (bez filtra statusu)
    console.log('🔍 Sprawdzanie transportów o ID:', transportIds)
    const allTransports = await db('spedycje')
      .whereIn('id', transportIds)
      .select('id', 'status', 'order_number', 'mpk', 'delivery_date')

    console.log('📋 Znalezione transporty:', allTransports)

    if (allTransports.length !== transportIds.length) {
      const foundIds = allTransports.map(t => t.id)
      const missingIds = transportIds.filter(id => !foundIds.includes(parseInt(id)))
      
      console.log('❌ Brakujące transporty:', missingIds)
      return NextResponse.json({
        success: false,
        error: `Transporty o ID: ${missingIds.join(', ')} nie istnieją w bazie danych`
      }, { status: 400 })
    }

    // Sprawdź czy transporty mają odpowiedni status
    const newTransports = allTransports.filter(t => t.status === 'new')
    if (newTransports.length !== transportIds.length) {
      const nonNewTransports = allTransports.filter(t => t.status !== 'new')
      console.log('⚠️ Transporty z niewłaściwym statusem:', nonNewTransports)
      
      return NextResponse.json({
        success: false,
        error: `Niektóre transporty zostały już przetworzone.
Transporty o ID: ${nonNewTransports.map(t => `${t.id} (status: ${t.status})`).join(', ')}`
      }, { status: 400 })
    }

    const currentTime = new Date().toISOString()
    console.log('✅ Wszystkie transporty są dostępne, zapisuję odpowiedź...')

    // Jeśli jest to odpowiedź na jeden transport
    if (transportIds.length === 1) {
      const transportId = transportIds[0]
      const transport = allTransports[0]
      
      console.log('📝 Zapisuję odpowiedź dla pojedynczego transportu:', transportId)
      
      // Przygotuj dane odpowiedzi
      const responseData = {
        driverName: driverInfo.name,
        driverPhone: driverInfo.phone,
        vehicleNumber: driverInfo.vehicleNumber || null,
        deliveryPrice: parseFloat(totalPrice),
        goodsPrice: goodsPrice ? parseFloat(goodsPrice) : null,
        distance: totalDistance || null,
        notes: notes || null,
        cargoDescription: cargoDescription || null,
        totalWeight: totalWeight || null,
        newDeliveryDate: transportDate !== transport.delivery_date ? transportDate : null,
        dateChanged: transportDate !== transport.delivery_date,
        isMerged: false,
        // NOWE POLA
        vehicleType: vehicleType,
        transportType: transportType,
        routeSequence: routeSequence || []
      }

      // Zaktualizuj transport w bazie
      const updateResult = await db('spedycje')
        .where('id', transportId)
        .update({
          status: 'responded',
          response_data: JSON.stringify(responseData),
          responded_at: currentTime,
          updated_at: currentTime
        })

      console.log('✅ Transport zaktualizowany:', updateResult)

      return NextResponse.json({
        success: true,
        message: 'Odpowiedź została zapisana',
        transportId: transportId
      })
    }

    // OBSŁUGA WIELU TRANSPORTÓW (MERGER)
    console.log('🔄 Przetwarzanie połączonych transportów...')
    
    // Użyj transakcji do zapewnienia spójności danych
    await db.transaction(async (trx) => {
      const mainTransportId = transportIds[0] // Pierwszy transport jako główny
      const mainTransport = allTransports.find(t => t.id === parseInt(mainTransportId))
      
      console.log('🎯 Główny transport:', mainTransportId)

      // Oblicz cenę dla głównego transportu
      const mainTransportPrice = priceBreakdown ? 
        parseFloat(priceBreakdown[mainTransportId] || 0) :
        parseFloat(totalPrice) / transportIds.length
        
      console.log(`💰 Główny transport ${mainTransportId}: przydzielona cena ${mainTransportPrice} PLN`)

      // Przygotuj dane odpowiedzi dla głównego transportu
      const mainResponseData = {
        driverName: driverInfo.name,
        driverPhone: driverInfo.phone,
        vehicleNumber: driverInfo.vehicleNumber || null,
        deliveryPrice: parseFloat(mainTransportPrice.toFixed(2)), // Użyj przydzielonej ceny, nie całkowitej
        totalDeliveryPrice: parseFloat(totalPrice), // Zachowaj całkowitą cenę jako dodatkowe pole
        goodsPrice: goodsPrice ? parseFloat(goodsPrice) : null,
        distance: totalDistance || null,
        notes: notes || null,
        cargoDescription: cargoDescription || null,
        totalWeight: totalWeight || null,
        newDeliveryDate: transportDate !== mainTransport.delivery_date ? transportDate : null,
        dateChanged: transportDate !== mainTransport.delivery_date,
        isMerged: true,
        isMainMerged: true,
        mergedTransportIds: transportIds,
        costBreakdown: priceBreakdown || {},
        routeSequence: routeSequence || [],
        // NOWE POLA
        vehicleType: vehicleType,
        transportType: transportType
      }

      // Zaktualizuj główny transport
      const mainUpdateResult = await trx('spedycje')
        .where('id', mainTransportId)
        .update({
          status: 'responded',
          response_data: JSON.stringify(mainResponseData),
          merged_transports: JSON.stringify({
            isMain: true,
            mergedTransportIds: transportIds,
            mergedAt: currentTime
          }),
          responded_at: currentTime,
          updated_at: currentTime
        })

      console.log('✅ Główny transport zaktualizowany:', mainUpdateResult)

      // Zaktualizuj pozostałe transporty jako drugorzędne
      const secondaryTransportIds = transportIds.slice(1)
      
      await Promise.all(secondaryTransportIds.map(async (transportId) => {
        const transport = allTransports.find(t => t.id === parseInt(transportId))
        const transportPrice = priceBreakdown ? 
          parseFloat(priceBreakdown[transportId] || 0) : 
          parseFloat(totalPrice) / transportIds.length // Równomierne rozłożenie jeśli brak podziału
          
        console.log(`💰 Transport ${transportId}: przydzielona cena ${transportPrice} PLN`)
          
        const otherResponseData = {
          driverName: driverInfo.name,
          driverPhone: driverInfo.phone,
          vehicleNumber: driverInfo.vehicleNumber || null,
          deliveryPrice: parseFloat(transportPrice.toFixed(2)), // Zaokrągl do 2 miejsc po przecinku
          goodsPrice: goodsPrice ? parseFloat(goodsPrice) : null,
          distance: null,
          notes: `Transport połączony z #${mainTransportId}. ${notes || ''}`.trim(),
          cargoDescription: cargoDescription || null,
          totalWeight: null,
          newDeliveryDate: transportDate,
          dateChanged: true,
          isMerged: true,
          isSecondaryMerged: true,
          mainTransportId: mainTransportId,
          costBreakdown: priceBreakdown || {},
          routeSequence: routeSequence || [],
          // NOWE POLA - kopiujemy z głównego transportu
          vehicleType: vehicleType,
          transportType: transportType
        }

        const otherUpdateResult = await trx('spedycje')
          .where('id', transportId)
          .update({
            status: 'responded',
            response_data: JSON.stringify(otherResponseData),
            merged_transports: JSON.stringify({
              isSecondary: true,
              mainTransportId: mainTransportId,
              mergedAt: currentTime
            }),
            responded_at: currentTime,
            updated_at: currentTime
          })

        console.log(`✅ Transport ${transportId} zaktualizowany:`, otherUpdateResult)
      }))

      console.log('✅ Transakcja zakończona pomyślnie')
    })

    return NextResponse.json({
      success: true,
      message: `Odpowiedź została zapisana dla ${transportIds.length} połączonych transportów`,
      mainTransportId: transportIds[0],
      mergedCount: transportIds.length
    })

  } catch (error) {
    console.error('❌ Błąd zapisywania odpowiedzi zbiorczej:', error)
    console.error('Stack trace:', error.stack)
    
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
