import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function DELETE(request: NextRequest) {
  try {
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    console.log('🧹 Limpiando todos los datos de google_maps...');

    // Eliminar todos los registros de google_maps
    const deleteResponse = await fetch(`${baseUrl}/rest/v1/google_maps`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('❌ Error limpiando google_maps:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Error limpiando datos de google_maps',
        details: { status: deleteResponse.status, body: errorText }
      }, { status: 500 });
    }

    console.log('✅ Datos de google_maps limpiados exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Datos de google_maps limpiados exitosamente'
    });

  } catch (error) {
    console.error('💥 Error limpiando google_maps:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
