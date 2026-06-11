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

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.name || !data.cross_section) {
      return NextResponse.json({ error: 'Nazwa i przekrój są wymagane' }, { status: 400 });
    }

    const [id] = await db('cables_catalog').insert({
      name: data.name,
      cross_section: data.cross_section,
      is_active: true
    }).returning('id');

    return NextResponse.json({ success: true, id: typeof id === 'object' ? id.id : id });
  } catch (error) {
    console.error('Error creating cable catalog entry:', error);
    return NextResponse.json({
      error: 'Failed to create cable catalog entry'
    }, { status: 500 });
  }
}
