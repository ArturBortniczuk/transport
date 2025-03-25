// src/app/api/users/list/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getFromCache, setInCache } from '@/utils/cache';

export async function GET() {
  try {
    // Sprawdź czy dane są w cache
    const cacheKey = 'users_list_basic';
    const cachedUsers = getFromCache(cacheKey);
    
    if (cachedUsers) {
      return NextResponse.json(cachedUsers);
    }
    
    // Pobieranie listy użytkowników - zaktualizowane do Knex
    const users = await db('users')
      .select('name', 'email', 'mpk');

    // Dodaj logi, aby sprawdzić, czy MPK jest prawidłowo zwracane
    console.log('Przykład użytkownika zwróconego przez API:', users[0]);

    // Zapisz w cache na 15 minut
    setInCache(cacheKey, users, 900);

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch users' 
    }, { status: 500 });
  }
}