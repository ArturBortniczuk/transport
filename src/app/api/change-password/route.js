// src/app/api/change-password/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function POST(request) {
  try {
    const { currentPassword, newPassword } = await request.json();
    
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'Użytkownik nie jest zalogowany' 
      }, { status: 401 });
    }
    
    // Pobierz ID użytkownika z sesji - zaktualizowane do Knex
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()') // Używamy NOW() zamiast datetime('now')
      .first();
    
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sesja wygasła lub jest nieprawidłowa' 
      }, { status: 401 });
    }
    
    const email = session.user_id;
    console.log('Zmiana hasła dla:', email);
    
    // Sprawdź obecne hasło - zaktualizowane do Knex
    const user = await db('users')
      .where({ 
        email: email, 
        password: currentPassword 
      })
      .first();

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowe obecne hasło' 
      }, { status: 401 });
    }

    // Wykonaj aktualizację - zaktualizowane do Knex
    const updated = await db('users')
      .where({ email: email })
      .update({ 
        password: newPassword, 
        first_login: 0 
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