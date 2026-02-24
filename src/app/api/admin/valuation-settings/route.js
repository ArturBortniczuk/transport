import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function GET(request) {
    try {
        // Sprawdź autoryzację admina - opcjonalnie, można pobrać token z cookies
        // Dla uproszczenia (zależnie od aktualnej implementacji autoryzacji), zakładam, że zabezpieczenie odbywa się na warstwie UI lub middleware.

        // Jeśli używasz next-auth lub JWT z cookies, należy to dodać.

        let settings;
        try {
            settings = await db('valuation_settings').select('*').orderBy('id', 'asc');
        } catch (e) {
            if (e.message && e.message.includes('relation "valuation_settings" does not exist')) {
                await db.schema.createTable('valuation_settings', table => {
                    table.increments('id').primary();
                    table.string('key').unique().notNullable();
                    table.string('name').notNullable();
                    table.string('value').notNullable();
                    table.string('type').defaultTo('number');
                    table.string('description');
                    table.timestamp('updated_at').defaultTo(db.fn.now());
                });
                await db('valuation_settings').insert([
                    { key: 'base_rate', name: 'Stawka bazowa (stała opłata)', value: '100', type: 'number', description: 'Podstawowa opłata doliczana do każdego transportu (PLN)' },
                    { key: 'rate_per_km', name: 'Stawka za kilometr', value: '3.5', type: 'number', description: 'Stawka za każdy kilometr trasy (PLN)' },
                    { key: 'weight_threshold', name: 'Próg wagowy (kg)', value: '1000', type: 'number', description: 'Waga, od której naliczany jest mnożnik za wagę' },
                    { key: 'weight_multiplier', name: 'Mnożnik za wagę (%)', value: '10', type: 'percentage', description: 'O ile procent rośnie cena po przekroczeniu progu wagowego' },
                    { key: 'length_threshold', name: 'Próg długości (m)', value: '6', type: 'number', description: 'Długość ładunku, od której naliczany jest mnożnik' },
                    { key: 'length_multiplier', name: 'Mnożnik za długość (%)', value: '15', type: 'percentage', description: 'O ile procent rośnie cena po przekroczeniu progu długości' },
                    { key: 'urgent_threshold_days', name: 'Pilny transport (dni)', value: '2', type: 'number', description: 'Liczba dni lub mniej do dostawy, która oznacza transport pilny' },
                    { key: 'urgent_multiplier', name: 'Mnożnik za transport pilny (%)', value: '20', type: 'percentage', description: 'Dopłata procentowa za szybki termin realizacji' }
                ]);
                settings = await db('valuation_settings').select('*').orderBy('id', 'asc');
            } else {
                throw e;
            }
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error('API /api/admin/valuation-settings GET error:', error);
        return NextResponse.json({ error: 'Wystąpił błąd: ' + (error.message || error.toString()) }, { status: 500 });
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
        return NextResponse.json({ error: 'Wystąpił błąd: ' + (error.message || error.toString()) }, { status: 500 });
    }
}
