// Ulepszona funkcja w src/utils/smsNotifications.js

export async function wyslijPowiadomienieOdbioruBebnow(transportData, packagingData) {
  // Domyślny numer telefonu
  const NUMER_TELEFONU = '732654982';
  
  // Określ magazyn
  const nazwaMagazynu = transportData.source_warehouse === 'bialystok' 
    ? 'magazyn Białystok' 
    : 'magazyn Zielonka';
  
  // Formatowanie daty (zakładamy, że transportData.delivery_date jest w formacie ISO)
  const dataDostawy = new Date(transportData.delivery_date);
  const sformatowanaData = `${dataDostawy.getDate()}.${dataDostawy.getMonth() + 1}.${dataDostawy.getFullYear()}`;
  
  // Przygotuj treść wiadomości
  const nazwaKlienta = packagingData.client_name || transportData.client_name || 'nieznany klient';
  
  // Wyciągnij numery opakowań z opisu pakowania (jeśli są dostępne)
  let informacjeOOpakowaniach = 'brak informacji o numerach';
  if (packagingData.description) {
    const linie = packagingData.description.split('\n');
    // Szukaj linii zawierającej numery opakowań
    const liniaOpakowan = linie.find(linia => 
      linia.toLowerCase().includes('opakowania:') || 
      linia.toLowerCase().includes('bębny:') ||
      linia.toLowerCase().includes('numery:')
    );
    
    if (liniaOpakowan) {
      // Usuń nagłówek i zostaw tylko numery
      informacjeOOpakowaniach = liniaOpakowan.replace(/opakowania:|bębny:|numery:/i, '').trim();
    }
  }
  
  // Tworzenie wiadomości
  const wiadomosc = `Cześć Edzia, ${nazwaMagazynu} odbierze bębny od klienta "${nazwaKlienta}" w dniu ${sformatowanaData}. Bębny to: ${informacjeOOpakowaniach}`;
  
  console.log('Wysyłam SMS:', wiadomosc);
  console.log('Na numer:', NUMER_TELEFONU);
  
  // Wysyłanie SMS
  try {
    console.log('Wykonuję zapytanie do API SMS...');
    
    const requestBody = {
      phoneNumber: NUMER_TELEFONU,
      message: wiadomosc
    };
    
    console.log('Dane zapytania:', requestBody);
    
    const response = await fetch('/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Status odpowiedzi API SMS:', response.status);
    
    const responseText = await response.text();
    console.log('Surowa odpowiedź API SMS:', responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Błąd parsowania odpowiedzi JSON:', jsonError);
      return { success: false, error: 'Nieprawidłowa odpowiedź JSON', rawResponse: responseText };
    }
    
    console.log('Sparsowana odpowiedź API SMS:', responseData);
    
    if (!response.ok) {
      throw new Error(`Błąd API SMS: ${response.status} - ${responseData.error || 'Nieznany błąd'}`);
    }
    
    return responseData;
  } catch (error) {
    console.error('Błąd wysyłania powiadomienia SMS:', error);
    return { success: false, error: error.message || 'Nieznany błąd' };
  }
}
