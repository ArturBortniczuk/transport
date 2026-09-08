import { NextResponse } from 'next/server';
import db from '@/database/db';
import { serialize } from 'cookie';
import { verifyPassword, hashPassword, isBcryptHash, generateSessionToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = email ? email.toLowerCase().trim() : '';
    console.log('Próba logowania dla użytkownika:', normalizedEmail);
    
    // Pobierz użytkownika po emailu
    const user = await db('users')
      .whereRaw('LOWER(email) = ?', [normalizedEmail])
      .first();
    
    if (user && await verifyPassword(password, user.password)) {
      // Automatyczna przezroczysta migracja hasła czystotekstowego do bcrypt
      if (!isBcryptHash(user.password)) {
        try {
          const hashedPassword = await hashPassword(password);
          await db('users')
            .where({ email: user.email })
            .update({ password: hashedPassword });
          console.log(`Hasło użytkownika ${user.email} zostało automatycznie zmigrowane do bcrypt`);
        } catch (hashError) {
          console.error('Błąd podczas migracji hasła do bcrypt:', hashError);
        }
      }

      console.log('Zalogowano użytkownika:', {
        email: user.email,
        name: user.name,
        role: user.role
      });
      
      // Zadeklaruj permissions przed użyciem
      let permissions = {
        calendar: { 
          view: true,
          edit: user.role === 'magazyn' || user.role === 'magazyn_bialystok' || user.role === 'magazyn_zielonka'
        },
        map: { 
          view: true 
        },
        transport: { 
          markAsCompleted: user.role === 'magazyn' || user.role === 'magazyn_bialystok' || user.role === 'magazyn_zielonka' || user.is_admin === 1 || user.is_admin === true
        }
      };
      
      try {
        if (user.permissions) {
          // Scal domyślne uprawnienia z tymi z bazy
          const parsedPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
          permissions = {
            ...permissions,
            ...parsedPermissions
          };
        }
      } catch (e) {
        console.error('Błąd parsowania uprawnień:', e);
      }
      
      // Utwórz kryptograficznie bezpieczny token sesji
      const sessionToken = generateSessionToken();
      
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
          expires_at: db.raw("NOW() + INTERVAL '7 days' ")
        });
        
        console.log('Sesja zapisana dla użytkownika:', user.email);
      } catch (error) {
        console.error('Błąd zapisywania sesji:', error);
      }
      
      // Przygotuj ciasteczka
      const authCookie = serialize('authToken', sessionToken, cookieOptions);
      const roleCookie = serialize('userRole', user.role, { ...cookieOptions, httpOnly: false });
      
      // Dodaj nowe ciasteczko przechowujące email użytkownika (niezbędne do sprawdzania utworzycieli transportów)
      const emailCookie = serialize('userEmail', user.email, { ...cookieOptions, httpOnly: false });
      
      const response = NextResponse.json({ 
        success: true,
        user: {
          name: user.name,
          email: user.email, // Dodajemy email do odpowiedzi
          role: user.role,
          permissions: permissions,
          mpk: user.mpk || ''
        }
      });
      
      // Dodaj ciasteczka do odpowiedzi
      response.headers.append('Set-Cookie', authCookie);
      response.headers.append('Set-Cookie', roleCookie);
      response.headers.append('Set-Cookie', emailCookie); // Dodajemy nowe ciasteczko z emailem
      
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
