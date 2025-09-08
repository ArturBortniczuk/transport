// src/app/api/transport-detailed-ratings/route.js - NAPRAWIONA WERSJA
import { NextResponse } from 'next/server';
import db from '@/database/db';
import nodemailer from 'nodemailer';

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

// NAPRAWIONA FUNKCJA - bezpośrednie wysyłanie emaila zamiast fetch
const sendRatingNotification = async (transportId, ratingId) => {
  try {
    console.log('🚀 DEBUG: Rozpoczynam wysyłanie powiadomienia o ocenie...');
    console.log(`📝 DEBUG: Transport ID: ${transportId}, Rating ID: ${ratingId}`);
    
    // Pobierz szczegóły transportu
    console.log('🔍 DEBUG: Pobieram szczegóły transportu...');
    const transport = await db('transports')
      .where('id', transportId)
      .select('*')
      .first();
    
    if (!transport) {
      console.log('❌ DEBUG: Transport nie znaleziony');
      return { success: false, error: 'Transport nie znaleziony' };
    }
    
    console.log(`✅ DEBUG: Transport znaleziony: ${transport.client_name} - ${transport.destination_city}`);
    
    // Pobierz szczegóły oceny
    console.log('🔍 DEBUG: Pobieram szczegóły oceny...');
    const rating = await db('transport_detailed_ratings')
      .where('id', ratingId)
      .select('*')
      .first();
    
    if (!rating) {
      console.log('❌ DEBUG: Ocena nie znaleziona');
      return { success: false, error: 'Ocena nie znaleziona' };
    }
    
    console.log(`✅ DEBUG: Ocena znaleziona - ocenił: ${rating.rater_email}`);
    
    // Pobierz informacje o osobie oceniającej
    console.log('🔍 DEBUG: Pobieram dane osoby oceniającej...');
    const rater = await db('users')
      .where('email', rating.rater_email)
      .select('name', 'email')
      .first();
    
    const raterInfo = {
      name: rater ? rater.name : 'Nieznany użytkownik',
      email: rating.rater_email
    };
    
    console.log(`👤 DEBUG: Osoba oceniająca: ${raterInfo.name} (${raterInfo.email})`);
    
    // Pobierz kierowników magazynów
    console.log('🔍 DEBUG: Rozpoczynam pobieranie kierowników magazynów...');
    const managers = await db('users')
      .where('role', 'like', '%magazyn%')
      .orWhere('role', 'admin')
      .select('email', 'name', 'role')
      .whereNotNull('email');
    
    console.log('📋 DEBUG: Znalezieni kierownicy magazynów:');
    managers.forEach((manager, index) => {
      console.log(`   ${index + 1}. ${manager.name} (${manager.email}) - rola: ${manager.role}`);
    });
    console.log(`✅ DEBUG: Łącznie znaleziono ${managers.length} kierowników`);
    
    // Lista stałych odbiorców
    const staticRecipients = [
      'mateusz.klewinowski@grupaeltron.pl',
      'a.bortniczuk@grupaeltron.pl'
    ];
    
    console.log('📧 DEBUG: Stali odbiorcy powiadomień:');
    staticRecipients.forEach((email, index) => {
      console.log(`   ${index + 1}. ${email}`);
    });
    
    // Lista odbiorców - kierownicy magazynów + stali odbiorcy
    const recipients = [
      ...managers.map(manager => manager.email),
      ...staticRecipients
    ];
    
    // Usuń duplikaty
    const uniqueRecipients = [...new Set(recipients)];
    
    console.log('📋 DEBUG: FINALNA LISTA ODBIORCÓW:');
    uniqueRecipients.forEach((email, index) => {
      console.log(`   ${index + 1}. ${email}`);
    });
    console.log(`📊 DEBUG: Łącznie zostanie wysłanych ${uniqueRecipients.length} emaili`);
    
    // Sprawdź konfigurację SMTP
    console.log('🔧 DEBUG: Sprawdzam konfigurację SMTP...');
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ DEBUG: Brak hasła SMTP - powiadomienie nie zostanie wysłane!');
      return { success: false, error: 'Konfiguracja SMTP nie jest dostępna' };
    }
    console.log('✅ DEBUG: Konfiguracja SMTP OK');
    
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
    
    // Generuj HTML emaila
    console.log('📄 DEBUG: Generuję treść emaila...');
    const criteriaFormatted = formatRatingData(rating);
    const ratingDate = new Date(rating.created_at).toLocaleString('pl-PL');
    
    const htmlContent = `
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
                <div class="section">
                  <h3>💬 Komentarz</h3>
                  <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #6B7280;">
                    ${rating.comment}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="footer">
            <p>System Zarządzania Transportem - Grupa Eltron</p>
            <p>Powiadomienie wygenerowane automatycznie</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Przygotuj opcje emaila
    const emailSubject = `🚛 Nowa ocena transportu #${transport.id} - ${transport.client_name || 'Klient nieznany'}`;
    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: uniqueRecipients.join(', '),
      subject: emailSubject,
      html: htmlContent
    };
    
    console.log(`📧 DEBUG: Temat emaila: "${emailSubject}"`);
    console.log('📤 DEBUG: Wysyłam email...');
    
    // Wyślij email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ DEBUG: Email został wysłany pomyślnie!');
    console.log(`📧 DEBUG: Message ID: ${info.messageId}`);
    console.log(`📊 DEBUG: Wysłano do ${uniqueRecipients.length} odbiorców`);
    
    // Szczegółowy log odbiorców
    console.log('📋 DEBUG: PODSUMOWANIE WYSYŁKI:');
    console.log(`   Transport: #${transport.id} - ${transport.client_name}`);
    console.log(`   Ocenił: ${raterInfo.name} (${raterInfo.email})`);
    console.log(`   Odbiorcy: ${uniqueRecipients.join(', ')}`);
    console.log(`   Status: WYSŁANE ✅`);
    
    return {
      success: true,
      messageId: info.messageId,
      recipients: uniqueRecipients,
      message: `Powiadomienie wysłane do ${uniqueRecipients.length} odbiorców`
    };
    
  } catch (error) {
    console.error('❌ DEBUG: Błąd wysyłania powiadomienia o ocenie:', error);
    console.error('❌ DEBUG: Stack trace:', error.stack);
    
    return { 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    };
  }
};

// GET /api/transport-detailed-ratings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transportId = searchParams.get('transportId');
    const raterEmail = searchParams.get('raterEmail');
    
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!transportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport ID is required' 
      }, { status: 400 });
    }
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('transport_detailed_ratings');
    if (!tableExists) {
      return NextResponse.json({ 
        success: true, 
        rating: null,
        stats: { totalRatings: 0, overallRatingPercentage: null },
        canBeRated: userId ? true : false,
        hasUserRated: false,
        allRatings: []
      });
    }
    
    // Pobierz wszystkie oceny dla transportu
    const allDetailedRatings = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .orderBy('created_at', 'desc')
      .select('*');
    
    const totalRatings = allDetailedRatings.length;
    
    // Oblicz ogólny procent pozytywnych ocen
    let overallRatingPercentage = null;
    if (totalRatings > 0) {
      let totalCriteria = 0;
      let positiveCriteria = 0;
      
      allDetailedRatings.forEach(rating => {
        const criteria = [
          rating.driver_professional,
          rating.driver_tasks_completed,
          rating.cargo_complete,
          rating.cargo_correct,
          rating.delivery_notified,
          rating.delivery_on_time
        ];
        
        criteria.forEach(criterion => {
          if (criterion !== null) {
            totalCriteria++;
            if (criterion === true) positiveCriteria++;
          }
        });
      });
      
      overallRatingPercentage = totalCriteria > 0 ? 
        Math.round((positiveCriteria / totalCriteria) * 100) : null;
    }
    
    // Sprawdź czy użytkownik może ocenić i czy już ocenił
    const canBeRated = userId ? totalRatings === 0 : false;
    const hasUserRated = userId ? 
      allDetailedRatings.some(r => r.rater_email === userId) : false;
    
    // Pobierz konkretną ocenę użytkownika jeśli podano raterEmail
    let rating = null;
    if (raterEmail) {
      rating = allDetailedRatings.find(r => r.rater_email === raterEmail);
    } else if (userId) {
      rating = allDetailedRatings.find(r => r.rater_email === userId);
    }
    
    return NextResponse.json({ 
      success: true, 
      rating,
      stats: {
        totalRatings,
        overallRatingPercentage
      },
      canBeRated,
      hasUserRated,
      allRatings: allDetailedRatings
    });
  } catch (error) {
    console.error('Error fetching detailed rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/transport-detailed-ratings - NAPRAWIONA WERSJA
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
    
    const { transportId, ratings, comment } = await request.json();
    
    console.log('Otrzymane dane oceny:', { transportId, ratings, comment });
    
    if (!transportId || !ratings) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane: wymagane transport ID i oceny' 
      }, { status: 400 });
    }
    
    // Sprawdź czy transport istnieje i można go ocenić
    const transport = await db('transports')
      .where('id', transportId)
      .select('status')
      .first();
    
    if (!transport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport nie istnieje' 
      }, { status: 404 });
    }

    if (transport.status !== 'completed') {
      return NextResponse.json({ 
        success: false, 
        error: 'Można ocenić tylko ukończone transporty' 
      }, { status: 400 });
    }

    // Sprawdź czy tabela szczegółowych ocen istnieje, jeśli nie - utwórz ją
    const detailedRatingsExist = await db.schema.hasTable('transport_detailed_ratings');
    
    if (!detailedRatingsExist) {
      await db.schema.createTable('transport_detailed_ratings', (table) => {
        table.increments('id').primary();
        table.integer('transport_id').notNullable();
        table.string('rater_email').notNullable();
        table.boolean('driver_professional');
        table.boolean('driver_tasks_completed');
        table.boolean('cargo_complete');
        table.boolean('cargo_correct');
        table.boolean('delivery_notified');
        table.boolean('delivery_on_time');
        table.text('comment');
        table.timestamp('created_at').defaultTo(db.fn.now());
        
        table.index(['transport_id']);
        table.unique(['transport_id', 'rater_email']);
      });
    }

    // Sprawdź czy użytkownik już ocenił ten transport
    const existingRating = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .where('rater_email', userId)
      .first();

    const ratingData = {
      transport_id: transportId,
      rater_email: userId,
      driver_professional: ratings.driverProfessional,
      driver_tasks_completed: ratings.driverTasksCompleted,
      cargo_complete: ratings.cargoComplete,
      cargo_correct: ratings.cargoCorrect,
      delivery_notified: ratings.deliveryNotified,
      delivery_on_time: ratings.deliveryOnTime,
      comment: comment || '',
      created_at: new Date()
    };
    
    console.log('Dane do zapisu:', ratingData);
    
    let ratingId;
    let isNewRating = false;
    
    if (existingRating) {
      // Aktualizuj istniejącą ocenę
      console.log('Aktualizowanie szczegółowej oceny dla użytkownika:', userId);
      await db('transport_detailed_ratings')
        .where('id', existingRating.id)
        .update(ratingData);
      
      ratingId = existingRating.id;
    } else {
      // Dodaj nową ocenę
      console.log('Dodawanie nowej szczegółowej oceny dla użytkownika:', userId);
      const insertResult = await db('transport_detailed_ratings')
        .insert(ratingData)
        .returning('id');
      
      ratingId = insertResult[0]?.id || insertResult[0];
      isNewRating = true;
    }
    
    // NAPRAWIONE: Wyślij powiadomienie email tylko dla nowych ocen - bezpośrednio!
    if (isNewRating && ratingId) {
      console.log('Wysyłanie powiadomienia email o nowej ocenie...');
      try {
        // Wywołaj funkcję bezpośrednio (bez fetch)
        const notificationResult = await sendRatingNotification(transportId, ratingId);
        console.log('Powiadomienie email wysłane:', notificationResult);
      } catch (emailError) {
        // Nie przerywaj procesu jeśli email się nie wyśle
        console.error('Błąd wysyłania powiadomienia email (nie przerywa procesu):', emailError);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: existingRating ? 'Szczegółowa ocena została zaktualizowana' : 'Szczegółowa ocena została dodana i powiadomienie wysłane',
      ratingId: ratingId
    });
    
  } catch (error) {
    console.error('Error adding detailed transport rating:', error);
    
    // Sprawdź czy błąd to duplikat klucza
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Już oceniłeś ten transport. Spróbuj odświeżyć stronę.' 
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas zapisywania oceny: ' + error.message 
    }, { status: 500 });
  }
}