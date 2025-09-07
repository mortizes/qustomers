import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

interface CleanupRequest {
  processedRecordIds: number[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Iniciando limpieza de registros procesados...');
    
    const body: CleanupRequest = await request.json();
    const { processedRecordIds } = body;
    
    if (!processedRecordIds || processedRecordIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay registros para limpiar',
        cleanedCount: 0,
      });
    }
    
    console.log(`🧹 Limpiando ${processedRecordIds.length} registros procesados...`);
    
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;
    
    // Eliminar registros en lotes para evitar problemas de tamaño
    const batchSize = 50;
    let totalCleaned = 0;
    
    for (let i = 0; i < processedRecordIds.length; i += batchSize) {
      const batch = processedRecordIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(processedRecordIds.length / batchSize);
      
      console.log(`🧹 Limpiando lote ${batchNumber}/${totalBatches} (${batch.length} registros)...`);
      
      // Construir filtro OR para múltiples IDs
      const filters = batch.map(id => `id.eq.${id}`).join(',');
      const deleteUrl = `${baseUrl}/rest/v1/google_maps_pending?or=(${filters})`;
      
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
      });
      
      if (deleteResponse.ok) {
        totalCleaned += batch.length;
        console.log(`✅ Lote ${batchNumber}/${totalBatches} limpiado exitosamente`);
      } else {
        console.log(`⚠️ Error limpiando lote ${batchNumber}/${totalBatches}: ${deleteResponse.status}`);
      }
      
      // Pequeña pausa entre lotes
      if (i + batchSize < processedRecordIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Limpieza completada: ${totalCleaned} registros eliminados de ${processedRecordIds.length} solicitados`);
    
    return NextResponse.json({
      success: true,
      message: `Limpieza completada: ${totalCleaned} registros eliminados`,
      cleanedCount: totalCleaned,
      requestedCount: processedRecordIds.length,
    });
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en limpieza',
    }, { status: 500 });
  }
}
