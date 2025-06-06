// src/app/api/transports/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getFromCache, setInCache } from '@/utils/cache';

// Funkcja pomocnicza do weryfikacji sesji (zaktualizowana dla Knex)
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()') 
    .select('user_id')
    .first();
  
  return session?.user_id;
};

export async function GET(request) {
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
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź uprawnienia użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'permissions')
      .first();
    
    let canEditCalendar = false;
    try {
      if (user.permissions) {
        const permissions = JSON.parse(user.permissions);
        canEditCalendar = permissions?.calendar?.edit === true;
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }
    
    // Tylko użytkownicy z uprawnieniami mogą dodawać transporty
    if (!canEditCalendar) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do dodawania transportów' 
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
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Pobierz dane transportu i dane użytkownika
    const { id, status, ...transportData } = await request.json();
    
    // Sprawdź uprawnienia użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'permissions')
      .first();
    
    let canEditCalendar = false;
    let canMarkAsCompleted = false;
    
    try {
      if (user.permissions) {
        const permissions = JSON.parse(user.permissions);
        canEditCalendar = permissions?.calendar?.edit === true;
        canMarkAsCompleted = permissions?.transport?.markAsCompleted === true;
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }
    
    // Jeśli zmienia status na completed, sprawdź uprawnienia
    if (status === 'completed' && !canMarkAsCompleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do oznaczania transportów jako zakończone' 
      }, { status: 403 });
    }
    
    // Jeśli edytuje inne dane, sprawdź uprawnienia
    if (Object.keys(transportData).length > 0 && !canEditCalendar) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do edycji transportów' 
      }, { status: 403 });
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
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź uprawnienia użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'permissions')
      .first();
    
    let canEditCalendar = false;
    try {
      if (user.permissions) {
        const permissions = JSON.parse(user.permissions);
        canEditCalendar = permissions?.calendar?.edit === true;
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }
    
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
