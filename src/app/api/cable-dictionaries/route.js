import { NextResponse } from 'next/server';
import db from '@/database/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const dictionaries = await db('cable_dictionaries')
      .select('*')
      .where('is_active', true)
      .orderBy('category', 'asc')
      .orderBy('value', 'asc');

    return NextResponse.json(dictionaries);
  } catch (error) {
    console.error('Error fetching cable dictionaries:', error);
    return NextResponse.json({
      error: 'Failed to fetch cable dictionaries'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.category || !data.value) {
      return NextResponse.json({ error: 'Brak wymaganych danych' }, { status: 400 });
    }

    const [id] = await db('cable_dictionaries').insert({
      category: data.category,
      value: data.value,
      is_active: true
    }).returning('id');

    return NextResponse.json({ success: true, id: typeof id === 'object' ? id.id : id });
  } catch (error) {
    console.error('Error creating cable dictionary entry:', error);
    return NextResponse.json({
      error: 'Failed to create cable dictionary entry'
    }, { status: 500 });
  }
}
