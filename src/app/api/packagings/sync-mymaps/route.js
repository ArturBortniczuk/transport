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
    
    // Zbieramy wszystkie placemarks (pineski)
    if (parsed?.kml?.Document?.Placemark) {
      console.log('Znaleziono placemarks bezpośrednio w Document');
      const docPlacemarks = Array.isArray(parsed.kml.Document.Placemark) ? 
        parsed.kml.Document.Placemark : [parsed.kml.Document.Placemark];
      allPlacemarks = [...allPlacemarks, ...docPlacemarks];
    }
    
    // Zbieramy placemarks z folderów (szczególnie z folderu "Bębny")
    if (parsed?.kml?.Document?.Folder) {
      const folders = Array.isArray(parsed.kml.Document.Folder) ? 
        parsed.kml.Document.Folder : [parsed.kml.Document.Folder];
      
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
    
    // Przetwarzanie każdej pineski
    for (let i = 0; i < allPlacemarks.length; i++) {
      try {
        const placemark = allPlacemarks[i];
        
        // Pobierz nazwę - zawiera nazwę firmy
        const name = placemark.name || 'Bez nazwy';
        
        // Pobierz opis
        let description = '';
        if (placemark.description) {
          // Usuń tagi CDATA i zamień <br> na nowe linie
          description = placemark.description
            .replace(/<!\[CDATA\[|\]\]>/g, '')
            .replace(/<br>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .trim();
        }
        
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
        
        // Pomiń placemarki bez współrzędnych
        if (!lat || !lng) {
          console.log(`Pominięto placemark bez współrzędnych: ${name}`);
          continue;
        }
        
        // Generuj unikalny ID dla Placemark
        const placemarkId = `placemark_${i}_${Date.now()}`;
        
        // Domyślne wartości
        let clientName = name;
        let city = 'Nieznane';
        let postalCode = '';
        let street = '';
        
        // Spróbuj znaleźć kod pocztowy w opisie
        const postalCodePattern = /\b\d{2}-\d{3}\b/;
        const postalCodeMatch = description.match(postalCodePattern);
        if (postalCodeMatch) {
          postalCode = postalCodeMatch[0];
        }
        
        // Spróbuj znaleźć adres w opisie
        const lines = description.split('\n');
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j].trim();
          
          // Szukaj ulicy (linie zawierające "ul." lub "ulica" itp.)
          if (line.includes('ul.') || line.includes('ulica') || line.includes('Ulica')) {
            street = line;
          }
          
          // Szukaj miasta i kodu pocztowego
          if (postalCode && line.includes(postalCode)) {
            const parts = line.split(postalCode);
            if (parts.length > 1 && parts[1].trim()) {
              city = parts[1].trim();
            } else if (parts.length > 0 && parts[0].trim()) {
              city = parts[0].trim();
            }
          }
        }
        
        // Jeśli nie znaleziono miasta, szukaj w nazwie pineski
        if (city === 'Nieznane' && name.includes('/')) {
          const nameParts = name.split('/');
          if (nameParts.length > 1) {
            city = nameParts[1].trim();
          }
        }
        
        packagings.push({
          external_id: placemarkId,
          client_name: clientName,
          description: description,
          city: city,
          postal_code: postalCode,
          street: street,
          latitude: lat,
          longitude: lng,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (placemarkError) {
        console.error(`Błąd podczas przetwarzania placemark ${i}:`, placemarkError);
        // Kontynuuj mimo błędu z pojedynczym placemarket
        continue;
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
    
    // Zmodyfikowana obsługa uwierzytelniania
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
        
        // Zwiększamy timeout na zapytanie do bazy danych
        const sessionTimeout = 30000; // 30 sekund na operację
        let session = null;
        
        try {
          session = await Promise.race([
            db('sessions')
              .where('token', authToken)
              .whereRaw('expires_at > NOW()')
              .select('user_id')
              .first(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout podczas sprawdzania sesji')), sessionTimeout)
            )
          ]);
        } catch (dbError) {
          console.error('Błąd dostępu do bazy danych:', dbError);
          return NextResponse.json({ 
            success: false, 
            error: 'Błąd podczas weryfikacji sesji: ' + dbError.message 
          }, { status: 500 });
        }
        
        if (!session) {
          console.log('Sesja wygasła lub jest nieprawidłowa');
          return NextResponse.json({ 
            success: false, 
            error: 'Sesja wygasła lub jest nieprawidłowa' 
          }, { status: 401 });
        }
        
        const userId = session.user_id;
        
        // Sprawdź czy użytkownik jest adminem
        let user = null;
        try {
          user = await Promise.race([
            db('users')
              .where('email', userId)
              .select('is_admin')
              .first(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout podczas sprawdzania uprawnień')), sessionTimeout)
            )
          ]);
        } catch (userError) {
          console.error('Błąd dostępu do danych użytkownika:', userError);
          return NextResponse.json({ 
            success: false, 
            error: 'Błąd podczas weryfikacji uprawnień: ' + userError.message 
          }, { status: 500 });
        }
        
        if (!user) {
          console.log('Nie znaleziono użytkownika');
          return NextResponse.json({ 
            success: false, 
            error: 'Nie znaleziono użytkownika' 
          }, { status: 401 });
        }
        
        isAuthenticated = user.is_admin === true || user.is_admin === 1;
        console.log(`Uwierzytelnienie dla użytkownika ${userId}: ${isAuthenticated ? 'sukces' : 'brak uprawnień'}`);
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
    const mapId = rawMapId.includes('&') ? rawMapId.split('&')[0] : rawMapId;
    console.log('ID mapy do synchronizacji:', mapId);
    
    // Pobierz dane z Google MyMaps w formacie KML
    const kmlEndpoint = `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=1`;
    
    let response;
    try {
      // Uwaga: fetch w Next.js/Node.js nie obsługuje opcji timeout bezpośrednio,
      // więc używamy AbortController z timeoutem
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 sekund timeout
      
      response = await fetch(kmlEndpoint, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'TransportSystem/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
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
    
    let kmlText;
    try {
      kmlText = await response.text();
      console.log(`Pobrano plik KML, długość: ${kmlText.length} znaków`);
      
      if (kmlText.length < 100) {
        throw new Error('Otrzymano zbyt krótki plik KML - prawdopodobnie błąd dostępu lub nieprawidłowe ID mapy');
      }
    } catch (textError) {
      console.error('Błąd odczytu KML:', textError);
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd odczytu danych KML: ' + textError.message 
      }, { status: 500 });
    }
    
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
        // Warunek wyszukiwania - używaj współrzędnych z pewną tolerancją
        const existingPackaging = await db('packagings')
          .whereRaw(`
            ROUND(latitude::numeric, 5) = ROUND(${packaging.latitude}::numeric, 5) AND 
            ROUND(longitude::numeric, 5) = ROUND(${packaging.longitude}::numeric, 5)
          `)
          .first();
        
        if (existingPackaging) {
          // Zaktualizuj istniejące opakowanie, ale tylko jeśli status jest 'pending'
          if (existingPackaging.status === 'pending') {
            await db('packagings')
              .where('id', existingPackaging.id)
              .update({
                client_name: packaging.client_name,
                description: packaging.description,
                city: packaging.city,
                postal_code: packaging.postal_code,
                street: packaging.street,
                external_id: packaging.external_id,
                updated_at: new Date().toISOString()
              });
              
            importResults.updated++;
          }
        } else {
          // Dodaj nowe opakowanie
          await db('packagings').insert({
            client_name: packaging.client_name,
            description: packaging.description,
            city: packaging.city,
            postal_code: packaging.postal_code || '',
            street: packaging.street || '',
            latitude: packaging.latitude,
            longitude: packaging.longitude,
            external_id: packaging.external_id,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          importResults.added++;
        }
      } catch (error) {
        console.error('Błąd podczas importu opakowania:', error);
        importResults.errors++;
      }
    }
    
    // Aktualizuj datę ostatniej synchronizacji
    try {
      const appSettingsExists = await db.schema.hasTable('app_settings');
      if (!appSettingsExists) {
        await db.schema.createTable('app_settings', table => {
          table.string('key').primary();
          table.text('value');
          table.timestamp('updated_at').defaultTo(db.fn.now());
        });
      }
      
      await db('app_settings')
        .insert({
          key: 'last_mymaps_sync',
          value: new Date().toISOString()
        })
        .onConflict('key')
        .merge();
    } catch (settingsError) {
      console.error('Błąd aktualizacji daty synchronizacji:', settingsError);
      // Nie przerywamy procesu z powodu tego błędu
    }
    
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
