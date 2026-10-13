// src/app/api/wz/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';
import { decodeBuffer, parseWzCsv, importWzRows } from '@/lib/wz-service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const warehouse = searchParams.get('warehouse') || searchParams.get('magazyn') || 'all';
    const status = searchParams.get('status') || 'all';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const mapOnly = searchParams.get('mapOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || (mapOnly ? '2000' : '100'), 10), 2000);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;

    // Podstawowe zapytanie dla dokumentów
    let query = db('wz_documents');

    if (warehouse && warehouse !== 'all') {
      const warehouses = warehouse.split(',').map(w => w.trim()).filter(Boolean);
      if (warehouses.length > 0) {
        query = query.whereIn('symbol_magazynu', warehouses);
      }
    }

    if (status && status !== 'all') {
      query = query.where('status', status);
    }

    if (dateFrom) {
      query = query.where('data_wystawienia', '>=', dateFrom);
    }

    if (dateTo) {
      query = query.where('data_wystawienia', '<=', dateTo);
    }

    if (mapOnly) {
      // Dla mapy pobieramy tylko dokumenty mające współrzędne
      query = query.whereNotNull('latitude').whereNotNull('longitude');
    }

    if (search) {
      const searchPattern = `%${search}%`;
      query = query.where(function () {
        this.whereILike('nr_wz', searchPattern)
          .orWhereILike('nazwa_kontrahenta', searchPattern)
          .orWhereILike('adres_dostawy', searchPattern)
          .orWhereILike('extracted_city', searchPattern)
          .orWhereILike('uwagi', searchPattern);
      });
    }

    // Klonujemy do zliczenia rekordów
    const totalCountQuery = query.clone().count('* as count').first();

    // Pobieramy dane
    const documents = await query
      .clone()
      .orderBy('data_wystawienia', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset);

    const totalCountRes = await totalCountQuery;
    const totalCount = parseInt(totalCountRes?.count || 0, 10);

    // Pobieranie statystyk i słowników
    const statsQuery = await db('wz_documents')
      .select(
        db.raw('COUNT(*) as total_count'),
        db.raw("COUNT(CASE WHEN status = 'nowy' THEN 1 END) as nowy_count"),
        db.raw("COUNT(CASE WHEN status = 'przypisany' THEN 1 END) as przypisany_count"),
        db.raw("COUNT(CASE WHEN status = 'zrealizowany' THEN 1 END) as zrealizowany_count"),
        db.raw('COALESCE(SUM(dok_brutto), 0) as total_brutto')
      )
      .first();

    const distinctWarehouses = await db('wz_documents')
      .distinct('symbol_magazynu', 'nazwa_magazynu')
      .whereNotNull('symbol_magazynu')
      .orderBy('symbol_magazynu', 'asc');

    return NextResponse.json({
      success: true,
      documents: documents || [],
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats: {
        total: parseInt(statsQuery?.total_count || 0, 10),
        nowy: parseInt(statsQuery?.nowy_count || 0, 10),
        przypisany: parseInt(statsQuery?.przypisany_count || 0, 10),
        zrealizowany: parseInt(statsQuery?.zrealizowany_count || 0, 10),
        totalBrutto: parseFloat(statsQuery?.total_brutto || 0)
      },
      warehouses: distinctWarehouses.map(w => ({
        symbol: w.symbol_magazynu,
        nazwa: w.nazwa_magazynu,
        label: `${w.symbol_magazynu} - ${w.nazwa_magazynu}`
      }))
    });
  } catch (error) {
    console.error('Błąd pobierania dokumentów WZ:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    let csvText = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return NextResponse.json({ success: false, error: 'Nie załączono pliku' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      csvText = decodeBuffer(buffer);
    } else {
      const body = await request.json();
      csvText = body.csvText || '';
    }

    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Pusta zawartość CSV' }, { status: 400 });
    }

    // Parsowanie i import
    const rows = parseWzCsv(csvText);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Nie znaleziono wierszy w pliku' }, { status: 400 });
    }

    const result = await importWzRows(rows);

    return NextResponse.json({
      success: true,
      message: `Pomyślnie zaimportowano ${result.totalDocuments} dokumentów i ${result.totalItems} pozycji towarowych.`,
      result
    });
  } catch (error) {
    console.error('Błąd importu WZ:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
