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
    
    // Pobierz ID użytkownika z sesji
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()') // To powinno działać tak samo w PostgreSQL
      .select('user_id')
      .first();
    
    console.log('Wynik sprawdzania sesji:', session ? `Sesja dla użytkownika ${session.user_id}` : 'Sesja nie istnieje');
    
    if (!session) {
      return NextResponse.json({ isAdmin: false });
    }
    
    // Sprawdź czy użytkownik jest adminem
    const user = await db('users')
      .where('email', session.user_id)
      .select('is_admin')
      .first();

    // Dodaj więcej logów dla debugowania
    console.log('Dane użytkownika:', user);
    console.log('Status admin:', user?.is_admin);
    
    // W PostgreSQL true/false zamiast 1/0
    return NextResponse.json({ 
      isAdmin: user?.is_admin === true || user?.is_admin === 1 
    });

  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false });
  }
}
