import { NextResponse } from 'next/server';
import db from '@/database/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. Najpierw zaokrąglamy wszystkie obecne wartości (żeby pozbyć się ułamków .50)
    await db.raw('UPDATE transports SET cost = ROUND(cost) WHERE cost IS NOT NULL');
    
    // 2. Zmieniamy typ kolumny z numeric(10,2) na integer
    await db.raw('ALTER TABLE transports ALTER COLUMN cost TYPE integer USING cost::integer');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Zmieniono typ kolumny na liczby całkowite (integer) i usunięto kropki/zera po przecinku.' 
    });
  } catch (error) {
    console.error('Błąd zmiany typu kolumny:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
