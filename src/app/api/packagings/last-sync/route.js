// src/app/api/packagings/last-sync/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function GET() {
  try {
    const lastSync = await db('app_settings')
      .where('key', 'last_mymaps_sync')
      .select('value')
      .first()
      .catch(() => null);

    return NextResponse.json({
      success: true,
      lastSync: lastSync ? lastSync.value : null
    });
  } catch (error) {
    return NextResponse.json({ 
      success: true, 
      lastSync: null 
    });
  }
}