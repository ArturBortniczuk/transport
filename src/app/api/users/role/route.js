// src/app/api/users/role/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first();
  
  return session?.user_id;
};

export async function PUT(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź czy użytkownik jest adminem
    const admin = await db('users')
      .where('email', userId)
      .select('is_admin')
      .first();
    
    if (admin?.is_admin !== true && admin?.is_admin !== 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień administratora' 
      }, { status: 403 });
    }
    
    const { userId: targetUserId, role } = await request.json();
    
    if (!targetUserId || !role) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane' 
      }, { status: 400 });
    }

    // Aktualizuj rolę użytkownika w bazie danych
    const updated = await db('users')
      .where('email', targetUserId)
      .update({ role });
    
    if (updated === 0) {
      throw new Error('Nie udało się zaktualizować roli');
    }

    return NextResponse.json({ 
      success: true
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}