// src/app/api/test-dhl/route.js
import { NextResponse } from 'next/server';
import DHLApiService from '@/app/services/dhl-api';

export async function GET(request) {
  try {
    console.log('🧪 Testowanie DHL createShipments z prawdziwymi danymi...');
    
    const createShipmentsTest = await DHLApiService.testCreateShipments();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      title: '🚚 Test DHL createShipments (WebAPI2)',
      
      createShipmentsTest: createShipmentsTest,
      
      environment: {
        DHL_LOGIN: process.env.DHL_LOGIN,
        DHL_ACCOUNT_NUMBER: process.env.DHL_ACCOUNT_NUMBER,
        DHL_TEST_MODE: process.env.DHL_TEST_MODE
      },
      
      result: createShipmentsTest.success 
        ? `✅ SUCCESS! ShipmentId: ${createShipmentsTest.shipmentId}`
        : `❌ FAILED: ${createShipmentsTest.error}`
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Funkcja generująca następne kroki na podstawie diagnozy
function generateNextSteps(diagnosis) {
  const steps = [];
  
  if (!diagnosis.environment.hasLogin) {
    steps.push('🚨 KRYTYCZNE: Ustaw zmienną środowiskową DHL_LOGIN');
  }
  
  if (!diagnosis.environment.hasPassword) {
    steps.push('🚨 KRYTYCZNE: Ustaw zmienną środowiskową DHL_PASSWORD_DHL24');
  }
  
  if (!diagnosis.environment.hasAccountNumber) {
    steps.push('🚨 KRYTYCZNE: Ustaw zmienną środowiskową DHL_ACCOUNT_NUMBER');
  }
  
  if (diagnosis.tests.credentialCombinations?.workingVariants?.length > 0) {
    const workingVariant = diagnosis.tests.credentialCombinations.workingVariants[0];
    steps.push(`✅ UŻYJ: ${workingVariant.name} - ta konfiguracja działa!`);
    steps.push(`📋 WSDL: ${workingVariant.wsdl}`);
    steps.push(`🔐 AUTH: ${JSON.stringify(workingVariant.auth)}`);
  } else {
    steps.push('❌ Brak działającej konfiguracji - wymagana interwencja');
    steps.push('📞 Skontaktuj się z DHL Support lub sprawdź dane logowania');
  }
  
  if (diagnosis.tests.dataValidation?.issues?.length > 0) {
    steps.push('⚠️ PROBLEMY Z DANYMI:');
    diagnosis.tests.dataValidation.issues.forEach(issue => {
      steps.push(`   - ${issue}`);
    });
  }
  
  return steps;
}

export async function POST(request) {
  try {
    // Test z własnymi danymi
    const customData = await request.json();
    console.log('🧪 Test DHL z custom danymi:', customData);
    
    // Jeśli podano credentials, użyj ich
    if (customData.testCredentials) {
      console.log('🔧 Testowanie z custom credentials...');
      
      // Stwórz tymczasową instancję z custom credentials
      const tempService = Object.create(DHLApiService);
      tempService.login = customData.testCredentials.login;
      tempService.password = customData.testCredentials.password;
      tempService.accountNumber = customData.testCredentials.accountNumber;
      
      const result = await tempService.testCredentialCombinations();
      
      return NextResponse.json({
        success: true,
        result: result,
        customData: customData,
        note: 'Test z custom credentials zakończony'
      });
    }
    
    // Standardowy test
    const result = await DHLApiService.createShipment(customData);
    
    return NextResponse.json({
      success: true,
      result: result,
      customData: customData,
      note: 'Test z danymi zamówienia zakończony'
    });
    
  } catch (error) {
    console.error('❌ Błąd custom testu DHL:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
