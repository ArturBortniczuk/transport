// src/app/api/transport-requests/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import nodemailer from 'nodemailer';

// Konfiguracja transportera email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Funkcja walidacji sesji
const validateSession = async (authToken) => {
  if (!authToken) return null;
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first();
  
  return session?.user_id;
};

// Funkcja wysyłająca powiadomienie email
const sendNewRequestNotification = async (requestData) => {
  try {
    const kierownicy = await db('users')
      .where('role', 'admin')
      .orWhere('role', 'like', 'magazyn%')
      .select('email', 'name');

    if (!kierownicy || kierownicy.length === 0) {
      console.log('Brak kierowników do powiadomienia');
      return { success: false, message: 'Brak kierowników' };
    }

    const recipients = kierownicy.map(k => k.email);
    const deliveryDate = new Date(requestData.delivery_date).toLocaleDateString('pl-PL');

    // Mapa nazw centrów
    const CENTRA_NAZWY = {
      lapy: 'Łapy',
      wysokie: 'Wysokie Mazowieckie',
      bielsk: 'Bielsk Podlaski',
      bialystok: 'Białystok (centrum elektryczne)'
    };

    // Określ typ wniosku i szczegóły
    let requestType = 'Transport standardowy';
    let requestDetails = '';

    if (requestData.transport_type === 'delivery_route') {
      requestType = '🚛 OBJAZDÓWKA (Centra elektryczne)';
      
      let routeText = 'Błąd odczytu trasy';
      try {
        const points = JSON.parse(requestData.route_points);
        routeText = points.map(p => CENTRA_NAZWY[p] || p).join(' → ');
      } catch (e) {
        console.error('Błąd parsowania route_points:', e);
      }
      
      requestDetails = `
        <div class="info-row">
          <span class="label">Trasa objazdówki:</span>
          <span class="value" style="font-weight: bold; color: #7c3aed;">${routeText}</span>
        </div>
        <div class="info-row">
          <span class="label">Dystans:</span>
          <span class="value">${requestData.route_distance || 0} km</span>
        </div>
        <div class="info-row">
          <span class="label">MPK centrów:</span>
          <span class="value">${requestData.route_mpks || 'Brak'}</span>
        </div>
        ${requestData.document_numbers ? `
        <div class="info-row">
          <span class="label">Numery dokumentów:</span>
          <span class="value">${requestData.document_numbers}</span>
        </div>
        ` : ''}
      `;
    } else if (requestData.transport_type === 'warehouse') {
      requestType = 'Przesunięcie międzymagazynowe';
      
      const direction = requestData.transport_direction === 'zielonka_bialystok' 
        ? 'Zielonka → Białystok' 
        : 'Białystok → Zielonka';
      
      requestDetails = `
        <div class="info-row">
          <span class="label">Kierunek:</span>
          <span class="value">${direction}</span>
        </div>
        <div class="info-row">
          <span class="label">Opis towarów:</span>
          <span class="value">${requestData.goods_description}</span>
        </div>
        ${requestData.document_numbers ? `
        <div class="info-row">
          <span class="label">Dokumenty:</span>
          <span class="value">${requestData.document_numbers}</span>
        </div>
        ` : ''}
      `;
    } else {
      requestType = 'Transport do budowy/handlowca';
      
      requestDetails = `
        <div class="info-row">
          <span class="label">Odbiorca:</span>
          <span class="value">${requestData.construction_name || requestData.client_name || 'Nie podano'}</span>
        </div>
        <div class="info-row">
          <span class="label">MPK:</span>
          <span class="value">${requestData.mpk || 'Brak'}</span>
        </div>
        <div class="info-row">
          <span class="label">Lokalizacja:</span>
          <span class="value">${requestData.destination_city}${requestData.postal_code ? `, ${requestData.postal_code}` : ''}${requestData.street ? `, ${requestData.street}` : ''}</span>
        </div>
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
        ${requestData.contact_person ? `
        <div class="info-row">
          <span class="label">Osoba kontaktowa:</span>
          <span class="value">${requestData.contact_person}${requestData.contact_phone ? ` (tel: ${requestData.contact_phone})` : ''}</span>
        </div>
        ` : ''}
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-row { margin: 15px 0; padding: 10px; background: white; border-left: 4px solid #667eea; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; margin-left: 10px; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚛 Nowy wniosek transportowy</h1>
              <p>${requestType}</p>
            </div>
            <div class="content">
              ${requestDetails}
              
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

// Funkcja zapewniająca istnienie tabeli
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
        // NOWE KOLUMNY DLA OBJAZDÓWEK
        table.json('route_points');
        table.integer('route_distance');
        table.text('route_mpks');
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

      // NOWE KOLUMNY DLA OBJAZDÓWEK
      const hasRoutePoints = await db.schema.hasColumn('transport_requests', 'route_points');
      if (!hasRoutePoints) {
        await db.schema.table('transport_requests', table => {
          table.json('route_points');
        });
        console.log('Dodano kolumnę route_points');
      }

      const hasRouteDistance = await db.schema.hasColumn('transport_requests', 'route_distance');
      if (!hasRouteDistance) {
        await db.schema.table('transport_requests', table => {
          table.integer('route_distance');
        });
        console.log('Dodano kolumnę route_distance');
      }

      const hasRouteMpks = await db.schema.hasColumn('transport_requests', 'route_mpks');
      if (!hasRouteMpks) {
        await db.schema.table('transport_requests', table => {
          table.text('route_mpks');
        });
        console.log('Dodano kolumnę route_mpks');
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

    const safeStringify = (obj) => {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      }, 2);
    };

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
    console.log('🚀 PEŁNE DANE Z FORMULARZA:', safeStringify(requestData));


    const transportType = requestData.transport_type || 'standard';
    
    // WALIDACJA DLA PRZESUNIĘĆ MIĘDZYMAGAZYNOWYCH
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
    }

    // WALIDACJA DLA OBJAZDÓWEK
    if (transportType === 'delivery_route') {
      const requiredRouteFields = ['route_points', 'delivery_date'];
      for (const field of requiredRouteFields) {
        if (!requestData[field]) {
          return NextResponse.json({ 
            success: false, 
            error: `Pole ${field} jest wymagane dla objazdówek` 
          }, { status: 400 });
        }
      }

      if (!Array.isArray(requestData.route_points) || requestData.route_points.length < 2) {
        return NextResponse.json({ 
          success: false, 
          error: 'Objazdówka musi zawierać minimum 2 punkty' 
        }, { status: 400 });
      }

      const firstPoint = requestData.route_points[0];
      if (firstPoint !== 'lapy' && firstPoint !== 'bielsk') {
        return NextResponse.json({ 
          success: false, 
          error: 'Pierwszy punkt musi być: Łapy lub Bielsk Podlaski' 
        }, { status: 400 });
      }

      if (requestData.route_points.includes('bialystok')) {
        const lastPoint = requestData.route_points[requestData.route_points.length - 1];
        if (lastPoint !== 'bialystok') {
          return NextResponse.json({ 
            success: false, 
            error: 'Białystok centrum musi być ostatnim punktem' 
          }, { status: 400 });
        }
      }
    }

    // WALIDACJA DLA STANDARDOWYCH TRANSPORTÓW
    if (transportType === 'standard') {
      const requiredStandardFields = ['destination_city', 'delivery_date', 'justification', 'real_client_name'];
      for (const field of requiredStandardFields) {
        if (!requestData[field]) {
          return NextResponse.json({ 
            success: false, 
            error: `Pole ${field} jest wymagane` 
          }, { status: 400 });
        }
      }
    }

    // TWORZENIE OBIEKTU ZAPISU
    const newRequest = {
      requester_email: userId,
      requester_name: user.name,
      delivery_date: requestData.delivery_date,
      status: 'pending',
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    };

    if (transportType === 'warehouse') {
      newRequest.transport_type = 'warehouse';
      newRequest.transport_direction = requestData.transport_direction;
      newRequest.goods_description = requestData.goods_description;
      newRequest.document_numbers = requestData.document_numbers || null;
      newRequest.justification = requestData.justification;
      newRequest.notes = requestData.notes || null;
      
      newRequest.destination_city = 'Białystok';
      newRequest.postal_code = '15-169';
      newRequest.street = 'Wysockiego 69B';
      newRequest.client_name = 'Magazyn';
      newRequest.mpk = null;
      newRequest.construction_id = null;
      newRequest.construction_name = null;
      newRequest.real_client_name = null;
      newRequest.wz_numbers = null;
      newRequest.market_id = null;
      newRequest.contact_person = null;
      newRequest.contact_phone = null;
    } else if (transportType === 'delivery_route') {
      newRequest.transport_type = 'delivery_route';
      newRequest.route_points = JSON.stringify(requestData.route_points);
      newRequest.route_distance = requestData.route_distance || null;
      newRequest.route_mpks = requestData.route_mpks || null;
      newRequest.notes = requestData.notes || null;
      newRequest.document_numbers = requestData.document_numbers || null;
      
      newRequest.destination_city = 'Białystok';
      newRequest.postal_code = '15-169';
      newRequest.street = 'Wysockiego 69B';
      newRequest.client_name = 'Objazdówka Centra Elektryczne';
      newRequest.real_client_name = null;
      newRequest.wz_numbers = null;
      newRequest.market_id = null;
      newRequest.construction_id = null;
      newRequest.construction_name = null;
      newRequest.contact_person = null;
      newRequest.contact_phone = null;
      newRequest.transport_direction = null;
      newRequest.goods_description = null;
      newRequest.justification = null;
      newRequest.mpk = null;
    } else {
      newRequest.transport_type = 'standard';
      newRequest.destination_city = requestData.destination_city;
      newRequest.postal_code = requestData.postal_code || null;
      newRequest.street = requestData.street || null;
      newRequest.justification = requestData.justification;
      newRequest.mpk = requestData.mpk || null;
      newRequest.notes = requestData.notes || null;
      newRequest.user_id = requestData.user_id || null;
      newRequest.construction_id = requestData.construction_id ? parseInt(requestData.construction_id) : null;
      newRequest.construction_name = requestData.construction_name || null;
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

    console.log('🚀 DANE DO ZAPISANIA W BAZIE:', safeStringify(newRequest));


    const [result] = await db('transport_requests').insert(newRequest).returning('*');
    const insertedRequest = result;

    console.log('🚀 ZAPISANO W BAZIE (pełny rekord):', safeStringify(insertedRequest));

    console.log(`✅ Utworzono wniosek transportowy ID: ${insertedRequest.id}`);

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
      emailNotification: {
        success: emailResult.success,
        message: emailResult.message
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
    
    console.log('Update data:', { requestId, action });

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
        error: 'Wniosek nie istnieje' 
      }, { status: 404 });
    }

    // Logika akceptacji/odrzucenia lub edycji
    if (action === 'approve' || action === 'reject') {
      let permissions = {};
      try {
        if (user.permissions && typeof user.permissions === 'string') {
          permissions = JSON.parse(user.permissions);
        }
      } catch (e) {
        console.error('Błąd parsowania uprawnień:', e);
      }

      const isAdmin = user.role === 'admin';
      const isMagazyn = user.role === 'magazyn' || user.role?.startsWith('magazyn_');
      const canApprove = isAdmin || isMagazyn || permissions?.transport_requests?.approve === true;

      if (!canApprove) {
        return NextResponse.json({ 
          success: false, 
          error: 'Brak uprawnień do akceptacji/odrzucenia wniosków' 
        }, { status: 403 });
      }

      const updateFields = {
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user.name,
        approved_at: db.fn.now(),
        updated_at: db.fn.now()
      };

      if (action === 'reject' && data.rejection_reason) {
        updateFields.rejection_reason = data.rejection_reason;
      }

      await db('transport_requests')
        .where('id', requestId)
        .update(updateFields);

      return NextResponse.json({ 
        success: true, 
        message: action === 'approve' ? 'Wniosek zaakceptowany' : 'Wniosek odrzucony' 
      });

    } else if (action === 'edit') {
      if (existingRequest.requester_email !== userId) {
        return NextResponse.json({ 
          success: false, 
          error: 'Nie możesz edytować cudzych wniosków' 
        }, { status: 403 });
      }

      if (existingRequest.status !== 'pending') {
        return NextResponse.json({ 
          success: false, 
          error: 'Można edytować tylko oczekujące wnioski' 
        }, { status: 400 });
      }

      const allowedFields = [
        'destination_city', 'postal_code', 'street', 'delivery_date',
        'justification', 'client_name', 'real_client_name', 'wz_numbers',
        'market_id', 'contact_person', 'contact_phone', 'notes',
        'transport_direction', 'goods_description', 'document_numbers',
        'route_points', 'route_distance', 'route_mpks'
      ];

      const updateFields = {};
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updateFields[field] = data[field];
        }
      }

      if (Object.keys(updateFields).length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Brak danych do aktualizacji' 
        }, { status: 400 });
      }

      updateFields.updated_at = db.fn.now();

      await db('transport_requests')
        .where('id', requestId)
        .update(updateFields);

      return NextResponse.json({ 
        success: true, 
        message: 'Wniosek zaktualizowany' 
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Nieprawidłowa akcja' 
    }, { status: 400 });

  } catch (error) {
    console.error('Error in PUT /api/transport-requests:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}