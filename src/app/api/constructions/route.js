// src/app/api/constructions/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/database/db';

// Pomocnicza funkcja do weryfikacji sesji
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

// Funkcja sprawdzająca, czy użytkownik ma uprawnienia do zarządzania budowami
const hasConstructionsAccess = async (userId) => {
  if (!userId) return false;
  
  const user = await db('users')
    .where('email', userId)
    .select('is_admin', 'permissions')
    .first();
  
  // Sprawdź czy jest adminem
  const isAdmin = user?.is_admin === true || user?.is_admin === 1 || 
                  user?.is_admin === 't' || user?.is_admin === 'TRUE' || 
                  user?.is_admin === 'true';
  
  if (isAdmin) return true;
  
  // Sprawdź uprawnienia
  let permissions = {};
  try {
    if (user?.permissions) {
      permissions = JSON.parse(user.permissions);
    }
  } catch (error) {
    console.error('Błąd parsowania uprawnień:', error);
  }
  
  return permissions?.admin?.constructions === true;
};

// Pobieranie listy budów
export async function GET(request) {
  try {
    // Sprawdź autoryzację
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const constructions = await db('constructions')
      .select('*')
      .orderBy('name');
    
    return NextResponse.json({ 
      constructions: constructions || []
    });
  } catch (error) {
    console.error('Błąd pobierania budów:', error);
    return NextResponse.json({ 
      error: 'Nie udało się pobrać listy budów'
    }, { status: 500 });
  }
}

// Aktualizacja budowy
export async function PUT(request) {
  try {
    // Sprawdź autoryzację
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź, czy użytkownik ma uprawnienia
    const hasAccess = await hasConstructionsAccess(userId);
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Brak uprawnień do zarządzania budowami'
      }, { status: 403 });
    }
    
    // Pobierz dane z żądania
    const { id, name, mpk } = await request.json();
    
    await db('constructions')
      .where('id', id)
      .update({
        name,
        mpk,
        updated_at: db.fn.now()
      });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Błąd aktualizacji budowy:', error);
    return NextResponse.json({ 
      error: 'Nie udało się zaktualizować budowy'
    }, { status: 500 });
  }
}

// Dodawanie nowej budowy
export async function POST(request) {
  try {
    // Sprawdź autoryzację
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź, czy użytkownik ma uprawnienia
    const hasAccess = await hasConstructionsAccess(userId);
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Brak uprawnień do zarządzania budowami'
      }, { status: 403 });
    }
    
    // Pobierz dane z żądania
    const { name, mpk } = await request.json();
    
    // Sprawdź, czy wszystkie wymagane pola są obecne
    if (!name || !mpk) {
      return NextResponse.json({ 
        error: 'Brakujące dane' 
      }, { status: 400 });
    }
    
    // Dodaj nową budowę
    const [id] = await db('constructions')
      .insert({
        name,
        mpk
      })
      .returning('id');
    
    return NextResponse.json({ 
      success: true,
      id
    });
  } catch (error) {
    console.error('Błąd dodawania budowy:', error);
    return NextResponse.json({ 
      error: 'Nie udało się dodać budowy'
    }, { status: 500 });
  }
}

// Usuwanie budowy - zmieniona metoda, aby przyjmowała id w treści żądania
export async function DELETE(request) {
  try {
    // Sprawdź autoryzację
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź, czy użytkownik ma uprawnienia
    const hasAccess = await hasConstructionsAccess(userId);
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Brak uprawnień do zarządzania budowami'
      }, { status: 403 });
    }
    
    // Pobierz id z treści żądania zamiast z URL
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ 
        error: 'Nie podano ID budowy'
      }, { status: 400 });
    }
    
    await db('constructions')
      .where('id', id)
      .delete();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Błąd usuwania budowy:', error);
    return NextResponse.json({ 
      error: 'Nie udało się usunąć budowy'
    }, { status: 500 });
  }
}
