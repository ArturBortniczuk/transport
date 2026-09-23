// src/app/api/send-transport-order/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request) {
  try {
    // Weryfikacja sesji (zarówno SSO eltron_auth_token jak i authToken)
    const sessionResult = await getSessionUser(request);
    
    if (!sessionResult.isAuthenticated || !sessionResult.user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const user = sessionResult.user;
    const userId = user.email;

    // Sprawdź uprawnienia
    const isAdmin = Boolean(user.isAdmin || user.role === 'admin');
    const permissions = user.permissions || {};
    const canSendTransportOrder = 
      isAdmin || 
      permissions?.spedycja?.sendOrder === true;

    if (!canSendTransportOrder) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do wysyłania zlecenia spedycyjnego'
      }, { status: 403 });
    }

    // Pobierz dane z żądania, dodaj obsługę stops i additionalPlaces
    const {
      spedycjaId,
      towar,
      terminPlatnosci,
      waga,
      dataZaladunku,
      dataRozladunku,
      emailOdbiorcy,
      stops = [],
      additionalPlaces = []
    } = await request.json();

    // Pobierz dane spedycji
    const spedycja = await db('spedycje')
      .where('id', spedycjaId)
      .select('*')  // Pobieramy wszystkie pola
      .first();

    if (!spedycja) {
      return NextResponse.json({
        success: false,
        error: 'Nie znaleziono zlecenia spedycji'
      }, { status: 404 });
    }

    // Parsowanie danych JSON
    let producerAddress = {};
    let delivery = {};
    let responseData = {};

    try {
      if (spedycja.location_data) {
        producerAddress = JSON.parse(spedycja.location_data);
      }
      if (spedycja.delivery_data) {
        delivery = JSON.parse(spedycja.delivery_data);
      }
      if (spedycja.response_data) {
        responseData = JSON.parse(spedycja.response_data);
      }
    } catch (error) {
      console.error('Błąd parsowania danych JSON:', error);
    }

    // Jeśli są dodatkowe miejsca, pobierz dane dla nich (z deduplikacją)
    const additionalPlacesData = [];

    if (additionalPlaces && additionalPlaces.length > 0) {
      // Deduplikacja: nie pozwól na ten sam transportId i ten sam type punktu
      const seenPlaceKeys = new Set();
      const uniquePlaces = additionalPlaces.filter(place => {
        const key = `${place.transportId || place.orderNumber || place.route}-${place.type}`;
        if (seenPlaceKeys.has(key)) return false;
        seenPlaceKeys.add(key);
        return true;
      });

      for (const place of uniquePlaces) {
        // Pobierz dane spedycji dla dodatkowego miejsca
        if (place.transportId) {
          try {
            const additionalSpedycja = await db('spedycje')
              .where('id', place.transportId)
              .first();

            if (additionalSpedycja) {
              // Parsuj dane JSON
              let additionalProducerAddress = {};
              let additionalDelivery = {};

              try {
                if (additionalSpedycja.location_data) {
                  additionalProducerAddress = JSON.parse(additionalSpedycja.location_data);
                }
                if (additionalSpedycja.delivery_data) {
                  additionalDelivery = JSON.parse(additionalSpedycja.delivery_data);
                }
              } catch (error) {
                console.error('Błąd parsowania danych JSON dla dodatkowego miejsca:', error);
              }

              // Uzupełnij dane miejsca
              additionalPlacesData.push({
                type: place.type,
                transportId: place.transportId,
                orderNumber: additionalSpedycja.order_number || `${additionalSpedycja.id}`,
                location: additionalSpedycja.location,
                sourceClientName: additionalSpedycja.source_client_name || place.sourceClientName || '',
                producerAddress: additionalProducerAddress,
                delivery: additionalDelivery,
                loadingContact: additionalSpedycja.loading_contact,
                unloadingContact: additionalSpedycja.unloading_contact,
                route: place.route
              });
            }
          } catch (error) {
            console.error(`Błąd pobierania danych dla dodatkowego miejsca ID=${place.transportId}:`, error);
          }
        } else {
          // Jeśli nie ma transportId, dodaj miejsce bez dodatkowych danych
          additionalPlacesData.push(place);
        }
      }
    }

    // Tworzenie HTML zamówienia
    const htmlContent = generateTransportOrderHTML({
      spedycja,
      producerAddress,
      delivery,
      responseData,
      user,
      additionalData: {
        towar,
        terminPlatnosci,
        waga,
        dataZaladunku,
        dataRozladunku,
        stops,
        additionalPlaces: additionalPlacesData
      }
    });

    // Konfiguracja transportera mailowego
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: "logistyka@grupaeltron.pl", // Hardcoded - zawsze ten sam adres
        pass: process.env.SMTP_PASSWORD
      }
    });

    // Wysyłanie maila
    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: emailOdbiorcy,
      cc: user.email, // Opcjonalnie dodaj użytkownika inicjującego wysyłkę w kopii
      subject: `Zlecenie spedycyjne nr ${spedycja.order_number || spedycja.id}`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);

    // Zapisz informacje o wysłanym zleceniu
    await db('spedycje')
      .where('id', spedycjaId)
      .update({
        order_sent: true,
        order_sent_at: db.fn.now(),
        order_sent_by: userId,
        order_recipient: emailOdbiorcy,
        order_data: JSON.stringify({
          towar,
          terminPlatnosci,
          waga,
          dataZaladunku,
          dataRozladunku,
          stops,
          additionalPlaces: additionalPlacesData.map(place => ({
            type: place.type,
            transportId: place.transportId,
            orderNumber: place.orderNumber,
            route: place.route
          }))
        })
      });

    return NextResponse.json({
      success: true,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending transport order:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Funkcja generująca elegancki, ustrukturyzowany HTML zamówienia dla przewoźnika
function generateTransportOrderHTML({ spedycja, producerAddress, delivery, responseData, user, additionalData }) {
  const { towar, terminPlatnosci, waga, dataZaladunku, dataRozladunku, stops = [], additionalPlaces = [] } = additionalData;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAddress = (address) => {
    if (!address) return 'Brak danych';
    if (typeof address === 'string') return address;
    const parts = [
      address.street,
      address.postalCode,
      address.city
    ].filter(Boolean);
    return parts.join(', ') || 'Brak danych';
  };

  const formatPrice = (price) => {
    if (!price) return 'Do uzgodnienia';
    return `${price} PLN Netto`;
  };

  // Zbuduj ujednolicony harmonogram przystanków w ustalonej kolejności
  let stopsList = [];

  if (stops && stops.length > 0) {
    stopsList = stops.map(s => {
      const isLoad = s.type === 'załadunek' || s.pointType === 'loading';
      const client = s.clientName || (isLoad ? (spedycja.source_client_name || (spedycja.location?.includes('Magazyn') ? spedycja.location : 'Grupa Eltron Sp. z o.o.')) : (spedycja.client_name || 'Nie podano'));
      const addr = s.address || (isLoad ? formatAddress(producerAddress) : formatAddress(delivery));
      const contact = s.contact || (isLoad ? spedycja.loading_contact : spedycja.unloading_contact) || 'Nie podano';
      const date = isLoad ? (dataZaladunku ? formatDate(dataZaladunku) : 'Zgodnie z ustaleniami') : (dataRozladunku ? formatDate(dataRozladunku) : 'Zgodnie z ustaleniami');

      return {
        type: isLoad ? 'załadunek' : 'rozładunek',
        orderNumber: s.orderNumber || spedycja.order_number || spedycja.id,
        clientName: client,
        city: s.city || '',
        address: addr,
        contact: contact,
        date: date,
        isMain: s.isMain
      };
    });
  } else {
    // Układ domyślny
    const mainLoadClient = spedycja.source_client_name || (spedycja.location?.includes('Magazyn') ? spedycja.location : 'Grupa Eltron Sp. z o.o.');
    const mainLoadAddr = spedycja.location === 'Odbiory własne'
      ? formatAddress(producerAddress)
      : (spedycja.location === 'Magazyn Białystok' ? 'ul. Wysockiego 69B, 15-169 Białystok' : (spedycja.location === 'Magazyn Zielonka' ? 'ul. Krótka 2, 05-220 Zielonka' : (spedycja.location || 'Brak danych')));

    stopsList.push({
      type: 'załadunek',
      orderNumber: spedycja.order_number || spedycja.id,
      clientName: mainLoadClient,
      city: producerAddress?.city || '',
      address: mainLoadAddr,
      contact: spedycja.loading_contact || 'Nie podano',
      date: dataZaladunku ? formatDate(dataZaladunku) : 'Zgodnie z ustaleniami',
      isMain: true
    });

    stopsList.push({
      type: 'rozładunek',
      orderNumber: spedycja.order_number || spedycja.id,
      clientName: spedycja.client_name || 'Nie podano',
      city: delivery?.city || '',
      address: formatAddress(delivery),
      contact: spedycja.unloading_contact || 'Nie podano',
      date: dataRozladunku ? formatDate(dataRozladunku) : 'Zgodnie z ustaleniami',
      isMain: true
    });

    if (additionalPlaces && additionalPlaces.length > 0) {
      additionalPlaces.forEach(p => {
        const isLoad = p.type === 'załadunek';
        const client = isLoad
          ? (p.sourceClientName || p.source_client_name || 'Grupa Eltron Sp. z o.o.')
          : (p.clientName || p.client_name || 'Nie podano');
        let addr = 'Brak danych';
        if (isLoad) {
          addr = p.location === 'Odbiory własne' ? formatAddress(p.producerAddress) : (p.location || formatAddress(p.address));
        } else {
          addr = formatAddress(p.delivery || p.address);
        }

        stopsList.push({
          type: p.type,
          orderNumber: p.orderNumber || '',
          clientName: client,
          city: (isLoad ? p.producerAddress?.city : p.delivery?.city) || '',
          address: addr,
          contact: (isLoad ? (p.loadingContact || p.contact) : (p.unloadingContact || p.contact)) || 'Nie podano',
          date: isLoad ? (dataZaladunku ? formatDate(dataZaladunku) : 'Zgodnie z ustaleniami') : (dataRozladunku ? formatDate(dataRozladunku) : 'Zgodnie z ustaleniami'),
          isMain: false
        });
      });
    }
  }

  const orderNum = spedycja.order_number || spedycja.id;
  const deliveryPriceFormatted = (responseData.totalDeliveryPrice || responseData.deliveryPrice)
    ? formatPrice(responseData.totalDeliveryPrice || responseData.deliveryPrice)
    : 'Do uzgodnienia';

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zlecenie Transportowe nr ${orderNum}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color: #1e293b;
          background-color: #f1f5f9;
          margin: 0;
          padding: 24px 12px;
        }
        .container {
          max-width: 720px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .header {
          background-color: #1e40af;
          color: #ffffff;
          padding: 24px;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 12px;
          margin-bottom: 12px;
        }
        .company-name {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #93c5fd;
        }
        .order-date {
          font-size: 12px;
          color: #bfdbfe;
        }
        .order-title {
          font-size: 22px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .order-sub {
          font-size: 13px;
          color: #dbeafe;
          margin-top: 4px;
        }
        .content {
          padding: 24px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.75px;
          color: #475569;
          margin: 0 0 12px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .params-grid {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          overflow: hidden;
        }
        .params-grid th {
          background-color: #f8fafc;
          text-align: left;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          width: 35%;
        }
        .params-grid td {
          padding: 9px 12px;
          font-size: 13px;
          color: #0f172a;
          border-bottom: 1px solid #e2e8f0;
        }
        .params-grid tr:last-child th,
        .params-grid tr:last-child td {
          border-bottom: none;
        }
        .stops-container {
          margin-bottom: 24px;
        }
        .stop-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          margin-bottom: 12px;
          overflow: hidden;
          background-color: #ffffff;
        }
        .stop-header {
          padding: 8px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
        }
        .stop-header-load {
          background-color: #fef3c7;
          color: #92400e;
          border-bottom: 1px solid #fde68a;
        }
        .stop-header-unload {
          background-color: #d1fae5;
          color: #065f46;
          border-bottom: 1px solid #a7f3d0;
        }
        .stop-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .badge-load {
          background-color: #d97706;
          color: #ffffff;
        }
        .badge-unload {
          background-color: #059669;
          color: #ffffff;
        }
        .stop-table {
          width: 100%;
          border-collapse: collapse;
        }
        .stop-table th {
          text-align: left;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          width: 32%;
          border-bottom: 1px solid #f1f5f9;
        }
        .stop-table td {
          padding: 8px 14px;
          font-size: 13px;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
        }
        .stop-table tr:last-child th,
        .stop-table tr:last-child td {
          border-bottom: none;
        }
        .client-highlight {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }
        .billing-box {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          border-left: 4px solid #2563eb;
          padding: 14px 16px;
          border-radius: 6px;
          margin-bottom: 24px;
        }
        .billing-title {
          font-size: 13px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 6px;
        }
        .billing-text {
          font-size: 12px;
          color: #1e3a8a;
          margin: 0;
          line-height: 1.6;
        }
        .driver-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 24px;
        }
        .notes-box {
          background-color: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 24px;
          font-size: 12px;
          color: #92400e;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding: 16px;
          background-color: #f8fafc;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-top">
            <span class="company-name">Grupa Eltron Sp. z o.o.</span>
            <span class="order-date">Wystawiono: ${formatDate(new Date().toISOString())}</span>
          </div>
          <h1 class="order-title">ZLECENIE TRANSPORTOWE</h1>
          <div class="order-sub">Nr ewidencyjny: <strong>${orderNum}</strong> | Status: Potwierdzone</div>
        </div>

        <div class="content">
          <!-- Parametry zlecenia -->
          <div class="section-title">Parametry i warunki zlecenia</div>
          <table class="params-grid">
            <tr>
              <th>Numer zlecenia:</th>
              <td><strong style="color: #1e40af;">${orderNum}</strong></td>
            </tr>
            <tr>
              <th>Numer MPK:</th>
              <td><strong>${spedycja.mpk || 'Nie podano'}</strong></td>
            </tr>
            <tr>
              <th>Stawka transportu:</th>
              <td><strong style="font-size: 14px; color: #047857;">${deliveryPriceFormatted}</strong></td>
            </tr>
            <tr>
              <th>Termin płatności:</th>
              <td>${terminPlatnosci || '14 dni'}</td>
            </tr>
            <tr>
              <th>Rodzaj towaru:</th>
              <td>${towar || 'Materiały i towary handlowe'}</td>
            </tr>
            <tr>
              <th>Waga całkowita:</th>
              <td>${waga ? `${waga} kg` : 'Nie podano'}</td>
            </tr>
            <tr>
              <th>Wymagany pojazd:</th>
              <td>${responseData.transportType || 'Standard'}</td>
            </tr>
            <tr>
              <th>Wymagane dokumenty:</th>
              <td>${spedycja.documents || 'List przewozowy CMR / Dokument WZ'}</td>
            </tr>
          </table>

          <!-- Harmonogram trasy punkt po punkcie -->
          <div class="section-title">Harmonogram trasy (${stopsList.length} ${stopsList.length === 1 ? 'przystanek' : stopsList.length < 5 ? 'przystanki' : 'przystanków'})</div>
          <div class="stops-container">
            ${stopsList.map((stop, idx) => {
              const isLoad = stop.type === 'załadunek';
              return `
                <div class="stop-card">
                  <div class="stop-header ${isLoad ? 'stop-header-load' : 'stop-header-unload'}">
                    <span>
                      <span class="stop-badge ${isLoad ? 'badge-load' : 'badge-unload'}">
                        Przystanek ${idx + 1}
                      </span>
                      &nbsp; ${isLoad ? 'PUNKT ZAŁADUNKU' : 'PUNKT ROZŁADUNKU'}
                    </span>
                    <span style="font-size: 11px; font-weight: normal; opacity: 0.85;">
                      Zlecenie: ${stop.orderNumber || orderNum}
                    </span>
                  </div>
                  <table class="stop-table">
                    <tr>
                      <th>Klient / Firma:</th>
                      <td class="client-highlight">${stop.clientName || 'Nie podano'}</td>
                    </tr>
                    <tr>
                      <th>Adres:</th>
                      <td>${stop.address || 'Brak danych adresowych'}</td>
                    </tr>
                    <tr>
                      <th>${isLoad ? 'Planowany załadunek:' : 'Planowany rozładunek:'}</th>
                      <td><strong>${stop.date}</strong></td>
                    </tr>
                    <tr>
                      <th>Kontakt na miejscu:</th>
                      <td>${stop.contact || 'Nie podano'}</td>
                    </tr>
                  </table>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Dane przewoźnika i pojazdu -->
          <div class="section-title">Dane kierowcy i pojazdu</div>
          <div class="driver-box">
            <table class="stop-table">
              <tr>
                <th>Kierowca:</th>
                <td><strong>${(responseData.driverName || '') + ' ' + (responseData.driverSurname || '') || 'Nie podano'}</strong></td>
              </tr>
              <tr>
                <th>Telefon do kierowcy:</th>
                <td>${responseData.driverPhone ? `<a href="tel:${responseData.driverPhone}" style="color: #1e40af; text-decoration: none; font-weight: bold;">${responseData.driverPhone}</a>` : 'Nie podano'}</td>
              </tr>
              <tr>
                <th>Numer rejestracyjny:</th>
                <td><strong>${responseData.vehicleNumber || 'Nie podano'}</strong></td>
              </tr>
            </table>
          </div>

          <!-- Instrukcje do faktury -->
          <div class="billing-box">
            <div class="billing-title">Wytyczne do wystawienia faktury VAT:</div>
            <p class="billing-text">
              1. Na fakturze <strong>wymagane jest podanie numeru zlecenia: ${orderNum}</strong> oraz <strong>MPK: ${spedycja.mpk || '-'}</strong>.<br>
              2. Prawidłowo wystawioną e-fakturę wraz z potwierdzonymi dokumentami WZ/CMR prosimy przesłać na adres: <strong>ksiegowosc@grupaeltron.pl</strong>.<br>
              3. Dane nabywcy: <strong>Grupa Eltron Sp. z o.o.</strong>, ul. Główna 7, 18-100 Łapy, NIP: <strong>9662112843</strong>.
            </p>
          </div>

          ${(spedycja.notes || responseData.adminNotes) ? `
          <div class="notes-box">
            <strong>Uwagi i instrukcje specjalne:</strong><br>
            ${spedycja.notes ? `• ${spedycja.notes}<br>` : ''}
            ${responseData.adminNotes ? `• ${responseData.adminNotes}` : ''}
          </div>
          ` : ''}
        </div>

        <div class="footer">
          Zlecenie wygenerowane automatycznie przez System Logistyki i Spedycji Grupy Eltron. Wszelkie pytania prosimy kierować na logistyka@grupaeltron.pl.
        </div>
      </div>
    </body>
    </html>
  `;
}
