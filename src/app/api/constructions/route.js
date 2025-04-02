import { readFileSync, writeFileSync } from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';

const configPath = path.join(process.cwd(), 'src/config/constructions.json');

// Pobieranie listy budów
export async function GET() {
  try {
    const data = readFileSync(configPath, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Nie udało się pobrać listy budów' }, { status: 500 });
  }
}

// Aktualizacja listy budów
export async function PUT(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    // Tutaj weryfikacja czy użytkownik jest adminem...
    
    const data = await request.json();
    data.lastUpdate = new Date().toISOString();
    
    writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Nie udało się zaktualizować listy budów' }, { status: 500 });
  }
}