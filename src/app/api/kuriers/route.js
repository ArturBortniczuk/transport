import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const canView = user.isAdmin || user.permissions?.courier?.view !== false;

    if (!canView) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień do przeglądania przesyłek kurierskich' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = db('kuriers').select('*').orderBy('created_at', 'desc');

    if (status && status !== 'all') {
      query = query.where('status', status);
    }

    const rows = await query;

    // Przekształć dane z bazy w format zgodny z komponentami UI
    const orders = rows.map(row => {
      let extraData = {};
      if (row.order_data) {
        try {
          extraData = JSON.parse(row.order_data);
        } catch (e) {
          console.error('Błąd parsowania order_data dla kuriera ID:', row.id, e);
        }
      }

      return {
        ...extraData,
        id: row.id,
        status: row.status || 'oczekujące',
        dataDodania: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        created_at: row.created_at,
        completed_at: row.completed_at,
        completed_by: row.completed_by,
        created_by_email: row.created_by_email || extraData.nadawcaEmail || userId,
        odbiorcaNazwa: row.recipient_name || extraData.odbiorcaNazwa || '',
        odbiorcaMiasto: row.recipient_city || extraData.odbiorcaMiasto || '',
        zawartoscPrzesylki: row.package_description || extraData.zawartoscPrzesylki || '',
        uwagi: row.notes || extraData.uwagi || ''
      };
    });

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error('Błąd pobierania zamówień kuriera:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const canAdd = user.isAdmin || user.permissions?.courier?.add === true;

    if (!canAdd) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień do zamawiania kuriera' }, { status: 403 });
    }

    const orderData = await request.json();

    const recipientName = orderData.odbiorcaNazwa || orderData.recipient_name || '';
    const recipientAddress = orderData.odbiorcaUlica
      ? `${orderData.odbiorcaUlica} ${orderData.odbiorcaNumerDomu || ''} ${orderData.odbiorcaKodPocztowy || ''} ${orderData.odbiorcaMiasto || ''}`.trim()
      : (orderData.recipient_address || '');
    const recipientCity = orderData.odbiorcaMiasto || '';
    const recipientPhone = orderData.odbiorcaTelefon || orderData.recipient_phone || '';
    const packageDesc = orderData.zawartoscPrzesylki || orderData.package_description || '';
    const notes = orderData.uwagi || orderData.notes || '';
    const status = orderData.status || 'oczekujące';

    const [inserted] = await db('kuriers')
      .insert({
        status: status,
        created_by_email: user.email,
        recipient_name: recipientName,
        recipient_address: recipientAddress,
        recipient_city: recipientCity,
        recipient_phone: recipientPhone,
        package_description: packageDesc,
        notes: notes,
        order_data: JSON.stringify(orderData),
        created_at: db.fn.now()
      })
      .returning(['id', 'status', 'created_at']);

    const newId = inserted?.id || inserted;

    return NextResponse.json({
      success: true,
      order: {
        ...orderData,
        id: newId,
        status: status,
        dataDodania: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Błąd tworzenia zamówienia kuriera:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const canManage = user.isAdmin || user.permissions?.courier?.add === true;

    if (!canManage) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień do aktualizacji zamówienia kuriera' }, { status: 403 });
    }

    const { id, status } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Brak ID zamówienia' }, { status: 400 });
    }

    const updateData = { status: status };
    if (status === 'zatwierdzone' || status === 'zrealizowane') {
      updateData.completed_at = db.fn.now();
      updateData.completed_by = user.email;
    }

    await db('kuriers')
      .where('id', id)
      .update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Błąd aktualizacji zamówienia kuriera:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getSessionUser(request);

    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const canDelete = user.isAdmin || user.permissions?.archive?.delete === true;

    if (!canDelete) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień do usuwania zamówienia kuriera' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Brak ID zamówienia' }, { status: 400 });
    }

    await db('kuriers')
      .where('id', id)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Błąd usuwania zamówienia kuriera:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
