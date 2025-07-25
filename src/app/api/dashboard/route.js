// src/app/api/dashboard/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { KIEROWCY } from '@/app/kalendarz/constants';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken || !db) {
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
    console.error('Błąd walidacji sesji:', error);
    return null;
  }
};

// Funkcja pobierająca nazwę kierowcy
const getDriverName = (driverId) => {
  if (!driverId) return 'Nieznany kierowca';
  const driver = KIEROWCY.find(k => k.id === parseInt(driverId));
  return driver ? driver.imie : 'Nieznany kierowca';
};
const formatDate = (date) => {
  if (!date) return 'Brak daty';
  return new Date(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export async function GET(request) {
  try {
    console.log('=== START GET /api/dashboard ===');
    
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name', 'permissions')
      .first();

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Sprawdź uprawnienia
    const isAdmin = user.role === 'admin';
    const isMagazyn = user.role === 'magazyn' || user.role?.startsWith('magazyn_');
    
    if (!isAdmin && !isMagazyn) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do dashboardu' 
      }, { status: 403 });
    }

    // Daty dla analiz
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Inicjalizujemy obiekt z danymi
    const dashboardData = {
      activeTransports: 0,
      pendingRequests: 0,
      activeDrivers: 0,
      averageRating: null,
      todayTransports: [],
      warehouses: { bialystok: 0, zielonka: 0 },
      recentRatings: [],
      fleetsInUse: 0,
      totalFleets: 7,
      activeSpeditions: 0,
      speditionCosts: { thisMonth: 0, lastMonth: 0, thisWeek: 0, lastWeek: 0 },
      transportTypes: { own: { count: 0, thisMonth: 0 }, spedition: { count: 0, thisMonth: 0 } },
      monthlyChartData: [],
      weeklyChartData: [],
      costChartData: []
    };

    // 1. TRANSPORTY WŁASNE
    let ownTransportsThisMonth = 0;
    let ownTransportsLastMonth = 0;
    
    try {
      const transportsExist = await db.schema.hasTable('transports');
      if (transportsExist) {
        // Aktywne transporty
        const activeResult = await db('transports')
          .whereNot('status', 'completed')
          .count('* as count').first();
        dashboardData.activeTransports = parseInt(activeResult?.count || 0);

        // Dzisiejsze transporty
        const todayTransports = await db('transports')
          .where('delivery_date', '>=', todayStart.toISOString())
          .where('delivery_date', '<', todayEnd.toISOString())
          .orderBy('delivery_date', 'asc').limit(10);

        dashboardData.todayTransports = todayTransports.map(transport => ({
          source: transport.source_warehouse || 'Nieznane',
          destination: transport.destination_city || 'Nieznane',
          driver: getDriverName(transport.driver_id),
          mpk: transport.mpk || 'Brak',
          status: transport.status || 'pending'
        }));

        // Aktywni kierowcy (unikalni kierowcy z aktywnymi transportami)
        const activeDriversResult = await db('transports')
          .whereNot('status', 'completed')
          .whereNotNull('driver_id')
          .countDistinct('driver_id as count')
          .first();
        
        dashboardData.activeDrivers = parseInt(activeDriversResult?.count || 0);

        // Magazyny
        const warehouseData = await db('transports')
          .whereNot('status', 'completed')
          .select('source_warehouse')
          .count('* as count')
          .groupBy('source_warehouse');

        warehouseData.forEach(item => {
          if (item.source_warehouse === 'bialystok') {
            dashboardData.warehouses.bialystok = parseInt(item.count);
          } else if (item.source_warehouse === 'zielonka') {
            dashboardData.warehouses.zielonka = parseInt(item.count);
          }
        });

        // Transport własny w tym miesiącu
        const ownThisMonth = await db('transports')
          .where('delivery_date', '>=', thisMonthStart.toISOString())
          .count('* as count').first();
        ownTransportsThisMonth = parseInt(ownThisMonth?.count || 0);

        // Transport własny w zeszłym miesiącu
        const ownLastMonth = await db('transports')
          .where('delivery_date', '>=', lastMonthStart.toISOString())
          .where('delivery_date', '<=', lastMonthEnd.toISOString())
          .count('* as count').first();
        ownTransportsLastMonth = parseInt(ownLastMonth?.count || 0);
      }
    } catch (error) {
      console.error('Błąd transportów własnych:', error);
    }

    // 2. SPEDYCJE
    let speditionTransportsThisMonth = 0;
    let speditionTransportsLastMonth = 0;
    let thisMonthCost = 0;
    let lastMonthCost = 0;
    let thisWeekCost = 0;
    let lastWeekCost = 0;

    try {
      const spedycjeExist = await db.schema.hasTable('spedycje');
      if (spedycjeExist) {
        // Aktywne spedycje
        const activeSpedResult = await db('spedycje')
          .whereNot('status', 'completed')
          .count('* as count').first();
        dashboardData.activeSpeditions = parseInt(activeSpedResult?.count || 0);

        // Spedycje w tym miesiącu
        const spedThisMonth = await db('spedycje')
          .where('created_at', '>=', thisMonthStart.toISOString())
          .count('* as count').first();
        speditionTransportsThisMonth = parseInt(spedThisMonth?.count || 0);

        // Spedycje w zeszłym miesiącu
        const spedLastMonth = await db('spedycje')
          .where('created_at', '>=', lastMonthStart.toISOString())
          .where('created_at', '<=', lastMonthEnd.toISOString())
          .count('* as count').first();
        speditionTransportsLastMonth = parseInt(spedLastMonth?.count || 0);

        // KOSZTY SPEDYCJI
        // Ten miesiąc
        const thisMonthSpeditions = await db('spedycje')
          .where('completed_at', '>=', thisMonthStart.toISOString())
          .where('status', 'completed')
          .select('response_data');

        thisMonthSpeditions.forEach(spedycja => {
          try {
            if (spedycja.response_data) {
              const responseData = JSON.parse(spedycja.response_data);
              if (responseData.deliveryPrice) {
                thisMonthCost += parseFloat(responseData.deliveryPrice);
              }
            }
          } catch (e) {}
        });

        // Zeszły miesiąc
        const lastMonthSpeditions = await db('spedycje')
          .where('completed_at', '>=', lastMonthStart.toISOString())
          .where('completed_at', '<=', lastMonthEnd.toISOString())
          .where('status', 'completed')
          .select('response_data');

        lastMonthSpeditions.forEach(spedycja => {
          try {
            if (spedycja.response_data) {
              const responseData = JSON.parse(spedycja.response_data);
              if (responseData.deliveryPrice) {
                lastMonthCost += parseFloat(responseData.deliveryPrice);
              }
            }
          } catch (e) {}
        });

        // Ten tydzień
        const thisWeekSpeditions = await db('spedycje')
          .where('completed_at', '>=', thisWeekStart.toISOString())
          .where('status', 'completed')
          .select('response_data');

        thisWeekSpeditions.forEach(spedycja => {
          try {
            if (spedycja.response_data) {
              const responseData = JSON.parse(spedycja.response_data);
              if (responseData.deliveryPrice) {
                thisWeekCost += parseFloat(responseData.deliveryPrice);
              }
            }
          } catch (e) {}
        });

        // Zeszły tydzień
        const lastWeekSpeditions = await db('spedycje')
          .where('completed_at', '>=', lastWeekStart.toISOString())
          .where('completed_at', '<=', lastWeekEnd.toISOString())
          .where('status', 'completed')
          .select('response_data');

        lastWeekSpeditions.forEach(spedycja => {
          try {
            if (spedycja.response_data) {
              const responseData = JSON.parse(spedycja.response_data);
              if (responseData.deliveryPrice) {
                lastWeekCost += parseFloat(responseData.deliveryPrice);
              }
            }
          } catch (e) {}
        });
      }
    } catch (error) {
      console.error('Błąd spedycji:', error);
    }

    // 3. WNIOSKI TRANSPORTOWE
    try {
      const requestsExist = await db.schema.hasTable('transport_requests');
      if (requestsExist) {
        const pendingResult = await db('transport_requests')
          .where('status', 'pending')
          .count('* as count').first();
        dashboardData.pendingRequests = parseInt(pendingResult?.count || 0);
      }
    } catch (error) {
      console.error('Błąd wniosków:', error);
    }

    // 4. USTAW WSZYSTKIE DANE SPÓJNIE
    dashboardData.transportTypes = {
      own: { count: ownTransportsThisMonth, thisMonth: ownTransportsThisMonth },
      spedition: { count: speditionTransportsThisMonth, thisMonth: speditionTransportsThisMonth }
    };

    dashboardData.speditionCosts = {
      thisMonth: Math.round(thisMonthCost),
      lastMonth: Math.round(lastMonthCost),
      thisWeek: Math.round(thisWeekCost),
      lastWeek: Math.round(lastWeekCost)
    };

    // 5. DANE DO WYKRESÓW 
    // Wykres podziału transportów (własny vs spedycyjny) - ostatnie 6 miesięcy
    const transportChartData = [];
    // Wykres kosztów spedycji (tylko spedycja) - ostatnie 6 miesięcy  
    const costChartData = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleDateString('pl-PL', { month: 'short' });

      let ownCount = 0;
      let speditionCount = 0;
      let monthCost = 0;

      try {
        // Transport własny
        const transportsExist = await db.schema.hasTable('transports');
        if (transportsExist) {
          const ownResult = await db('transports')
            .where('delivery_date', '>=', monthStart.toISOString())
            .where('delivery_date', '<=', monthEnd.toISOString())
            .count('* as count').first();
          ownCount = parseInt(ownResult?.count || 0);
        }

        // Spedycje
        const spedycjeExist = await db.schema.hasTable('spedycje');
        if (spedycjeExist) {
          const spedResult = await db('spedycje')
            .where('created_at', '>=', monthStart.toISOString())
            .where('created_at', '<=', monthEnd.toISOString())
            .count('* as count').first();
          speditionCount = parseInt(spedResult?.count || 0);

          // Koszty TYLKO spedycji
          const monthSpeditions = await db('spedycje')
            .where('completed_at', '>=', monthStart.toISOString())
            .where('completed_at', '<=', monthEnd.toISOString())
            .where('status', 'completed')
            .select('response_data');

          monthSpeditions.forEach(spedycja => {
            try {
              if (spedycja.response_data) {
                const responseData = JSON.parse(spedycja.response_data);
                if (responseData.deliveryPrice) {
                  monthCost += parseFloat(responseData.deliveryPrice);
                }
              }
            } catch (e) {}
          });
        }
      } catch (error) {
        console.error(`Błąd danych dla miesiąca ${monthName}:`, error);
      }

      // Dane do wykresu podziału transportów
      transportChartData.push({
        month: monthName,
        własny: ownCount,
        spedycyjny: speditionCount
      });

      // Dane do wykresu kosztów spedycji (TYLKO koszty)
      costChartData.push({
        month: monthName,
        koszt: Math.round(monthCost)
      });
    }

    dashboardData.monthlyChartData = transportChartData;  // Podział transportów
    dashboardData.costChartData = costChartData;         // Koszty spedycji

    console.log('SPÓJNE DANE:', {
      activeDrivers: dashboardData.activeDrivers,
      ownThisMonth: ownTransportsThisMonth,
      speditionThisMonth: speditionTransportsThisMonth,
      thisMonthCost: Math.round(thisMonthCost),
      transportChartLength: transportChartData.length,
      costChartLength: costChartData.length
    });

    return NextResponse.json({
      success: true,
      data: dashboardData,
      userRole: user.role,
      userName: user.name
    });

  } catch (error) {
    console.error('Błąd w GET /api/dashboard:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}
