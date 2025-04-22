// src/app/api/packagings/sync-mymaps/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getGoogleCoordinates } from '@/services/geocoding-google';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first();
  
  return session?.user_id;
};

// Funkcja do synchronizacji z Google MyMaps
export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie - albo przez cookie, albo przez nagłówek dla crona
    const cronAuth = request.headers.get('X-Cron-Auth');
    let isAuthenticated = false;

    if (cronAuth && cronAuth === process.env.CRON_SECRET) {
      isAuthenticated = true;
    } else {
      const authToken = request.cookies.get('authToken')?.value;
      const userId = await validateSession(authToken);
      
      if (userId) {
        // Sprawdź czy użytkownik jest adminem
        const user = await db('users')
          .where('email', userId)
          .select('is_admin')
          .first();
          
        isAuthenticated = user?.is_admin === true;
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { mapId } = await request.json();
    
    if (!mapId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak ID mapy MyMaps' 
      }, { status: 400 });
    }
    
    // Pobierz dane z Google MyMaps API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const mapsDataEndpoint = `https://www.googleapis.com/mapsengine/v1/maps/${mapId}/features?key=${apiKey}`;
    
    const response = await fetch(mapsDataEndpoint);
    
    if (!response.ok) {
      throw new Error(`Błąd API Google Maps: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Przetwórz dane z MyMaps
    const packagings = [];
    
    if (data.features && Array.isArray(data.features)) {
      for (const feature of data.features) {
        // Pobierz właściwości punktu
        const properties = feature.properties || {};
        const name = properties.name || 'Bez nazwy';
        const description = properties.description || '';
        
        // Pobierz geometrię (współrzędne)
        let lat = null;
        let lng = null;
        
        if (feature.geometry && feature.geometry.type === 'Point') {
          const coordinates = feature.geometry.coordinates;
          lng = coordinates[0];
          lat = coordinates[1];
        }
        
        // Parsuj opis aby wydobyć dane klienta i adres
        let clientName = name;
        let address = '';
        let city = '';
        let postalCode = '';
        let street = '';
        
        // Przykładowy wzorzec: "Klient: ABC, Adres: ul. Przykładowa 123, 00-001 Warszawa"
        const clientMatch = description.match(/Klient:\s*(.*?)(?:,|$)/i);
        if (clientMatch) {
          clientName = clientMatch[1].trim();
        }
        
        const addressMatch = description.match(/Adres:\s*(.*?)(?:$|\.)/i);
        if (addressMatch) {
          address = addressMatch[1].trim();
          
          // Próba wyodrębnienia kodu pocztowego i miasta
          const postalCodeMatch = address.match(/(\d{2}-\d{3})\s+([^,]+)/);
          if (postalCodeMatch) {
            postalCode = postalCodeMatch[1];
            city = postalCodeMatch[2].trim();
          } else {
            // Jeśli nie ma kodu pocztowego w standardowym formacie, spróbuj wyodrębnić miasto
            const cityMatch = address.match(/([^,]+)$/);
            if (cityMatch) {
              city = cityMatch[1].trim();
            }
          }
          
          // Próba wyodrębnienia ulicy
          const streetMatch = address.match(/(.*?)(?:,|$)/);
          if (streetMatch) {
            street = streetMatch[1].trim();
          }
        }
        
        // Jeśli brakuje współrzędnych lub miasta, próbujemy geokodować
        if ((!lat || !lng) && city) {
          try {
            const coords = await getGoogleCoordinates(city, postalCode, street);
            lat = coords.lat;
            lng = coords.lng;
          } catch (error) {
            console.error(`Błąd geokodowania dla ${address}:`, error);
          }
        }
        
        if (lat && lng && (city || address)) {
          packagings.push({
            external_id: feature.id || null,
            client_name: clientName,
            description: description,
            city: city || 'Nieznane',
            postal_code: postalCode || '',
            street: street || '',
            latitude: lat,
            longitude: lng,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
    }
    
    if (packagings.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Nie znaleziono opakowań do importu',
        imported: 0
      });
    }
    
    // Zaktualizuj istniejące i dodaj nowe opakowania
    const importResults = {
      added: 0,
      updated: 0,
      errors: 0
    };
    
    for (const packaging of packagings) {
      try {
        // Sprawdź czy opakowanie o takim external_id już istnieje
        const existingPackaging = await db('packagings')
          .where('external_id', packaging.external_id)
          .first();
        
        if (existingPackaging) {
          // Zaktualizuj istniejące opakowanie, ale tylko jeśli status jest 'pending'
          if (existingPackaging.status === 'pending') {
            await db('packagings')
              .where('id', existingPackaging.id)
              .update({
                ...packaging,
                updated_at: new Date().toISOString()
              });
            importResults.updated++;
          }
        } else {
          // Dodaj nowe opakowanie
          await db('packagings').insert(packaging);
          importResults.added++;
        }
      } catch (error) {
        console.error('Błąd podczas importu opakowania:', error);
        importResults.errors++;
      }
    }
    
    // Aktualizuj datę ostatniej synchronizacji
    await db('app_settings')
      .insert({
        key: 'last_mymaps_sync',
        value: new Date().toISOString()
      })
      .onConflict('key')
      .merge();
    
    return NextResponse.json({ 
      success: true, 
      message: `Zaimportowano dane z MyMaps: dodano ${importResults.added}, zaktualizowano ${importResults.updated}, błędy: ${importResults.errors}`,
      imported: importResults.added + importResults.updated,
      results: importResults,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error importing MyMaps data:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
