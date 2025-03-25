// src/app/api/users/permissions/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji - zaktualizowana do Knex
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()') // MySQL format
    .select('user_id')
    .first();
  
  return session?.user_id;
};

export async function PUT(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    console.log('Żądanie aktualizacji uprawnień, token:', authToken ? 'Istnieje' : 'Brak', 'userId:', userId);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Sprawdź czy użytkownik jest adminem - zaktualizowane do Knex
    const admin = await db('users')
      .where('email', userId)
      .select('is_admin')
      .first();
    
    console.log('Sprawdzenie uprawnień admina:', admin);
    
    if (admin?.is_admin !== 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień administratora' 
      }, { status: 403 });
    }
    
    const { userId: targetUserId, section, permission, value } = await request.json();
    console.log('Aktualizacja uprawnień:', { targetUserId, section, permission, value });

    // Pobierz aktualne uprawnienia użytkownika - zaktualizowane do Knex
    const userResult = await db('users')
      .where('email', targetUserId)
      .select('permissions')
      .first();
    
    console.log('Obecne uprawnienia w bazie:', userResult?.permissions);
    
    if (!userResult) {
      throw new Error('Użytkownik nie został znaleziony');
    }

    // Parsuj i aktualizuj uprawnienia
    let permissions = {};
    try {
      if (userResult.permissions && userResult.permissions.trim() !== '') {
        permissions = JSON.parse(userResult.permissions);
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }

    // Upewnij się, że sekcja istnieje
    if (!permissions[section]) {
      permissions[section] = {};
    }

    // Ustaw nową wartość uprawnienia
    permissions[section][permission] = value;
    
    console.log('Zaktualizowane uprawnienia do zapisania:', permissions);
    const permissionsJson = JSON.stringify(permissions);

    // Aktualizuj uprawnienia w bazie danych - zaktualizowane do Knex
    const updated = await db('users')
      .where('email', targetUserId)
      .update({ permissions: permissionsJson });
    
    console.log('Wynik aktualizacji:', updated);

    if (updated === 0) {
      throw new Error('Nie udało się zaktualizować uprawnień');
    }

    return NextResponse.json({ 
      success: true,
      permissions: permissions 
    });
  } catch (error) {
    console.error('Error updating permissions:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}