// src/app/api/spedycje/route.js - KOMPLETNY PLIK Z POWIADOMIENIAMI EMAIL
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/database/db';
import nodemailer from 'nodemailer';
import { getSessionUser } from '@/lib/auth';
import { getNextSpedycjaOrderNumber } from '@/lib/utils/orderNumber';

// Funkcja wysyłania powiadomienia o odpowiedzi na spedycję
const sendResponseNotification = async (spedycjaData, responseData) => {
  try {
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ SMTP nie skonfigurowany - powiadomienie nie zostanie wysłane');
      return { success: false, message: 'SMTP nie skonfigurowany' };
    }

    const createdByEmail = spedycjaData.created_by_email;
    console.log('📧 Sprawdzam zleceniodawcę:', createdByEmail);

    const eligibleManagers = [
      's.swiderski@grupaeltron.pl',
      'p.pietrusewicz@grupaeltron.pl'
    ];

    if (!eligibleManagers.includes(createdByEmail)) {
      console.log('ℹ️ Zleceniodawca nie jest na liście kierowników - brak powiadomienia');
      return { success: true, message: 'Zleceniodawca nie wymaga powiadomienia' };
    }

    const recipient = createdByEmail;
    console.log('✅ Wysyłam powiadomienie do zleceniodawcy:', recipient);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: "logistyka@grupaeltron.pl",
        pass: process.env.SMTP_PASSWORD
      }
    });

    const deliveryDate = new Date(spedycjaData.delivery_date).toLocaleDateString('pl-PL');
    const responseDate = new Date().toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let producerInfo = '';
    let deliveryInfo = '';

    try {
      if (spedycjaData.location_data) {
        const producerData = typeof spedycjaData.location_data === 'string'
          ? JSON.parse(spedycjaData.location_data)
          : spedycjaData.location_data;

        if (producerData) {
          producerInfo = `
            <div class="info-row">
              <span class="label">Adres producenta:</span>
              <span class="value">
                ${producerData.city || ''} ${producerData.postalCode || ''}<br>
                ${producerData.street || ''}
              </span>
            </div>
          `;
        }
      }
    } catch (e) {
      console.error('Błąd parsowania location_data:', e);
    }

    try {
      if (spedycjaData.delivery_data) {
        const deliveryData = typeof spedycjaData.delivery_data === 'string'
          ? JSON.parse(spedycjaData.delivery_data)
          : spedycjaData.delivery_data;

        if (deliveryData) {
          deliveryInfo = `
            <div class="info-row">
              <span class="label">Adres dostawy:</span>
              <span class="value">
                ${deliveryData.city || ''} ${deliveryData.postalCode || ''}<br>
                ${deliveryData.street || ''}
              </span>
            </div>
          `;
        }
      }
    } catch (e) {
      console.error('Błąd parsowania delivery_data:', e);
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3B82F6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px; }
            .info-row { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
            .label { font-weight: bold; color: #495057; display: block; margin-bottom: 5px; }
            .value { color: #212529; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; }
            .alert { padding: 15px; margin: 15px 0; border-radius: 4px; }
            .alert-info { background: #dbeafe; border-left: 4px solid #3B82F6; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .badge-info { background: #3B82F6; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>💬 Otrzymano odpowiedź na zlecenie spedycyjne</h2>
              <p style="margin: 0;">Twoje zlecenie zostało obsłużone przez spedytora</p>
            </div>
            
            <div class="content">
              <div style="text-align: center; margin-bottom: 20px;">
                <span class="badge badge-info">ODPOWIEDZIANE</span>
              </div>

              ${spedycjaData.order_number ? `
              <div class="info-row">
                <span class="label">Numer zlecenia:</span>
                <span class="value">${spedycjaData.order_number}</span>
              </div>
              ` : ''}

              <div class="info-row">
                <span class="label">Magazyn/Lokalizacja:</span>
                <span class="value">${spedycjaData.location || 'Nie określono'}</span>
              </div>

              <div class="info-row">
                <span class="label">Data dostawy:</span>
                <span class="value">${deliveryDate}</span>
              </div>

              <div class="info-row">
                <span class="label">Data odpowiedzi:</span>
                <span class="value">${responseDate}</span>
              </div>

              ${spedycjaData.client_name ? `
              <div class="info-row">
                <span class="label">Klient:</span>
                <span class="value">${spedycjaData.client_name}</span>
              </div>
              ` : ''}

              ${producerInfo}
              ${deliveryInfo}

              <div class="alert alert-info">
                <strong>📋 Szczegóły odpowiedzi spedytora:</strong>
                ${responseData.driverName && responseData.driverSurname ? `
                  <div style="margin-top: 10px;">
                    <strong>Kierowca:</strong> ${responseData.driverName} ${responseData.driverSurname}
                    ${responseData.driverPhone ? ` (tel: ${responseData.driverPhone})` : ''}
                  </div>
                ` : ''}
                ${responseData.vehicleNumber ? `
                  <div><strong>Pojazd:</strong> ${responseData.vehicleNumber}</div>
                ` : ''}
                ${responseData.transportType ? `
                  <div><strong>Rodzaj transportu:</strong> ${responseData.transportType}</div>
                ` : ''}
                ${responseData.deliveryPrice ? `
                  <div><strong>Cena dostawy:</strong> ${responseData.deliveryPrice} PLN</div>
                ` : ''}
                ${responseData.distanceKm ? `
                  <div><strong>Odległość:</strong> ${responseData.distanceKm} km</div>
                ` : ''}
                ${responseData.pricePerKm ? `
                  <div><strong>Cena za km:</strong> ${responseData.pricePerKm} PLN/km</div>
                ` : ''}
                ${responseData.adminNotes ? `
                  <div style="margin-top: 10px;"><strong>Uwagi:</strong> ${responseData.adminNotes}</div>
                ` : ''}
              </div>

              ${spedycjaData.responsible_person ? `
              <div class="info-row">
                <span class="label">Osoba odpowiedzialna:</span>
                <span class="value">${spedycjaData.responsible_person}</span>
              </div>
              ` : ''}

              ${spedycjaData.mpk ? `
              <div class="info-row">
                <span class="label">MPK:</span>
                <span class="value">${spedycjaData.mpk}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>To powiadomienie zostało wygenerowane automatycznie przez System Transportowy.</p>
              <p>Zaloguj się do systemu, aby zobaczyć pełne szczegóły zlecenia.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: recipient,
      subject: `💬 Odpowiedź na zlecenie spedycyjne - ${spedycjaData.order_number || 'Nr ' + spedycjaData.id}`,
      html: emailHtml
    };

    console.log('📧 Wysyłanie powiadomienia o odpowiedzi na spedycję do:', recipient);
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Powiadomienie wysłane:', info.messageId);
    return {
      success: true,
      message: `Powiadomienie wysłane do zleceniodawcy`,
      messageId: info.messageId,
      recipient: recipient
    };

  } catch (error) {
    console.error('❌ Błąd wysyłania powiadomienia o odpowiedzi na spedycję:', error);
    return {
      success: false,
      message: 'Błąd wysyłania powiadomienia: ' + error.message
    };
  }
};

// Pobieranie wszystkich spedycji
export async function GET(request) {
  try {
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const user = session.user;
    const canView = user.isAdmin || user.permissions?.spedycja?.view !== false;

    if (!canView) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do przeglądania zleceń spedycji'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

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
        table.boolean('order_sent').defaultTo(false);
        table.timestamp('order_sent_at');
        table.string('order_sent_by');
        table.string('order_recipient');
        table.text('order_data');
        table.string('client_name');
        table.text('goods_description');
        table.text('responsible_constructions');
        table.text('merged_transports');
      });
    }

    let query = db('spedycje');

    if (status === 'new') {
      // Aktywne zlecenia spedycji: nowe oraz te, na które już udzielono odpowiedzi (ale nie zakończone)
      query = query.whereIn('status', ['new', 'responded']);
    } else if (status) {
      query = query.where('status', status);
    }

    query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');

    const spedycje = await query;

    const processedData = spedycje.map(item => {
      try {
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
        responsibleConstructions: item.responsible_constructions,
        orderSent: item.order_sent,
        orderSentAt: item.order_sent_at,
        orderSentBy: item.order_sent_by,
        orderRecipient: item.order_recipient,
        orderData: item.order_data,
        mergedTransports: item.merged_transports,
        sourceClientName: item.source_client_name
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

// Dodawanie nowej spedycji
export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const user = session.user;
    const canAdd = user.isAdmin || user.permissions?.spedycja?.add === true;

    if (!canAdd) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do dodawania zleceń spedycji'
      }, { status: 403 });
    }

    const spedycjaData = await request.json();
    const userId = user.email;
    const creatorName = user.name || spedycjaData.createdBy || userId.split('@')[0];

    const currentDate = new Date();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear();

    const { formattedOrderNumber } = await getNextSpedycjaOrderNumber(db, month, year);

    let goodsDescriptionJson = null;
    if (spedycjaData.goodsDescription) {
      goodsDescriptionJson = JSON.stringify(spedycjaData.goodsDescription);
    }

    let responsibleConstructionsJson = null;
    if (spedycjaData.responsibleConstructions && spedycjaData.responsibleConstructions.length > 0) {
      responsibleConstructionsJson = JSON.stringify(spedycjaData.responsibleConstructions);
    }

    const dataToSave = {
      status: 'new',
      order_number: formattedOrderNumber,
      created_by: creatorName,
      created_by_email: userId,
      responsible_person: spedycjaData.responsiblePerson || creatorName,
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
      client_name: spedycjaData.clientName || '',
      source_client_name: spedycjaData.sourceClientName || '',
      goods_description: goodsDescriptionJson,
      responsible_constructions: responsibleConstructionsJson,
      created_at: db.fn.now()
    };

    console.log('Dane do zapisania w bazie:', dataToSave);

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
        table.boolean('order_sent').defaultTo(false);
        table.timestamp('order_sent_at');
        table.string('order_sent_by');
        table.string('order_recipient');
        table.text('order_data');
        table.string('client_name');
        table.string('source_client_name');
        table.text('goods_description');
        table.text('responsible_constructions');
        table.text('merged_transports');
      });
    } else {
      // Sprawdź czy nowa kolumna istnieje i dodaj ją jeśli nie
      const hasSourceClientName = await db.schema.hasColumn('spedycje', 'source_client_name');
      if (!hasSourceClientName) {
        await db.schema.alterTable('spedycje', table => {
          table.string('source_client_name');
        });
        console.log('Dodano brakującą kolumnę source_client_name do tabeli spedycje');
      }
    }

    const result = await db('spedycje').insert(dataToSave).returning('id');
    const id = result[0]?.id;

    return NextResponse.json({
      success: true,
      id: id,
      orderNumber: formattedOrderNumber
    });
  } catch (error) {
    console.error('Error creating spedycja:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Funkcja automatycznego uzupełniania odpowiedzi w połączonych transportach
const createResponsesForConnectedTransports = async (connectedTransports, mainResponseData, mainTransport = null) => {
  console.log('Tworzenie odpowiedzi dla połączonych transportów:', connectedTransports);

  let mainStartCity = '';
  if (mainTransport?.location === 'Odbiory własne') {
    let city = '';
    if (mainTransport.location_data) {
      try {
        const loc = typeof mainTransport.location_data === 'string' ? JSON.parse(mainTransport.location_data) : mainTransport.location_data;
        city = loc?.city || '';
      } catch (e) { }
    }
    const company = mainTransport.source_client_name || '';
    if (company && city) {
      mainStartCity = `${company} (${city})`;
    } else {
      mainStartCity = company || city || 'Odbiory własne';
    }
  } else if (mainTransport?.location) {
    mainStartCity = mainTransport.location.replace('Magazyn ', '');
  }

  let mainDeliveryCity = '';
  if (mainTransport?.delivery_data) {
    try {
      const del = typeof mainTransport.delivery_data === 'string' ? JSON.parse(mainTransport.delivery_data) : mainTransport.delivery_data;
      mainDeliveryCity = del?.city || '';
    } catch (e) { }
  }

  const mainRoute = mainStartCity && mainDeliveryCity ? `${mainStartCity} → ${mainDeliveryCity}` : (mainTransport?.location || '');

  for (const connectedTransport of connectedTransports) {
    try {
      const currentTransport = await db('spedycje')
        .where('id', connectedTransport.id)
        .first();

      if (!currentTransport) {
        console.error(`Transport o ID ${connectedTransport.id} nie istnieje`);
        continue;
      }

      if (currentTransport.response_data && currentTransport.response_data !== 'null' && currentTransport.response_data !== '{}') {
        let existingResp = null;
        try {
          existingResp = typeof currentTransport.response_data === 'string'
            ? JSON.parse(currentTransport.response_data)
            : currentTransport.response_data;
        } catch (e) {}

        // Jeśli to inna odpowiedź ręczna lub z innego transportu, nie nadpisujemy
        if (existingResp && !existingResp.autoGenerated && String(existingResp.sourceTransportId) !== String(mainResponseData.sourceTransportId)) {
          console.log(`Transport ${connectedTransport.id} już ma inną odpowiedź ręczną, pomijam`);
          continue;
        }
      }

      const connectedResponseData = {
        driverName: mainResponseData.driverName,
        driverSurname: mainResponseData.driverSurname,
        driverPhone: mainResponseData.driverPhone,
        vehicleNumber: mainResponseData.vehicleNumber,
        transportType: mainResponseData.transportType,
        deliveryPrice: mainResponseData.costPerTransport,
        totalDeliveryPrice: mainResponseData.totalDeliveryPrice || mainResponseData.deliveryPrice,
        costPerTransport: mainResponseData.costPerTransport,
        totalDistance: mainResponseData.totalDistance || mainResponseData.distanceKm || null,
        connectedRoute: mainResponseData.connectedRoute || null,
        routePoints: mainResponseData.routePoints || null,
        distanceKm: currentTransport.distance_km || 0,
        pricePerKm: (mainResponseData.totalDistance || currentTransport.distance_km) > 0 ?
          (mainResponseData.costPerTransport / (mainResponseData.totalDistance || currentTransport.distance_km)).toFixed(2) : 0,
        adminNotes: mainResponseData.adminNotes || '',
        autoGenerated: true,
        sourceTransportId: mainResponseData.sourceTransportId || null,
        mainTransportId: mainResponseData.sourceTransportId || null,
        mainTransportOrderNumber: mainTransport?.order_number || null,
        mainTransportRoute: mainRoute,
        mainTransportMpk: mainTransport?.mpk || null,
        mainTransportDistanceKm: mainTransport?.distance_km || 0,
        mainTransportTotalDistance: mainResponseData.totalDistance || mainResponseData.distanceKm || null,
        connectedTransports: mainResponseData.connectedTransports || [],
        connectedFrom: `Transport ID: ${mainResponseData.sourceTransportId || 'Główny'}`
      };

      if (mainResponseData.dateChanged) {
        connectedResponseData.newDeliveryDate = mainResponseData.newDeliveryDate;
        connectedResponseData.originalDeliveryDate = currentTransport.delivery_date;
        connectedResponseData.dateChanged = true;
      }

      console.log(`Zapisuję odpowiedź dla transportu ${connectedTransport.id}:`, connectedResponseData);

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

// Aktualizacja spedycji (odpowiedź) - Z POWIADOMIENIAMI EMAIL
export async function PUT(request) {
  try {
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const user = session.user;
    const canRespondToSpedycja = user.isAdmin || user.permissions?.spedycja?.respond === true;

    if (!canRespondToSpedycja) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do odpowiadania na zlecenia spedycji'
      }, { status: 403 });
    }

    const { id, ...data } = await request.json();
    console.log('Otrzymane dane odpowiedzi:', { id, ...data });

    const prevSpedycja = await db('spedycje').where('id', id).first();
    if (!prevSpedycja) {
      return NextResponse.json({
        success: false,
        error: 'Nie znaleziono zlecenia spedycji o podanym ID'
      }, { status: 404 });
    }

    // Sprawdź, czy były wcześniej połączone transporty, które teraz zostały usunięte
    if (prevSpedycja.response_data) {
      try {
        const prevResp = typeof prevSpedycja.response_data === 'string'
          ? JSON.parse(prevSpedycja.response_data)
          : prevSpedycja.response_data;
        const prevConnectedIds = (prevResp?.connectedTransports || []).map(ct => String(ct.id));
        const newConnectedIds = (data.connectedTransports || []).map(ct => String(ct.id));
        const removedIds = prevConnectedIds.filter(pid => !newConnectedIds.includes(pid));

        for (const remId of removedIds) {
          const remTransport = await db('spedycje').where('id', remId).first();
          if (remTransport?.response_data) {
            const remResp = typeof remTransport.response_data === 'string'
              ? JSON.parse(remTransport.response_data)
              : remTransport.response_data;
            if (remResp?.autoGenerated && String(remResp.sourceTransportId) === String(id)) {
              await db('spedycje').where('id', remId).update({ response_data: null });
              console.log(`Wyczyszczono odpowiedź dla odłączonego transportu ${remId}`);
            }
          }
        }
      } catch (e) {
        console.error('Błąd czyszczenia odłączonych transportów:', e);
      }
    }

    const responseData = {
      ...data,
      sourceTransportId: id
    };

    const updateData = {
      response_data: JSON.stringify(responseData)
    };

    if (data.totalDistance) {
      updateData.distance_km = data.totalDistance;
    } else if (data.distanceKm) {
      updateData.distance_km = data.distanceKm;
    }

    console.log('Dane odpowiedzi do zapisania:', updateData);

    const updated = await db('spedycje')
      .where('id', id)
      .update(updateData);

    if (updated === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nie znaleziono zlecenia spedycji o podanym ID'
      }, { status: 404 });
    }

    // POBIERZ PEŁNE DANE SPEDYCJI DO POWIADOMIENIA
    const updatedSpedycja = await db('spedycje')
      .where('id', id)
      .first();

    if (data.connectedTransports && data.connectedTransports.length > 0) {
      console.log('Wykryto połączone transporty, tworzę automatyczne odpowiedzi...');
      await createResponsesForConnectedTransports(data.connectedTransports, responseData, updatedSpedycja);
    }

    // WYSYŁKA POWIADOMIENIA EMAIL DO ZLECENIODAWCY
    console.log('📮 Wysyłanie powiadomienia email o odpowiedzi na spedycję...');
    const emailResult = await sendResponseNotification(updatedSpedycja, responseData);
    console.log('📬 Wynik wysyłki emaila:', emailResult.message);

    return NextResponse.json({
      success: true,
      message: data.connectedTransports?.length > 0
        ? `Odpowiedź zapisana i automatycznie dodana do ${data.connectedTransports.length} połączonych transportów`
        : 'Odpowiedź została pomyślnie zapisana',
      emailNotification: emailResult
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
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const user = session.user;
    const canDelete = user.isAdmin || user.permissions?.archive?.delete === true;

    if (!canDelete) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do usuwania zleceń spedycji'
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