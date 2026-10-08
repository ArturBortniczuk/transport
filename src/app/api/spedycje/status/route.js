// src/app/api/spedycje/status/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const canChangeStatus =
      user.isAdmin ||
      user.permissions?.spedycja?.respond === true ||
      user.permissions?.spedycja?.cmr === true;

    if (!canChangeStatus) {
      return NextResponse.json({
        success: false,
        error: 'Brak uprawnień do zmiany statusu zlecenia'
      }, { status: 403 });
    }

    const { id, status, updateConnected = true } = await request.json();

    if (!id || !status) {
      return NextResponse.json({
        success: false,
        error: 'Brak wymaganych parametrów (id, status)'
      }, { status: 400 });
    }

    const validStatuses = ['new', 'responded', 'in_transit', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Nieprawidłowy status'
      }, { status: 400 });
    }

    const spedycja = await db('spedycje').where('id', id).first();
    if (!spedycja) {
      return NextResponse.json({
        success: false,
        error: 'Nie znaleziono zlecenia spedycji o podanym ID'
      }, { status: 404 });
    }

    // Aktualizujemy status głównego zlecenia
    await db('spedycje')
      .where('id', id)
      .update({ status });

    // Jeśli zlecenie ma połączone transporty i updateConnected jest włączone,
    // zaktualizuj także połączone transporty
    if (updateConnected && spedycja.response_data) {
      try {
        const resp = typeof spedycja.response_data === 'string'
          ? JSON.parse(spedycja.response_data)
          : spedycja.response_data;

        if (resp?.connectedTransports && Array.isArray(resp.connectedTransports)) {
          for (const ct of resp.connectedTransports) {
            if (ct.id) {
              await db('spedycje')
                .where('id', ct.id)
                .whereNot('status', 'completed')
                .update({ status });
            }
          }
        }
      } catch (err) {
        console.error('Błąd aktualizacji statusu połączonych zleceń:', err);
      }
    }

    console.log(`Pomyślnie zaktualizowano status zlecenia ID ${id} na '${status}'`);

    return NextResponse.json({
      success: true,
      message: `Status zlecenia został zaktualizowany na '${status}'`
    });
  } catch (error) {
    console.error('Błąd zmiany statusu zlecenia spedycji:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
