// Zastąp cały plik: src/app/api/transports/fix-distances/route.js

import { NextResponse } from 'next/server';
import db from '@/database/db';

// Współrzędne magazynów
const WAREHOUSES = {
  'bialystok': { lat: 53.1325, lng: 23.1688 },
  'zielonka': { lat: 52.3125, lng: 21.1390 }
};

// Funkcja do obliczania odległości - kopiowana z Twojego calculateDistance.js
async function calculateDistance(originLat, originLng, destinationLat, destinationLng) {
  try {
    console.log(`Obliczanie odległości: ${originLat},${originLng} → ${destinationLat},${destinationLng}`);
    
    // Bezpośrednie wywołanie Google Maps Distance Matrix API
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destinationLat},${destinationLng}&mode=driving&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Google Maps API response status:', data.status);
    
    if (data.status === 'OK' && 
        data.rows?.[0]?.elements?.[0]?.status === 'OK') {
      
      const distance = Math.round(data.rows[0].elements[0].distance.value / 1000);
      console.log(`Rzeczywista odległość drogowa: ${distance} km`);
      return distance;
    }
    
    throw new Error('Invalid API response');
  } catch (error) {
    console.error('Distance calculation error:', error);
    
    // Fallback - odległość w linii prostej z korektą (jak w Twoim oryginalnym kodzie)
    const straightLineDistance = calculateStraightLineDistance(
      originLat, originLng, destinationLat, destinationLng
    );
    
    const fallbackDistance = Math.round(straightLineDistance * 1.3);
    console.log(`Używam fallback distance: ${fallbackDistance} km`);
    return fallbackDistance;
  }
}

// Funkcja pomocnicza z Twojego oryginalnego kodu
function calculateStraightLineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function POST(request) {
  try {
    const { dryRun = false, batchSize = 20, offset = 0 } = await request.json();
    
    console.log('=== PRZELICZANIE KILOMETRÓW TRANSPORTÓW ===');
    console.log('Tryb testowy:', dryRun);
    console.log('Rozmiar partii:', batchSize);
    console.log('Offset:', offset);
    console.log('Google Maps API Key dostępny:', !!process.env.GOOGLE_MAPS_API_KEY);
    
    // Pobierz transporty w partiach
    const transports = await db('transports')
      .select('id', 'source_warehouse', 'latitude', 'longitude', 'distance', 'destination_city')
      .whereNotNull('latitude')
      .whereNotNull('longitude')
      .limit(batchSize)
      .offset(offset);
    
    // Sprawdź łączną liczbę transportów
    const totalCount = await db('transports')
      .whereNotNull('latitude')
      .whereNotNull('longitude')
      .count('* as count')
      .first();
    
    console.log(`Partia: ${offset + 1}-${offset + transports.length} z ${totalCount.count} transportów`);
    
    const results = {
      total: parseInt(totalCount.count),
      batchSize: transports.length,
      offset: offset,
      hasMore: (offset + batchSize) < totalCount.count,
      updated: 0,
      skipped: 0,
      errors: 0,
      changes: []
    };
    
    for (const transport of transports) {
      try {
        console.log(`\n--- Przetwarzanie transportu ID: ${transport.id} ---`);
        console.log(`Miasto: ${transport.destination_city}`);
        console.log(`Magazyn: ${transport.source_warehouse}`);
        
        // Określ magazyn (domyślnie białystok)
        const warehouse = transport.source_warehouse || 'bialystok';
        
        if (!WAREHOUSES[warehouse]) {
          console.log(`Transport ${transport.id}: Nieznany magazyn ${warehouse}, pomijam`);
          results.skipped++;
          results.changes.push({
            id: transport.id,
            city: transport.destination_city,
            status: 'skipped',
            reason: `Nieznany magazyn: ${warehouse}`
          });
          continue;
        }
        
        // Oblicz nową odległość od magazynu
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
          console.log(`✓ Zaktualizowano transport ${transport.id} w bazie danych`);
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
        results.changes.push({
          id: transport.id,
          city: transport.destination_city || 'Nieznane',
          status: 'error',
          reason: error.message
        });
      }
    }
    
    console.log('\n=== PODSUMOWANIE PARTII ===');
    console.log(`Zaktualizowane: ${results.updated}`);
    console.log(`Pominięte: ${results.skipped}`);
    console.log(`Błędy: ${results.errors}`);
    console.log(`Pozostało: ${results.hasMore ? 'TAK' : 'NIE'}`);
    
    return NextResponse.json({
      success: true,
      message: dryRun ? 'Partia przetestowana' : 'Partia przeliczona',
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
