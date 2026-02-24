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

        return NextResponse.json({
            success: true,
            estimatedCost: estimatedCost,
            geodisCost: geodisCost,
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
