// src/app/api/check-admin/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function GET(request) {
  try {
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    console.log('Sprawdzanie uprawnień admina, token:', authToken ? 'Istnieje' : 'Brak');
    
    if (!authToken) {
      console.log('Brak tokenu - użytkownik niezalogowany');
      return NextResponse.json({ isAdmin: false });
    }
    
    // Pobierz ID użytkownika z sesji - zaktualizowane do Knex
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()') // Funkcja NOW() dla MySQL
      .select('user_id')
      .first();
    
    console.log('Wynik sprawdzania sesji:', session ? `Sesja dla użytkownika ${session.user_id}` : 'Sesja nie istnieje');
    
    if (!session) {
      return NextResponse.json({ isAdmin: false });
    }
    
    // Sprawdź czy użytkownik jest adminem - zaktualizowane do Knex
    const user = await db('users')
      .where('email', session.user_id)
      .select('is_admin')
      .first();

    console.log('Sprawdzanie czy użytkownik jest adminem:', {
      user_id: session.user_id,
      is_admin: user?.is_admin === 1
    });

    return NextResponse.json({ 
      isAdmin: user?.is_admin === 1 
    });

  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false });
  }
}