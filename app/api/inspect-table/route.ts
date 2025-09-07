import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    console.log('🔍 Inspeccionando estructura de la tabla metabase_customers...');

    // Obtener un registro de muestra para ver qué columnas tiene
    const sampleUrl = `${baseUrl}/rest/v1/metabase_customers?limit=1`;
    console.log(`📡 URL de muestra: ${sampleUrl}`);
    
    const response = await fetch(sampleUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📊 Respuesta:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error obteniendo muestra:`, errorText);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo muestra de la tabla',
        details: { status: response.status, body: errorText }
      }, { status: 500 });
    }

    const data = await response.json();
    console.log(`✅ Datos obtenidos:`, data);

    if (data.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'La tabla está vacía',
        columns: [],
        sampleData: null
      });
    }

    const sampleRecord = data[0];
    const columns = Object.keys(sampleRecord);

    console.log(`📋 Columnas encontradas:`, columns);

    return NextResponse.json({
      success: true,
      message: 'Estructura de tabla inspeccionada',
      columns: columns,
      sampleData: sampleRecord,
      totalColumns: columns.length
    });

  } catch (error) {
    console.error('💥 Error inspeccionando tabla:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
