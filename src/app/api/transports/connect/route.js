// src/app/api/transports/connect/route.js
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
        canEditCalendar = permissions?.calendar?.edit === true || user.role === 'admin';
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e);
    }
    
    // Tylko użytkownicy z uprawnieniami mogą łączyć transporty
    if (!canEditCalendar) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak uprawnień do łączenia transportów' 
      }, { status: 403 });
    }
    
    const { sourceTransportId, targetTransportId } = await request.json();
    
    if (!sourceTransportId || !targetTransportId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak wymaganych identyfikatorów transportów' 
      }, { status: 400 });
    }
    
    // Pobierz oba transporty, aby sprawdzić ich dane
    const sourceTransport = await db('transports')
      .where('id', sourceTransportId)
      .first();
      
    const targetTransport = await db('transports')
      .where('id', targetTransportId)
      .first();
    
    if (!sourceTransport || !targetTransport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Jeden lub oba transporty nie istnieją' 
      }, { status: 404 });
    }
    
    // Sprawdź, czy transporty są już połączone
    if (targetTransport.connected_transport_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport docelowy jest już połączony z innym transportem' 
      }, { status: 400 });
    }
    
    // Zaktualizuj transport docelowy, ustawiając connected_transport_id
    await db('transports')
      .where('id', targetTransportId)
      .update({ 
        connected_transport_id: sourceTransportId,
        // Opcjonalnie, możemy również zaktualizować kierowcę, aby był taki sam jak w źródłowym
        driver_id: sourceTransport.driver_id
      });
    
    return NextResponse.json({ 
      success: true,
      message: 'Transporty zostały pomyślnie połączone'
    });
    
  } catch (error) {
    console.error('Error connecting transports:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}