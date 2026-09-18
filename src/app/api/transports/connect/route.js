// src/app/api/transports/connect/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request) {
  try {
    // Sprawdzamy uwierzytelnienie
    const session = await getSessionUser(request);
    if (!session?.isAuthenticated || !session.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const canConnect = session.user.isAdmin === true || 
                       session.user.permissions?.calendar?.connect_routes === true ||
                       session.user.permissions?.calendar?.edit === true;
    
    // Tylko użytkownicy z uprawnieniami mogą łączyć transporty
    if (!canConnect) {
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
    
    // Zaktualizuj transport docelowy, ustawiając connected_transport_id oraz przeliczając koszt na stawkę 3.5 PLN/km (zaokrąglony)
    await db('transports')
      .where('id', targetTransportId)
      .update({ 
        connected_transport_id: sourceTransportId,
        cost: targetTransport.distance ? Math.round(targetTransport.distance * 3.5) : null,
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