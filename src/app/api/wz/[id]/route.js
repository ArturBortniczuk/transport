// src/app/api/wz/[id]/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { id } = params;

    // Pobierz dokument po ID lub nr_wz
    let doc = null;
    if (/^\d+$/.test(id)) {
      doc = await db('wz_documents').where('id', id).first();
    }
    if (!doc) {
      doc = await db('wz_documents').where('nr_wz', decodeURIComponent(id)).first();
    }

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Nie znaleziono dokumentu WZ' }, { status: 404 });
    }

    // Pobierz pozycje
    const items = await db('wz_items')
      .where('nr_wz', doc.nr_wz)
      .orderBy('id', 'asc');

    // Jeśli dokument ma przypisany transport, pobierz dane transportu
    let transportInfo = null;
    if (doc.transport_id) {
      transportInfo = await db('transports')
        .where('id', doc.transport_id)
        .first();
    }

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

export async function PATCH(request, { params }) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    const allowedFields = ['status', 'latitude', 'longitude', 'extracted_city', 'extracted_street', 'uwagi'];
    const updateData = {};

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    updateData.updated_at = db.fn.now();

    await db('wz_documents')
      .where(function() {
        if (/^\d+$/.test(id)) {
          this.where('id', id);
        } else {
          this.where('nr_wz', decodeURIComponent(id));
        }
      })
      .update(updateData);

    return NextResponse.json({ success: true, message: 'Zaktualizowano dokument WZ' });
  } catch (error) {
    console.error('Błąd aktualizacji WZ:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
