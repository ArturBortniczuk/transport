import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Zamiast fizycznego usunięcia możemy zrobić soft-delete
    await db('cable_dictionaries')
      .where({ id })
      .delete(); // lub update({ is_active: false })

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cable dictionary entry:', error);
    return NextResponse.json({
      error: 'Failed to delete cable dictionary entry'
    }, { status: 500 });
  }
}
