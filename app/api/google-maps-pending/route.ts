import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

interface GoogleMapsPendingRecord {
  id: string; // Changed to string based on actual data
  name: string | null; // Can be null based on actual data
  metabase_id: string; // This is the correct field that links to metabase_customers
  created_at: string;
  updated_at: string;
  // Campos vacíos que necesitamos completar
  place_id: null;
  google_id: null;
  latitude: null;
  longitude: null;
  rating: null;
  reviews_count: null;
  google_types: null;
  business_status: null;
}

interface CustomerRecord {
  id: string; // Changed to string based on actual data
  name: string;
  address: string;
  city: string;
}

interface PendingRecordWithCustomer extends GoogleMapsPendingRecord {
  customer_data: CustomerRecord | null;
}

// Función para verificar qué tablas están disponibles
async function checkAvailableTables(): Promise<void> {
  try {
    console.log('🔍 Verificando tablas disponibles...');
    
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;
    
    // Probar diferentes nombres de tabla
    const tableNames = ['google_maps_pending', 'google_maps', 'metabase_customers'];
    
    for (const tableName of tableNames) {
      try {
        const url = `${baseUrl}/rest/v1/${tableName}?select=count`;
        console.log(`🔗 Probando tabla: ${tableName}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Tabla ${tableName}: EXISTE (${data[0]?.count || 'N/A'} registros)`);
        } else {
          console.log(`❌ Tabla ${tableName}: NO EXISTE (${response.status})`);
        }
      } catch (error) {
        console.log(`❌ Tabla ${tableName}: ERROR - ${error}`);
      }
    }
  } catch (error) {
    console.error('❌ Error verificando tablas:', error);
  }
}

// Función para obtener registros pendientes
async function getPendingRecords(limit?: number, onlyPending?: boolean): Promise<GoogleMapsPendingRecord[]> {
  try {
    console.log('🔍 Obteniendo registros pendientes...');
    
    // Primero verificar qué tablas están disponibles
    await checkAvailableTables();
    
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;
    
    // Intentar primero con google_maps_pending, si falla usar google_maps con filtro
    let url = `${baseUrl}/rest/v1/google_maps_pending?select=*`;
    let tableName = 'google_maps_pending';
    
    // Si onlyPending es true, filtrar solo registros sin place_id
    if (onlyPending) {
      url += '&place_id=is.null';
      console.log('🔍 Filtrando solo registros sin place_id (realmente pendientes)');
    }
    
    if (limit) {
      url += `&limit=${limit}`;
    }
    url += '&order=created_at.desc';

    console.log(`🔗 URL de consulta: ${url}`);
    
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Si falla con google_maps_pending, intentar con google_maps
    if (!response.ok) {
      console.log(`⚠️ Tabla ${tableName} no disponible, intentando con google_maps...`);
      tableName = 'google_maps';
      url = `${baseUrl}/rest/v1/google_maps?place_id=is.null&select=*`;
      if (limit) {
        url += `&limit=${limit}`;
      }
      url += '&order=created_at.desc';
      
      console.log(`🔗 URL alternativa: ${url}`);
      
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error ${response.status} obteniendo registros pendientes:`, errorText);
      throw new Error(`Error obteniendo registros pendientes: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Encontrados ${data.length} registros pendientes en ${tableName}`);
    
    // DEBUG: Mostrar estadísticas de place_id
    const withPlaceId = data.filter((r: any) => r.place_id !== null && r.place_id !== undefined);
    const withoutPlaceId = data.filter((r: any) => r.place_id === null || r.place_id === undefined);
    console.log(`🔍 Registros CON place_id: ${withPlaceId.length}`);
    console.log(`🔍 Registros SIN place_id: ${withoutPlaceId.length}`);
    
    // Mostrar algunos ejemplos de registros pendientes
    if (data.length > 0) {
      console.log('📋 Ejemplos de registros pendientes:');
      data.slice(0, 3).forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Nombre: "${record.name || 'null'}", metabase_id: ${record.metabase_id || 'null'}, place_id: ${record.place_id || 'null'}`);
      });
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error obteniendo registros pendientes:', error);
    throw error;
  }
}

// Función para obtener datos de customers correspondientes usando metabase_id
async function getCustomerData(pendingRecords: GoogleMapsPendingRecord[]): Promise<Map<string, CustomerRecord>> {
  try {
    console.log('🔍 Obteniendo datos de customers usando metabase_id...');
    
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;
    
    // Crear un mapa de registro pendiente -> customer
    const customerMap = new Map<string, CustomerRecord>();
    
    // Filtrar registros que tienen metabase_id
    const recordsWithCustomerId = pendingRecords.filter(r => r.metabase_id);
    const recordsWithoutCustomerId = pendingRecords.filter(r => !r.metabase_id);
    
    console.log(`📊 Registros con metabase_id: ${recordsWithCustomerId.length}`);
    console.log(`📊 Registros sin metabase_id: ${recordsWithoutCustomerId.length}`);
    
    // DEBUG: Mostrar algunos ejemplos de metabase_id
    if (recordsWithCustomerId.length > 0) {
      console.log('🔍 Primeros 5 metabase_id:', recordsWithCustomerId.slice(0, 5).map(r => ({ id: r.id, name: r.name, metabase_id: r.metabase_id })));
    }
    
    if (recordsWithCustomerId.length > 0) {
            // Obtener todos los customer IDs únicos
      const customerIds = Array.from(new Set(recordsWithCustomerId.map(r => r.metabase_id)));
      console.log(`🔍 Buscando ${customerIds.length} customers únicos por ID...`);
      console.log('🔍 IDs únicos a buscar:', customerIds.slice(0, 10));
      
      // Dividir en lotes para no sobrecargar la query
      const batchSize = 50;
      for (let i = 0; i < customerIds.length; i += batchSize) {
        const batch = customerIds.slice(i, i + batchSize);
        
        // Construir filtro OR para múltiples IDs
        const filters = batch.map(id => `id.eq.${id}`).join(',');
        const url = `${baseUrl}/rest/v1/metabase_customers?or=(${filters})&select=id,name,address,city`;
        
        console.log(`🔗 URL del lote ${Math.floor(i / batchSize) + 1}:`, url);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const customers = await response.json();
          console.log(`📦 Lote ${Math.floor(i / batchSize) + 1}: ${customers.length} customers encontrados`);
          
          if (customers.length > 0) {
            console.log('📝 Primeros 3 customers encontrados:', customers.slice(0, 3).map(c => ({ id: c.id, name: c.name, city: c.city })));
          }
          
          // Mapear customers con los registros pendientes usando metabase_id
          customers.forEach((customer: CustomerRecord) => {
            const matchingRecords = recordsWithCustomerId.filter(r => r.metabase_id === customer.id);
            matchingRecords.forEach(record => {
              if (!customerMap.has(record.id)) {
                customerMap.set(record.id, customer);
                console.log(`✅ Match por ID: "${record.name || 'null'}" (ID: ${record.id}) ↔ Customer "${customer.name}" (ID: ${customer.id})`);
              }
            });
          });
        } else {
          console.error(`❌ Error en lote ${Math.floor(i / batchSize) + 1}:`, response.status, response.statusText);
          const errorText = await response.text();
          console.error('📄 Respuesta de error:', errorText);
        }
      }
    }
    
                   // Si no encontramos suficientes, intentar búsqueda por nombre para los que no tienen metabase_id
    if (recordsWithoutCustomerId.length > 0) {
      console.log('🔄 Intentando búsqueda por nombre para registros sin metabase_id...');
      
      // Filtrar registros que tienen nombre (no null)
      const recordsWithName = recordsWithoutCustomerId.filter(r => r.name && r.name !== 'null');
      const recordsWithoutName = recordsWithoutCustomerId.filter(r => !r.name || r.name === 'null');
      
      console.log(`📊 Registros sin metabase_id pero con nombre: ${recordsWithName.length}`);
      console.log(`📊 Registros sin metabase_id y sin nombre: ${recordsWithoutName.length}`);
      
      if (recordsWithName.length > 0) {
        const names = recordsWithName.map(r => r.name!);
        const uniqueNames = Array.from(new Set(names));
        
        console.log(`📋 Buscando ${uniqueNames.length} nombres únicos en customers...`);
        console.log('🔍 Primeros 5 nombres a buscar:', uniqueNames.slice(0, 5));
        
        // Dividir en lotes de 30 para no sobrecargar la query
        const batchSize = 30;
        for (let i = 0; i < uniqueNames.length; i += batchSize) {
          const batch = uniqueNames.slice(i, i + batchSize);
          
          // Usar ilike para búsqueda insensible a mayúsculas y más flexible
          const filters = batch.map(name => `name.ilike.%${encodeURIComponent(name)}%`).join(',');
          const url = `${baseUrl}/rest/v1/metabase_customers?or=(${filters})&select=id,name,address,city`;
          
          console.log(`🔗 URL del lote ${Math.floor(i / batchSize) + 1}:`, url);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const customers = await response.json();
            console.log(`📦 Lote ${Math.floor(i / batchSize) + 1}: ${customers.length} customers encontrados`);
            
            if (customers.length > 0) {
              console.log('📝 Primeros 3 customers encontrados:', customers.slice(0, 3).map(c => ({ id: c.id, name: c.name, city: c.city })));
            }
            
            // Mapear customers con los registros pendientes
            customers.forEach((customer: CustomerRecord) => {
              // Buscar el mejor match usando nombre similar
              const pendingRecord = recordsWithName.find(r => {
                if (!r.name) return false;
                // Coincidencia exacta
                if (r.name.toLowerCase() === customer.name.toLowerCase()) return true;
                // Coincidencia parcial (el nombre del customer está contenido o viceversa)
                if (r.name.toLowerCase().includes(customer.name.toLowerCase()) ||
                    customer.name.toLowerCase().includes(r.name.toLowerCase())) return true;
                return false;
              });
              
              if (pendingRecord && !customerMap.has(pendingRecord.id)) {
                customerMap.set(pendingRecord.id, customer);
                console.log(`✅ Match por nombre: "${pendingRecord.name}" ↔ "${customer.name}"`);
              }
            });
          } else {
            console.error(`❌ Error en lote ${Math.floor(i / batchSize) + 1}:`, response.status, response.statusText);
            const errorText = await response.text();
            console.error('📄 Respuesta de error:', errorText);
          }
        }
      } else {
        console.log('⚠️ No hay registros con nombre para buscar por nombre');
      }
    }
    
    console.log(`✅ Encontrados ${customerMap.size} customers correspondientes de ${pendingRecords.length} registros pendientes`);
    return customerMap;
  } catch (error) {
    console.error('❌ Error obteniendo datos de customers:', error);
    return new Map();
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 API: Obteniendo registros pendientes con datos de customers...');
    
    // Log del parámetro onlyPending
    const onlyPending = request.nextUrl.searchParams.get('onlyPending') === 'true';
    if (onlyPending) {
      console.log('🔍 Modo: Solo registros realmente pendientes (sin place_id)');
    } else {
      console.log('🔍 Modo: Todos los registros (incluyendo ya procesados)');
    }
    
    // Obtener parámetros de query
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 100;
    
    // Si se solicita un pageSize muy grande (como 10000), significa que queremos todos los registros
    const getAllRecords = pageSize >= 10000;
    
    // Obtener registros pendientes
    const pendingRecords = await getPendingRecords(limit, onlyPending);
    
    // DEBUG: Mostrar estructura de registros pendientes
    console.log('🔍 Estructura del primer registro pendiente:', JSON.stringify(pendingRecords[0], null, 2));
    console.log('📋 Campos disponibles en registros pendientes:', Object.keys(pendingRecords[0] || {}));
    
    // Obtener datos de customers
    const customerMap = await getCustomerData(pendingRecords);
    
    // Combinar datos
    const enrichedRecords: PendingRecordWithCustomer[] = pendingRecords.map(record => ({
      ...record,
      customer_data: customerMap.get(record.id) || null,
    }));
    
    // Aplicar paginación (solo si no se solicitan todos los registros)
    let paginatedRecords;
    let stats;
    
    if (getAllRecords) {
      // Devolver todos los registros sin paginación
      paginatedRecords = enrichedRecords;
      stats = {
        total: enrichedRecords.length,
        with_customer_data: enrichedRecords.filter(r => r.customer_data !== null).length,
        without_customer_data: enrichedRecords.filter(r => r.customer_data === null).length,
        page: 1,
        pageSize: enrichedRecords.length,
        totalPages: 1,
      };
    } else {
      // Aplicar paginación normal
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      paginatedRecords = enrichedRecords.slice(startIndex, endIndex);
      
      stats = {
        total: enrichedRecords.length,
        with_customer_data: enrichedRecords.filter(r => r.customer_data !== null).length,
        without_customer_data: enrichedRecords.filter(r => r.customer_data === null).length,
        page,
        pageSize,
        totalPages: Math.ceil(enrichedRecords.length / pageSize),
      };
    }
    
    console.log('✅ Datos preparados exitosamente');
    console.log(`📊 Total: ${stats.total}, Con datos: ${stats.with_customer_data}, Sin datos: ${stats.without_customer_data}`);
    
    // DEBUG: Mostrar algunos ejemplos de registros sin customer_data
    if (stats.without_customer_data > 0) {
      const recordsWithoutData = enrichedRecords.filter(r => r.customer_data === null).slice(0, 3);
      console.log('❌ Ejemplos de registros sin customer_data:');
      recordsWithoutData.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Nombre: "${record.name || 'null'}", metabase_id: ${record.metabase_id || 'null'}`);
      });
    }
    
    // DEBUG: Mostrar algunos ejemplos de registros CON customer_data
    if (stats.with_customer_data > 0) {
      const recordsWithData = enrichedRecords.filter(r => r.customer_data !== null).slice(0, 3);
      console.log('✅ Ejemplos de registros CON customer_data:');
      recordsWithData.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Nombre: "${record.name || 'null'}", Customer: "${record.customer_data?.name}", Ciudad: "${record.customer_data?.city}"`);
      });
    }
    
    return NextResponse.json({
      success: true,
      data: paginatedRecords,
      stats,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('💥 Error en API de registros pendientes:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}

export async function POST() {
  return GET(new NextRequest('http://localhost:3000/api/google-maps-pending'));
}

// Endpoint de debug para ver qué hay en ambas tablas
export async function PUT() {
  try {
    console.log('🔍 DEBUG: Analizando contenido de ambas tablas...');
    
    // Verificar configuración básica
    console.log('🔑 Verificando configuración...');
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;
    
    if (!baseUrl || !serviceKey) {
      throw new Error(`Credenciales de Supabase no configuradas: baseUrl=${!!baseUrl}, serviceKey=${!!serviceKey}`);
    }
    
    console.log('✅ Configuración OK');
    console.log('🔗 Base URL:', baseUrl);
    console.log('🔑 Service Key:', serviceKey.substring(0, 20) + '...');
    
    // Test básico de conectividad
    console.log('🔍 Probando conectividad básica...');
    const testResponse = await fetch(`${baseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });
    
    console.log('📡 Respuesta de test:', testResponse.status, testResponse.statusText);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('❌ Error de conectividad:', errorText);
      throw new Error(`Error de conectividad: ${testResponse.status} - ${errorText}`);
    }
    
    // Test específico: buscar un customer por ID
    console.log('🔍 Probando búsqueda de customer por ID...');
    const testCustomerId = '4bed8131-d508-44f1-8d0b-925604b54a87'; // ID del primer registro pendiente
    
    const customerResponse = await fetch(`${baseUrl}/rest/v1/metabase_customers?id=eq.${testCustomerId}&select=id,name,address,city`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📡 Respuesta de customer:', customerResponse.status, customerResponse.statusText);
    
    if (customerResponse.ok) {
      const customerData = await customerResponse.json();
      console.log('👥 Customer encontrado:', customerData);
    } else {
      const errorText = await customerResponse.text();
      console.error('❌ Error buscando customer:', errorText);
    }
    
    // Si llegamos aquí, la conectividad está bien
    return NextResponse.json({
      success: true,
      debug: {
        message: 'Conectividad básica OK',
        baseUrl,
        serviceKeyLength: serviceKey.length,
        testCustomerId,
        customerResponseStatus: customerResponse.status,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('💥 Error en debug:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
