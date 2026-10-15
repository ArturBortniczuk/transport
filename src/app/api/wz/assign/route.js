// src/app/api/wz/assign/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';
import { mapErpRynekToTransportMarket, calculateWarehouseToDestinationDistance } from '@/lib/distance-helper';
import { getNextSpedycjaOrderNumber } from '@/lib/utils/orderNumber';

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

      // Koordynaty i odległość
      let finalLat = firstDoc.latitude ? parseFloat(firstDoc.latitude) : null;
      let finalLng = firstDoc.longitude ? parseFloat(firstDoc.longitude) : null;
      let finalDistance = (body.distance !== undefined && body.distance !== null && body.distance !== '')
        ? parseInt(body.distance, 10)
        : null;

      // Zawsze przeliczamy odległość jeśli brak odległości lub brak koordynatów
      if (finalDistance === null || !finalLat || !finalLng) {
        try {
          const calcRes = await calculateWarehouseToDestinationDistance({
            sourceWarehouse: srcWarehouse,
            city,
            postalCode: postCode,
            street: strt,
            lat: finalLat,
            lng: finalLng
          });
          if (calcRes.distanceKm && finalDistance === null) {
            finalDistance = calcRes.distanceKm;
          }
          if (calcRes.coords) {
            finalLat = calcRes.coords.lat;
            finalLng = calcRes.coords.lng;
            // Aktualizacja współrzędnych w wz_documents na przyszłość
            await db('wz_documents')
              .whereIn('nr_wz', targetWzNumbers)
              .whereNull('latitude')
              .update({
                latitude: finalLat,
                longitude: finalLng
              });
          }
        } catch (calcErr) {
          console.warn('Nie udało się wyznaczyć odległości drogowo:', calcErr.message);
        }
      }

      // Mapowanie rynku z ERP do standardu kalendarza transportów (np. BIH -> Podlaski)
      const targetMarket = mapErpRynekToTransportMarket(market || firstDoc.rynek, srcWarehouse);

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
        latitude: finalLat,
        longitude: finalLng,
        distance: finalDistance,
        distance_km: finalDistance,
        driver_id: driver_id ? parseInt(driver_id, 10) : null,
        vehicle_id: vehicle_id ? parseInt(vehicle_id, 10) : null,
        status: 'active',
        wz_number: targetWzNumbers.join(', '),
        client_name: clientName,
        market: targetMarket,
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

    // 4. Opcja: Utworzenie nowego zlecenia spedycyjnego z wybranych dokumentów WZ
    if (action === 'create_spedycja') {
      const {
        location = 'Magazyn Białystok',
        deliveryDate,
        clientName,
        destination_city,
        street,
        postal_code,
        distance,
        notes,
        goods_description,
        mpk,
        loadingContact,
        unloadingContact
      } = body;

      const firstDoc = wzDocs[0];
      const currentDate = new Date();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const year = currentDate.getFullYear();

      // Wygeneruj unikalny numer zlecenia spedycyjnego (np. 0124/10/2026)
      const { formattedOrderNumber } = await getNextSpedycjaOrderNumber(db, month, year);

      // Dane adresowe magazynu załadunku
      const isZielonka = location.toLowerCase().includes('zielonka');
      const producerAddress = {
        firma: 'Grupa Eltron Sp. z o.o.',
        ulica: isZielonka ? 'ul. Krótka 2' : 'ul. Wysockiego 69B',
        kod: isZielonka ? '05-220' : '15-169',
        miasto: isZielonka ? 'Zielonka' : 'Białystok'
      };

      const city = destination_city || firstDoc.extracted_city || '';
      const postCode = postal_code || firstDoc.kod_pocztowy_dostawy || firstDoc.extracted_postal_code || '';
      const strt = street || firstDoc.extracted_street || firstDoc.adres_dostawy || '';

      const deliveryAddress = {
        city,
        postalCode: postCode,
        street: strt,
        country: 'Polska'
      };

      // Bezpieczne parsowanie daty dostawy w południe
      let parsedDate = new Date();
      if (deliveryDate) {
        const dateStr = String(deliveryDate).split('T')[0];
        parsedDate = new Date(`${dateStr}T12:00:00`);
      }

      // Lista numerów WZ i powiązanych WZO
      const allWzo = wzDocs.map(d => d.dokumenty_powiazane).filter(Boolean);
      const combinedDocs = [...new Set([...targetWzNumbers, ...allWzo.flatMap(w => w.split(',').map(s => s.trim()))])];

      let finalDistance = distance ? parseInt(distance, 10) : 0;
      if (!finalDistance && (city || postCode)) {
        try {
          const originWh = isZielonka ? 'zielonka' : 'bialystok';
          const calcRes = await calculateWarehouseToDestinationDistance(originWh, strt, postCode, city);
          if (calcRes?.distanceKm) {
            finalDistance = calcRes.distanceKm;
          }
        } catch (calcErr) {
          console.warn('Nie udało się wyznaczyć odległości drogowo dla spedycji:', calcErr.message);
        }
      }

      const spedycjaRecord = {
        status: 'new',
        order_number: formattedOrderNumber,
        created_by: session.user.name || session.user.email.split('@')[0],
        created_by_email: session.user.email,
        responsible_person: session.user.name || session.user.email.split('@')[0],
        responsible_email: session.user.email,
        mpk: mpk || session.user.mpk || '',
        location: location,
        location_data: JSON.stringify(producerAddress),
        delivery_data: JSON.stringify(deliveryAddress),
        delivery_date: parsedDate,
        documents: combinedDocs.join(', '),
        notes: notes ? `${notes}\n\nUwagi z WZ:\n${firstDoc.uwagi || ''}` : firstDoc.uwagi || '',
        distance_km: finalDistance,
        client_name: clientName || firstDoc.nazwa_kontrahenta || '',
        source_client_name: 'Grupa Eltron Sp. z o.o.',
        goods_description: goods_description ? (typeof goods_description === 'string' ? goods_description : JSON.stringify(goods_description)) : null,
        loading_contact: loadingContact || '',
        unloading_contact: unloadingContact || firstDoc.extracted_phone || '',
        created_at: db.fn.now()
      };

      const [newSpedycja] = await db('spedycje')
        .insert(spedycjaRecord)
        .returning('id');

      const spedycjaId = typeof newSpedycja === 'object' ? newSpedycja.id : newSpedycja;

      // Powiązanie WZ ze zleceniem spedycyjnym
      await db('wz_documents')
        .whereIn('nr_wz', targetWzNumbers)
        .update({
          spedycja_id: spedycjaId,
          status: 'przypisany',
          updated_at: db.fn.now()
        });

      return NextResponse.json({
        success: true,
        message: `Utworzono zlecenie spedycyjne #${spedycjaId} (${formattedOrderNumber}) i przypisano ${targetWzNumbers.length} WZ.`,
        spedycjaId,
        orderNumber: formattedOrderNumber
      });
    }

    // 5. Opcja: Przypisanie do istniejącego zlecenia spedycyjnego
    if (action === 'link_existing_spedycja') {
      const { spedycjaId } = body;
      if (!spedycjaId) {
        return NextResponse.json({ success: false, error: 'Nie podano ID zlecenia spedycji' }, { status: 400 });
      }

      const spedycja = await db('spedycje').where('id', spedycjaId).first();
      if (!spedycja) {
        return NextResponse.json({ success: false, error: 'Nie znaleziono zlecenia spedycji' }, { status: 404 });
      }

      const currentDocs = spedycja.documents ? spedycja.documents.split(',').map(s => s.trim()).filter(Boolean) : [];
      const updatedDocs = [...new Set([...currentDocs, ...targetWzNumbers])].join(', ');

      await db('spedycje')
        .where('id', spedycjaId)
        .update({
          documents: updatedDocs
        });

      await db('wz_documents')
        .whereIn('nr_wz', targetWzNumbers)
        .update({
          spedycja_id: spedycjaId,
          status: 'przypisany',
          updated_at: db.fn.now()
        });

      return NextResponse.json({
        success: true,
        message: `Przypisano ${targetWzNumbers.length} dokumentów WZ do zlecenia spedycyjnego #${spedycjaId}.`
      });
    }

    return NextResponse.json({ success: false, error: 'Nieobsługiwana akcja' }, { status: 400 });
  } catch (error) {
    console.error('Błąd w przypisywaniu WZ:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
