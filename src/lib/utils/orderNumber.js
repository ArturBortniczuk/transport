// src/lib/utils/orderNumber.js

/**
 * Generates the next sequential order number for spedycje in format XXXX/MM/YYYY.
 * Finds the maximum numerical prefix among all existing orders in the specified month and year,
 * ensuring that sequence resets, ID gaps, or timing discrepancies can never produce duplicate order numbers.
 *
 * @param {import('knex').Knex} db - Knex database instance or transaction
 * @param {string|number} [targetMonth] - Two-digit month string (e.g. '09') or number. Defaults to current month.
 * @param {string|number} [targetYear] - Four-digit year (e.g. 2026). Defaults to current year.
 * @returns {Promise<{ orderNumber: number, formattedOrderNumber: string, month: string, year: number }>}
 */
export async function getNextSpedycjaOrderNumber(db, targetMonth, targetYear) {
  const now = new Date();
  const month = targetMonth ? String(targetMonth).padStart(2, '0') : (now.getMonth() + 1).toString().padStart(2, '0');
  const year = targetYear ? parseInt(targetYear, 10) : now.getFullYear();

  // Pobierz wszystkie numery zamówień pasujące do wzorca miesiąca i roku
  const existingOrders = await db('spedycje')
    .where('order_number', 'like', `%/${month}/${year}`)
    .select('order_number');

  let maxNumber = 0;
  for (const order of existingOrders) {
    if (order.order_number) {
      const match = order.order_number.match(/^(\d+)\//);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }

  const nextNumber = maxNumber + 1;
  const formattedOrderNumber = `${nextNumber.toString().padStart(4, '0')}/${month}/${year}`;

  return {
    orderNumber: nextNumber,
    formattedOrderNumber,
    month,
    year
  };
}

/**
 * Generates multiple sequential order numbers for unmerge operations.
 *
 * @param {import('knex').Knex} db
 * @param {number} count - How many sequential order numbers to generate
 * @param {string|number} [targetMonth]
 * @param {string|number} [targetYear]
 * @returns {Promise<string[]>}
 */
export async function getNextSpedycjaOrderNumbers(db, count, targetMonth, targetYear) {
  const now = new Date();
  const month = targetMonth ? String(targetMonth).padStart(2, '0') : (now.getMonth() + 1).toString().padStart(2, '0');
  const year = targetYear ? parseInt(targetYear, 10) : now.getFullYear();

  const existingOrders = await db('spedycje')
    .where('order_number', 'like', `%/${month}/${year}`)
    .select('order_number');

  let maxNumber = 0;
  for (const order of existingOrders) {
    if (order.order_number) {
      const match = order.order_number.match(/^(\d+)\//);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }

  const orderNumbers = [];
  for (let i = 1; i <= count; i++) {
    const num = maxNumber + i;
    orderNumbers.push(`${num.toString().padStart(4, '0')}/${month}/${year}`);
  }

  return orderNumbers;
}
