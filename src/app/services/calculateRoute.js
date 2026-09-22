// src/app/services/calculateRoute.js

// Predefiniowane współrzędne magazynów oraz głównych miast w Polsce
export const KNOWN_COORDINATES = {
  // Magazyny
  'magazyn bialystok': { lat: 53.1325, lng: 23.1688 },
  'magazyn białystok': { lat: 53.1325, lng: 23.1688 },
  'bialystok': { lat: 53.1325, lng: 23.1688 },
  'białystok': { lat: 53.1325, lng: 23.1688 },
  'magazyn zielonka': { lat: 52.3125, lng: 21.1390 },
  'zielonka': { lat: 52.3125, lng: 21.1390 },

  // Główne miasta
  'warszawa': { lat: 52.2297, lng: 21.0122 },
  'warsaw': { lat: 52.2297, lng: 21.0122 },
  'gdansk': { lat: 54.3520, lng: 18.6466 },
  'gdańsk': { lat: 54.3520, lng: 18.6466 },
  'gdynia': { lat: 54.5189, lng: 18.5305 },
  'sopot': { lat: 54.4418, lng: 18.5600 },
  'grudziadz': { lat: 53.4841, lng: 18.7537 },
  'grudziądz': { lat: 53.4841, lng: 18.7537 },
  'torun': { lat: 53.0138, lng: 18.5984 },
  'toruń': { lat: 53.0138, lng: 18.5984 },
  'bydgoszcz': { lat: 53.1235, lng: 18.0084 },
  'wroclaw': { lat: 51.1079, lng: 17.0385 },
  'wrocław': { lat: 51.1079, lng: 17.0385 },
  'poznan': { lat: 52.4064, lng: 16.9252 },
  'poznań': { lat: 52.4064, lng: 16.9252 },
  'lodz': { lat: 51.7592, lng: 19.4560 },
  'łódź': { lat: 51.7592, lng: 19.4560 },
  'krakow': { lat: 50.0647, lng: 19.9450 },
  'kraków': { lat: 50.0647, lng: 19.9450 },
  'katowice': { lat: 50.2649, lng: 19.0238 },
  'lublin': { lat: 51.2465, lng: 22.5684 },
  'rzeszow': { lat: 50.0412, lng: 21.9991 },
  'rzeszów': { lat: 50.0412, lng: 21.9991 },
  'szczecin': { lat: 53.4285, lng: 14.5528 },
  'olsztyn': { lat: 53.7784, lng: 20.4801 },
  'kielce': { lat: 50.8661, lng: 20.6286 },
  'opole': { lat: 50.6751, lng: 17.9213 },
  'zielona gora': { lat: 51.9356, lng: 15.5062 },
  'zielona góra': { lat: 51.9356, lng: 15.5062 },
  'gorzow wielkopolski': { lat: 52.7325, lng: 15.2369 },
  'gorzów wielkopolski': { lat: 52.7325, lng: 15.2369 },
  'radom': { lat: 51.4027, lng: 21.1471 },
  'czestochowa': { lat: 50.8118, lng: 19.1203 },
  'częstochowa': { lat: 50.8118, lng: 19.1203 },
  'sosnowiec': { lat: 50.2863, lng: 19.1041 },
  'gliwice': { lat: 50.2945, lng: 18.6714 },
  'zabrze': { lat: 50.3249, lng: 18.7857 },
  'bielsko-biala': { lat: 49.8224, lng: 19.0469 },
  'bielsko-biała': { lat: 49.8224, lng: 19.0469 },
  'bytom': { lat: 50.3480, lng: 18.9328 },
  'rybnik': { lat: 50.0971, lng: 18.5418 },
  'ruda slaska': { lat: 50.2584, lng: 18.8572 },
  'ruda śląska': { lat: 50.2584, lng: 18.8572 },
  'tychy': { lat: 50.1264, lng: 18.9926 },
  'dabrowa gornicza': { lat: 50.3278, lng: 19.1912 },
  'dąbrowa górnicza': { lat: 50.3278, lng: 19.1912 },
  'elblag': { lat: 54.1522, lng: 19.4088 },
  'elbląg': { lat: 54.1522, lng: 19.4088 },
  'plock': { lat: 52.5463, lng: 19.7065 },
  'płock': { lat: 52.5463, lng: 19.7065 },
  'walbrzych': { lat: 50.7714, lng: 16.2843 },
  'wałbrzych': { lat: 50.7714, lng: 16.2843 },
  'wloclawek': { lat: 52.6484, lng: 19.0678 },
  'włocławek': { lat: 52.6484, lng: 19.0678 },
  'tarnow': { lat: 50.0121, lng: 20.9858 },
  'tarnów': { lat: 50.0121, lng: 20.9858 },
  'chorzow': { lat: 50.2975, lng: 18.9546 },
  'chorzów': { lat: 50.2975, lng: 18.9546 },
  'koszalin': { lat: 54.1944, lng: 16.1722 },
  'kalisz': { lat: 51.7673, lng: 18.0853 },
  'legnica': { lat: 51.2070, lng: 16.1553 },
  'slupsk': { lat: 54.4641, lng: 17.0285 },
  'słupsk': { lat: 54.4641, lng: 17.0285 },
  'nowy sacz': { lat: 49.6254, lng: 20.6974 },
  'nowy sącz': { lat: 49.6254, lng: 20.6974 },
  'jelenia gora': { lat: 50.9044, lng: 15.7194 },
  'jelenia góra': { lat: 50.9044, lng: 15.7194 },
  'siedlce': { lat: 52.1677, lng: 22.2901 },
  'konin': { lat: 52.2234, lng: 18.2512 },
  'piotrkow trybunalski': { lat: 51.4052, lng: 19.7030 },
  'piotrków trybunalski': { lat: 51.4052, lng: 19.7030 },
  'inowroclaw': { lat: 52.7989, lng: 18.2639 },
  'inowrocław': { lat: 52.7989, lng: 18.2639 },
  'ostrow wielkopolski': { lat: 51.6550, lng: 17.8068 },
  'ostrów wielkopolski': { lat: 51.6550, lng: 17.8068 },
  'suwalki': { lat: 54.0990, lng: 22.9279 },
  'suwałki': { lat: 54.0990, lng: 22.9279 },
  'ostroleka': { lat: 53.0857, lng: 21.5746 },
  'ostrołęka': { lat: 53.0857, lng: 21.5746 },
  'lomza': { lat: 53.1781, lng: 22.0594 },
  'łomża': { lat: 53.1781, lng: 22.0594 },
  'ostrow mazowiecka': { lat: 52.8028, lng: 21.8953 },
  'ostrów mazowiecka': { lat: 52.8028, lng: 21.8953 },
  'mlawa': { lat: 53.1132, lng: 20.3804 },
  'mława': { lat: 53.1132, lng: 20.3804 },
  'ciechanow': { lat: 52.8794, lng: 20.6133 },
  'ciechanów': { lat: 52.8794, lng: 20.6133 },
  'lapy': { lat: 52.9912, lng: 22.8845 },
  'łapy': { lat: 52.9912, lng: 22.8845 },
  'bielsk podlaski': { lat: 52.7663, lng: 23.1906 },
  'wysokie mazowieckie': { lat: 52.9189, lng: 22.5139 },
  'siemiatycze': { lat: 52.4272, lng: 22.8625 },
  'hajnowka': { lat: 52.7433, lng: 23.5812 },
  'hajnówka': { lat: 52.7433, lng: 23.5812 },
  'augustow': { lat: 53.8433, lng: 22.9796 },
  'augustów': { lat: 53.8433, lng: 22.9796 },
  'grajewo': { lat: 53.6467, lng: 22.4553 },
  'zambrow': { lat: 52.9856, lng: 22.2436 },
  'zambrów': { lat: 52.9856, lng: 22.2436 },
  'sokolka': { lat: 53.4072, lng: 23.5033 },
  'sokółka': { lat: 53.4072, lng: 23.5033 },
  'elk': { lat: 53.8249, lng: 22.3445 },
  'ełk': { lat: 53.8249, lng: 22.3445 }
};

// Pomocnicza funkcja normalizująca nazwę lokalizacji
export function normalizeCityName(city) {
  if (!city || typeof city !== 'string') return '';
  return city
    .replace(/^magazyn\s+/i, '')
    .trim()
    .toLowerCase();
}

// Funkcja wyznaczająca punkty trasy w odpowiedniej kolejności (współdzielona w całej aplikacji)
export function buildRoutePoints(mainTransport, connectedTransports = []) {
  if (!mainTransport) return [];

  const createPoint = (city, addr = null) => {
    const rawCity = typeof city === 'string' ? city : (city?.city || '');
    const cityName = rawCity.replace(/^magazyn\s+/i, '').trim();
    if (!cityName) return null;

    const postalCode = addr?.postalCode || (typeof city === 'object' ? city.postalCode : '') || '';
    const street = addr?.street || (typeof city === 'object' ? city.street : '') || '';

    return {
      city: cityName,
      postalCode,
      street,
      toString() {
        return this.city;
      }
    };
  };

  const parseJsonSafe = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { return null; }
  };

  const mainLocData = parseJsonSafe(mainTransport.location_data) || parseJsonSafe(mainTransport.producerAddress);
  const mainDelivData = parseJsonSafe(mainTransport.delivery_data) || parseJsonSafe(mainTransport.delivery);

  const mainStart = (mainLocData && mainLocData.city)
    ? createPoint(mainLocData.city, mainLocData)
    : (mainTransport.location && mainTransport.location !== 'Odbiory własne'
        ? createPoint(mainTransport.location.replace(/^magazyn\s+/i, '').trim())
        : createPoint(mainTransport.startCity || ''));

  const mainEnd = (mainDelivData && mainDelivData.city)
    ? createPoint(mainDelivData.city, mainDelivData)
    : createPoint(mainTransport.delivery?.city || mainTransport.endCity || '', mainTransport.delivery);

  const rawStops = [];

  if (mainStart && mainStart.city) {
    rawStops.push(mainStart);
  }

  if (connectedTransports && connectedTransports.length > 0) {
    const sorted = [...connectedTransports].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    let mainEndAdded = false;

    sorted.forEach(ct => {
      const ctLocData = parseJsonSafe(ct.location_data) || parseJsonSafe(ct.producerAddress) || parseJsonSafe(ct.startAddress);
      const ctDelivData = parseJsonSafe(ct.delivery_data) || parseJsonSafe(ct.delivery) || parseJsonSafe(ct.endAddress);

      let ctStartCity = ctLocData?.city || ct.startCity || '';
      let ctEndCity = ctDelivData?.city || ct.endCity || '';

      if ((!ctStartCity || !ctEndCity) && ct.route && ct.route.includes(' → ')) {
        const parts = ct.route.split(' → ');
        if (!ctStartCity) ctStartCity = parts[0]?.trim();
        if (!ctEndCity) ctEndCity = parts[1]?.trim();
      }

      const startPt = createPoint(ctStartCity, ctLocData || ct.startAddress || ct.producerAddress);
      const endPt = createPoint(ctEndCity, ctDelivData || ct.endAddress || ct.delivery);

      const type = ct.type || 'both';

      if (type === 'both') {
        // Dla pełnego zlecenia (np. kółko powrotne): najpierw musi nastąpić rozładunek głównego zlecenia
        if (!mainEndAdded && mainEnd && mainEnd.city) {
          rawStops.push(mainEnd);
          mainEndAdded = true;
        }
        if (startPt) rawStops.push(startPt);
        if (endPt) rawStops.push(endPt);
      } else if (type === 'loading') {
        // Jeśli załadunek kolejnego zlecenia odbywa się w mieście docelowym zlecenia głównego,
        // to najpierw rozładowujemy zlecenie główne
        if (!mainEndAdded && mainEnd && mainEnd.city && startPt && startPt.city.toLowerCase() === mainEnd.city.toLowerCase()) {
          rawStops.push(mainEnd);
          mainEndAdded = true;
        }
        if (startPt) rawStops.push(startPt);
      } else if (type === 'unloading') {
        // Jeśli rozładunek tego zlecenia jest w mieście startowym (powrót do bazy),
        // to zlecenie główne musiało być już rozładowane
        if (!mainEndAdded && mainEnd && mainEnd.city && endPt && mainStart && endPt.city.toLowerCase() === mainStart.city.toLowerCase()) {
          rawStops.push(mainEnd);
          mainEndAdded = true;
        }
        if (endPt) rawStops.push(endPt);
      }
    });

    if (!mainEndAdded && mainEnd && mainEnd.city) {
      rawStops.push(mainEnd);
      mainEndAdded = true;
    }
  } else if (mainEnd && mainEnd.city) {
    rawStops.push(mainEnd);
  }

  // Usuń bezpośrednio sąsiadujące identyczne punkty (np. Rozładunek w Wilcze, potem Załadunek w Wilcze)
  // ale ZACHOWAJ powroty do bazy (np. Zielonka -> Wilcze -> Zielonka)
  const cleaned = [];
  rawStops.forEach(p => {
    if (p && p.city && (cleaned.length === 0 || cleaned[cleaned.length - 1].city.toLowerCase() !== p.city.toLowerCase())) {
      cleaned.push(p);
    }
  });

  return cleaned;
}

// Obliczenie odległości po linii prostej (Haversine)
export function calculateStraightLineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Promień Ziemi w km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Pobranie współrzędnych dla danego punktu (nazwa miasta lub obiekt adresu)
export async function resolveCoordinates(point) {
  if (!point) return null;

  if (typeof point === 'object' && point.lat && (point.lng || point.lon)) {
    return {
      lat: Number(point.lat),
      lng: Number(point.lng || point.lon)
    };
  }

  const rawCity = typeof point === 'string' ? point : (point.city || '');
  const normKey = normalizeCityName(rawCity);

  if (KNOWN_COORDINATES[normKey]) {
    return KNOWN_COORDINATES[normKey];
  }

  // Wyszukanie w Nominatim OpenStreetMap
  try {
    const street = typeof point === 'object' ? (point.street || '') : '';
    const postalCode = typeof point === 'object' ? (point.postalCode || '') : '';
    const addressQuery = [street, postalCode, rawCity, 'Poland'].filter(Boolean).join(', ');

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TransportSystem/1.0'
        }
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        // Zapisz w słowniku podręcznym
        KNOWN_COORDINATES[normKey] = coords;
        return coords;
      }
    }
  } catch (err) {
    console.warn(`[resolveCoordinates] Błąd geokodowania dla ${rawCity}:`, err.message);
  }

  return null;
}

// Główna funkcja wyznaczania odległości drogowej punkt do punktu
export async function calculateRouteDistance(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return {
      success: false,
      totalDistanceKm: 0,
      legs: [],
      error: 'Wymagane co najmniej 2 punkty'
    };
  }

  // 1. Spróbuj wywołać wewnętrzny endpoint /api/distance jeśli jesteśmy w przeglądarce
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ points })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.totalDistanceKm > 0) {
          return data;
        }
      }
    } catch (err) {
      console.warn('[calculateRouteDistance] Błąd wywołania API:', err);
    }
  }

  // 2. Obliczenia bezpośrednie (fallback lokalny lub serwerowy)
  const coordsList = [];
  for (const p of points) {
    const coords = await resolveCoordinates(p);
    if (coords) {
      coordsList.push(coords);
    }
  }

  if (coordsList.length >= 2) {
    // 2A. Spróbuj wywołać OSRM driving API
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsList.map(c => `${c.lng},${c.lat}`).join(';')}?overview=false`;
      const res = await fetch(osrmUrl);
      if (res.ok) {
        const osrmData = await res.json();
        if (osrmData.routes && osrmData.routes[0]) {
          const totalDistanceKm = Math.round(osrmData.routes[0].distance / 1000);
          const legs = (osrmData.routes[0].legs || []).map(l => Math.round(l.distance / 1000));
          return {
            success: true,
            totalDistanceKm,
            legs,
            source: 'osrm'
          };
        }
      }
    } catch (osrmErr) {
      console.warn('[calculateRouteDistance] Błąd OSRM:', osrmErr.message);
    }

    // 2B. Fallback Haversine * 1.3
    const legs = [];
    let totalKm = 0;
    for (let i = 0; i < coordsList.length - 1; i++) {
      const p1 = coordsList[i];
      const p2 = coordsList[i + 1];
      const dist = Math.round(calculateStraightLineDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1.3);
      legs.push(dist);
      totalKm += dist;
    }

    return {
      success: true,
      totalDistanceKm: totalKm,
      legs,
      source: 'haversine_fallback'
    };
  }

  return {
    success: false,
    totalDistanceKm: 0,
    legs: [],
    error: 'Nie udało się ustalić współrzędnych punktów'
  };
}
