// src/app/api/wz/assign/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const body = await request.json();
    const { action, wzNumbers = [], wzIds = [] } = body;

    // Pobierz dokumenty WZ na podstawie podanych numerów lub ID
    let wzDocs = [];
    if (wzNumbers.length > 0) {
      wzDocs = await db('wz_documents').whereIn('nr_wz', wzNumbers);
    } else if (wzIds.length > 0) {
      wzDocs = await db('wz_documents').whereIn('id', wzIds);
    }

    if (wzDocs.length === 0) {
      return NextResponse.json({ success: false, error: 'Nie wybrano żadnych dokumentów WZ' }, { status: 400 });
    }

    const targetWzNumbers = wzDocs.map(d => d.nr_wz);

    // 1. Opcja: Odpięcie od transportu
    if (action === 'unlink') {
      await db('wz_documents')
        .whereIn('nr_wz', targetWzNumbers)
        .update({
          transport_id: null,
          spedycja_id: null,
          status: 'nowy',
          updated_at: db.fn.now()
        });

      return NextResponse.json({
        success: true,
        message: `Odpięto ${targetWzNumbers.length} dokumentów WZ.`
      });
    }

    // 2. Opcja: Przypisanie do istniejącego transportu
    if (action === 'link_existing') {
      const { transportId } = body;
      if (!transportId) {
        return NextResponse.json({ success: false, error: 'Nie podano ID transportu' }, { status: 400 });
      }

      const transport = await db('transports').where('id', transportId).first();
      if (!transport) {
        return NextResponse.json({ success: false, error: 'Nie znaleziono wybranego transportu' }, { status: 404 });
      }

      // Aktualizacja WZ
      await db('wz_documents')
        .whereIn('nr_wz', targetWzNumbers)
        .update({
          transport_id: transportId,
          status: 'przypisany',
          updated_at: db.fn.now()
        });

      // Uzupełnienie wz_number w transporcie
      const existingWzStr = transport.wz_number || '';
      const existingList = existingWzStr.split(',').map(s => s.trim()).filter(Boolean);
      const combined = [...new Set([...existingList, ...targetWzNumbers])].join(', ');

      await db('transports').where('id', transportId).update({
        wz_number: combined
      });

      return NextResponse.json({
        success: true,
        message: `Przypisano ${targetWzNumbers.length} dokumentów WZ do transportu #${transportId}.`
      });
    }

    // 3. Opcja: Utworzenie nowego transportu własnego z wybranych WZ
    if (action === 'create_transport') {
      const {
        source_warehouse,
        destination_city,
        postal_code,
        street,
        driver_id,
        vehicle_id,
        delivery_date,
        loading_level = '50%',
        notes = '',
        market = 'Podlaski',
        mpk = ''
      } = body;

      // Pobieramy pozycje towarowe dla wybranych dokumentów
      const items = await db('wz_items').whereIn('nr_wz', targetWzNumbers);

      // Generujemy zwięzły opis ładunku
      let goodsSummary = '';
      if (body.goods_description) {
        goodsSummary = body.goods_description;
      } else {
        const itemLines = items.slice(0, 15).map(it => `- ${it.nazwa_towaru}: ${it.ilosc} ${it.jednostka_miary}`);
        if (items.length > 15) {
          itemLines.push(`... oraz ${items.length - 15} innych pozycji`);
        }
        goodsSummary = `Dokumenty WZ (${targetWzNumbers.join(', ')}):\n` + itemLines.join('\n');
      }

      // Wyliczanie domyślnego klienta i adresu z pierwszego WZ jeśli nie podano
      const firstDoc = wzDocs[0];
      const clientName = body.client_name || firstDoc.nazwa_kontrahenta || 'Klient z WZ';
      const city = destination_city || firstDoc.extracted_city || 'Białystok';
      const postCode = postal_code || firstDoc.extracted_postal_code || '';
      const strt = street || firstDoc.extracted_street || firstDoc.adres_dostawy || '';

      // Normalizacja magazynu do standardu bazy (bialystok / zielonka)
      const rawSrc = String(source_warehouse || (firstDoc.symbol_magazynu?.includes('WAH') ? 'zielonka' : 'bialystok')).toLowerCase();
      const srcWarehouse = rawSrc.includes('zielon') ? 'zielonka' : 'bialystok';

      // Koordynaty
      const lat = firstDoc.latitude ? parseFloat(firstDoc.latitude) : null;
      const lng = firstDoc.longitude ? parseFloat(firstDoc.longitude) : null;

      // Wyliczanie odległości jeśli mamy koordynaty
      let calculatedDistance = null;
      if (lat && lng) {
        const whCoords = srcWarehouse === 'zielonka'
          ? { lat: 52.3125, lng: 21.1390 }
          : { lat: 53.1325, lng: 23.1688 };
        const R = 6371;
        const dLat = (lat - whCoords.lat) * Math.PI / 180;
        const dLon = (lng - whCoords.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(whCoords.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        calculatedDistance = Math.round(R * c * 1.25);
      }

      // Bezpieczne parsowanie daty dostawy w południe (zapobiega przesunięciu dnia przez strefy czasowe)
      let parsedDate = new Date();
      if (delivery_date) {
        const dateStr = String(delivery_date).split('T')[0];
        parsedDate = new Date(`${dateStr}T12:00:00`);
      }

      const transportRecord = {
        source_warehouse: srcWarehouse,
        destination_city: city,
        postal_code: postCode,
        street: strt,
        latitude: lat,
        longitude: lng,
        distance: calculatedDistance,
        driver_id: driver_id ? parseInt(driver_id, 10) : null,
        vehicle_id: vehicle_id ? parseInt(vehicle_id, 10) : null,
        status: 'active',
        wz_number: targetWzNumbers.join(', '),
        client_name: clientName,
        market: market || 'Podlaski',
        loading_level: loading_level || '50%',
        notes: notes ? `${notes}\n\nUwagi z WZ: ${firstDoc.uwagi || ''}` : firstDoc.uwagi || '',
        delivery_date: parsedDate,
        requester_name: session.user.name || 'Koordynator',
        requester_email: session.user.email || '',
        mpk: mpk || session.user.mpk || '',
        goods_description: goodsSummary
      };

      const [newTransport] = await db('transports')
        .insert(transportRecord)
        .returning('id');

      const transportId = typeof newTransport === 'object' ? newTransport.id : newTransport;

      // Powiązanie WZ z nowym transportem
      await db('wz_documents')
        .whereIn('nr_wz', targetWzNumbers)
        .update({
          transport_id: transportId,
          status: 'przypisany',
          updated_at: db.fn.now()
        });

      return NextResponse.json({
        success: true,
        message: `Utworzono transport #${transportId} i przypisano ${targetWzNumbers.length} WZ.`,
        transportId
      });
    }

    return NextResponse.json({ success: false, error: 'Nieobsługiwana akcja' }, { status: 400 });
  } catch (error) {
    console.error('Błąd w przypisywaniu WZ:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
