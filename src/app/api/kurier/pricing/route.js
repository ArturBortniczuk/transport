// src/app/api/kurier/pricing/route.js
// 💰 MEGA PRICING API - Kalkulacja cen DHL na żywo
import { NextResponse } from 'next/server';
import DHLApiService from '@/app/services/dhl-api';

// Funkcja pomocnicza do walidacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const { default: db } = await import('@/database/db');
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first();
  
  return session?.user_id;
};

// Cache dla cen (żeby nie wywoływać DHL za często)
const priceCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minut

function getCacheKey(priceRequest) {
  const key = JSON.stringify({
    shipper: priceRequest.shipper,
    receiver: priceRequest.receiver,
    service: priceRequest.service,
    pieceList: priceRequest.pieceList
  });
  return key;
}

function getCachedPrice(cacheKey) {
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  priceCache.delete(cacheKey);
  return null;
}

function setCachedPrice(cacheKey, data) {
  priceCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// POST - Oblicz cenę przesyłki
export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const priceRequest = await request.json();
    
    console.log('💰 Kalkulacja ceny DHL:', priceRequest);

    // Walidacja podstawowych danych
    if (!priceRequest.shipper || !priceRequest.receiver || !priceRequest.pieceList) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane do kalkulacji ceny' 
      }, { status: 400 });
    }

    // Sprawdź cache
    const cacheKey = getCacheKey(priceRequest);
    const cachedPrice = getCachedPrice(cacheKey);
    
    if (cachedPrice) {
      console.log('💰 Zwracam cenę z cache');
      return NextResponse.json({
        success: true,
        ...cachedPrice,
        cached: true
      });
    }

    // Wywołaj DHL API
    const pricingResult = await DHLApiService.getPrice(priceRequest);
    
    if (pricingResult.success) {
      // Oblicz szczegółowe koszty
      const basePrice = parseFloat(pricingResult.price) || 0;
      const fuelSurcharge = parseFloat(pricingResult.fuelSurcharge) || 0;
      const fuelSurchargeAmount = (basePrice * fuelSurcharge) / 100;
      const totalNet = basePrice + fuelSurchargeAmount;
      const vatRate = 23; // VAT 23%
      const vatAmount = (totalNet * vatRate) / 100;
      const totalGross = totalNet + vatAmount;

      // Oblicz dodatkowe koszty za usługi
      let additionalCosts = 0;
      const service = priceRequest.service || {};
      
      if (service.insurance && service.insuranceValue) {
        additionalCosts += Math.max(5, (parseFloat(service.insuranceValue) * 0.005)); // 0.5%, min 5 PLN
      }
      
      if (service.collectOnDelivery && service.collectOnDeliveryValue) {
        additionalCosts += Math.max(8, (parseFloat(service.collectOnDeliveryValue) * 0.01)); // 1%, min 8 PLN
      }
      
      if (service.deliveryEvening) additionalCosts += 15;
      if (service.deliveryOnSaturday) additionalCosts += 20;
      if (service.pickupOnSaturday) additionalCosts += 15;

      const finalResult = {
        success: true,
        price: basePrice.toFixed(2),
        fuelSurcharge: fuelSurcharge.toString(),
        currency: pricingResult.currency || 'PLN',
        breakdown: {
          basePrice: basePrice.toFixed(2),
          fuelSurcharge: fuelSurchargeAmount.toFixed(2),
          additionalServices: additionalCosts.toFixed(2),
          totalNet: (totalNet + additionalCosts).toFixed(2),
          vat: ((totalNet + additionalCosts) * vatRate / 100).toFixed(2),
          totalGross: (totalNet + additionalCosts + ((totalNet + additionalCosts) * vatRate / 100)).toFixed(2)
        },
        estimatedDelivery: calculateEstimatedDelivery(priceRequest.service?.product),
        serviceDetails: getServiceDetails(priceRequest.service?.product)
      };

      // Zapisz w cache
      setCachedPrice(cacheKey, finalResult);
      
      return NextResponse.json(finalResult);
    } else {
      return NextResponse.json({ 
        success: false, 
        error: pricingResult.error 
      });
    }
  } catch (error) {
    console.error('💥 Błąd kalkulacji ceny:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// GET - Pobierz standardowe ceny (dla referencji)
export async function GET(request) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Zwróć standardowe ceny referencyjne
    const standardPrices = {
      success: true,
      standardPrices: {
        'AH': { min: 20, max: 35, description: 'Przesyłka krajowa standardowa' },
        '09': { min: 40, max: 60, description: 'Domestic Express 9 - dostawa do 9:00' },
        '12': { min: 30, max: 50, description: 'Domestic Express 12 - dostawa do 12:00' },
        'DW': { min: 25, max: 40, description: 'Doręczenie wieczorne 18-22' },
        'SP': { min: 18, max: 30, description: 'Doręczenie do punktu DHL' },
        'EK': { min: 25, max: 45, description: 'Connect - paczki do 31.5kg' },
        'PI': { min: 50, max: 150, description: 'International - przesyłki międzynarodowe' },
        'PR': { min: 45, max: 80, description: 'Premium - usługa premium' },
        'CP': { min: 30, max: 55, description: 'Connect Plus' },
        'CM': { min: 70, max: 120, description: 'Connect Plus Pallet' }
      },
      additionalServices: {
        insurance: { rate: 0.5, min: 5, description: '0.5% wartości, min 5 PLN' },
        collectOnDelivery: { rate: 1, min: 8, description: '1% kwoty, min 8 PLN' },
        deliveryEvening: { fixed: 15, description: 'Dostawa wieczorna +15 PLN' },
        deliveryOnSaturday: { fixed: 20, description: 'Dostawa w sobotę +20 PLN' },
        pickupOnSaturday: { fixed: 15, description: 'Nadanie w sobotę +15 PLN' }
      },
      note: 'Ceny orientacyjne w PLN netto. Rzeczywista cena zależy od wagi, wymiarów i trasy.'
    };

    return NextResponse.json(standardPrices);
  } catch (error) {
    console.error('Error getting standard prices:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Helper functions
function calculateEstimatedDelivery(product) {
  const today = new Date();
  let deliveryDate = new Date(today);
  
  switch (product) {
    case '09':
    case '12':
      deliveryDate.setDate(today.getDate() + 1); // Następny dzień
      break;
    case 'AH':
    case 'DW':
    case 'EK':
    case 'CP':
      deliveryDate.setDate(today.getDate() + 1); // 1-2 dni robocze
      if (deliveryDate.getDay() === 6) deliveryDate.setDate(deliveryDate.getDate() + 2); // Skip weekend
      if (deliveryDate.getDay() === 0) deliveryDate.setDate(deliveryDate.getDate() + 1);
      break;
    case 'SP':
      deliveryDate.setDate(today.getDate() + 2); // 2-3 dni robocze
      break;
    case 'PI':
      deliveryDate.setDate(today.getDate() + 5); // 5-10 dni roboczych
      break;
    case 'CM':
      deliveryDate.setDate(today.getDate() + 3); // 3-5 dni roboczych
      break;
    default:
      deliveryDate.setDate(today.getDate() + 2);
  }
  
  return deliveryDate.toISOString().split('T')[0];
}

function getServiceDetails(product) {
  const services = {
    'AH': {
      name: 'Przesyłka krajowa',
      maxWeight: 1000,
      maxSize: '160x160x160',
      features: ['Standardowa dostawa', 'Śledzenie przesyłki', 'Ubezpieczenie podstawowe']
    },
    '09': {
      name: 'Domestic Express 9',
      maxWeight: 31.5,
      maxSize: '120x80x60',
      features: ['Dostawa do 9:00', 'Następny dzień roboczy', 'Priorytet obsługi']
    },
    '12': {
      name: 'Domestic Express 12', 
      maxWeight: 31.5,
      maxSize: '120x80x60',
      features: ['Dostawa do 12:00', 'Następny dzień roboczy', 'Priorytet obsługi']
    },
    'DW': {
      name: 'Doręczenie wieczorne',
      maxWeight: 31.5,
      maxSize: '120x80x60',
      features: ['Dostawa 18:00-22:00', 'Elastyczne godziny', 'Dla pracujących']
    },
    'SP': {
      name: 'Doręczenie do punktu',
      maxWeight: 25,
      maxSize: '100x60x60',
      features: ['Odbiór w punkcie DHL', 'Wydłużony czas odbioru', 'Niższa cena']
    },
    'EK': {
      name: 'Connect',
      maxWeight: 31.5,
      maxSize: '120x80x60',
      features: ['Przesyłki Connect', 'B2B', 'Standardowa obsługa']
    },
    'PI': {
      name: 'International',
      maxWeight: 31.5,
      maxSize: '120x80x60',
      features: ['Przesyłki międzynarodowe', 'Odprawa celna', 'Śledzenie globalne']
    },
    'PR': {
      name: 'Premium',
      maxWeight: 31.5,
      maxSize: '120x80x60',
      features: ['Usługa premium', 'Najwyższa jakość', 'Dedykowany support']
    },
    'CP': {
      name: 'Connect Plus',
      maxWeight: 31.5,
      maxSize: '120x80x60',
      features: ['Connect Plus', 'Rozszerzona obsługa', 'Dodatkowe opcje']
    },
    'CM': {
      name: 'Connect Plus Pallet',
      maxWeight: 1000,
      maxSize: '120x80x120',
      features: ['Przesyłki paletowe', 'Duże gabaryty', 'Transport dedykowany']
    }
  };

  return services[product] || services['AH'];
}
