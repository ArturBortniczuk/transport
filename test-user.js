import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}

import db from './src/database/db.js';

async function test() {
    try {
        const users = await db('users')
            .select('name', 'email', 'mpk', 'role')
            .where('name', 'ilike', '%Ziętek%')
            .orWhere('email', 'ilike', '%zietek%');
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

test();
