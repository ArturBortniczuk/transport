// src/app/api/change-password/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { validateSession, getSessionUser } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

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

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nowe hasło musi mieć co najmniej 6 znaków' 
      }, { status: 400 });
    }

    // Weryfikacja obecnego hasła w Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: currentPassword
    });

    if (authError || !authData?.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowe obecne hasło' 
      }, { status: 401 });
    }

    // Aktualizacja hasła w Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      password: newPassword,
      email_confirm: true
    });

    if (updateError) {
      throw new Error(updateError.message);
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