// src/app/api/sms/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { phoneNumber, message } = await request.json();
    
    if (!phoneNumber || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak numeru telefonu lub treści wiadomości' 
      }, { status: 400 });
    }
    
    // Konfiguracja API Plus MultiInfo
    const apiUrl = 'https://api2.multiinfo.plus.pl/messages'; // Sprawdź dokładny URL w dokumentacji
    const apiKey = process.env.MULTIINFO_API_KEY; // Ustaw to w zmiennych środowiskowych Vercel
    
    // Przygotowanie danych dla API
    const smsData = {
      recipient: phoneNumber,
      text: message,
      sender: "TRANSPORT", // Twój zdefiniowany nadawca (SENDER ID)
      type: "sms"
    };
    
    // Wysłanie SMS-a przez API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(smsData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Błąd podczas wysyłania SMS-a');
    }
    
    return NextResponse.json({ 
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}