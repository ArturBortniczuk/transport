// src/app/api/packagings/[id]/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

// GET /api/packagings/:id
export async function GET(request, { params }) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated || !session?.user) {
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