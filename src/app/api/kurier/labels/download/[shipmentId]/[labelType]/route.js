// src/app/api/kurier/labels/download/[shipmentId]/[labelType]/route.js
// 📥 DOWNLOAD API - Pobieranie etykiet DHL jako pliki
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

// GET - Pobierz plik etykiety
export async function GET(request, { params }) {
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

    const { shipmentId, labelType } = params;
    
    console.log('📥 Pobieranie etykiety:', { shipmentId, labelType, userId });

    // Walidacja parametrów
    if (!shipmentId || !labelType) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące parametry' 
      }, { status: 400 });
    }

    // Sprawdź czy użytkownik ma uprawnienia do tej przesyłki
    const { default: db } = await import('@/database/db');
    
    const shipment = await db('kuriers')
      .whereRaw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.shipmentNumber')) = ?", [shipmentId])
      .where(function() {
        this.where('created_by_email', userId)
            .orWhere(function() {
              // Admin może pobierać wszystkie
              this.whereExists(function() {
                this.select('*')
                    .from('users')
                    .where('email', userId)
                    .where('is_admin', true);
              });
            });
      })
      .first();

    if (!shipment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do tej przesyłki' 
      }, { status: 403 });
    }

    // Wywołaj DHL API do pobrania etykiety
    const labelResult = await DHLApiService.getLabels([{
      shipmentId: shipmentId,
      labelType: labelType
    }]);
    
    if (!labelResult.success || !labelResult.labels || labelResult.labels.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie udało się pobrać etykiety z DHL' 
      }, { status: 500 });
    }

    const label = labelResult.labels[0];
    
    if (!label.labelData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak danych etykiety' 
      }, { status: 500 });
    }

    // Konwersja Base64 do Buffer
    const labelBuffer = Buffer.from(label.labelData, 'base64');
    
    // Określ typ MIME i rozszerzenie pliku
    const mimeType = label.labelMimeType || getMimeTypeForLabelType(labelType);
    const fileExtension = getFileExtensionForLabelType(labelType);
    const fileName = `DHL_${shipmentId}_${labelType}.${fileExtension}`;
    
    // Zapisz informację o pobraniu w historii
    await saveDownloadHistory(shipmentId, labelType, userId, labelBuffer.length);
    
    // Zwróć plik
    return new NextResponse(labelBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': labelBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache na 1h
        'X-Label-Info': JSON.stringify({
          shipmentId: shipmentId,
          labelType: labelType,
          generatedAt: new Date().toISOString(),
          size: labelBuffer.length
        })
      }
    });
    
  } catch (error) {
    console.error('💥 Błąd pobierania etykiety:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// POST - Pobierz wiele etykiet jako ZIP
export async function POST(request, { params }) {
  try {
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { shipmentIds, labelTypes } = await request.json();
    
    console.log('📥 Pobieranie wielu etykiet jako ZIP:', { shipmentIds, labelTypes });

    // Walidacja
    if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brakujące numery przesyłek' 
      }, { status: 400 });
    }

    // Sprawdź uprawnienia do wszystkich przesyłek
    const { default: db } = await import('@/database/db');
    
    const userShipments = await db('kuriers')
      .whereIn(function() {
        this.select(db.raw("JSON_UNQUOTE(JSON_EXTRACT(notes, '$.dhl.shipmentNumber'))"));
      }, shipmentIds)
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
      .select('notes');

    if (userShipments.length !== shipmentIds.length) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do niektórych przesyłek' 
      }, { status: 403 });
    }

    // Dynamiczny import modułu ZIP (w przypadku gdy nie jest dostępny)
    let JSZip;
    try {
      JSZip = (await import('jszip')).default;
    } catch (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Funkcja ZIP nie jest dostępna' 
      }, { status: 501 });
    }

    // Przygotuj żądania etykiet
    const labelRequests = [];
    for (const shipmentId of shipmentIds) {
      for (const labelType of (labelTypes || ['BLP'])) {
        labelRequests.push({
          shipmentId: shipmentId,
          labelType: labelType
        });
      }
    }

    // Pobierz wszystkie etykiety
    const labelsResult = await DHLApiService.getLabels(labelRequests);
    
    if (!labelsResult.success || !labelsResult.labels) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nie udało się pobrać etykiet z DHL' 
      }, { status: 500 });
    }

    // Utwórz ZIP
    const zip = new JSZip();
    
    for (const label of labelsResult.labels) {
      if (label.labelData) {
        const fileExtension = getFileExtensionForLabelType(label.labelType);
        const fileName = `${label.shipmentId}_${label.labelType}.${fileExtension}`;
        
        zip.file(fileName, label.labelData, { base64: true });
      }
    }

    // Generuj ZIP
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipFileName = `DHL_Labels_${new Date().toISOString().split('T')[0]}.zip`;
    
    // Zapisz informację o pobraniu
    await saveDownloadHistory(shipmentIds.join(','), 'ZIP', userId, zipBuffer.length);
    
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'X-Archive-Info': JSON.stringify({
          shipmentIds: shipmentIds,
          labelTypes: labelTypes,
          fileCount: labelsResult.labels.length,
          generatedAt: new Date().toISOString()
        })
      }
    });
    
  } catch (error) {
    console.error('💥 Błąd tworzenia archiwum ZIP:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message 
    }, { status: 500 });
  }
}

// Helper functions
function getMimeTypeForLabelType(labelType) {
  const mimeTypes = {
    'LP': 'application/pdf',
    'BLP': 'application/pdf',
    'LBLP': 'application/pdf',
    'ZBLP': 'text/plain',
    'ZBLP300': 'text/plain',
    'QR_PDF': 'application/pdf',
    'QR2_IMG': 'image/png',
    'QR4_IMG': 'image/png',
    'QR6_IMG': 'image/png'
  };
  
  return mimeTypes[labelType] || 'application/octet-stream';
}

function getFileExtensionForLabelType(labelType) {
  const extensions = {
    'LP': 'pdf',
    'BLP': 'pdf',
    'LBLP': 'pdf',
    'ZBLP': 'zpl',
    'ZBLP300': 'zpl',
    'QR_PDF': 'pdf',
    'QR2_IMG': 'png',
    'QR4_IMG': 'png',
    'QR6_IMG': 'png'
  };
  
  return extensions[labelType] || 'bin';
}

async function saveDownloadHistory(shipmentId, labelType, userId, fileSize) {
  try {
    const { default: db } = await import('@/database/db');
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('kurier_label_downloads');
    
    if (tableExists) {
      await db('kurier_label_downloads').insert({
        shipment_id: shipmentId,
        label_type: labelType,
        downloaded_by: userId,
        file_size: fileSize,
        notes: JSON.stringify({
          downloadedAt: new Date().toISOString(),
          userAgent: 'DHL_API_Download'
        })
      });
    }
  } catch (error) {
    console.error('Błąd zapisywania historii pobrania:', error);
    // Nie przerywaj procesu
  }
}
