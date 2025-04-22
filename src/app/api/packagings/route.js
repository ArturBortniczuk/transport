// src/app/api/packagings/route.js
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

// GET /api/packagings
export async function GET(request) {
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
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, scheduled, completed
    
    // Budujemy zapytanie
    let query = db('packagings');
    
    // Filtrujemy po statusie jeśli podany
    if (status) {
      query = query.where('status', status);
    }
    
    // Sortujemy od najnowszych do najstarszych
    query = query.orderBy('created_at', 'desc');
    
    // Wykonaj zapytanie
    const packagings = await query;
    
    return NextResponse.json({ 
      success: true, 
      packagings: packagings || []
    });
  } catch (error) {
    console.error('Error fetching packagings:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST /api/packagings
export async function POST(request) {
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
    
    const packagingData = await request.json();
    
    // Dodaj opakowanie do bazy
    const result = await db('packagings').insert(packagingData).returning('id');
    const id = result[0]?.id;
    
    return NextResponse.json({ 
      success: true, 
      id: id 
    });
  } catch (error) {
    console.error('Error adding packaging:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// PUT /api/packagings
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
    
    const { id, ...packagingData } = await request.json();
    
    // Aktualizuj opakowanie
    const updated = await db('packagings')
      .where('id', id)
      .update({
        ...packagingData,
        updated_at: db.fn.now()
      });
    
    if (updated === 0) {
      throw new Error('Packaging not found');
    }

    return NextResponse.json({ 
      success: true 
    });
  } catch (error) {
    console.error('Error updating packaging:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}