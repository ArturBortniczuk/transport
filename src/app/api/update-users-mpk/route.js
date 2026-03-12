import { NextResponse } from 'next/server';
import db from '@/database/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const updates = [
            { name: 'Mateusz Magnuszewski', mpk: '522-01-184' },
            { name: 'Karol Kulesza', mpk: '522-01-426' },
            { name: 'Bartłomiej Klimaszewski', mpk: '522-01-511' },
            // 522-01-999 Pozostałe (ignorujemy, to abstrakcja a nie User)
            { name: 'Przemysław Ziętek', mpk: '522-02-314' },
            { name: 'Łukasz Wasak', mpk: '522-02-362' },
            { name: 'Adrian Chotyniec', mpk: '522-02-364' },
            // 522-02-999 Pozostałe
            { name: 'Michał Berliński', mpk: '522-03-380' },
            { name: 'Karol Kołodziejczak', mpk: '522-03-407' },
            { name: 'Marcin Misztela', mpk: '522-03-504' },
            { name: 'Mariusz Tryc', mpk: '522-03-541' },
            // 522-03-999 Pozostałe
            { name: 'Wojciech Paździorko', mpk: '522-04-379' },
            { name: 'Mateusz Manikowski', mpk: '522-04-475' },
            // 522-04-999 Pozostałe
            { name: 'Marcin Szafraniec', mpk: '522-05-517' },
            { name: 'Mariusz Szafrański', mpk: '522-05-546' },
            // 522-05-999 Pozostałe
            { name: 'Łukasz Korgul', mpk: '522-06-444' },
            { name: 'Maksymilian Bela', mpk: '522-06-527' },
            // 522-06-999 Pozostałe
            { name: 'Mikołaj Sadowczyk', mpk: '522-07-408' },
            // 522-07-999 Pozostałe
            { name: 'Maciej Lubojański', mpk: '522-08-477' },
            { name: 'Grzegorz Górny', mpk: '522-08-516' },
            // 522-08-999 Pozostałe
        ];

        const results = [];

        // Zaktualizuj każdego użytkownika i sprawdź efekt
        for (const data of updates) {
            const { name, mpk } = data;
            const parts = name.split(' ');
            const firstName = parts[0];
            const lastName = parts[parts.length - 1];

            const updateResult = await db('users')
                .where(function () {
                    this.where('name', 'ilike', `%${name}%`)
                        .orWhere('name', 'ilike', `%${lastName}%${firstName}%`)
                        .orWhere('name', 'ilike', `%${firstName}%${lastName}%`)
                        .orWhere('name', 'ilike', `%${lastName}%`)
                })
                .update({ mpk: mpk });

            results.push({ name: name, mpk: mpk, updatedRows: updateResult });
        }

        return NextResponse.json({
            success: true,
            message: "MPK zaktualizowane pomyślnie",
            details: results
        });

    } catch (error) {
        console.error('Błąd aktualizacji MPK:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
