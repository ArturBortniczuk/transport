// src/app/api/users/list/route.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    
    // Pobieranie listy użytkowników (tylko pracownicy, bez klientów zewnętrznych)
    const users = await db('users')
      .select('name', 'email', 'mpk', 'role')
      .whereNotIn('role', ['client', 'klient'])
      .orderBy('name', 'asc');

    // Zapisz w cache na 60 sekund (zamiast 15 minut)
    setInCache(cacheKey, users, 60);

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch users' 
    }, { status: 500 });
  }
}