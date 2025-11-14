// src/app/api/kurier/route.js
import { NextResponse } from 'next/server'

// Funkcja pomocnicza do walidacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null
  }
  
  const { default: db } = await import('@/database/db')
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first()
  
  return session?.user_id
}

// GET - Pobierz listę zamówień kurierskich
export async function GET(request) {
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

    const { default: db } = await import('@/database/db')
    
    // Pobierz filtry z URL
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit')) || 50
    const offset = parseInt(searchParams.get('offset')) || 0

    // Buduj zapytanie
    let query = db('kuriers').orderBy('created_at', 'desc')
    
    if (status && status !== 'all') {
      query = query.where('status', status)
    }

    // Pobierz dane z limitem
    const zamowienia = await query.limit(limit).offset(offset)
    
    // Policz całkowitą liczbę
    const [{ count }] = await db('kuriers')
      .count('* as count')
      .modify(queryBuilder => {
        if (status && status !== 'all') {
          queryBuilder.where('status', status)
        }
      })

    console.log(`✅ Pobrano ${zamowienia.length} zamówień kurierskich`)

    return NextResponse.json({ 
      success: true, 
      zamowienia,
      totalCount: parseInt(count)
    })

  } catch (error) {
    console.error('❌ Error w Kurier API GET:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd podczas pobierania zamówień: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    }, { status: 500 })
  }
}

// POST - Utwórz nowe zamówienie kurierskie
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

    const { default: db } = await import('@/database/db')

    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('name', 'role', 'email')
      .first()

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Użytkownik nie znaleziony' 
      }, { status: 404 })
    }

    const formData = await request.json()
    console.log('📦 Tworzenie nowego zamówienia kurierskiego:', formData)

    // MAPOWANIE DANYCH Z FORMULARZA NA FORMAT API
    
    // Określ źródło magazynu na podstawie typu zlecenia
    let magazineSource = 'other'
    if (formData.typZlecenia === 'nadawca_bialystok' || formData.typZlecenia === 'odbiorca_bialystok') {
      magazineSource = 'bialystok'
    } else if (formData.typZlecenia === 'nadawca_zielonka' || formData.typZlecenia === 'odbiorca_zielonka') {
      magazineSource = 'zielonka'
    } else if (formData.typZlecenia === 'trzecia_strona') {
      magazineSource = 'third_party'
    }

    // Walidacja podstawowych danych
    if (!formData.odbiorcaNazwa || !formData.odbiorcaMiasto || !formData.odbiorcaKodPocztowy) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakuje danych odbiorcy' 
      }, { status: 400 })
    }

    if (!formData.nadawcaNazwa || !formData.nadawcaMiasto || !formData.nadawcaKodPocztowy) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakuje danych nadawcy' 
      }, { status: 400 })
    }

    if (!formData.paczki || formData.paczki.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakuje informacji o paczkach' 
      }, { status: 400 })
    }

    // Sprawdź logikę niestandardowych wymiarów
    const checkNonStandardDimensions = (paczka) => {
      const length = parseInt(paczka.dlugosc) || 0
      const width = parseInt(paczka.szerokosc) || 0
      
      // Automatycznie ustaw niestandardowa=true jeśli wymiary > 120x80 lub 80x120
      return (length > 120 && width > 80) || (length > 80 && width > 120)
    }

    // Przygotuj dane paczek z automatyczną detekcją niestandardowych wymiarów
    const processedPaczki = formData.paczki.map(paczka => ({
      ...paczka,
      niestandardowa: checkNonStandardDimensions(paczka) || paczka.niestandardowa
    }))

    // Przygotuj dane do zapisu w formacie zgodnym z bazą danych
    const zamowienieData = {
      // Podstawowe dane
      magazine_source: magazineSource,
      order_type: formData.typZlecenia,
      
      // Dane nadawcy
      sender_name: formData.nadawcaNazwa,
      sender_company: formData.nadawcaTyp === 'firma' ? formData.nadawcaNazwa : null,
      sender_street: formData.nadawcaUlica,
      sender_house_number: formData.nadawcaNumerDomu,
      sender_apartment_number: formData.nadawcaNumerLokalu || null,
      sender_city: formData.nadawcaMiasto,
      sender_postcode: formData.nadawcaKodPocztowy,
      sender_country: formData.nadawcaKraj || 'PL',
      sender_phone: formData.nadawcaTelefon,
      sender_email: formData.nadawcaEmail || null,
      sender_contact_person: formData.nadawcaOsobaKontaktowa || null,
      
      // Dane odbiorcy
      recipient_name: formData.odbiorcaNazwa,
      recipient_company: formData.odbiorcaTyp === 'firma' ? formData.odbiorcaNazwa : null,
      recipient_street: formData.odbiorcaUlica,
      recipient_house_number: formData.odbiorcaNumerDomu,
      recipient_apartment_number: formData.odbiorcaNumerLokalu || null,
      recipient_city: formData.odbiorcaMiasto,
      recipient_postcode: formData.odbiorcaKodPocztowy,
      recipient_country: formData.odbiorcaKraj || 'PL',
      recipient_phone: formData.odbiorcaTelefon,
      recipient_email: formData.odbiorcaEmail || null,
      recipient_contact_person: formData.odbiorcaOsobaKontaktowa || null,
      
      // Szczegóły przesyłki
      package_contents: formData.zawartoscPrzesylki,
      mpk: formData.MPK || null,
      notes_general: formData.uwagi || null,
      
      // Dane pierwszej paczki (główne)
      package_weight: parseFloat(processedPaczki[0]?.waga) || null,
      package_length: parseFloat(processedPaczki[0]?.dlugosc) || null,
      package_width: parseFloat(processedPaczki[0]?.szerokosc) || null,
      package_height: parseFloat(processedPaczki[0]?.wysokosc) || null,
      package_type: processedPaczki[0]?.typ || 'PACKAGE',
      package_quantity: parseInt(processedPaczki[0]?.ilosc) || 1,
      package_non_standard: processedPaczki[0]?.niestandardowa || false,
      
      // Usługa DHL
      service_type: formData.uslugaDHL || 'AH',
      
      // Usługi dodatkowe
      insurance_requested: formData.uslugiDodatkowe?.ubezpieczenie || false,
      insurance_amount: formData.uslugiDodatkowe?.ubezpieczenie ? 
        parseFloat(formData.uslugiDodatkowe.wartoscUbezpieczenia) || null : null,
      cod_requested: formData.uslugiDodatkowe?.pobranie || false,
      cod_amount: formData.uslugiDodatkowe?.pobranie ? 
        parseFloat(formData.uslugiDodatkowe.wartoscPobrania) || null : null,
      saturday_delivery: formData.uslugiDodatkowe?.doreczenieSobota || false,
      evening_delivery: formData.uslugiDodatkowe?.doreczenieWieczorne || false,
      
      // Dane międzynarodowe (jeśli applicable)
      is_international: formData.nadawcaKraj !== formData.odbiorcaKraj,
      customs_type: formData.daneMiedzynarodowe?.typOdprawy || null,
      customs_value: formData.daneMiedzynarodowe?.wartoscTowarow ? 
        parseFloat(formData.daneMiedzynarodowe.wartoscTowarow) : null,
      
      // Dane kalkulacji cen (jeśli dostępne)
      estimated_cost: formData.pricing?.totalPrice ? 
        parseFloat(formData.pricing.totalPrice) : null,
      pricing_data: formData.pricing ? JSON.stringify(formData.pricing) : null,
      
      // Wszystkie paczki jako JSON (dla przyszłego użycia)
      packages_details: JSON.stringify(processedPaczki),
      
      // Informacje o usługach pocztowych
      postal_services_data: formData.postalServices ? 
        JSON.stringify(formData.postalServices) : null,
      
      // Metadane
      status: 'new',
      created_by_email: user.email,
      created_by_name: user.name,
      created_at: new Date(),
      updated_at: new Date()
    }

    // Zapisz do bazy danych
    const [newZamowienie] = await db('kuriers')
      .insert(zamowienieData)
      .returning('*')

    console.log('✅ Utworzono nowe zamówienie kurierskie:', {
      id: newZamowienie.id,
      type: zamowienieData.order_type,
      source: zamowienieData.magazine_source,
      recipient: zamowienieData.recipient_name,
      packages: processedPaczki.length,
      nonStandard: processedPaczki.some(p => p.niestandardowa)
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Zamówienie kurierskie zostało utworzone pomyślnie',
      zamowienie: newZamowienie,
      details: {
        orderId: newZamowienie.id,
        packageCount: processedPaczki.length,
        hasNonStandardPackages: processedPaczki.some(p => p.niestandardowa),
        estimatedCost: zamowienieData.estimated_cost
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Error w Kurier API POST:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd podczas tworzenia zamówienia: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        receivedData: error.receivedData
      } : undefined
    }, { status: 500 })
  }
}
