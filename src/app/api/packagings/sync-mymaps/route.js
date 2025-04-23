// src/app/api/packagings/sync-mymaps/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getGoogleCoordinates } from '../../../services/geocoding-google';
import { XMLParser } from 'fast-xml-parser';

const validateSession = async (authToken) => {
  if (!authToken) return null;
  
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
    // Logowanie początku tekstu KML dla diagnostyki
    console.log('Surowy tekst KML (początek):', kmlText.substring(0, 500) + '...');
    
    // Używamy biblioteki fast-xml-parser z lepszą konfiguracją
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseAttributeValue: true,
      isArray: (name) => ['Placemark', 'Folder'].includes(name)
    });
    
    const parsed = parser.parse(kmlText);
    console.log('Struktura po parsowaniu (próbka):', JSON.stringify(parsed, null, 2).substring(0, 500) + '...');
    
    const packagings = [];
    
    // Szukamy placemarks w różnych możliwych strukturach
    let allPlacemarks = [];
    
    // Sprawdź, czy placemarks są bezpośrednio w Document
    if (parsed?.kml?.Document?.Placemark) {
      console.log('Znaleziono placemarks bezpośrednio w Document');
      const docPlacemarks = Array.isArray(parsed.kml.Document.Placemark) ? 
        parsed.kml.Document.Placemark : [parsed.kml.Document.Placemark];
      allPlacemarks = [...allPlacemarks, ...docPlacemarks];
    }
    
    // Sprawdź, czy placemarks są w folderach
    if (parsed?.kml?.Document?.Folder) {
      const folders = Array.isArray(parsed.kml.Document.Folder) ? 
        parsed.kml.Document.Folder : [parsed.kml.Document.Folder];
      
      console.log(`Znaleziono ${folders.length} folderów w dokumencie KML`);
      
      for (const folder of folders) {
        if (folder.Placemark) {
          const folderPlacemarks = Array.isArray(folder.Placemark) ? 
            folder.Placemark : [folder.Placemark];
          console.log(`Znaleziono ${folderPlacemarks.length} placemarks w folderze "${folder.name || 'bez nazwy'}"`);
          allPlacemarks = [...allPlacemarks, ...folderPlacemarks];
        }
      }
    }
    
    console.log(`Łącznie znaleziono ${allPlacemarks.length} placemarks`);
    
    // Przejdź przez wszystkie znalezione placemarks
    for (let i = 0; i < allPlacemarks.length; i++) {
      const placemark = allPlacemarks[i];
      
      // Pobierz nazwę
      const name = placemark.name || 'Bez nazwy';
      console.log(`Przetwarzanie placemark: ${name}`);
      
      // Pobierz opis
      const description = placemark.description || '';
      
      // Pobierz współrzędne
      let lat = null;
      let lng = null;
      
      // Obsługuj różne struktury dla współrzędnych
      if (placemark.Point && placemark.Point.coordinates) {
        const coordsText = placemark.Point.coordinates;
        console.log(`Współrzędne dla ${name}: ${coordsText}`);
        
        // Oczyść i podziel tekst współrzędnych
        const coordParts = coordsText.trim().split(',');
        
        if (coordParts.length >= 2) {
          lng = parseFloat(coordParts[0]);
          lat = parseFloat(coordParts[1]);
          console.log(`Parsowane współrzędne: lat=${lat}, lng=${lng}`);
        }
      } else {
        console.log(`Brak współrzędnych dla ${name}`);
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
        // Usuń tagi CDATA i HTML z opisu
        const cleanDescription = description
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log(`Oczyszczony opis: ${cleanDescription.substring(0, 100)}...`);
        
        // Próbujemy wyodrębnić kod pocztowy z formatu XX-XXX
        const postalCodeMatch = cleanDescription.match(/\b\d{2}-\d{3}\b/);
        if (postalCodeMatch) {
          postalCode = postalCodeMatch[0];
          console.log(`Znaleziono kod pocztowy: ${postalCode}`);
          
          // Spróbuj znaleźć miasto przed lub po kodzie pocztowym
          const beforePostalCode = cleanDescription.split(postalCode)[0].trim();
          const afterPostalCode = cleanDescription.split(postalCode)[1].trim();
          
          // Znajdź miasto - zazwyczaj tuż przed lub po kodzie pocztowym
          const beforeWords = beforePostalCode.split(/\s+/);
          const afterWords = afterPostalCode.split(/\s+/);
          
          if (afterWords.length > 0) {
            city = afterWords[0].replace(/,/g, '');
          } else if (beforeWords.length > 0) {
            city = beforeWords[beforeWords.length - 1].replace(/,/g, '');
          }
        } else {
          // Alternatywne podejście - szukanie typowych nazw miast
          const cityMatch = cleanDescription.match(/(?:ul\.|ulica)\s+[^,]+,\s*([^,\d]+)/i);
          if (cityMatch) {
            city = cityMatch[1].trim();
          }
        }
        
        // Próbujemy wyodrębnić ulicę
        const streetMatch = cleanDescription.match(/(?:ul\.|ulica)\s+([^,]+)/i);
        if (streetMatch) {
          street = streetMatch[1].trim();
          console.log(`Znaleziono ulicę: ${street}`);
        }
        
        // Jeśli nazwa klienta nie została wyodrębniona, użyj pierwszej linii opisu
        if (clientName === 'Bez nazwy' || clientName === name) {
          const firstLine = cleanDescription.split(',')[0].trim();
          if (firstLine) clientName = firstLine;
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
        console.log(`Dodano opakowanie: ${clientName}, ${city}`);
      } else {
        console.log(`Pominięto opakowanie bez współrzędnych: ${clientName}`);
      }
    }
    
    console.log(`Przetworzono ${allPlacemarks.length} placemarks, znaleziono ${packagings.length} opakowań z poprawnymi danymi`);
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
      console.log('Uwierzytelnienie przez nagłówek X-Cron-Auth');
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
        console.log(`Uwierzytelnienie przez cookie dla użytkownika ${userId}: ${isAuthenticated ? 'sukces' : 'brak uprawnień'}`);
      }
    }

    if (!isAuthenticated) {
      console.log('Brak uwierzytelnienia - odmowa dostępu');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { mapId } = await request.json();
    console.log('Rozpoczynam synchronizację mapy z ID:', mapId);
    
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
      console.error(`Błąd pobierania KML: ${response.status}`);
      throw new Error(`Błąd pobierania KML: ${response.status}`);
    }
    
    const kmlText = await response.text();
    console.log(`Pobrano plik KML, długość: ${kmlText.length} znaków`);
    
    // Parsuj KML i wyodrębnij dane
    const packagings = await parseKML(kmlText);
    
    if (packagings.length === 0) {
      console.log('Nie znaleziono opakowań do importu');
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
    
    // W funkcji POST, zmodyfikuj pętlę dla każdego opakowania:
    for (const packaging of packagings) {
      try {
        // Sprawdź czy opakowanie o takim external_id już istnieje
        const existingPackaging = await db('packagings')
          .where('external_id', packaging.external_id)
          .first();
        
        if (existingPackaging) {
          // Zaktualizuj istniejące opakowanie, ale tylko jeśli status jest 'pending'
          if (existingPackaging.status === 'pending') {
            try {
              await db('packagings')
                .where('id', existingPackaging.id)
                .update({
                  ...packaging,
                  updated_at: new Date().toISOString()
                });
              importResults.updated++;
              console.log(`Zaktualizowano opakowanie ID ${existingPackaging.id}: ${packaging.client_name}`);
            } catch (updateError) {
              console.error(`Błąd aktualizacji opakowania ${existingPackaging.id}:`, updateError);
              importResults.errors++;
            }
          }
        } else {
          // Dodaj nowe opakowanie, z osobną obsługą błędów dla operacji INSERT
          try {
            // Logujemy dokładnie jakie dane próbujemy wstawić
            console.log('Próba dodania opakowania:', JSON.stringify(packaging));
            
            const insertResult = await db('packagings').insert(packaging);
            console.log('Wynik dodawania:', insertResult);
            
            importResults.added++;
            console.log(`Dodano nowe opakowanie: ${packaging.client_name}, ID: ${insertResult}`);
          } catch (insertError) {
            console.error(`Błąd dodawania nowego opakowania (${packaging.client_name}):`, insertError.message);
            console.error('Pełne dane powodujące błąd:', JSON.stringify(packaging));
            importResults.errors++;
          }
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
      console.log('Utworzono tabelę app_settings');
    }
    
    // Aktualizuj datę ostatniej synchronizacji
    await db('app_settings')
      .insert({
        key: 'last_mymaps_sync',
        value: new Date().toISOString()
      })
      .onConflict('key')
      .merge();
    
    console.log(`Zakończono synchronizację: dodano ${importResults.added}, zaktualizowano ${importResults.updated}, błędy: ${importResults.errors}`);
    
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
