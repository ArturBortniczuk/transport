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
        const settingsRaw = await db('valuation_settings').select('*');
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

        // 6. Szukaj podobnych transportów własnych (na podstawie miasta / odległości)
        // Z racji braku kolumny z wprost wyrażonym kosztem dla własnych, 
        // pokazujemy po prostu historyczne przejazdy na tej trasie.
        const similarOwnTransports = await db('transports')
            .whereRaw('LOWER(source_warehouse) LIKE ?', [`%${sourceCity.toLowerCase()}%`])
            .andWhereRaw('LOWER(destination_city) LIKE ?', [`%${destinationCity.toLowerCase()}%`])
            .orderBy('id', 'desc')
            .limit(5);

        // 7. Szukaj podobnych spedycji
        // Spedycje mają `location` często w formacie "Od - Do" lub podobnym. 
        // Dlatego możemy szukać po JSON-ie (location_data) lub wpisanej destynacji / distance_km.
        // Zakładając margines błędu +/- 20% odległości
        const minDistance = distanceKm * 0.8;
        const maxDistance = distanceKm * 1.2;

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
        return NextResponse.json({ error: 'Błąd podczas kalkulacji wyceny' }, { status: 500 });
    }
}
