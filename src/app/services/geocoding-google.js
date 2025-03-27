// Funkcja do geokodowania adresu za pomocą Google Maps Geocoding API
export async function getGoogleCoordinates(city, postalCode, street = '') {
  try {
    const address = `${street}, ${postalCode} ${city}, Poland`;
    const query = encodeURIComponent(address);
    
    // Użyj Google Maps Geocoding API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
    
    throw new Error('Nie znaleziono lokalizacji');
  } catch (error) {
    console.error('Błąd geokodowania Google:', error);
    throw error;
  }
}
