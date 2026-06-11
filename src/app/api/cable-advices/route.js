import { NextResponse } from 'next/server';
import db from '@/database/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const advices = await db('cable_advices')
      .select('*')
      .orderBy('created_at', 'desc');

    return NextResponse.json(advices);
  } catch (error) {
    console.error('Error fetching cable advices:', error);
    return NextResponse.json({
      error: 'Failed to fetch cable advices'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    // Oblicz całkowitą ilość na podstawie packagings_data
    let calculatedQuantity = 0;
    let packagingsDataStr = '[]';
    
    if (Array.isArray(data.packagings_data)) {
      calculatedQuantity = data.packagings_data.reduce((sum, item) => {
        const drums = parseInt(item.drums) || 0;
        const length = parseInt(item.length) || 0;
        return sum + (drums * length);
      }, 0);
      packagingsDataStr = JSON.stringify(data.packagings_data);
    } else {
      // Fallback jeśli ktoś wyśle jakoś inaczej
      calculatedQuantity = data.quantity ? parseFloat(data.quantity) : 0;
      packagingsDataStr = data.packagings_data ? (typeof data.packagings_data === 'string' ? data.packagings_data : JSON.stringify(data.packagings_data)) : '[]';
    }

    const [id] = await db('cable_advices').insert({
      supplier: data.supplier,
      order_type: data.order_type,
      order_number: data.order_number,
      unloading_place: data.unloading_place,
      cable_voltage: data.cable_voltage,
      cable_guidelines: data.cable_guidelines || '',
      quantity: calculatedQuantity,
      packagings_data: packagingsDataStr,
      preliminary_date_from: data.preliminary_date_from || null,
      preliminary_date_to: data.preliminary_date_to || null,
      final_date_from: data.final_date_from || null,
      final_date_to: data.final_date_to || null,
      status: data.status || 'new',
    }).returning('id');

    return NextResponse.json({ success: true, id: typeof id === 'object' ? id.id : id });
  } catch (error) {
    console.error('Error creating cable advice:', error);
    return NextResponse.json({
      error: 'Failed to create cable advice'
    }, { status: 500 });
  }
}
