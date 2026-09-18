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
        const canCalculate = user.isAdmin || user.permissions?.valuation?.calculator !== false;
        if (!canCalculate) {
            return NextResponse.json({ success: false, error: 'Brak uprawnień do kalkulatora wycen transportu' }, { status: 403 });
        }

        const canViewHistory = user.isAdmin || user.permissions?.valuation?.history !== false;

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

                        geodisCost = baseGeodisCost * (1 + totalSurcharge);
                        geodisCost = Math.round(geodisCost * 100) / 100;
                    }
                }
            }

            return NextResponse.json({
                success: true,
                mode: 'kurier',
                geodisCost
            });
        }

        // ------------------ TRYB TRANSPORT WŁASNY ------------------
        if (!sourceCity || !destinationCity || !distanceKm) {
            return NextResponse.json({ error: 'Brak wymaganych danych do obliczeń (miasta, dystans).' }, { status: 400 });
        }

        // 1. Stawka bazowa za kilometr
        let baseRatePerKm = 3.5;
        if (distanceKm > 300) {
            baseRatePerKm = 3.2;
        }

        let estimatedCost = distanceKm * baseRatePerKm;
        const breakdown = [
            { name: `Stawka bazowa (${baseRatePerKm} PLN/km)`, value: distanceKm * baseRatePerKm }
        ];

        // 2. Dopłata za masę (> 3 tony)
        const numWeight = parseFloat(weight);
        if (numWeight && numWeight > 3000) {
            const extraWeight = numWeight - 3000;
            const extraWeightBlocks = Math.ceil(extraWeight / 1000);
            const weightSurcharge = extraWeightBlocks * (0.2 * distanceKm);
            estimatedCost += weightSurcharge;
            breakdown.push({ name: `Dopłata za masę > 3t (${extraWeightBlocks}t x 0.2 PLN/km)`, value: weightSurcharge });
        }

        // 3. Dopłata za długość (> 4m)
        const numLength = parseFloat(length);
        if (numLength && numLength > 4) {
            const extraLength = numLength - 4;
            const extraLengthBlocks = Math.ceil(extraLength);
            const lengthSurcharge = extraLengthBlocks * (0.3 * distanceKm);
            estimatedCost += lengthSurcharge;
            breakdown.push({ name: `Dopłata za długość > 4m (${extraLengthBlocks}m x 0.3 PLN/km)`, value: lengthSurcharge });
        }

        // 4. Dopłata sezonowa (wrzesień - grudzień)
        const targetDate = deliveryDateStr ? new Date(deliveryDateStr) : new Date();
        const month = targetDate.getMonth() + 1; // 1-12
        if (month >= 9 && month <= 12) {
            const seasonalSurcharge = estimatedCost * 0.10;
            estimatedCost += seasonalSurcharge;
            breakdown.push({ name: `Dopłata sezonowa IX-XII (+10%)`, value: seasonalSurcharge });
        }

        // 5. Dopłata za czas (na jutro vs na dzisiaj)
        if (deliveryDateStr) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const delivery = new Date(deliveryDateStr);
            delivery.setHours(0, 0, 0, 0);

            const diffTime = delivery.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Na dzisiaj
                estimatedCost += 500;
                breakdown.push({ name: `Dopłata za transport na dzisiaj`, value: null });
            } else if (diffDays === 1) {
                // Na jutro
                estimatedCost += 200;
                breakdown.push({ name: `Dopłata za transport na jutro`, value: null });
            }
        }

        // Zaokrąglenie kosztu w góre do pełnych dziesiątek
        estimatedCost = Math.ceil(estimatedCost / 10) * 10;

        let historyData = null;

        if (canViewHistory) {
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
            let similarSpeditions = similarSpeditionsRaw.map(s => {
                let goodsInfo = null;
                let mergedInfo = null;

                try {
                    if (s.order_data) {
                        const orderData = typeof s.order_data === 'string' ? JSON.parse(s.order_data) : s.order_data;
                        if (orderData.towar || orderData.waga) {
                            goodsInfo = {
                                description: orderData.towar || '',
                                weight: orderData.waga ? `${orderData.waga} kg` : ''
                            };
                        }
                    }
                } catch (e) {
                    console.error("Error parsing order_data for spedition ID " + s.id, e);
                }

                try {
                    if (s.merged_transports) mergedInfo = JSON.parse(s.merged_transports);
                } catch (e) {
                    console.error("Error parsing merged_transports for spedition ID " + s.id, e);
                }

                return {
                    ...s,
                    parsedGoods: goodsInfo,
                    parsedMerged: mergedInfo,
                    searchPercentage: speditionPercentage * 100
                };
            });

            // Filtracja: ukryj spedycje bez opisu towaru i stawki
            similarSpeditions = similarSpeditions.filter(s => {
                let hasPrice = false;
                try {
                    if (s.response_data) {
                        const data = typeof s.response_data === 'string' ? JSON.parse(s.response_data) : s.response_data;
                        const cost = data.deliveryPrice || data.costPerTransport || data.responseCost || data?.responseCost?.[0] || data?.[0]?.responseCost;
                        if (cost) hasPrice = true;
                    }
                } catch (e) { }

                const hasGoodsInfo = s.parsedGoods && (s.parsedGoods.description || s.parsedGoods.weight);
                return hasPrice && hasGoodsInfo;
            });

            const enhancedOwnTransports = similarOwnTransports.map(t => {
                return {
                    ...t,
                    estimatedCost: Math.ceil((distanceKm * 3.5) / 10) * 10,
                    distance_km: Math.round(distanceKm)
                };
            });

            historyData = {
                ownTransports: enhancedOwnTransports,
                speditions: similarSpeditions,
                speditionPercentage: speditionPercentage * 100
            };
        }

        return NextResponse.json({
            success: true,
            mode: 'wlasny',
            estimatedCost: estimatedCost,
            breakdown,
            history: historyData
        });

    } catch (error) {
        console.error('API /api/wycena-transportu/calculate error:', error);
        return NextResponse.json({ error: 'Błąd: ' + (error.message || error.toString()) }, { status: 500 });
    }
}
