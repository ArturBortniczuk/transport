// src/app/api/change-password/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { validateSession, getSessionUser, verifyPassword, hashPassword } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;
    
    // Pobierz email z sesji lub ciała zapytania
    let email = null;
    const sessionUser = await getSessionUser(request);
    if (sessionUser?.isAuthenticated && sessionUser.user?.email) {
      email = sessionUser.user.email;
    }

    if (!email) {
      const authToken = request.cookies.get('authToken')?.value;
      email = await validateSession(authToken);
    }

    if (!email && body.email) {
      email = body.email.toLowerCase().trim();
    }
    
    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Użytkownik nie jest zalogowany lub sesja wygasła' 
      }, { status: 401 });
    }
    
    console.log('Zmiana hasła dla:', email);
    
    // Pobierz użytkownika
    const user = await db('users')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .first();

    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowe obecne hasło' 
      }, { status: 401 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nowe hasło musi mieć co najmniej 6 znaków' 
      }, { status: 400 });
    }

    // Zahashuj nowe hasło
    const hashedNewPassword = await hashPassword(newPassword);

    // Wykonaj aktualizację w Neon DB
    await db('users')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .update({ 
        password: hashedNewPassword, 
        first_login: false 
      });

    // Zsynchronizuj z Supabase Auth
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (profile?.id) {
        await supabaseAdmin.auth.admin.updateUserById(profile.id, {
          password: newPassword,
          email_confirm: true
        });
      }
    } catch (sbErr) {
      console.warn('Ostrzeżenie przy aktualizacji hasła w Supabase Auth:', sbErr.message);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Hasło zostało pomyślnie zmienione' 
    });

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}