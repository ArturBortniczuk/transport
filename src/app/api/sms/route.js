// src/app/api/sms/route.js
import { NextResponse } from 'next/server';
import https from 'https';
import axios from 'axios';

export async function POST(request) {
  try {
    const { phoneNumber, message } = await request.json();
    
    if (!phoneNumber || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak numeru telefonu lub treści wiadomości' 
      }, { status: 400 });
    }
    
    // Konfiguracja API MultiInfo
    const url = `https://api2.multiinfo.plus.pl/sendsms.aspx?` +
      `login=ArturBortniczuk&` +
      `password=ArtBor.2025&` +
      `serviceId=21370&` +
      `dest=${phoneNumber}&` + 
      `text=${encodeURIComponent(message)}`;
    
    // Użyj Axios do wykonania żądania
    const response = await axios.get(url, {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Na produkcji powinno być true - tu wyłączamy dla testów
      })
    });
    
    if (!response.data || response.data.includes('ERROR')) {
      throw new Error(`Błąd API: ${response.data}`);
    }
    
    return NextResponse.json({ 
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
