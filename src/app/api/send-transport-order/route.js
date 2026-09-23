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

  const resolveWarehouseAddress = (str) => {
    if (!str) return null;
    const s = String(str).toLowerCase();
    if (s.includes('białystok') || s.includes('bialystok')) {
      return 'ul. Wysockiego 69B, 15-169 Białystok';
    }
    if (s.includes('zielonka')) {
      return 'ul. Krótka 2, 05-220 Zielonka';
    }
    return null;
  };

  // Zbuduj ujednolicony harmonogram przystanków w ustalonej kolejności
  let stopsList = [];

  if (stops && stops.length > 0) {
    stopsList = stops.map(s => {
      const isLoad = s.type === 'załadunek' || s.pointType === 'loading';
      const client = s.clientName || (isLoad ? (spedycja.source_client_name || (spedycja.location?.includes('Magazyn') ? spedycja.location : 'Grupa Eltron Sp. z o.o.')) : (spedycja.client_name || 'Nie podano'));
      
      let addr = s.address;
      const wh = resolveWarehouseAddress(client) || resolveWarehouseAddress(addr) || resolveWarehouseAddress(s.city) || (isLoad && s.isMain ? resolveWarehouseAddress(spedycja.location) : null);
      if (wh && (!addr || addr.includes('Magazyn') || addr === 'Białystok' || addr === 'Zielonka' || !addr.includes('ul.'))) {
        addr = wh;
      }
      if (!addr) {
        addr = isLoad ? (resolveWarehouseAddress(spedycja.location) || formatAddress(producerAddress)) : formatAddress(delivery);
      }

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
      : (resolveWarehouseAddress(spedycja.location) || (spedycja.location === 'Magazyn Białystok' ? 'ul. Wysockiego 69B, 15-169 Białystok' : (spedycja.location === 'Magazyn Zielonka' ? 'ul. Krótka 2, 05-220 Zielonka' : (spedycja.location || 'Brak danych'))));

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
          const wh = resolveWarehouseAddress(p.location) || resolveWarehouseAddress(p.sourceClientName);
          addr = wh || (p.location === 'Odbiory własne' ? formatAddress(p.producerAddress) : (p.location || formatAddress(p.address)));
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
          margin: 0;
          padding: 0;
          background-color: #f1f5f9;
          font-family: Arial, Helvetica, sans-serif;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        table {
          border-collapse: collapse;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }
        @media only screen and (max-width: 700px) {
          .email-container {
            width: 100% !important;
            max-width: 100% !important;
          }
          .responsive-col {
            width: 100% !important;
            display: block !important;
          }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: Arial, Helvetica, sans-serif; color: #1e293b;">
      <!-- Główny wrapper zewnętrzny centrujący całość -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 24px 10px; table-layout: fixed;">
        <tr>
          <td align="center" valign="top">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellspacing="0" cellpadding="0" width="680">
            <tr>
            <td align="center" valign="top" width="680">
            <![endif]-->
            
            <!-- Centrowana karta zlecenia o stałej szerokości max 680px -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="680" class="email-container" align="center" style="width: 680px; max-width: 680px; background-color: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); overflow: hidden; margin: 0 auto; text-align: left;">
              
              <!-- NAGŁÓWEK -->
              <tr>
                <td style="background-color: #1e3a8a; padding: 22px 28px; color: #ffffff;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #93c5fd;">
                        Grupa Eltron Sp. z o.o.
                      </td>
                      <td align="right" style="font-size: 12px; color: #bfdbfe;">
                        Wystawiono: ${formatDate(new Date().toISOString())}
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top: 10px;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #ffffff; letter-spacing: -0.3px;">ZLECENIE TRANSPORTOWE</h1>
                        <div style="font-size: 13px; color: #dbeafe; margin-top: 4px;">
                          Nr ewidencyjny: <strong style="color: #ffffff; font-size: 14px;">${orderNum}</strong> &nbsp;|&nbsp; Status: <strong>Potwierdzone</strong>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- WAŻNY KOMUNIKAT DLA PRZEWOŹNIKA (FAKTURA + MPK + NR ZLECENIA) -->
              <tr>
                <td style="padding: 20px 24px 8px 24px;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 6px solid #2563eb; border-radius: 6px;">
                    <tr>
                      <td style="padding: 14px 16px;">
                        <div style="font-size: 13px; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                          📌 Ważna informacja dla przewoźnika dotycząca faktury
                        </div>
                        <div style="font-size: 13px; color: #1e3a8a; line-height: 1.5; margin-bottom: 10px;">
                          Proszę o dopisanie na fakturze zamieszczonego poniżej numeru MPK: <strong>${spedycja.mpk || '-'}</strong> oraz numeru zlecenia: <strong>${orderNum}</strong>.
                        </div>
                        <!-- Czerwone ostrzeżenie -->
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border: 1px solid #f87171; border-radius: 4px;">
                          <tr>
                            <td style="padding: 10px 14px; color: #991b1b; font-size: 13px; font-weight: bold; line-height: 1.4;">
                              ⚠️ UWAGA! Na fakturze musi być podany numer zlecenia: ${orderNum}.<br>
                              Faktury bez numeru zlecenia nie będą opłacane.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- GŁÓWNA ZAWARTOŚĆ -->
              <tr>
                <td style="padding: 12px 24px 24px 24px;">
                  
                  <!-- PARAMETRY ZLECENIA -->
                  <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.75px; color: #475569; margin-bottom: 8px;">
                    Parametry i warunki zlecenia
                  </div>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 22px; overflow: hidden;">
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td width="180" style="width: 180px; background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Numer zlecenia:</td>
                      <td style="padding: 8px 12px; font-size: 13px; color: #1e40af; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${orderNum}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Numer MPK:</td>
                      <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${spedycja.mpk || 'Nie podano'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Stawka transportu:</td>
                      <td style="padding: 8px 12px; font-size: 14px; color: #047857; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${deliveryPriceFormatted}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Termin płatności:</td>
                      <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${terminPlatnosci || '14 dni'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Rodzaj towaru:</td>
                      <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${towar || 'Materiały i towary handlowe'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Waga całkowita:</td>
                      <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${waga ? `${waga} kg` : 'Nie podano'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Wymagany pojazd:</td>
                      <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${responseData.transportType || 'Standard'}</td>
                    </tr>
                    <tr>
                      <td style="background-color: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748b;">Wymagane dokumenty:</td>
                      <td style="padding: 8px 12px; font-size: 13px; color: #0f172a;">${spedycja.documents || 'List przewozowy CMR / Dokument WZ'}</td>
                    </tr>
                  </table>

                  <!-- HARMONOGRAM TRASY -->
                  <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.75px; color: #475569; margin-bottom: 8px;">
                    Harmonogram trasy (${stopsList.length} ${stopsList.length === 1 ? 'przystanek' : stopsList.length < 5 ? 'przystanki' : 'przystanków'})
                  </div>
                  <div style="margin-bottom: 22px;">
                    ${stopsList.map((stop, idx) => {
                      const isLoad = stop.type === 'załadunek';
                      const headerBg = isLoad ? '#fef3c7' : '#d1fae5';
                      const headerBorder = isLoad ? '#fde68a' : '#a7f3d0';
                      const headerTextColor = isLoad ? '#92400e' : '#065f46';
                      const badgeBg = isLoad ? '#d97706' : '#059669';

                      return `
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; overflow: hidden; background-color: #ffffff;">
                          <!-- Nagłówek przystanku -->
                          <tr>
                            <td style="background-color: ${headerBg}; border-bottom: 1px solid ${headerBorder}; padding: 8px 14px;">
                              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="font-size: 12px; font-weight: bold; color: ${headerTextColor};">
                                    <span style="display: inline-block; background-color: ${badgeBg}; color: #ffffff; padding: 2px 7px; border-radius: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-right: 6px;">
                                      Przystanek ${idx + 1}
                                    </span>
                                    ${isLoad ? 'PUNKT ZAŁADUNKU' : 'PUNKT ROZŁADUNKU'}
                                  </td>
                                  <td align="right" style="font-size: 11px; color: ${headerTextColor}; opacity: 0.9;">
                                    Zlecenie: <strong>${stop.orderNumber || orderNum}</strong>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <!-- Szczegóły przystanku -->
                          <tr>
                            <td style="padding: 4px 14px 8px 14px;">
                              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td width="160" style="width: 160px; padding: 6px 0; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Klient / Firma:</td>
                                  <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${stop.clientName || 'Nie podano'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Adres:</td>
                                  <td style="padding: 6px 0; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9;">${stop.address || 'Brak danych adresowych'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">${isLoad ? 'Planowany załadunek:' : 'Planowany rozładunek:'}</td>
                                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${stop.date}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">Kontakt na miejscu:</td>
                                  <td style="padding: 6px 0; font-size: 13px; color: #1e293b;">${stop.contact || 'Nie podano'}</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      `;
                    }).join('')}
                  </div>

                  <!-- DANE KIEROWCY I POJAZDU -->
                  <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.75px; color: #475569; margin-bottom: 8px;">
                    Dane kierowcy i pojazdu
                  </div>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 22px; padding: 6px 14px;">
                    <tr>
                      <td style="padding: 6px 0;">
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td width="160" style="width: 160px; padding: 4px 0; font-size: 12px; font-weight: 600; color: #64748b;">Kierowca:</td>
                            <td style="padding: 4px 0; font-size: 13px; color: #0f172a; font-weight: bold;">
                              ${(responseData.driverName || '') + ' ' + (responseData.driverSurname || '') || 'Nie podano'}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #64748b;">Telefon do kierowcy:</td>
                            <td style="padding: 4px 0; font-size: 13px; color: #1e40af; font-weight: bold;">
                              ${responseData.driverPhone ? `<a href="tel:${responseData.driverPhone}" style="color: #1e40af; text-decoration: none;">${responseData.driverPhone}</a>` : 'Nie podano'}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #64748b;">Numer rejestracyjny:</td>
                            <td style="padding: 4px 0; font-size: 13px; color: #0f172a; font-weight: bold;">
                              ${responseData.vehicleNumber || 'Nie podano'}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- ADRES DO WYSYŁKI FAKTUR I DOKUMENTÓW -->
                  <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.75px; color: #475569; margin-bottom: 8px;">
                    Adres do wysyłki faktur i dokumentów
                  </div>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; padding: 12px 16px;">
                    <tr>
                      <td style="font-size: 13px; color: #1e293b; line-height: 1.6;">
                        <strong>Grupa Eltron Sp. z o.o.</strong><br>
                        ul. Główna 7, 18-100 Łapy<br>
                        tel. 85 715 27 05 &nbsp;|&nbsp; NIP: <strong>9662112843</strong><br>
                        E-mail do faktur: <a href="mailto:ksiegowosc@grupaeltron.pl" style="color: #2563eb; font-weight: bold; text-decoration: none;">ksiegowosc@grupaeltron.pl</a>
                      </td>
                    </tr>
                  </table>

                  ${(spedycja.notes || responseData.adminNotes) ? `
                  <!-- UWAGI -->
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; margin-bottom: 16px; padding: 12px 16px;">
                    <tr>
                      <td style="font-size: 12px; color: #92400e; line-height: 1.5;">
                        <strong style="font-size: 13px;">Uwagi i instrukcje specjalne:</strong><br>
                        ${spedycja.notes ? `• ${spedycja.notes}<br>` : ''}
                        ${responseData.adminNotes ? `• ${responseData.adminNotes}` : ''}
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                </td>
              </tr>

              <!-- STOPKA -->
              <tr>
                <td align="center" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
                  Zlecenie wygenerowane automatycznie przez System Logistyki i Spedycji Grupy Eltron.<br>
                  Wszelkie pytania prosimy kierować na adres: <a href="mailto:logistyka@grupaeltron.pl" style="color: #64748b;">logistyka@grupaeltron.pl</a>
                </td>
              </tr>

            </table>
            
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
