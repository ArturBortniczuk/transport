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

const parseKML = async (kmlText) => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: true,
      allowBooleanAttributes: true
    });
    
    const parsed = parser.parse(kmlText);
    const packagings = [];

    // Funkcja do rekurencyjnego przeszukiwania folderów
    const extractPlacemarks = (folder) => {
      if (folder.Placemark) {
        const placemarks = Array.isArray(folder.Placemark) ? folder.Placemark : [folder.Placemark];
        return placemarks;
      }
      
      // Jeśli folder zawiera podfoldery, przeszukaj je rekurencyjnie
      if (folder.Folder) {
        const subFolders = Array.isArray(folder.Folder) ? folder.Folder : [folder.Folder];
        return subFolders.flatMap(extractPlacemarks);
      }
      
      return [];
    };

    // Ekstrakcja wszystkich placemarks z całego dokumentu
    const allPlacemarks = extractPlacemarks(parsed.kml.Document);
    
    console.log(`Znaleziono ${allPlacemarks.length} placemarks`);

    for (let i = 0; i < allPlacemarks.length; i++) {
      const placemark = allPlacemarks[i];
      
      const name = placemark.name || 'Bez nazwy';
      const description = placemark.description || '';
      
      // Parsowanie współrzędnych
      let lng = null, lat = null;
      if (placemark.Point?.coordinates) {
        const [longitude, latitude] = placemark.Point.coordinates.split(',').map(parseFloat);
        lng = longitude;
        lat = latitude;
      }

      // Próba wyodrębnienia adresu z opisu
      const cleanDescription = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      let city = 'Nieznane';
      let postalCode = '';
      let street = '';
      let clientName = name;

      // Wzorce do ekstrakcji danych
      const cityMatch = cleanDescription.match(/(\d{2}-\d{3})\s+([^,\n]+)/);
      if (cityMatch) {
        postalCode = cityMatch[1];
        city = cityMatch[2].trim();
      }

      // Próba wyodrębnienia nazwy klienta
      const clientMatch = cleanDescription.match(/Klient:\s*([^,\n]+)/i);
      if (clientMatch) {
        clientName = clientMatch[1].trim();
      }

      // Jeśli nie mamy współrzędnych, próbujemy geokodować
      if ((!lat || !lng) && city !== 'Nieznane') {
        try {
          const coords = await getGoogleCoordinates(city, postalCode, street);
          lat = coords.lat;
          lng = coords.lng;
        } catch (error) {
          console.error(`Błąd geokodowania dla ${name}:`, error);
        }
      }

      // Dodaj tylko jeśli mamy współrzędne
      if (lat && lng) {
        packagings.push({
          external_id: `placemark_${i}_${Date.now()}`,
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

    console.log(`Przygotowano ${packagings.length} opakowań do importu`);
    return packagings;
  } catch (error) {
    console.error('Błąd podczas parsowania KML:', error);
    throw error;
  }
};

export async function POST(request) {
  try {
    const cronAuth = request.headers.get('X-Cron-Auth');
    let isAuthenticated = false;

    if (cronAuth && cronAuth === process.env.CRON_SECRET) {
      isAuthenticated = true;
    } else {
      const authToken = request.cookies.get('authToken')?.value;
      const userId = await validateSession(authToken);
      
      if (userId) {
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
    
    const kmlEndpoint = `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=1`;
    console.log(`Pobieranie KML z: ${kmlEndpoint}`);
    
    const response = await fetch(kmlEndpoint);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Błąd pobierania KML: ${response.status}`, errorText);
      throw new Error(`Błąd pobierania KML: ${response.status} ${errorText}`);
    }
    
    const kmlText = await response.text();
    console.log('Długość pobranego KML:', kmlText.length);
    
    const packagings = await parseKML(kmlText);
    
    if (packagings.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Nie znaleziono opakowań do importu',
        imported: 0
      });
    }
    
    const importResults = {
      added: 0,
      updated: 0,
      errors: 0
    };
    
    for (const packaging of packagings) {
      try {
        const existingPackaging = await db('packagings')
          .where('external_id', packaging.external_id)
          .first();
        
        if (existingPackaging) {
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
          await db('packagings').insert(packaging);
          importResults.added++;
        }
      } catch (error) {
        console.error('Błąd podczas importu opakowania:', error);
        importResults.errors++;
      }
    }
    
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
