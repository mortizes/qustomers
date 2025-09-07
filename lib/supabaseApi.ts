// API directa para Supabase usando REST API

import { config } from './config';
import { SupabaseCustomerRecord, SupabaseUpdateRecord, createUpdateRecord } from './dataMapper';

export interface SupabaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

// Headers para autenticación con Supabase
const getSupabaseHeaders = (useServiceRole: boolean = false): Record<string, string> => {
  const apiKey = useServiceRole ? config.supabase.serviceRoleKey : config.supabase.anonKey;
  
  return {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
};

export class SupabaseAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.supabase.url;
  }

  /**
   * Elimina todos los registros de la tabla
   */
  async clearTable(): Promise<SupabaseResponse> {
    try {
      console.log('🗑️ Limpiando tabla metabase_customers...');
      
      const response = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}?id=neq.00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers: getSupabaseHeaders(true), // Usar service role para operaciones administrativas
      });

      if (response.ok) {
        console.log('✅ Tabla limpiada exitosamente');
        return { success: true };
      } else {
        const errorText = await response.text();
        throw new Error(`Error al limpiar tabla: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('💥 Error al limpiar tabla:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Hace UPSERT inteligente con tracking de nuevos vs actualizados
   */
  async upsertBatchWithTracking(records: SupabaseCustomerRecord[]): Promise<SupabaseResponse<{
    inserted: number;
    updated: number;
    data: SupabaseCustomerRecord[];
  }>> {
    try {
      console.log(`🔄 Haciendo UPSERT con tracking de lote de ${records.length} registros...`);
      
      // Paso 1: Verificar cuáles registros ya existen
      const existingIds = records.map(r => r.id);
      const existingCheckResponse = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}?select=id&id=in.(${existingIds.join(',')})`, {
        method: 'GET',
        headers: getSupabaseHeaders(true),
      });
      
      let existingRecordIds: string[] = [];
      if (existingCheckResponse.ok) {
        const existingData = await existingCheckResponse.json();
        existingRecordIds = existingData.map((record: any) => record.id);
      }
      
      const newRecords = records.filter(r => !existingRecordIds.includes(r.id));
      const updateRecords = records.filter(r => existingRecordIds.includes(r.id));
      
      console.log(`📊 Análisis: ${newRecords.length} nuevos, ${updateRecords.length} para actualizar`);
      
      let insertedCount = 0;
      let updatedCount = 0;
      const allProcessedData: SupabaseCustomerRecord[] = [];
      
      // Paso 2: Insertar registros nuevos
      if (newRecords.length > 0) {
        console.log(`📤 Insertando ${newRecords.length} registros nuevos...`);
        
        const insertResponse = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}`, {
          method: 'POST',
          headers: {
            ...getSupabaseHeaders(true),
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(newRecords),
        });
        
        if (insertResponse.ok) {
          const insertedData = await insertResponse.json();
          insertedCount = Array.isArray(insertedData) ? insertedData.length : newRecords.length;
          allProcessedData.push(...(Array.isArray(insertedData) ? insertedData : [insertedData]));
          console.log(`✅ ${insertedCount} registros nuevos insertados`);
        }
      }
      
      // Paso 3: Actualizar registros existentes EN LOTES (OPTIMIZADO)
      if (updateRecords.length > 0) {
        console.log(`🔄 Actualizando ${updateRecords.length} registros existentes EN LOTES (solo 15 campos optimizados)...`);
        
        // Procesar actualizaciones en lotes de 100
        const batchSize = 100;
        for (let i = 0; i < updateRecords.length; i += batchSize) {
          const batch = updateRecords.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(updateRecords.length / batchSize);
          
          console.log(`📦 Actualizando lote ${batchNum}/${totalBatches} (${batch.length} registros)`);
          
          try {
            // Preparar datos optimizados para actualización (solo campos seleccionados)
            const updateData = batch.map(record => {
              try {
                return createUpdateRecord(record);
              } catch (recordError) {
                console.error(`❌ Error procesando registro ${record.id}:`, recordError);
                throw recordError;
              }
            });
            
            // Hacer UPSERT optimizado en lote
            const updateResponse = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}`, {
              method: 'POST',
              headers: {
                ...getSupabaseHeaders(true),
                'Prefer': 'resolution=merge-duplicates,return=representation'
              },
              body: JSON.stringify(updateData),
            });
            
            console.log(`📋 Enviando ${updateData.length} registros optimizados para actualización`);
            
            if (updateResponse.ok) {
              const updatedData = await updateResponse.json();
              const batchUpdatedCount = Array.isArray(updatedData) ? updatedData.length : batch.length;
              updatedCount += batchUpdatedCount;
              allProcessedData.push(...(Array.isArray(updatedData) ? updatedData : [updatedData]));
              console.log(`✅ Lote ${batchNum}: ${batchUpdatedCount} registros actualizados`);
            } else {
              const errorText = await updateResponse.text();
              console.error(`❌ Error HTTP en lote ${batchNum}: ${updateResponse.status} - ${errorText}`);
              throw new Error(`Error ${updateResponse.status}: ${errorText}`);
            }
          } catch (updateError) {
            console.error(`❌ Error actualizando lote ${batchNum}:`, updateError);
            throw updateError; // Re-lanzar para que se maneje en el nivel superior
          }
          
          // Pausa entre lotes para no sobrecargar
          if (i + batchSize < updateRecords.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        console.log(`✅ ${updatedCount} registros actualizados en total`);
      }
      
      return {
        success: (insertedCount + updatedCount) > 0,
        data: {
          inserted: insertedCount,
          updated: updatedCount,
          data: allProcessedData
        },
        count: insertedCount + updatedCount
      };
      
    } catch (error) {
      console.error(`💥 Error al hacer UPSERT con tracking:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Hace UPSERT de un lote de registros (INSERT o UPDATE según existan)
   */
  async upsertBatch(records: SupabaseCustomerRecord[]): Promise<SupabaseResponse<SupabaseCustomerRecord[]>> {
    try {
      console.log(`🔄 Haciendo UPSERT de lote de ${records.length} registros...`);
      
      // Preparar datos para UPSERT - remover created_at para preservar el original
      const upsertRecords = records.map(record => {
        const { created_at, ...recordWithoutCreatedAt } = record;
        return {
          ...recordWithoutCreatedAt,
          updated_at: new Date().toISOString(), // Actualizar siempre updated_at
        };
      });
      
      const response = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}`, {
        method: 'POST',
        headers: {
          ...getSupabaseHeaders(true), // Usar service role
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(upsertRecords),
      });

      if (response.ok) {
        const upsertedData = await response.json();
        console.log(`✅ Lote UPSERT: ${Array.isArray(upsertedData) ? upsertedData.length : records.length} registros procesados`);
        
        return {
          success: true,
          data: upsertedData,
          count: Array.isArray(upsertedData) ? upsertedData.length : records.length
        };
      } else {
        const errorText = await response.text();
        throw new Error(`Error al hacer UPSERT: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`💥 Error al hacer UPSERT:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Inserta un lote de registros (método original)
   */
  async insertBatch(records: SupabaseCustomerRecord[]): Promise<SupabaseResponse<SupabaseCustomerRecord[]>> {
    try {
      console.log(`📤 Insertando lote de ${records.length} registros...`);
      
      const response = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}`, {
        method: 'POST',
        headers: getSupabaseHeaders(true), // Usar service role
        body: JSON.stringify(records),
      });

      if (response.ok) {
        const insertedData = await response.json();
        console.log(`✅ Lote insertado: ${Array.isArray(insertedData) ? insertedData.length : records.length} registros`);
        
        return {
          success: true,
          data: insertedData,
          count: Array.isArray(insertedData) ? insertedData.length : records.length
        };
      } else {
        const errorText = await response.text();
        throw new Error(`Error al insertar lote: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`💥 Error al insertar lote:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Inserta un solo registro
   */
  async insertRecord(record: SupabaseCustomerRecord): Promise<SupabaseResponse<SupabaseCustomerRecord>> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}`, {
        method: 'POST',
        headers: getSupabaseHeaders(true),
        body: JSON.stringify(record),
      });

      if (response.ok) {
        const insertedData = await response.json();
        return {
          success: true,
          data: insertedData[0] || insertedData,
          count: 1
        };
      } else {
        const errorText = await response.text();
        throw new Error(`Error al insertar registro: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtiene el conteo de registros
   */
  async getCount(): Promise<SupabaseResponse<number>> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}?select=count`, {
        method: 'GET',
        headers: {
          ...getSupabaseHeaders(true),
          'Prefer': 'count=exact'
        },
      });

      if (response.ok) {
        // El conteo viene en el header Content-Range
        const contentRange = response.headers.get('content-range');
        let count = 0;
        
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)$/);
          count = match ? parseInt(match[1]) : 0;
        } else {
          // Fallback: usar la respuesta directa que ya sabemos que funciona
          const data = await response.json();
          count = data[0]?.count || 0;
        }
        
        return {
          success: true,
          data: count,
          count: count
        };
      } else {
        throw new Error(`Error al obtener conteo: ${response.status}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        count: 0
      };
    }
  }

  /**
   * Obtiene estadísticas completas de la base de datos
   */
  async getDatabaseStats(): Promise<SupabaseResponse<{
    total: number;
    byStatus: Record<string, number>;
    byCity: Record<string, number>;
    byScore: Record<string, number>;
    recentUpdates: number;
    avgScore: number;
    topCities: Array<{city: string; count: number}>;
    statusDistribution: Array<{status: string; count: number}>;
    lastUpdated?: string;
  }>> {
    try {
      console.log('📊 Obteniendo estadísticas completas de la base de datos...');
      
      // Obtener conteo total usando la misma lógica que funciona
      const totalResponse = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}?select=count`, {
        method: 'GET',
        headers: getSupabaseHeaders(true),
      });
      
      // Obtener la fecha más reciente del campo updated_at
      const lastUpdatedResponse = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}?select=updated_at&order=updated_at.desc&limit=1`, {
        method: 'GET',
        headers: getSupabaseHeaders(true),
      });
      
      let total = 0;
      let lastUpdated: string | undefined = undefined;
      
      if (totalResponse.ok) {
        const data = await totalResponse.json();
        total = data[0]?.count || 0;
        console.log('📊 Total de registros encontrados:', total);
      }
      
      if (lastUpdatedResponse.ok) {
        const data = await lastUpdatedResponse.json();
        lastUpdated = data[0]?.updated_at || undefined;
        console.log('📅 Última actualización encontrada:', lastUpdated);
      }
      
      return {
        success: true,
        data: {
          total: total,
          byStatus: {},
          byCity: {},
          byScore: {},
          recentUpdates: 0,
          avgScore: 0,
          topCities: [],
          statusDistribution: [],
          lastUpdated: lastUpdated
        }
      };

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtiene una muestra de datos
   */
  async getSample(limit: number = 5): Promise<SupabaseResponse<SupabaseCustomerRecord[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/${config.supabase.tableName}?limit=${limit}&select=id,name,city,score_cliente,estado_clientes,created_at,updated_at&order=updated_at.desc`, {
        method: 'GET',
        headers: getSupabaseHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        
        return {
          success: true,
          data: data,
          count: data.length
        };
      } else {
        throw new Error(`Error al obtener muestra: ${response.status}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        data: []
      };
    }
  }

  /**
   * Hace UPSERT de todos los registros en lotes (INSERT nuevos + UPDATE existentes)
   */
  async upsertAllRecords(records: SupabaseCustomerRecord[], batchSize: number = 100): Promise<SupabaseResponse> {
    try {
      console.log(`🔄 Iniciando UPSERT de ${records.length} registros en lotes de ${batchSize}...`);
      
      let totalProcessed = 0;
      let totalErrors = 0;
      const errorDetails = [];

      // Procesar en lotes usando UPSERT
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(records.length / batchSize);
        
        console.log(`📦 UPSERT lote ${batchNum}/${totalBatches} (${batch.length} registros)`);
        
        const batchResult = await this.upsertBatch(batch);
        
        if (batchResult.success) {
          totalProcessed += batchResult.count || batch.length;
        } else {
          totalErrors += batch.length;
          errorDetails.push(`Lote ${batchNum}: ${batchResult.error}`);
        }
        
        // Pausa entre lotes
        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`🎉 UPSERT completado: ${totalProcessed} procesados, ${totalErrors} errores`);

      return {
        success: totalProcessed > 0,
        count: totalProcessed,
        error: totalErrors > 0 ? `${totalErrors} errores en UPSERT` : undefined
      };

    } catch (error) {
      console.error('💥 Error en UPSERT masivo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Importa todos los registros en lotes (método original - solo INSERT)
   */
  async importAllRecords(records: SupabaseCustomerRecord[], batchSize: number = 100): Promise<SupabaseResponse> {
    try {
      console.log(`📊 Iniciando importación de ${records.length} registros en lotes de ${batchSize}...`);
      
      let totalImported = 0;
      let totalErrors = 0;
      const errorDetails = [];

      // Procesar en lotes
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(records.length / batchSize);
        
        console.log(`📦 Procesando lote ${batchNum}/${totalBatches} (${batch.length} registros)`);
        
        const batchResult = await this.insertBatch(batch);
        
        if (batchResult.success) {
          totalImported += batchResult.count || batch.length;
        } else {
          totalErrors += batch.length;
          errorDetails.push(`Lote ${batchNum}: ${batchResult.error}`);
        }
        
        // Pausa entre lotes
        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`🎉 Importación completada: ${totalImported} importados, ${totalErrors} errores`);

      return {
        success: totalImported > 0,
        count: totalImported,
        error: totalErrors > 0 ? `${totalErrors} errores en importación` : undefined
      };

    } catch (error) {
      console.error('💥 Error en importación masiva:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
}

// Instancia singleton
export const supabaseApi = new SupabaseAPI();
