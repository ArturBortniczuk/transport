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
    .whereRaw('expires_at > NOW()') // Zamiana datetime('now') na NOW() dla MySQL
    .select('user_id')
    .first();
  
  return session?.user_id;
};

// W pliku route_5.js (API transportów), dodajemy paginację
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50'); // 50 elementów na stronę
    const offset = (page - 1) * limit;
    
    // Generowanie klucza cache na podstawie parametrów zapytania
    const cacheKey = date 
      ? `transports_date_${date}_page_${page}_limit_${limit}` 
      : `transports_all_page_${page}_limit_${limit}`;
    
    // Próba pobrania z cache
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      return NextResponse.json({ 
        success: true, 
        ...cachedData,
        fromCache: true
      });
    }
    
    // Jeśli nie ma w cache, pobierz z bazy danych
    let query = db('transports');
    let countQuery = db('transports').count('* as total');
    
    if (date) {
      query = query.whereRaw('DATE(delivery_date) = ?', [date]);
      countQuery = countQuery.whereRaw('DATE(delivery_date) = ?', [date]);
    }
    
    // Pobierz dane z paginacją
    const transports = await query
      .orderBy('delivery_date', date ? 'asc' : 'desc')
      .limit(limit)
      .offset(offset);
    
    // Pobierz całkowitą liczbę rekordów dla paginacji
    const totalResult = await countQuery.first();
    const total = totalResult ? totalResult.total : 0;
    
    const result = {
      transports: transports || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
    
    // Zapisz wynik w cache na 5 minut
    setInCache(cacheKey, result, 300);
    
    return NextResponse.json({ 
      success: true, 
      ...result
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
    
    // Sprawdź uprawnienia użytkownika (zaktualizowane dla Knex)
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
    
    // Używamy Knex do wstawienia danych
    const [id] = await db('transports').insert(transportData);
    
    // Wyczyść cache po dodaniu nowego transportu
    clearCache();
    
    return NextResponse.json({ 
      success: true, 
      id: id 
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
    
    // Sprawdź uprawnienia użytkownika (zaktualizowane dla Knex)
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
    
    // Przygotowanie danych do aktualizacji
    const updateData = { ...transportData };
    if (status) {
      updateData.status = status;
    }
    
    // Dodaj datę zakończenia jeśli status zmieniony na completed
    if (status === 'completed') {
      updateData.completed_at = db.fn.now(); // Używamy funkcji NOW() w MySQL
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak danych do aktualizacji' 
      });
    }
    
    // Używamy Knex do aktualizacji danych
    const updated = await db('transports')
      .where('id', id)
      .update(updateData);
    
    if (updated === 0) {
      throw new Error('Transport not found');
    }

    // Wyczyść cache po aktualizacji transportu
    clearCache();

    return NextResponse.json({ success: true });
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
    
    // Sprawdź uprawnienia użytkownika (zaktualizowane dla Knex)
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
    clearCache();

    return NextResponse.json({ success: true });
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