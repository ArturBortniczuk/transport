// src/app/api/kurier/test/route.js
// 🧪 TEST ENDPOINT - Do testowania nowego API kuriera

import { NextResponse } from 'next/server'

// Testowe dane formularza
const testFormData = {
  typZlecenia: 'nadawca_bialystok',
  
  // Dane nadawcy
  nadawcaNazwa: 'GRUPA ELTRON SP. Z O.O.',
  nadawcaTyp: 'firma',
  nadawcaUlica: 'WYSOKIEGO',
  nadawcaNumerDomu: '69B',
  nadawcaNumerLokalu: '',
  nadawcaKodPocztowy: '15-169',
  nadawcaMiasto: 'BIAŁYSTOK',
  nadawcaKraj: 'PL',
  nadawcaOsobaKontaktowa: 'ARTUR BORTNICZUK',
  nadawcaTelefon: '781710043',
  nadawcaEmail: 'a.bortniczuk@grupaeltroni.pl',
  
  // Dane odbiorcy
  odbiorcaNazwa: 'Test Klient',
  odbiorcaTyp: 'firma',
  odbiorcaUlica: 'Testowa',
  odbiorcaNumerDomu: '123',
  odbiorcaNumerLokalu: '4',
  odbiorcaKodPocztowy: '00-001',
  odbiorcaMiasto: 'Warszawa',
  odbiorcaKraj: 'PL',
  odbiorcaOsobaKontaktowa: 'Jan Kowalski',
  odbiorcaTelefon: '123456789',
  odbiorcaEmail: 'test@example.com',
  
  // Szczegóły przesyłki
  zawartoscPrzesylki: 'Dokumenty testowe',
  MPK: 'TEST-001',
  uwagi: 'To jest testowe zamówienie',
  
  // Paczki
  paczki: [
    {
      id: 1,
      typ: 'PACKAGE',
      waga: '2.5',
      dlugosc: '30',
      szerokosc: '20',
      wysokosc: '15',
      ilosc: 1,
      niestandardowa: false
    }
  ],
  
  // Usługa DHL
  uslugaDHL: 'AH',
  
  // Usługi dodatkowe
  uslugiDodatkowe: {
    ubezpieczenie: false,
    wartoscUbezpieczenia: '',
    pobranie: false,
    wartoscPobrania: '',
    doreczenieSobota: false,
    doreczenieWieczorne: false
  },
  
  // Dane międzynarodowe
  daneMiedzynarodowe: {
    typOdprawy: 'U',
    wartoscTowarow: '',
    opisSzczegolowy: '',
    wagaBrutto: '',
    krajPochodzenia: 'PL'
  }
}

// GET - Sprawdź status API
export async function GET() {
  try {
    const { default: db } = await import('@/database/db')
    
    // Sprawdź połączenie z bazą
    const dbTest = await db.raw('SELECT NOW() as current_time')
    
    // Sprawdź tabelę kuriers
    const tableExists = await db.schema.hasTable('kuriers')
    
    let columns = []
    if (tableExists) {
      const columnsResult = await db.raw(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'kuriers' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `)
      columns = columnsResult.rows
    }
    
    // Sprawdź liczbę zamówień
    const orderCount = tableExists ? 
      await db('kuriers').count('* as count').first() : 
      { count: 0 }

    return NextResponse.json({
      success: true,
      status: 'API kuriera działa poprawnie',
      checks: {
        database: {
          connected: true,
          currentTime: dbTest.rows[0].current_time
        },
        kuriersTable: {
          exists: tableExists,
          columns: columns.length,
          orderCount: parseInt(orderCount.count),
          sampleColumns: columns.slice(0, 10)
        }
      },
      testData: {
        available: true,
        description: 'Użyj POST /api/kurier/test aby przetestować tworzenie zamówienia'
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Błąd testu API: ' + error.message,
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 })
  }
}

// POST - Przetestuj tworzenie zamówienia
export async function POST(request) {
  try {
    console.log('🧪 Test tworzenia zamówienia kuriera...')
    
    // Użyj testowych danych lub danych z request
    let testData = testFormData
    
    try {
      const requestData = await request.json()
      if (requestData && Object.keys(requestData).length > 0) {
        testData = { ...testFormData, ...requestData }
        console.log('📝 Użyto danych z request')
      }
    } catch (e) {
      console.log('📋 Użyto domyślnych danych testowych')
    }

    // Wywołaj endpoint tworzenia zamówienia
    const apiUrl = new URL('/api/kurier', request.url)
    
    const response = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || ''
      },
      body: JSON.stringify(testData)
    })

    const result = await response.json()

    return NextResponse.json({
      success: true,
      testResult: {
        status: response.status,
        response: result
      },
      testData: testData,
      notes: {
        message: 'Test zakończony',
        nextSteps: result.success ? [
          'Zamówienie zostało utworzone',
          `ID zamówienia: ${result.zamowienie?.id}`,
          'Sprawdź w bazie danych czy dane zostały zapisane poprawnie'
        ] : [
          'Wystąpił błąd podczas tworzenia zamówienia',
          'Sprawdź logi serwera',
          'Zweryfikuj strukturę bazy danych'
        ]
      }
    })

  } catch (error) {
    console.error('❌ Błąd testu tworzenia zamówienia:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Błąd testu: ' + error.message,
      testData: testFormData,
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 })
  }
}
