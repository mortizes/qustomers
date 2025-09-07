import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    console.log('🔍 Probando conexión con Metabase...');
    console.log(`📡 URL base: ${baseUrl}`);
    console.log(`🔑 Service key: ${serviceKey ? 'Presente' : 'Faltante'}`);

    // Probar consulta simple
    const testUrl = `${baseUrl}/rest/v1/metabase_customers?select=id,name&limit=5`;
    console.log(`📡 URL de prueba: ${testUrl}`);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📊 Respuesta de Metabase:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error en conexión con Metabase:`, errorText);
      return NextResponse.json({
        success: false,
        error: 'Error en conexión con Metabase',
        details: { 
          status: response.status, 
          statusText: response.statusText,
          body: errorText,
          url: testUrl
        }
      }, { status: 500 });
    }

    const data = await response.json();
    console.log(`✅ Conexión exitosa con Metabase`);
    console.log(`📋 Datos obtenidos:`, data);

    return NextResponse.json({
      success: true,
      message: 'Conexión exitosa con Metabase',
      data: data,
      count: data.length
    });

  } catch (error) {
    console.error('💥 Error probando conexión con Metabase:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
