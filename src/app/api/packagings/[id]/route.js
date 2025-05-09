// src/app/api/packagings/[id]/route.js
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

// GET /api/packagings/:id
export async function GET(request, { params }) {
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
    
    const id = params.id;
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID opakowania jest wymagane' 
      }, { status: 400 });
    }
    
    // Pobierz opakowanie z bazy danych
    const packaging = await db('packagings')
      .where('id', id)
      .first();
    
    if (!packaging) {
      return NextResponse.json({ 
        success: false, 
        error: 'Opakowanie nie znalezione' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      packaging: packaging 
    });
  } catch (error) {
    console.error('Error fetching packaging:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}