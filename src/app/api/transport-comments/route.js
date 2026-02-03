// src/app/api/transport-comments/route.js - Z powiadomieniami mailowymi używając istniejącej konfiguracji SMTP
import { NextResponse } from 'next/server'
import db from '@/database/db'
import nodemailer from 'nodemailer'

// Funkcja pomocnicza do weryfikacji sesji
const getUserEmailFromToken = async (authToken) => {
  if (!authToken) return null;

  try {
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first();

    return session?.user_id || null;
  } catch (error) {
    console.error('Błąd walidacji sesji:', error)
    return null
  }
};

// Funkcja sprawdzania czy tabela istnieje
const tableExists = async (tableName) => {
  try {
    await db.raw(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch (error) {
    return false;
  }
};

// Funkcja określania typu użytkownika na podstawie emaila
const getUserType = (email) => {
  // Email magazynu lub w domenie magazynowej
  const magazynEmails = [
    'magazyn@grupaeltron.pl',
    'logistyka@grupaeltron.pl',
    'bialystok@grupaeltron.pl',
    'zielonka@grupaeltron.pl'
  ];

  // Email zawiera słowa kluczowe związane z magazynem
  const magazynKeywords = ['magazyn', 'warehouse', 'storage', 'logistyka'];

  if (magazynEmails.includes(email.toLowerCase()) ||
    magazynKeywords.some(keyword => email.toLowerCase().includes(keyword))) {
    return 'magazyn';
  }

  return 'handlowiec';
};

// Funkcja pobierania adresatów powiadomień
const getNotificationRecipients = async (commenterEmail, transportId) => {
  const recipients = [];

  // Zawsze dodaj stałych odbiorców
  recipients.push('mateusz.klewinowski@grupaeltron.pl');

  try {
    // 1. Pobierz dane o ocenie (kto oceniał - czyli "Handlowiec")
    const rating = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .select('rater_email')
      .first();

    const raterEmail = rating?.rater_email;

    // 2. Pobierz dane o transporcie
    const transport = await db('transports')
      .where('id', transportId)
      .select('requester_email', 'source_warehouse')
      .first();

    // Adresy "magazynowe"
    const logisticsEmails = [];
    const warehouse = transport && transport.source_warehouse ? transport.source_warehouse.toLowerCase() : '';

    if (warehouse === 'zielonka') {
      logisticsEmails.push('m.pawlak@grupaeltron.pl');
      logisticsEmails.push('magazynzielonka@grupaeltron.pl');
    } else if (warehouse === 'bialystok') {
      logisticsEmails.push('k.gryka@grupaeltron.pl');
      logisticsEmails.push('magazynbialystok@grupaeltron.pl');
    } else {
      // Fallback dla innych lokalizacji lub braku
      logisticsEmails.push('logistyka@grupaeltron.pl');
    }

    // LOGIKA KONWERSACJI:

    // Sytuacja A: Komentuje RATER (twórca oceny) -> Wysyłamy do Logistyki
    if (raterEmail && commenterEmail === raterEmail) {
      console.log('💬 Komentarz od twórcy oceny -> Powiadamiam Logistykę');
      logisticsEmails.forEach(email => recipients.push(email));
    }
    // Sytuacja B: Komentuje Logistyka (lub ktoś inny) -> Wysyłamy do RATERA
    else if (raterEmail && commenterEmail !== raterEmail) {
      console.log('💬 Komentarz od obsługi -> Powiadamiam Twórcę Oceny');
      recipients.push(raterEmail);
    }

    // Fallback: Jeśli nie ma oceny, a mamy email zlecającego i nie on komentuje
    if (!raterEmail && transport && transport.requester_email && transport.requester_email !== commenterEmail) {
      recipients.push(transport.requester_email);
    }

  } catch (error) {
    console.error('❌ Błąd pobierania adresatów:', error);
  }

  // Usuń duplikaty i email komentującego
  const finalRecipients = [...new Set(recipients)].filter(email => email !== commenterEmail);
  return finalRecipients;
};

// Funkcja wysyłania powiadomienia email - UŻYWA ISTNIEJĄCEJ KONFIGURACJI SMTP
const sendCommentNotification = async (commenterEmail, transport, comment, recipients) => {
  if (!recipients || recipients.length === 0) {
    console.log('Brak adresatów powiadomienia');
    return { success: true, message: 'Brak adresatów' };
  }

  try {
    // UŻYWA ISTNIEJĄCEJ KONFIGURACJI SMTP z projektu
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || "logistyka@grupaeltron.pl",
        pass: process.env.SMTP_PASSWORD
      }
    });

    // Sprawdź czy transporter jest skonfigurowany
    if (!process.env.SMTP_PASSWORD) {
      console.log('SMTP nie skonfigurowany - symulacja wysyłki emaila');
      return { success: true, message: 'Email wysłany (symulacja)' };
    }

    const commenterType = getUserType(commenterEmail);
    const transportInfo = `${transport.destination_city} - ${transport.client_name}`;
    const transportDate = new Date(transport.delivery_date).toLocaleDateString('pl-PL');

    const emailSubject = `📝 Nowy komentarz do transportu ${transportInfo}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
            .comment-box { background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; }
            .tag { display: inline-block; background: #007bff; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📝 Nowy komentarz do transportu</h2>
              <p><strong>Transport:</strong> ${transportInfo}</p>
              <p><strong>Data dostawy:</strong> ${transportDate}</p>
              <p><strong>Magazyn:</strong> ${transport.source_warehouse === 'bialystok' ? 'Białystok' : 'Zielonka'}</p>
            </div>
            
            <div class="content">
              <h3>Szczegóły komentarza</h3>
              <p><strong>Autor:</strong> ${commenterEmail} 
                <span class="tag">${commenterType === 'magazyn' ? 'MAGAZYN' : 'HANDLOWIEC'}</span>
              </p>
              <p><strong>Data:</strong> ${new Date().toLocaleString('pl-PL')}</p>
              
              <div class="comment-box">
                <h4>💬 Treść komentarza:</h4>
                <p style="font-style: italic;">"${comment}"</p>
              </div>
              
              <p style="margin-top: 20px;">
                <strong>Aby odpowiedzieć lub dodać swój komentarz, zaloguj się do systemu zarządzania transportem.</strong>
              </p>
            </div>
            
            <div class="footer">
              <p>Powiadomienie wygenerowane automatycznie przez System Zarządzania Transportem</p>
              <p>Grupa Eltron - ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
      Nowy komentarz do transportu

      Transport: ${transportInfo}
      Data dostawy: ${transportDate}
      Magazyn: ${transport.source_warehouse === 'bialystok' ? 'Białystok' : 'Zielonka'}
      
      Autor komentarza: ${commenterEmail} (${commenterType === 'magazyn' ? 'MAGAZYN' : 'HANDLOWIEC'})
      Data: ${new Date().toLocaleString('pl-PL')}
      
      Treść komentarza:
      "${comment}"
      
      Aby odpowiedzieć lub dodać swój komentarz, zaloguj się do systemu zarządzania transportem.
      
      ---
      Powiadomienie wygenerowane automatycznie przez System Zarządzania Transportem
      Grupa Eltron - ${new Date().getFullYear()}
    `;

    // Wyślij email do wszystkich adresatów
    for (const recipient of recipients) {
      await transporter.sendMail({
        from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
        to: recipient,
        subject: emailSubject,
        text: emailText,
        html: emailHtml
      });

      console.log(`✅ Email wysłany do: ${recipient}`);
    }

    return {
      success: true,
      message: `Powiadomienia wysłane do ${recipients.length} adresatów`
    };

  } catch (error) {
    console.error('❌ Błąd wysyłania powiadomienia email:', error);
    return {
      success: false,
      message: 'Błąd wysyłania powiadomienia: ' + error.message
    };
  }
};

// Pobierz komentarze do transportu
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const transportId = searchParams.get('transportId')

    console.log('🔍 GET komentarze dla transportu:', transportId);

    if (!transportId) {
      return NextResponse.json({
        success: false,
        error: 'Brak ID transportu'
      }, { status: 400 })
    }

    // Sprawdź czy tabela komentarzy istnieje
    const commentsTableExists = await tableExists('transport_comments');

    if (!commentsTableExists) {
      console.log('📝 Tabela transport_comments nie istnieje - zwracam pustą listę');
      return NextResponse.json({
        success: true,
        comments: []
      })
    }

    // Pobierz komentarze
    const comments = await db('transport_comments')
      .where('transport_id', transportId)
      .orderBy('created_at', 'desc')
      .select('*');

    console.log(`📦 Znaleziono ${comments.length} komentarzy`);

    return NextResponse.json({
      success: true,
      comments
    })

  } catch (error) {
    console.error('❌ Błąd pobierania komentarzy:', error)
    return NextResponse.json({
      success: false,
      error: 'Wystąpił błąd serwera: ' + error.message
    }, { status: 500 })
  }
}

// Dodaj komentarz do transportu Z POWIADOMIENIAMI
export async function POST(request) {
  try {
    console.log('🔔 Rozpoczynanie dodawania komentarza z powiadomieniami...');

    const authToken = request.cookies.get('authToken')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'Brak autoryzacji'
      }, { status: 401 })
    }

    const userEmail = await getUserEmailFromToken(authToken);
    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Nieprawidłowa sesja'
      }, { status: 401 })
    }

    const { transportId, comment } = await request.json()

    if (!transportId || !comment || !comment.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Brak wymaganych danych'
      }, { status: 400 })
    }

    // Sprawdź czy transport istnieje i pobierz jego dane
    const transport = await db('transports')
      .where('id', transportId)
      .select('*')
      .first();

    if (!transport) {
      return NextResponse.json({
        success: false,
        error: 'Transport nie istnieje'
      }, { status: 404 })
    }

    if (transport.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Można komentować tylko ukończone transporty'
      }, { status: 400 })
    }

    // Sprawdź czy tabela komentarzy istnieje, jeśli nie - utwórz ją
    const commentsTableExists = await tableExists('transport_comments');

    if (!commentsTableExists) {
      console.log('🗂️ Tworzenie tabeli transport_comments...');
      await db.schema.createTable('transport_comments', (table) => {
        table.increments('id').primary()
        table.integer('transport_id').notNullable()
        table.string('commenter_email').notNullable()
        table.text('comment').notNullable()
        table.timestamp('created_at').defaultTo(db.fn.now())

        table.index(['transport_id'])
        table.index(['commenter_email'])
      })
      console.log('✅ Tabela transport_comments utworzona');
    }

    // Dodaj komentarz
    const commentData = {
      transport_id: transportId,
      commenter_email: userEmail,
      comment: comment.trim(),
      created_at: new Date()
    };

    console.log('💾 Zapisywanie komentarza do bazy danych...');
    await db('transport_comments').insert(commentData);
    console.log('✅ Komentarz zapisany w bazie danych');

    // Pobierz adresatów powiadomień
    console.log('👥 Pobieranie adresatów powiadomień...');
    const recipients = await getNotificationRecipients(userEmail, transportId);
    console.log(`📧 Znaleziono adresatów: ${recipients.join(', ')}`);

    // Wyślij powiadomienia email
    let emailResult = { success: true, message: 'Brak adresatów do powiadomienia' };
    if (recipients.length > 0) {
      console.log('📮 Wysyłanie powiadomień email...');
      emailResult = await sendCommentNotification(userEmail, transport, comment.trim(), recipients);
      console.log(`📬 Wynik wysyłki: ${emailResult.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Komentarz został dodany',
      notification: emailResult
    })

  } catch (error) {
    console.error('❌ Błąd dodawania komentarza:', error)

    return NextResponse.json({
      success: false,
      error: 'Wystąpił błąd podczas dodawania komentarza: ' + error.message
    }, { status: 500 })
  }
}