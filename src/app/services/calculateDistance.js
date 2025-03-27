// Funkcja do obliczania odległości za pomocą Google Distance Matrix API
export async function calculateDistance(originLat, originLng, destinationLat, destinationLng) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destinationLat},${destinationLng}&mode=driving&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0];
      
      if (element.status === 'OK' && element.distance) {
        // Distance Matrix API zwraca odległość w metrach, konwertujemy na kilometry
        return Math.round(element.distance.value / 1000);
      }
    }
    
    throw new Error('Nie udało się obliczyć odległości');
  } catch (error) {
    console.error('Błąd obliczania odległości:', error);
    // Fallback na obliczanie w linii prostej w razie problemów z API
    const R = 6371; // Promień Ziemi w km
    const dLat = (destinationLat - originLat) * Math.PI / 180;
    const dLon = (destinationLng - originLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(originLat * Math.PI / 180) * Math.cos(destinationLat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Odległość w km
    
    return Math.round(distance);
  }
}
