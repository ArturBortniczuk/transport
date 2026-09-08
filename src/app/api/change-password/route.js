// src/app/api/change-password/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { validateSession, verifyPassword, hashPassword } from '@/lib/auth';

export async function POST(request) {
  try {
    const { currentPassword, newPassword } = await request.json();
    
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    const email = await validateSession(authToken);
    
    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Użytkownik nie jest zalogowany lub sesja wygasła' 
      }, { status: 401 });
    }
    
    console.log('Zmiana hasła dla:', email);
    
    // Pobierz użytkownika
    const user = await db('users')
      .where({ email: email })
      .first();

    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowe obecne hasło' 
      }, { status: 401 });
    }

    // Zahashuj nowe hasło
    const hashedNewPassword = await hashPassword(newPassword);

    // Wykonaj aktualizację
    const updated = await db('users')
      .where({ email: email })
      .update({ 
        password: hashedNewPassword, 
        first_login: false 
      });

    if (updated === 0) {
      throw new Error('Nie udało się zaktualizować hasła');
    }

    return NextResponse.json({ 
      success: true,
      message: 'Hasło zostało zmienione'
    });

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}