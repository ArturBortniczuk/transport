// src/app/api/kurier/shipments/route.js
// 🚀 MEGA SHIPMENTS MANAGEMENT API - Kompleksowe zarządzanie przesyłkami DHL
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

// Cache dla przesyłek DHL (żeby nie pobierać za często)
const shipmentsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minut

function getCacheKey(params) {
  return JSON.stringify({
    createdFrom: params.createdFrom,
    createdTo: params.createdTo,
    offset: params.offset || 0
  });
}

function getCachedShipments(cacheKey) {
  const cached = shipmentsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  shipmentsCache.delete(cacheKey);
  return null;
}

function setCachedShipments(cacheKey, data) {
  shipmentsCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// GET - Pobierz przesyłki z DHL (getMyShipments)
export async function GET(request) {
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

    // Tylko admin i magazynierzy mogą przeglądać przesyłki DHL
    const canViewShipments = user.role === 'admin' || user.role?.includes('magazyn');
    
    if (!canViewShipments) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do przeglądania przesyłek DHL' 
      }, { status: 403 });
    }

    // Parametry zapytania
    const { searchParams } = new URL(request.url);
    const createdFrom = searchParams.get('createdFrom');
    const createdTo = searchParams.get('createdTo');
    const offset = parseInt(searchParams.get('offset')) || 0;
    const limit = parseInt(searchParams.get('limit')) || 100;
    const status = searchParams.get('status'); // all, delivered, in_transit, pending
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Domyślnie ostatnie 30 dni
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 30);
    
    const fromDate = createdFrom || defaultFrom.toISOString().split('T')[0];
    const toDate = createdTo || today.toISOString().split('T')[0];

    console.log('🚀 Pobieranie przesyłek DHL:', { fromDate, toDate, offset, limit, status });

    // Sprawdź cache (jeśli nie force refresh)
    const cacheKey = getCacheKey({ createdFrom: fromDate, createdTo: toDate, offset });
    if (!forceRefresh) {
      const cachedData = getCachedShipments(cacheKey);
      if (cachedData) {
        console.log('📦 Zwracam przesyłki z cache');
        return NextResponse.json({
          success: true,
          shipments: cachedData.shipments,
          totalCount: cachedData.totalCount,
          fromCache: true,
          ...cachedData.meta
        });
      }
    }

    // Pobierz liczbę przesyłek
    const countResult = await DHLApiService.getMyShipmentsCount({
      createdFrom: fromDate,
      createdTo: toDate
    });

    if (!countResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Nie udało się pobrać liczby przesyłek: ' + countResult.error
      }, { status: 500 });
    }

    const totalCount = countResult.shipmentsCount || 0;

    // Pobierz przesyłki
    const shipmentsResult = await DHLApiService.getMyShipments({
      createdFrom: fromDate,
      createdTo: toDate,
      offset: offset
    });

    if (!shipmentsResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Nie udało się pobrać przesyłek: ' + shipmentsResult.error
      }, { status: 500 });
    }

    let shipments = shipmentsResult.shipments || [];

    // Wzbogać dane o informacje z lokalnej bazy
    const enrichedShipments = await enrichShipmentsWithLocalData(shipments, db);

    // Filtrowanie po statusie
    if (status && status !== 'all') {
      shipments = enrichedShipments.filter(shipment => {
        switch (status) {
          case 'delivered':
            return shipment.trackingStatus === 'DELIVERED' || shipment.localStatus === 'delivered';
          case 'in_transit':
            return shipment.trackingStatus === 'IN_TRANSIT' || shipment.localStatus === 'sent';
          case 'pending':
            return !shipment.trackingStatus || shipment.localStatus === 'new' || shipment.localStatus === 'approved';
          default:
            return true;
        }
      });
    } else {
      shipments = enrichedShipments;
    }

    // Przygotuj metadane
    const meta = {
      totalCount: totalCount,
      returnedCount: shipments.length,
      offset: offset,
      limit: limit,
      hasMore: (offset + shipments.length) < totalCount,
      dateRange: {
        from: fromDate,
        to: toDate
      },
      filters: {
        status: status || 'all'
      },
      retrievedAt: new Date().toISOString()
    };

    // Zapisz w cache
    const dataToCache = {
      shipments,
      totalCount,
      meta
    };
    setCachedShipments(cacheKey, dataToCache);

    console.log(`✅ Pobrano ${shipments.length}/${totalCount} przesyłek DHL`);

    return NextResponse.json({
      success: true,
      shipments: shipments,
      totalCount: totalCount,
      ...meta
    });

  } catch (error) {
    console.error('Error fetching DHL shipments:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera: ' + error.message
    }, { status: 500 });
  }
}

// POST - Wykonaj operacje na przesyłkach (bulk operations)
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

    // Tylko admin i magazynierzy mogą wykonywać operacje na przesyłkach
    const canManageShipments = user.role === 'admin' || user.role?.includes('magazyn');
    
    if (!canManageShipments) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do zarządzania przesyłkami' 
      }, { status: 403 });
    }

    const requestData = await request.json();
    const { operation, shipmentIds, ...operationData } = requestData;

    console.log('🚀 Operacja na przesyłkach:', { operation, shipmentIds: shipmentIds?.length });

    if (!operation || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Brak wymaganej operacji lub ID przesyłek'
      }, { status: 400 });
    }

    let results = [];

    switch (operation) {
      case 'delete':
        results = await handleDeleteShipments(shipmentIds, userId, db);
        break;
      
      case 'track':
        results = await handleTrackShipments(shipmentIds, userId);
        break;
      
      case 'get_labels':
        results = await handleGetLabels(shipmentIds, operationData.labelTypes || ['BLP'], userId, db);
        break;
      
      case 'get_scans':
        results = await handleGetScans(shipmentIds, userId, db);
        break;
      
      case 'book_courier':
        results = await handleBookCourierForShipments(shipmentIds, operationData, userId, db);
        break;
      
      case 'sync_status':
        results = await handleSyncStatus(shipmentIds, userId, db);
        break;
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Nieznana operacja: ' + operation
        }, { status: 400 });
    }

    // Wyczyść cache po operacjach modyfikujących
    if (['delete', 'sync_status'].includes(operation)) {
      shipmentsCache.clear();
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      operation: operation,
      totalProcessed: shipmentIds.length,
      successCount: successCount,
      failureCount: failureCount,
      results: results,
      summary: `Przetworzono ${successCount}/${shipmentIds.length} przesyłek. Błędów: ${failureCount}`
    });

  } catch (error) {
    console.error('Error in shipments bulk operation:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera: ' + error.message
    }, { status: 500 });
  }
}

// DELETE - Usuń przesyłki z DHL (deleteShipments)
export async function DELETE(request) {
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

    // Sprawdź uprawnienia użytkownika (tylko admin)
    const { default: db } = await import('@/database/db');
    const user = await db('users')
      .where('email', userId)
      .select('role', 'name')
      .first();

    if (user.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Tylko administrator może usuwać przesyłki z DHL' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const shipmentNumbers = searchParams.get('shipmentNumbers')?.split(',') || [];

    if (shipmentNumbers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Brak numerów przesyłek do usunięcia'
      }, { status: 400 });
    }

    console.log('🗑️ Usuwanie przesyłek z DHL:', shipmentNumbers);

    // Wywołaj DHL API
    const deleteResult = await DHLApiService.deleteShipments(shipmentNumbers);

    if (deleteResult.success) {
      // Zaktualizuj lokalne zamówienia
      await updateLocalOrdersAfterDelete(shipmentNumbers, userId, db);
      
      // Wyczyść cache
      shipmentsCache.clear();

      return NextResponse.json({
        success: true,
        deletedShipments: deleteResult.deletedShipments || shipmentNumbers,
        message: `Usunięto ${shipmentNumbers.length} przesyłek z DHL`
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Nie udało się usunąć przesyłek: ' + deleteResult.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error deleting shipments:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera: ' + error.message
    }, { status: 500 });
  }
}

// ============================================================================
// 🛠️ HELPER FUNCTIONS
// ============================================================================

// Wzbogać dane przesyłek o informacje z lokalnej bazy
async function enrichShipmentsWithLocalData(shipments, db) {
  const enrichedShipments = [];

  for (const shipment of shipments) {
    try {
      // Znajdź lokalne zamówienie po shipmentId
      const localOrder = await db('kuriers')
        .whereRaw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.shipmentNumber')) = ?", [shipment.shipmentId])
        .select('id', 'status', 'notes', 'created_by_email', 'recipient_name')
        .first();

      let localData = {};
      if (localOrder) {
        const notes = JSON.parse(localOrder.notes || '{}');
        localData = {
          localOrderId: localOrder.id,
          localStatus: localOrder.status,
          createdBy: localOrder.created_by_email,
          recipientName: localOrder.recipient_name,
          trackingStatus: notes.dhl?.trackingStatus,
          lastTracked: notes.dhl?.lastTracked,
          courier: notes.courier
        };
      }

      enrichedShipments.push({
        ...shipment,
        ...localData,
        enriched: true
      });
    } catch (error) {
      console.warn(`Błąd wzbogacania danych dla przesyłki ${shipment.shipmentId}:`, error);
      enrichedShipments.push({
        ...shipment,
        enriched: false
      });
    }
  }

  return enrichedShipments;
}

// Obsługa usuwania przesyłek
async function handleDeleteShipments(shipmentIds, userId, db) {
  const results = [];

  for (const shipmentId of shipmentIds) {
    try {
      console.log(`🗑️ Usuwanie przesyłki: ${shipmentId}`);
      
      const deleteResult = await DHLApiService.deleteShipments([shipmentId]);
      
      if (deleteResult.success) {
        // Zaktualizuj lokalne zamówienie
        await updateLocalOrderAfterDelete(shipmentId, userId, db);
        
        results.push({
          shipmentId: shipmentId,
          success: true,
          message: 'Przesyłka usunięta z DHL'
        });
      } else {
        results.push({
          shipmentId: shipmentId,
          success: false,
          error: deleteResult.error
        });
      }
    } catch (error) {
      results.push({
        shipmentId: shipmentId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Obsługa śledzenia przesyłek
async function handleTrackShipments(shipmentIds, userId) {
  const results = [];

  for (const shipmentId of shipmentIds) {
    try {
      console.log(`📍 Śledzenie przesyłki: ${shipmentId}`);
      
      const trackingResult = await DHLApiService.getTrackAndTraceInfo(shipmentId);
      
      results.push({
        shipmentId: shipmentId,
        success: trackingResult.success,
        trackingData: trackingResult.success ? {
          status: trackingResult.status,
          events: trackingResult.events,
          estimatedDelivery: trackingResult.estimatedDelivery
        } : null,
        error: trackingResult.success ? null : trackingResult.error
      });
    } catch (error) {
      results.push({
        shipmentId: shipmentId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Obsługa pobierania etykiet
async function handleGetLabels(shipmentIds, labelTypes, userId, db) {
  const results = [];

  try {
    console.log(`🏷️ Pobieranie etykiet dla ${shipmentIds.length} przesyłek`);
    
    // Przygotuj żądania etykiet
    const labelRequests = [];
    for (const shipmentId of shipmentIds) {
      for (const labelType of labelTypes) {
        labelRequests.push({
          shipmentId: shipmentId,
          labelType: labelType
        });
      }
    }

    const labelsResult = await DHLApiService.getLabels(labelRequests);
    
    if (labelsResult.success) {
      // Grupuj etykiety po shipmentId
      const labelsByShipment = {};
      for (const label of labelsResult.labels) {
        if (!labelsByShipment[label.shipmentId]) {
          labelsByShipment[label.shipmentId] = [];
        }
        labelsByShipment[label.shipmentId].push(label);
      }

      // Przygotuj wyniki
      for (const shipmentId of shipmentIds) {
        const shipmentLabels = labelsByShipment[shipmentId] || [];
        results.push({
          shipmentId: shipmentId,
          success: shipmentLabels.length > 0,
          labels: shipmentLabels,
          downloadUrls: shipmentLabels.map(label => 
            `/api/kurier/labels/download/${label.shipmentId}/${label.labelType}`
          ),
          error: shipmentLabels.length === 0 ? 'Brak etykiet dla tej przesyłki' : null
        });
      }
    } else {
      // Wszystkie przesyłki nie udało się
      for (const shipmentId of shipmentIds) {
        results.push({
          shipmentId: shipmentId,
          success: false,
          error: labelsResult.error
        });
      }
    }
  } catch (error) {
    // Wszystkie przesyłki nie udało się
    for (const shipmentId of shipmentIds) {
      results.push({
        shipmentId: shipmentId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Obsługa pobierania skanów
async function handleGetScans(shipmentIds, userId, db) {
  const results = [];

  for (const shipmentId of shipmentIds) {
    try {
      console.log(`📄 Pobieranie skanu dla: ${shipmentId}`);
      
      const scanResult = await DHLApiService.getShipmentScan(shipmentId);
      
      results.push({
        shipmentId: shipmentId,
        success: scanResult.success,
        scanData: scanResult.success ? {
          data: scanResult.scanData,
          mimeType: scanResult.scanMimeType,
          downloadUrl: `/api/kurier/scans/download/${shipmentId}`
        } : null,
        error: scanResult.success ? null : scanResult.error
      });
    } catch (error) {
      results.push({
        shipmentId: shipmentId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Obsługa zamawiania kuriera dla przesyłek
async function handleBookCourierForShipments(shipmentIds, courierData, userId, db) {
  try {
    console.log(`🚚 Zamawianie kuriera dla ${shipmentIds.length} przesyłek`);
    
    const courierRequest = {
      shipmentIds: shipmentIds,
      pickupDate: courierData.pickupDate,
      pickupTimeFrom: courierData.pickupTimeFrom,
      pickupTimeTo: courierData.pickupTimeTo,
      additionalInfo: courierData.additionalInfo,
      courierWithLabel: courierData.courierWithLabel
    };

    const courierResult = await DHLApiService.bookCourier(courierRequest);
    
    if (courierResult.success) {
      // Zaktualizuj lokalne zamówienia
      await updateLocalOrdersWithCourierInfo(shipmentIds, courierResult, userId, db);
      
      return shipmentIds.map(shipmentId => ({
        shipmentId: shipmentId,
        success: true,
        courierOrderIds: courierResult.orderId,
        message: 'Kurier zamówiony pomyślnie'
      }));
    } else {
      return shipmentIds.map(shipmentId => ({
        shipmentId: shipmentId,
        success: false,
        error: courierResult.error
      }));
    }
  } catch (error) {
    return shipmentIds.map(shipmentId => ({
      shipmentId: shipmentId,
      success: false,
      error: error.message
    }));
  }
}

// Obsługa synchronizacji statusów
async function handleSyncStatus(shipmentIds, userId, db) {
  const results = [];

  for (const shipmentId of shipmentIds) {
    try {
      console.log(`🔄 Synchronizacja statusu: ${shipmentId}`);
      
      const trackingResult = await DHLApiService.getTrackAndTraceInfo(shipmentId);
      
      if (trackingResult.success) {
        // Zaktualizuj lokalny status
        await updateLocalOrderStatus(shipmentId, trackingResult, userId, db);
        
        results.push({
          shipmentId: shipmentId,
          success: true,
          newStatus: trackingResult.status,
          message: 'Status zsynchronizowany'
        });
      } else {
        results.push({
          shipmentId: shipmentId,
          success: false,
          error: trackingResult.error
        });
      }
    } catch (error) {
      results.push({
        shipmentId: shipmentId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Aktualizuj lokalne zamówienie po usunięciu z DHL
async function updateLocalOrderAfterDelete(shipmentId, userId, db) {
  try {
    const localOrder = await db('kuriers')
      .whereRaw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.shipmentNumber')) = ?", [shipmentId])
      .first();

    if (localOrder) {
      const notes = JSON.parse(localOrder.notes || '{}');
      
      // Oznacz jako usunięte z DHL
      notes.dhl.deletedFromDHL = true;
      notes.dhl.deletedAt = new Date().toISOString();
      notes.dhl.deletedBy = userId;
      
      await db('kuriers')
        .where('id', localOrder.id)
        .update({
          status: 'cancelled',
          notes: JSON.stringify(notes)
        });
      
      console.log(`Updated local order ${localOrder.id} after DHL deletion`);
    }
  } catch (error) {
    console.warn(`Failed to update local order after deleting shipment ${shipmentId}:`, error);
  }
}

// Aktualizuj lokalne zamówienia po usunięciu z DHL (bulk)
async function updateLocalOrdersAfterDelete(shipmentNumbers, userId, db) {
  for (const shipmentNumber of shipmentNumbers) {
    await updateLocalOrderAfterDelete(shipmentNumber, userId, db);
  }
}

// Aktualizuj lokalne zamówienia z informacjami o kurierze
async function updateLocalOrdersWithCourierInfo(shipmentIds, courierResult, userId, db) {
  for (const shipmentId of shipmentIds) {
    try {
      const localOrder = await db('kuriers')
        .whereRaw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.shipmentNumber')) = ?", [shipmentId])
        .first();

      if (localOrder) {
        const notes = JSON.parse(localOrder.notes || '{}');
        
        // Dodaj informacje o kurierze
        notes.courier = {
          orderIds: courierResult.orderId,
          bookedAt: new Date().toISOString(),
          bookedBy: userId,
          status: 'booked'
        };
        
        await db('kuriers')
          .where('id', localOrder.id)
          .update({
            notes: JSON.stringify(notes)
          });
        
        console.log(`Updated local order ${localOrder.id} with courier info`);
      }
    } catch (error) {
      console.warn(`Failed to update local order for shipment ${shipmentId} with courier info:`, error);
    }
  }
}

// Aktualizuj lokalny status zamówienia
async function updateLocalOrderStatus(shipmentId, trackingResult, userId, db) {
  try {
    const localOrder = await db('kuriers')
      .whereRaw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.shipmentNumber')) = ?", [shipmentId])
      .first();

    if (localOrder) {
      const notes = JSON.parse(localOrder.notes || '{}');
      
      // Zaktualizuj status śledzenia
      notes.dhl.trackingStatus = trackingResult.status;
      notes.dhl.trackingEvents = trackingResult.events;
      notes.dhl.lastTracked = new Date().toISOString();
      notes.dhl.lastTrackedBy = userId;
      
      // Zaktualizuj główny status na podstawie statusu DHL
      let newStatus = localOrder.status;
      if (trackingResult.status === 'DELIVERED') {
        newStatus = 'delivered';
      } else if (trackingResult.status === 'IN_TRANSIT') {
        newStatus = 'sent';
      }
      
      await db('kuriers')
        .where('id', localOrder.id)
        .update({
          status: newStatus,
          notes: JSON.stringify(notes)
        });
      
      console.log(`Updated local order ${localOrder.id} status to ${newStatus}`);
    }
  } catch (error) {
    console.warn(`Failed to update local order status for shipment ${shipmentId}:`, error);
  }
}
