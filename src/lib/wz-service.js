// src/lib/wz-service.js
import db from '../database/db.js';
import Papa from 'papaparse';

// Baza współrzędnych najczęstszych miast i lokalizacji w Polsce dla natychmiastowego geokodowania
export const KNOWN_CITIES = {
  'białystok': { lat: 53.1325, lng: 23.1688 },
  'bialystok': { lat: 53.1325, lng: 23.1688 },
  'zielonka': { lat: 52.3025, lng: 21.1620 },
  'warszawa': { lat: 52.2297, lng: 21.0122 },
  'zambrów': { lat: 52.9856, lng: 22.2428 },
  'zambrow': { lat: 52.9856, lng: 22.2428 },
  'ciechanów': { lat: 52.8794, lng: 20.6133 },
  'ciechanow': { lat: 52.8794, lng: 20.6133 },
  'brańszczyk': { lat: 52.6289, lng: 21.5894 },
  'branszczyk': { lat: 52.6289, lng: 21.5894 },
  'otwock': { lat: 52.1060, lng: 21.2625 },
  'lublin': { lat: 51.2465, lng: 22.5684 },
  'poznań': { lat: 52.4064, lng: 16.9252 },
  'poznan': { lat: 52.4064, lng: 16.9252 },
  'wrocław': { lat: 51.1079, lng: 17.0385 },
  'wroclaw': { lat: 51.1079, lng: 17.0385 },
  'kraków': { lat: 50.0647, lng: 19.9450 },
  'krakow': { lat: 50.0647, lng: 19.9450 },
  'katowice': { lat: 50.2649, lng: 19.0238 },
  'gdańsk': { lat: 54.3520, lng: 18.6466 },
  'gdansk': { lat: 54.3520, lng: 18.6466 },
  'łapy': { lat: 52.9917, lng: 22.8842 },
  'lapy': { lat: 52.9917, lng: 22.8842 },
  'sokoły': { lat: 52.9908, lng: 22.7003 },
  'sokoly': { lat: 52.9908, lng: 22.7003 },
  'piotrków trybunalski': { lat: 51.4052, lng: 19.7030 },
  'piotrkow trybunalski': { lat: 51.4052, lng: 19.7030 },
  'piotrków': { lat: 51.4052, lng: 19.7030 },
  'łomża': { lat: 53.1781, lng: 22.0594 },
  'lomza': { lat: 53.1781, lng: 22.0594 },
  'ostrołęka': { lat: 53.0850, lng: 21.5724 },
  'ostroleka': { lat: 53.0850, lng: 21.5724 },
  'suwałki': { lat: 54.0991, lng: 22.9288 },
  'suwalki': { lat: 54.0991, lng: 22.9288 },
  'olsztyn': { lat: 53.7784, lng: 20.4801 },
  'siedlce': { lat: 52.1677, lng: 22.2901 },
  'radzymin': { lat: 52.4172, lng: 21.1822 },
  'wołomin': { lat: 52.3486, lng: 21.2425 },
  'wolomin': { lat: 52.3486, lng: 21.2425 },
  'mława': { lat: 53.1136, lng: 20.3800 },
  'mlawa': { lat: 53.1136, lng: 20.3800 },
  'przasnysz': { lat: 53.0211, lng: 20.8808 },
  'wyszków': { lat: 52.5931, lng: 21.4589 },
  'wyszkow': { lat: 52.5931, lng: 21.4589 },
  'augustów': { lat: 53.8433, lng: 22.9794 },
  'augustow': { lat: 53.8433, lng: 22.9794 },
  'bielsk podlaski': { lat: 52.7661, lng: 23.1953 },
  'hajnowka': { lat: 52.7433, lng: 23.5814 },
  'hajnówka': { lat: 52.7433, lng: 23.5814 },
  'grajewo': { lat: 53.6464, lng: 22.4556 },
  'szczuczyn': { lat: 53.5703, lng: 22.2858 },
  'radom': { lat: 51.4027, lng: 21.1471 },
  'kielce': { lat: 50.8661, lng: 20.6286 },
  'toruń': { lat: 53.0138, lng: 18.5984 },
  'torun': { lat: 53.0138, lng: 18.5984 },
  'bydgoszcz': { lat: 53.1235, lng: 18.0084 },
  'szczecin': { lat: 53.4285, lng: 14.5528 }
};

/**
 * Dekodowanie Windows-1250 (CP-1250) lub UTF-8 z bufora
 */
export function decodeBuffer(buffer) {
  try {
    const decoder = new TextDecoder('windows-1250');
    return decoder.decode(buffer);
  } catch (e) {
    return buffer.toString('utf-8');
  }
}

/**
 * Konwersja liczby w formacie polskim (np. "3 243,51" lub "0,3") na float
 */
export function parsePolishFloat(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val)
    .replace(/\s/g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Konwersja daty DD.MM.YYYY do YYYY-MM-DD
 */
export function parsePolishDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

/**
 * Inteligentne parsowanie adresu z pól WZ: ADRES_DOSTAWY, UWAGI, NAZWA_MIEJSCA_DOSTAWY
 */
export function parseWzAddress(row) {
  const adres = (row.ADRES_DOSTAWY || '').trim();
  const uwagi = (row.UWAGI || '').trim();
  const miejsce = (row.NAZWA_MIEJSCA_DOSTAWY || '').trim();

  let postalCode = '';
  const postalMatch = (uwagi + ' ' + adres).match(/\b(\d{2}-\d{3})\b/);
  if (postalMatch) {
    postalCode = postalMatch[1];
  }

  let phone = '';
  const phoneMatch =
    uwagi.match(/(?:tel\.?|telefon:?|kontakt:?)\s*([0-9\s-]{9,15})/i) ||
    uwagi.match(/\b([5-8]\d{2}[\s-]?\d{3}[\s-]?\d{3})\b/);
  if (phoneMatch) {
    phone = phoneMatch[1].replace(/[\s-]/g, '');
  }

  let city = '';
  let street = '';

  if (adres) {
    const parts = adres.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      city = parts[0];
      street = parts.slice(1).join(', ');
    } else if (parts.length === 1) {
      city = parts[0];
    }
  }

  // Jeśli brak miasta w adresie, szukamy w uwagach po kodzie pocztowym np. "03-876 Warszawa"
  if (!city && uwagi) {
    const cityAfterPostal = uwagi.match(/\b\d{2}-\d{3}\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż]+)/);
    if (cityAfterPostal) {
      city = cityAfterPostal[1].trim();
    }
  }

  // Próba znalezienia współrzędnych z wbudowanej bazy miast
  let lat = null;
  let lng = null;

  if (city) {
    const normCity = city.toLowerCase().trim();
    if (KNOWN_CITIES[normCity]) {
      lat = KNOWN_CITIES[normCity].lat;
      lng = KNOWN_CITIES[normCity].lng;
    } else {
      // Szukamy prefiksowo (np. "Warszawa" w "Warszawa Wesoła")
      for (const [key, coords] of Object.entries(KNOWN_CITIES)) {
        if (normCity.includes(key) || key.includes(normCity)) {
          lat = coords.lat;
          lng = coords.lng;
          break;
        }
      }
    }
  }

  return {
    city: city || null,
    street: street || null,
    postalCode: postalCode || null,
    phone: phone || null,
    latitude: lat,
    longitude: lng
  };
}

/**
 * Parsowanie tekstu CSV do struktury obiektów
 */
export function parseWzCsv(csvContent) {
  const parsed = Papa.parse(csvContent, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true
  });

  return parsed.data;
}

/**
 * Wsadowy import i upsert danych WZ do bazy danych PostgreSQL (Supabase)
 */
export async function importWzRows(rows) {
  if (!rows || rows.length === 0) {
    return { success: false, message: 'Brak danych do importu' };
  }

  // 1. Grupowanie pozycji według dokumentu WZ
  const docMap = new Map();
  const itemsList = [];

  for (const r of rows) {
    const nrWz = (r.NR_WZ || '').trim();
    if (!nrWz) continue;

    if (!docMap.has(nrWz)) {
      const addrInfo = parseWzAddress(r);
      const dataWyst = parsePolishDate(r.DATA_WYSTAWIENIA);

      docMap.set(nrWz, {
        nr_wz: nrWz,
        data_wystawienia: dataWyst,
        id_magazynu: r.ID_MAGAZYNU ? String(r.ID_MAGAZYNU).trim() : null,
        symbol_magazynu: (r.SYMBOL_MAGAZYNU || '').trim(),
        nazwa_magazynu: (r.NAZWA_MAGAZYNU || '').trim(),
        kod_kontrahenta: (r.KOD_KONTRAHENTA || '').trim(),
        nazwa_kontrahenta: (r.NAZWA_KONTRAHENTA || '').trim(),
        nazwa_miejsca_dostawy: (r.NAZWA_MIEJSCA_DOSTAWY || '').trim(),
        adres_dostawy: (r.ADRES_DOSTAWY || '').trim(),
        id_zamowienia: r.ID_ZAMOWIENIA ? String(r.ID_ZAMOWIENIA).trim() : null,
        uwagi: (r.UWAGI || '').trim(),
        uwagi_ukoncowe: (r.UWAGI_UKONCOWE || '').trim(),
        dok_netto: parsePolishFloat(r.DOK_NETTO),
        dok_brutto: parsePolishFloat(r.DOK_BRUTTO),
        extracted_city: addrInfo.city,
        extracted_street: addrInfo.street,
        extracted_postal_code: addrInfo.postalCode,
        extracted_phone: addrInfo.phone,
        latitude: addrInfo.latitude,
        longitude: addrInfo.longitude,
        pozycje_count: 0
      });
    }

    const doc = docMap.get(nrWz);
    doc.pozycje_count += 1;

    // Pozycja towarowa
    if (r.ID_POZYCJI || r.KOD_TOWARU || r.NAZWA_TOWARU) {
      const idPozycji = r.ID_POZYCJI ? String(r.ID_POZYCJI).trim() : `${nrWz}_${doc.pozycje_count}`;
      itemsList.push({
        id_pozycji: idPozycji,
        nr_wz: nrWz,
        lp: r.LP ? String(r.LP).trim() : String(doc.pozycje_count),
        kod_towaru: (r.KOD_TOWARU || '').trim(),
        nazwa_towaru: (r.NAZWA_TOWARU || '').trim(),
        jednostka_miary: (r.JEDNOSTKA_MIARY || '').trim(),
        ilosc: parsePolishFloat(r.ILOSC),
        cena_jed_netto: parsePolishFloat(r.CENA_JED_NETTO),
        wartosc_netto: parsePolishFloat(r.WARTOSC_NETTO),
        stawka_vat: (r.STAWKA_VAT || '').trim(),
        wartosc_brutto: parsePolishFloat(r.WARTOSC_BRUTTO)
      });
    }
  }

  const documents = Array.from(docMap.values());

  // 2. Wstawianie dokumentów (batch upsert po nr_wz)
  const batchSize = 100;
  let insertedDocsCount = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const chunk = documents.slice(i, i + batchSize);
    
    // Knex upsert (onConflict nr_wz)
    await db('wz_documents')
      .insert(chunk)
      .onConflict('nr_wz')
      .merge({
        data_wystawienia: db.raw('EXCLUDED.data_wystawienia'),
        id_magazynu: db.raw('EXCLUDED.id_magazynu'),
        symbol_magazynu: db.raw('EXCLUDED.symbol_magazynu'),
        nazwa_magazynu: db.raw('EXCLUDED.nazwa_magazynu'),
        kod_kontrahenta: db.raw('EXCLUDED.kod_kontrahenta'),
        nazwa_kontrahenta: db.raw('EXCLUDED.nazwa_kontrahenta'),
        nazwa_miejsca_dostawy: db.raw('EXCLUDED.nazwa_miejsca_dostawy'),
        adres_dostawy: db.raw('EXCLUDED.adres_dostawy'),
        id_zamowienia: db.raw('EXCLUDED.id_zamowienia'),
        uwagi: db.raw('EXCLUDED.uwagi'),
        uwagi_ukoncowe: db.raw('EXCLUDED.uwagi_ukoncowe'),
        dok_netto: db.raw('EXCLUDED.dok_netto'),
        dok_brutto: db.raw('EXCLUDED.dok_brutto'),
        pozycje_count: db.raw('EXCLUDED.pozycje_count'),
        extracted_city: db.raw('COALESCE(EXCLUDED.extracted_city, wz_documents.extracted_city)'),
        extracted_street: db.raw('COALESCE(EXCLUDED.extracted_street, wz_documents.extracted_street)'),
        extracted_postal_code: db.raw('COALESCE(EXCLUDED.extracted_postal_code, wz_documents.extracted_postal_code)'),
        extracted_phone: db.raw('COALESCE(EXCLUDED.extracted_phone, wz_documents.extracted_phone)'),
        latitude: db.raw('COALESCE(wz_documents.latitude, EXCLUDED.latitude)'),
        longitude: db.raw('COALESCE(wz_documents.longitude, EXCLUDED.longitude)'),
        updated_at: db.fn.now()
      });

    insertedDocsCount += chunk.length;
  }

  // 3. Wstawianie pozycji (batch upsert po id_pozycji)
  for (let i = 0; i < itemsList.length; i += batchSize) {
    const chunk = itemsList.slice(i, i + batchSize);

    await db('wz_items')
      .insert(chunk)
      .onConflict('id_pozycji')
      .merge({
        kod_towaru: db.raw('EXCLUDED.kod_towaru'),
        nazwa_towaru: db.raw('EXCLUDED.nazwa_towaru'),
        jednostka_miary: db.raw('EXCLUDED.jednostka_miary'),
        ilosc: db.raw('EXCLUDED.ilosc'),
        cena_jed_netto: db.raw('EXCLUDED.cena_jed_netto'),
        wartosc_netto: db.raw('EXCLUDED.wartosc_netto'),
        stawka_vat: db.raw('EXCLUDED.stawka_vat'),
        wartosc_brutto: db.raw('EXCLUDED.wartosc_brutto')
      });
  }

  // Zbieranie unikalnych magazynów i dat
  const warehouses = [...new Set(documents.map(d => `${d.symbol_magazynu} - ${d.nazwa_magazynu}`).filter(Boolean))];
  const dates = [...new Set(documents.map(d => d.data_wystawienia).filter(Boolean))].sort();

  return {
    success: true,
    totalDocuments: documents.length,
    totalItems: itemsList.length,
    warehouses,
    dateRange: {
      from: dates[0] || null,
      to: dates[dates.length - 1] || null
    }
  };
}
