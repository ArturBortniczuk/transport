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
  const textOptions = {
    align: 'left',
    baseline: 'top'
  }

  // 1. Nadawca (pole 1)
  const sender = transport.location === 'Producent' && transport.producerAddress
    ? [
        transport.producerAddress.city,
        transport.producerAddress.postalCode,
        transport.producerAddress.street,
        `Tel: ${transport.loadingContact}`
      ].join('\n')
    : `${transport.location}\nTel: ${transport.loadingContact}`
  
  safeAddText(sender, 20, 32, textOptions)

  // 2. Odbiorca (pole 2)
  const recipient = [
    transport.delivery.city,
    transport.delivery.postalCode,
    transport.delivery.street,
    `Tel: ${transport.unloadingContact}`
  ].join('\n')
  
  safeAddText(recipient, 20, 55, textOptions)

  // 3. Miejsce dostawy (pole 3)
  const deliveryAddress = [
    transport.delivery.city,
    transport.delivery.postalCode,
    transport.delivery.street
  ].join('\n')
  safeAddText(deliveryAddress, 20, 79, textOptions)

  // 4. Data i miejsce załadunku (pole 4)
  safeAddText(`${transport.location} ${transport.deliveryDate}`, 20, 104, textOptions)

  // 5. Załączone dokumenty (pole 5)
  safeAddText(transport.documents, 20, 120, textOptions)

  // Dane przewoźnika (pole 16)
  if (transport.response) {
    const carrierInfo = [
      `${transport.response.driverName} ${transport.response.driverSurname}`,
      `Telefon: ${transport.response.driverPhone}`,
      `Nr pojazdu: ${transport.response.vehicleNumber}`,
    ].join('\n')
    
    safeAddText(carrierInfo, 110, 55, textOptions)
  }

  // MPK (pole 13)
  safeAddText(`MPK: ${transport.mpk}`, 110, 197, textOptions)

}