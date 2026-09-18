import { NextResponse } from 'next/server';
import db from '@/database/db';
import { removeFromCache } from '@/utils/cache';
import { validateSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = (await validateSession(request)) || (await validateSession(authToken));

    if (!userId) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Pobieranie listy użytkowników (tylko pracownicy, bez klientów zewnętrznych)
    const users = await db('users')
      .select('name', 'position', 'email', 'permissions', 'role', 'mpk')
      .whereNotIn('role', ['client', 'klient'])
      .orderBy('name', 'asc');

    if (!users || users.length === 0) {
      throw new Error('Nie znaleziono użytkowników');
    }

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
    // Odświeżamy cache listy użytkowników
    removeFromCache('users_list_basic');

    return NextResponse.json({ success: true, message: 'Dane użytkowników można już odczytać na bieżąco, bez cache' });
  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({
      error: 'Failed to add user'
    }, { status: 500 });
  }
}