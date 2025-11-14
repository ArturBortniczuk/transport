// src/app/api/kurier/courier/route.js
// 🚚 MEGA COURIER API - Zamawianie kuriera DHL
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

// POST - Zamów kuriera do przesyłek
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

    // Sprawdź uprawnienia użytkownika
    const { default: db } = await import('@/database/db');
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name')
      .first();

    // Tylko admin i magazynierzy mogą zamawiać kuriera
    const canBookCourier = user.role === 'admin' || user.role?.includes('magazyn');
    
    if (!canBookCourier) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do zamawiania kuriera' 
      }, { status: 403 });
    }

    const courierRequest = await request.json();
    
    console.log('🚚 Zamawianie kuriera DHL:', courierRequest);

    // Walidacja podstawowych danych
    if (!courierRequest.pickupDate || !courierRequest.pickupTimeFrom || !courierRequest.pickupTimeTo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane czasu odbioru' 
      }, { status: 400 });
    }

    // Walidacja daty (nie może być z przeszłości)
    const pickupDate = new Date(courierRequest.pickupDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (pickupDate < today) {
      return NextResponse.json({ 
        success: false, 
        error: 'Data odbioru nie może być z przeszłości' 
      }, { status: 400 });
    }

    // Walidacja godzin
    if (courierRequest.pickupTimeFrom >= courierRequest.pickupTimeTo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowy zakres godzin odbioru' 
      }, { status: 400 });
    }

    let courierData = {
      pickupDate: courierRequest.pickupDate,
      pickupTimeFrom: courierRequest.pickupTimeFrom,
      pickupTimeTo: courierRequest.pickupTimeTo,
      additionalInfo: courierRequest.additionalInfo || '',
      courierWithLabel: courierRequest.courierWithLabel || false
    };

    // OPCJA 1: Zamawianie kuriera dla istniejących przesyłek
    if (courierRequest.shipmentIds && courierRequest.shipmentIds.length > 0) {
      console.log('📦 Zamawianie kuriera dla przesyłek:', courierRequest.shipmentIds);
      
      // Sprawdź czy użytkownik ma uprawnienia do tych przesyłek
      const userShipments = await db('kuriers')
        .whereIn('id', courierRequest.shipmentIds)
        .where(function() {
          this.where('created_by_email', userId)
              .orWhere(function() {
                this.whereExists(function() {
                  this.select('*')
                      .from('users')
                      .where('email', userId)
                      .where('is_admin', true);
                });
              });
        })
        .select('id', 'notes', 'status');

      if (userShipments.length !== courierRequest.shipmentIds.length) {
        return NextResponse.json({ 
          success: false, 
          error: 'Brak uprawnień do niektórych przesyłek' 
        }, { status: 403 });
      }

      // Sprawdź czy przesyłki mają numery DHL
      const dhlShipmentNumbers = [];
      const invalidShipments = [];

      for (const shipment of userShipments) {
        if (shipment.status !== 'sent' && shipment.status !== 'approved') {
          invalidShipments.push(shipment.id);
          continue;
        }

        try {
          const notes = JSON.parse(shipment.notes || '{}');
          const dhlNumber = notes.dhl?.shipmentNumber;
          
          if (dhlNumber) {
            dhlShipmentNumbers.push(dhlNumber);
          } else {
            invalidShipments.push(shipment.id);
          }
        } catch (e) {
          invalidShipments.push(shipment.id);
        }
      }

      if (invalidShipments.length > 0) {
        return NextResponse.json({ 
          success: false, 
          error: `Przesyłki ${invalidShipments.join(', ')} nie mają numerów DHL lub mają nieprawidłowy status` 
        }, { status: 400 });
      }

      courierData.shipmentIds = dhlShipmentNumbers;
    }
    // OPCJA 2: Zamawianie kuriera bez konkretnych przesyłek
    else if (courierRequest.shipmentOrderInfo) {
      console.log('📋 Zamawianie kuriera bez przesyłek');
      
      const orderInfo = courierRequest.shipmentOrderInfo;
      
      // Walidacja danych zamówienia
      if (!orderInfo.shipper || !orderInfo.shipper.name || !orderInfo.shipper.postalCode) {
        return NextResponse.json({ 
          success: false, 
          error: 'Brakujące dane nadawcy' 
        }, { status: 400 });
      }

      courierData.shipmentOrderInfo = {
        shipper: {
          name: orderInfo.shipper.name,
          postalCode: orderInfo.shipper.postalCode.replace(/[^\d]/g, ''), // Tylko cyfry
          city: orderInfo.shipper.city,
          street: orderInfo.shipper.street,
          houseNumber: orderInfo.shipper.houseNumber,
          contactPerson: orderInfo.shipper.contactPerson,
          contactEmail: orderInfo.shipper.contactEmail
        },
        numberOfExPieces: parseInt(orderInfo.numberOfExPieces) || 0,
        numberOfDrPieces: parseInt(orderInfo.numberOfDrPieces) || 0,
        totalWeight: parseFloat(orderInfo.totalWeight) || 0,
        heaviestPieceWeight: parseFloat(orderInfo.heaviestPieceWeight) || 0
      };
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące dane przesyłek lub informacje o zamówieniu' 
      }, { status: 400 });
    }

    // Wywołaj DHL API
    const courierResult = await DHLApiService.bookCourier(courierData);
    
    if (courierResult.success) {
      // Zapisz informację o zamówieniu kuriera w bazie
      await saveCourierBookingHistory(courierData, courierResult, userId);
      
      // Jeśli zamawialiśmy kuriera dla konkretnych przesyłek, zaktualizuj ich status
      if (courierRequest.shipmentIds && courierRequest.shipmentIds.length > 0) {
        await updateShipmentsWithCourierInfo(courierRequest.shipmentIds, courierResult, userId);
      }

      return NextResponse.json({
        success: true,
        orderIds: courierResult.orderId,
        message: courierResult.message,
        details: {
          pickupDate: courierData.pickupDate,
          pickupTime: `${courierData.pickupTimeFrom} - ${courierData.pickupTimeTo}`,
          shipmentCount: courierData.shipmentIds?.length || 0,
          estimatedArrival: calculateEstimatedArrival(courierData.pickupDate, courierData.pickupTimeFrom)
        },
        tracking: {
          orderIds: courierResult.orderId,
          statusCheckUrl: '/api/kurier/courier/status',
          estimatedPickup: `${courierData.pickupDate} ${courierData.pickupTimeFrom}`
        }
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: courierResult.error 
      });
    }
  } catch (error) {
    console.error('💥 Błąd zamawiania kuriera:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// GET - Pobierz dostępne okna czasowe dla kuriera
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
    const date = searchParams.get('date');
    const postalCode = searchParams.get('postalCode');

    if (!date) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakująca data' 
      }, { status: 400 });
    }

    // Sprawdź dostępne okna czasowe dla kuriera
    let timeSlots = getDefaultTimeSlots();
    
    // Jeśli podano kod pocztowy, sprawdź dostępność w DHL
    if (postalCode) {
      try {
        const cleanedPostCode = postalCode.replace(/[^\d]/g, '');
        if (cleanedPostCode.length === 5) {
          const servicesResult = await DHLApiService.getPostalCodeServices(
            cleanedPostCode, 
            date,
            '', '', '', ''
          );
          
          if (servicesResult.success && servicesResult.services) {
            timeSlots = adjustTimeSlotsBasedOnServices(timeSlots, servicesResult.services);
          }
        }
      } catch (error) {
        console.warn('Nie udało się sprawdzić dostępności kuriera dla kodu pocztowego:', error);
      }
    }

    return NextResponse.json({
      success: true,
      date: date,
      postalCode: postalCode,
      timeSlots: timeSlots,
      recommendations: {
        bestTime: '10:00-14:00',
        note: 'Najlepsze okno czasowe dla odbioru kuriera',
        factors: [
          'Wysoka dostępność kurierów',
          'Optymalne dla logistyki DHL',
          'Unikanie godzin szczytowych'
        ]
      },
      restrictions: {
        minimumNotice: '2 hours',
        maxAdvanceBooking: '14 days',
        weekendAvailability: false,
        holidayAvailability: false
      }
    });
  } catch (error) {
    console.error('Error getting courier time slots:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Helper functions
function getDefaultTimeSlots() {
  return [
    {
      id: 'morning',
      label: 'Rano',
      timeFrom: '08:00',
      timeTo: '12:00',
      available: true,
      recommended: false,
      description: 'Odbiór rano - dobry dla przygotowanych przesyłek'
    },
    {
      id: 'midday',
      label: 'Południe',
      timeFrom: '10:00',
      timeTo: '14:00',
      available: true,
      recommended: true,
      description: 'Optymalne okno czasowe - najwyższa dostępność'
    },
    {
      id: 'afternoon',
      label: 'Popołudnie',
      timeFrom: '12:00',
      timeTo: '16:00',
      available: true,
      recommended: false,
      description: 'Odbiór popołudniowy - dobre dla ostatniej chwili'
    },
    {
      id: 'late',
      label: 'Późne popołudnie',
      timeFrom: '14:00',
      timeTo: '18:00',
      available: true,
      recommended: false,
      description: 'Późny odbiór - ograniczona dostępność'
    },
    {
      id: 'custom',
      label: 'Własne okno',
      timeFrom: '',
      timeTo: '',
      available: true,
      recommended: false,
      description: 'Określ własny zakres godzin (8:00-18:00)'
    }
  ];
}

function adjustTimeSlotsBasedOnServices(timeSlots, services) {
  // Dostosuj dostępność okien czasowych na podstawie usług DHL
  const adjustedSlots = [...timeSlots];
  
  if (services.exPickupFrom && services.exPickupTo) {
    // Ogranicz dostępność na podstawie okien DHL
    const dhlFrom = services.exPickupFrom;
    const dhlTo = services.exPickupTo;
    
    adjustedSlots.forEach(slot => {
      if (slot.id !== 'custom') {
        // Sprawdź czy okno czasowe mieści się w dostępności DHL
        const slotStart = timeToMinutes(slot.timeFrom);
        const slotEnd = timeToMinutes(slot.timeTo);
        const dhlStart = timeToMinutes(dhlFrom);
        const dhlEnd = timeToMinutes(dhlTo);
        
        if (slotStart < dhlStart || slotEnd > dhlEnd) {
          slot.available = false;
          slot.description += ' (niedostępne dla tego kodu pocztowego)';
        }
      }
    });
  }
  
  return adjustedSlots;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateEstimatedArrival(pickupDate, pickupTimeFrom) {
  const pickupDateTime = new Date(`${pickupDate}T${pickupTimeFrom}:00`);
  
  // Dodaj 30-60 minut jako szacowany czas przyjazdu
  const estimatedArrival = new Date(pickupDateTime.getTime() + (45 * 60 * 1000));
  
  return estimatedArrival.toISOString();
}

async function saveCourierBookingHistory(courierData, courierResult, userId) {
  try {
    const { default: db } = await import('@/database/db');
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('kurier_courier_bookings');
    
    if (!tableExists) {
      await db.schema.createTable('kurier_courier_bookings', table => {
        table.increments('id').primary();
        table.text('order_ids'); // JSON array of DHL order IDs
        table.string('booked_by').notNullable();
        table.date('pickup_date').notNullable();
        table.time('pickup_time_from').notNullable();
        table.time('pickup_time_to').notNullable();
        table.text('additional_info');
        table.boolean('courier_with_label').defaultTo(false);
        table.text('shipment_ids'); // JSON array if booking for specific shipments
        table.text('courier_data'); // Full courier request data
        table.text('dhl_response'); // DHL API response
        table.timestamp('booked_at').defaultTo(db.fn.now());
        table.string('status').defaultTo('booked'); // booked, confirmed, completed, cancelled
        
        table.index(['booked_by', 'pickup_date']);
        table.index('status');
      });
      
      console.log('Created kurier_courier_bookings table');
    }

    // Zapisz zamówienie kuriera
    await db('kurier_courier_bookings').insert({
      order_ids: JSON.stringify(courierResult.orderId),
      booked_by: userId,
      pickup_date: courierData.pickupDate,
      pickup_time_from: courierData.pickupTimeFrom,
      pickup_time_to: courierData.pickupTimeTo,
      additional_info: courierData.additionalInfo,
      courier_with_label: courierData.courierWithLabel,
      shipment_ids: courierData.shipmentIds ? JSON.stringify(courierData.shipmentIds) : null,
      courier_data: JSON.stringify(courierData),
      dhl_response: JSON.stringify(courierResult)
    });
    
    console.log('Zapisano zamówienie kuriera w historii');
  } catch (error) {
    console.error('Błąd zapisywania historii kuriera:', error);
  }
}

async function updateShipmentsWithCourierInfo(shipmentIds, courierResult, userId) {
  try {
    const { default: db } = await import('@/database/db');
    
    for (const shipmentId of shipmentIds) {
      const shipment = await db('kuriers').where('id', shipmentId).first();
      
      if (shipment) {
        let notes = {};
        try {
          notes = JSON.parse(shipment.notes || '{}');
        } catch (e) {
          // Ignore parsing errors
        }
        
        // Dodaj informacje o kurierze
        notes.courier = {
          orderIds: courierResult.orderId,
          bookedAt: new Date().toISOString(),
          bookedBy: userId,
          status: 'booked'
        };
        
        await db('kuriers')
          .where('id', shipmentId)
          .update({
            notes: JSON.stringify(notes)
          });
      }
    }
  } catch (error) {
    console.error('Błąd aktualizacji przesyłek z informacjami o kurierze:', error);
  }
}
