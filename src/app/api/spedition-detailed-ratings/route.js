// src/app/api/spedition-detailed-ratings/route.js - ROZSZERZONE O ROZWIĄZANIE PROBLEMU I POWIADOMIENIA
import { NextResponse } from 'next/server'
import db from '@/database/db'
import nodemailer from 'nodemailer'
import { validateSession } from '@/lib/auth'

// NOWA FUNKCJA: Sprawdzanie czy użytkownik jest adminem
const checkAdminStatus = async (userId) => {
  if (!userId) {
    return false
  }

  try {
    const user = await db('users')
      .where('email', userId)
      .select('is_admin', 'role')
      .first()

    const isAdmin =
      user?.is_admin === true ||
      user?.is_admin === 1 ||
      user?.is_admin === 't' ||
      user?.is_admin === 'TRUE' ||
      user?.is_admin === 'true' ||
      user?.role === 'admin'

    return isAdmin
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// Funkcja do formatowania danych oceny (Dopasowana do spedycji)
const formatRatingData = (rating) => {
  const criteria = [
    { key: 'carrier_professional', label: 'Przewoźnik profesjonalny' },
    { key: 'loading_on_time', label: 'Załadunek na czas' },
    { key: 'cargo_complete', label: 'Towar kompletny' },
    { key: 'cargo_undamaged', label: 'Towar nieuszkodzony' },
    { key: 'delivery_notified', label: 'Powiadomienie o dostawie' },
    { key: 'delivery_on_time', label: 'Dostawa na czas' },
    { key: 'documents_complete', label: 'Dokumenty kompletne' },
    { key: 'documents_correct', label: 'Dokumenty poprawne' }
  ];

  return criteria.map(criterion => ({
    label: criterion.label,
    value: rating[criterion.key] ? '✅ TAK' : '❌ NIE'
  }));
};

// Funkcja do tworzenia HTML emaila
const generateRatingNotificationHTML = (spedition, rating, raterInfo) => {
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
        .problem-box { background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 10px; margin-bottom: 15px; border-radius: 4px; }
        .footer { background: #6B7280; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚛 Nowa Ocena Spedycji</h1>
          <p>Transport spedycyjny został oceniony w systemie</p>
        </div>
        
        <div class="content">
          <div class="section transport-info">
            <h2>📋 Informacje o spedycji</h2>
            <p><strong>ID Spedycji:</strong> #${spedition.id}</p>
            <p><strong>Klient:</strong> ${spedition.client_name || 'Nie podano'}</p>
            <p><strong>Miejscowość:</strong> ${spedition.destination_city || 'Nie podano'}</p>
            <p><strong>Kod pocztowy:</strong> ${spedition.destination_zip || 'Nie podano'}</p>
            <p><strong>Ulica:</strong> ${spedition.street || 'Nie podano'}</p>
            <p><strong>Data załadunku:</strong> ${spedition.loading_date ? new Date(spedition.loading_date).toLocaleDateString('pl-PL') : 'Nie podano'}</p>
            <p><strong>Data dostawy:</strong> ${spedition.delivery_date ? new Date(spedition.delivery_date).toLocaleDateString('pl-PL') : 'Nie podano'}</p>
            <p><strong>Rejestracja:</strong> ${spedition.plate_numbers || 'Nie podano'}</p>
          </div>
          
          <div class="section">
            <h2>⭐ Szczegóły oceny</h2>
            <p><strong>Ocenione przez:</strong> ${raterInfo.name} (${rating.rater_email})</p>
            <p><strong>Data oceny:</strong> ${ratingDate}</p>
            
            ${rating.other_problem ? `
              <div class="problem-box">
                <strong>Typ oceny:</strong> 🚨 Zgłoszono "Inny problem"
              </div>
            ` : `
              <div class="rating-grid">
                ${criteriaFormatted.map(item => `
                  <div class="rating-item ${item.value.includes('✅') ? 'positive' : 'negative'}">
                    <strong>${item.label}:</strong><br>
                    ${item.value}
                  </div>
                `).join('')}
              </div>
            `}
            
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
  `
}

// Funkcja wysyłania powiadomienia email
const sendRatingNotification = async (speditionId, ratingId) => {
  try {
    const spedition = await db('spedycje')
      .where('id', speditionId)
      .select('*')
      .first();

    if (!spedition) {
      console.log('❌ Spedycja nie znaleziona');
      return { success: false, error: 'Spedycja nie znaleziona' };
    }

    const rating = await db('spedition_detailed_ratings')
      .where('id', ratingId)
      .select('*')
      .first();

    if (!rating) {
      console.log('❌ Ocena nie znaleziona');
      return { success: false, error: 'Ocena nie znaleziona' };
    }

    // Pobierz informacje o osobie oceniającej
    const rater = await db('users')
      .where('email', rating.rater_email)
      .select('name', 'email')
      .first();

    const raterInfo = {
      name: rater ? rater.name : 'Nieznany użytkownik',
      email: rating.rater_email
    };

    // Definiowanie stałych odbiorców
    const recipients = [
      'mateusz.klewinowski@grupaeltron.pl'
    ];

    // Logika dla spedycji (zazwyczaj oddział logistyki/handlowy, ale user prosił o t.kozlowski)
    recipients.push('t.kozlowski@grupaeltron.pl');

    // Dodaj zgłaszającego (często handlowiec)
    if (spedition.created_by_email) {
      recipients.push(spedition.created_by_email);
    }

    // Usuń duplikaty
    const uniqueRecipients = [...new Set(recipients)];

    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ Brak hasła SMTP - powiadomienie nie zostanie wysłane!');
      return {
        success: false,
        error: 'Konfiguracja SMTP nie jest dostępna'
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || "logistyka@grupaeltron.pl",
        pass: process.env.SMTP_PASSWORD
      }
    });

    const htmlContent = generateRatingNotificationHTML(spedition, rating, raterInfo);

    const clientName = spedition.client_name || 'Klient nieznany';
    const emailSubject = `🚛 Nowa ocena spedycji #${spedition.id} - ${clientName}`;

    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: uniqueRecipients.join(', '),
      subject: emailSubject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email wysłany do ${uniqueRecipients.length} odbiorców`);

    return {
      success: true,
      messageId: info.messageId,
      recipients: uniqueRecipients,
      message: `Powiadomienie wysłane do ${uniqueRecipients.length} odbiorców`
    };

  } catch (error) {
    console.error('❌ Błąd wysyłania powiadomienia o ocenie:', error);
    return {
      success: false,
      error: 'Błąd serwera: ' + error.message
    };
  }
};

// Funkcja wysyłania powiadomienia o rozwiązaniu problemu (Spedycja)
const sendResolutionNotification = async (spedition, rating, resolution) => {
  try {
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ Brak hasła SMTP - powiadomienie o rozwiązaniu nie zostanie wysłane!');
      return { success: false, error: 'Brak konfiguracji SMTP' };
    }

    // Odbiorca to osoba zgłaszająca problem (rater_email)
    const recipients = [rating.rater_email];

    // Dodaj stałych odbiorców do DW
    recipients.push('mateusz.klewinowski@grupaeltron.pl');

    const uniqueRecipients = [...new Set(recipients)];

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: "logistyka@grupaeltron.pl",
        pass: process.env.SMTP_PASSWORD
      }
    });

    const emailSubject = `✅ Rozwiązano problem: Spedycja #${spedition.id} - ${spedition.client_name || 'Klient'}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7C3AED; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .section { margin-bottom: 20px; }
          .transport-info { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #7C3AED; }
          .resolution-box { background: #F3E8FF; border-left: 4px solid #7C3AED; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .footer { background: #6B7280; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Rozwiązanie Problemu</h1>
            <p>Administrator dodał rozwiązanie do zgłoszonego problemu (Spedycja)</p>
          </div>
          
          <div class="content">
            <div class="section transport-info">
              <h2>📋 Informacje o spedycji</h2>
              <p><strong>ID Spedycji:</strong> #${spedition.id}</p>
              <p><strong>Klient:</strong> ${spedition.client_name || 'Nie podano'}</p>
              <p><strong>Miejscowość:</strong> ${spedition.destination_city || 'Nie podano'}</p>
            </div>
            
            <div class="section">
              <h2>🛡️ Rozwiązanie (Administrator)</h2>
              <div class="resolution-box">
                <p><strong>Treść rozwiązania:</strong></p>
                <p style="white-space: pre-wrap;">${resolution}</p>
                <p style="font-size: 12px; color: #6B7280; margin-top: 10px;">Data dodania: ${new Date().toLocaleString('pl-PL')}</p>
              </div>
              
              <p>Twoja ocena została zablokowana i uznana za rozwiązaną.</p>
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

    await transporter.sendMail({
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: uniqueRecipients.join(', '),
      subject: emailSubject,
      html: htmlContent
    });

    console.log(`✅ Email o rozwiązaniu wysłany do ${uniqueRecipients.join(', ')}`);
    return { success: true };

  } catch (error) {
    console.error('❌ Błąd wysyłania powiadomienia o rozwiązaniu:', error);
    return { success: false, error: error.message };
  }
};

// GET - Pobierz oceny transportu spedycyjnego - POPRAWIONE SPRAWDZANIE RESOLUTION
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const speditionId = searchParams.get('speditionId')
    const raterEmail = searchParams.get('raterEmail')

    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)

    if (!speditionId) {
      return NextResponse.json({
        success: false,
        error: 'Spedition ID is required'
      }, { status: 400 })
    }

    const tableExists = await db.schema.hasTable('spedition_detailed_ratings')
    if (!tableExists) {
      return NextResponse.json({
        success: true,
        rating: null,
        stats: { totalRatings: 0, overallRatingPercentage: null },
        canBeRated: userId ? true : false,
        hasUserRated: false,
        allRatings: [],
        hasResolution: false
      })
    }

    let allDetailedRatings = []
    try {
      allDetailedRatings = await db('spedition_detailed_ratings')
        .where('spedition_id', speditionId)
        .orderBy('id', 'desc')
        .select('*')
    } catch (error) {
      console.error('Błąd pobierania ocen spedycji:', error)
      allDetailedRatings = []
    }

    const totalRatings = allDetailedRatings.length

    let overallRatingPercentage = null
    if (totalRatings > 0) {
      let totalCriteria = 0
      let positiveCriteria = 0

      allDetailedRatings.forEach(rating => {
        if (rating.other_problem === true) {
          totalCriteria += 8
          positiveCriteria += 0
          return
        }

        const criteria = [
          rating.carrier_professional,
          rating.loading_on_time,
          rating.cargo_complete,
          rating.cargo_undamaged,
          rating.delivery_notified,
          rating.delivery_on_time,
          rating.documents_complete,
          rating.documents_correct
        ]

        criteria.forEach(criterion => {
          if (criterion !== null) {
            totalCriteria++
            if (criterion === true) positiveCriteria++
          }
        })
      })

      overallRatingPercentage = totalCriteria > 0 ?
        Math.round((positiveCriteria / totalCriteria) * 100) : null
    }

    // =================================================================
    // POPRAWIONA LOGIKA SPRAWDZANIA RESOLUTION
    // Sprawdzamy w bazie, czy istnieje jakikolwiek wpis z rozwiązaniem.
    // =================================================================
    const resolutionCheck = await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .whereNotNull('admin_resolution') // Szukamy wpisu, gdzie resolution nie jest puste
      .orderBy('resolution_added_at', 'desc')
      .select('admin_resolution', 'resolution_added_by', 'resolution_added_at')
      .first();

    const hasResolution = resolutionCheck ? true : false;

    // ZMIENIONE: Sprawdzanie czy można ocenić lub edytować - używa hasResolution
    const canBeRated = userId ? (totalRatings === 0 && !hasResolution) : false
    const hasUserRated = userId ?
      allDetailedRatings.some(r => r.rater_email === userId) : false

    let rating = null
    if (raterEmail) {
      rating = allDetailedRatings.find(r => r.rater_email === raterEmail)
    } else if (userId) {
      rating = allDetailedRatings.find(r => r.rater_email === userId)
    }

    // DODANE: Informacje o rozwiązaniu (używa resolutionCheck)
    const resolutionInfo = hasResolution ? {
      text: resolutionCheck.admin_resolution,
      addedBy: resolutionCheck.resolution_added_by,
      addedAt: resolutionCheck.resolution_added_at
    } : null

    const latestRating = allDetailedRatings.length > 0 ? allDetailedRatings[0] : null;

    return NextResponse.json({
      success: true,
      rating,
      latestRating,
      stats: {
        totalRatings,
        overallRatingPercentage
      },
      canBeRated,
      hasUserRated,
      allRatings: allDetailedRatings,
      hasResolution,        // PRAWIDŁOWA FLAGA
      resolutionInfo        // PRAWIDŁOWY OBIEKT
    })
  } catch (error) {
    console.error('Error fetching spedition rating:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Dodaj/aktualizuj ocenę transportu spedycyjnego
export async function POST(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const { speditionId, ratings, comment, otherProblem } = await request.json()

    if (!speditionId) {
      return NextResponse.json({
        success: false,
        error: 'Brakujące dane: wymagane spedition ID'
      }, { status: 400 })
    }

    // Walidacja: albo wszystkie oceny, albo "inny problem" z komentarzem
    if (otherProblem) {
      if (!comment || comment.trim() === '') {
        return NextResponse.json({
          success: false,
          error: 'Przy wyborze "Inny problem" komentarz jest wymagany'
        }, { status: 400 })
      }
    } else {
      if (!ratings || Object.values(ratings).some(r => r === null || r === undefined)) {
        return NextResponse.json({
          success: false,
          error: 'Wszystkie kryteria muszą być ocenione'
        }, { status: 400 })
      }
    }

    const spedition = await db('spedycje')
      .where('id', speditionId)
      // Pobieramy więcej pól do maila
      .select('status', 'location', 'created_by_email', 'client_name', 'location_data', 'delivery_data', 'response_data', 'delivery_date')
      .first()

    if (!spedition) {
      return NextResponse.json({
        success: false,
        error: 'Transport spedycyjny nie istnieje'
      }, { status: 404 })
    }

    // Parsowanie danych JSON w celu wyciągnięcia brakujących pól
    let producerData = {};
    let deliveryData = {};
    let responseData = {};

    try {
      if (spedition.location_data) {
        producerData = typeof spedition.location_data === 'string'
          ? JSON.parse(spedition.location_data)
          : spedition.location_data;
      }
      if (spedition.delivery_data) {
        deliveryData = typeof spedition.delivery_data === 'string'
          ? JSON.parse(spedition.delivery_data)
          : spedition.delivery_data;
      }
      if (spedition.response_data) {
        responseData = typeof spedition.response_data === 'string'
          ? JSON.parse(spedition.response_data)
          : spedition.response_data;
      }
    } catch (e) {
      console.error('Błąd parsowania danych JSON:', e);
    }

    // Uzupełnienie obiektu spedition o pola wymagane w mailu
    spedition.destination_city = deliveryData.city || '';
    spedition.destination_zip = deliveryData.postalCode || '';
    spedition.street = deliveryData.street || '';

    // Data załadunku zwykle jest w location_data (producerAddress) lub trzeba ją pobrać z innego źródła jeśli istnieje
    // W tabeli nie ma loading_date, sprawdzamy czy jest w JSON
    spedition.loading_date = producerData.date || null;

    // Rejestracja z odpowiedzi przewoźnika
    spedition.plate_numbers = responseData.vehicleNumber || 'Brak danych';

    if (spedition.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Można ocenić tylko ukończone transporty'
      }, { status: 400 })
    }

    // DODANE: Sprawdzenie czy istnieje rozwiązanie - blokada edycji
    const existingRating = await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .where('rater_email', userId)
      .first()

    if (existingRating?.admin_resolution) {
      return NextResponse.json({
        success: false,
        error: 'Nie można edytować oceny - administrator dodał już rozwiązanie problemu'
      }, { status: 403 })
    }

    const detailedRatingsExist = await db.schema.hasTable('spedition_detailed_ratings')

    if (!detailedRatingsExist) {
      await db.schema.createTable('spedition_detailed_ratings', (table) => {
        table.increments('id').primary()
        table.integer('spedition_id').notNullable()
        table.string('rater_email').notNullable()
        table.string('rater_name')
        table.boolean('carrier_professional')
        table.boolean('loading_on_time')
        table.boolean('cargo_complete')
        table.boolean('cargo_undamaged')
        table.boolean('delivery_notified')
        table.boolean('delivery_on_time')
        table.boolean('documents_complete')
        table.boolean('documents_correct')
        table.boolean('other_problem').defaultTo(false)
        table.text('comment')
        table.timestamp('rated_at').defaultTo(db.fn.now())

        table.index(['spedition_id'])
        table.unique(['spedition_id', 'rater_email'])
      })
    }

    const user = await db('users')
      .where('email', userId)
      .select('name')
      .first()

    const ratingData = {
      spedition_id: speditionId,
      rater_email: userId,
      rater_name: user?.name || userId,
      carrier_professional: otherProblem ? null : ratings.carrierProfessional,
      loading_on_time: otherProblem ? null : ratings.loadingOnTime,
      cargo_complete: otherProblem ? null : ratings.cargoComplete,
      cargo_undamaged: otherProblem ? null : ratings.cargoUndamaged,
      delivery_notified: otherProblem ? null : ratings.deliveryNotified,
      delivery_on_time: otherProblem ? null : ratings.deliveryOnTime,
      documents_complete: otherProblem ? null : ratings.documentsComplete,
      documents_correct: otherProblem ? null : ratings.documentsCorrect,
      other_problem: otherProblem || false,
      comment: comment || ''
    }

    let ratingId
    let isNewRating = false

    if (existingRating) {
      await db('spedition_detailed_ratings')
        .where('id', existingRating.id)
        .update(ratingData)

      ratingId = existingRating.id
    } else {
      const insertResult = await db('spedition_detailed_ratings')
        .insert(ratingData)
        .returning('id')

      ratingId = insertResult[0]?.id || insertResult[0]
      isNewRating = true
    }

    // WYŚLIJ POWIADOMIENIE (tylko dla nowej oceny, lub zawsze? Zwykle przy nowej lub edycji)
    // Bezpieczniej wysłać zawsze żeby logistyka widziała zmianę, albo chociaż przy nowej
    if (ratingId) {
      try {
        await sendRatingNotification(speditionId, ratingId);
      } catch (emailError) {
        console.error('Błąd wysyłania powiadomienia email (nie przerywa procesu):', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: existingRating ? 'Ocena spedycji została zaktualizowana i wysłana' : 'Ocena spedycji została dodana i wysłana',
      ratingId: ratingId
    })

  } catch (error) {
    console.error('Error adding spedition rating:', error)

    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({
        success: false,
        error: 'Już oceniłeś ten transport spedycyjny. Spróbuj odświeżyć stronę.'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: 'Wystąpił błąd podczas zapisywania oceny: ' + error.message
    }, { status: 500 })
  }
}

// NOWY ENDPOINT PUT - Dodanie rozwiązania problemu przez administratora
export async function PUT(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value
    const userId = await validateSession(authToken)

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Sprawdzenie czy użytkownik jest adminem
    const isAdmin = await checkAdminStatus(userId)
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Tylko administrator może dodać rozwiązanie problemu'
      }, { status: 403 })
    }

    const { speditionId, resolution } = await request.json()

    if (!speditionId || !resolution || resolution.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Spedition ID i treść rozwiązania są wymagane'
      }, { status: 400 })
    }

    // Sprawdź czy ocena istnieje
    const rating = await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .first()

    if (!rating) {
      return NextResponse.json({
        success: false,
        error: 'Nie znaleziono oceny dla tego transportu spedycyjnego'
      }, { status: 404 })
    }

    // Sprawdź czy rozwiązanie już istnieje
    if (rating.admin_resolution) {
      return NextResponse.json({
        success: false,
        error: 'Rozwiązanie zostało już dodane dla tego transportu'
      }, { status: 409 })
    }

    // Zapisz rozwiązanie
    await db('spedition_detailed_ratings')
      .where('spedition_id', speditionId)
      .update({
        admin_resolution: resolution,
        resolution_added_by: userId,
        resolution_added_at: new Date()
      })

    // Pobierz dane transportu do maila
    const spedition = await db('spedycje')
      .where('id', speditionId)
      .select('*')
      .first()

    // Wyślij powiadomienie mailowe o rozwiązaniu
    if (spedition) {
      sendResolutionNotification(spedition, rating, resolution).catch(e => console.error(e));
    }

    return NextResponse.json({
      success: true,
      message: 'Rozwiązanie problemu zostało dodane. Ocena jest teraz zablokowana.'
    })

  } catch (error) {
    console.error('Error adding resolution:', error)
    return NextResponse.json({
      success: false,
      error: 'Wystąpił błąd podczas zapisywania rozwiązania: ' + error.message
    }, { status: 500 })
  }
}