// src/app/api/spedycje/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first();
  
  return session?.user_id;
};

// Pobieranie wszystkich spedycji
export async function GET(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    // Sprawdź czy tabela istnieje, jeśli nie - utwórz ją
    const tableExists = await db.schema.hasTable('spedycje');
    if (!tableExists) {
      await db.schema.createTable('spedycje', table => {
        table.increments('id').primary();
        table.string('status').defaultTo('new');
        table.string('order_number'); // Dodana kolumna na numer zamówienia
        table.string('created_by');
        table.string('created_by_email');
        table.string('responsible_person');
        table.string('responsible_email');
        table.string('mpk');
        table.string('location');
        table.text('location_data');
        table.text('delivery_data');
        table.string('loading_contact');
        table.string('unloading_contact');
        table.date('delivery_date');
        table.string('documents');
        table.text('notes');
        table.text('response_data');
        table.string('completed_by');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('completed_at');
        table.integer('distance_km'); // Dodana kolumna do przechowywania odległości
        table.string('client_name'); // Dodana kolumna na nazwę klienta/odbiorcy
        table.text('goods_description'); // Dodana kolumna na opis towaru
        table.text('responsible_constructions'); // Dodana kolumna na odpowiedzialne budowy
      });
    }
    
    // Sprawdzanie i dodawanie nowych kolumn, jeśli nie istnieją
    const hasOrderNumberColumn = await db.schema.hasColumn('spedycje', 'order_number');
    if (!hasOrderNumberColumn) {
      await db.schema.table('spedycje', table => {
        table.string('order_number');
      });
    }
    
    const hasDistanceColumn = await db.schema.hasColumn('spedycje', 'distance_km');
    if (!hasDistanceColumn) {
      await db.schema.table('spedycje', table => {
        table.integer('distance_km');
      });
    }

    const hasOrderSentColumn = await db.schema.hasColumn('spedycje', 'order_sent');
    if (!hasOrderSentColumn) {
      await db.schema.table('spedycje', table => {
        table.boolean('order_sent').defaultTo(false);
        table.timestamp('order_sent_at');
        table.string('order_sent_by');
        table.string('order_recipient');
        table.text('order_data');
      });
    }
    
    // Sprawdź nowe kolumny (dodane)
    const hasClientNameColumn = await db.schema.hasColumn('spedycje', 'client_name');
    if (!hasClientNameColumn) {
      await db.schema.table('spedycje', table => {
        table.string('client_name');
      });
    }
    
    const hasGoodsDescriptionColumn = await db.schema.hasColumn('spedycje', 'goods_description');
    if (!hasGoodsDescriptionColumn) {
      await db.schema.table('spedycje', table => {
        table.text('goods_description');
      });
    }
    
    const hasResponsibleConstructionsColumn = await db.schema.hasColumn('spedycje', 'responsible_constructions');
    if (!hasResponsibleConstructionsColumn) {
      await db.schema.table('spedycje', table => {
        table.text('responsible_constructions');
      });
    }
    
    // Budujemy zapytanie
    let query = db('spedycje');
    
    // Filtrujemy po statusie jeśli podany
    if (status) {
      query = query.where('status', status);
    }
    
    // Sortujemy od najnowszych
    query = query.orderBy('created_at', 'desc');
    
    // Wykonaj zapytanie
    const spedycje = await query;
    
    // Przetwarzamy dane przed wysłaniem (parsowanie JSONa)
    const processedData = spedycje.map(item => {
      try {
        // Parsowanie danych JSON
        if (item.location_data) {
          item.location_data = JSON.parse(item.location_data);
        }
        if (item.delivery_data) {
          item.delivery_data = JSON.parse(item.delivery_data);
        }
        if (item.response_data) {
          item.response_data = JSON.parse(item.response_data);
        }
        if (item.goods_description) {
          item.goods_description = JSON.parse(item.goods_description);
        }
        if (item.responsible_constructions) {
          item.responsible_constructions = JSON.parse(item.responsible_constructions);
        }
      } catch (e) {
        console.error('Error parsing JSON data in spedycje:', e);
      }
      
      // Konwertuj nazwy pól z bazy danych na nazwy używane przez front-end
      return {
        ...item,
        id: item.id,
        status: item.status,
        orderNumber: item.order_number,
        createdBy: item.created_by,
        createdByEmail: item.created_by_email,
        responsiblePerson: item.responsible_person,
        responsibleEmail: item.responsible_email,
        mpk: item.mpk,
        location: item.location,
        producerAddress: item.location_data,
        delivery: item.delivery_data,
        loadingContact: item.loading_contact,
        unloadingContact: item.unloading_contact,
        deliveryDate: item.delivery_date,
        documents: item.documents,
        notes: item.notes,
        response: item.response_data,
        completedBy: item.completed_by,
        createdAt: item.created_at,
        completedAt: item.completed_at,
        distanceKm: item.distance_km,
        clientName: item.client_name,
        goodsDescription: item.goods_description,
        responsibleConstructions: item.responsible_constructions
      };
    });
    
    return NextResponse.json({ 
      success: true, 
      spedycje: processedData || []
    });
  } catch (error) {
    console.error('Error fetching spedycje:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Dodawanie nowego zlecenia spedycji
export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const spedycjaData = await request.json();
    console.log('Otrzymane dane spedycji:', spedycjaData);
    
    // Sprawdzamy czy użytkownik ma uprawnienia
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name', 'permissions', 'is_admin')
      .first();
    
    // Pobierz uprawnienia użytkownika
    let permissions = {};
    try {
      if (user.permissions && typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }

    // Sprawdź czy użytkownik ma uprawnienie do dodawania spedycji
    const isAdmin = user.is_admin === 1 || user.is_admin === true || user.role === 'admin';
    const canAddSpedycja = isAdmin || permissions?.spedycja?.add === true;

    if (!canAddSpedycja) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do dodawania spedycji' 
      }, { status: 403 });
    }
    
    // Generowanie numeru zamówienia
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // Miesiące są 0-indexed w JavaScript
    
    // Pobierz ostatni numer zamówienia z tego miesiąca i roku
    const lastOrderQuery = await db('spedycje')
      .whereRaw('EXTRACT(MONTH FROM created_at) = ?', [month])
      .whereRaw('EXTRACT(YEAR FROM created_at) = ?', [year])
      .orderBy('id', 'desc')
      .first();
    
    // Ustal numer dla nowego zamówienia
    let orderNumber = 1;
    if (lastOrderQuery && lastOrderQuery.order_number) {
      // Jeśli istnieje już zamówienie z tego miesiąca/roku, wyciągnij numer
      const lastOrderMatch = lastOrderQuery.order_number.match(/^(\d+)\/\d+\/\d+$/);
      if (lastOrderMatch) {
        orderNumber = parseInt(lastOrderMatch[1], 10) + 1;
      }
    }
    
    // Sformatuj numer zamówienia
    const formattedOrderNumber = `${orderNumber.toString().padStart(4, '0')}/${month}/${year}`;
    
    // Przygotowanie danych do zapisania - przetwarzanie nowych pól
    let goodsDescriptionJson = null;
    if (spedycjaData.goodsDescription) {
      goodsDescriptionJson = JSON.stringify(spedycjaData.goodsDescription);
    }
    
    let responsibleConstructionsJson = null;
    if (spedycjaData.responsibleConstructions && spedycjaData.responsibleConstructions.length > 0) {
      responsibleConstructionsJson = JSON.stringify(spedycjaData.responsibleConstructions);
    }
    
    // Przygotowujemy dane do zapisania
    const dataToSave = {
      status: 'new',
      order_number: formattedOrderNumber,
      created_by: user.name,
      created_by_email: userId,
      responsible_person: spedycjaData.responsiblePerson || user.name,
      responsible_email: spedycjaData.responsibleEmail || userId,
      mpk: spedycjaData.mpk,
      location: spedycjaData.location,
      location_data: spedycjaData.producerAddress ? JSON.stringify(spedycjaData.producerAddress) : null,
      delivery_data: spedycjaData.delivery ? JSON.stringify(spedycjaData.delivery) : null,
      loading_contact: spedycjaData.loadingContact,
      unloading_contact: spedycjaData.unloadingContact,
      delivery_date: spedycjaData.deliveryDate,
      documents: spedycjaData.documents,
      notes: spedycjaData.notes,
      distance_km: spedycjaData.distanceKm || 0,
      client_name: spedycjaData.clientName || '', // Nowe pole
      goods_description: goodsDescriptionJson, // Nowe pole
      responsible_constructions: responsibleConstructionsJson, // Nowe pole
      created_at: db.fn.now()
    };
    
    console.log('Dane do zapisania w bazie:', dataToSave);
    
    // Sprawdź czy tabela istnieje, jeśli nie - utwórz ją z nowymi kolumnami
    const tableExists = await db.schema.hasTable('spedycje');
    if (!tableExists) {
      await db.schema.createTable('spedycje', table => {
        table.increments('id').primary();
        table.string('status').defaultTo('new');
        table.string('order_number');
        table.string('created_by');
        table.string('created_by_email');
        table.string('responsible_person');
        table.string('responsible_email');
        table.string('mpk');
        table.string('location');
        table.text('location_data');
        table.text('delivery_data');
        table.string('loading_contact');
        table.string('unloading_contact');
        table.date('delivery_date');
        table.string('documents');
        table.text('notes');
        table.text('response_data');
        table.string('completed_by');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('completed_at');
        table.integer('distance_km');
        table.string('client_name'); // Nowe pole
        table.text('goods_description'); // Nowe pole
        table.text('responsible_constructions'); // Nowe pole
      });
    } else {
      // Sprawdź czy nowe kolumny istnieją, jeśli nie - dodaj je
      const hasClientNameColumn = await db.schema.hasColumn('spedycje', 'client_name');
      if (!hasClientNameColumn) {
        await db.schema.table('spedycje', table => {
          table.string('client_name');
        });
      }
      
      const hasGoodsDescriptionColumn = await db.schema.hasColumn('spedycje', 'goods_description');
      if (!hasGoodsDescriptionColumn) {
        await db.schema.table('spedycje', table => {
          table.text('goods_description');
        });
      }
      
      const hasResponsibleConstructionsColumn = await db.schema.hasColumn('spedycje', 'responsible_constructions');
      if (!hasResponsibleConstructionsColumn) {
        await db.schema.table('spedycje', table => {
          table.text('responsible_constructions');
        });
      }
    }
    
    // Zapisujemy do bazy danych
    const [id] = await db('spedycje').insert(dataToSave).returning('id');
    
    return NextResponse.json({ 
      success: true, 
      id: id
    });
  } catch (error) {
    console.error('Error adding spedycja:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// NOWA FUNKCJA: Automatyczne uzupełnianie odpowiedzi w połączonych transportach
const createResponsesForConnectedTransports = async (connectedTransports, mainResponseData) => {
  console.log('Tworzenie odpowiedzi dla połączonych transportów:', connectedTransports);
  
  for (const connectedTransport of connectedTransports) {
    try {
      // Pobierz aktualne dane transportu
      const currentTransport = await db('spedycje')
        .where('id', connectedTransport.id)
        .first();
      
      if (!currentTransport) {
        console.error(`Transport o ID ${connectedTransport.id} nie istnieje`);
        continue;
      }
      
      // Sprawdź czy transport już ma odpowiedź
      if (currentTransport.response_data && currentTransport.response_data !== 'null' && currentTransport.response_data !== '{}') {
        console.log(`Transport ${connectedTransport.id} już ma odpowiedź, pomijam`);
        continue;
      }
      
      // Przygotuj odpowiedź dla tego transportu
      const connectedResponseData = {
        driverName: mainResponseData.driverName,
        driverSurname: mainResponseData.driverSurname,
        driverPhone: mainResponseData.driverPhone,
        vehicleNumber: mainResponseData.vehicleNumber,
        deliveryPrice: mainResponseData.costPerTransport, // Użyj podzielonej ceny
        distanceKm: currentTransport.distance_km || 0,
        pricePerKm: currentTransport.distance_km > 0 ? 
          (mainResponseData.costPerTransport / currentTransport.distance_km).toFixed(2) : 0,
        adminNotes: mainResponseData.adminNotes || '',
        // Dodaj informację, że to automatyczna odpowiedź
        autoGenerated: true,
        sourceTransportId: mainResponseData.sourceTransportId || null,
        connectedFrom: `Transport ID: ${mainResponseData.sourceTransportId || 'Główny'}`
      };
      
      // Jeśli zmieniono datę dostawy w głównym transporcie, zastosuj to samo
      if (mainResponseData.dateChanged) {
        connectedResponseData.newDeliveryDate = mainResponseData.newDeliveryDate;
        connectedResponseData.originalDeliveryDate = currentTransport.delivery_date;
        connectedResponseData.dateChanged = true;
      }
      
      console.log(`Zapisuję odpowiedź dla transportu ${connectedTransport.id}:`, connectedResponseData);
      
      // Zapisz odpowiedź dla połączonego transportu
      await db('spedycje')
        .where('id', connectedTransport.id)
        .update({
          response_data: JSON.stringify(connectedResponseData)
        });
      
      console.log(`Pomyślnie utworzono odpowiedź dla transportu ${connectedTransport.id}`);
      
    } catch (error) {
      console.error(`Błąd tworzenia odpowiedzi dla transportu ${connectedTransport.id}:`, error);
    }
  }
};

// Aktualizacja spedycji (odpowiedź) - ZMODYFIKOWANA
export async function PUT(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { id, ...data } = await request.json();
    console.log('Otrzymane dane odpowiedzi:', { id, ...data });
    
    // Sprawdzamy czy użytkownik ma uprawnienia
    const user = await db('users')
      .where('email', userId)
      .select('role', 'permissions', 'is_admin')
      .first();
    
    // Pobierz uprawnienia użytkownika
    let permissions = {};
    try {
      if (user.permissions && typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }

    // Sprawdź czy użytkownik ma uprawnienie do odpowiadania na spedycje
    const isAdmin = user.is_admin === 1 || user.is_admin === true || user.role === 'admin';
    const canRespondToSpedycja = isAdmin || permissions?.spedycja?.respond === true;

    if (!canRespondToSpedycja) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do odpowiadania na zlecenia spedycji' 
      }, { status: 403 });
    }
    
    // Dodaj ID źródłowego transportu do danych odpowiedzi
    const responseData = {
      ...data,
      sourceTransportId: id
    };
    
    // Przygotowujemy dane odpowiedzi - teraz bez zmiany statusu i daty zakończenia
    const updateData = {
      response_data: JSON.stringify(responseData)
    };
    
    // Jeśli odległość jest podana w odpowiedzi, zapiszmy ją również bezpośrednio
    if (data.distanceKm) {
      updateData.distance_km = data.distanceKm;
    }
    
    console.log('Dane odpowiedzi do zapisania:', updateData);
    
    // Aktualizujemy rekord w bazie
    const updated = await db('spedycje')
      .where('id', id)
      .update(updateData);
    
    if (updated === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono zlecenia spedycji o podanym ID' 
      }, { status: 404 });
    }
    
    // NOWA LOGIKA: Jeśli są połączone transporty, utwórz dla nich odpowiedzi
    if (data.connectedTransports && data.connectedTransports.length > 0) {
      console.log('Wykryto połączone transporty, tworzę automatyczne odpowiedzi...');
      await createResponsesForConnectedTransports(data.connectedTransports, responseData);
    }
    
    return NextResponse.json({ 
      success: true,
      message: data.connectedTransports?.length > 0 ? 
        `Zapisano odpowiedź i utworzono automatyczne odpowiedzi dla ${data.connectedTransports.length} połączonych transportów` :
        'Zapisano odpowiedź'
    });
  } catch (error) {
    console.error('Error updating spedycja:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Usuwanie zlecenia spedycji (tylko admin)
export async function DELETE(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdzamy czy użytkownik jest administratorem
    const isAdmin = await db('users')
      .where('email', userId)
      .where('is_admin', true)
      .first();
    
    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień administratora' 
      }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie podano ID zlecenia' 
      }, { status: 400 });
    }
    
    // Usuwamy rekord z bazy
    const deleted = await db('spedycje')
      .where('id', id)
      .del();
    
    if (deleted === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono zlecenia o podanym ID' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true
    });
  } catch (error) {
    console.error('Error deleting spedycja:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
