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

    // Zbierz wszystkie powiązane transportId ze stops i additionalPlaces w celu pobrania MPK i danych powiązanych zleceń
    const connectedTransportIds = new Set();
    if (stops && Array.isArray(stops)) {
      stops.forEach(s => {
        if (s.transportId && String(s.transportId) !== String(spedycja.id)) {
          connectedTransportIds.add(s.transportId);
        }
      });
    }
    if (additionalPlaces && Array.isArray(additionalPlaces)) {
      additionalPlaces.forEach(p => {
        if (p.transportId && String(p.transportId) !== String(spedycja.id)) {
          connectedTransportIds.add(p.transportId);
        }
      });
    }

    const connectedSpedycjeMap = new Map();
    if (connectedTransportIds.size > 0) {
      try {
        const found = await db('spedycje')
          .whereIn('id', Array.from(connectedTransportIds))
          .select('id', 'order_number', 'mpk', 'location', 'client_name', 'source_client_name');
        found.forEach(item => {
          connectedSpedycjeMap.set(String(item.id), item);
        });
      } catch (err) {
        console.error('Błąd pobierania danych powiązanych spedycji dla MPK:', err);
      }
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
                mpk: additionalSpedycja.mpk || '',
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

    // Skompletuj wszystkie unikalne numery MPK (z podziałem na powiązane zlecenia)
    const mpkMap = new Map();
    if (spedycja.mpk && spedycja.mpk.trim()) {
      const orderNo = spedycja.order_number || `${spedycja.id}`;
      mpkMap.set(spedycja.mpk.trim(), {
        mpk: spedycja.mpk.trim(),
        orderNumber: orderNo,
        isMain: true
      });
    }

    connectedSpedycjeMap.forEach((cs) => {
      if (cs.mpk && cs.mpk.trim()) {
        const key = cs.mpk.trim();
        if (!mpkMap.has(key)) {
          mpkMap.set(key, {
            mpk: key,
            orderNumber: cs.order_number || `${cs.id}`,
            isMain: false
          });
        }
      }
    });

    if (stops && Array.isArray(stops)) {
      stops.forEach(s => {
        if (s.mpk && s.mpk.trim() && !mpkMap.has(s.mpk.trim())) {
          mpkMap.set(s.mpk.trim(), {
            mpk: s.mpk.trim(),
            orderNumber: s.orderNumber || '',
            isMain: false
          });
        }
      });
    }

    const mpkList = Array.from(mpkMap.values());

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
        additionalPlaces: additionalPlacesData,
        mpkList,
        connectedSpedycjeMap
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
  const {
    towar,
    terminPlatnosci,
    waga,
    dataZaladunku,
    dataRozladunku,
    stops = [],
    additionalPlaces = [],
    mpkList = [],
    connectedSpedycjeMap
  } = additionalData;

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
      const stopMpk = s.mpk || (s.transportId && connectedSpedycjeMap?.get(String(s.transportId))?.mpk) || (s.isMain ? spedycja.mpk : '');

      return {
        type: isLoad ? 'załadunek' : 'rozładunek',
        orderNumber: s.orderNumber || spedycja.order_number || spedycja.id,
        mpk: stopMpk,
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
      mpk: spedycja.mpk || '',
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
      mpk: spedycja.mpk || '',
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

        const placeMpk = p.mpk || (p.transportId && connectedSpedycjeMap?.get(String(p.transportId))?.mpk) || '';

        stopsList.push({
          type: p.type,
          orderNumber: p.orderNumber || '',
          mpk: placeMpk,
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
          
          <!-- GŁOWICA DOKUMENTU -->
          <tr>
            <td style="padding: 22px 30px; border-bottom: 2px solid #1e3a8a; background-color: #ffffff;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="middle">
                    <div style="font-size: 20px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase;">
                      GRUPA ELTRON SP. Z O.O.
                    </div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                      Data wystawienia: <strong style="color: #0f172a;">${formatDate(new Date().toISOString())}</strong>
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 2px solid #1e3a8a; border-radius: 6px; text-align: center;">
                      <tr>
                        <td style="padding: 10px 20px;">
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

          <!-- SEKCJA: KLAUZULA FAKTUROWANIA -->
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
                    
                    <!-- Kafelki rozliczeniowe na pełną szerokość -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="48%" valign="top" style="background-color: #ffffff; border: 2px solid #93c5fd; border-radius: 6px; padding: 12px 16px; text-align: center;">
                          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                            OBOWIĄZKOWY NUMER ZLECENIA:
                          </div>
                          <div style="font-size: 22px; font-weight: 900; color: #1e40af; margin-top: 4px; letter-spacing: 0.5px;">
                            ${orderNum}
                          </div>
                        </td>
                        <td width="4%"></td>
                        <td width="48%" valign="top" style="background-color: #ffffff; border: 2px solid #93c5fd; border-radius: 6px; padding: 12px 16px; text-align: center;">
                          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${mpkList.length > 1 ? 'OBOWIĄZKOWE NUMERY MPK (PODZIAŁ KOSZTU):' : 'OBOWIĄZKOWY NUMER MPK:'}
                          </div>
                          ${mpkList.length > 1 ? `
                            <div style="font-size: 16px; font-weight: 900; color: #1e40af; margin-top: 6px; line-height: 1.5; text-align: left; display: inline-block;">
                              ${mpkList.map(m => `<div>• <strong>${m.mpk}</strong> <span style="font-size: 12px; font-weight: 700; color: #64748b;">(zlecenie: ${m.orderNumber})</span></div>`).join('')}
                            </div>
                            <div style="font-size: 11px; font-weight: 700; color: #b45309; margin-top: 6px;">
                              * Koszt transportu należy podzielić między powyższe numery MPK
                            </div>
                          ` : `
                            <div style="font-size: 22px; font-weight: 900; color: #1e40af; margin-top: 4px; letter-spacing: 0.5px;">
                              ${mpkList[0]?.mpk || spedycja.mpk || 'Nie określono'}
                            </div>
                          `}
                        </td>
                      </tr>
                    </table>

                    <!-- Pasek czerwonego ostrzeżenia -->
                    <div style="margin-top: 12px; background-color: #fef2f2; border: 1.5px solid #ef4444; border-radius: 4px; padding: 8px 14px; text-align: center;">
                      <span style="font-size: 13px; font-weight: 900; color: #991b1b;">
                        ${mpkList.length > 1
                          ? `⚠️ UWAGA! Na fakturze musi być bezwzględnie podany numer zlecenia (${orderNum}) oraz powyższe numery MPK (z podziałem kwot)! Faktury bez numeru zlecenia i MPK nie będą opłacane!`
                          : `⚠️ UWAGA! Faktury bez podanego numeru zlecenia (${orderNum}) oraz MPK (${mpkList[0]?.mpk || spedycja.mpk || '-'}) nie będą opłacane!`
                        }
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
                <!-- Wiersz 2: MPK i Waga -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    ${mpkList.length > 1 ? 'Numery MPK:' : 'Numer MPK:'}
                  </td>
                  <td style="padding: 10px 14px; font-size: 15px; font-weight: 800; color: #1e40af; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #cbd5e1;">
                    ${mpkList.length > 1
                      ? mpkList.map(m => `${m.mpk} (${m.orderNumber})`).join(', ')
                      : (mpkList[0]?.mpk || spedycja.mpk || 'Nie podano')}
                  </td>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    Waga całkowita:
                  </td>
                  <td style="padding: 10px 14px; font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    ${waga ? `${waga} kg` : 'Zgodnie z dokumentami WZ'}
                  </td>
                </tr>
                <!-- Wiersz 3: Towar i Typ naczepy -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    Rodzaj towaru:
                  </td>
                  <td style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #cbd5e1;">
                    ${towar || 'Materiały i towary handlowe'}
                  </td>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    Wymagany pojazd:
                  </td>
                  <td style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    ${responseData.transportType || 'Standard'}
                  </td>
                </tr>
                <!-- Wiersz 4: Wymagane dokumenty -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #475569; border-right: 1px solid #e2e8f0;">
                    Wymagane dokumenty:
                  </td>
                  <td colspan="3" style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a;">
                    ${spedycja.documents || 'List przewozowy CMR / Dokument WZ z pieczęcią odbiorcy'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SEKCJA 2: HARMONOGRAM TRASY (PUNKTY ZAŁADUNKU I ROZŁADUNKU) -->
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
                  const themeColor = isLoad ? '#b45309' : '#047857';
                  const borderSideColor = isLoad ? '#f59e0b' : '#10b981';

                  return `
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="border: 1px solid #cbd5e1; border-left: 5px solid ${borderSideColor}; border-radius: 6px; overflow: hidden; margin-bottom: 12px; background-color: #ffffff;">
                      <!-- Pasek nagłówkowy przystanku - lekki, czytelny, bez grubych klocków tła -->
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 16px;">
                          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="font-size: 14px; color: ${themeColor};">
                                <strong style="color: ${themeColor}; font-size: 14px;">Punkt ${idx + 1}:</strong> ${isLoad ? 'Załadunek' : 'Rozładunek'}
                              </td>
                              <td align="right" style="font-size: 12px; color: #64748b;">
                                Dotyczy zlecenia: <strong style="color: #0f172a; font-size: 13px;">${stop.orderNumber || orderNum}</strong>
                                ${stop.mpk ? ` &nbsp;|&nbsp; MPK: <strong style="color: #1e40af;">${stop.mpk}</strong>` : ''}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Dane przystanku -->
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
          <!-- UWAGI -->
          <tr>
            <td style="padding: 4px 30px 10px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="background-color: #fffbeb; border: 1.5px solid #fde68a; border-radius: 6px; padding: 12px 16px; margin-bottom: 10px;">
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

          <!-- ADRES DO WYSYŁKI FAKTUR I DOKUMENTÓW (NA SAMYM DOLE, POD UWAGAMI) -->
          <tr>
            <td style="padding: 10px 30px 24px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="page-break-avoid" style="background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 16px 20px;">
                <tr>
                  <td style="font-size: 13px; color: #1e293b; line-height: 1.6;">
                    <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                      Adres do wysyłki faktur i dokumentów
                    </div>
                    <strong style="font-size: 15px; color: #0f172a;">Grupa Eltron Sp. z o.o.</strong><br>
                    ul. Główna 7<br>
                    18-100 Łapy<br>
                    tel. 85 715 27 05<br>
                    NIP: <strong>9662112843</strong><br>
                    <a href="mailto:ksiegowosc@grupaeltron.pl" style="color: #2563eb; font-weight: 700; text-decoration: underline;">ksiegowosc@grupaeltron.pl</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DÓŁ STOPKI -->
          <tr>
            <td align="center" style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; padding: 12px; font-size: 11px; color: #64748b; text-align: center;">
              Zlecenie wygenerowane elektronicznie przez System Transportowy Grupy Eltron Sp. z o.o. &nbsp;|&nbsp; Kontakt: logistyka@grupaeltron.pl
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
