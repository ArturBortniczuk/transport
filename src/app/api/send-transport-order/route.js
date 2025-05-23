// src/app/api/send-transport-order/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import db from '@/database/db';

export async function POST(request) {
  try {
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Weryfikacja sesji
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first();
    
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sesja wygasła lub jest nieprawidłowa' 
      }, { status: 401 });
    }
    
    const userId = session.user_id;
    
    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('*')
      .first();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Nie znaleziono użytkownika'
      }, { status: 404 });
    }
    
    // Sprawdź uprawnienia
    let permissions = {};
    try {
      if (user.permissions && typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }
    
    // Sprawdź czy użytkownik ma uprawnienie do wysyłania zlecenia transportowego
    const isAdmin = user.is_admin === 1 || user.is_admin === true || user.role === 'admin';
    const canSendTransportOrder = isAdmin || permissions?.spedycja?.sendOrder === true;
    
    if (!canSendTransportOrder) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do wysyłania zlecenia transportowego'
      }, { status: 403 });
    }
    
    // Pobierz dane z żądania, dodaj obsługę additionalPlaces
    const { 
      spedycjaId, 
      towar, 
      terminPlatnosci, 
      waga, 
      dataZaladunku, 
      dataRozladunku, 
      emailOdbiorcy,
      additionalPlaces = [] // Nowe pole
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
    
    // Jeśli są dodatkowe miejsca, pobierz dane dla nich
    const additionalPlacesData = [];
    
    if (additionalPlaces && additionalPlaces.length > 0) {
      for (const place of additionalPlaces) {
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
      subject: `Zlecenie transportowe nr ${spedycja.order_number || spedycja.id}`,
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

// Funkcja generująca HTML zamówienia
function generateTransportOrderHTML({ spedycja, producerAddress, delivery, responseData, user, additionalData }) {
  const { towar, terminPlatnosci, waga, dataZaladunku, dataRozladunku, additionalPlaces = [] } = additionalData;
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
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
    return `${address.city || ''}, ${address.postalCode || ''}, ${address.street || ''}`;
  };
  
  const getLoadingLocation = () => {
    if (spedycja.location === 'Odbiory własne' && producerAddress) {
      return formatAddress(producerAddress);
    } else if (spedycja.location === 'Magazyn Białystok') {
      return 'Grupa Eltron Sp z o.o, ul. Wysockiego 69B, 15-169 Białystok';
    } else if (spedycja.location === 'Magazyn Zielonka') {
      return 'Grupa Eltron Sp z o.o, ul. Krótka 2, 05-220 Zielonka';
    }
    return spedycja.location || 'Brak danych';
  };
  
  // Formatowanie ceny z dopiskiem "Netto"
  const formatPrice = (price) => {
    if (!price) return 'Nie podano';
    return `${price} PLN Netto`;
  };
  
  // Generowanie sekcji dla dodatkowych miejsc
  const generateAdditionalPlacesHTML = () => {
    if (!additionalPlaces || additionalPlaces.length === 0) {
      return '';
    }
    
    // Pogrupuj miejsca według typu
    const loadingPlaces = additionalPlaces.filter(place => place.type === 'załadunek');
    const unloadingPlaces = additionalPlaces.filter(place => place.type === 'rozładunek');
    
    let html = '';
    
    // Generuj sekcje dla dodatkowych miejsc załadunku
    if (loadingPlaces.length > 0) {
      loadingPlaces.forEach((place, index) => {
        html += `
        <div class="section">
          <h2>Dodatkowe miejsce załadunku ${index + 1}</h2>
          <table class="info-table">
            <tr>
              <th>Nr zlecenia:</th>
              <td>${place.orderNumber || ''} (${place.route || ''})</td>
            </tr>
        `;
        
        let address = 'Brak danych';
        
        if (place.location === 'Odbiory własne' && place.producerAddress) {
          address = formatAddress(place.producerAddress);
        } else if (place.location === 'Magazyn Białystok') {
          address = 'Magazyn Białystok';
        } else if (place.location === 'Magazyn Zielonka') {
          address = 'Magazyn Zielonka';
        } else if (typeof place.address === 'object') {
          address = formatAddress(place.address);
        } else if (typeof place.address === 'string') {
          address = place.address;
        }
        
        html += `
            <tr>
              <th>Miejsce załadunku:</th>
              <td>${address}</td>
            </tr>
            <tr>
              <th>Kontakt do załadunku:</th>
              <td>${place.loadingContact || place.contact || 'Nie podano'}</td>
            </tr>
          </table>
        </div>
        `;
      });
    }
    
    // Generuj sekcje dla dodatkowych miejsc rozładunku
    if (unloadingPlaces.length > 0) {
      unloadingPlaces.forEach((place, index) => {
        html += `
        <div class="section">
          <h2>Drugie miejsce rozładunku${index > 0 ? ' ' + (index + 1) : ''}</h2>
          <table class="info-table">
            <tr>
              <th>Nr zlecenia:</th>
              <td>${place.orderNumber || ''} (${place.route || ''})</td>
            </tr>
        `;
        
        let address = 'Brak danych';
        
        if (place.delivery) {
          address = formatAddress(place.delivery);
        } else if (typeof place.address === 'object') {
          address = formatAddress(place.address);
        } else if (typeof place.address === 'string') {
          address = place.address;
        }
        
        html += `
            <tr>
              <th>Miejsce rozładunku:</th>
              <td>${address}</td>
            </tr>
            <tr>
              <th>Kontakt do rozładunku:</th>
              <td>${place.unloadingContact || place.contact || 'Nie podano'}</td>
            </tr>
          </table>
        </div>
        `;
      });
    }
    
    return html;
  };
  
  // Tworzenie HTML-a
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zlecenie Transportowe</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #1a71b5;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #1a71b5;
          margin-bottom: 5px;
        }
        .header p {
          color: #666;
          margin-top: 0;
        }
        .section {
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f9f9f9;
          border-radius: 5px;
        }
        .section h2 {
          margin-top: 0;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
          color: #1a71b5;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
        }
        .info-table th {
          text-align: left;
          background-color: #eee;
          padding: 8px;
          width: 40%;
        }
        .info-table td {
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #777;
          border-top: 1px solid #ddd;
          padding-top: 20px;
        }
        .important-note {
          background-color: #f2f9ff;
          border-left: 4px solid #1a71b5;
          padding: 10px 15px;
          margin-bottom: 20px;
          font-weight: bold;
        }
        .important-info {
          background-color: #f9f9f9;
          padding: 12px;
          border-radius: 5px;
          border-left: 4px solid #1a71b5;
        }
        .important-warning {
          background-color: #fff2f2;
          border-left: 4px solid #e74c3c;
          margin: 20px 0;
          padding: 15px;
          border-radius: 5px;
          font-weight: bold;
          color: #c0392b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ZLECENIE TRANSPORTOWE</h1>
        <p>Nr zlecenia: ${spedycja.order_number || spedycja.id} | Data utworzenia: ${formatDate(new Date().toISOString())}</p>
      </div>
      
      <div class="important-note">
        Proszę o dopisanie na fakturze zamieszczonego poniżej numeru MPK oraz numeru zlecenia: ${spedycja.order_number || spedycja.id}.
      </div>
      
      <div class="important-warning">
        <strong>UWAGA!</strong> Na fakturze musi być podany numer zlecenia: ${spedycja.order_number || spedycja.id}. 
        Faktury bez numeru zlecenia nie będą opłacane.
      </div>
      
      <div class="section">
        <h2>Dane podstawowe</h2>
        <table class="info-table">
          <tr>
            <th>Numer MPK:</th>
            <td>${spedycja.mpk || 'Nie podano'}</td>
          </tr>
          <tr>
            <th>Dokumenty:</th>
            <td>${spedycja.documents || 'Nie podano'}</td>
          </tr>
          <tr>
            <th>Rodzaj towaru:</th>
            <td>${towar || 'Nie podano'}</td>
          </tr>
          <tr>
            <th>Waga towaru:</th>
            <td>${waga || 'Nie podano'}</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h2>${additionalPlaces.some(p => p.type === 'załadunek') ? 'Pierwsze miejsce załadunku' : 'Dane załadunku'}</h2>
        <table class="info-table">
          <tr>
            <th>Miejsce załadunku:</th>
            <td>${getLoadingLocation()}</td>
          </tr>
          <tr>
            <th>Data załadunku:</th>
            <td>${formatDate(dataZaladunku) || 'Nie podano'}</td>
          </tr>
          <tr>
            <th>Kontakt do załadunku:</th>
            <td>${spedycja.loading_contact || 'Nie podano'}</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h2>${additionalPlaces.some(p => p.type === 'rozładunek') ? 'Pierwsze miejsce rozładunku' : 'Dane rozładunku'}</h2>
        <table class="info-table">
          <tr>
            <th>Miejsce rozładunku:</th>
            <td>${formatAddress(delivery)}</td>
          </tr>
          <tr>
            <th>Data rozładunku:</th>
            <td>${formatDate(dataRozladunku) || 'Nie podano'}</td>
          </tr>
          <tr>
            <th>Kontakt do rozładunku:</th>
            <td>${spedycja.unloading_contact || 'Nie podano'}</td>
          </tr>
        </table>
      </div>
      
      ${generateAdditionalPlacesHTML()}
      
      <div class="section">
        <h2>Dane przewoźnika</h2>
        <table class="info-table">
          <tr>
            <th>Przewoźnik:</th>
            <td>${responseData.driverName || ''} ${responseData.driverSurname || ''}</td>
          </tr>
          <tr>
            <th>Numer rejestracyjny:</th>
            <td>${responseData.vehicleNumber || 'Nie podano'}</td>
          </tr>
          <tr>
            <th>Telefon do kierowcy:</th>
            <td>${responseData.driverPhone || 'Nie podano'}</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h2>Płatność</h2>
        <table class="info-table">
          <tr>
            <th>Cena transportu:</th>
            <td>${responseData.deliveryPrice ? formatPrice(responseData.deliveryPrice) : 'Nie podano'}</td>
          </tr>
          <tr>
            <th>Termin płatności:</th>
            <td>${terminPlatnosci || 'Nie podano'}</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h2>Uwagi</h2>
        <p>${spedycja.notes || 'Brak uwag'}</p>
        ${responseData.adminNotes ? `<p><strong>Uwagi przewoźnika:</strong> ${responseData.adminNotes}</p>` : ''}
      </div>
      
      <div class="section">
        <h2>Adres do wysyłki faktur i dokumentów</h2>
        <p class="important-info">
          Grupa Eltron Sp. z o.o.<br>
          ul. Główna 7<br>
          18-100 Łapy<br>
          tel. 85 715 27 05<br>
          NIP: 9662112843<br>
          ksiegowosc@grupaeltron.pl
        </p>
      </div>
      
      <div class="footer">
        <p>Zlecenie wygenerowane automatycznie.</p>
      </div>
    </body>
    </html>
  `;
}
