// src/app/api/wz/details/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nr = searchParams.get('nr') || searchParams.get('nr_wz');
    const id = searchParams.get('id');

    if (!nr && !id) {
      return NextResponse.json({ success: false, error: 'Nie podano numeru WZ ani ID' }, { status: 400 });
    }

    let doc = null;
    if (id && /^\d+$/.test(id)) {
      doc = await db('wz_documents').where('id', id).first();
    }
    if (!doc && nr) {
      const cleanNr = decodeURIComponent(nr).trim();
      doc = await db('wz_documents').where('nr_wz', cleanNr).first();
    }

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Nie znaleziono dokumentu WZ' }, { status: 404 });
    }

    // Pobierz pozycje
    const items = await db('wz_items')
      .where('nr_wz', doc.nr_wz)
      .orderBy('id', 'asc');

    // Informacje o transporcie
    let transportInfo = null;
    if (doc.transport_id) {
      transportInfo = await db('transports')
        .where('id', doc.transport_id)
        .first();
    }

    // Informacje o spedycji
    let spedycjaInfo = null;
    if (doc.spedycja_id) {
      spedycjaInfo = await db('spedycje')
        .where('id', doc.spedycja_id)
        .first();
    }

    return NextResponse.json({
      success: true,
      document: doc,
      items: items || [],
      transport: transportInfo,
      spedycja: spedycjaInfo
    });
  } catch (error) {
    console.error('Błąd pobierania szczegółów WZ:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
