// src/app/api/distance/route.js
import { NextResponse } from 'next/server';
import { 
  KNOWN_COORDINATES, 
  normalizeCityName, 
  calculateStraightLineDistance 
} from '@/app/services/calculateRoute';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// Funkcja geokodowania punktu (z buforem w pamięci / Nominatim)
async function getPointCoordinates(point) {
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

  // Wyszukanie przez Nominatim
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
      if (data && data[0]) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        KNOWN_COORDINATES[normKey] = coords;
        return coords;
      }
    }
  } catch (e) {
    console.warn('[distance/route] Błąd geokodowania:', e.message);
  }

  return null;
}

// Funkcja wyliczająca dystans dla trasy wielopunktowej
async function computeRouteDistance(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return {
      success: false,
      totalDistanceKm: 0,
      legs: [],
      error: 'Wymagane co najmniej 2 punkty'
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 1. Próba z Google Directions API jeśli mamy klucz
  if (apiKey) {
    try {
      const originStr = typeof points[0] === 'string' ? `${points[0]}, Poland` : `${points[0].city || ''}, Poland`;
      const destStr = typeof points[points.length - 1] === 'string' 
        ? `${points[points.length - 1]}, Poland` 
        : `${points[points.length - 1].city || ''}, Poland`;

      const intermediate = points.slice(1, -1);
      const waypointsParam = intermediate.length > 0
        ? `&waypoints=${intermediate.map(p => encodeURIComponent(typeof p === 'string' ? `${p}, Poland` : `${p.city || ''}, Poland`)).join('|')}`
        : '';

      const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}${waypointsParam}&mode=driving&key=${apiKey}`;

      const res = await fetch(googleUrl);
      const data = await res.json();

      if (data.status === 'OK' && data.routes && data.routes[0]) {
        const legs = data.routes[0].legs.map(l => Math.round(l.distance.value / 1000));
        const totalDistanceKm = legs.reduce((a, b) => a + b, 0);

        return {
          success: true,
          totalDistanceKm,
          legs,
          source: 'google_directions',
          points
        };
      }
    } catch (gErr) {
      console.warn('[distance/route] Błąd Google Directions API, używam fallback:', gErr.message);
    }
  }

  // 2. Fallback: pobierz współrzędne i wyznacz trasę OSRM
  const coordsList = [];
  for (const p of points) {
    const coords = await getPointCoordinates(p);
    if (coords) {
      coordsList.push(coords);
    }
  }

  if (coordsList.length >= 2) {
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
            source: 'osrm',
            points
          };
        }
      }
    } catch (osrmErr) {
      console.warn('[distance/route] Błąd OSRM, używam Haversine:', osrmErr.message);
    }

    // 3. Fallback Haversine * 1.3
    const legs = [];
    let totalDistanceKm = 0;
    for (let i = 0; i < coordsList.length - 1; i++) {
      const p1 = coordsList[i];
      const p2 = coordsList[i + 1];
      const dist = Math.round(calculateStraightLineDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1.3);
      legs.push(dist);
      totalDistanceKm += dist;
    }

    return {
      success: true,
      totalDistanceKm,
      legs,
      source: 'haversine_fallback',
      points
    };
  }

  return {
    success: false,
    totalDistanceKm: 0,
    legs: [],
    error: 'Nie udało się ustalić współrzędnych punktów'
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const origins = searchParams.get('origins');
  const destinations = searchParams.get('destinations');
  const pointsParam = searchParams.get('points');

  // Jeśli zapytanie zawiera trasę wielopunktową (points=Gdańsk|Grudziądz|Warszawa)
  if (pointsParam) {
    const points = pointsParam.split(/[|,;]+/).map(p => p.trim()).filter(Boolean);
    const result = await computeRouteDistance(points);
    return NextResponse.json(result, { headers: corsHeaders });
  }
  
  // Tradycyjne zapytanie origins/destinations
  if (!origins || !destinations) {
    return NextResponse.json({ 
      error: 'Missing origins or destinations parameters' 
    }, { status: 400, headers: corsHeaders });
  }
  
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&mode=driving&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK') {
        return NextResponse.json(data, { headers: corsHeaders });
      }
    }

    // Fallback dla pojedynczego odcinka
    const result = await computeRouteDistance([origins, destinations]);
    if (result.success) {
      return NextResponse.json({
        status: 'OK',
        rows: [{
          elements: [{
            status: 'OK',
            distance: { value: result.totalDistanceKm * 1000, text: `${result.totalDistanceKm} km` },
            duration: { value: Math.round(result.totalDistanceKm * 60), text: `${Math.round(result.totalDistanceKm / 70)} h` }
          }]
        }],
        totalDistanceKm: result.totalDistanceKm
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ 
      error: 'Failed to fetch distance data' 
    }, { status: 500, headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching distance:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch distance data' 
    }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { points, origins, destinations } = body;

    if (Array.isArray(points) && points.length >= 2) {
      const result = await computeRouteDistance(points);
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (origins && destinations) {
      const pts = Array.isArray(origins) ? [...origins, destinations] : [origins, destinations];
      const result = await computeRouteDistance(pts);
      return NextResponse.json(result, { headers: corsHeaders });
    }

    return NextResponse.json({
      success: false,
      error: 'Podaj tablicę points z minimum 2 punktami'
    }, { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('Error calculating route distance:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}