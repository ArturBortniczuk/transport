// Utwórz plik: src/app/api/transports/fix-distances/route.js

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { calculateDistance } from '@/app/services/calculateDistance';

// Współrzędne magazynów
const WAREHOUSES = {
  'bialystok': { lat: 53.1325, lng: 23.1688 },
  'zielonka': { lat: 52.3125, lng: 21.1390 }
};



export async function POST(request) {
  try {
    const { dryRun = false } = await request.json();
    
    console.log('=== PRZELICZANIE KILOMETRÓW TRANSPORTÓW ===');
    console.log('Tryb testowy:', dryRun);
    
    // Pobierz wszystkie transporty z współrzędnymi
    const transports = await db('transports')
      .select('id', 'source_warehouse', 'latitude', 'longitude', 'distance', 'destination_city')
      .whereNotNull('latitude')
      .whereNotNull('longitude');
    
    console.log(`Znaleziono ${transports.length} transportów do przeliczenia`);
    
    const results = {
      total: transports.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      changes: []
    };
    
    for (const transport of transports) {
      try {
        // Określ magazyn (domyślnie białystok)
        const warehouse = transport.source_warehouse || 'bialystok';
        
        if (!WAREHOUSES[warehouse]) {
          console.log(`Transport ${transport.id}: Nieznany magazyn ${warehouse}, pomijam`);
          results.skipped++;
          continue;
        }
        
        // Oblicz nową odległość od magazynu - używając istniejącej funkcji
        const newDistance = await calculateDistance(
          WAREHOUSES[warehouse].lat,
          WAREHOUSES[warehouse].lng,
          transport.latitude,
          transport.longitude
        );
        
        const oldDistance = transport.distance || 0;
        
        console.log(`Transport ${transport.id} (${transport.destination_city}): ${oldDistance}km → ${newDistance}km`);
        
        // Aktualizuj jeśli nie tryb testowy
        if (!dryRun) {
          await db('transports')
            .where('id', transport.id)
            .update({ distance: newDistance });
        }
        
        results.updated++;
        results.changes.push({
          id: transport.id,
          city: transport.destination_city,
          warehouse: warehouse,
          oldDistance: oldDistance,
          newDistance: newDistance,
          difference: newDistance - oldDistance
        });
        
      } catch (error) {
        console.error(`Błąd transportu ${transport.id}:`, error);
        results.errors++;
      }
    }
    
    console.log('\n=== PODSUMOWANIE ===');
    console.log(`Zaktualizowane: ${results.updated}`);
    console.log(`Pominięte: ${results.skipped}`);
    console.log(`Błędy: ${results.errors}`);
    
    return NextResponse.json({
      success: true,
      message: dryRun ? 'Test zakończony' : 'Przeliczanie zakończone',
      results
    });
    
  } catch (error) {
    console.error('Główny błąd:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}