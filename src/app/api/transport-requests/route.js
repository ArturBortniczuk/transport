// src/app/api/transport-requests/route.js - KOMPLETNY NAPRAWIONY KOD
import { NextResponse } from 'next/server';
import db from '@/database/db';

const getMarketName = (marketId) => {
  const markets = {
    1: 'Podlaski',
    2: 'Mazowiecki', 
    3: 'Małopolski',
    4: 'Wielkopolski',
    5: 'Dolnośląski',
    6: 'Śląski',
    7: 'Lubelski',
    8: 'Pomorski'
  };
  return markets[marketId] || null;
};

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken || !db) {
    return null;
  }
  
  try {
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first();
    
    return session?.user_id;
  } catch (error) {
    console.error('Błąd walidacji sesji:', error);
    return null;
  }
};

// Funkcja do tworzenia tabeli transport_requests
const ensureTableExists = async () => {
  try {
    const tableExists = await db.schema.hasTable('transport_requests');
    if (!tableExists) {
      console.log('Tworzenie tabeli transport_requests...');
      
      await db.schema.createTable('transport_requests', table => {
        table.increments('id').primary();
        table.string('status').defaultTo('pending');
        table.string('requester_email').notNullable();
        table.string('requester_name').notNullable();
        table.string('destination_city').notNullable();
        table.string('postal_code');
        table.string('street');
        table.date('delivery_date').notNullable();
        table.string('mpk');
        table.string('construction_name');
        table.integer('construction_id');
        table.text('justification');
        table.string('client_name');
        table.string('real_client_name');      // ← NOWE POLE
        table.string('wz_numbers');            // ← NOWE POLE  
        table.integer('market_id');            // ← NOWE POLE
        table.string('contact_person');
        table.string('contact_phone');
        table.text('notes');
        table.string('approved_by');
        table.timestamp('approved_at');
        table.string('rejection_reason');
        table.integer('transport_id');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      
      console.log('Tabela transport_requests została utworzona');
    } else {
      // ISTNIEJĄCE SPRAWDZENIA
      const hasConstructionName = await db.schema.hasColumn('transport_requests', 'construction_name');
      if (!hasConstructionName) {
        await db.schema.table('transport_requests', table => {
          table.string('construction_name');
        });
        console.log('Dodano kolumnę construction_name');
      }

      const hasConstructionId = await db.schema.hasColumn('transport_requests', 'construction_id');
      if (!hasConstructionId) {
        await db.schema.table('transport_requests', table => {
          table.integer('construction_id');
        });
        console.log('Dodano kolumnę construction_id');
      }

      // ===== NOWE SPRAWDZENIA =====
      const hasRealClientName = await db.schema.hasColumn('transport_requests', 'real_client_name');
      if (!hasRealClientName) {
        await db.schema.table('transport_requests', table => {
          table.string('real_client_name');
        });
        console.log('Dodano kolumnę real_client_name');
      }

      const hasWzNumbers = await db.schema.hasColumn('transport_requests', 'wz_numbers');
      if (!hasWzNumbers) {
        await db.schema.table('transport_requests', table => {
          table.string('wz_numbers');
        });
        console.log('Dodano kolumnę wz_numbers');
      }

      const hasMarketId = await db.schema.hasColumn('transport_requests', 'market_id');
      if (!hasMarketId) {
        await db.schema.table('transport_requests', table => {
          table.integer('market_id');
        });
        console.log('Dodano kolumnę market_id');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Błąd tworzenia tabeli transport_requests:', error);
    return false;
  }
};

// GET - Pobieranie wniosków transportowych
export async function GET(request) {
  try {
    console.log('=== START GET /api/transport-requests ===');
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    console.log('AuthToken:', authToken ? 'Present' : 'Missing');
    
    const userId = await validateSession(authToken);
    console.log('UserId:', userId);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Upewnij się, że tabela istnieje
    const tableReady = await ensureTableExists();
    if (!tableReady) {
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd inicjalizacji tabeli' 
      }, { status: 500 });
    }

    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name', 'permissions')
      .first();

    console.log('User data:', user);

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Parsuj uprawnienia
    let permissions = {};
    try {
      if (user.permissions && typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
      permissions = {};
    }

    const isAdmin = user.role === 'admin';
    const isMagazyn = user.role === 'magazyn' || user.role?.startsWith('magazyn_');
    const canViewAll = isAdmin || isMagazyn || permissions?.transport_requests?.approve === true;

    console.log('User permissions:', { isAdmin, isMagazyn, canViewAll });

    let query = db('transport_requests');

    // Jeśli nie ma uprawnień do przeglądania wszystkich, pokaż tylko własne wnioski
    if (!canViewAll) {
      query = query.where('requester_email', userId);
    }

    // Parametry filtrowania z URL
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Filtruj po statusie
    if (status && status !== 'all') {
      query = query.where('status', status);
    }

    // Filtruj po datach
    if (dateFrom) {
      query = query.where('delivery_date', '>=', dateFrom);
    }
    if (dateTo) {
      query = query.where('delivery_date', '<=', dateTo);
    }

    // Sortuj od najnowszych
    query = query.orderBy('created_at', 'desc');

    const requests = await query;
    console.log('Pobrano wniosków:', requests.length);

    return NextResponse.json({ 
      success: true, 
      requests: requests || [],
      canViewAll,
      userRole: user.role
    });

  } catch (error) {
    console.error('Error in GET /api/transport-requests:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// POST - Dodawanie nowego wniosku transportowego
export async function POST(request) {
  try {
    console.log('=== START POST /api/transport-requests ===');
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Upewnij się, że tabela istnieje
    const tableReady = await ensureTableExists();
    if (!tableReady) {
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd inicjalizacji tabeli' 
      }, { status: 500 });
    }

    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name', 'permissions')
      .first();

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Sprawdź uprawnienia do dodawania wniosków
    let permissions = {};
    try {
      if (user.permissions && typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
      permissions = {};
    }

    const isAdmin = user.role === 'admin';
    const isHandlowiec = user.role === 'handlowiec';
    const canAddRequests = isAdmin || isHandlowiec || permissions?.transport_requests?.add === true;

    console.log('Permission check:', { isAdmin, isHandlowiec, canAddRequests });

    if (!canAddRequests) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do składania wniosków transportowych' 
      }, { status: 403 });
    }

    const requestData = await request.json();
    console.log('🚀 PEŁNE DANE Z FORMULARZA:', JSON.stringify(requestData, null, 2));

    // Walidacja wymaganych pól
    const requiredFields = ['destination_city', 'delivery_date', 'justification'];
    for (const field of requiredFields) {
      if (!requestData[field]) {
        return NextResponse.json({ 
          success: false, 
          error: `Pole ${field} jest wymagane` 
        }, { status: 400 });
      }
    }

    // Walidacja budowy/MPK
    if (!requestData.mpk && !requestData.construction_name) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wybór budowy/MPK jest wymagany' 
      }, { status: 400 });
    }

    // Sprawdź czy data dostawy nie jest w przeszłości
    const deliveryDate = new Date(requestData.delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deliveryDate < today) {
      return NextResponse.json({ 
        success: false, 
        error: 'Data dostawy nie może być w przeszłości' 
      }, { status: 400 });
    }

    // NAPRAWIONE PRZYGOTOWANIE DANYCH - wszystkie pola z formularza
    const newRequest = {
      // Podstawowe pola
      status: 'pending',
      requester_email: userId,
      requester_name: user.name || userId,
      
      // Lokalizacja
      destination_city: requestData.destination_city || '',
      postal_code: requestData.postal_code || null,
      street: requestData.street || null,
      delivery_date: requestData.delivery_date,
      
      // Budowa/MPK
      mpk: requestData.mpk || null,
      construction_name: requestData.construction_name || null,
      construction_id: requestData.construction_id ? parseInt(requestData.construction_id) : null,
      
      // Uzasadnienie i uwagi
      justification: requestData.justification || '',
      notes: requestData.notes || null,
      
      // KLUCZOWE POLA - te które brakowały
      client_name: requestData.client_name || null,                    // Handlowiec/budowa
      real_client_name: requestData.real_client_name || null,          // Rzeczywisty klient  
      wz_numbers: requestData.wz_numbers || null,                      // Numery WZ
      market_id: requestData.market_id ? parseInt(requestData.market_id) : null, // Rynek
      
      // Kontakt
      contact_person: requestData.contact_person || null,
      contact_phone: requestData.contact_phone || null,
      
      // Metadane
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('🚀 DANE DO ZAPISANIA W BAZIE:', JSON.stringify(newRequest, null, 2));

    // Zapisz wniosek do bazy
    const [result] = await db('transport_requests').insert(newRequest).returning('*');
    const insertedRequest = result;

    console.log('🚀 ZAPISANO W BAZIE (pełny rekord):', JSON.stringify(insertedRequest, null, 2));
    console.log(`✅ Utworzono wniosek transportowy ID: ${insertedRequest.id}`);
    console.log(`✅ Z danymi: real_client_name="${insertedRequest.real_client_name}", wz_numbers="${insertedRequest.wz_numbers}", market_id="${insertedRequest.market_id}"`);

    return NextResponse.json({ 
      success: true, 
      message: 'Wniosek transportowy został złożony',
      requestId: insertedRequest.id,
      savedData: {
        real_client_name: insertedRequest.real_client_name,
        wz_numbers: insertedRequest.wz_numbers,
        market_id: insertedRequest.market_id,
        construction_name: insertedRequest.construction_name
      }
    });

  } catch (error) {
    console.error('❌ Error in POST /api/transport-requests:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// PUT - Aktualizacja wniosku (akceptacja/odrzucenie lub edycja)
export async function PUT(request) {
  try {
    console.log('=== START PUT /api/transport-requests ===');
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Upewnij się, że tabela istnieje
    const tableReady = await ensureTableExists();
    if (!tableReady) {
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd inicjalizacji tabeli' 
      }, { status: 500 });
    }

    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name', 'permissions')
      .first();

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    const updateData = await request.json();
    const { requestId, action, ...data } = updateData;
    
    console.log('Update data:', { requestId, action, selectedWarehouse: data.source_warehouse });

    if (!requestId) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID wniosku jest wymagane' 
      }, { status: 400 });
    }

    // Pobierz istniejący wniosek
    const existingRequest = await db('transport_requests')
      .where('id', requestId)
      .first();

    if (!existingRequest) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono wniosku' 
      }, { status: 404 });
    }

    // Parsuj uprawnienia
    let permissions = {};
    try {
      if (user.permissions && typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
      permissions = {};
    }

    const isAdmin = user.role === 'admin';
    const isMagazyn = user.role === 'magazyn' || user.role?.startsWith('magazyn_');
    const canApprove = isAdmin || isMagazyn || permissions?.transport_requests?.approve === true;
    const isOwner = existingRequest.requester_email === userId;

    // Obsługa różnych akcji
    switch (action) {
      case 'approve':
        if (!canApprove) {
          return NextResponse.json({ 
            success: false, 
            error: 'Brak uprawnień do akceptowania wniosków' 
          }, { status: 403 });
        }

        console.log('Rozpoczynam akceptację wniosku:', requestId);

        try {
          // Sprawdź czy tabela transports istnieje
          const transportsTableExists = await db.schema.hasTable('transports');
          if (!transportsTableExists) {
            return NextResponse.json({ 
              success: false, 
              error: 'Tabela transportów nie istnieje' 
            }, { status: 500 });
          }

          // POBIERZ WYBRANY MAGAZYN Z DANYCH ŻĄDANIA (domyślnie białystok)
          const selectedWarehouse = data.source_warehouse || 'bialystok';
          console.log('Wybrany magazyn:', selectedWarehouse);

          // NAPRAWIONA LOGIKA MAPOWANIA DANYCH - z wybranym magazynem
          const transportData = {
            destination_city: existingRequest.destination_city,
            delivery_date: existingRequest.delivery_date,
            status: 'active',
            source_warehouse: selectedWarehouse, // UŻYWAMY WYBRANEGO MAGAZYNU
            postal_code: existingRequest.postal_code || null,
            street: existingRequest.street || null,
            mpk: existingRequest.mpk || null,
            client_name: existingRequest.real_client_name || existingRequest.client_name || null,
            requester_name: existingRequest.client_name || existingRequest.requester_name || null,
            requester_email: existingRequest.requester_email || null,
            wz_number: existingRequest.wz_numbers || null, // WAŻNE: mapowanie wz_numbers → wz_number
            market: getMarketName(existingRequest.market_id) || null,
            notes: `Utworzony z wniosku #${requestId}${existingRequest.construction_name ? ` dla budowy: ${existingRequest.construction_name}` : ''}${existingRequest.notes ? `. ${existingRequest.notes}` : ''}`.trim(),
            loading_level: '100%',
            is_cyclical: false
          };

          console.log('🚀 DEBUGOWANIE: Pełne dane wniosku:', existingRequest);
          console.log('🚀 DEBUGOWANIE: Dane transportu do utworzenia:', transportData);
          console.log('🚀 Magazyn wybrany przez użytkownika:', selectedWarehouse);

          // Rozpocznij transakcję
          const result = await db.transaction(async (trx) => {
            // 1. Akceptuj wniosek
            const approvedData = {
              status: 'approved',
              approved_by: user.name || userId,
              approved_at: new Date(),
              updated_at: new Date()
            };

            await trx('transport_requests')
              .where('id', requestId)
              .update(approvedData);

            console.log('Wniosek zaktualizowany na approved');

            // 2. Utwórz transport z wszystkimi danymi
            console.log('Tworzenie transportu z danymi:', transportData);
            const [result] = await trx('transports').insert(transportData).returning('id');
            const transportId = result.id;
            console.log('Transport utworzony z ID:', transportId);

            // 3. Zaktualizuj wniosek o ID utworzonego transportu
            await trx('transport_requests')
              .where('id', requestId)
              .update({ transport_id: transportId });

            console.log('Wniosek zaktualizowany z transport_id:', transportId);

            return transportId;
          });

          const warehouseName = selectedWarehouse === 'bialystok' ? 'Białystok' : 'Zielonka';
          console.log(`✅ Zaakceptowano wniosek ${requestId} dla magazynu ${warehouseName}, utworzono transport ${result}`);
          console.log(`✅ WZ Numbers z wniosku: ${existingRequest.wz_numbers} → zapisane jako wz_number w transporcie`);
          console.log(`✅ Rynek z wniosku: ${existingRequest.market_id} → ${getMarketName(existingRequest.market_id)}`);

          return NextResponse.json({ 
            success: true, 
            message: `Wniosek został zaakceptowany i dodany do kalendarza magazynu ${warehouseName}`,
            transportId: result,
            warehouse: selectedWarehouse,
            warehouseName: warehouseName,
            constructionName: existingRequest.construction_name,
            mpk: existingRequest.mpk,
            debugInfo: {
              wzNumbers: existingRequest.wz_numbers,
              market: getMarketName(existingRequest.market_id),
              realClient: existingRequest.real_client_name
            }
          });

        } catch (approveError) {
          console.error('Błąd podczas akceptacji wniosku:', approveError);
          
          // Spróbuj cofnąć zmiany jeśli możliwe
          try {
            await db('transport_requests')
              .where('id', requestId)
              .update({ 
                status: 'pending',
                approved_by: null,
                approved_at: null,
                transport_id: null
              });
            console.log('Cofnięto zmiany w wniosku po błędzie');
          } catch (rollbackError) {
            console.error('Nie udało się cofnąć zmian:', rollbackError);
          }

          return NextResponse.json({ 
            success: false, 
            error: 'Błąd podczas akceptacji wniosku: ' + approveError.message 
          }, { status: 500 });
        }

      case 'reject':
        if (!canApprove) {
          return NextResponse.json({ 
            success: false, 
            error: 'Brak uprawnień do odrzucania wniosków' 
          }, { status: 403 });
        }

        const rejectedData = {
          status: 'rejected',
          approved_by: user.name || userId,
          approved_at: new Date(),
          rejection_reason: data.rejection_reason || 'Brak uzasadnienia',
          updated_at: new Date()
        };

        await db('transport_requests')
          .where('id', requestId)
          .update(rejectedData);

        console.log(`Odrzucono wniosek ${requestId}`);

        return NextResponse.json({ 
          success: true, 
          message: 'Wniosek został odrzucony'
        });

      case 'edit':
        // Tylko właściciel może edytować swój wniosek (i tylko w statusie pending)
        if (!isOwner) {
          return NextResponse.json({ 
            success: false, 
            error: 'Możesz edytować tylko własne wnioski' 
          }, { status: 403 });
        }

        if (existingRequest.status !== 'pending') {
          return NextResponse.json({ 
            success: false, 
            error: 'Można edytować tylko wnioski w statusie oczekiwania' 
          }, { status: 400 });
        }

        // Przygotuj dane do aktualizacji - z danymi budowy
        const editData = {
          ...data,
          mpk: data.mpk || null,
          construction_name: data.construction_name || null,
          construction_id: data.construction_id || null,
          real_client_name: data.real_client_name || null,
          wz_numbers: data.wz_numbers || null,
          market_id: data.market_id || null,
          updated_at: new Date()
        };

        // Usuń pola, które nie mogą być edytowane
        delete editData.status;
        delete editData.requester_email;
        delete editData.requester_name;
        delete editData.approved_by;
        delete editData.approved_at;
        delete editData.transport_id;
        delete editData.action;
        delete editData.requestId;

        console.log('Aktualizacja wniosku z budową:', {
          requestId,
          constructionName: data.construction_name,
          mpk: data.mpk,
          wzNumbers: data.wz_numbers,
          marketId: data.market_id,
          otherData: Object.keys(editData)
        });

        await db('transport_requests')
          .where('id', requestId)
          .update(editData);

        console.log(`Zaktualizowano wniosek ${requestId} z budową: ${data.construction_name} (MPK: ${data.mpk})`);

        return NextResponse.json({ 
          success: true, 
          message: 'Wniosek został zaktualizowany',
          updatedConstruction: data.construction_name,
          updatedMpk: data.mpk
        });

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Nieznana akcja' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in PUT /api/transport-requests:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}
