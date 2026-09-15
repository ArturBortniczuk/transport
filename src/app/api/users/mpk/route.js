// src/app/api/users/mpk/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { removeFromCache } from '@/utils/cache';
import { validateSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const sessionUserId = (await validateSession(request)) || (await validateSession(authToken));

    if (!sessionUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const sessionEmail = sessionUserId.toLowerCase();
    const isSuperAdmin = sessionEmail === 'a.bortniczuk@grupaeltron.pl';

    // Sprawdź czy użytkownik jest adminem
    const admin = await db('users')
      .whereRaw('LOWER(email) = ?', [sessionEmail])
      .select('is_admin', 'role')
      .first();

    const isAdmin = Boolean(
      isSuperAdmin ||
      admin?.is_admin === true || 
      admin?.is_admin === 1 || 
      admin?.is_admin === 't' || 
      admin?.is_admin === 'TRUE' || 
      admin?.is_admin === 'true' ||
      admin?.role === 'admin'
    );

    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień administratora' 
      }, { status: 403 });
    }

    const { userId: targetUserId, mpk } = await request.json();

    if (!targetUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące ID użytkownika' 
      }, { status: 400 });
    }

    const cleanedMpk = typeof mpk === 'string' ? mpk.trim() : (mpk || '');
    const targetEmail = targetUserId.toLowerCase();

    // Aktualizuj MPK użytkownika w bazie danych Neon
    await db('users')
      .whereRaw('LOWER(email) = ?', [targetEmail])
      .update({ mpk: cleanedMpk })
      .catch(() => null);

    // Synchronizuj z tabelą profiles w Supabase
    await db('profiles')
      .whereRaw('LOWER(email) = ?', [targetEmail])
      .update({ mpk: cleanedMpk })
      .catch(() => null);

    // Wyczyść cache
    removeFromCache('users_list_basic');

    return NextResponse.json({ 
      success: true,
      mpk: cleanedMpk 
    });
  } catch (error) {
    console.error('Błąd aktualizacji MPK użytkownika:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
