// src/app/api/check-admin/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function GET(request) {
  try {
    // Pobierz token z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ isAdmin: false });
    }
    
    // Pobierz ID użytkownika z sesji
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first();
    
    if (!session) {
      return NextResponse.json({ isAdmin: false });
    }
    
    // Sprawdź czy użytkownik jest adminem
    const user = await db('users')
      .where('email', session.user_id)
      .select('is_admin', 'email')
      .first();
    
    // Obsłuż różne możliwe formaty wartości boolean
    const isAdminValue = 
      user?.is_admin === true || 
      user?.is_admin === 1 || 
      user?.is_admin === 't' || 
      user?.is_admin === 'TRUE' || 
      user?.is_admin === 'true';
    
    return NextResponse.json({ isAdmin: isAdminValue });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false });
  }
}
