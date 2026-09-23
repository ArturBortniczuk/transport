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

  const paymentTermsFormatted = terminPlatnosci
    ? (terminPlatnosci.toLowerCase().includes('doręczen') ? terminPlatnosci : `${terminPlatnosci} (od doręczenia faktury z CMR)`)
    : '14 dni (od doręczenia faktury z CMR)';

  const combinedNotes = [
    spedycja.notes ? `• ${spedycja.notes}` : '',
    responseData.adminNotes ? `• ${responseData.adminNotes}` : ''
  ].filter(Boolean).join('<br>');

  return `<!DOCTYPE html>
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
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      color: #0f172a;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    @media only screen and (max-width: 890px) {
      .document-card {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
      .responsive-cell {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
    }
    @media print {
      body, .document-wrapper {
        background-color: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
      }
      .document-card {
        width: 100% !important;
        max-width: 100% !important;
        border: 1.5px solid #1e3a8a !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .page-break-avoid {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      @page {
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0f172a;">
  
  <!-- WRAPPER ZEWNĘTRZNY -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="document-wrapper" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 20px 0;">
    <tr>
      <td align="center" valign="top">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="860">
        <tr>
        <td align="center" valign="top" width="860">
        <![endif]-->
        
        <!-- GŁÓWNA KARTA DOKUMENTU A4 (SZEROKOŚĆ 860px) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="860" class="document-card" align="center" style="width: 860px; max-width: 860px; background-color: #ffffff; border: 2px solid #1e3a8a; border-radius: 6px; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.08); overflow: hidden; margin: 0 auto; text-align: left;">
          
          <!-- GŁOWICA DOKUMENTU / OFICJALNY PAPIER FIRMOWY -->
          <tr>
            <td style="padding: 24px 30px 18px 30px; border-bottom: 2px solid #1e3a8a; background-color: #ffffff;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Lewa strona: Dane Zleceniodawcy -->
                  <td width="56%" valign="top" style="padding-right: 15px;">
                    <div style="font-size: 19px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase;">
                      GRUPA ELTRON SP. Z O.O.
                    </div>
                    <div style="font-size: 13px; font-weight: 700; color: #475569; margin-top: 3px;">
                      Dział Spedycji i Logistyki Krajowej
                    </div>
                    <div style="font-size: 12px; color: #334155; line-height: 1.5; margin-top: 6px;">
                      ul. Główna 7, 18-100 Łapy &nbsp;|&nbsp; <strong>NIP: 9662112843</strong> &nbsp;|&nbsp; REGON: 050053952<br>
                      Tel: <strong>85 715 27 05</strong> &nbsp;|&nbsp; E-mail: <a href="mailto:logistyka@grupaeltron.pl" style="color: #1e40af; text-decoration: none; font-weight: 700;">logistyka@grupaeltron.pl</a>
                    </div>
                  </td>
                  <!-- Prawa strona: Tytuł dokumentu i Numer -->
                  <td width="44%" valign="top" align="right">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
                      Miejscowość i data: <strong style="color: #0f172a;">Łapy, ${formatDate(new Date().toISOString())}</strong>
                    </div>
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 2px solid #1e3a8a; border-radius: 6px; text-align: center;">
                      <tr>
                        <td style="padding: 10px 18px;">
                          <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px;">
                            ZLECENIE TRANSPORTOWE
                          </div>
                          <div style="font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; margin-top: 2px;">
                            NR ${orderNum}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SEKCJA: KLAUZULA FAKTUROWANIA (WYMÓG BEZWZGLĘDNY) -->
          <tr>
            <td style="padding: 18px 30px 12px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0f7ff; border: 2px solid #2563eb; border-radius: 6px; overflow: hidden;">
                <tr>
                  <td style="background-color: #2563eb; color: #ffffff; padding: 8px 18px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">
                    📌 WAŻNE INSTRUKCJE DLA PRZEWOŹNIKA DOTYCZĄCE ROZLICZENIA I FAKTURY
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 13px; color: #1e293b; margin-bottom: 10px;">
                      Prosimy o <strong>bezwzględne umieszczenie na fakturze VAT</strong> następujących danych rozliczeniowych:
                    </div>
                    
                    <!-- Dwa duże kafelki rozliczeniowe na pełną szerokość -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="48%" style="background-color: #ffffff; border: 2px solid #93c5fd; border-radius: 6px; padding: 10px 14px; text-align: center;">
                          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                            OBOWIĄZKOWY NUMER ZLECENIA:
                          </div>
                          <div style="font-size: 22px; font-weight: 900; color: #1e40af; margin-top: 2px; letter-spacing: 0.5px;">
                            ${orderNum}
                          </div>
                        </td>
                        <td width="4%"></td>
                        <td width="48%" style="background-color: #ffffff; border: 2px solid #93c5fd; border-radius: 6px; padding: 10px 14px; text-align: center;">
                          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                            OBOWIĄZKOWY NUMER MPK:
                          </div>
                          <div style="font-size: 22px; font-weight: 900; color: #1e40af; margin-top: 2px; letter-spacing: 0.5px;">
                            ${spedycja.mpk || 'Nie określono'}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Pasek czerwonego ostrzeżenia -->
                    <div style="margin-top: 12px; background-color: #fef2f2; border: 1.5px solid #ef4444; border-radius: 4px; padding: 8px 14px; text-align: center;">
                      <span style="font-size: 13px; font-weight: 900; color: #991b1b;">
                        ⚠️ UWAGA! Faktury bez podanego numeru zlecenia (${orderNum}) oraz MPK nie będą opłacane!
                      </span>
                    </div>

                    <div style="margin-top: 8px; font-size: 12px; color: #475569; text-align: center;">
                      Prawidłowo wystawioną e-fakturę wraz z kompletem potwierdzonych dokumentów WZ / CMR prosimy przesyłać na adres: 
                      <a href="mailto:ksiegowosc@grupaeltron.pl" style="color: #2563eb; font-weight: 800; text-decoration: underline;">ksiegowosc@grupaeltron.pl</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SEKCJA 1: PARAMETRY HANDLOWE I WARUNKI PRZEWOZU -->
          <tr>
            <td style="padding: 10px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 6px;">
                <tr>
                  <td style="border-bottom: 2px solid #1e3a8a; padding-bottom: 4px;">
                    <span style="font-size: 14px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.8px;">
                      1. WARUNKI HANDLOWE I PARAMETRY PRZEWOZU
                    </span>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
                <!-- Wiersz 1: Stawka i Termin płatności -->
                <tr>
                  <td width="22%" style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    Stawka frachtu:
                  </td>
                  <td width="28%" style="padding: 10px 14px; font-size: 20px; font-weight: 900; color: #059669; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #cbd5e1;">
                    ${deliveryPriceFormatted}
                  </td>
                  <td width="22%" style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    Termin płatności:
                  </td>
                  <td width="28%" style="padding: 10px 14px; font-size: 15px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    ${paymentTermsFormatted}
                  </td>
                </tr>
                <!-- Wiersz 2: Towar i Waga -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    Rodzaj towaru:
                  </td>
                  <td style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #cbd5e1;">
                    ${towar || 'Materiały i towary handlowe'}
                  </td>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    Waga całkowita:
                  </td>
                  <td style="padding: 10px 14px; font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    ${waga ? `${waga} kg` : 'Zgodnie z dokumentami WZ'}
                  </td>
                </tr>
                <!-- Wiersz 3: Typ naczepy i Wymagane dokumenty -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-right: 1px solid #e2e8f0;">
                    Wymagany pojazd:
                  </td>
                  <td style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a; border-right: 1px solid #cbd5e1;">
                    ${responseData.transportType || 'Standard'}
                  </td>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-right: 1px solid #e2e8f0;">
                    Wymagane dokumenty:
                  </td>
                  <td style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a;">
                    ${spedycja.documents || 'List przewozowy CMR / Dokument WZ z pieczęcią odbiorcy'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SEKCJA 2: HARMONOGRAM TRASY (MIEJSCA ZAŁADUNKU I ROZŁADUNKU) -->
          <tr>
            <td style="padding: 10px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="border-bottom: 2px solid #1e3a8a; padding-bottom: 4px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <span style="font-size: 14px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.8px;">
                            2. HARMONOGRAM TRASY (PUNKTY ZAŁADUNKU I ROZŁADUNKU)
                          </span>
                        </td>
                        <td align="right" style="font-size: 12px; font-weight: 700; color: #64748b;">
                          Liczba przystanków: ${stopsList.length}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Pętla po przystankach w ustalonej kolejności trasy -->
              <div>
                ${stopsList.map((stop, idx) => {
                  const isLoad = stop.type === 'załadunek';
                  const badgeColor = isLoad ? '#d97706' : '#059669';
                  const barBg = isLoad ? '#fef3c7' : '#d1fae5';
                  const barTextColor = isLoad ? '#92400e' : '#065f46';
                  const borderColor = isLoad ? '#f59e0b' : '#10b981';

                  return `
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="border: 2px solid ${borderColor}; border-radius: 6px; overflow: hidden; margin-bottom: 12px; background-color: #ffffff;">
                      <!-- Pasek nagłówkowy przystanku -->
                      <tr>
                        <td style="background-color: ${barBg}; border-bottom: 1.5px solid ${borderColor}; padding: 8px 16px;">
                          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="font-size: 13px; font-weight: 900; color: ${barTextColor}; text-transform: uppercase;">
                                <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 900; margin-right: 8px;">
                                  PUNKT ${idx + 1}
                                </span>
                                ${isLoad ? 'PUNKT ZAŁADUNKU' : 'PUNKT ROZŁADUNKU'}
                              </td>
                              <td align="right" style="font-size: 12px; font-weight: 800; color: ${barTextColor};">
                                Dotyczy zlecenia: <span style="font-size: 14px; text-decoration: underline;">${stop.orderNumber || orderNum}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Dane przystanku (układ 2-kolumnowy) -->
                      <tr>
                        <td style="padding: 12px 16px;">
                          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <!-- Kolumna lewa: Klient i Adres -->
                              <td width="58%" valign="top" style="padding-right: 14px; border-right: 1px solid #e2e8f0;">
                                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                                  ${isLoad ? 'Nadawca / Firma:' : 'Odbiorca / Firma:'}
                                </div>
                                <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px; line-height: 1.3;">
                                  ${stop.clientName || 'Nie podano'}
                                </div>

                                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-top: 10px;">
                                  Dokładny adres:
                                </div>
                                <div style="font-size: 15px; font-weight: 800; color: #1e293b; margin-top: 2px; line-height: 1.4;">
                                  ${stop.address || 'Brak danych adresowych'}
                                </div>
                              </td>

                              <!-- Kolumna prawa: Termin i Kontakt -->
                              <td width="42%" valign="top" style="padding-left: 14px;">
                                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                                  ${isLoad ? 'Planowany termin załadunku:' : 'Planowany termin rozładunku:'}
                                </div>
                                <div style="font-size: 16px; font-weight: 900; color: #1e40af; margin-top: 2px;">
                                  ${stop.date}
                                </div>

                                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-top: 10px;">
                                  Osoba kontaktowa i telefon:
                                </div>
                                <div style="font-size: 14px; font-weight: 700; color: #334155; margin-top: 2px;">
                                  ${stop.contact || 'Nie podano'}
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  `;
                }).join('')}
              </div>
            </td>
          </tr>

          <!-- SEKCJA 3: DANE KIEROWCY I POJAZDU -->
          <tr>
            <td style="padding: 10px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 6px;">
                <tr>
                  <td style="border-bottom: 2px solid #1e3a8a; padding-bottom: 4px;">
                    <span style="font-size: 14px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.8px;">
                      3. DANE POJAZDU I KIEROWCY
                    </span>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
                <tr>
                  <td width="33%" style="padding: 10px 14px; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Kierowca:</div>
                    <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                      ${(responseData.driverName || '') + ' ' + (responseData.driverSurname || '') || 'Nie podano'}
                    </div>
                  </td>
                  <td width="33%" style="padding: 10px 14px; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Telefon kierowcy:</div>
                    <div style="font-size: 15px; font-weight: 800; color: #1e40af; margin-top: 2px;">
                      ${responseData.driverPhone || 'Nie podano'}
                    </div>
                  </td>
                  <td width="34%" style="padding: 10px 14px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Nr rejestracyjny (ciągnik / naczepa):</div>
                    <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">
                      ${responseData.vehicleNumber || 'Nie podano'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${combinedNotes ? `
          <!-- UWAGI SPECJALNE -->
          <tr>
            <td style="padding: 4px 30px 10px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="background-color: #fffbeb; border: 1.5px solid #fde68a; border-radius: 6px; padding: 10px 14px;">
                <tr>
                  <td style="font-size: 13px; color: #92400e; line-height: 1.5;">
                    <strong style="text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Uwagi i instrukcje specjalne:</strong><br>
                    ${combinedNotes}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- SEKCJA 4: WARUNKI OGÓLNE I REGULAMIN ZLECENIA (KLAUZULE PRAWNE) -->
          <tr>
            <td style="padding: 10px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 6px;">
                <tr>
                  <td style="border-bottom: 2px solid #1e3a8a; padding-bottom: 4px;">
                    <span style="font-size: 14px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.8px;">
                      4. OGÓLNE WARUNKI REALIZACJI ZLECENIA TRANSPORTOWEGO
                    </span>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 18px;">
                <tr>
                  <td style="font-size: 11px; color: #475569; line-height: 1.6;">
                    <strong>1.</strong> Przewoźnik gwarantuje podstawienie sprawnego technicznie pojazdu o parametrach zgodnych ze zleceniem oraz posiadanie ważnej polisy ubezpieczeniowej OCP.<br>
                    <strong>2.</strong> Kierowca ma bezwzględny obowiązek obecności przy załadunku i rozładunku, kontroli stanu ilościowego towaru, zabezpieczenia ładunku pasami transportowymi oraz weryfikacji plomb.<br>
                    <strong>3.</strong> Zabrania się przeładunku towaru oraz doładunku innych towarów bez uprzedniej pisemnej zgody Zleceniodawcy.<br>
                    <strong>4.</strong> Wszelkie opóźnienia, rozbieżności, brak możliwości załadunku/rozładunku lub szkody towarowe należy natychmiast zgłaszać Zleceniodawcy pod nr tel. <strong>85 715 27 05</strong>.<br>
                    <strong>5.</strong> Warunkiem płatności jest doręczenie prawidłowo wystawionej faktury VAT (zawierającej numer zlecenia i MPK) wraz z kompletem potwierdzonych dokumentów CMR / WZ.<br>
                    <strong>6.</strong> Brak pisemnej odmowy przyjęcia niniejszego zlecenia w terminie 30 minut od jego otrzymania uznaje się za zawarcie umowy przewozu na warunkach określonych w niniejszym dokumencie.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SEKCJA 5: POTWIERDZENIE PRZYJĘCIA I PODPISY STRON (MIEJSCE NA PIECZĘĆ) -->
          <tr>
            <td style="padding: 10px 30px 24px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="border-top: 2px solid #1e3a8a; padding-top: 14px;">
                <tr>
                  <!-- Lewa: Zleceniodawca -->
                  <td width="48%" valign="top" style="border: 1.5px dashed #94a3b8; border-radius: 6px; padding: 12px 14px; background-color: #f8fafc;">
                    <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
                      ZLECENIODAWCA:
                    </div>
                    <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                      Grupa Eltron Sp. z o.o.
                    </div>
                    <div style="font-size: 11px; color: #64748b;">
                      Wystawił: <strong>${user?.name || user?.email || 'Dział Logistyki'}</strong>
                    </div>
                    <div style="margin-top: 36px; border-bottom: 1px dotted #94a3b8; width: 80%;"></div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                      (podpis i pieczęć osoby upoważnionej)
                    </div>
                  </td>
                  <td width="4%"></td>
                  <!-- Prawa: Przewoźnik -->
                  <td width="48%" valign="top" style="border: 1.5px dashed #94a3b8; border-radius: 6px; padding: 12px 14px; background-color: #f8fafc;">
                    <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
                      PRZEWOŹNIK / ZLECENIOBIORCA:
                    </div>
                    <div style="font-size: 12px; color: #334155; margin-top: 4px;">
                      Potwierdzam przyjęcie zlecenia do realizacji.
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Data przyjęcia: .....................................................
                    </div>
                    <div style="margin-top: 22px; border-bottom: 1px dotted #94a3b8; width: 80%;"></div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                      (data, czytelny podpis i pieczęć Przewoźnika)
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DÓŁ STOPKI -->
          <tr>
            <td align="center" style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; padding: 12px; font-size: 11px; color: #64748b; text-align: center;">
              Zlecenie wygenerowane elektronicznie przez System Logistyki i Spedycji Grupy Eltron Sp. z o.o. &nbsp;|&nbsp; Kontakt: logistyka@grupaeltron.pl
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
</html>`;
}
