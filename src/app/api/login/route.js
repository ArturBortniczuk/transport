import { NextResponse } from 'next/server';
import db from '@/database/db';
import { serialize } from 'cookie';
import { verifyPassword, hashPassword, isBcryptHash, generateSessionToken } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = email ? email.toLowerCase().trim() : '';
    console.log('Próba logowania dla użytkownika:', normalizedEmail);
    
    let authenticatedUser = null;
    let supabaseSession = null;

    // 1. Spróbuj zalogować przez Supabase Auth
    try {
      const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password
      });

      if (!sbError && sbData?.user) {
        supabaseSession = sbData.session;
        
        // Pobierz uprawnienie do Transportu
        const { data: perm } = await supabase
          .from('user_app_permissions')
          .select('role, is_active')
          .eq('user_id', sbData.user.id)
          .eq('app_id', 'transport')
          .maybeSingle();

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sbData.user.id)
          .maybeSingle();

        const role = perm?.is_active ? perm.role : (profile?.role === 'admin' ? 'admin' : 'pracownik');
        const isSuperAdmin = normalizedEmail === 'a.bortniczuk@grupaeltron.pl';
        const isAdmin = isSuperAdmin || role === 'admin' || profile?.role === 'admin';

        authenticatedUser = {
          email: normalizedEmail,
          name: profile?.name || sbData.user.user_metadata?.full_name || normalizedEmail.split('@')[0],
          role: role,
          mpk: profile?.mpk || '',
          isAdmin: isAdmin,
          permissions: {
            calendar: { 
              view: true,
              edit: ['admin', 'koordynator', 'magazyn', 'magazyn_bialystok', 'magazyn_zielonka'].includes(role) || isAdmin
            },
            map: { view: true },
            transport: { 
              markAsCompleted: ['admin', 'koordynator', 'magazyn', 'magazyn_bialystok', 'magazyn_zielonka', 'kierowca'].includes(role) || isAdmin
            }
          }
        };
      }
    } catch (sbErr) {
      console.warn('Próba logowania Supabase nie powiodła się, sprawdzam bazę lokalną/Neon:', sbErr.message);
    }

    // 2. Jeśli Supabase nie zwrócił użytkownika, sprawdź tabelę users (legacy / Neon)
    if (!authenticatedUser) {
      const user = await db('users')
        .whereRaw('LOWER(email) = ?', [normalizedEmail])
        .first();
      
      if (user && await verifyPassword(password, user.password)) {
        if (!isBcryptHash(user.password)) {
          try {
            const hashedPassword = await hashPassword(password);
            await db('users')
              .where({ email: user.email })
              .update({ password: hashedPassword });
          } catch (hashError) {
            console.error('Błąd podczas migracji hasła do bcrypt:', hashError);
          }
        }

        let permissions = {
          calendar: { 
            view: true,
            edit: user.role === 'magazyn' || user.role === 'magazyn_bialystok' || user.role === 'magazyn_zielonka'
          },
          map: { view: true },
          transport: { 
            markAsCompleted: user.role === 'magazyn' || user.role === 'magazyn_bialystok' || user.role === 'magazyn_zielonka' || user.is_admin === 1 || user.is_admin === true
          }
        };
        
        try {
          if (user.permissions) {
            const parsedPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            permissions = { ...permissions, ...parsedPermissions };
          }
        } catch (e) {
          console.error('Błąd parsowania uprawnień:', e);
        }

        authenticatedUser = {
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: permissions,
          mpk: user.mpk || '',
          isAdmin: user.is_admin === 1 || user.is_admin === true || user.role === 'admin'
        };
      }
    }

    if (authenticatedUser) {
      const sessionToken = generateSessionToken();
      const isProduction = process.env.NODE_ENV === 'production';
      
      const host = request.headers.get('host') || '';
      const domain = host.includes('grupaeltron.pl') ? '.grupaeltron.pl' : undefined;

      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        ...(domain ? { domain } : {})
      };


      const authCookie = serialize('authToken', sessionToken, cookieOptions);
      const roleCookie = serialize('userRole', authenticatedUser.role, { ...cookieOptions, httpOnly: false });
      const emailCookie = serialize('userEmail', authenticatedUser.email, { ...cookieOptions, httpOnly: false });

      const response = NextResponse.json({ 
        success: true,
        user: authenticatedUser
      });

      response.headers.append('Set-Cookie', authCookie);
      response.headers.append('Set-Cookie', roleCookie);
      response.headers.append('Set-Cookie', emailCookie);

      // Jeśli mamy sesję Supabase, zapisz ciasteczko SSO eltron_auth_token
      if (supabaseSession) {
        const ssoCookie = serialize('eltron_auth_token', JSON.stringify(supabaseSession), {
          ...cookieOptions,
          httpOnly: false
        });
        response.headers.append('Set-Cookie', ssoCookie);
      }

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

