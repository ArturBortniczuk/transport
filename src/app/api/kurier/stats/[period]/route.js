// PLIK: src/app/api/kurier/stats/[period]/route.js
// Poprawiony kod - obsługuje brakujące kolumny

// src/app/api/kurier/stats/[period]/route.js
import { NextResponse } from 'next/server';
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

// Funkcja pomocnicza do sprawdzania czy kolumna istnieje
const checkColumnExists = async (tableName, columnName) => {
  try {
    const columns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ? 
      AND column_name = ?
      AND table_schema = 'public'
    `, [tableName, columnName]);
    
    return columns.rows.length > 0;
  } catch (error) {
    console.error(`Błąd sprawdzania kolumny ${columnName}:`, error);
    return false;
  }
};

// Funkcja pomocnicza do generowania warunków czasowych dla PostgreSQL
const getTimeCondition = (period) => {
  switch (period) {
    case '7':
      return "created_at >= NOW() - INTERVAL '7 days'";
    case '30':
      return "created_at >= NOW() - INTERVAL '30 days'";
    case '90':
      return "created_at >= NOW() - INTERVAL '90 days'";
    case '365':
      return "created_at >= NOW() - INTERVAL '365 days'";
    case 'today':
      return "DATE(created_at) = CURRENT_DATE";
    case 'week':
      return "created_at >= DATE_TRUNC('week', NOW())";
    case 'month':
      return "created_at >= DATE_TRUNC('month', NOW())";
    case 'year':
      return "created_at >= DATE_TRUNC('year', NOW())";
    default:
      return null; // all time
  }
};

// GET - Pobierz szczegółowe statystyki dla określonego okresu
export async function GET(request, { params }) {
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

    const { period } = params;
    const { searchParams } = new URL(request.url);
    const archive = searchParams.get('archive') === 'true';
    const includeDetails = searchParams.get('details') === 'true';

    console.log(`📊 Pobieranie statystyk dla okresu: ${period}, archiwum: ${archive}`);

    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('kuriers');
    if (!tableExists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tabela kuriers nie istnieje' 
      }, { status: 500 });
    }

    // Sprawdź jakie kolumny istnieją
    const hasServiceType = await checkColumnExists('kuriers', 'service_type');
    const hasPackageWeight = await checkColumnExists('kuriers', 'package_weight');
    const hasPackageValue = await checkColumnExists('kuriers', 'package_value');
    const hasCodAmount = await checkColumnExists('kuriers', 'cod_amount');
    const hasRecipientCity = await checkColumnExists('kuriers', 'recipient_city');

    // Buduj podstawowe zapytanie
    let baseQuery = db('kuriers');
    
    // Dodaj warunek czasowy
    const timeCondition = getTimeCondition(period);
    if (timeCondition) {
      baseQuery = baseQuery.whereRaw(timeCondition);
    }

    // Filtruj według archiwum/aktywne
    if (archive) {
      baseQuery = baseQuery.whereIn('status', ['approved', 'sent', 'delivered']);
    } else {
      baseQuery = baseQuery.where('status', 'new');
    }

    // 1. Podstawowe liczniki
    const totalCount = await baseQuery.clone().count('* as count').first();
    
    // 2. Statystyki według statusów
    const statusStats = await baseQuery.clone()
      .select('status')
      .count('* as count')
      .groupBy('status');

    // 3. Statystyki według magazynów
    const magazineStats = await baseQuery.clone()
      .select('magazine_source')
      .count('* as count')
      .whereNotNull('magazine_source')
      .groupBy('magazine_source');

    // 4. Statystyki według typów usług (tylko jeśli kolumna istnieje)
    let serviceStats = [];
    if (hasServiceType) {
      try {
        serviceStats = await baseQuery.clone()
          .select('service_type')
          .count('* as count')
          .whereNotNull('service_type')
          .groupBy('service_type');
      } catch (error) {
        console.log('Błąd pobierania statystyk service_type:', error.message);
        serviceStats = [];
      }
    } else {
      console.log('⚠️ Kolumna service_type nie istnieje - pomijam statystyki usług');
    }

    // 5. Trendy dzienne (ostatnie 30 dni dla okresów dłuższych niż tydzień)
    let dailyTrends = [];
    if (period !== '7' && period !== 'today') {
      const trendPeriod = period === 'all' ? '30' : period;
      const trendCondition = getTimeCondition(trendPeriod);
      
      if (trendCondition) {
        try {
          dailyTrends = await db('kuriers')
            .select(db.raw("DATE(created_at) as date"))
            .count('* as count')
            .whereRaw(trendCondition)
            .groupBy(db.raw("DATE(created_at)"))
            .orderBy('date', 'desc')
            .limit(30);
        } catch (error) {
          console.log('Błąd pobierania trendów dziennych:', error.message);
          dailyTrends = [];
        }
      }
    }

    // 6. Średnie wartości (tylko dostępne kolumny)
    let averages = {};
    try {
      const selectFields = [];
      
      if (hasPackageWeight) {
        selectFields.push('AVG(package_weight) as avg_weight');
      }
      if (hasPackageValue) {
        selectFields.push('AVG(package_value) as avg_value');
      }
      if (hasCodAmount) {
        selectFields.push('AVG(cod_amount) as avg_cod');
        selectFields.push('COUNT(CASE WHEN cod_amount > 0 THEN 1 END) as cod_count');
      }
      
      if (selectFields.length > 0) {
        averages = await baseQuery.clone()
          .select(db.raw(selectFields.join(', ')))
          .first();
      }
    } catch (error) {
      console.log('Błąd pobierania średnich wartości:', error.message);
      averages = {};
    }

    // 7. Top miasta (odbiorcy) - tylko jeśli kolumna istnieje
    let topCities = [];
    if (hasRecipientCity) {
      try {
        topCities = await baseQuery.clone()
          .select('recipient_city')
          .count('* as count')
          .whereNotNull('recipient_city')
          .groupBy('recipient_city')
          .orderBy('count', 'desc')
          .limit(10);
      } catch (error) {
        console.log('Błąd pobierania top miast:', error.message);
        topCities = [];
      }
    } else {
      console.log('⚠️ Kolumna recipient_city nie istnieje - pomijam statystyki miast');
    }

    // 8. Szczegóły czasowe (jeśli wymagane)
    let timeBreakdown = {};
    if (includeDetails) {
      try {
        // Rozkład według godzin utworzenia
        const hourlyBreakdown = await baseQuery.clone()
          .select(db.raw('EXTRACT(HOUR FROM created_at) as hour'))
          .count('* as count')
          .groupBy(db.raw('EXTRACT(HOUR FROM created_at)'))
          .orderBy('hour');

        // Rozkład według dni tygodnia
        const weeklyBreakdown = await baseQuery.clone()
          .select(db.raw('EXTRACT(DOW FROM created_at) as day_of_week'))
          .count('* as count')
          .groupBy(db.raw('EXTRACT(DOW FROM created_at)'))
          .orderBy('day_of_week');

        timeBreakdown = {
          hourly: hourlyBreakdown,
          weekly: weeklyBreakdown
        };
      } catch (error) {
        console.log('Błąd pobierania szczegółów czasowych:', error.message);
        timeBreakdown = {};
      }
    }

    // Formatuj wyniki
    const formatStats = (stats) => {
      const result = {};
      stats.forEach(stat => {
        const key = Object.keys(stat)[0];
        result[stat[key]] = parseInt(stat.count) || 0;
      });
      return result;
    };

    const formattedStatusStats = formatStats(statusStats);
    const formattedMagazineStats = formatStats(magazineStats);
    const formattedServiceStats = formatStats(serviceStats);

    // Oblicz dodatkowe metryki
    const total = parseInt(totalCount?.count || 0);
    const codPercentage = total > 0 && averages?.cod_count 
      ? Math.round((parseInt(averages.cod_count) / total) * 100) 
      : 0;

    const response = {
      success: true,
      period: period,
      archive: archive,
      stats: {
        total: total,
        statusBreakdown: formattedStatusStats,
        magazineBreakdown: formattedMagazineStats,
        serviceBreakdown: formattedServiceStats,
        topCities: topCities.map(city => ({
          city: city.recipient_city,
          count: parseInt(city.count)
        })),
        averages: {
          weight: averages?.avg_weight ? Math.round(parseFloat(averages.avg_weight) * 100) / 100 : 0,
          value: averages?.avg_value ? Math.round(parseFloat(averages.avg_value) * 100) / 100 : 0,
          cod: averages?.avg_cod ? Math.round(parseFloat(averages.avg_cod) * 100) / 100 : 0,
          codPercentage: codPercentage
        },
        trends: {
          daily: dailyTrends.map(trend => ({
            date: trend.date,
            count: parseInt(trend.count)
          }))
        }
      },
      meta: {
        generatedAt: new Date().toISOString(),
        period: period,
        archive: archive,
        includeDetails: includeDetails,
        availableColumns: {
          serviceType: hasServiceType,
          packageWeight: hasPackageWeight,
          packageValue: hasPackageValue,
          codAmount: hasCodAmount,
          recipientCity: hasRecipientCity
        }
      }
    };

    // Dodaj szczegóły czasowe jeśli wymagane
    if (includeDetails) {
      response.stats.timeBreakdown = timeBreakdown;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching detailed kurier stats:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    }, { status: 500 });
  }
}
