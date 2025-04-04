// src/app/api/user/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getFromCache, setInCache } from '@/utils/cache';

export async function GET(request) {
  try {
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    if (!authToken) {
      console.log('Brak tokenu - użytkownik niezalogowany');
      return NextResponse.json({ 
        isAuthenticated: false,
        user: null
      });
    }
    
    // Próba pobrania z cache
    const cacheKey = `user_data_${authToken}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }
    
    // Sprawdź czy sesja istnieje i nie wygasła - zaktualizowane do Knex
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()') // Używamy NOW() zamiast datetime('now')
      .first();
    
    
    if (!session) {
      return NextResponse.json({ 
        isAuthenticated: false,
        user: null
      });
    }
    
    // Pobierz dane użytkownika - zaktualizowane do Knex
    const user = await db('users')
      .where('email', session.user_id)
      .select('email', 'name', 'role', 'permissions', 'mpk', 'is_admin')
      .first();
    
    console.log('Dane użytkownika z bazy:', user ? {
      email: user.email,
      role: user.role,
      isAdmin: user.is_admin === 1
    } : 'Nie znaleziono użytkownika');
    
    if (!user) {
      return NextResponse.json({ 
        isAuthenticated: false,
        user: null
      });
    }
    
    // Parsuj uprawnienia
    let permissions = {};
    try {
      permissions = user.permissions ? JSON.parse(user.permissions) : {};
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }
    
    const responseData = { 
      isAuthenticated: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        // Dodaj bezpośrednio wartość boolean dla isAdmin
        isAdmin: Boolean(
          user.is_admin === true || 
          user.is_admin === 1 || 
          user.is_admin === 't' || 
          user.is_admin === 'TRUE' || 
          user.is_admin === 'true' ||
          user.role === 'admin'
        ),
        permissions: permissions,
        mpk: user.mpk || ''
      }
    };
    
    // Zapisz dane w cache na 15 minut (użytkownik i uprawnienia rzadko się zmieniają)
    setInCache(cacheKey, responseData, 900);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Błąd pobierania użytkownika:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      user: null,
      error: error.message
    }, { status: 500 });
  }
}
