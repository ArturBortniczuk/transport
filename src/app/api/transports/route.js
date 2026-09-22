import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getFromCache, setInCache } from '@/utils/cache';
import { validateSession, getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const session = await getSessionUser(request);
    const userId = session?.isAuthenticated ? session.user?.email : await validateSession(request);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status') || 'active'; // Domyślnie pobieramy tylko aktywne
    
    // Wyłączamy cache całkowicie
    
    // Budujemy zapytanie
    let query = db('transports');
    
    // Filtrujemy po statusie
    if (status === 'all') {
      // Nie filtrujemy po statusie
    } else if (status === 'completed') {
      query = query.where('status', 'completed');
    } else {
      // Domyślnie zwracamy aktywne, ale sprawdzamy też wartość 'aktywny' (dla zgodności wstecznej)
      query = query.where(function() {
        this.where('status', 'active').orWhere('status', 'aktywny');
      });
    }
    
    // Filtrujemy po dacie jeśli podana
    if (date) {
      query = query.whereRaw('delivery_date::date = ?', [date]);
    }
    
    // Sortujemy
    query = query.orderBy('delivery_date', 'desc');
    
    // Wykonaj zapytanie
    const transports = await query;
    
    console.log(`Pobrano ${transports.length} transportów o statusie: ${status}`);
    
    return NextResponse.json({ 
      success: true, 
      transports: transports || []
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Error fetching transports:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/transports
export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated || !session.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const canEditCalendar = session.user.isAdmin === true || session.user.permissions?.calendar?.edit === true;
    
    // Tylko użytkownicy z uprawnieniami mogą dodawać transporty
    if (!canEditCalendar) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do dodawania transportów w kalendarzu' 
      }, { status: 403 });
    }
    
    const transportData = await request.json();
    console.log('Otrzymane dane transportu:', transportData);
    
    // Konwersja wartości boolean dla PostgreSQL
    if ('is_cyclical' in transportData) {
      transportData.is_cyclical = transportData.is_cyclical === 1 || 
                               transportData.is_cyclical === '1' || 
                               transportData.is_cyclical === true;
    }

    if (transportData.pojazdId) {
      transportData.vehicle_id = transportData.pojazdId;
      delete transportData.pojazdId; // Usuwamy pole, które nie istnieje w bazie
    }
    // Upewnij się, że data jest we właściwym formacie
    if (transportData.delivery_date && typeof transportData.delivery_date === 'string') {
      // Pozostaw datę jako string - PostgreSQL radzi sobie z ISO formatem
      console.log('Data dostawy po formatowaniu:', transportData.delivery_date);
    }
    
    // Upewnij się, że ID i powiązania są poprawnie sformatowane
    if ('connected_transport_id' in transportData) {
      transportData.connected_transport_id = transportData.connected_transport_id 
        ? parseInt(transportData.connected_transport_id, 10) 
        : null;
    }
    if (transportData.driver_id) {
      transportData.driver_id = parseInt(transportData.driver_id, 10);
    }
    if (transportData.vehicle_id) {
      transportData.vehicle_id = parseInt(transportData.vehicle_id, 10);
    }
    
    // Oblicz koszt na podstawie dystansu (stawka 3.5 dla łączonych, 4.5 dla standardowych) i zaokrąglij do liczby całkowitej
    if (transportData.distance) {
      const rate = transportData.connected_transport_id ? 3.5 : 4.5;
      transportData.cost = Math.round(transportData.distance * rate);
    }

    // Sprawdź czy podano osobę odpowiedzialną i MPK
    if (!transportData.requester_name || !String(transportData.requester_name).trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Osoba odpowiedzialna (requester_name) jest wymagana do utworzenia transportu' 
      }, { status: 400 });
    }

    if (!transportData.mpk || !String(transportData.mpk).trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Numer MPK jest wymagany do utworzenia transportu' 
      }, { status: 400 });
    }

    console.log('Dane transportu do zapisania:', transportData);
    
    // W PostgreSQL używamy returning('id') aby uzyskać ID nowego rekordu
    const result = await db('transports').insert(transportData).returning('id');
    const id = result[0]?.id;
    
    console.log('Nowy transport dodany z ID:', id);
    
    // Wyczyść cache po dodaniu nowego transportu
    try {
      clearCache();
    } catch (error) {
      console.error('Błąd czyszczenia cache:', error);
      // Nie przerywamy, jeśli czyszczenie cache się nie powiedzie
    }
    
    return NextResponse.json({ 
      success: true, 
      id: id 
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error adding transport:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// PUT /api/transports
export async function PUT(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated || !session.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Pobierz dane transportu
    const { id, status, ...transportData } = await request.json();
    
    const isAdmin = session.user.isAdmin === true;
    const canEditCalendar = isAdmin || session.user.permissions?.calendar?.edit === true;
    const canRescheduleCalendar = isAdmin || session.user.permissions?.calendar?.reschedule === true || canEditCalendar;
    const canMarkAsCompleted = isAdmin || session.user.permissions?.transport?.markAsCompleted === true;
    
    // Jeśli zmienia status na completed, sprawdź uprawnienia
    if (status === 'completed' && !canMarkAsCompleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do oznaczania transportów jako zakończone' 
      }, { status: 403 });
    }
    
    // Jeśli edytuje inne dane, sprawdź uprawnienia
    if (Object.keys(transportData).length > 0) {
      const isOnlyReschedule = Object.keys(transportData).length === 1 && 'delivery_date' in transportData;
      if (isOnlyReschedule) {
        if (!canRescheduleCalendar) {
          return NextResponse.json({ 
            success: false, 
            error: 'Brak uprawnień do zmiany terminu transportu' 
          }, { status: 403 });
        }
      } else if (!canEditCalendar) {
        return NextResponse.json({ 
          success: false, 
          error: 'Brak uprawnień do edycji transportów' 
        }, { status: 403 });
      }
    }
    
    // ZMIANA: Najpierw pobierz istniejący transport
    const existingTransport = await db('transports')
      .where('id', id)
      .first();
    
    if (!existingTransport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport not found' 
      }, { status: 404 });
    }
    
    // Przygotowanie danych do aktualizacji
    const updateData = { ...transportData };
    
    // Konwersja wartości boolean dla PostgreSQL
    if ('is_cyclical' in updateData) {
      updateData.is_cyclical = updateData.is_cyclical === 1 || 
                            updateData.is_cyclical === '1' || 
                            updateData.is_cyclical === true;
    }
    
    if (status) {
      updateData.status = status;
      
      // Jeśli status zmienia się na completed, ale nie ma zmiany innych pól,
      // zachowaj ważne pola z istniejącego transportu
      if (status === 'completed' && Object.keys(transportData).length === 0) {
        // Zachowaj pole numerWZ/wz_number
        if (existingTransport.wz_number) {
          updateData.wz_number = existingTransport.wz_number;
        } else if (existingTransport.numerWZ) {
          updateData.wz_number = existingTransport.numerWZ;
        }
      }
    }
    
    // Dodaj datę zakończenia jeśli status zmieniony na completed
    if (status === 'completed') {
      updateData.completed_at = db.fn.now(); 
    }
    
    if ('connected_transport_id' in updateData) {
      updateData.connected_transport_id = updateData.connected_transport_id 
        ? parseInt(updateData.connected_transport_id, 10) 
        : null;
    }
    if (updateData.driver_id) {
      updateData.driver_id = parseInt(updateData.driver_id, 10);
    }
    if (updateData.vehicle_id) {
      updateData.vehicle_id = parseInt(updateData.vehicle_id, 10);
    }
    
    // Wylicz na nowo koszt, jeśli zmieniono dystans lub połączenie
    if ('distance' in updateData || 'connected_transport_id' in updateData) {
      const distanceToUse = updateData.distance !== undefined ? updateData.distance : existingTransport.distance;
      const isConnected = updateData.connected_transport_id !== undefined 
        ? Boolean(updateData.connected_transport_id) 
        : Boolean(existingTransport.connected_transport_id);
      const rate = isConnected ? 3.5 : 4.5;
      if (distanceToUse) {
        updateData.cost = Math.round(distanceToUse * rate);
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak danych do aktualizacji' 
      });
    }
    
    console.log('Aktualizacja transportu, ID:', id, 'Dane:', updateData);
    
    // Używamy Knex do aktualizacji danych
    const updated = await db('transports')
      .where('id', id)
      .update(updateData);
    
    if (updated === 0) {
      throw new Error('Transport not found');
    }

    // Wyczyść cache po aktualizacji transportu
    try {
      clearCache();
    } catch (error) {
      console.error('Błąd czyszczenia cache:', error);
    }

    return NextResponse.json({ 
      success: true 
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error updating transport:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE /api/transports/:id
export async function DELETE(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated || !session.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const canEditCalendar = session.user.isAdmin === true || session.user.permissions?.calendar?.edit === true;
    
    // Tylko osoby z uprawnieniami mogą usuwać transporty
    if (!canEditCalendar) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do usuwania transportów' 
      }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      throw new Error('ID is required');
    }

    // Używamy Knex do usunięcia transportu
    const deleted = await db('transports')
      .where('id', id)
      .delete();

    if (deleted === 0) {
      throw new Error('Transport not found');
    }

    // Wyczyść cache po usunięciu transportu
    try {
      clearCache();
    } catch (error) {
      console.error('Błąd czyszczenia cache:', error);
    }

    return NextResponse.json({ 
      success: true 
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error deleting transport:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Pomocnicza funkcja do czyszczenia cache
function clearCache() {
  // Importuj funkcję tylko kiedy jest potrzebna
  // aby uniknąć problemu z cyklicznym importem
  const { clearCache } = require('@/utils/cache');
  clearCache();
}
