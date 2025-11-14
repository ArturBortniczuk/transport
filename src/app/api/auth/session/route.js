// PLIK: src/app/api/auth/session/route.js
// Prosty redirect do istniejącego endpointu /api/user

import { NextResponse } from 'next/server';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji (skopiowana z /api/user)
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

// GET - Sprawdź aktualną sesję użytkownika (identyczna logika jak /api/user)
export async function GET(request) {
  try {
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ 
        isAuthenticated: false,
        user: null
      });
    }
    
    // Sprawdź czy sesja istnieje i nie wygasła
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        isAuthenticated: false,
        user: null
      });
    }
    
    // Pobierz dane użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('email', 'name', 'role', 'permissions', 'mpk', 'is_admin')
      .first();
    
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
      permissions = {};
    }
    
    return NextResponse.json({ 
      isAuthenticated: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
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
    });
    
  } catch (error) {
    console.error('Błąd sprawdzania sesji:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      user: null,
      error: 'Błąd serwera'
    }, { status: 500 });
  }
}
