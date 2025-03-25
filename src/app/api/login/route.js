// src/app/api/login/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { serialize } from 'cookie';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    console.log('Próba logowania dla użytkownika:', email);

    // Zmiana z SQLite na Knex
    const user = await db('users')
      .where({ 
        email: email, 
        password: password 
      })
      .first();

    if (user) {
      console.log('Zalogowano użytkownika:', {
        email: user.email,
        name: user.name,
        role: user.role
      });
      
      // Zadeklaruj permissions przed użyciem
      let permissions = {
        calendar: { 
          view: true,
          edit: user.role === 'magazyn'  // Używamy user.role
        },
        map: { 
          view: true 
        },
        transport: { 
          markAsCompleted: user.role === 'magazyn' || user.is_admin === 1  // Używamy user.role i user.is_admin
        }
      };
      
      try {
        if (user.permissions) {
          // Scal domyślne uprawnienia z tymi z bazy
          const parsedPermissions = JSON.parse(user.permissions);
          permissions = {
            ...permissions,
            ...parsedPermissions
          };
        }
      } catch (e) {
        console.error('Błąd parsowania uprawnień:', e);
      }

      // Utwórz token sesji
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Ustaw ciasteczko HTTP-only
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 dni
        path: '/'
      };
      
      // Zapisz sesję w bazie danych
      try {
        // Upewnij się, że tabela sessions istnieje (powinno to być już obsługiwane w db.js)
        await db('sessions').insert({
          token: sessionToken,
          user_id: user.email,
          expires_at: db.raw('DATE_ADD(NOW(), INTERVAL 7 DAY)') // MySQL format dla +7 dni
        });
        
        console.log('Sesja zapisana dla użytkownika:', user.email);
      } catch (error) {
        console.error('Błąd zapisywania sesji:', error);
      }
      
      // Przygotuj ciasteczka
      const authCookie = serialize('authToken', sessionToken, cookieOptions);
      const roleCookie = serialize('userRole', user.role, { ...cookieOptions, httpOnly: false });
      
      const response = NextResponse.json({ 
        success: true,
        user: {
          name: user.name,
          role: user.role,
          permissions: permissions,
          mpk: user.mpk || ''
        }
      });
      
      // Dodaj ciasteczka do odpowiedzi
      response.headers.append('Set-Cookie', authCookie);
      response.headers.append('Set-Cookie', roleCookie);

      return response;
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Nieprawidłowe dane logowania' 
    }, {
      status: 401
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message
    }, {
      status: 500
    });
  }
}