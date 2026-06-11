import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function PUT(request) {
  try {
    const data = await request.json();
    const { oldName, newName } = data;

    if (!oldName || !newName || oldName === newName) {
      return NextResponse.json({ error: 'Nieprawidłowe dane do zmiany nazwy' }, { status: 400 });
    }

    await db('cables_catalog')
      .where({ name: oldName })
      .update({ name: newName });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in bulk renaming cables:', error);
    return NextResponse.json({
      error: 'Failed to rename cable group'
    }, { status: 500 });
  }
}
