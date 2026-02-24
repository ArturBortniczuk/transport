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
            palletType,
            deliveryDateStr,
            distanceKm,
            mode // 'wlasny' (default) lub 'kurier'
        } = data;

        // ------------------ TRYB KURIER ------------------
        if (mode === 'kurier') {
            const numWeight = parseFloat(weight);
            let geodisCost = null;

            if (palletType && palletType !== '') {
                const geodisRates = {
                    '0.6x0.8': { 200: 55.43, 300: 59.12 },
                    '1.2x0.8': { 200: 91.15, 300: 91.15, 400: 91.15, 600: 101.00, 800: 103.46, 900: 109.62, 1000: 112.08, 1200: 121.94 },
                    '1.2x1.2': { 200: 129.33, 300: 129.33, 400: 129.33, 600: 129.33, 800: 129.33, 900: 135.49, 1000: 140.41, 1200: 149.04 },
                    'ponadgabaryt': { 400: 91.15, 600: 101.00, 800: 103.46, 900: 109.62, 1000: 465.00, 1200: 586.63 }
                };

                const ratesForType = geodisRates[palletType];
                if (ratesForType && numWeight > 0 && numWeight <= 1200) {
                    let applicableWeight = null;
                    const weightTiers = Object.keys(ratesForType).map(Number).sort((a, b) => a - b);

                    for (const tier of weightTiers) {
                        if (numWeight <= tier) {
                            applicableWeight = tier;
                            break;
                        }
                    }

                    if (applicableWeight !== null) {
                        let baseGeodisCost = ratesForType[applicableWeight];
                        const FUEL_SURCHARGE = 0.28;
                        const SEASONAL_SURCHARGE = 0.078;

                        let totalSurcharge = FUEL_SURCHARGE;

                        const targetDate = deliveryDateStr ? new Date(deliveryDateStr) : new Date();
                        const month = targetDate.getMonth() + 1;

                        let isSeasonal = false;
                        if (month >= 9 && month <= 12) {
                            isSeasonal = true;
                        }

                        if (isSeasonal) {
                            totalSurcharge += SEASONAL_SURCHARGE;
                        }

                        const netPrice = baseGeodisCost * (1 + totalSurcharge);
                        const grossPrice = netPrice * 1.23;

                        geodisCost = {
                            basePrice: baseGeodisCost,
                            fuelSurcharge: baseGeodisCost * FUEL_SURCHARGE,
                            seasonalSurcharge: isSeasonal ? baseGeodisCost * SEASONAL_SURCHARGE : 0,
                            netPrice: netPrice,
                            grossPrice: grossPrice,
                            isSeasonal
                        };
                    }
                }
            }

            if (!geodisCost) {
                return NextResponse.json({ error: 'Nie można wycenić kuriera. Sprawdź czy podana waga mieści się w przedziałach dla tej palety.' }, { status: 400 });
            }

            return NextResponse.json({
                success: true,
                mode: 'kurier',
                geodisCost: geodisCost
            });
        }

        // ------------------ TRYB WŁASNY / SPEDYCJA ------------------

        if (!sourceCity || !destinationCity || distanceKm === undefined) {
            return NextResponse.json({ error: 'Brakujące parametry kalkulacji transportu (miasto początkowe, docelowe)' }, { status: 400 });
        }

        let breakdown = [];
        let ratePerKm = 0;
        let carTypeMsg = "";

        const numLength = parseFloat(length) || 0;
        const numWeight = parseFloat(weight) || 0;

        // Określanie stawki za kilometr na podstawie wymiarów i wagi
        if (numWeight > 9000) {
            // Waga powyżej 9 ton - wymusza zestaw i stawkę 4.5
            ratePerKm = 4.5;
            carTypeMsg = "Zestaw (waga > 9t): 4.7 PLN/km";
        } else if (numWeight > 1100 || numLength > 8) {
            // Waga > 1100kg lub dł > 8m -> trzeba zestaw, chociaż dł > 8m = zestaw stawka 4.5 według wytycznych? 
            // "pomiędzy 5 a 8 damy 3,5zł, a powyżej 4,5zł/km."
            if (numLength > 8) {
                ratePerKm = 4.7;
                carTypeMsg = "Zestaw (długość > 8m): 4.7 PLN/km";
            } else {
                ratePerKm = 3.7;
                carTypeMsg = "Solówka (waga > 1100kg): 3.7 PLN/km";
            }
        } else if (numLength > 5 && numLength <= 8) {
            ratePerKm = 3.7;
            carTypeMsg = "Solówka (5m - 8m): 3.7 PLN/km";
        } else {
            // Poniżej lub 5m i waga do 1100kg
            ratePerKm = 2.2;
            carTypeMsg = "Bus (≤ 5m, waga ≤ 1100kg): 2.2 PLN/km";
        }

        breakdown.push({ name: `Wyliczenie stawki kilometrowej (${carTypeMsg})`, value: null });

        // Oblicz podstawowy koszt
        let distanceCost = distanceKm * ratePerKm;

        // Minimalny koszt
        if (distanceCost < 500) {
            distanceCost = 500;
            breakdown.push({ name: 'Dopłata do minimalnej kwoty zamówienia (500 PLN)', value: null });
        }

        let estimatedCost = distanceCost;

        // Dopłata za pilność (stała kwota)
        if (deliveryDateStr) {
            const deliveryDate = new Date(deliveryDateStr);
            const today = new Date();
            const diffTime = deliveryDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Na dzisiaj
                estimatedCost += 300;
                breakdown.push({ name: `Dopłata za transport na dziś`, value: null });
            } else if (diffDays === 1) {
                // Na jutro
                estimatedCost += 200;
                breakdown.push({ name: `Dopłata za transport na jutro`, value: null });
            }
        }

        // Zaokrąglenie kosztu w góre do pełnych dziesiątek
        estimatedCost = Math.ceil(estimatedCost / 10) * 10;

        // 6. Szukaj podobnych transportów własnych
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
        let speditionPercentage = 0.2; // 20% domyślnie dla <= 300km
        let minDistance, maxDistance;

        if (distanceKm > 300) {
            speditionPercentage = 0.1; // 10% dla > 300km
        }

        minDistance = Math.round(distanceKm * (1 - speditionPercentage));
        maxDistance = Math.round(distanceKm * (1 + speditionPercentage));

        const similarSpeditionsRaw = await db('spedycje')
            .whereBetween('distance_km', [minDistance, maxDistance])
            .orderBy('id', 'desc')
            .limit(5);

        // Parsowanie JSONów dla spedycji, aby odczytać info o towarze
        const similarSpeditions = similarSpeditionsRaw.map(s => {
            let goodsInfo = null;
            let mergedInfo = null;

            try {
                if (s.goods_description) goodsInfo = JSON.parse(s.goods_description);
            } catch (e) { }

            try {
                if (s.merged_transports) mergedInfo = JSON.parse(s.merged_transports);
            } catch (e) { }

            return {
                ...s,
                parsedGoods: goodsInfo,
                parsedMerged: mergedInfo,
                searchPercentage: speditionPercentage * 100 // do info w UI
            };
        });

        // Podmiana historycznych
        const enhancedOwnTransports = similarOwnTransports.map(t => {
            return {
                ...t,
                // Stała stawka 3.5 PLN za km wg wytycznych użytkownika dla historii, nie uwzględnia nowej dynamicznej stawki ani daty.
                // Do wcześniejszego wyświetlania historii dodaliśmy zaokrąglenie, zostawmy je dla ładnego podglądu lub pokażmy czyste mnożenie:
                estimatedCost: Math.ceil((distanceKm * 3.5) / 10) * 10,
                distance_km: Math.round(distanceKm)
            };
        });

        return NextResponse.json({
            success: true,
            mode: 'wlasny',
            estimatedCost: estimatedCost,
            breakdown,
            history: {
                ownTransports: enhancedOwnTransports, // Tutaj można zostawić enhanced z dystansem
                speditions: similarSpeditions,
                speditionPercentage: speditionPercentage * 100
            }
        });

    } catch (error) {
        console.error('API /api/wycena-transportu/calculate error:', error);
        return NextResponse.json({ error: 'Błąd: ' + (error.message || error.toString()) }, { status: 500 });
    }
}
