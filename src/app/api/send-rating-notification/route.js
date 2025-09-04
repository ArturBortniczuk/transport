// src/app/api/send-rating-notification/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
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
    console.error('Session validation error:', error);
    return null;
  }
};

// Funkcja do pobierania kierowników magazynów
const getWarehouseManagers = async () => {
  try {
    const managers = await db('users')
      .where('role', 'like', '%magazyn%')
      .orWhere('role', 'admin')
      .select('email', 'name', 'role')
      .whereNotNull('email');
    
    return managers;
  } catch (error) {
    console.error('Błąd pobierania kierowników magazynów:', error);
    return [];
  }
};

// Funkcja do formatowania danych oceny
const formatRatingData = (rating) => {
  const criteria = [
    { key: 'driver_professional', label: 'Kierowca profesjonalny' },
    { key: 'driver_tasks_completed', label: 'Zadania kierowcy wykonane' },
    { key: 'cargo_complete', label: 'Towar kompletny' },
    { key: 'cargo_correct', label: 'Towar zgodny' },
    { key: 'delivery_notified', label: 'Powiadomienie o dostawie' },
    { key: 'delivery_on_time', label: 'Dostawa na czas' }
  ];
  
  return criteria.map(criterion => ({
    label: criterion.label,
    value: rating[criterion.key] ? '✅ TAK' : '❌ NIE'
  }));
};

// Funkcja do tworzenia HTML emaila
const generateRatingNotificationHTML = (transport, rating, raterInfo) => {
  const criteriaFormatted = formatRatingData(rating);
  const ratingDate = new Date(rating.rated_at).toLocaleString('pl-PL');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .section { margin-bottom: 20px; }
        .transport-info { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10B981; }
        .rating-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
        .rating-item { background: white; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; }
        .positive { border-left: 3px solid #10B981; }
        .negative { border-left: 3px solid #EF4444; }
        .footer { background: #6B7280; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚛 Nowa Ocena Transportu</h1>
          <p>Transport został oceniony w systemie zarządzania transportem</p>
        </div>
        
        <div class="content">
          <div class="section transport-info">
            <h2>📋 Informacje o transporcie</h2>
            <p><strong>ID Transportu:</strong> #${transport.id}</p>
            <p><strong>Klient:</strong> ${transport.client_name || 'Nie podano'}</p>
            <p><strong>Miejscowość:</strong> ${transport.destination_city || 'Nie podano'}</p>
            <p><strong>Adres:</strong> ${transport.street || 'Nie podano'}</p>
            <p><strong>MPK:</strong> ${transport.mpk || 'Nie podano'}</p>
            <p><strong>Nr WZ:</strong> ${transport.wz_number || 'Nie podano'}</p>
            <p><strong>Data dostawy:</strong> ${transport.delivery_date ? new Date(transport.delivery_date).toLocaleDateString('pl-PL') : 'Nie podano'}</p>
          </div>
          
          <div class="section">
            <h2>⭐ Szczegóły oceny</h2>
            <p><strong>Ocenione przez:</strong> ${raterInfo.name} (${rating.rater_email})</p>
            <p><strong>Data oceny:</strong> ${ratingDate}</p>
            
            <div class="rating-grid">
              ${criteriaFormatted.map(item => `
                <div class="rating-item ${item.value.includes('✅') ? 'positive' : 'negative'}">
                  <strong>${item.label}:</strong><br>
                  ${item.value}
                </div>
              `).join('')}
            </div>
            
            ${rating.comment ? `
              <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3B82F6; margin-top: 15px;">
                <h3>💬 Komentarz:</h3>
                <p style="font-style: italic;">"${rating.comment}"</p>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="footer">
          <p>Powiadomienie wygenerowane automatycznie przez System Zarządzania Transportem</p>
          <p>Data: ${new Date().toLocaleString('pl-PL')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export async function POST(request) {
  try {
    // Sprawdź autoryzację
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { transportId, ratingId } = await request.json();
    
    if (!transportId || !ratingId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak wymaganych danych: transportId i ratingId' 
      }, { status: 400 });
    }
    
    // Pobierz dane transportu
    const transport = await db('transports')
      .where('id', transportId)
      .select('*')
      .first();
    
    if (!transport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport nie istnieje' 
      }, { status: 404 });
    }
    
    // Pobierz dane oceny
    const rating = await db('transport_detailed_ratings')
      .where('id', ratingId)
      .select('*')
      .first();
    
    if (!rating) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ocena nie istnieje' 
      }, { status: 404 });
    }
    
    // Pobierz dane osoby oceniającej
    const rater = await db('users')
      .where('email', rating.rater_email)
      .select('name', 'email')
      .first();
    
    const raterInfo = {
      name: rater ? rater.name : 'Nieznany użytkownik',
      email: rating.rater_email
    };
    
    // Pobierz kierowników magazynów
    const managers = await getWarehouseManagers();
    
    // Lista odbiorców - kierownicy magazynów + Mateusz
    const recipients = [
      ...managers.map(manager => manager.email),
      'mateusz.klewinowski@grupaeltron.pl'
    ];
    
    // Usuń duplikaty
    const uniqueRecipients = [...new Set(recipients)];
    
    console.log('Wysyłanie powiadomienia o ocenie do:', uniqueRecipients);
    
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
    
    // Generuj HTML emaila
    const htmlContent = generateRatingNotificationHTML(transport, rating, raterInfo);
    
    // Przygotuj opcje emaila
    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: uniqueRecipients.join(', '),
      subject: `🚛 Nowa ocena transportu #${transport.id} - ${transport.client_name || 'Klient nieznany'}`,
      html: htmlContent
    };
    
    // Wyślij email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Powiadomienie o ocenie wysłane:', info.messageId);
    
    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      recipients: uniqueRecipients,
      message: `Powiadomienie wysłane do ${uniqueRecipients.length} odbiorców`
    });
    
  } catch (error) {
    console.error('Błąd wysyłania powiadomienia o ocenie:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}