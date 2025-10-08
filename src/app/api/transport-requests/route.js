// src/app/api/transport-requests/route.js - Z POWIADOMIENIAMI EMAIL
import { NextResponse } from 'next/server';
import db from '@/database/db';
import nodemailer from 'nodemailer';

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

// Funkcja wysyłania powiadomienia o nowym wniosku transportowym
const sendNewRequestNotification = async (requestData) => {
  // Lista kierowników do powiadomienia
  const recipients = [
    's.swiderski@grupaeltron.pl',
    'p.pietrusewicz@grupaeltron.pl'
  ];

  try {
    // Sprawdź konfigurację SMTP
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ SMTP nie skonfigurowany - powiadomienie nie zostanie wysłane');
      return { success: false, message: 'SMTP nie skonfigurowany' };
    }

    // Konfiguracja nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: "logistyka@grupaeltron.pl",
        pass: process.env.SMTP_PASSWORD
      }
    });

    // Formatowanie daty
    const deliveryDate = new Date(requestData.delivery_date).toLocaleDateString('pl-PL');
    
    // Określ typ wniosku
    const requestType = requestData.transport_type === 'warehouse' ? 'Przesunięcie międzymagazynowe' : 'Transport standardowy';
    
    // Nazwa rynku (jeśli jest)
    const marketName = requestData.market_id ? getMarketName(requestData.market_id) : 'Nie określono';

    // Przygotuj treść HTML emaila
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px; }
            .info-row { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
            .label { font-weight: bold; color: #495057; }
            .value { color: #212529; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; }
            .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🚛 Nowy wniosek transportowy</h2>
              <p style="margin: 0;">Typ: ${requestType}</p>
            </div>
            
            <div class="content">
              ${requestData.transport_type === 'warehouse' ? `
                <div class="alert">
                  <strong>⚠️ Przesunięcie międzymagazynowe</strong>
                </div>
                
                <div class="info-row">
                  <span class="label">Kierunek:</span>
                  <span class="value">${requestData.transport_direction === 'zielonka_bialystok' ? 'Zielonka → Białystok' : 'Białystok → Zielonka'}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Opis towaru:</span>
                  <span class="value">${requestData.goods_description || 'Brak opisu'}</span>
                </div>
                
                ${requestData.document_numbers ? `
                <div class="info-row">
                  <span class="label">Numery dokumentów:</span>
                  <span class="value">${requestData.document_numbers}</span>
                </div>
                ` : ''}
              ` : `
                <div class="info-row">
                  <span class="label">Miejsce docelowe:</span>
                  <span class="value">${requestData.destination_city || 'Nie podano'}</span>
                </div>
                
                ${requestData.postal_code ? `
                <div class="info-row">
                  <span class="label">Kod pocztowy:</span>
                  <span class="value">${requestData.postal_code}</span>
                </div>
                ` : ''}
                
                ${requestData.street ? `
                <div class="info-row">
                  <span class="label">Ulica:</span>
                  <span class="value">${requestData.street}</span>
                </div>
                ` : ''}
                
                ${requestData.construction_name ? `
                <div class="info-row">
                  <span class="label">Budowa:</span>
                  <span class="value">${requestData.construction_name}</span>
                </div>
                ` : ''}
                
                ${requestData.mpk ? `
                <div class="info-row">
                  <span class="label">MPK:</span>
                  <span class="value">${requestData.mpk}</span>
                </div>
                ` : ''}
                
                ${requestData.client_name ? `
                <div class="info-row">
                  <span class="label">Klient:</span>
                  <span class="value">${requestData.client_name}</span>
                </div>
                ` : ''}
                
                ${requestData.real_client_name ? `
                <div class="info-row">
                  <span class="label">Rzeczywisty klient:</span>
                  <span class="value">${requestData.real_client_name}</span>
                </div>
                ` : ''}
                
                ${requestData.wz_numbers ? `
                <div class="info-row">
                  <span class="label">Numery WZ:</span>
                  <span class="value">${requestData.wz_numbers}</span>
                </div>
                ` : ''}
                
                <div class="info-row">
                  <span class="label">Rynek:</span>
                  <span class="value">${marketName}</span>
                </div>
                
                ${requestData.contact_person ? `
                <div class="info-row">
                  <span class="label">Osoba kontaktowa:</span>
                  <span class="value">${requestData.contact_person}${requestData.contact_phone ? ` (tel: ${requestData.contact_phone})` : ''}</span>
                </div>
                ` : ''}
              `}
              
              <div class="info-row">
                <span class="label">Data dostawy:</span>
                <span class="value">${deliveryDate}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Zlecający:</span>
                <span class="value">${requestData.requester_name} (${requestData.requester_email})</span>
              </div>
              
              ${requestData.justification ? `
              <div class="info-row">
                <span class="label">Uzasadnienie:</span>
                <span class="value">${requestData.justification}</span>
              </div>
              ` : ''}
              
              ${requestData.notes ? `
              <div class="info-row">
                <span class="label">Uwagi:</span>
                <span class="value">${requestData.notes}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>To powiadomienie zostało wygenerowane automatycznie przez System Transportowy.</p>
              <p>Zaloguj się do systemu, aby przejrzeć szczegóły wniosku i podjąć decyzję o jego akceptacji.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Wysłanie emaila
    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: recipients.join(', '),
      subject: `🚛 Nowy wniosek transportowy - ${requestType} - ${deliveryDate}`,
      html: emailHtml
    };

    console.log('📧 Wysyłanie powiadomienia o nowym wniosku do:', recipients.join(', '));
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Powiadomienie wysłane:', info.messageId);
    return { 
      success: true, 
      message: `Powiadomienie wysłane do ${recipients.length} kierowników`,
      messageId: info.messageId 
    };

  } catch (error) {
    console.error('❌ Błąd wysyłania powiadomienia o nowym wniosku:', error);
    return { 
      success: false, 
      message: 'Błąd wysyłania powiadomienia: ' + error.message 
    };
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
        table.string('destination_city');
        table.string('postal_code');
        table.string('street');
        table.date('delivery_date').notNullable();
        table.string('mpk');
        table.string('construction_name');
        table.integer('construction_id');
        table.text('justification');
        table.string('client_name');
        table.string('real_client_name');
        table.string('wz_numbers');
        table.integer('market_id');
        table.string('contact_person');
        table.string('contact_phone');
        table.text('notes');
        table.string('approved_by');
        table.timestamp('approved_at');
        table.string('rejection_reason');
        table.integer('transport_id');
        table.string('transport_type').defaultTo('standard');
        table.string('transport_direction');
        table.text('goods_description');
        table.string('document_numbers');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      
      console.log('Tabela transport_requests została utworzona');
    } else {
      // Sprawdzenia i dodawanie brakujących kolumn
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

      const hasTransportType = await db.schema.hasColumn('transport_requests', 'transport_type');
      if (!hasTransportType) {
        await db.schema.table('transport_requests', table => {
          table.string('transport_type').defaultTo('standard');
        });
        console.log('Dodano kolumnę transport_type');
      }

      const hasTransportDirection = await db.schema.hasColumn('transport_requests', 'transport_direction');
      if (!hasTransportDirection) {
        await db.schema.table('transport_requests', table => {
          table.string('transport_direction');
        });
        console.log('Dodano kolumnę transport_direction');
      }

      const hasGoodsDescription = await db.schema.hasColumn('transport_requests', 'goods_description');
      if (!hasGoodsDescription) {
        await db.schema.table('transport_requests', table => {
          table.text('goods_description');
        });
        console.log('Dodano kolumnę goods_description');
      }

      const hasDocumentNumbers = await db.schema.hasColumn('transport_requests', 'document_numbers');
      if (!hasDocumentNumbers) {
        await db.schema.table('transport_requests', table => {
          table.string('document_numbers');
        });
        console.log('Dodano kolumnę document_numbers');
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

    const tableReady = await ensureTableExists();
    if (!tableReady) {
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd inicjalizacji tabeli' 
      }, { status: 500 });
    }

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

    if (!canViewAll) {
      query = query.where('requester_email', userId);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (status && status !== 'all') {
      query = query.where('status', status);
    }

    if (dateFrom) {
      query = query.where('delivery_date', '>=', dateFrom);
    }
    if (dateTo) {
      query = query.where('delivery_date', '<=', dateTo);
    }

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
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const tableReady = await ensureTableExists();
    if (!tableReady) {
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd inicjalizacji tabeli' 
      }, { status: 500 });
    }

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

    const transportType = requestData.transport_type || 'standard';
    
    if (transportType === 'warehouse') {
      const requiredWarehouseFields = ['transport_direction', 'goods_description', 'delivery_date', 'justification'];
      for (const field of requiredWarehouseFields) {
        if (!requestData[field]) {
          return NextResponse.json({ 
            success: false, 
            error: `Pole ${field} jest wymagane dla przesunięć międzymagazynowych` 
          }, { status: 400 });
        }
      }

      const validDirections = ['zielonka_bialystok', 'bialystok_zielonka'];
      if (!validDirections.includes(requestData.transport_direction)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Nieprawidłowy kierunek transportu' 
        }, { status: 400 });
      }
    } else {
      const requiredFields = ['destination_city', 'delivery_date', 'justification'];
      for (const field of requiredFields) {
        if (!requestData[field]) {
          return NextResponse.json({ 
            success: false, 
            error: `Pole ${field} jest wymagane` 
          }, { status: 400 });
        }
      }

      if (!requestData.mpk && !requestData.construction_name) {
        return NextResponse.json({ 
          success: false, 
          error: 'Wybór budowy/MPK jest wymagany' 
        }, { status: 400 });
      }
    }

    const deliveryDate = new Date(requestData.delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deliveryDate < today) {
      return NextResponse.json({ 
        success: false, 
        error: 'Data dostawy nie może być w przeszłości' 
      }, { status: 400 });
    }

    const newRequest = {
      status: 'pending',
      requester_email: userId,
      requester_name: user.name || userId,
      delivery_date: requestData.delivery_date,
      justification: requestData.justification || '',
      notes: requestData.notes || null,
      transport_type: transportType,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (transportType === 'warehouse') {
      newRequest.transport_direction = requestData.transport_direction;
      newRequest.goods_description = requestData.goods_description;
      newRequest.document_numbers = requestData.document_numbers || null;
      newRequest.mpk = requestData.transport_direction === 'bialystok_zielonka' ? '549-03-01' : '549-03-02';

      if (requestData.transport_direction === 'zielonka_bialystok') {
        newRequest.destination_city = 'Białystok';
        newRequest.postal_code = '15-169';
        newRequest.street = 'ul. Wysockiego 69';
      } else {
        newRequest.destination_city = 'Zielonka';
        newRequest.postal_code = '05-220';
        newRequest.street = 'ul. Krótka 2';
      }
      newRequest.mpk = null;
      newRequest.construction_name = null;
      newRequest.construction_id = null;
      newRequest.client_name = null;
      newRequest.real_client_name = null;
      newRequest.wz_numbers = null;
      newRequest.market_id = null;
      newRequest.contact_person = null;
      newRequest.contact_phone = null;
    } else {
      newRequest.destination_city = requestData.destination_city || '';
      newRequest.postal_code = requestData.postal_code || null;
      newRequest.street = requestData.street || null;
      newRequest.mpk = requestData.mpk || null;
      newRequest.construction_name = requestData.construction_name || null;
      newRequest.construction_id = requestData.construction_id ? parseInt(requestData.construction_id) : null;
      newRequest.client_name = requestData.client_name || null;
      newRequest.real_client_name = requestData.real_client_name || null;
      newRequest.wz_numbers = requestData.wz_numbers || null;
      newRequest.market_id = requestData.market_id ? parseInt(requestData.market_id) : null;
      newRequest.contact_person = requestData.contact_person || null;
      newRequest.contact_phone = requestData.contact_phone || null;
      newRequest.transport_direction = null;
      newRequest.goods_description = null;
      newRequest.document_numbers = null;
    }

    console.log('🚀 DANE DO ZAPISANIA W BAZIE:', JSON.stringify(newRequest, null, 2));

    const [result] = await db('transport_requests').insert(newRequest).returning('*');
    const insertedRequest = result;

    console.log('🚀 ZAPISANO W BAZIE (pełny rekord):', JSON.stringify(insertedRequest, null, 2));
    console.log(`✅ Utworzono wniosek transportowy ID: ${insertedRequest.id}`);
    console.log(`✅ Z danymi: real_client_name="${insertedRequest.real_client_name}", wz_numbers="${insertedRequest.wz_numbers}", market_id="${insertedRequest.market_id}"`);

    // WYSYŁKA POWIADOMIENIA EMAIL DO KIEROWNIKÓW
    console.log('📮 Wysyłanie powiadomienia email do kierowników...');
    const emailResult = await sendNewRequestNotification({
      ...insertedRequest,
      requester_name: user.name,
      requester_email: userId
    });
    console.log('📬 Wynik wysyłki emaila:', emailResult.message);

    return NextResponse.json({ 
      success: true, 
      message: 'Wniosek transportowy został złożony',
      requestId: insertedRequest.id,
      emailNotification: emailResult,
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
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const tableReady = await ensureTableExists();
    if (!tableReady) {
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd inicjalizacji tabeli' 
      }, { status: 500 });
    }

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

    const existingRequest = await db('transport_requests')
      .where('id', requestId)
      .first();

    if (!existingRequest) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono wniosku' 
      }, { status: 404 });
    }

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
          const transportsTableExists = await db.schema.hasTable('transports');
          if (!transportsTableExists) {
            return NextResponse.json({ 
              success: false, 
              error: 'Tabela transportów nie istnieje' 
            }, { status: 500 });
          }

          const selectedWarehouse = data.source_warehouse || 'bialystok';
          console.log('Wybrany magazyn:', selectedWarehouse);

          let transportData;
          
          if (existingRequest.transport_type === 'warehouse') {
            const isAcceptedByBialystok = selectedWarehouse === 'bialystok';
            const calendarDestination = isAcceptedByBialystok ? 'Zielonka' : 'Białystok';
            const autoMpk = existingRequest.transport_direction === 'bialystok_zielonka' ? '549-03-01' : '549-03-02';
            
            transportData = {
              destination_city: calendarDestination,
              delivery_date: existingRequest.delivery_date,
              status: 'active',
              source_warehouse: selectedWarehouse,
              postal_code: calendarDestination === 'Białystok' ? '15-169' : '05-220',
              street: calendarDestination === 'Białystok' ? 'ul. Wysockiego 69' : 'ul. Krótka 2',
              mpk: autoMpk,
              client_name: 'Przesunięcie międzymagazynowe',
              requester_name: existingRequest.requester_name || null,
              requester_email: existingRequest.requester_email || null,
              wz_number: existingRequest.document_numbers || null,
              market: null,
              distance: 183,
              notes: `Przesunięcie międzymagazynowe z wniosku #${requestId}. Kierunek: ${existingRequest.transport_direction === 'bialystok_zielonka' ? 'Białystok → Zielonka' : 'Zielonka → Białystok'}. Towary: ${existingRequest.goods_description}. Realizuje: Magazyn ${selectedWarehouse === 'bialystok' ? 'Białystok' : 'Zielonka'}.${existingRequest.notes ? ` Uwagi: ${existingRequest.notes}` : ''}`.trim(),
              loading_level: '100%',
              is_cyclical: false
            };
          } else {
            transportData = {
              destination_city: existingRequest.destination_city,
              delivery_date: existingRequest.delivery_date,
              status: 'active',
              source_warehouse: selectedWarehouse,
              postal_code: existingRequest.postal_code || null,
              street: existingRequest.street || null,
              mpk: existingRequest.mpk || null,
              client_name: existingRequest.real_client_name || existingRequest.client_name || null,
              requester_name: existingRequest.client_name || existingRequest.requester_name || null,
              requester_email: existingRequest.requester_email || null,
              wz_number: existingRequest.wz_numbers || null,
              market: getMarketName(existingRequest.market_id) || null,
              distance: existingRequest.distance_km || null,
              notes: `Utworzony z wniosku #${requestId}${existingRequest.construction_name ? ` dla budowy: ${existingRequest.construction_name}` : ''}${existingRequest.notes ? `. ${existingRequest.notes}` : ''}`.trim(),
              loading_level: '100%',
              is_cyclical: false
            };
          }

          console.log('🚀 DEBUGOWANIE: Pełne dane wniosku:', existingRequest);
          console.log('🚀 DEBUGOWANIE: Dane transportu do utworzenia:', transportData);
          console.log('🚀 Magazyn wybrany przez użytkownika:', selectedWarehouse);

          const result = await db.transaction(async (trx) => {
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

            console.log('Tworzenie transportu z danymi:', transportData);
            const [result] = await trx('transports').insert(transportData).returning('id');
            const transportId = result.id;
            console.log('Transport utworzony z ID:', transportId);

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