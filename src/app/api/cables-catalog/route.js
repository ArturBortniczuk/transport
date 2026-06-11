import { NextResponse } from 'next/server';
import db from '@/database/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const cables = await db('cables_catalog')
      .select('name', 'cross_section')
      .where('is_active', true)
      .orderBy('name', 'asc')
      .orderBy('cross_section', 'asc');

    // Grupowanie na serwerze:
    // Zwrócimy obiekt: { uniqueNames: ['YAK', '...'], grouped: { 'YAK': ['1x35', ...], ... } }
    
    const uniqueNames = [...new Set(cables.map(c => c.name))];
    const grouped = {};
    
    cables.forEach(c => {
      if (!grouped[c.name]) {
        grouped[c.name] = [];
      }
      if (!grouped[c.name].includes(c.cross_section)) {
        grouped[c.name].push(c.cross_section);
      }
    });

    return NextResponse.json({ uniqueNames, grouped, all: cables });
  } catch (error) {
    console.error('Error fetching cables catalog:', error);
    return NextResponse.json({
      error: 'Failed to fetch cables catalog'
    }, { status: 500 });
  }
}
