// src/app/api/distance/route.js
import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const origins = searchParams.get('origins');
  const destinations = searchParams.get('destinations');
  
  if (!origins || !destinations) {
    return NextResponse.json({ 
      error: 'Missing origins or destinations parameters' 
    }, { status: 400, headers: corsHeaders });
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching distance:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch distance data' 
    }, { status: 500, headers: corsHeaders });
  }
}