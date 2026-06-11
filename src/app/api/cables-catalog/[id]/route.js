import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Soft delete lub hard delete - zrobimy hard delete na życzenie
    await db('cables_catalog').where({ id }).del();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cable catalog entry:', error);
    return NextResponse.json({
      error: 'Failed to delete cable catalog entry'
    }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const data = await request.json();

    if (!data.name || !data.cross_section) {
      return NextResponse.json({ error: 'Nazwa i przekrój są wymagane' }, { status: 400 });
    }

    await db('cables_catalog')
      .where({ id })
      .update({
        name: data.name,
        cross_section: data.cross_section
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating cable catalog entry:', error);
    return NextResponse.json({
      error: 'Failed to update cable catalog entry'
    }, { status: 500 });
  }
}
