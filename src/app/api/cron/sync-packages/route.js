// src/app/api/cron/sync-packages/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Pobierz klucz API z zapytania (zabezpieczenie)
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key');
    
    // Sprawdź klucz API
    if (apiKey !== process.env.CRON_SECRET) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // ID mapy przechowywane w zmiennej środowiskowej
    const mapId = process.env.MYMAPS_ID;
    
    if (!mapId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak skonfigurowanego ID mapy MyMaps' 
      }, { status: 400 });
    }
    
    // Wywołaj API synchronizacji
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/packagings/sync-mymaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Dodaj specjalny nagłówek, który pozwoli na autentykację w API
        'X-Cron-Auth': process.env.CRON_SECRET
      },
      body: JSON.stringify({
        mapId: mapId
      })
    });
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in cron sync:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}