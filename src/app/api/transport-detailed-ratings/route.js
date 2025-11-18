// src/app/api/transport-detailed-ratings/route.js - ROZSZERZONE O ROZWIĄZANIE PROBLEMU
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

// NOWA FUNKCJA: Sprawdzanie czy użytkownik jest adminem
const checkAdminStatus = async (userId) => {
  if (!userId) {
    return false;
  }
  
  try {
    const user = await db('users')
      .where('email', userId)
      .select('is_admin', 'role')
      .first();
    
    const isAdmin = 
      user?.is_admin === true || 
      user?.is_admin === 1 || 
      user?.is_admin === 't' || 
      user?.is_admin === 'TRUE' || 
      user?.is_admin === 'true' ||
      user?.role === 'admin';
    
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Funkcja wysyłania powiadomienia email
const sendRatingNotification = async (transportId, ratingId) => {
  try {
    const transport = await db('transports')
      .where('id', transportId)
      .select('*')
      .first();
    
    if (!transport) {
      return { success: false, error: 'Transport nie znaleziony' };
    }
    
    const rating = await db('transport_detailed_ratings')
      .where('id', ratingId)
      .select('*')
      .first();
    
    if (!rating) {
      return { success: false, error: 'Ocena nie znaleziona' };
    }
    
    const rater = await db('users')
      .where('email', rating.rater_email)
      .select('name', 'email')
      .first();
    
    const raterInfo = {
      name: rater ? rater.name : rating.rater_email,
      email: rating.rater_email
    };
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    const recipients = ['s.bialokoz@grupaeltron.pl', 'logistyka@grupaeltron.pl'];
    
    if (transport.requester_email && !recipients.includes(transport.requester_email)) {
      recipients.push(transport.requester_email);
    }
    
    const uniqueRecipients = [...new Set(recipients)];
    
    const formatRatingData = (rating) => {
      return [
        { label: 'Kierowca profesjonalny', key: 'driver_professional', value: rating.driver_professional },
        { label: 'Kierowca wykonał zadania', key: 'driver_tasks_completed', value: rating.driver_tasks_completed },
        { label: 'Ładunek kompletny', key: 'cargo_complete', value: rating.cargo_complete },
        { label: 'Ładunek poprawny', key: 'cargo_correct', value: rating.cargo_correct },
        { label: 'Powiadomienie o dostawie', key: 'delivery_notified', value: rating.delivery_notified },
        { label: 'Dostawa na czas', key: 'delivery_on_time', value: rating.delivery_on_time }
      ].map(item => ({
        label: item.label,
        value: item.value === true ? '✅ TAK' : '❌ NIE'
      }));
    };
    
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
          .problem-box { background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 10px; margin-bottom: 15px; border-radius: 4px; }
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
              <p><strong>Magazyn:</strong> ${transport.source_warehouse === 'bialystok' ? 'Białystok' : transport.source_warehouse === 'zielonka' ? 'Zielonka' : 'Nieznany'}</p>
            </div>
            
            <div class="section">
              <h2>⭐ Szczegóły oceny</h2>
              <p><strong>Ocenione przez:</strong> ${raterInfo.name} (${rating.rater_email})</p>
              <p><strong>Data oceny:</strong> ${ratingDate}</p>
              
              ${rating.other_problem ? `
                <div class="problem-box">
                  <strong>Typ oceny:</strong> Zgłoszono "Inny problem"
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
    `;
    
    const emailSubject = `🚛 Nowa ocena transportu #${transport.id} - ${transport.client_name || 'Klient nieznany'}`;
    const mailOptions = {
      from: `"System Transportowy" <logistyka@grupaeltron.pl>`,
      to: uniqueRecipients.join(', '),
      subject: emailSubject,
      html: htmlContent
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      recipients: uniqueRecipients,
      message: `Powiadomienie wysłane do ${uniqueRecipients.length} odbiorców`
    };
    
  } catch (error) {
    console.error('Błąd wysyłania powiadomienia o ocenie:', error);
    return { 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    };
  }
};

// GET /api/transport-detailed-ratings - ROZSZERZONE O INFORMACJĘ O ROZWIĄZANIU
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
    
    const tableExists = await db.schema.hasTable('transport_detailed_ratings');
    if (!tableExists) {
      return NextResponse.json({ 
        success: true, 
        rating: null,
        stats: { totalRatings: 0, overallRatingPercentage: null },
        canBeRated: userId ? true : false,
        hasUserRated: false,
        allRatings: [],
        hasResolution: false  // DODANE
      });
    }
    
    const allDetailedRatings = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .orderBy('created_at', 'desc')
      .select('*');
    
    const totalRatings = allDetailedRatings.length;
    
    let overallRatingPercentage = null;
    if (totalRatings > 0) {
      let totalCriteria = 0;
      let positiveCriteria = 0;
      
      allDetailedRatings.forEach(rating => {
        if (rating.other_problem === true) {
          totalCriteria += 6;
          positiveCriteria += 0;
          return;
        }

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
    
    // ZMIENIONE: Sprawdzanie czy można ocenić lub edytować - blokada gdy jest rozwiązanie
    const firstRating = allDetailedRatings[0];
    const hasResolution = firstRating?.admin_resolution ? true : false;
    const canBeRated = userId ? (totalRatings === 0 && !hasResolution) : false;
    const hasUserRated = userId ? 
      allDetailedRatings.some(r => r.rater_email === userId) : false;
    
    let rating = null;
    if (raterEmail) {
      rating = allDetailedRatings.find(r => r.rater_email === raterEmail);
    } else if (userId) {
      rating = allDetailedRatings.find(r => r.rater_email === userId);
    }
    
    // DODANE: Informacje o rozwiązaniu
    const resolutionInfo = hasResolution ? {
      text: firstRating.admin_resolution,
      addedBy: firstRating.resolution_added_by,
      addedAt: firstRating.resolution_added_at
    } : null;
    
    return NextResponse.json({ 
      success: true, 
      rating,
      stats: {
        totalRatings,
        overallRatingPercentage
      },
      canBeRated,
      hasUserRated,
      allRatings: allDetailedRatings,
      hasResolution,        // DODANE
      resolutionInfo        // DODANE
    });
  } catch (error) {
    console.error('Error fetching detailed rating:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/transport-detailed-ratings - BEZ ZMIAN (dodawanie/edytowanie oceny)
export async function POST(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { transportId, ratings, comment, otherProblem } = await request.json();
    
    if (!transportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane: wymagane transport ID' 
      }, { status: 400 });
    }
    
    // Walidacja: albo wszystkie oceny, albo "inny problem" z komentarzem
    if (otherProblem) {
      if (!comment || comment.trim() === '') {
        return NextResponse.json({ 
          success: false, 
          error: 'Przy wyborze "Inny problem" komentarz jest wymagany' 
        }, { status: 400 });
      }
    } else {
      const ratingKeys = ratings ? Object.values(ratings) : [];
      const allRated = ratingKeys.length === 6 && ratingKeys.every(r => r !== null && r !== undefined);
      
      if (!allRated) {
        return NextResponse.json({ 
          success: false, 
          error: 'Wszystkie 6 kryteriów musi być ocenionych (ani "null", ani "undefined")' 
        }, { status: 400 });
      }
    }

    const transport = await db('transports')
      .where('id', transportId)
      .select('status', 'source_warehouse')
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

    // DODANE: Sprawdzenie czy istnieje rozwiązanie - blokada edycji
    const existingRating = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .where('rater_email', userId)
      .first();

    if (existingRating?.admin_resolution) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie można edytować oceny - administrator dodał już rozwiązanie problemu' 
      }, { status: 403 });
    }

    const detailedRatingsExist = await db.schema.hasTable('transport_detailed_ratings');
    if (!detailedRatingsExist) {
      await db.schema.createTable('transport_detailed_ratings', (table) => {
        table.increments('id').primary();
        table.integer('transport_id').notNullable();
        table.string('rater_email').notNullable();
        table.string('rater_name');
        table.boolean('driver_professional');
        table.boolean('driver_tasks_completed');
        table.boolean('cargo_complete');
        table.boolean('cargo_correct');
        table.boolean('delivery_notified');
        table.boolean('delivery_on_time');
        table.boolean('other_problem').defaultTo(false);
        table.text('comment');
        table.timestamp('created_at').defaultTo(db.fn.now());
        
        table.index(['transport_id']);
        table.unique(['transport_id', 'rater_email']);
      });
    }

    const user = await db('users')
      .where('email', userId)
      .select('name')
      .first();

    const ratingData = {
      transport_id: transportId,
      rater_email: userId,
      rater_name: user?.name || userId,
      driver_professional: otherProblem ? null : ratings.driverProfessional,
      driver_tasks_completed: otherProblem ? null : ratings.driverTasksCompleted,
      cargo_complete: otherProblem ? null : ratings.cargoComplete,
      cargo_correct: otherProblem ? null : ratings.cargoCorrect,
      delivery_notified: otherProblem ? null : ratings.deliveryNotified,
      delivery_on_time: otherProblem ? null : ratings.deliveryOnTime,
      other_problem: otherProblem || false,
      comment: comment || '',
      created_at: new Date()
    };
    
    let ratingId;
    let isNewRating = false;
    
    if (existingRating) {
      await db('transport_detailed_ratings')
        .where('id', existingRating.id)
        .update(ratingData);
      ratingId = existingRating.id;
    } else {
      const insertResult = await db('transport_detailed_ratings')
        .insert(ratingData)
        .returning('id');
      ratingId = insertResult[0]?.id || insertResult[0];
      isNewRating = true;
    }
    
    if (isNewRating && ratingId) {
      try {
        await sendRatingNotification(transportId, ratingId);
      } catch (emailError) {
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

// NOWY ENDPOINT PUT - Dodanie rozwiązania problemu przez administratora
export async function PUT(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdzenie czy użytkownik jest adminem
    const isAdmin = await checkAdminStatus(userId);
    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tylko administrator może dodać rozwiązanie problemu' 
      }, { status: 403 });
    }
    
    const { transportId, resolution } = await request.json();
    
    if (!transportId || !resolution || resolution.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport ID i treść rozwiązania są wymagane' 
      }, { status: 400 });
    }
    
    // Sprawdź czy ocena istnieje
    const rating = await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .first();
    
    if (!rating) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie znaleziono oceny dla tego transportu' 
      }, { status: 404 });
    }
    
    // Sprawdź czy rozwiązanie już istnieje
    if (rating.admin_resolution) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rozwiązanie zostało już dodane dla tego transportu' 
      }, { status: 409 });
    }
    
    // Zapisz rozwiązanie
    await db('transport_detailed_ratings')
      .where('transport_id', transportId)
      .update({
        admin_resolution: resolution,
        resolution_added_by: userId,
        resolution_added_at: new Date()
      });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Rozwiązanie problemu zostało dodane. Ocena jest teraz zablokowana.'
    });
    
  } catch (error) {
    console.error('Error adding resolution:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Wystąpił błąd podczas zapisywania rozwiązania: ' + error.message 
    }, { status: 500 });
  }
}