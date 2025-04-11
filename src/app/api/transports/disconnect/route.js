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
    
    // Sprawdź uprawnienia użytkownika
    const user = await db('users')
      .where('email', userId)
      .select('role', 'permissions')
      .first();
    
    let canEditCalendar = false;
    try {
      if (user.permissions) {
        const permissions = JSON.parse(user.permissions);
        canEditCalendar = permissions?.calendar?.edit === true;
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }
    
    // Tylko użytkownicy z uprawnieniami mogą rozłączać transporty
    if (!canEditCalendar) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do rozłączania transportów' 
      }, { status: 403 });
    }
    
    // Pobieramy ID transportu do rozłączenia
    const { transportId } = await request.json();
    
    if (!transportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport ID jest wymagane' 
      }, { status: 400 });
    }
    
    // Pobieramy transport
    const transport = await db('transports')
      .where('id', transportId)
      .first();
    
    if (!transport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport nie istnieje' 
      }, { status: 404 });
    }
    
    // Jeśli transport ma connected_transport_id, rozłączamy go
    if (transport.connected_transport_id) {
      await db('transports')
        .where('id', transportId)
        .update({ connected_transport_id: null });
      
      console.log(`Rozłączono transport ${transportId} od jego źródła ${transport.connected_transport_id}`);
    } 
    
    // Sprawdzamy, czy jakieś transporty są połączone z tym
    const connectedTransports = await db('transports')
      .where('connected_transport_id', transportId)
      .select('id');
      
    if (connectedTransports.length > 0) {
      // Rozłączamy wszystkie transporty połączone z tym
      await db('transports')
        .where('connected_transport_id', transportId)
        .update({ connected_transport_id: null });
      
      console.log(`Rozłączono ${connectedTransports.length} transportów od źródła ${transportId}`);
    }
    
    // Czyszczenie cache
    try {
      clearCache();
    } catch (error) {
      console.error('Błąd czyszczenia cache:', error);
    }
    
    // Zwracamy sukces
    return NextResponse.json({ 
      success: true,
      message: 'Transporty zostały rozłączone'
    });
  } catch (error) {
    console.error('Error disconnecting transports:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Pomocnicza funkcja do czyszczenia cache
function clearCache() {
  // Importuj funkcję tylko kiedy jest potrzebna
  // aby uniknąć problemu z cyklicznym importem
  const { clearCache } = require('@/utils/cache');
  clearCache();
}