// src/app/api/dashboard/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

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

// Funkcja formatująca datę
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

    // Sprawdź uprawnienia - dashboard tylko dla adminów i magazynów
    const isAdmin = user.role === 'admin';
    const isMagazyn = user.role === 'magazyn' || user.role?.startsWith('magazyn_');
    
    if (!isAdmin && !isMagazyn) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do dashboardu' 
      }, { status: 403 });
    }

    console.log('Pobieranie danych dashboard dla użytkownika:', userId);

    // Dzisiejsza data
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Inicjalizujemy obiekt z podstawowymi danymi
    const dashboardData = {
      activeTransports: 0,
      pendingRequests: 0,
      activeDrivers: 0,
      averageRating: null,
      todayTransports: [],
      warehouses: {
        bialystok: 0,
        zielonka: 0
      },
      recentRatings: [],
      fleetsInUse: 0,
      totalFleets: 7, // Z constants POJAZDY
      // Nowe dane spedycyjne
      activeSpeditions: 0,
      speditionCosts: {
        thisMonth: 0,
        lastMonth: 0,
        thisWeek: 0,
        lastWeek: 0
      },
      transportTypes: {
        own: { count: 0, thisMonth: 0 },
        spedition: { count: 0, thisMonth: 0 }
      },
      monthlyChartData: [],
      weeklyChartData: [],
      costChartData: []
    };

    // 1. Sprawdź transporty własne
    try {
      const transportsExist = await db.schema.hasTable('transports');
      console.log('Tabela transports istnieje:', transportsExist);
      
      if (transportsExist) {
        // Sprawdź ile jest wszystkich transportów
        const allTransports = await db('transports').count('* as count').first();
        console.log('Wszystkich transportów w bazie:', allTransports?.count || 0);

        // Aktywne transporty (status != 'completed')
        const activeTransportsResult = await db('transports')
          .whereNot('status', 'completed')
          .count('* as count')
          .first();
        
        dashboardData.activeTransports = parseInt(activeTransportsResult?.count || 0);
        console.log('Aktywne transporty:', dashboardData.activeTransports);

        // Dzisiejsze transporty
        const todayTransports = await db('transports')
          .where('delivery_date', '>=', todayStart.toISOString())
          .where('delivery_date', '<', todayEnd.toISOString())
          .orderBy('delivery_date', 'asc')
          .limit(10);

        console.log('Dzisiejsze transporty:', todayTransports.length);

        dashboardData.todayTransports = todayTransports.map(transport => ({
          source: transport.source_warehouse || 'Nieznane źródło',
          destination: transport.destination_city || 'Nieznany cel',
          driver: 'Kierowca', // Uproszczenie - można dodać później lookup
          mpk: transport.mpk || 'Brak',
          status: transport.status || 'pending'
        }));

        // Transporty według magazynów
        const warehouseTransports = await db('transports')
          .whereNot('status', 'completed')
          .select('source_warehouse')
          .count('* as count')
          .groupBy('source_warehouse');

        warehouseTransports.forEach(item => {
          if (item.source_warehouse === 'bialystok') {
            dashboardData.warehouses.bialystok = parseInt(item.count);
          } else if (item.source_warehouse === 'zielonka') {
            dashboardData.warehouses.zielonka = parseInt(item.count);
          }
        });

        console.log('Magazyny:', dashboardData.warehouses);

        // Transport własny w tym miesiącu
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const ownTransportsThisMonth = await db('transports')
          .where('delivery_date', '>=', thisMonthStart.toISOString())
          .count('* as count')
          .first();

        dashboardData.transportTypes.own.thisMonth = parseInt(ownTransportsThisMonth?.count || 0);
      }
    } catch (error) {
      console.error('Błąd pobierania danych z tabeli transports:', error);
    }

    // 2. Sprawdź spedycje
    try {
      const spedycjeExist = await db.schema.hasTable('spedycje');
      console.log('Tabela spedycje istnieje:', spedycjeExist);
      
      if (spedycjeExist) {
        // Sprawdź ile jest wszystkich spedycji
        const allSpeditions = await db('spedycje').count('* as count').first();
        console.log('Wszystkich spedycji w bazie:', allSpeditions?.count || 0);

        // Aktywne spedycje
        const activeSpeditionsResult = await db('spedycje')
          .whereNot('status', 'completed')
          .count('* as count')
          .first();
        
        dashboardData.activeSpeditions = parseInt(activeSpeditionsResult?.count || 0);
        console.log('Aktywne spedycje:', dashboardData.activeSpeditions);

        // Spedycje w tym miesiącu
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const speditionTransportsThisMonth = await db('spedycje')
          .where('created_at', '>=', thisMonthStart.toISOString())
          .count('* as count')
          .first();

        dashboardData.transportTypes.spedition.thisMonth = parseInt(speditionTransportsThisMonth?.count || 0);

        // Próbuj policzyć koszty spedycji
        const completedSpeditions = await db('spedycje')
          .where('status', 'completed')
          .where('completed_at', '>=', thisMonthStart.toISOString())
          .select('response_data');

        let thisMonthCost = 0;
        completedSpeditions.forEach(spedycja => {
          try {
            if (spedycja.response_data) {
              const responseData = JSON.parse(spedycja.response_data);
              if (responseData.deliveryPrice) {
                thisMonthCost += parseFloat(responseData.deliveryPrice);
              }
            }
          } catch (e) {
            // Ignoruj błędy parsowania
          }
        });

        dashboardData.speditionCosts.thisMonth = Math.round(thisMonthCost);
        console.log('Koszty spedycji w tym miesiącu:', dashboardData.speditionCosts.thisMonth);
      }
    } catch (error) {
      console.error('Błąd pobierania danych spedycyjnych:', error);
    }

    // 3. Sprawdź wnioski transportowe
    try {
      const requestsExist = await db.schema.hasTable('transport_requests');
      console.log('Tabela transport_requests istnieje:', requestsExist);
      
      if (requestsExist) {
        const pendingRequestsResult = await db('transport_requests')
          .where('status', 'pending')
          .count('* as count')
          .first();
        
        dashboardData.pendingRequests = parseInt(pendingRequestsResult?.count || 0);
        console.log('Oczekujące wnioski:', dashboardData.pendingRequests);
      }
    } catch (error) {
      console.error('Błąd pobierania danych z tabeli transport_requests:', error);
    }

    // 4. Generuj przykładowe dane do wykresów (będziemy uzupełniać później)
    const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze'];
    dashboardData.monthlyChartData = monthNames.map(month => ({
      month,
      własny: Math.floor(Math.random() * 10) + 1,
      spedycyjny: Math.floor(Math.random() * 8) + 1,
      koszt: Math.floor(Math.random() * 50000) + 10000
    }));

    console.log('Dashboard data zebrane:', {
      activeTransports: dashboardData.activeTransports,
      activeSpeditions: dashboardData.activeSpeditions,
      pendingRequests: dashboardData.pendingRequests,
      ownTransports: dashboardData.transportTypes.own.thisMonth,
      speditionTransports: dashboardData.transportTypes.spedition.thisMonth
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
