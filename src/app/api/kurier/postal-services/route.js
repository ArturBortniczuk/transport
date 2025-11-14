// src/app/api/kurier/postal-services/route.js
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

// Funkcja czyszcząca kod pocztowy - tylko cyfry
const cleanPostalCode = (postCode) => {
  if (!postCode) return '';
  return postCode.toString().replace(/[^\d]/g, '');
};

// Funkcja formatująca kod pocztowy dla wyświetlania
const formatPostalCodeDisplay = (postCode) => {
  const cleaned = cleanPostalCode(postCode);
  if (cleaned.length === 5) {
    return `${cleaned.substring(0, 2)}-${cleaned.substring(2)}`;
  }
  return postCode;
};

// POST - Sprawdź dostępne usługi DHL dla kodu pocztowego
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

    const { postCode, pickupDate, city, street, houseNumber, apartmentNumber } = await request.json();
    
    console.log('🔍 Sprawdzanie usług DHL:', { postCode, pickupDate, city });

    // Wyczyść kod pocztowy
    const cleanedPostCode = cleanPostalCode(postCode);
    
    if (!cleanedPostCode || cleanedPostCode.length !== 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowy kod pocztowy. Wymagany format: 5 cyfr (np. 15169)' 
      }, { status: 400 });
    }

    // Walidacja daty
    if (!pickupDate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Data odbioru jest wymagana' 
      }, { status: 400 });
    }

    const pickupDateObj = new Date(pickupDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (pickupDateObj < today) {
      return NextResponse.json({ 
        success: false, 
        error: 'Data odbioru nie może być z przeszłości' 
      }, { status: 400 });
    }

    // Sprawdź usługi w DHL
    const servicesResult = await DHLApiService.getPostalCodeServices(
      cleanedPostCode,
      pickupDate,
      city,
      street,
      houseNumber,
      apartmentNumber
    );

    if (servicesResult.success) {
      return NextResponse.json({ 
        success: true,
        services: servicesResult.services,
        message: servicesResult.message,
        postalCodeInfo: {
          original: postCode,
          cleaned: cleanedPostCode,
          formatted: formatPostalCodeDisplay(postCode)
        }
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: servicesResult.error,
        postalCodeInfo: {
          original: postCode,
          cleaned: cleanedPostCode,
          formatted: formatPostalCodeDisplay(postCode)
        }
      });
    }
  } catch (error) {
    console.error('Error checking postal services:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// GET - Sprawdź usługi przez parametry URL (opcjonalnie)
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

    const { searchParams } = new URL(request.url);
    const postCode = searchParams.get('postCode');
    const pickupDate = searchParams.get('pickupDate') || new Date().toISOString().split('T')[0];
    const city = searchParams.get('city') || '';

    if (!postCode) {
      return NextResponse.json({ 
        success: false, 
        error: 'Kod pocztowy jest wymagany' 
      }, { status: 400 });
    }

    const cleanedPostCode = cleanPostalCode(postCode);
    
    if (cleanedPostCode.length !== 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowy kod pocztowy' 
      }, { status: 400 });
    }

    const servicesResult = await DHLApiService.getPostalCodeServices(
      cleanedPostCode,
      pickupDate,
      city
    );

    if (servicesResult.success) {
      return NextResponse.json({ 
        success: true,
        services: servicesResult.services,
        message: servicesResult.message,
        postalCodeInfo: {
          original: postCode,
          cleaned: cleanedPostCode,
          formatted: formatPostalCodeDisplay(postCode)
        }
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: servicesResult.error 
      });
    }
  } catch (error) {
    console.error('Error checking postal services:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}
