// src/app/api/packagings/last-sync/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function GET() {
  try {
    // Pobierz datę ostatniej synchronizacji z tabeli app_settings
    const lastSync = await db('app_settings')
      .where('key', 'last_mymaps_sync')
      .select('value')
      .first();

    return NextResponse.json({
      success: true,
      lastSync: lastSync ? lastSync.value : null
    });
  } catch (error) {
    console.error('Error fetching last sync date:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}