// src/app/api/packagings/sync-mymaps/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getGoogleCoordinates } from '../../../services/geocoding-google';
import { XMLParser } from 'fast-xml-parser';

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

// Funkcja pomocnicza do parsowania KML
const parseKML = async (kmlText) => {
  try {
    // Używamy biblioteki fast-xml-parser zamiast DOMParser, który jest dostępny tylko w przeglądarce
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true
    });
    
    const parsed = parser.parse(kmlText);
    const packagings = [];
    
    // Pobierz placemarks z kml > Document > Placemark (dostosuj ścieżkę w razie potrzeby)
    const placemarks = parsed?.kml?.Document?.Placemark || [];
    const placemarksArray = Array.isArray(placemarks) ? placemarks : [placemarks];
    
    for (let i = 0; i < placemarksArray.length; i++) {
      const placemark = placemarksArray[i];
      
      // Pobierz nazwę
      const name = placemark.name || 'Bez nazwy';
      
      // Pobierz opis
      const description = placemark.description || '';
      
      // Pobierz współrzędne
      let lat = null;
      let lng = null;
      
      // Obsługuj różne struktury dla współrzędnych
      if (placemark.Point && placemark.Point.coordinates) {
        const coordsText = placemark.Point.coordinates;
        const coordParts = coordsText.split(',');
        
        if (coordParts.length >= 2) {
          lng = parseFloat(coordParts[0]);
          lat = parseFloat(coordParts[1]);
        }
      }
      
      // Generuj unikalny ID dla Placemark
      const placemarkId = `placemark_${i}_${Date.now()}`;
      
      // Parsuj dane klienta i adres z opisu
      let clientName = name;
      let address = '';
      let city = 'Nieznane';
      let postalCode = '';
      let street = '';
      
      // Wyodrębnij informacje z opisu HTML
      if (description) {
        // Usunięcie tagów HTML aby łatwiej było parsować tekst
        const cleanDescription = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Wzorzec dla klienta
        const clientMatch = cleanDescription.match(/Klient:\s*([^,\n]+)/i);
        if (clientMatch) {
          clientName = clientMatch[1].trim();
        }
        
        // Wzorzec dla adresu
        const addressMatch = cleanDescription.match(/Adres:\s*([^,\n]+(?:,[^,\n]+)*)/i);
        if (addressMatch) {
          address = addressMatch[1].trim();
          
          // Wzorzec dla kodu pocztowego i miasta
          const cityMatch = address.match(/(\d{2}-\d{3})\s+([^,]+)/);
          if (cityMatch) {
            postalCode = cityMatch[1];
            city = cityMatch[2].trim();
            
            // Ulica może być przed kodem pocztowym
            const streetParts = address.split(postalCode);
            if (streetParts.length > 0 && streetParts[0]) {
              street = streetParts[0].replace(/,$/, '').trim();
            }
          } else {
            // Jeśli nie znaleziono kodu pocztowego, sprawdzamy inne wzorce
            const parts = address.split(',');
            if (parts.length >= 2) {
              // Ostatnia część może być miastem
              city = parts[parts.length - 1].trim();
              
              // Pierwsza część może być ulicą
              street = parts[0].trim();
            } else if (parts.length === 1) {
              city = parts[0].trim();
            }
          }
        }
      }
      
      // Jeśli nie mamy współrzędnych, próbujemy geokodować
      if ((!lat || !lng) && city !== 'Nieznane') {
        try {
          console.log(`Geokodowanie: ${city}, ${postalCode}, ${street}`);
          const coords = await getGoogleCoordinates(city, postalCode, street);
          lat = coords.lat;
          lng = coords.lng;
        } catch (error) {
          console.error(`Błąd geokodowania dla ${address}:`, error);
        }
      }
      
      // Dodaj tylko jeśli mamy współrzędne i miasto
      if (lat && lng) {
        packagings.push({
          external_id: placemarkId,
          client_name: clientName,
          description: description,
          city: city,
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
    
    return packagings;
  } catch (error) {
    console.error('Błąd podczas parsowania KML:', error);
    throw error;
  }
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
    
    // Pobierz dane z Google MyMaps w formacie KML
    const kmlEndpoint = `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=1`;
    console.log(`Pobieranie KML z: ${kmlEndpoint}`);
    
    const response = await fetch(kmlEndpoint);
    
    if (!response.ok) {
      throw new Error(`Błąd pobierania KML: ${response.status}`);
    }
    
    const kmlText = await response.text();
    
    // Parsuj KML i wyodrębnij dane
    const packagings = await parseKML(kmlText);
    
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
    
    // Sprawdź czy tabela app_settings istnieje
    const appSettingsExists = await db.schema.hasTable('app_settings');
    if (!appSettingsExists) {
      await db.schema.createTable('app_settings', table => {
        table.string('key').primary();
        table.text('value');
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
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
