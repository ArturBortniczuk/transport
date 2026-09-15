// src/app/api/user/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser, generateSessionToken } from '@/lib/auth';

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

    const response = NextResponse.json(sessionResult);

    // Jeśli użytkownik przyszedł przez SSO (eltron_auth_token), a nie ma jeszcze lokalnego authToken,
    // wygenerujmy dla niego sesję w tabeli sessions i ciasteczko authToken,
    // żeby natychmiast działały wszystkie pozostałe endpointy (/api/transports, /api/spedycje itp.).
    const existingAuthToken = request.cookies.get('authToken')?.value;
    if (!existingAuthToken) {
      try {
        const sessionToken = generateSessionToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dni

        // Upewnij się, że użytkownik istnieje w tabeli users (dla klucza obcego w sessions)
        const userExists = await db('users').where({ email: sessionResult.user.email }).first();
        if (!userExists) {
          await db('users').insert({
            email: sessionResult.user.email,
            name: sessionResult.user.name,
            position: sessionResult.user.position || 'Pracownik',
            password: 'SSO_MANAGED_BY_SUPABASE',
            role: sessionResult.user.role,
            is_admin: sessionResult.user.isAdmin,
            mpk: sessionResult.user.mpk || ''
          }).catch(() => {});
        }

        await db('sessions').insert({
          token: sessionToken,
          user_id: sessionResult.user.email,
          expires_at: expiresAt
        }).catch(() => {});

        const isProduction = process.env.NODE_ENV === 'production';
        const host = request.headers.get('host') || '';
        const domainStr = host.includes('grupaeltron.pl') ? '; Domain=.grupaeltron.pl' : '';
        const secureStr = isProduction ? '; Secure' : '';

        response.headers.set(
          'Set-Cookie',
          `authToken=${sessionToken}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax; HttpOnly${domainStr}${secureStr}`
        );
      } catch (sessionErr) {
        console.warn('Nie udało się automatycznie utworzyć legacy sesji dla SSO:', sessionErr.message);
      }
    }

    return response;
  } catch (error) {
    console.error('Błąd pobierania użytkownika:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      user: null,
      error: error.message
    }, { status: 500 });
  }
}
