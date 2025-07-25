// src/app/api/dashboard/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { KIEROWCY, POJAZDY } from '@/app/kalendarz/constants';

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
  return driver ? (driver.nazwa || driver.imie) : 'Nieznany kierowca';
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

    // Inicjalizujemy obiekt z danymi
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
      totalFleets: POJAZDY.length
    };

    // 1. Sprawdź czy tabele istnieją i pobierz dane z transportów
    try {
      const transportsExist = await db.schema.hasTable('transports');
      if (transportsExist) {
        // Aktywne transporty (status != 'completed')
        const activeTransportsCount = await db('transports')
          .whereNot('status', 'completed')
          .count('* as count')
          .first();
        
        dashboardData.activeTransports = parseInt(activeTransportsCount?.count || 0);

        // Dzisiejsze transporty
        const todayTransports = await db('transports')
          .where('delivery_date', '>=', todayStart.toISOString())
          .where('delivery_date', '<', todayEnd.toISOString())
          .orderBy('delivery_date', 'asc')
          .limit(10);

        dashboardData.todayTransports = todayTransports.map(transport => ({
          source: transport.source_warehouse || transport.zrodlo || 'Nieznane źródło',
          destination: transport.destination_city || transport.cel || 'Nieznany cel',
          driver: getDriverName(transport.driver_id || transport.kierowca),
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

        // Aktywni kierowcy (unikalni kierowcy z aktywnymi transportami)
        const activeDriversResult = await db('transports')
          .whereNot('status', 'completed')
          .countDistinct('driver_id as count')
          .first();
        
        dashboardData.activeDrivers = parseInt(activeDriversResult?.count || 0);

        // Pojazdy w użyciu (unikalne pojazdy z aktywnymi transportami)
        const fleetsInUseResult = await db('transports')
          .whereNot('status', 'completed')
          .countDistinct('vehicle_id as count')
          .first();
        
        dashboardData.fleetsInUse = parseInt(fleetsInUseResult?.count || 0);
      }
    } catch (error) {
      console.error('Błąd pobierania danych z tabeli transports:', error);
    }

    // 2. Sprawdź oczekujące wnioski transportowe
    try {
      const requestsExist = await db.schema.hasTable('transport_requests');
      if (requestsExist) {
        const pendingRequestsCount = await db('transport_requests')
          .where('status', 'pending')
          .count('* as count')
          .first();
        
        dashboardData.pendingRequests = parseInt(pendingRequestsCount?.count || 0);
      }
    } catch (error) {
      console.error('Błąd pobierania danych z tabeli transport_requests:', error);
    }

    // 3. Sprawdź oceny transportów
    try {
      const ratingsExist = await db.schema.hasTable('transport_detailed_ratings');
      if (ratingsExist) {
        // Średnia ocena ogólna
        const avgRatingResult = await db('transport_detailed_ratings')
          .avg('overall_percentage as avg_rating')
          .first();
        
        if (avgRatingResult?.avg_rating) {
          dashboardData.averageRating = Math.round(parseFloat(avgRatingResult.avg_rating));
        }

        // Ostatnie oceny
        const recentRatings = await db('transport_detailed_ratings')
          .join('transports', 'transport_detailed_ratings.transport_id', 'transports.id')
          .select(
            'transport_detailed_ratings.overall_percentage',
            'transport_detailed_ratings.created_at',
            'transports.destination_city',
            'transports.source_warehouse'
          )
          .orderBy('transport_detailed_ratings.created_at', 'desc')
          .limit(5);

        dashboardData.recentRatings = recentRatings.map(rating => ({
          transport: `${rating.source_warehouse || 'Nieznane'} → ${rating.destination_city || 'Nieznane'}`,
          score: rating.overall_percentage,
          date: formatDate(rating.created_at)
        }));
      }
    } catch (error) {
      console.error('Błąd pobierania danych z tabeli transport_detailed_ratings:', error);
    }

    console.log('Dashboard data collected:', dashboardData);

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
