import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const data = await request.json();

    await db('cable_advices')
      .where({ id })
      .update({
        ...data,
        updated_at: db.fn.now()
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating cable advice:', error);
    return NextResponse.json({
      error: 'Failed to update cable advice'
    }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    await db('cable_advices')
      .where({ id })
      .delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cable advice:', error);
    return NextResponse.json({
      error: 'Failed to delete cable advice'
    }, { status: 500 });
  }
}
