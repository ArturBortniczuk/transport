// Ulepszona funkcja w src/utils/smsNotifications.js

export async function wyslijPowiadomienieOdbioruBebnow(transportData, packagingData) {
  // Domyślny numer telefonu
  const NUMER_TELEFONU = '885851594';
  
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
    // Dzielimy opis na linie
    const linie = packagingData.description.split('\n');
    
    // Szukamy linii nagłówka "Opakowania:"
    let indeksOpakowaniaStart = -1;
    
    for (let i = 0; i < linie.length; i++) {
      const linia = linie[i].trim().toLowerCase();
      if (linia === 'opakowania:' || linia.startsWith('opakowania:') || 
          linia === 'bębny:' || linia.startsWith('bębny:') || 
          linia === 'numery:' || linia.startsWith('numery:')) {
        indeksOpakowaniaStart = i;
        break;
      }
    }
    
    // Jeśli znaleźliśmy nagłówek, zbieramy wszystkie linie poniżej do następnego nagłówka
    if (indeksOpakowaniaStart >= 0) {
      const informacje = [];
      
      // Dodajemy wszystkie linie po nagłówku, aż do następnego nagłówka lub końca tekstu
      for (let i = indeksOpakowaniaStart + 1; i < linie.length; i++) {
        const linia = linie[i].trim();
        
        // Jeśli linia jest pusta lub to nowy nagłówek, przerywamy
        if (linia === '' || linia.endsWith(':')) {
          break;
        }
        
        informacje.push(linia);
      }
      
      // Jeśli znaleźliśmy jakieś informacje, łączymy je
      if (informacje.length > 0) {
        informacjeOOpakowaniach = informacje.join(', ');
      }
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
