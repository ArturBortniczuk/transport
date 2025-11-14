// src/app/api/update-transport-permissions/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';

// Funkcja pomocnicza do weryfikacji sesji
const validateSession = async (authToken) => {
  if (!authToken) {
    return null;
  }
  
  const session = await db('sessions')
    .where('token', authToken)
    .whereRaw('expires_at > NOW()')
    .select('user_id')
    .first();
  
  return session?.user_id;
};

// POST - Jednorazowa aktualizacja uprawnień dla systemu wniosków transportowych
export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Sprawdź czy użytkownik jest adminem
    const user = await db('users')
      .where('email', userId)
      .select('role', 'is_admin')
      .first();

    const isAdmin = 
      user?.is_admin === true || 
      user?.is_admin === 1 || 
      user?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tylko administrator może wykonać tę operację' 
      }, { status: 403 });
    }

    // Pobierz wszystkich użytkowników
    const allUsers = await db('users').select('email', 'role', 'permissions');

    let updatedCount = 0;
    const errors = [];

    // Aktualizuj uprawnienia dla każdego użytkownika
    for (const userRecord of allUsers) {
      try {
        // Parsuj istniejące uprawnienia
        let permissions = {};
        try {
          if (userRecord.permissions && typeof userRecord.permissions === 'string') {
            permissions = JSON.parse(userRecord.permissions);
          }
        } catch (e) {
          console.error('Błąd parsowania uprawnień dla użytkownika:', userRecord.email, e);
          permissions = {};
        }

        // Określ nowe uprawnienia na podstawie roli
        let transportRequestsPermissions = {};

        switch (userRecord.role) {
          case 'handlowiec':
            transportRequestsPermissions = {
              add: true,      // może składać wnioski
              view_own: true  // może przeglądać swoje wnioski
            };
            break;

          case 'magazyn':
          case 'magazyn_bialystok':
          case 'magazyn_zielonka':
          case 'admin':
            transportRequestsPermissions = {
              add: true,        // może składać wnioski (jeśli potrzebuje)
              view_own: true,   // może przeglądać swoje wnioski
              approve: true,    // może akceptować/odrzucać wnioski
              view_all: true    // może przeglądać wszystkie wnioski
            };
            break;

          default:
            // Inne role - podstawowe uprawnienia
            transportRequestsPermissions = {
              add: false,
              view_own: false,
              approve: false,
              view_all: false
            };
        }

        // Sprawdź czy uprawnienia już istnieją i czy są takie same
        const currentTransportPermissions = permissions.transport_requests || {};
        const needsUpdate = JSON.stringify(currentTransportPermissions) !== JSON.stringify(transportRequestsPermissions);

        if (needsUpdate) {
          // Dodaj nowe uprawnienia do istniejących
          permissions.transport_requests = transportRequestsPermissions;

          // Zapisz zaktualizowane uprawnienia
          await db('users')
            .where('email', userRecord.email)
            .update({
              permissions: JSON.stringify(permissions)
            });

          updatedCount++;
          console.log(`Zaktualizowano uprawnienia dla: ${userRecord.email} (${userRecord.role})`);
        }

      } catch (error) {
        console.error(`Błąd aktualizacji uprawnień dla ${userRecord.email}:`, error);
        errors.push({
          user: userRecord.email,
          error: error.message
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Zaktualizowano uprawnienia dla ${updatedCount} użytkowników`,
      updatedCount,
      totalUsers: allUsers.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error updating transport permissions:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// GET - Sprawdź aktualne uprawnienia użytkowników
export async function GET(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const authToken = request.cookies.get('authToken')?.value;
    const userId = await validateSession(authToken);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Sprawdź czy użytkownik jest adminem
    const user = await db('users')
      .where('email', userId)
      .select('role', 'is_admin')
      .first();

    const isAdmin = 
      user?.is_admin === true || 
      user?.is_admin === 1 || 
      user?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tylko administrator może wykonać tę operację' 
      }, { status: 403 });
    }

    // Pobierz wszystkich użytkowników z ich uprawnieniami
    const allUsers = await db('users')
      .select('email', 'name', 'role', 'permissions')
      .orderBy('role');

    const userPermissions = allUsers.map(userRecord => {
      let permissions = {};
      try {
        if (userRecord.permissions && typeof userRecord.permissions === 'string') {
          permissions = JSON.parse(userRecord.permissions);
        }
      } catch (e) {
        console.error('Błąd parsowania uprawnień dla użytkownika:', userRecord.email, e);
        permissions = {};
      }

      return {
        email: userRecord.email,
        name: userRecord.name,
        role: userRecord.role,
        transportRequestsPermissions: permissions.transport_requests || null,
        hasTransportRequestsPermissions: !!permissions.transport_requests
      };
    });

    // Statystyki
    const stats = {
      totalUsers: allUsers.length,
      usersWithPermissions: userPermissions.filter(u => u.hasTransportRequestsPermissions).length,
      usersByRole: {}
    };

    // Grupuj po rolach
    allUsers.forEach(user => {
      if (!stats.usersByRole[user.role]) {
        stats.usersByRole[user.role] = 0;
      }
      stats.usersByRole[user.role]++;
    });

    return NextResponse.json({ 
      success: true, 
      userPermissions,
      stats
    });

  } catch (error) {
    console.error('Error fetching transport permissions:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
