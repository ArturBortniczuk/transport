// src/app/api/spedycje/complete/route.js - Z POWIADOMIENIAMI EMAIL
import { NextResponse } from 'next/server';
import db from '@/database/db';
import nodemailer from 'nodemailer';
import { validateSession } from '@/lib/auth';

// Funkcja wysyłania powiadomienia o ukończeniu spedycji
const sendCompletionNotification = async (spedycjaData) => {
  try {
    // Sprawdź konfigurację SMTP
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ SMTP nie skonfigurowany - powiadomienie nie zostanie wysłane');
      return { success: false, message: 'SMTP nie skonfigurowany' };
    }

    // Określ adresatów na podstawie lokalizacji magazynu
    const recipients = [];
    const location = spedycjaData.location;
    
    console.log('📍 Lokalizacja spedycji:', location);

    // Dodaj kierownika odpowiedniego magazynu
    if (location && location.toLowerCase().includes('zielonka')) {
      recipients.push('s.swiderski@grupaeltron.pl');
      console.log('✅ Dodano kierownika Zielonki');
    } else if (location && location.toLowerCase().includes('białystok')) {
      recipients.push('p.pietrusewicz@grupaeltron.pl');
      console.log('✅ Dodano kierownika Białegostoku');
    } else if (location && location.toLowerCase().includes('dostawa bezpośrednia')) {
      console.log('ℹ️ Dostawa bezpośrednia - nie wysyłam do kierowników magazynów');
    } else {
      // Jeśli nie można określić magazynu, wyślij do obydwu
      recipients.push('s.swiderski@grupaeltron.pl');
      recipients.push('p.pietrusewicz@grupaeltron.pl');
      console.log('⚠️ Nie można określić magazynu - wysyłam do wszystkich kierowników');
    }

    // Dodaj osobę odpowiedzialną (jeśli jest)
    if (spedycjaData.responsible_email) {
      recipients.push(spedycjaData.responsible_email);
      console.log('✅ Dodano osobę odpowiedzialną:', spedycjaData.responsible_email);
    }

    // Jeśli brak odbiorców, zakończ
    if (recipients.length === 0) {
      console.log('ℹ️ Brak odbiorców powiadomienia (dostawa bezpośrednia bez osoby odpowiedzialnej)');
      return { success: true, message: 'Brak odbiorców' };
    }

    // Usuń duplikaty
    const uniqueRecipients = [...new Set(recipients)];

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
    const deliveryDate = new Date(spedycjaData.delivery_date).toLocaleDateString('pl-PL');
    const completedDate = new Date().toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Parsuj dane lokalizacji i dostawy jeśli są w formacie JSON
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

    // Parsuj dane odpowiedzi jeśli są
    let responseInfo = '';
    try {
      if (spedycjaData.response_data) {
        const responseData = typeof spedycjaData.response_data === 'string'
          ? JSON.parse(spedycjaData.response_data)
          : spedycjaData.response_data;
        
        if (responseData) {
          responseInfo = `
            <div class="alert alert-success">
              <strong>📋 Szczegóły realizacji:</strong>
              ${responseData.driverName && responseData.driverSurname ? `
                <div style="margin-top: 10px;">
                  <strong>Kierowca:</strong> ${responseData.driverName} ${responseData.driverSurname}
                  ${responseData.driverPhone ? ` (tel: ${responseData.driverPhone})` : ''}
                </div>
              ` : ''}
              ${responseData.vehicleNumber ? `
                <div><strong>Pojazd:</strong> ${responseData.vehicleNumber}</div>
              ` : ''}
              ${responseData.deliveryPrice ? `
                <div><strong>Cena dostawy:</strong> ${responseData.deliveryPrice} PLN</div>
              ` : ''}
              ${responseData.distanceKm ? `
                <div><strong>Odległość:</strong> ${responseData.distanceKm} km</div>
              ` : ''}
            </div>
          `;
        }
      }
    } catch (e) {
      console.error('Błąd parsowania response_data:', e);
    }

    // Przygotuj treść HTML emaila
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10B981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px; }
            .info-row { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
            .label { font-weight: bold; color: #495057; display: block; margin-bottom: 5px; }
            .value { color: #212529; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; }
            .alert { padding: 15px; margin: 15px 0; border-radius: 4px; }
            .alert-success { background: #d1fae5; border-left: 4px solid #10B981; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .badge-success { background: #10B981; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>✅ Zlecenie spedycyjne zrealizowane</h2>
              <p style="margin: 0;">Zlecenie zostało pomyślnie ukończone</p>
            </div>
            
            <div class="content">
              <div style="text-align: center; margin-bottom: 20px;">
                <span class="badge badge-success">ZREALIZOWANE</span>
              </div>

              ${spedycjaData.order_number ? `
              <div class="info-row">
                <span class="label">Numer zlecenia:</span>
                <span class="value">${spedycjaData.order_number}</span>
              </div>
              ` : ''}

              <div class="info-row">
                <span class="label">Magazyn/Lokalizacja:</span>
                <span class="value">${location || 'Nie określono'}</span>
              </div>

              <div class="info-row">
                <span class="label">Data dostawy:</span>
                <span class="value">${deliveryDate}</span>
              </div>

              <div class="info-row">
                <span class="label">Data ukończenia:</span>
                <span class="value">${completedDate}</span>
              </div>

              ${spedycjaData.client_name ? `
              <div class="info-row">
                <span class="label">Klient:</span>
                <span class="value">${spedycjaData.client_name}</span>
              </div>
              ` : ''}

              ${producerInfo}
              ${deliveryInfo}

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

              ${spedycjaData.loading_contact ? `
              <div class="info-row">
                <span class="label">Kontakt załadunek:</span>
                <span class="value">${spedycjaData.loading_contact}</span>
              </div>
              ` : ''}

              ${spedycjaData.unloading_contact ? `
              <div class="info-row">
                <span class="label">Kontakt rozładunek:</span>
                <span class="value">${spedycjaData.unloading_contact}</span>
              </div>
              ` : ''}

              ${responseInfo}

              ${spedycjaData.notes ? `
              <div class="info-row">
                <span class="label">Uwagi:</span>
                <span class="value">${spedycjaData.notes}</span>
              </div>
              ` : ''}

              ${spedycjaData.completed_by ? `
              <div class="info-row">
                <span class="label">Oznaczone jako ukończone przez:</span>
                <span class="value">${spedycjaData.completed_by}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>To powiadomienie zostało wygenerowane automatycznie przez System Transportowy.</p>
              <p>Zlecenie zostało pomyślnie zrealizowane i dodane do archiwum.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Wysłanie emaila
    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: uniqueRecipients.join(', '),
      subject: `✅ Zlecenie spedycyjne zrealizowane - ${spedycjaData.order_number || 'Nr ' + spedycjaData.id} - ${deliveryDate}`,
      html: emailHtml
    };

    console.log('📧 Wysyłanie powiadomienia o ukończeniu spedycji do:', uniqueRecipients.join(', '));
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Powiadomienie wysłane:', info.messageId);
    return { 
      success: true, 
      message: `Powiadomienie wysłane do ${uniqueRecipients.length} odbiorców`,
      messageId: info.messageId,
      recipients: uniqueRecipients
    };

  } catch (error) {
    console.error('❌ Błąd wysyłania powiadomienia o ukończeniu spedycji:', error);
    return { 
      success: false, 
      message: 'Błąd wysyłania powiadomienia: ' + error.message 
    };
  }
};

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
    
    // Sprawdzamy czy użytkownik ma uprawnienia
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name', 'permissions', 'is_admin')
      .first();
    
    // Sprawdź uprawnienia użytkownika
    let permissions = {};
    let isAdmin = false;
    
    // Sprawdź czy użytkownik jest adminem
    if (user) {
      isAdmin = user.is_admin === true || 
                user.is_admin === 1 || 
                user.is_admin === 't' || 
                user.is_admin === 'TRUE' ||
                user.is_admin === 'true' ||
                user.role === 'admin';
      
      // Próba parsowania uprawnień jeśli są w formie stringa
      try {
        if (user.permissions && typeof user.permissions === 'string') {
          permissions = JSON.parse(user.permissions);
        }
      } catch (e) {
        console.error('Error parsing permissions:', e);
        permissions = {};
      }
    }

    const canComplete = isAdmin || permissions?.spedycja?.respond === true;

    if (!canComplete) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do oznaczania zleceń jako zrealizowane' 
      }, { status: 403 });
    }
    
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie podano ID zlecenia' 
      }, { status: 400 });
    }
    
    // Pobierz aktualne dane zlecenia
    const currentSpedycja = await db('spedycje')
      .where('id', id)
      .first();
    
    if (!currentSpedycja) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono zlecenia o podanym ID' 
      }, { status: 404 });
    }
    
    // Przygotuj dane odpowiedzi
    let responseData = {
      completedManually: true,
      completedBy: user.name || userId,
      completedAt: new Date().toISOString()
    };
    
    // Jeśli już istnieje odpowiedź, zachowaj jej dane
    if (currentSpedycja.response_data) {
      try {
        const existingResponseData = JSON.parse(currentSpedycja.response_data);
        // Zachowaj istniejące dane i dodaj informacje o ręcznym zakończeniu
        responseData = {
          ...existingResponseData,
          completedManually: true,
          completedBy: user.name || userId,
          completedAt: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error parsing existing response data:', error);
        // Jeśli wystąpi błąd podczas parsowania, użyjemy domyślnych danych
      }
    }
    
    console.log('Aktualizacja zlecenia z ID:', id);
    console.log('Dane odpowiedzi do zapisania:', responseData);
    
    // Aktualizujemy rekord w bazie
    const updated = await db('spedycje')
      .where('id', id)
      .update({
        status: 'completed',
        response_data: JSON.stringify(responseData),
        completed_at: db.fn.now(),
        completed_by: userId
      });
    
    if (updated === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie udało się zaktualizować zlecenia spedycji' 
      }, { status: 500 });
    }

    // WYSYŁKA POWIADOMIENIA EMAIL
    console.log('📮 Wysyłanie powiadomienia email o ukończeniu spedycji...');
    const spedycjaForEmail = {
      ...currentSpedycja,
      completed_by: user.name || userId
    };
    const emailResult = await sendCompletionNotification(spedycjaForEmail);
    console.log('📬 Wynik wysyłki emaila:', emailResult.message);
    
    return NextResponse.json({ 
      success: true,
      message: 'Zlecenie zostało pomyślnie oznaczone jako zrealizowane',
      emailNotification: emailResult
    });
  } catch (error) {
    console.error('Error completing spedycja:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}