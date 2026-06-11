import { NextResponse } from 'next/server';
import db from '@/database/db';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Nie przesłano pliku' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.includes('Kable') ? 'Kable' : workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return NextResponse.json({ error: 'Plik Excel jest pusty lub niepoprawnie sformatowany' }, { status: 400 });
    }

    // Opcjonalnie: wyczyść starą tabelę przed importem
    await db('cables_catalog').truncate();

    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize).map(row => ({
        name: row['Nazwa'] ? row['Nazwa'].toString().trim() : null,
        cross_section: row['Liczba i przekrój żył'] ? row['Liczba i przekrój żył'].toString().trim() : null,
        shape: row['Kształt'] ? row['Kształt'].toString().trim() : null,
        working_core_diameter: row['Średnica żyły roboczej'] ? parseFloat(row['Średnica żyły roboczej']) : null,
        insulation_thickness: row['Grubość znamionowa izolacji'] ? parseFloat(row['Grubość znamionowa izolacji']) : null,
        outer_diameter: row['średnica zewnętrzna kabla'] ? parseFloat(row['średnica zewnętrzna kabla']) : null,
        bending_radius: row['promień gięcia'] ? parseFloat(row['promień gięcia']) : null,
        weight_kg_km: row['Masa kg/km'] ? parseFloat(row['Masa kg/km']) : null
      })).filter(c => c.name && c.cross_section);

      if (batch.length > 0) {
        await db('cables_catalog').insert(batch);
        inserted += batch.length;
      }
    }

    return NextResponse.json({ success: true, message: `Zimportowano ${inserted} kabli` });
  } catch (error) {
    console.error('Błąd importu kabli:', error);
    return NextResponse.json({ error: 'Wystąpił błąd podczas importu: ' + error.message }, { status: 500 });
  }
}
