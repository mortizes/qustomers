import { NextResponse } from 'next/server';
import { metabaseApi } from '@/lib/metabase';
import { mapMetabaseToSupabase, prepareForSupabase } from '@/lib/dataMapper';
import { supabaseApi } from '@/lib/supabaseApi';

export async function POST() {
  try {
    console.log('🚀 Iniciando sincronización inteligente del Card 7391...');
    
    const startTime = Date.now();
    const result = {
      success: false,
      steps: [] as string[],
      metabase: { cardId: 7391, rows: 0, columns: 0, executionTime: 0 },
      mapping: { processed: 0, valid: 0, errors: 0 },
      supabase: { 
        totalBefore: 0,
        totalAfter: 0,
        inserted: 0, 
        updated: 0, 
        errors: 0, 
        details: [] as string[] 
      },
      verification: { count: 0, sample: [] as any[] },
      analytics: {
        topCities: [] as any[],
        statusDistribution: [] as any[],
        avgScore: 0,
        recentUpdates: 0
      },
      totalTime: 0,
    };

    // Paso 0: Obtener estadísticas iniciales
    result.steps.push('📊 Obteniendo estadísticas iniciales de Supabase...');
    console.log('📊 Consultando estado inicial de la base de datos...');
    
    const initialStats = await supabaseApi.getDatabaseStats();
    if (initialStats.success) {
      result.supabase.totalBefore = initialStats.data?.total || 0;
      result.steps.push(`📋 Estado inicial: ${result.supabase.totalBefore} registros en Supabase`);
    }

    // Paso 1: Obtener datos de Metabase
    result.steps.push('📊 Obteniendo datos actualizados del Card 7391 de Metabase...');
    console.log('📊 Consultando Card 7391...');
    
    const metabaseStart = Date.now();
    const tableData = await metabaseApi.getCardData(7391, 2000);
    const metabaseTime = Date.now() - metabaseStart;
    
    result.metabase = {
      cardId: 7391,
      rows: tableData.rows.length,
      columns: tableData.columns.length,
      executionTime: metabaseTime,
    };
    
    result.steps.push(`✅ Datos obtenidos: ${tableData.rows.length} filas, ${tableData.columns.length} columnas (${Math.round(metabaseTime/1000)}s)`);
    console.log(`✅ Datos obtenidos de Metabase: ${tableData.rows.length} filas`);

    if (tableData.rows.length === 0) {
      throw new Error('No se obtuvieron datos del Card 7391');
    }

    // Paso 2: Mapear datos
    result.steps.push('🗺️ Mapeando datos CSV a estructura SQL...');
    console.log('🗺️ Iniciando mapeo de datos...');
    
    const mappedRecords = mapMetabaseToSupabase(tableData.columns, tableData.rows);
    const preparedRecords = prepareForSupabase(mappedRecords);
    
    result.mapping = {
      processed: tableData.rows.length,
      valid: preparedRecords.length,
      errors: tableData.rows.length - preparedRecords.length,
    };
    
    result.steps.push(`✅ Mapeo completado: ${preparedRecords.length} registros válidos`);
    console.log(`✅ Mapeo completado: ${preparedRecords.length} registros válidos`);

    if (preparedRecords.length === 0) {
      throw new Error('No se pudieron mapear los datos correctamente');
    }

    // Paso 3: Sincronización inteligente con tracking detallado
    result.steps.push(`🔄 Analizando registros para UPSERT inteligente...`);
    console.log(`🔄 Iniciando UPSERT con tracking de ${preparedRecords.length} registros...`);
    
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const batchSize = 100;
    
    try {
      // Procesar en lotes con tracking detallado
      for (let i = 0; i < preparedRecords.length; i += batchSize) {
        const batch = preparedRecords.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(preparedRecords.length / batchSize);
        
        console.log(`📦 Procesando lote ${batchNum}/${totalBatches} con tracking (${batch.length} registros)`);
        result.steps.push(`📦 Lote ${batchNum}/${totalBatches}: analizando ${batch.length} registros...`);
        
        const batchResult = await supabaseApi.upsertBatchWithTracking(batch);
        
        if (batchResult.success && batchResult.data) {
          totalInserted += batchResult.data.inserted;
          totalUpdated += batchResult.data.updated;
          
          console.log(`✅ Lote ${batchNum}: ${batchResult.data.inserted} nuevos, ${batchResult.data.updated} actualizados`);
          result.steps.push(`✅ Lote ${batchNum}: ${batchResult.data.inserted} nuevos + ${batchResult.data.updated} actualizados`);
        } else {
          totalErrors += batch.length;
          result.steps.push(`❌ Error en lote ${batchNum}: ${batchResult.error}`);
        }
        
        // Pausa entre lotes
        if (i + batchSize < preparedRecords.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      result.supabase = {
        totalBefore: result.supabase.totalBefore,
        totalAfter: result.supabase.totalBefore + totalInserted, // Los actualizados no cambian el total
        inserted: totalInserted,
        updated: totalUpdated,
        errors: totalErrors,
        details: [
          `✅ ${totalInserted} registros NUEVOS insertados`,
          `🔄 ${totalUpdated} registros EXISTENTES actualizados`,
          `❌ ${totalErrors} errores en procesamiento`,
          `📊 Total procesado: ${totalInserted + totalUpdated} de ${preparedRecords.length}`,
          `🔧 Método: UPSERT inteligente con tracking`,
          `⏱️ Preservado: ID y created_at originales`
        ],
      };
      
      result.steps.push(`✅ SINCRONIZACIÓN COMPLETA:`);
      result.steps.push(`📤 Nuevos insertados: ${totalInserted}`);
      result.steps.push(`🔄 Existentes actualizados: ${totalUpdated}`);
      result.steps.push(`❌ Errores: ${totalErrors}`);
      
      console.log(`✅ SINCRONIZACIÓN: ${totalInserted} nuevos + ${totalUpdated} actualizados`);
      
    } catch (syncError) {
      result.supabase = {
        totalBefore: result.supabase.totalBefore,
        totalAfter: result.supabase.totalBefore,
        inserted: totalInserted,
        updated: totalUpdated,
        errors: preparedRecords.length - (totalInserted + totalUpdated),
        details: [`❌ Error general: ${syncError instanceof Error ? syncError.message : 'Error desconocido'}`],
      };
      
      result.steps.push(`❌ Error en sincronización: ${syncError instanceof Error ? syncError.message : 'Error desconocido'}`);
      console.error('❌ Error en sincronización:', syncError);
    }

    // Paso 4: Obtener estadísticas finales y analítica
    const totalProcessed = totalInserted + totalUpdated;
    if (totalProcessed > 0) {
      result.steps.push('📊 Obteniendo estadísticas finales y analítica...');
      console.log('📊 Generando analítica final...');
      
      try {
        const finalStats = await supabaseApi.getDatabaseStats();
        const sampleData = await supabaseApi.getSample(5);
        
        if (finalStats.success) {
          result.supabase.totalAfter = finalStats.data?.total || 0;
          result.analytics = {
            topCities: finalStats.data?.topCities || [],
            statusDistribution: finalStats.data?.statusDistribution || [],
            avgScore: finalStats.data?.avgScore || 0,
            recentUpdates: finalStats.data?.recentUpdates || 0
          };
        }
        
        if (sampleData.success) {
          result.verification = {
            count: result.supabase.totalAfter,
            sample: sampleData.data || [],
          };
        }
        
        result.steps.push(`📊 Estadísticas finales: ${result.supabase.totalAfter} registros totales`);
        result.steps.push(`📈 Score promedio: ${result.analytics.avgScore.toFixed(1)}`);
        result.steps.push(`🏙️ Top ciudad: ${result.analytics.topCities[0]?.city || 'N/A'} (${result.analytics.topCities[0]?.count || 0} restaurantes)`);
        
        console.log(`📊 Estadísticas finales generadas`);
        
      } catch (statsError) {
        result.steps.push(`⚠️ Error obteniendo estadísticas finales`);
        console.warn('⚠️ Error en estadísticas:', statsError);
      }
    }

    result.success = totalProcessed > 0;
    result.totalTime = Date.now() - startTime;
    
    result.steps.push(`🎉 Sincronización inteligente completada en ${Math.round(result.totalTime/1000)} segundos`);
    result.steps.push(`📊 Resumen final: ${result.supabase.totalBefore} → ${result.supabase.totalAfter} registros (+${totalInserted} nuevos, ~${totalUpdated} actualizados)`);
    
    console.log(`🎉 Sincronización completada: ${totalInserted} nuevos + ${totalUpdated} actualizados en ${Math.round(result.totalTime/1000)}s`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('💥 Error en sincronización inteligente:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
