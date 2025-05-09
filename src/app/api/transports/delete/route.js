// src/app/api/transports/delete/route.js
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

export async function DELETE(request) {
  try {
    // Pobierz ID transportu z zapytania
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transport ID is required' 
      }, { status: 400 });
    }
    
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
      .select('is_admin', 'role', 'permissions')
      .first();
    
    // Sprawdź czy użytkownik ma uprawnienia administratora
    const isAdmin = user.is_admin === true || 
                  user.is_admin === 1 || 
                  user.is_admin === 't' || 
                  user.is_admin === 'TRUE' ||
                  user.is_admin === 'true' ||
                  user.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin privileges required' 
      }, { status: 403 });
    }
    
    // Rozpoczynamy transakcję, aby operacje były atomowe
    await db.transaction(async (trx) => {
      // 1. Najpierw sprawdzamy czy transport istnieje
      const transport = await trx('transports').where('id', id).first();
      
      if (!transport) {
        throw new Error('Transport not found');
      }
      
      // 2. Sprawdzamy czy transport jest powiązany z jakimś opakowaniem
      if (transport.packaging_id) {
        // Aktualizujemy opakowanie, aby usunąć referencję do transportu
        await trx('packagings')
          .where('id', transport.packaging_id)
          .update({
            transport_id: null,
            status: 'pending'  // Przywracamy status na "pending"
          });
        
        console.log(`Usunięto powiązanie z opakowaniem ${transport.packaging_id}`);
      }
      
      // 3. Sprawdzamy czy transport jest połączony z innymi transportami jako źródło
      const connectedTransports = await trx('transports')
        .where('connected_transport_id', id)
        .select('id');
      
      if (connectedTransports.length > 0) {
        // Aktualizujemy wszystkie transporty, które są powiązane z tym transportem
        await trx('transports')
          .where('connected_transport_id', id)
          .update({ connected_transport_id: null });
        
        console.log(`Usunięto powiązania z ${connectedTransports.length} transportami`);
      }
      
      // 4. Sprawdzamy czy transport jest połączony z innym transportem jako cel
      if (transport.connected_transport_id) {
        // Nie musimy nic robić, ponieważ usunięcie tego transportu 
        // nie wpłynie na transport źródłowy
        console.log(`Transport był połączony z transportem ${transport.connected_transport_id}`);
      }
      
      // 5. Usuwamy transport
      const deleted = await trx('transports').where('id', id).del();
      
      if (deleted === 0) {
        throw new Error('Nie udało się usunąć transportu');
      }
      
      console.log(`Usunięto transport o ID ${id}`);
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Transport deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting transport:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
