// src/app/api/constructions/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/database/db';
import { validateSession, getSessionUser } from '@/lib/auth';

// Funkcja sprawdzająca, czy użytkownik ma uprawnienia do zarządzania budowami
const hasConstructionsAccess = async (request) => {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser?.isAuthenticated || !sessionUser?.user) return false;
  const user = sessionUser.user;
  if (user.isAdmin || user.email === 'a.bortniczuk@grupaeltron.pl' || user.role === 'admin') {
    return true;
  }
  return user.permissions?.admin?.constructions === true;
};

// Pobieranie listy budów
export async function GET(request) {
  try {
    // Sprawdź autoryzację
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(request) || await validateSession(authToken);
    
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
    const userId = await validateSession(request) || await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź, czy użytkownik ma uprawnienia
    const hasAccess = await hasConstructionsAccess(request);
    
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
    const userId = await validateSession(request) || await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź, czy użytkownik ma uprawnienia
    const hasAccess = await hasConstructionsAccess(request);
    
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
    const userId = await validateSession(request) || await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź, czy użytkownik ma uprawnienia
    const hasAccess = await hasConstructionsAccess(request);
    
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
