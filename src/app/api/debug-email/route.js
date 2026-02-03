import { NextResponse } from 'next/server';
import db from '@/database/db';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Check DB users
        // We want to see EXACTLY what the app sees
        const kierownicyQuery = db('users')
            .where('role', 'admin')
            .orWhere('role', 'like', 'test%')
            .orWhere('role', 'like', 'magazyn%')
            .select('email', 'name', 'role');

        const kierownicy = await kierownicyQuery;

        // 2. Check all users to see if "test" role exists but maybe with whitespace
        const allUsers = await db('users').select('email', 'role');

        // 3. SMTP Config Check
        const smtpConfig = {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            user: process.env.EMAIL_USER,
            passExists: !!process.env.EMAIL_PASS
        };

        // 4. Verify Transporter
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        let verifyResult = 'Not verified';
        try {
            await transporter.verify();
            verifyResult = 'Success';
        } catch (e) {
            verifyResult = 'Error: ' + e.message;
        }

        return NextResponse.json({
            recipients: kierownicy,
            allUsersPreview: allUsers.map(u => ({ email: u.email, role: u.role })),
            smtpConfig,
            smtpVerify: verifyResult,
            sql: kierownicyQuery.toQuery()
        });
    } catch (error) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
