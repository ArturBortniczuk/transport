// src/app/api/packagings/sync-mymaps/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getGoogleCoordinates } from '../../../services/geocoding-google';
import { XMLParser } from 'fast-xml-parser';

// Funkcja pomocnicza do sprawdzania czy kolumna istnieje
async function hasColumn(tableName, columnName) {
  try {
    const columnInfo = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ? AND column_name = ?
    `, [tableName, columnName]);
    
    return columnInfo.rows && columnInfo.rows.length > 0;
  } catch (error) {
    console.error(`Błąd podczas sprawdzania kolumny ${columnName} w tabeli ${tableName}:`, error);
    return false;
  }
}

// Funkcja pomocnicza do parsowania KML
const parseKML = async (kmlText) => {
  try {
    console.log('Rozpoczynam parsowanie pliku KML...');
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseAttributeValue: true,
      isArray: (name) => ['Placemark', 'Folder'].includes(name)
    });
    
    const parsed = parser.parse(kmlText);
    
    const packagings = [];
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
      
      // Pobierz opis
      const description = placemark.description || '';
      
      // Pobierz współrzędne
      let lat = null;
      let lng = null;
      
      if (placemark.Point && placemark.Point.coordinates) {
        const coordsText = placemark.Point.coordinates;
        const coordParts = coordsText.trim().split(',');
        
        if (coordParts.length >= 2) {
          lng = parseFloat(coordParts[0]);
          lat = parseFloat(coordParts[1]);
        }
      }
      
      // Generuj unikalny ID dla Placemark
      const placemarkId = `placemark_${i}_${Date.now()}`;
      
      // Parsuj dane klienta i adres z opisu
      let clientName = name;
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
        
        // Próbujemy wyodrębnić kod pocztowy
        const postalCodeMatch = cleanDescription.match(/\b\d{2}-\d{3}\b/);
        if (postalCodeMatch) {
          postalCode = postalCodeMatch[0];
          
          // Spróbuj znaleźć miasto przed lub po kodzie pocztowym
          const beforePostalCode = cleanDescription.split(postalCode)[0].trim();
          const afterPostalCode = cleanDescription.split(postalCode)[1].trim();
          
          // Znajdź miasto
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
          const coords = await getGoogleCoordinates(city, postalCode, street);
          lat = coords.lat;
          lng = coords.lng;
        } catch (error) {
          console.error(`Błąd geokodowania dla ${city}, ${postalCode}, ${street}:`, error);
        }
      }
      
      // Dodaj tylko jeśli mamy współrzędne i miasto
      if (lat && lng) {
        packagings.push({
          external_id: placemarkId,
          client_name: clientName,
          description: description || 'Brak opisu',
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
    console.log('Rozpoczęcie synchronizacji z Google MyMaps');
    
    // Sprawdź, czy kolumna external_id istnieje i dodaj ją jeśli nie
    const hasExternalId = await hasColumn('packagings', 'external_id');
    if (!hasExternalId) {
      console.log('Kolumna external_id nie istnieje w tabeli packagings. Dodawanie...');
      try {
        await db.schema.table('packagings', table => {
          table.string('external_id');
        });
        console.log('Kolumna external_id została dodana do tabeli packagings');
      } catch (alterError) {
        console.error('Błąd podczas dodawania kolumny external_id:', alterError);
        // Kontynuujemy działanie - będziemy używać innych kolumn do identyfikacji
      }
    }
    
    // Zmodyfikowana obsługa uwierzytelniania z lepszą obsługą błędów
    const cronAuth = request.headers.get('X-Cron-Auth');
    let isAuthenticated = false;

    try {
      if (cronAuth && cronAuth === process.env.CRON_SECRET) {
        isAuthenticated = true;
        console.log('Uwierzytelnienie przez nagłówek X-Cron-Auth');
      } else {
        const authToken = request.cookies.get('authToken')?.value;
        
        if (!authToken) {
          console.log('Brak tokenu uwierzytelniającego');
          return NextResponse.json({ 
            success: false, 
            error: 'Brak tokenu uwierzytelniającego' 
          }, { status: 401 });
        }
        
        try {
          const session = await db('sessions')
            .where('token', authToken)
            .whereRaw('expires_at > NOW()')
            .select('user_id')
            .first();
          
          if (!session) {
            console.log('Sesja wygasła lub jest nieprawidłowa');
            return NextResponse.json({ 
              success: false, 
              error: 'Sesja wygasła lub jest nieprawidłowa' 
            }, { status: 401 });
          }
          
          const userId = session.user_id;
          
          // Sprawdź czy użytkownik jest adminem
          const user = await db('users')
            .where('email', userId)
            .select('is_admin')
            .first();
          
          if (!user) {
            console.log('Nie znaleziono użytkownika');
            return NextResponse.json({ 
              success: false, 
              error: 'Nie znaleziono użytkownika' 
            }, { status: 401 });
          }
          
          isAuthenticated = user.is_admin === true;
          console.log(`Uwierzytelnienie dla użytkownika ${userId}: ${isAuthenticated ? 'sukces' : 'brak uprawnień'}`);
        } catch (sessionError) {
          console.error('Błąd podczas weryfikacji sesji:', sessionError);
          return NextResponse.json({ 
            success: false, 
            error: 'Błąd podczas weryfikacji sesji' 
          }, { status: 500 });
        }
      }

      if (!isAuthenticated) {
        console.log('Brak uprawnień administratora');
        return NextResponse.json({ 
          success: false, 
          error: 'Brak uprawnień administratora' 
        }, { status: 403 });
      }
    } catch (authError) {
      console.error('Błąd uwierzytelniania:', authError);
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd uwierzytelniania: ' + authError.message 
      }, { status: 500 });
    }
    
    // Bezpieczne parsowanie danych JSON z żądania
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error('Błąd parsowania JSON z żądania:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowy format danych' 
      }, { status: 400 });
    }
    
    const { mapId: rawMapId } = requestData;
    if (!rawMapId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak ID mapy MyMaps' 
      }, { status: 400 });
    }
    
    // Wyodrębnij ID mapy bez dodatkowych parametrów
    const mapId = rawMapId.split('&')[0];
    console.log('ID mapy do synchronizacji:', mapId);
    
    // Pobierz dane z Google MyMaps w formacie KML
    const kmlEndpoint = `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=1`;
    
    let response;
    try {
      response = await fetch(kmlEndpoint);
      
      if (!response.ok) {
        throw new Error(`Błąd pobierania KML: ${response.status}`);
      }
    } catch (fetchError) {
      console.error('Błąd pobierania KML:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd pobierania danych z Google MyMaps: ' + fetchError.message 
      }, { status: 500 });
    }
    
    const kmlText = await response.text();
    console.log(`Pobrano plik KML, długość: ${kmlText.length} znaków`);
    
    // Parsuj KML i wyodrębnij dane
    let packagings;
    try {
      packagings = await parseKML(kmlText);
    } catch (parseError) {
      console.error('Błąd parsowania KML:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd parsowania danych KML: ' + parseError.message 
      }, { status: 500 });
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
    
    // Przetwarzaj opakowania - użyj współrzędnych jako alternatywnego identyfikatora
    for (const packaging of packagings) {
      try {
        // Warunek wyszukiwania - używaj współrzędnych zamiast external_id
        const existingPackaging = await db('packagings')
          .where({ 
            latitude: packaging.latitude,
            longitude: packaging.longitude
          })
          .first();
        
        if (existingPackaging) {
          // Zaktualizuj istniejące opakowanie, ale tylko jeśli status jest 'pending'
          if (existingPackaging.status === 'pending') {
            const updateFields = {
              client_name: packaging.client_name,
              description: packaging.description,
              city: packaging.city,
              postal_code: packaging.postal_code,
              street: packaging.street,
              updated_at: new Date().toISOString()
            };
            
            if (hasExternalId) {
              updateFields.external_id = packaging.external_id;
            }
            
            await db('packagings')
              .where('id', existingPackaging.id)
              .update(updateFields);
              
            importResults.updated++;
          }
        } else {
          // Dodaj nowe opakowanie
          const insertFields = {
            client_name: packaging.client_name,
            description: packaging.description,
            city: packaging.city,
            postal_code: packaging.postal_code || '',
            street: packaging.street || '',
            latitude: packaging.latitude,
            longitude: packaging.longitude,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          if (hasExternalId) {
            insertFields.external_id = packaging.external_id;
          }
          
          await db('packagings').insert(insertFields);
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
    
    console.log(`Podsumowanie synchronizacji: dodano ${importResults.added}, zaktualizowano ${importResults.updated}, błędy: ${importResults.errors}`);
    
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
      error: 'Błąd podczas importu danych: ' + error.message 
    }, { status: 500 });
  }
}
