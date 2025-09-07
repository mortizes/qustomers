import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { outscraperService } from '@/lib/outscraperService';
import { validateGoogleMapsData, logValidationResults } from '@/lib/dataValidator';

// Función para analizar errores específicos de Supabase
function analyzeSupabaseError(errorText: string, data: any, recordId: string) {
  console.log(`🔍 ANÁLISIS DE ERROR SUPABASE para registro ${recordId}:`);
  
  // Analizar tipos de errores comunes
  if (errorText.includes('invalid input syntax')) {
    console.log(`   🚨 ERROR: Sintaxis de entrada inválida`);
    if (errorText.includes('latitude')) {
      console.log(`   📍 Problema con latitude: "${data.latitude}" (tipo: ${typeof data.latitude})`);
    }
    if (errorText.includes('longitude')) {
      console.log(`   📍 Problema con longitude: "${data.longitude}" (tipo: ${typeof data.longitude})`);
    }
    if (errorText.includes('rating')) {
      console.log(`   ⭐ Problema con rating: "${data.rating}" (tipo: ${typeof data.rating})`);
    }
    if (errorText.includes('reviews')) {
      console.log(`   💬 Problema con reviews: "${data.reviews}" (tipo: ${typeof data.reviews})`);
    }
    if (errorText.includes('photos_count')) {
      console.log(`   📸 Problema con photos_count: "${data.photos_count}" (tipo: ${typeof data.photos_count})`);
    }
    if (errorText.includes('verified')) {
      console.log(`   ✅ Problema con verified: "${data.verified}" (tipo: ${typeof data.verified})`);
    }
  }
  
  if (errorText.includes('value too long')) {
    console.log(`   🚨 ERROR: Valor demasiado largo`);
    // Identificar qué campo es demasiado largo
    const longFields = Object.keys(data).filter(key => {
      const value = data[key];
      return typeof value === 'string' && value.length > 1000;
    });
    if (longFields.length > 0) {
      console.log(`   📏 Campos demasiado largos: ${longFields.join(', ')}`);
    }
  }
  
  if (errorText.includes('invalid json')) {
    console.log(`   🚨 ERROR: JSON inválido`);
    const jsonFields = ['reviews_per_score', 'working_hours', 'about', 'reservation_links', 'order_links'];
    jsonFields.forEach(field => {
      if (data[field]) {
        try {
          JSON.parse(data[field]);
        } catch (e) {
          console.log(`   📄 Campo JSON inválido: ${field} = "${data[field]}"`);
        }
      }
    });
  }
  
  if (errorText.includes('not-null constraint')) {
    console.log(`   🚨 ERROR: Restricción not-null`);
    console.log(`   🔍 Campos requeridos faltantes o nulos`);
  }
  
  if (errorText.includes('unique constraint')) {
    console.log(`   🚨 ERROR: Restricción de unicidad`);
    console.log(`   🔍 Posible duplicado en place_id: "${data.place_id}"`);
  }
  
  // Mostrar datos problemáticos específicos
  console.log(`   📊 DATOS PROBLEMÁTICOS:`, {
    latitude: { value: data.latitude, type: typeof data.latitude },
    longitude: { value: data.longitude, type: typeof data.longitude },
    rating: { value: data.rating, type: typeof data.rating },
    reviews: { value: data.reviews, type: typeof data.reviews },
    photos_count: { value: data.photos_count, type: typeof data.photos_count },
    verified: { value: data.verified, type: typeof data.verified }
  });
}

interface ProcessRequest {
  recordIds?: number[]; // IDs específicos para procesar
  limit?: number; // Límite de registros a procesar
  batchSize?: number; // Tamaño del lote para Outscraper
}

interface ProcessResult {
  recordId: number;
  name: string;
  status: 'success' | 'failed' | 'not_found';
  placeId?: string;
  googleId?: string;
  error?: string;
  data?: any;
}

// Función para actualizar un registro en Google Maps
async function updateGoogleMapsRecord(recordId: number, data: any, metabaseId?: string): Promise<boolean> {
  try {
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;
    
    const updateData = {
      // IDs únicos - PRESERVAR metabase_id del registro original
      metabase_id: metabaseId || null,
      place_id: data.place_id || null,
      google_id: data.google_id || null,
      cid: data.cid || null,
      kgmid: data.kgmid || null,
      reviews_id: data.reviews_id || null,
      
      // Información básica
      name: data.name || null,
      phone: data.phone || null,
      site: data.site || null,
      
      // Categorías y tipos
      category: data.category || null,
      subtypes: data.subtypes || null,
      
      // Dirección completa
      full_address: data.full_address || null,
      borough: data.borough || null,
      street: data.street || null,
      city: data.city || null,
      postal_code: data.postal_code || null,
      state: data.state || null,
      country: data.country || null,
      
      // Coordenadas
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      
      // Ratings y reviews
      rating: data.rating || null,
      reviews: data.reviews || null,
      reviews_per_score: data.reviews_per_score ? JSON.stringify(data.reviews_per_score) : null,
      
      // Fotos
      photos_count: data.photos_count || null,
      photo: data.photo || null,
      
      // Horarios y servicios
      working_hours: data.working_hours ? JSON.stringify(data.working_hours) : null,
      about: data.about ? JSON.stringify(data.about) : null,
      
      // Precios y descripción
      range: data.range || null,
      prices: data.prices || null,
      description: data.description || null,
      typical_time_spent: data.typical_time_spent || null,
      
      // Estado y verificación
      verified: data.verified || false,
      
      // Enlaces
      reservation_links: data.reservation_links ? JSON.stringify(data.reservation_links) : null,
      booking_appointment_link: data.booking_appointment_link || null,
      menu_link: data.menu_link || null,
      order_links: data.order_links ? JSON.stringify(data.order_links) : null,
      location_link: data.location_link || null,
      
      // Metadata
      updated_at: new Date().toISOString(),
    };
    
    // Mostrar todos los campos que se van a guardar
    console.log(`📋 Campos extraídos y mapeados para registro ${recordId}:`);
    console.log(`  🔗 metabase_id: "${updateData.metabase_id}"`);
    console.log(`  📝 name: "${updateData.name}"`);
    console.log(`  🌐 site: "${updateData.site}"`);
    console.log(`  🏷️ subtypes: "${updateData.subtypes}"`);
    console.log(`  📂 category: "${updateData.category}"`);
    console.log(`  📞 phone: "${updateData.phone}"`);
    console.log(`  🏠 full_address: "${updateData.full_address}"`);
    console.log(`  🏘️ borough: "${updateData.borough}"`);
    console.log(`  🛣️ street: "${updateData.street}"`);
    console.log(`  🏙️ city: "${updateData.city}"`);
    console.log(`  📮 postal_code: "${updateData.postal_code}"`);
    console.log(`  🗺️ state: "${updateData.state}"`);
    console.log(`  🌍 country: "${updateData.country}"`);
    console.log(`  📍 latitude: ${updateData.latitude}`);
    console.log(`  📍 longitude: ${updateData.longitude}`);
    console.log(`  ⭐ rating: ${updateData.rating}`);
    console.log(`  💬 reviews: ${updateData.reviews}`);
    console.log(`  📊 reviews_per_score: ${updateData.reviews_per_score}`);
    console.log(`  📸 photos_count: ${updateData.photos_count}`);
    console.log(`  🖼️ photo: "${updateData.photo}"`);
    console.log(`  🕒 working_hours: ${updateData.working_hours}`);
    console.log(`  ℹ️ about: ${updateData.about}`);
    console.log(`  💰 range: "${updateData.range}"`);
    console.log(`  💵 prices: ${updateData.prices}`);
    console.log(`  📝 description: "${updateData.description}"`);
    console.log(`  ⏱️ typical_time_spent: "${updateData.typical_time_spent}"`);
    console.log(`  ✅ verified: ${updateData.verified}`);
    console.log(`  🎫 reservation_links: ${updateData.reservation_links}`);
    console.log(`  📅 booking_appointment_link: "${updateData.booking_appointment_link}"`);
    console.log(`  🍽️ menu_link: "${updateData.menu_link}"`);
    console.log(`  🛒 order_links: ${updateData.order_links}`);
    console.log(`  📍 location_link: "${updateData.location_link}"`);
    console.log(`  🆔 place_id: "${updateData.place_id}"`);
    console.log(`  🔗 google_id: "${updateData.google_id}"`);
    console.log(`  🆔 cid: "${updateData.cid}"`);
    console.log(`  🔗 kgmid: "${updateData.kgmid}"`);
    console.log(`  🆔 reviews_id: "${updateData.reviews_id}"`);
    console.log(`  📅 updated_at: "${updateData.updated_at}"`);

    // 0. Validar y sanitizar los datos antes de enviar a Supabase
    console.log(`🔍 Validando datos para registro ${recordId}...`);
    const validation = validateGoogleMapsData(updateData);
    logValidationResults(recordId, validation, updateData);
    
    if (!validation.isValid) {
      console.error(`❌ Datos inválidos para registro ${recordId}:`, validation.errors);
      return false;
    }
    
    // Usar los datos sanitizados
    const sanitizedData = validation.sanitizedData;
    console.log(`✅ Datos validados y sanitizados para registro ${recordId}`);

    // 1. Verificar que el place_id sea único antes de crear el registro
    if (sanitizedData.place_id) {
      console.log(`🔍 Verificando unicidad del place_id: ${sanitizedData.place_id}`);
      const placeIdCheckUrl = `${baseUrl}/rest/v1/google_maps?place_id=eq.${sanitizedData.place_id}&select=place_id`;
      
      try {
        const placeIdCheckResponse = await fetch(placeIdCheckUrl, {
          method: 'GET',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (placeIdCheckResponse.ok) {
          const existingPlaceIdData = await placeIdCheckResponse.json();
          if (existingPlaceIdData.length > 0) {
            console.log(`⚠️ Place_id ${updateData.place_id} ya existe en google_maps, saltando creación`);
            return false;
          }
          console.log(`✅ Place_id ${updateData.place_id} es único, procediendo con creación`);
        }
      } catch (error) {
        console.log(`⚠️ Error verificando place_id, continuando con creación:`, error);
      }
    }

    // 2. Verificar si el registro existe en google_maps
    console.log(`🔍 Verificando si existe registro en google_maps para metabase_id: ${metabaseId}...`);
    const checkResponse = await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${metabaseId}&select=id,metabase_id,place_id`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!checkResponse.ok) {
      console.error(`❌ Error verificando existencia del registro: ${checkResponse.status}`);
      return false;
    }
    
    const existingRecords = await checkResponse.json();
    console.log(`📊 Registros existentes para metabase_id ${metabaseId}: ${existingRecords.length}`);
    
    if (existingRecords.length === 0) {
      console.log(`⚠️ No existe registro en google_maps para metabase_id: ${metabaseId}, creando nuevo registro...`);
      // Crear nuevo registro
      const createResponse = await fetch(`${baseUrl}/rest/v1/google_maps`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(sanitizedData),
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`❌ Error creando registro en google_maps:`);
        console.error(`   Status: ${createResponse.status}, StatusText: ${createResponse.statusText}`);
        console.error(`   Error details: ${errorText}`);
        
        // Análisis específico del error
        analyzeSupabaseError(errorText, sanitizedData, recordId);
        
        return false;
      }
      
      console.log(`✅ Registro ${recordId} creado exitosamente en google_maps`);
      
      // Marcar el registro como procesado exitosamente (no eliminar hasta el final)
      console.log(`✅ Registro ${recordId} procesado exitosamente - se mantendrá en pending hasta limpieza final`);
      // Nota: No eliminamos el registro aquí para evitar problemas de sincronización entre lotes
      
      return true;
    }
    
    // 3. Actualizar registro existente en google_maps usando metabase_id
    console.log(`📝 Actualizando registro existente en google_maps para metabase_id: ${metabaseId}...`);
    const updateResponse = await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${metabaseId}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(sanitizedData),
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`❌ Error actualizando registro en google_maps:`);
      console.error(`   Status: ${updateResponse.status}, StatusText: ${updateResponse.statusText}`);
      console.error(`   Metabase ID: ${metabaseId}, Place ID: ${updateData.place_id}`);
      console.error(`   Error details: ${errorText}`);
      console.error(`   Update data keys:`, Object.keys(updateData));
      console.error(`   Update data sample:`, {
        metabase_id: updateData.metabase_id,
        place_id: updateData.place_id,
        name: updateData.name,
        city: updateData.city
      });
      console.error(`   Full error response:`, {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        headers: Object.fromEntries(updateResponse.headers.entries()),
        body: errorText
      });
      console.error(`   Complete update data that failed:`, JSON.stringify(sanitizedData, null, 2));
      return false;
    }
    
    console.log(`✅ Registro ${recordId} procesado exitosamente: actualizado en google_maps`);
    
    // 4. Marcar el registro como procesado en google_maps_pending (no eliminar hasta el final)
    console.log(`✅ Registro ${recordId} procesado exitosamente - se mantendrá en pending hasta limpieza final`);
    // Nota: No eliminamos el registro aquí para evitar problemas de sincronización entre lotes
    
    return true;
  } catch (error) {
    console.error(`❌ Error actualizando registro ${recordId}:`, error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando procesamiento de registros pendientes...');
    
    const body: ProcessRequest = await request.json();
    const { recordIds, limit, batchSize = 25 } = body;
    
    // Obtener registros pendientes
    const pendingUrl = new URL('/api/google-maps-pending', request.url);
    if (limit) pendingUrl.searchParams.set('limit', limit.toString());
    
    const pendingResponse = await fetch(pendingUrl.toString());
    const pendingData = await pendingResponse.json();
    
    if (!pendingData.success || !pendingData.data) {
      throw new Error('Error obteniendo registros pendientes');
    }
    
    // Filtrar por IDs específicos si se proporcionan
    let recordsToProcess = pendingData.data;
    if (recordIds && recordIds.length > 0) {
      recordsToProcess = recordsToProcess.filter((r: any) => recordIds.includes(r.id));
    }
    
    console.log(`📋 Procesando ${recordsToProcess.length} registros...`);
    console.log(`🔍 IDs de registros recibidos: [${recordIds?.join(', ') || 'todos'}]`);
    console.log(`🔍 Registros filtrados por IDs: ${recordsToProcess.length}`);
    
    const results: ProcessResult[] = [];
    
    // Verificar registros que ya tienen place_id o que ya existen en google_maps
    console.log('🔍 Verificando registros duplicados y place_id existentes...');
    const existingMetabaseIds = new Set<string>();
    const existingPlaceIds = new Set<string>();
    
    try {
      // 1. Verificar registros que ya tienen place_id en google_maps_pending
      const pendingWithPlaceId = recordsToProcess.filter((r: any) => r.place_id && r.place_id !== null);
      if (pendingWithPlaceId.length > 0) {
        console.log(`⚠️ Encontrados ${pendingWithPlaceId.length} registros que ya tienen place_id en google_maps_pending`);
        pendingWithPlaceId.forEach((r: any) => {
          console.log(`⏭️ Saltando registro ${r.id} - ya tiene place_id: ${r.place_id}`);
        });
      }
      
      // 2. Verificar registros que ya tienen place_id en google_maps (ya completados)
      const metabaseIds = recordsToProcess.map((r: any) => r.metabase_id).filter(id => id);
      if (metabaseIds.length > 0) {
        const orConditions = metabaseIds.map(id => `metabase_id.eq.${id}`).join(',');
        const checkUrl = `${baseUrl}/rest/v1/google_maps?or=(${orConditions})&select=metabase_id,place_id`;
        
        const checkResponse = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (checkResponse.ok) {
          const existingData = await checkResponse.json();
          existingData.forEach((record: any) => {
            if (record.metabase_id) {
              existingMetabaseIds.add(record.metabase_id);
            }
            if (record.place_id) {
              existingPlaceIds.add(record.place_id);
            }
          });
          console.log(`⚠️ Encontrados ${existingMetabaseIds.size} registros que ya existen en google_maps`);
          console.log(`⚠️ Encontrados ${existingPlaceIds.size} registros que ya tienen place_id (completados)`);
        }
      }
    } catch (error) {
      console.log('⚠️ Error verificando duplicados, continuando con procesamiento:', error);
    }

    // Filtrar registros que no deben procesarse
    const recordsToProcessFiltered = recordsToProcess.filter((r: any) => {
      // Saltar si ya tiene place_id en google_maps_pending
      if (r.place_id && r.place_id !== null) {
        console.log(`⏭️ Saltando registro ${r.id} - ya tiene place_id: ${r.place_id}`);
        return false;
      }
      
      // Saltar si ya tiene place_id en google_maps (ya completado)
      if (r.metabase_id && existingMetabaseIds.has(r.metabase_id)) {
        // Verificar si el registro existente ya tiene place_id
        console.log(`⏭️ Saltando registro ${r.id} - ya completado en google_maps`);
        return false;
      }
      
      // Verificar que tenga datos de customer
      if (!r.customer_data || r.customer_data === null) {
        console.log(`⏭️ Saltando registro ${r.id} - no tiene datos de customer`);
        return false;
      }
      
      return true;
    });

    const skippedCount = recordsToProcess.length - recordsToProcessFiltered.length;
    console.log(`📋 Registros a procesar: ${recordsToProcessFiltered.length} de ${recordsToProcess.length} (${skippedCount} omitidos por duplicados/place_id existente)`);
    
    // Preparar datos para búsqueda en lotes
    const placesToSearch = recordsToProcessFiltered
      .filter((r: any) => r.customer_data !== null)
      .map((r: any) => {
        const name = r.customer_data.name || r.name;
        let address = r.customer_data.address || '';
        const city = r.customer_data.city || '';
        
        console.log(`🔍 Procesando lugar: "${name}"`);
        console.log(`📍 Dirección original: "${address}"`);
        console.log(`🏙️ Ciudad: "${city}"`);
        
        // Mejorar la dirección: si no termina con la ciudad, añadirla
        if (city && address && !address.toLowerCase().includes(city.toLowerCase())) {
          address = `${address}, ${city}`;
          console.log(`✅ Dirección mejorada: "${address}"`);
        } else {
          console.log(`ℹ️ Dirección ya incluye ciudad o no necesita mejora`);
        }
        
        // Evitar duplicación de ciudad en la query final
        // Si la dirección ya incluye la ciudad, no añadirla de nuevo
        const finalAddress = address.toLowerCase().includes(city.toLowerCase()) ? address : `${address}, ${city}`;
        console.log(`🎯 Dirección final: "${finalAddress}"`);
        
        return {
          id: r.id,
          metabase_id: r.metabase_id,
          name,
          address: finalAddress,
          city,
        };
      });
    
    console.log(`📋 Preparando ${placesToSearch.length} lugares para búsqueda en Outscraper`);
    console.log(`🔍 Ejemplos de queries que se enviarán:`, placesToSearch.slice(0, 3).map(p => `${p.name} ${p.address} ${p.city}`.trim()));
    console.log(`🔍 Datos detallados del primer lugar:`, placesToSearch[0]);
    
    if (placesToSearch.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay registros con datos de customer para procesar',
        results: [],
        stats: {
          total: 0,
          processed: 0,
          success: 0,
          failed: 0,
          not_found: 0,
        },
      });
    }
    
    // Procesar lugares uno por uno para evitar confusiones en el mapeo
    console.log(`🔍 Iniciando procesamiento secuencial para ${placesToSearch.length} lugares...`);
    
    // Procesar resultados uno por uno
    for (let i = 0; i < placesToSearch.length; i++) {
      const place = placesToSearch[i];
      
      console.log(`🔍 [${i + 1}/${placesToSearch.length}] Procesando: "${place.name}"`);
      console.log(`🔑 Metabase ID: ${place.metabase_id}`);
      console.log(`🔑 Record ID: ${place.id}`);
      console.log(`📍 Dirección: ${place.address}`);
      console.log(`🏙️ Ciudad: ${place.city}`);
      
      try {
        // Buscar lugar individual en Outscraper
        const outscraperResult = await outscraperService.searchSinglePlace(
          place.name, 
          place.address, 
          place.city
        );
        
        console.log(`📊 Resultado encontrado: ${outscraperResult ? 'SÍ' : 'NO'}`);
        
        if (outscraperResult) {
          console.log(`✅ Procesando lugar encontrado: "${place.name}"`);
          console.log(`🔍 Asignando datos con metabase_id correcto:`);
          console.log(`   📝 Nombre del lugar: "${outscraperResult.name}"`);
          console.log(`   🆔 Metabase ID a asignar: "${place.metabase_id}"`);
          console.log(`   📍 Dirección encontrada: "${outscraperResult.full_address || outscraperResult.address}"`);
          
          // Actualizar registro en Google Maps con el metabase_id correcto
          const updated = await updateGoogleMapsRecord(place.id, outscraperResult, place.metabase_id);
          
          results.push({
            recordId: place.id,
            name: place.name,
            status: updated ? 'success' : 'failed',
            placeId: outscraperResult.place_id,
            googleId: outscraperResult.google_id,
            data: updated ? outscraperResult : undefined,
            error: updated ? undefined : 'Error al actualizar en la base de datos',
            errorDetails: updated ? undefined : {
              placeId: outscraperResult.place_id,
              hasPlaceId: !!outscraperResult.place_id,
              hasName: !!outscraperResult.name,
              hasAddress: !!outscraperResult.full_address,
              dataKeys: Object.keys(outscraperResult),
              timestamp: new Date().toISOString()
            }
          });
          
          console.log(`📊 [${i + 1}/${placesToSearch.length}] Resultado: ${updated ? 'ÉXITO' : 'FALLO'} - ${place.name}`);
        } else {
          console.log(`⚠️ [${i + 1}/${placesToSearch.length}] No encontrado: ${place.name}`);
          results.push({
            recordId: place.id,
            name: place.name,
            status: 'not_found',
            error: 'No se encontró en Google Maps',
          });
        }
      } catch (error) {
        console.error(`❌ [${i + 1}/${placesToSearch.length}] Error procesando: ${place.name}`, error);
        results.push({
          recordId: place.id,
          name: place.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
      
      // Pequeño delay entre registros para no sobrecargar la API
      if (i < placesToSearch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Estadísticas
    const stats = {
      total: results.length,
      processed: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: skippedCount,
      not_found: results.filter(r => r.status === 'not_found').length,
    };
    
    console.log('✅ Procesamiento completado');
    console.log(`📊 Exitosos: ${stats.success}, Fallidos: ${stats.failed}, No encontrados: ${stats.not_found}`);
    
    return NextResponse.json({
      success: true,
      results,
      stats,
      debug: {
        totalPlacesSearched: placesToSearch.length,
        totalResultsFound: results.filter(r => r.status === 'success').length,
        sampleQueries: placesToSearch.slice(0, 3).map(p => `${p.name} ${p.address} ${p.city}`.trim()),
        outscraperConfigured: config.outscraper.apiKey !== 'YOUR_OUTSCRAPER_API_KEY',
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('💥 Error en procesamiento:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}

// Endpoint para verificar el estado del servicio
export async function GET() {
  return NextResponse.json({
    success: true,
    service: 'Google Maps Processor',
    status: 'ready',
    outscraperConfigured: config.outscraper.apiKey !== 'YOUR_OUTSCRAPER_API_KEY',
    timestamp: new Date().toISOString(),
  });
}

// Endpoint para probar una query específica
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, address, city } = body;
    
    if (!name || !address || !city) {
      return NextResponse.json({
        success: false,
        error: 'Se requieren name, address y city para la prueba',
      }, { status: 400 });
    }
    
    console.log(`🧪 Probando query: "${name} ${address} ${city}"`);
    
    const result = await outscraperService.searchSinglePlace(name, address, city);
    
    return NextResponse.json({
      success: true,
      query: `${name} ${address} ${city}`,
      result: result,
      found: result !== null,
    });
    
  } catch (error) {
    console.error('💥 Error en prueba:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
