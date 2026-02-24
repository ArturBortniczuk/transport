import { NextResponse } from 'next/server';
import db from '@/database/db';

export async function POST(request) {
    try {
        const data = await request.json();
        const {
            sourceCity,
            destinationCity,
            weight,
            length,
            deliveryDateStr,
            distanceKm
        } = data;

        if (!sourceCity || !destinationCity || distanceKm === undefined) {
            return NextResponse.json({ error: 'Brakujące parametry kalkulacji' }, { status: 400 });
        }

        // 1. Pobierz ustawienia wyceny
        let settingsRaw;
        try {
            settingsRaw = await db('valuation_settings').select('*');
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
                settingsRaw = await db('valuation_settings').select('*');
            } else {
                throw e;
            }
        }
        const settings = settingsRaw.reduce((acc, curr) => {
            acc[curr.key] = parseFloat(curr.value);
            return acc;
        }, {});

        const baseRate = settings.base_rate || 100;
        const ratePerKm = settings.rate_per_km || 3.5;

        // 2. Oblicz podstawowy koszt
        let estimatedCost = baseRate + (distanceKm * ratePerKm);
        let breakdown = [
            { name: 'Opłata za dystans bazowy', value: null }
        ];

        // 3. Dodaj mnożnik za wagę (powyżej 1 tony oraz powyżej 12 ton)
        const numWeight = parseFloat(weight);
        if (numWeight && numWeight > 1000) {
            let weightMultiplier = settings.weight_multiplier || 10;
            let weightMsg = `Dopłata za wagę > 1t`;

            // Jeśli waga powyżej 12 ton, zwiększony mnożnik (np. trzykrotność bazowego mnożnika)
            if (numWeight > 12000) {
                weightMultiplier = (settings.weight_multiplier || 10) * 3;
                weightMsg = `Dopłata za ciężki transport > 12t`;
            }

            estimatedCost += estimatedCost * (weightMultiplier / 100);
            breakdown.push({ name: weightMsg, value: null });
        }

        // 4. Mnożnik za gabaryty / rozmiar auta (długość)
        const numLength = parseFloat(length);
        if (numLength) {
            let lengthMultiplier = 0;
            let carTypeMsg = "Wymagane auto: Bus (≤ 5m)";

            if (numLength > 5 && numLength <= 8) {
                // Solówka (zwiększona dopłata np. 1.5x lub z settings)
                lengthMultiplier = settings.length_multiplier || 15;
                carTypeMsg = "Wymagane auto: Solówka (> 5m i ≤ 8m)";
            } else if (numLength > 8) {
                // Zestaw (znacznie większa dopłata)
                lengthMultiplier = (settings.length_multiplier || 15) * 2.5;
                carTypeMsg = "Wymagane auto: Zestaw (> 8m)";
            }

            if (lengthMultiplier > 0) {
                estimatedCost += estimatedCost * (lengthMultiplier / 100);
                breakdown.push({ name: carTypeMsg, value: null });
            }
        }

        // 5. Dodaj dopłatę za pilność
        if (deliveryDateStr) {
            const deliveryDate = new Date(deliveryDateStr);
            const today = new Date();
            const diffTime = deliveryDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const urgentThreshold = settings.urgent_threshold_days || 2;
            if (diffDays <= urgentThreshold) {
                const urgentMultiplier = settings.urgent_multiplier || 20;
                estimatedCost += estimatedCost * (urgentMultiplier / 100);
                breakdown.push({ name: `Dopłata za pilny transport (szybszy termin)`, value: null });
            }
        }

        // 5.5 Zaokrąglenie kosztu w góre do pełnych dziesiątek (np. 562 -> 570)
        estimatedCost = Math.ceil(estimatedCost / 10) * 10;

        // 6. Szukaj podobnych transportów własnych
        // Z racji braku kolumny distance_km, szukamy na podstawie docelowego miasta (%LIKE%)
        // oraz źródła (bazy), pomijając polskie znaki w nazwie bazy (Białystok -> bialystok)
        const normalizedSource = sourceCity.toLowerCase().replace('ł', 'l');

        const similarOwnTransports = await db('transports')
            .where(function () {
                this.whereRaw('LOWER(source_warehouse) LIKE ?', [`%${normalizedSource}%`])
                    .orWhereRaw('LOWER(source_warehouse) LIKE ?', [`%${sourceCity.toLowerCase()}%`])
            })
            .andWhereRaw('LOWER(destination_city) LIKE ?', [`%${destinationCity.toLowerCase()}%`])
            .orderBy('id', 'desc')
            .limit(5);

        // 7. Szukaj podobnych spedycji
        // Spedycje mają `location` często w formacie "Od - Do" lub podobnym. 
        // Dlatego szukamy po dystansie.
        const minDistance = Math.round(distanceKm * 0.8);
        const maxDistance = Math.round(distanceKm * 1.2);

        const similarSpeditions = await db('spedycje')
            .whereBetween('distance_km', [minDistance, maxDistance])
            .orderBy('id', 'desc')
            .limit(5);

        // Dodaj pole estimatedCost do transportów własnych, żeby pokazywać historyczne wyceny 
        // kalkulowane na podst. dzisiejszych stawek i odległości API
        const enhancedOwnTransports = similarOwnTransports.map(t => {
            return {
                ...t,
                // Skoro to ta sama trasa, przyjmujemy bieżący distanceKm z Google Maps
                estimatedCost: Math.ceil((baseRate + (distanceKm * ratePerKm)) / 10) * 10,
                distance_km: Math.round(distanceKm)
            };
        });

        return NextResponse.json({
            success: true,
            estimatedCost: estimatedCost,
            breakdown,
            history: {
                ownTransports: enhancedOwnTransports,
                speditions: similarSpeditions
            }
        });

    } catch (error) {
        console.error('API /api/wycena-transportu/calculate error:', error);
        return NextResponse.json({ error: 'Błąd: ' + (error.message || error.toString()) }, { status: 500 });
    }
}
