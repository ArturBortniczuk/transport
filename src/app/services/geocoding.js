// Funkcja do geokodowania adresu za pomocą OpenStreetMap Nominatim
export async function getCoordinates(city, postalCode, street = '') {
    try {
      const address = `${street}, ${postalCode} ${city}, Poland`
      const query = encodeURIComponent(address)
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
        {
          headers: {
            'User-Agent': 'TransportSystem/1.0'
          }
        }
      )
      
      const data = await response.json()
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        }
      }
      
      throw new Error('Nie znaleziono lokalizacji')
    } catch (error) {
      console.error('Błąd geokodowania:', error)
      throw error
    }
  }