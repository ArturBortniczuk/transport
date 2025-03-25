// src/app/api/check-first-login/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function POST(request) {
  try {
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ 
        shouldChangePassword: false
      });
    }
    
    // Pobierz ID użytkownika z sesji - zaktualizowane do Knex
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()') // Używamy NOW() zamiast datetime('now')
      .first();
    
    if (!session) {
      return NextResponse.json({ 
        shouldChangePassword: false
      });
    }
    
    const email = session.user_id;
    
    // Pobierz dane użytkownika - zaktualizowane do Knex
    const user = await db('users')
      .where('email', email)
      .select('first_login')
      .first();

    return NextResponse.json({ 
      shouldChangePassword: user?.first_login === 1
    });

  } catch (error) {
    console.error('Check first login error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}