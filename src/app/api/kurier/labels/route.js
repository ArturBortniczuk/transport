// PLIK: src/app/api/kurier/labels/route.js
// Poprawiony kod - używa dhl_shipment_id zamiast id

// src/app/api/kurier/labels/route.js
// 🏷️ MEGA LABELS API - Generowanie etykiet DHL (PDF, ZPL, QR)
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

// POST - Generuj etykiety dla przesyłek
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

    const { shipmentIds, labelTypes, options } = await request.json();
    
    console.log('🏷️ Generowanie etykiet DHL:', { shipmentIds, labelTypes, options });

    // Walidacja
    if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące numery przesyłek' 
      }, { status: 400 });
    }

    if (!labelTypes || !Array.isArray(labelTypes) || labelTypes.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące typy etykiet' 
      }, { status: 400 });
    }

    // Sprawdź czy użytkownik ma uprawnienia do tych przesyłek
    const { default: db } = await import('@/database/db');
    
    // POPRAWKA: Sprawdź czy shipmentIds to numery DHL czy ID zamówień
    let userShipments = [];
    
    // Sprawdź czy pierwsze ID wygląda jak numer DHL (długi string) czy ID bazy (integer)
    const firstId = shipmentIds[0];
    const isDhlNumber = isNaN(parseInt(firstId)) || firstId.toString().length > 10;
    
    if (isDhlNumber) {
      // To są numery DHL - szukaj po dhl_shipment_id lub w notes
      console.log('🔍 Szukam po numerach DHL:', shipmentIds);
      
      userShipments = await db('kuriers')
        .where(function() {
          // Jeśli mamy kolumnę dhl_shipment_id
          this.whereIn('dhl_shipment_id', shipmentIds)
          // LUB szukaj w notes (dla starych rekordów)
          shipmentIds.forEach(shipmentId => {
            this.orWhereRaw(`JSON_EXTRACT(notes, '$.dhl.shipmentNumber') = ?`, [shipmentId]);
          });
        })
        .where(function() {
          this.where('created_by_email', userId)
              .orWhereExists(function() {
                // Admin może pobierać wszystkie
                this.select('*')
                    .from('users')
                    .where('email', userId)
                    .where('is_admin', true);
              });
        })
        .select('id', 'notes', 'dhl_shipment_id');
        
    } else {
      // To są ID zamówień z bazy - szukaj po id
      console.log('🔍 Szukam po ID zamówień:', shipmentIds);
      
      userShipments = await db('kuriers')
        .whereIn('id', shipmentIds.map(id => parseInt(id)))
        .where(function() {
          this.where('created_by_email', userId)
              .orWhereExists(function() {
                // Admin może pobierać wszystkie
                this.select('*')
                    .from('users')
                    .where('email', userId)
                    .where('is_admin', true);
              });
        })
        .select('id', 'notes', 'dhl_shipment_id');
    }

    if (userShipments.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do tych przesyłek lub nie znaleziono przesyłek' 
      }, { status: 403 });
    }

    // Przygotuj żądania etykiet dla DHL
    const labelRequests = [];
    
    for (const shipment of userShipments) {
      let dhlShipmentNumber = null;
      
      // Sprawdź czy mamy dhl_shipment_id
      if (shipment.dhl_shipment_id) {
        dhlShipmentNumber = shipment.dhl_shipment_id;
      } else {
        // Fallback do notes
        let notes = {};
        try {
          notes = JSON.parse(shipment.notes || '{}');
        } catch (e) {
          console.warn(`Nie można parsować notes dla zamówienia ${shipment.id}`);
          continue;
        }
        dhlShipmentNumber = notes.dhl?.shipmentNumber;
      }

      if (!dhlShipmentNumber) {
        console.warn(`Brak numeru DHL dla zamówienia ${shipment.id}`);
        continue;
      }

      // Dodaj żądania dla wszystkich typów etykiet
      for (const labelType of labelTypes) {
        labelRequests.push({
          shipmentId: dhlShipmentNumber,
          labelType: labelType,
          originalOrderId: shipment.id
        });
      }
    }

    if (labelRequests.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak przesyłek z numerami DHL do pobrania etykiet' 
      }, { status: 400 });
    }

    // Wywołaj DHL API
    const labelsResult = await DHLApiService.getLabels(labelRequests);
    
    if (labelsResult.success) {
      // Przetwórz wyniki
      const processedLabels = labelsResult.labels.map(label => {
        const originalRequest = labelRequests.find(req => req.shipmentId === label.shipmentId);
        
        return {
          ...label,
          originalOrderId: originalRequest?.originalOrderId,
          downloadUrl: `/api/kurier/labels/download/${label.shipmentId}/${label.labelType}`,
          size: calculateLabelSize(label.labelData),
          createdAt: new Date().toISOString(),
          createdBy: userId
        };
      });

      // Zapisz historię generowania etykiet
      await saveLabelGenerationHistory(labelRequests, processedLabels, userId);

      return NextResponse.json({ 
        success: true,
        message: `Wygenerowano ${processedLabels.length} etykiet`,
        labels: processedLabels,
        stats: {
          requested: labelRequests.length,
          generated: processedLabels.length,
          shipments: [...new Set(labelRequests.map(req => req.shipmentId))].length
        }
      });
      
    } else {
      console.error('💥 Błąd generowania etykiet:', labelsResult.error);
      return NextResponse.json({ 
        success: false, 
        error: labelsResult.error || 'Nie udało się wygenerować etykiet' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('💥 Błąd w Labels API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// Helper functions
function calculateLabelSize(labelData) {
  try {
    if (!labelData) return 0;
    // Jeśli to base64, oblicz rozmiar
    if (typeof labelData === 'string') {
      return Math.round(labelData.length * 0.75); // base64 to bytes approximation
    }
    return labelData.length || 0;
  } catch (error) {
    return 0;
  }
}

async function saveLabelGenerationHistory(labelRequests, processedLabels, userId) {
  try {
    const { default: db } = await import('@/database/db');
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('kurier_label_history');
    
    if (tableExists) {
      for (const label of processedLabels) {
        await db('kurier_label_history').insert({
          shipment_id: label.shipmentId,
          label_type: label.labelType,
          generated_by: userId,
          file_size: label.size,
          notes: JSON.stringify({
            generatedAt: label.createdAt,
            originalOrderId: label.originalOrderId
          })
        });
      }
    }
  } catch (error) {
    console.error('Błąd zapisywania historii etykiet:', error);
    // Nie przerywaj procesu
  }
}
