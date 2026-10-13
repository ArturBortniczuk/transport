// src/lib/distance-helper.js
import db from '../database/db';

export const ERP_RYNEK_MAP = {
  'BID': 'Podlaski',
  'BIH': 'Podlaski',
  'LAH': 'Podlaski',
  'BUDL': 'Podlaski',
  'SOS': 'Podlaski',
  'DII': 'Podlaski',
  'CTR': 'Podlaski',
  'WAH': 'Mazowiecki',
  'POZ': 'Wielkopolski',
  'KAT': 'Śląski',
  'LUB': 'Lubelski',
  'WRO': 'Dolnośląski',
  'GDA': 'Pomorski',
  'KRA': 'Małopolski'
};

export const VALID_RYNKI = [
  'Podlaski',
  'Mazowiecki',
  'Pomorski',
  'Lubelski',
  'Śląski',
  'Wielkopolski',
  'Małopolski',
  'Dolnośląski'
];

/**
 * Konwertuje kod rynku z ERP (np. BIH, WAH, BID) na standardowy rynek transportowy
 */
export function mapErpRynekToTransportMarket(rawRynek, warehouse = 'bialystok') {
  if (!rawRynek) {
    return warehouse === 'zielonka' ? 'Mazowiecki' : 'Podlaski';
  }
  const upper = String(rawRynek).toUpperCase().trim();
  if (ERP_RYNEK_MAP[upper]) {
    return ERP_RYNEK_MAP[upper];
  }
  const matched = VALID_RYNKI.find(r => r.toLowerCase() === rawRynek.toLowerCase());
  if (matched) {
    return matched;
  }
  return warehouse === 'zielonka' ? 'Mazowiecki' : 'Podlaski';
}

// Baza współrzędnych magazynów
export const WAREHOUSE_COORDS = {
  bialystok: { lat: 53.1325, lng: 23.1688, nazwa: 'Magazyn Białystok' },
  zielonka: { lat: 52.3125, lng: 21.1390, nazwa: 'Magazyn Zielonka' }
};

// Szybka baza koordynatów dla polskich miast
export const EXTENDED_KNOWN_CITIES = {
  'białystok': { lat: 53.1325, lng: 23.1688 },
  'bialystok': { lat: 53.1325, lng: 23.1688 },
  'zielonka': { lat: 52.3025, lng: 21.1620 },
  'warszawa': { lat: 52.2297, lng: 21.0122 },
  'kozienice': { lat: 51.5849, lng: 21.5506 },
  'biłgoraj': { lat: 50.5425, lng: 22.7209 },
  'bilgoraj': { lat: 50.5425, lng: 22.7209 },
  'piotrków trybunalski': { lat: 51.4052, lng: 19.7030 },
  'piotrkow trybunalski': { lat: 51.4052, lng: 19.7030 },
  'zambrów': { lat: 52.9856, lng: 22.2428 },
  'zambrow': { lat: 52.9856, lng: 22.2428 },
  'łapy': { lat: 52.9917, lng: 22.8842 },
  'lapy': { lat: 52.9917, lng: 22.8842 },
  'sokoły': { lat: 52.9908, lng: 22.7003 },
  'sokoly': { lat: 52.9908, lng: 22.7003 },
  'łomża': { lat: 53.1781, lng: 22.0594 },
  'lomza': { lat: 53.1781, lng: 22.0594 },
  'suwałki': { lat: 54.0991, lng: 22.9288 },
  'suwalki': { lat: 54.0991, lng: 22.9288 },
  'ostrołęka': { lat: 53.0850, lng: 21.5724 },
  'ostroleka': { lat: 53.0850, lng: 21.5724 },
  'lublin': { lat: 51.2465, lng: 22.5684 },
  'kraków': { lat: 50.0647, lng: 19.9450 },
  'krakow': { lat: 50.0647, lng: 19.9450 },
  'wrocław': { lat: 51.1079, lng: 17.0385 },
  'wroclaw': { lat: 51.1079, lng: 17.0385 },
  'poznań': { lat: 52.4064, lng: 16.9252 },
  'poznan': { lat: 52.4064, lng: 16.9252 },
  'gdańsk': { lat: 54.3520, lng: 18.6466 },
  'gdansk': { lat: 54.3520, lng: 18.6466 },
  'katowice': { lat: 50.2649, lng: 19.0238 },
  'radom': { lat: 51.4027, lng: 21.1471 },
  'kielce': { lat: 50.8661, lng: 20.6286 },
  'siedlce': { lat: 52.1677, lng: 22.2901 },
  'rzeszów': { lat: 50.0412, lng: 21.9991 },
  'rzeszow': { lat: 50.0412, lng: 21.9991 },
  'szczecin': { lat: 53.4285, lng: 14.5528 },
  'bielsk podlaski': { lat: 52.7661, lng: 23.1953 },
  'hajnówka': { lat: 52.7433, lng: 23.5814 },
  'hajnowka': { lat: 52.7433, lng: 23.5814 },
  'augustów': { lat: 53.8433, lng: 22.9794 },
  'augustow': { lat: 53.8433, lng: 22.9794 },
  'grajewo': { lat: 53.6464, lng: 22.4556 },
  'ciechanów': { lat: 52.8794, lng: 20.6133 },
  'ciechanow': { lat: 52.8794, lng: 20.6133 },
  'mława': { lat: 53.1136, lng: 20.3800 },
  'mlawa': { lat: 53.1136, lng: 20.3800 },
  'wyszków': { lat: 52.5931, lng: 21.4589 },
  'wyszkow': { lat: 52.5931, lng: 21.4589 },
  'radzymin': { lat: 52.4172, lng: 21.1822 },
  'wołomin': { lat: 52.3486, lng: 21.2425 },
  'wolomin': { lat: 52.3486, lng: 21.2425 },
  'otwock': { lat: 52.1060, lng: 21.2625 },
  'piaseczno': { lat: 52.0744, lng: 21.0289 },
  'pruszków': { lat: 52.1706, lng: 20.8049 },
  'pruszkow': { lat: 52.1706, lng: 20.8049 },
  'grodzisk mazowiecki': { lat: 52.1039, lng: 20.6300 },
  'nowy dwór mazowiecki': { lat: 52.4303, lng: 20.7175 },
  'nowy dwor mazowiecki': { lat: 52.4303, lng: 20.7175 },
  'toruń': { lat: 53.0138, lng: 18.5984 },
  'torun': { lat: 53.0138, lng: 18.5984 },
  'bydgoszcz': { lat: 53.1235, lng: 18.0084 },
  'częstochowa': { lat: 50.8118, lng: 19.1203 },
  'czestochowa': { lat: 50.8118, lng: 19.1203 },
  'sosnowiec': { lat: 50.2863, lng: 19.1041 },
  'gliwice': { lat: 50.2945, lng: 18.6714 },
  'zabrze': { lat: 50.3249, lng: 18.7857 },
  'bielsko-biała': { lat: 49.8224, lng: 19.0469 },
  'bielsko-biala': { lat: 49.8224, lng: 19.0469 },
  'opole': { lat: 50.6751, lng: 17.9213 },
  'gorzów wielkopolski': { lat: 52.7325, lng: 15.2369 },
  'gorzow wielkopolski': { lat: 52.7325, lng: 15.2369 },
  'zielona góra': { lat: 51.9356, lng: 15.5062 },
  'zielona gora': { lat: 51.9356, lng: 15.5062 }
};

/**
 * Oblicza odległość Haversine w km
 */
export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ustala współrzędne geograficzne dla adresu
 */
export async function resolveCoordinates({ city = '', postalCode = '', street = '', existingLat = null, existingLng = null }) {
  if (existingLat && existingLng) {
    return { lat: parseFloat(existingLat), lng: parseFloat(existingLng) };
  }

  const cleanCity = String(city || '').trim();
  const normCity = cleanCity.toLowerCase();

  // 1. Sprawdź szybką bazę miast
  if (normCity && EXTENDED_KNOWN_CITIES[normCity]) {
    return EXTENDED_KNOWN_CITIES[normCity];
  }

  // 2. Zapytanie do Nominatim OpenStreetMap (bezpłatne geokodowanie)
  try {
    const queryParts = [street, postalCode, cleanCity, 'Poland'].filter(Boolean).join(', ');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryParts)}&limit=1`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'TransportSystem/1.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        // Zapisz w pamięci podręcznej procesu
        if (normCity) EXTENDED_KNOWN_CITIES[normCity] = coords;
        return coords;
      }
    }
  } catch (err) {
    // Timeout lub błąd sieci
  }

  // 3. Fallback: spróbuj tylko z miastem lub kodem pocztowym
  if (cleanCity) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanCity + ', Poland')}&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'TransportSystem/1.0' } });
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          EXTENDED_KNOWN_CITIES[normCity] = coords;
          return coords;
        }
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Oblicza rzeczywistą odległość drogową z magazynu do miejsca docelowego
 */
export async function calculateWarehouseToDestinationDistance({
  sourceWarehouse = 'bialystok',
  city = '',
  postalCode = '',
  street = '',
  lat = null,
  lng = null
}) {
  const normWh = String(sourceWarehouse || 'bialystok').toLowerCase().includes('zielon') ? 'zielonka' : 'bialystok';
  const wh = WAREHOUSE_COORDS[normWh];

  let coords = null;
  if (lat && lng) {
    coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
  } else {
    coords = await resolveCoordinates({ city, postalCode, street });
  }

  if (!coords) {
    return {
      distanceKm: null,
      coords: null,
      source: 'unknown'
    };
  }

  // 1. Próba OSRM Routing
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${wh.lng},${wh.lat};${coords.lng},${coords.lat}?overview=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const osrmData = await res.json();
      if (osrmData?.routes?.[0]?.distance) {
        const distanceKm = Math.round(osrmData.routes[0].distance / 1000);
        return {
          distanceKm,
          coords,
          source: 'osrm'
        };
      }
    }
  } catch (err) {
    // OSRM niedostępne lub timeout, fallback
  }

  // 2. Haversine z mnożnikiem drogowym 1.25
  const straightDist = calculateHaversineKm(wh.lat, wh.lng, coords.lat, coords.lng);
  const roadDist = Math.max(1, Math.round(straightDist * 1.25));

  return {
    distanceKm: roadDist,
    coords,
    source: 'haversine_est'
  };
}
