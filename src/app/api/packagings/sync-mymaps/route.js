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
    
    // Zbieramy wszystkie placemarks (pineski) - tylko z folderu "Bębny"
    if (parsed?.kml?.Document?.Folder) {
      const folders = Array.isArray(parsed.kml.Document.Folder) ? 
        parsed.kml.Document.Folder : [parsed.kml.Document.Folder];
      
      console.log(`Znaleziono ${folders.length} folderów w dokumencie KML`);
      
      for (const folder of folders) {
        // Przetwarzamy tylko folder "Bębny"
        if (folder.name === "Bębny" && folder.Placemark) {
          const folderPlacemarks = Array.isArray(folder.Placemark) ? 
            folder.Placemark : [folder.Placemark];
          console.log(`Znaleziono ${folderPlacemarks.length} placemarks w folderze "Bębny"`);
          allPlacemarks = [...allPlacemarks, ...folderPlacemarks];
        } else {
          console.log(`Pomijam folder "${folder.name || 'bez nazwy'}" - interesuje nas tylko folder "Bębny"`);
        }
      }
    }
    
    console.log(`Łącznie znaleziono ${allPlacemarks.length} placemarks do przetworzenia`);
    
    // Przetwarzanie każdej pineski
    for (let i = 0; i < allPlacemarks.length; i++) {
      try {
        const placemark = allPlacemarks[i];
        
        // Pobierz nazwę - zazwyczaj zawiera nazwę firmy i czasem kod pocztowy
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
        
        // Analizujemy dane z opisu - wyodrębniamy sekcje
        let clientName = '';
        let city = '';
        let postalCode = '';
        let street = '';
        let notes = '';
        let contact = '';
        let packagingInfo = '';
        
        // Poprawa ekstrakcji nazwy klienta
        // Najpierw spróbujmy wyodrębnić nazwę klienta z nazwy pineski
        if (name && name.includes(' ')) {
          // Sprawdź, czy nazwa zaczyna się od kodu pocztowego
          const postalCodeMatch = name.match(/^\d{2}-\d{3}\s+/);
          
          if (postalCodeMatch) {
            // Format: "KOD_POCZTOWY NAZWA_KLIENTA"
            clientName = name.substring(postalCodeMatch[0].length).trim();
            postalCode = postalCodeMatch[0].trim();
          } else {
            // Sprawdź czy nazwa zawiera kod pocztowy w środku
            const middlePostalMatch = name.match(/\s+\d{2}-\d{3}\s+/);
            if (middlePostalMatch) {
              // Format: "NAZWA_KLIENTA KOD_POCZTOWY MIASTO"
              const postalIndex = name.indexOf(middlePostalMatch[0]);
              clientName = name.substring(0, postalIndex).trim();
              postalCode = middlePostalMatch[0].trim();
              city = name.substring(postalIndex + middlePostalMatch[0].length).trim();
            } else {
              // Format: "NAZWA_KLIENTA Miasto" lub inny format bez kodu pocztowego
              // Próbujemy wyodrębnić nazwę klienta z pierwszej części
              const parts = name.split(' ');
              // Zazwyczaj nazwa klienta to wszystkie słowa z wielkiej litery przed miastem
              // Szukamy pierwszego słowa, które nie jest napisane wielkimi literami lub zaczyna się małą literą
              let clientNameEndIndex = parts.length;
              for (let i = 0; i < parts.length; i++) {
                if (parts[i].length > 0 && parts[i][0] === parts[i][0].toLowerCase()) {
                  clientNameEndIndex = i;
                  break;
                }
              }
              
              if (clientNameEndIndex > 0) {
                clientName = parts.slice(0, clientNameEndIndex).join(' ');
                city = parts.slice(clientNameEndIndex).join(' ');
              } else {
                clientName = name;
              }
            }
          }
        } else {
          clientName = name;
        }
        
        // Szczegółowa analiza opisu
        const lines = description.split('\n');
        
        // Inicjujemy sekcje
        let currentSection = null;
        const sections = {
          'Uwagi': [],
          'Adres': [],
          'Kontakt': [],
          'Opakowania': []
        };
        
        // Przetwarzamy linie opisu i segregujemy je według sekcji
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          // Wykrywanie sekcji
          if (trimmedLine.startsWith('Uwagi:')) {
            currentSection = 'Uwagi';
            const content = trimmedLine.replace('Uwagi:', '').trim();
            if (content) sections[currentSection].push(content);
          } else if (trimmedLine.startsWith('Adres:')) {
            currentSection = 'Adres';
            const content = trimmedLine.replace('Adres:', '').trim();
            if (content) sections[currentSection].push(content);
          } else if (trimmedLine.startsWith('Kontakt:')) {
            currentSection = 'Kontakt';
            const content = trimmedLine.replace('Kontakt:', '').trim();
            if (content) sections[currentSection].push(content);
          } else if (trimmedLine.startsWith('Opakowania:')) {
            currentSection = 'Opakowania';
            const content = trimmedLine.replace('Opakowania:', '').trim();
            if (content) sections[currentSection].push(content);
          } else if (currentSection) {
            // Dopisujemy linię do aktualnej sekcji
            sections[currentSection].push(trimmedLine);
          } else {
            // Jeśli nie mamy jeszcze żadnej sekcji, domyślnie traktujemy jako uwagi
            sections['Uwagi'].push(trimmedLine);
          }
        }
        
        // Dodatkowa logika: Jeśli w adresie jest pierwszy wiersz z nazwą klienta, usuńmy ją z adresu
        if (sections['Adres'] && sections['Adres'].length > 0) {
          // Sprawdź, czy pierwszy wiersz adresu zawiera nazwę klienta
          const firstAdressLine = sections['Adres'][0];
          if (firstAdressLine && !firstAdressLine.match(/\d{2}-\d{3}/) && 
              firstAdressLine.toUpperCase() === firstAdressLine) {
            // Prawdopodobnie to nazwa klienta, używamy jej jeśli wcześniej nie znaleźliśmy
            if (!clientName) {
              clientName = firstAdressLine;
            }
            // Usuwamy tę linię z adresu, aby nie powodowała zamieszania
            sections['Adres'].shift();
          }
        }
        
        // Przetwarzamy adres
        if (sections['Adres'] && sections['Adres'].length > 0) {
          // Sprawdzamy czy w adresie jest kod pocztowy i miasto
          let hasFoundPostalAndCity = false;
          
          for (let i = 0; i < sections['Adres'].length; i++) {
            const addressLine = sections['Adres'][i];
            
            // Próbujemy znaleźć kod pocztowy
            const postalCodeMatch = addressLine.match(/\d{2}-\d{3}/);
            if (postalCodeMatch) {
              postalCode = postalCodeMatch[0];
              
              // Wyodrębnij miasto na podstawie kodu pocztowego
              const parts = addressLine.split(postalCode);
              if (parts.length > 1 && parts[1].trim()) {
                city = parts[1].trim();
              } else if (parts.length > 0 && parts[0].trim()) {
                city = parts[0].trim();
              }
              
              hasFoundPostalAndCity = true;
              
              // Jeśli to nie jest ostatnia linia adresu, następne linie to prawdopodobnie ulica
              if (i < sections['Adres'].length - 1) {
                street = sections['Adres'].slice(i + 1).join(', ');
              }
              
              break;
            }
            
            // Jeśli nie znaleźliśmy kodu pocztowego, a to pierwsza linia, to może to być ulica
            if (i === 0 && !postalCodeMatch) {
              street = addressLine;
            }
          }
          
          // Jeśli nie znaleźliśmy kodu pocztowego w adresie, sprawdźmy nazwę pineski
          if (!hasFoundPostalAndCity && !postalCode) {
            const postalCodeMatch = name.match(/\d{2}-\d{3}/);
            if (postalCodeMatch) {
              postalCode = postalCodeMatch[0];
              
              // Próbujemy znaleźć miasto w nazwie
              const parts = name.split(postalCode);
              if (parts.length > 1 && parts[1].trim()) {
                city = parts[1].trim();
              }
            }
          }
        }
        
        // Jeśli wciąż nie mamy nazwy klienta, spróbujmy wyciągnąć ją z pierwszej linii opakowania
        if (!clientName && sections['Opakowania'] && sections['Opakowania'].length > 0) {
          // Czasami nazwa klienta jest ukryta w informacjach o opakowaniach
          const packagingLine = sections['Opakowania'][0];
          // Jeśli linia nie zawiera cyfr i specjalnych znaków to może to być nazwa klienta
          if (!/\d/.test(packagingLine) && !/[\/\\]/.test(packagingLine)) {
            clientName = packagingLine;
          }
        }
        
        // Przygotowujemy dane kontaktowe
        if (sections['Kontakt'] && sections['Kontakt'].length > 0) {
          contact = sections['Kontakt'].join('\n');
        }
        
        // Przygotowujemy informacje o opakowaniach
        if (sections['Opakowania'] && sections['Opakowania'].length > 0) {
          packagingInfo = sections['Opakowania'].join('\n');
        }
        
        // Przygotowujemy uwagi
        if (sections['Uwagi'] && sections['Uwagi'].length > 0) {
          notes = sections['Uwagi'].join('\n');
        }
        
        // Stwórz nowy opis z poprawnie wydzielonymi sekcjami
        const structuredDescription = [
          notes ? `Uwagi:\n${notes}` : '',
          contact ? `Kontakt:\n${contact}` : '',
          packagingInfo ? `Opakowania:\n${packagingInfo}` : ''
        ].filter(Boolean).join('\n\n');
        
        // Jeśli miasto wciąż nie jest znane, ustaw wartość domyślną
        if (!city) {
          city = 'Nieznane';
        }
        
        packagings.push({
          external_id: placemarkId,
          client_name: clientName,
          description: structuredDescription,
          city: city,
          postal_code: postalCode || '',
          street: street || '',
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
    
    // NOWY KOD - usuwamy wszystkie oczekujące opakowania przed importem
    console.log('Czyszczenie istniejących oczekujących opakowań przed importem...');
    try {
      // Usuwamy tylko opakowania ze statusem 'pending', zachowujemy zaplanowane i zrealizowane
      const deleted = await db('packagings')
        .where('status', 'pending')
        .delete();
      
      console.log(`Usunięto ${deleted} oczekujących opakowań`);
    } catch (deleteError) {
      console.error('Błąd podczas czyszczenia bazy danych:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd podczas czyszczenia bazy danych: ' + deleteError.message 
      }, { status: 500 });
    }
    
    // Zaktualizuj istniejące i dodaj nowe opakowania
    const importResults = {
      added: 0,
      updated: 0,
      errors: 0
    };
    
    // Przetwarzanie w mniejszych partiach, aby uniknąć timeoutu
    const BATCH_SIZE = 10; // Przetwarzaj po 10 elementów na raz
    
    for (let i = 0; i < packagings.length; i += BATCH_SIZE) {
      const batch = packagings.slice(i, i + BATCH_SIZE);
      
      console.log(`Przetwarzanie partii ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(packagings.length / BATCH_SIZE)} (${batch.length} elementów)`);
      
      // Przetwarzaj opakowania w batchu
      for (const packaging of batch) {
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
        
        // Dodajmy małe opóźnienie między zapytaniami, aby nie przeciążać bazy danych
        await new Promise(resolve => setTimeout(resolve, 50));
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
