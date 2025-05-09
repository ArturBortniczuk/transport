// src/app/api/sms/route.js - z certyfikatem jako zmienną środowiskową
import { NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

export async function POST(request) {
  try {
    console.log('API SMS - otrzymano żądanie');
    
    // Parsuj dane wejściowe
    let requestData;
    try {
      requestData = await request.json();
      console.log('API SMS - zdekodowane dane:', requestData);
    } catch (parseError) {
      console.error('API SMS - błąd parsowania danych wejściowych:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Nieprawidłowy format danych: ' + parseError.message 
      }, { status: 400 });
    }
    
    const { phoneNumber, message } = requestData;
    
    if (!phoneNumber || !message) {
      console.error('API SMS - brak numeru telefonu lub treści wiadomości');
      return NextResponse.json({ 
        success: false, 
        error: 'Brak numeru telefonu lub treści wiadomości' 
      }, { status: 400 });
    }
    
    console.log('API SMS - wysyłanie wiadomości:', { 
      phoneNumber, 
      message, 
      messageLength: message.length 
    });
    
    // Pobranie certyfikatu i klucza ze zmiennych środowiskowych
    const cert = process.env.SSL_CERT;
    const key = process.env.SSL_KEY || process.env.SSL_CERT; // Używamy SSL_KEY jeśli zdefiniowano osobno, w przeciwnym razie używamy SSL_CERT
    
    if (!cert) {
      console.error('API SMS - brak certyfikatu w zmiennych środowiskowych');
      return NextResponse.json({ 
        success: false, 
        error: 'Brak certyfikatu. Ustaw zmienną środowiskową SSL_CERT.' 
      }, { status: 500 });
    }
    
    console.log('API SMS - certyfikat znaleziony w zmiennych środowiskowych');
    
    // Konfiguracja API MultiInfo
    const url = `https://api2.multiinfo.plus.pl/sendsms.aspx?` +
      `login=ArturBortniczuk&` +
      `password=ArtBor.2025&` +
      `serviceId=21370&` +
      `dest=${phoneNumber}&` + 
      `text=${encodeURIComponent(message)}`;
    
    console.log('API SMS - URL API:', url);
    
    // Konfiguracja agenta HTTPS z certyfikatem
    let httpsAgent;
    try {
      httpsAgent = new https.Agent({
        cert: cert,
        key: key,
        rejectUnauthorized: false // Na produkcji można ustawić na true
      });
      console.log('API SMS - agent HTTPS utworzony pomyślnie');
    } catch (certError) {
      console.error('API SMS - błąd podczas tworzenia agenta HTTPS:', certError);
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd konfiguracji certyfikatu: ' + certError.message 
      }, { status: 500 });
    }
    
    // Użyj Axios do wykonania żądania
    try {
      console.log('API SMS - wysyłanie żądania HTTPS z certyfikatem');
      
      const response = await axios.get(url, {
        httpsAgent: httpsAgent,
        timeout: 15000 // 15 sekund timeout
      });
      
      console.log('API SMS - otrzymano odpowiedź:', {
        status: response.status,
        data: response.data
      });
      
      if (!response.data) {
        throw new Error('Brak danych w odpowiedzi');
      }
      
      if (response.data.includes('ERROR')) {
        throw new Error(`Błąd API: ${response.data}`);
      }
      
      return NextResponse.json({ 
        success: true,
        data: response.data
      });
    } catch (axiosError) {
      console.error('API SMS - błąd Axios:', axiosError);
      
      // Szczegółowy log błędu
      if (axiosError.response) {
        // Serwer odpowiedział kodem błędu
        console.error('API SMS - odpowiedź błędu:', {
          status: axiosError.response.status,
          data: axiosError.response.data
        });
      } else if (axiosError.request) {
        // Żądanie zostało wykonane, ale nie otrzymano odpowiedzi
        console.error('API SMS - brak odpowiedzi:', axiosError.request);
      } else {
        // Coś poszło nie tak podczas konfiguracji żądania
        console.error('API SMS - błąd konfiguracji:', axiosError.message);
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Błąd komunikacji z serwisem SMS: ' + (axiosError.message || 'Nieznany błąd'),
        details: axiosError.response?.data
      }, { status: 500 });
    }
  } catch (error) {
    console.error('API SMS - krytyczny błąd:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Krytyczny błąd API SMS: ' + error.message
    }, { status: 500 });
  }
}
