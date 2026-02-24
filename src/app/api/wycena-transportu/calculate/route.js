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
            { name: 'Opłata bazowa', value: baseRate },
            { name: `Dystans (${distanceKm.toFixed(1)} km × ${ratePerKm} PLN)`, value: distanceKm * ratePerKm }
        ];

        // 3. Dodaj mnożnik za wagę
        const numWeight = parseFloat(weight);
        if (numWeight && numWeight > (settings.weight_threshold || 1000)) {
            const weightMultiplier = settings.weight_multiplier || 10;
            const weightCost = estimatedCost * (weightMultiplier / 100);
            estimatedCost += weightCost;
            breakdown.push({ name: `Dopłata za wagę > ${settings.weight_threshold}kg (+${weightMultiplier}%)`, value: weightCost });
        }

        // 4. Dodaj mnożnik za długość
        const numLength = parseFloat(length);
        if (numLength && numLength > (settings.length_threshold || 6)) {
            const lengthMultiplier = settings.length_multiplier || 15;
            const lengthCost = estimatedCost * (lengthMultiplier / 100);
            estimatedCost += lengthCost;
            breakdown.push({ name: `Dopłata za długość > ${settings.length_threshold}m (+${lengthMultiplier}%)`, value: lengthCost });
        }

        // 5. Dodaj dopłatę za pilność
        if (deliveryDateStr) {
            const deliveryDate = new Date(deliveryDateStr);
            const today = new Date();
            const diffTime = Math.abs(deliveryDate - today);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const urgentThreshold = settings.urgent_threshold_days || 2;
            // Pilne jeśli dostawa jest dzisiaj lub jutro (diffDays <= 2)
            if (diffDays <= urgentThreshold) {
                const urgentMultiplier = settings.urgent_multiplier || 20;
                const urgentCost = estimatedCost * (urgentMultiplier / 100);
                estimatedCost += urgentCost;
                breakdown.push({ name: `Dopłata za pilny transport (≤ ${urgentThreshold} dni) (+${urgentMultiplier}%)`, value: urgentCost });
            }
        }

        // 6. Szukaj podobnych transportów własnych (na podstawie odległości)
        // Podobnie jak spedycje, szukamy transportów własnych w promieniu +/- 20% odległości
        // by uniknąć problemów z niedopasowaniem dosłownych nazw magazynów z długimi adresami.
        const minDistance = Math.round(distanceKm * 0.8);
        const maxDistance = Math.round(distanceKm * 1.2);

        const similarOwnTransports = await db('transports')
            .whereBetween('distance_km', [minDistance, maxDistance])
            .orderBy('id', 'desc')
            .limit(5);

        // 7. Szukaj podobnych spedycji
        // Spedycje mają `location` często w formacie "Od - Do" lub podobnym. 
        // Dlatego szukamy po dystansie.
        const similarSpeditions = await db('spedycje')
            .whereBetween('distance_km', [minDistance, maxDistance])
            .orderBy('id', 'desc')
            .limit(5);

        return NextResponse.json({
            success: true,
            estimatedCost: Math.round(estimatedCost * 100) / 100, // Zaokrąglenie do 2 miejsc po przecinku
            breakdown,
            history: {
                ownTransports: similarOwnTransports,
                speditions: similarSpeditions
            }
        });

    } catch (error) {
        console.error('API /api/wycena-transportu/calculate error:', error);
        return NextResponse.json({ error: 'Błąd: ' + (error.message || error.toString()) }, { status: 500 });
    }
}
