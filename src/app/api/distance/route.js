// src/app/api/distance/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const origins = searchParams.get('origins');
  const destinations = searchParams.get('destinations');
  
  if (!origins || !destinations) {
    return NextResponse.json({ 
      error: 'Missing origins or destinations parameters' 
    }, { status: 400 });
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching distance:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch distance data' 
    }, { status: 500 });
  }
}