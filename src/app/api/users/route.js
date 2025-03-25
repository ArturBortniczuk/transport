// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getFromCache, setInCache, removeFromCache } from '@/utils/cache';

export async function GET() {
  try {
    // Sprawdź czy dane są w cache
    const cacheKey = 'all_users_list';
    const cachedUsers = getFromCache(cacheKey);
    
    if (cachedUsers) {
      return NextResponse.json(cachedUsers);
    }
    
    // Pobieranie listy użytkowników - zaktualizowane do Knex
    const users = await db('users')
      .select('name', 'position', 'email', 'permissions', 'role');

    if (!users || users.length === 0) {
      throw new Error('Nie znaleziono użytkowników');
    }

    // Zapisz w cache na 30 minut (lista użytkowników rzadko się zmienia)
    setInCache(cacheKey, users, 1800);

    // Zapewnij, że zawsze zwracamy tablicę
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch users' 
    }, { status: 500 });
  }
}

// Dodajemy endpoint do unieważniania cache po modyfikacji użytkowników
export async function POST(request) {
  try {
    // Tu może być kod do dodawania użytkownika
    
    // Unieważnij cache związany z użytkownikami
    removeFromCache('all_users_list');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({ 
      error: 'Failed to add user' 
    }, { status: 500 });
  }
}