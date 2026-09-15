// src/app/api/transports/archived/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { validateSession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(request) || await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    
    // Budujemy zapytanie do pobrania tylko zakończonych transportów
    let query = db('transports').where('status', 'completed');
    
    // Filtrujemy po roku i miesiącu jeśli podane
    if (year) {
      query = query.whereRaw('EXTRACT(YEAR FROM delivery_date) = ?', [year]);
      
      if (month && month !== 'all') {
        query = query.whereRaw('EXTRACT(MONTH FROM delivery_date) = ?', [parseInt(month) + 1]);
      }
    }
    
    // Sortujemy od najnowszych do najstarszych
    query = query.orderBy('delivery_date', 'desc');
    
    // Wykonaj zapytanie
    const transports = await query;
    
    console.log(`Pobrano ${transports.length} zarchiwizowanych transportów`);
    
    return NextResponse.json({ 
      success: true, 
      transports: transports || []
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error fetching archived transports:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}