import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function GET(request) {
    try {
        // Sprawdź autoryzację admina - opcjonalnie, można pobrać token z cookies
        // Dla uproszczenia (zależnie od aktualnej implementacji autoryzacji), zakładam, że zabezpieczenie odbywa się na warstwie UI lub middleware.

        // Jeśli używasz next-auth lub JWT z cookies, należy to dodać.

        const settings = await db('valuation_settings').select('*').orderBy('id', 'asc');

        return NextResponse.json(settings);
    } catch (error) {
        console.error('API /api/admin/valuation-settings GET error:', error);
        return NextResponse.json({ error: 'Wystąpił błąd podczas pobierania ustawień wyceny' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const data = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Oczekiwano tablicy z ustawieniami' }, { status: 400 });
        }

        // Aktualizuj każde ustawienie (można to zrobić w transakcji)
        await db.transaction(async trx => {
            for (const item of data) {
                if (item.key && item.value !== undefined) {
                    await trx('valuation_settings')
                        .where({ key: item.key })
                        .update({
                            value: item.value.toString(),
                            updated_at: db.fn.now()
                        });
                }
            }
        });

        return NextResponse.json({ success: true, message: 'Ustawienia zaktualizowane pomyślnie' });
    } catch (error) {
        console.error('API /api/admin/valuation-settings PUT error:', error);
        return NextResponse.json({ error: 'Wystąpił błąd podczas zapisywania ustawień wyceny' }, { status: 500 });
    }
}
