// src/utils/smsNotifications.js

/**
 * Wysyła powiadomienie SMS o odbiorze bębnów
 * @param {Object} transportData - Dane transportu
 * @param {Object} packagingData - Dane opakowania
 * @returns {Promise<Object>} - Wynik operacji wysyłania SMS
 */
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
  
  // Wysyłanie SMS
  try {
    const response = await fetch('/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: NUMER_TELEFONU,
        message: wiadomosc
      })
    });
    
    const wynik = await response.json();
    console.log('Wynik wysłania SMS:', wynik);
    return wynik;
  } catch (error) {
    console.error('Błąd wysyłania powiadomienia SMS:', error);
    return { success: false, error: error.message };
  }
}
