// src/app/api/check-admin/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    
    if (!session?.isAuthenticated || !session?.user) {
      return NextResponse.json({ isAdmin: false, permissions: null });
    }
    
    const user = session.user;
    const isSuperAdmin = user.email === 'a.bortniczuk@grupaeltron.pl';
    const isAdminValue = isSuperAdmin || user.isAdmin === true || user.role === 'admin';

    let permissions = user.permissions || {};
    if (!permissions.admin) {
      permissions.admin = {
        users: isAdminValue,
        valuation: isAdminValue,
        packagings: isAdminValue,
        constructions: isAdminValue,
        cable_advices: isAdminValue
      };
    } else if (isAdminValue) {
      permissions.admin.users = true;
      permissions.admin.valuation = true;
      permissions.admin.packagings = true;
      permissions.admin.constructions = true;
      permissions.admin.cable_advices = true;
    }
    
    return NextResponse.json({ 
      isAdmin: isAdminValue,
      permissions: permissions
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false, permissions: null });
  }
}

