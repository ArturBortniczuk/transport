// src/app/api/transports/backfill-costs/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function GET(request) {
  try {
    const hasColumn = await db.schema.hasColumn('transports', 'cost');
    if (!hasColumn) {
      await db.schema.table('transports', table => {
        table.decimal('cost', 10, 2);
      });
      console.log('Kolumna "cost" została utworzona.');
    }

    const transports = await db('transports').select('id', 'distance', 'connected_transport_id');
    console.log(`Pobrano ${transports.length} transportów.`);

    let updatedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < transports.length; i += batchSize) {
      const batch = transports.slice(i, i + batchSize);
      
      const updatePromises = batch.map(t => {
        const dist = t.distance || 0;
        const rate = t.connected_transport_id ? 3.5 : 4.5;
        const calculatedCost = dist * rate;
        
        return db('transports')
          .where('id', t.id)
          .update({ cost: calculatedCost });
      });

      await Promise.all(updatePromises);
      updatedCount += batch.length;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Zaktualizowano ${updatedCount} transportów.` 
    });
  } catch (error) {
    console.error('Błąd w backfill-costs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
