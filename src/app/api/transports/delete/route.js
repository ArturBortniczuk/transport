// src/app/api/transports/delete/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function DELETE(request) {
  // Pobierz ID transportu z zapytania
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ 
      success: false, 
      error: 'Transport ID is required' 
    }, { status: 400 });
  }
  
  // Sprawdź uprawnienia użytkownika
  const authToken = request.cookies.get('authToken')?.value;
  
  if (!authToken) {
    return NextResponse.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }
  
  // Pobierz dane użytkownika z sesji
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .first();
  
  if (!session) {
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid session' 
    }, { status: 401 });
  }
  
  const user = await db('users')
    .where('email', session.user_id)
    .first();
  
  // Sprawdź czy użytkownik ma uprawnienia administratora
  if (!user.is_admin) {
    return NextResponse.json({ 
      success: false, 
      error: 'Admin privileges required' 
    }, { status: 403 });
  }
  
  try {
    // Usuń transport o podanym ID
    const deleted = await db('transports')
      .where('id', id)
      .del();
    
    if (deleted === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Transport deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting transport:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}