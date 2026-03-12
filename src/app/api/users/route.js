// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Pobieranie listy użytkowników
    const users = await db('users')
      .select('name', 'position', 'email', 'permissions', 'role', 'mpk');

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
    // Tu może być kod do dodawania użytkownika

    return NextResponse.json({ success: true, message: 'Dane użytkowników można już odczytać na bieżąco, bez cache' });
  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({
      error: 'Failed to add user'
    }, { status: 500 });
  }
}