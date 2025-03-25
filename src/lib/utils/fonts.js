export function addFont(doc) {
    // Base64-encoded Roboto font with Polish characters
    const fontBase64 = 'YOUR_BASE64_FONT_HERE'  // Tu trzeba wstawić zakodowaną czcionkę
    
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto-Regular', 'normal')
  }