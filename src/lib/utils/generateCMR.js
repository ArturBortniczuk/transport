import { jsPDF } from 'jspdf'

export async function generateCMR(transport) {
  try {
    console.log('Starting CMR generation')
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      floatPrecision: 16,
      hotfixes: ["px_scaling"]
    })

    // Funkcja pomocnicza do konwersji polskich znaków
    function convertPolishChars(text) {
      const polishChars = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 
        'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 
        'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
      };
      
      return text.split('').map(char => polishChars[char] || char).join('');
    }

    // Ustaw domyślną czcionkę
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)

    // Szablon CMR - 4 kopie
    const templates = [
      '/cmr-templates/cmr-1.jpg',  // Oryginał dla nadawcy
      '/cmr-templates/cmr-2.jpg',  // Kopia dla odbiorcy
      '/cmr-templates/cmr-3.jpg',  // Kopia dla przewoźnika
      '/cmr-templates/cmr-4.jpg'   // Kopia dla wystawcy
    ]

    // Funkcja do ładowania obrazów
    const loadImage = (src) => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'Anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    }

    // Funkcja do bezpiecznego dodawania tekstu
    const safeAddText = (text, x, y, options = {}) => {
      try {
        const convertedText = convertPolishChars(text)
        doc.text(convertedText, x, y, { 
          ...options,
          charSpace: 0.5
        })
      } catch (error) {
        console.error('Error adding text:', text, error)
      }
    }

    // Załaduj wszystkie szablony
    try {
      const images = await Promise.all(templates.map(loadImage))
      
      // Dodaj strony z szablonami
      images.forEach((img, index) => {
        if (index > 0) doc.addPage()
        doc.addImage(img, 'JPEG', 0, 0, 210, 297)  // A4: 210x297mm
        
        // Dodaj zawartość na każdej stronie
        addPageContent(doc, transport, safeAddText)
      })
      
    } catch (error) {
      console.error('Błąd podczas ładowania szablonów:', error)
      // Jeśli nie udało się załadować szablonów, generuj bez nich
      for (let i = 0; i < 4; i++) {
        if (i > 0) doc.addPage()
        addPageContent(doc, transport, safeAddText)
      }
    }

    doc.save(`CMR_${transport.id}.pdf`)
    console.log('CMR generated successfully')

  } catch (error) {
    console.error('Error generating CMR:', error)
    alert('Błąd podczas generowania CMR: ' + error.message)
  }
}

// Funkcja dodająca zawartość na stronę
function addPageContent(doc, transport, safeAddText) {
  // DODAJ TE LOGI NA POCZĄTKU FUNKCJI:
  console.log('=== DEBUG CMR GENERATION ===');
  console.log('Cały obiekt transport:', transport);
  console.log('transport.order_data:', transport.order_data);
  console.log('transport.goodsDescription:', transport.goodsDescription);
  console.log('transport.response:', transport.response);
  
  const textOptions = {
    align: 'left',
    baseline: 'top'
  }

  // Definiujemy dane adresowe magazynów
  const magazynData = {
    'Magazyn Białystok': {
      nazwa: 'Magazyn Białystok',
      adres: 'Grupa Eltron Sp. z o.o.\nul. Wysockiego 69B\n15-169 Białystok'
    },
    'Magazyn Zielonka': {
      nazwa: 'Magazyn Zielonka',
      adres: 'Grupa Eltron Sp. z o.o.\nul. Krótka 2\n05-220 Zielonka'
    }
  };

  // 1. Nadawca (pole 1)
  let sender;
  if (transport.location === 'Producent' && transport.producerAddress) {
    sender = [
      transport.producerAddress.city,
      transport.producerAddress.postalCode,
      transport.producerAddress.street,
      `Tel: ${transport.loadingContact}`
    ].join('\n');
  } else if (magazynData[transport.location]) {
    // Użyj pełnego adresu magazynu
    sender = `${magazynData[transport.location].adres}\nTel: ${transport.loadingContact}`;
  } else {
    sender = `${transport.location}\nTel: ${transport.loadingContact}`;
  }
  
  safeAddText(sender, 20, 32, textOptions);

  // 2. Odbiorca (pole 2)
  const recipient = [
    transport.delivery.city,
    transport.delivery.postalCode,
    transport.delivery.street,
    `Tel: ${transport.unloadingContact}`
  ].join('\n');
  
  safeAddText(recipient, 20, 55, textOptions);

  // 3. Miejsce dostawy (pole 3)
  const deliveryAddress = [
    transport.delivery.city,
    transport.delivery.postalCode,
    transport.delivery.street
  ].join('\n');
  safeAddText(deliveryAddress, 20, 79, textOptions);

  // 4. Data i miejsce załadunku (pole 4) - usuwamy godzinę z daty
  // Formatujemy datę aby usunąć godzinę
  let deliveryDate = '';
  if (transport.deliveryDate) {
    const date = new Date(transport.deliveryDate);
    deliveryDate = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
  }
  
  let locationText = transport.location;
  if (magazynData[transport.location]) {
    locationText = transport.location; // Zostawiamy tylko nazwę magazynu w tym polu
  }
  
  safeAddText(`${locationText} ${deliveryDate}`, 20, 104, textOptions);

  // 5. Załączone dokumenty (pole 5)
  safeAddText(transport.documents, 20, 120, textOptions);

  // Dane przewoźnika (pole 16)
  if (transport.response) {
    const carrierInfo = [
      `${transport.response.driverName} ${transport.response.driverSurname}`,
      `Telefon: ${transport.response.driverPhone}`,
      `Nr pojazdu: ${transport.response.vehicleNumber}`,
    ].join('\n');
    
    safeAddText(carrierInfo, 110, 55, textOptions);
  }

  // 6. Rodzaj towaru (Nature of the goods) - ZMODYFIKOWANE
  let goodsDescription = '';
  
  console.log('=== SPRAWDZANIE DANYCH TOWARU ===');
  
  // Sprawdź czy są dane ze zlecenia transportowego (order_data)
  if (transport.order_data) {
    console.log('Znaleziono transport.order_data:', transport.order_data);
    try {
      const orderData = typeof transport.order_data === 'string' ? 
        JSON.parse(transport.order_data) : transport.order_data;
      
      console.log('Rozparsowane orderData:', orderData);
      console.log('orderData.towar:', orderData.towar);
      
      if (orderData.towar) {
        goodsDescription = orderData.towar;
        console.log('Używam towaru ze zlecenia transportowego:', goodsDescription);
      }
    } catch (error) {
      console.error('Błąd parsowania order_data:', error);
    }
  } else {
    console.log('Brak transport.order_data');
  }
  
  // Jeśli nie ma danych ze zlecenia transportowego, sprawdź inne źródła
  if (!goodsDescription) {
    console.log('Sprawdzam alternatywne źródła towaru...');
    if (transport.response && transport.response.goodsDescription) {
      goodsDescription = transport.response.goodsDescription;
      console.log('Używam towaru z response.goodsDescription:', goodsDescription);
    } else if (transport.goodsDescription && transport.goodsDescription.description) {
      goodsDescription = transport.goodsDescription.description;
      console.log('Używam towaru z goodsDescription.description:', goodsDescription);
    }
  }
  
  console.log('FINALNA WARTOŚĆ goodsDescription:', goodsDescription);
  safeAddText(goodsDescription, 20, 495, textOptions);

  // 11. Waga brutto - ZMODYFIKOWANE
  let weight = '';
  
  console.log('=== SPRAWDZANIE DANYCH WAGI ===');
  
  // Sprawdź czy są dane ze zlecenia transportowego (order_data)
  if (transport.order_data) {
    console.log('Znaleziono transport.order_data dla wagi:', transport.order_data);
    try {
      const orderData = typeof transport.order_data === 'string' ? 
        JSON.parse(transport.order_data) : transport.order_data;
      
      console.log('Rozparsowane orderData dla wagi:', orderData);
      console.log('orderData.waga:', orderData.waga);
      
      if (orderData.waga) {
        weight = orderData.waga;
        console.log('Używam wagi ze zlecenia transportowego:', weight);
      }
    } catch (error) {
      console.error('Błąd parsowania order_data dla wagi:', error);
    }
  } else {
    console.log('Brak transport.order_data dla wagi');
  }
  
  // Jeśli nie ma danych ze zlecenia transportowego, sprawdź inne źródła
  if (!weight) {
    console.log('Sprawdzam alternatywne źródła wagi...');
    if (transport.response && transport.response.weight) {
      weight = transport.response.weight;
      console.log('Używam wagi z response.weight:', weight);
    } else if (transport.goodsDescription && transport.goodsDescription.weight) {
      weight = transport.goodsDescription.weight;
      console.log('Używam wagi z goodsDescription.weight:', weight);
    }
  }
  
  console.log('FINALNA WARTOŚĆ weight:', weight);
  safeAddText(weight, 560, 495, textOptions);

  // MPK (pole 13)
  safeAddText(`MPK: ${transport.mpk}`, 110, 197, textOptions);
}
