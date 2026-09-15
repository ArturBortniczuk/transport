// src/app/api/user/route.js
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const sessionResult = await getSessionUser(request);
    
    if (!sessionResult.isAuthenticated || !sessionResult.user) {
      return NextResponse.json({ 
        isAuthenticated: false,
        user: null
      });
    }

    const userRole = (sessionResult.user.role || '').toLowerCase();
    if (userRole === 'client' || userRole === 'klient') {
      return NextResponse.json({
        isAuthenticated: false,
        isClient: true,
        user: null,
        redirectUrl: 'https://www.opakowania.grupaeltron.pl/dashboard'
      });
    }

    return NextResponse.json(sessionResult);
  } catch (error) {
    console.error('Błąd pobierania użytkownika:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      user: null,
      error: error.message
    }, { status: 500 });
  }
}
