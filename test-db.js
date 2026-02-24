import db from './src/database/db.js';

async function test() {
    try {
        const rows = await db('spedycje').select('id', 'goods_description', 'order_data').orderBy('id', 'desc').limit(10);
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

test();
