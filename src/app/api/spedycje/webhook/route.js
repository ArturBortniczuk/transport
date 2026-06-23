import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request) {
  try {
    // Prosta autoryzacja po kluczu API (Bearer token)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.OPAKOWANIA_WEBHOOK_SECRET || 'eltron-opakowania-integration-secret-key-2026';
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized webhook access'
      }, { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const spedycjaData = await request.json();

    const currentDate = new Date();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear();

    const lastOrderQuery = await db('spedycje')
      .whereRaw('EXTRACT(MONTH FROM created_at) = ?', [month])
      .whereRaw('EXTRACT(YEAR FROM created_at) = ?', [year])
      .orderBy('id', 'desc')
      .first();

    let orderNumber = 1;
    if (lastOrderQuery && lastOrderQuery.order_number) {
      const lastOrderMatch = lastOrderQuery.order_number.match(/^(\d+)\/\d+\/\d+$/);
      if (lastOrderMatch) {
        orderNumber = parseInt(lastOrderMatch[1], 10) + 1;
      }
    }

    const formattedOrderNumber = `${orderNumber.toString().padStart(4, '0')}/${month}/${year}`;

    let goodsDescriptionJson = null;
    if (spedycjaData.goodsDescription) {
      goodsDescriptionJson = JSON.stringify(spedycjaData.goodsDescription);
    }

    const dataToSave = {
      status: 'new',
      order_number: formattedOrderNumber,
      created_by: spedycjaData.createdBy || 'System Opakowania',
      created_by_email: spedycjaData.createdByEmail || 'system@grupaeltron.pl',
      responsible_person: spedycjaData.responsiblePerson || 'System Opakowania',
      responsible_email: spedycjaData.responsibleEmail || 'system@grupaeltron.pl',
      mpk: spedycjaData.mpk || '',
      location: spedycjaData.location || 'Odbiory własne',
      location_data: spedycjaData.producerAddress ? JSON.stringify(spedycjaData.producerAddress) : null,
      delivery_data: spedycjaData.delivery ? JSON.stringify(spedycjaData.delivery) : null,
      loading_contact: spedycjaData.loadingContact || '',
      unloading_contact: spedycjaData.unloadingContact || '',
      delivery_date: spedycjaData.deliveryDate || currentDate.toISOString(),
      documents: spedycjaData.documents || '',
      notes: spedycjaData.notes || '',
      distance_km: spedycjaData.distanceKm || 0,
      client_name: spedycjaData.clientName || '',
      source_client_name: spedycjaData.sourceClientName || '',
      goods_description: goodsDescriptionJson,
      created_at: db.fn.now()
    };

    console.log('Webhook - Dane do zapisania w bazie:', dataToSave);

    const result = await db('spedycje').insert(dataToSave).returning('id');
    const id = result[0]?.id;

    return NextResponse.json({
      success: true,
      id: id,
      orderNumber: formattedOrderNumber
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('Webhook - Error creating spedycja:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
