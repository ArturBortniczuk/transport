import { NextResponse } from 'next/server';
import db from '@/database/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q') || 'zietek';

        const users = await db('users')
            .select('*')
            .where('name', 'ilike', `%${query}%`)
            .orWhere('email', 'ilike', `%${query}%`);

        // Return uniqueMarkets grouped as well to see what's happening
        const allUsers = await db('users').select('*');

        return NextResponse.json({
            query: query,
            found: users,
            totalUsers: allUsers.length
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
