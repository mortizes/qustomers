'use client';

import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Search,
  Loader2,
  Building2,
  Phone,
  Globe,
  MapPinOff,
  AlertTriangle
} from 'lucide-react';

interface CustomerData {
  id: number;
  name: string;
  address: string;
  city: string;
  phone?: string;
  website?: string;
}

interface PendingRecord {
  id: number;
  name: string;
  address: string;
  city: string;
  phone?: string;
  website?: string;
  created_at: string;
  updated_at: string;
  customer_data: CustomerData | null;
}

interface ProcessResult {
  recordId: number;
  name: string;
  status: 'success' | 'failed' | 'not_found';
  placeId?: string;
  googleId?: string;
  error?: string;
}

interface Stats {
  total: number;
  with_customer_data: number;
  without_customer_data: number;
}

const GoogleMapsPendingProcessor: React.FC = () => {
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [processResults, setProcessResults] = useState<ProcessResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  
  const pageSize = 100;

  // Verificar si la API key está configurada
  const checkApiConfiguration = async () => {
    try {
      const response = await fetch('/api/google-maps-process');
      const data = await response.json();
      setApiKeyConfigured(data.outscraperConfigured);
    } catch (err) {
      console.error('Error verificando configuración:', err);
      setApiKeyConfigured(false);
    }
  };

  // Cargar registros pendientes
  const fetchPendingRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/google-maps-pending?page=${currentPage}&pageSize=${pageSize}`);
      const result = await response.json();
      
      if (result.success) {
        setPendingRecords(result.data);
        setStats(result.stats);
      } else {
        setError(result.error || 'Error al cargar registros');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Procesar registros seleccionados
  const processSelectedRecords = async () => {
    if (selectedRecords.size === 0) {
      setError('Por favor selecciona al menos un registro para procesar');
      return;
    }

    if (processing) {
      setError('Ya hay un procesamiento en curso. Por favor espera...');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setProcessResults([]);
      
      // Obtener los registros completos seleccionados
      const selectedRecordsData = pendingRecords.filter(r => selectedRecords.has(r.id));
      
      console.log('🚀 Procesando registros seleccionados:', selectedRecordsData);
      
      const response = await fetch('/api/google-maps-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordIds: Array.from(selectedRecords),
          recordsToProcess: selectedRecordsData,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setProcessResults(result.results);
        console.log('✅ Resultados del procesamiento:', result.results);
        console.log('🔍 Debug info:', result.debug);
        
        // Mostrar información de debug en la interfaz
        if (result.debug) {
          console.log(`📊 Debug: ${result.debug.totalPlacesSearched} lugares buscados, ${result.debug.totalResultsFound} encontrados`);
          console.log(`🔍 Queries de ejemplo:`, result.debug.sampleQueries);
          console.log(`🔑 Outscraper configurado:`, result.debug.outscraperConfigured);
        }
        
        // Mostrar estadísticas al usuario
        const stats = result.stats;
        const skippedText = stats.skipped > 0 ? `\n⏭️ Omitidos (duplicados/place_id existente): ${stats.skipped}` : '';
        alert(`Procesamiento completado!\n\n✅ Exitosos: ${stats.success || stats.successful}\n❌ Fallidos: ${stats.failed}\n⚠️ No encontrados: ${stats.not_found || stats.notFound}${skippedText}`);
        
        // Limpiar selección después del procesamiento exitoso
        setSelectedRecords(new Set());
        // Recargar datos para actualizar la vista
        console.log('🔄 Actualizando vista después del procesamiento...');
        await fetchPendingRecords();
      } else {
        setError(result.error || 'Error al procesar registros');
      }
    } catch (err) {
      console.error('❌ Error procesando registros:', err);
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setProcessing(false);
    }
  };

  // Procesar todos los registros pendientes
  const processAllPendingRecords = async () => {
    if (processing) {
      setError('Ya hay un procesamiento en curso. Por favor espera...');
      return;
    }

    // Confirmar antes de procesar todos
    const confirmMessage = `¿Estás seguro de que quieres procesar los registros pendientes?\n\n` +
      `📊 Total de registros: ${stats?.total || 0}\n` +
      `✅ Con datos de customer: ${stats?.with_customer_data || 0}\n` +
      `❌ Sin datos de customer: ${stats?.without_customer_data || 0}\n\n` +
      `⚠️ Esta operación puede tomar varios minutos y consumir créditos de Outscraper.\n` +
      `Solo se procesarán los registros que tengan datos de customer.\n` +
      `Se procesarán en lotes de 20 registros (máximo 100 registros por seguridad).`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setProcessResults([]);
      
      console.log('🚀 Procesando TODOS los registros pendientes en lotes...');
      
      // Procesar en lotes de 20 registros, obteniendo registros frescos para cada lote
      const batchSize = 20;
      const maxRecords = 100;
      let allResults: ProcessResult[] = [];
      let totalStats = {
        success: 0,
        failed: 0,
        not_found: 0,
        skipped: 0
      };
      
      let totalProcessed = 0;
      let batchIndex = 0;
      
      console.log(`🔄 Procesando hasta ${maxRecords} registros en lotes de ${batchSize}...`);
      
      while (totalProcessed < maxRecords) {
        batchIndex++;
        
        // Obtener registros frescos para este lote
        console.log(`📡 Obteniendo registros pendientes para lote ${batchIndex}...`);
        const batchResponse = await fetch(`/api/google-maps-pending?page=1&pageSize=${batchSize}&onlyPending=true`);
        const batchResult = await batchResponse.json();
        
        if (!batchResult.success) {
          console.error(`❌ Error obteniendo registros para lote ${batchIndex}:`, batchResult.error);
          break;
        }
        
        // Filtrar solo los registros con datos de customer
        const batchRecordsWithData = batchResult.data.filter((r: PendingRecord) => r.customer_data !== null);
        
        if (batchRecordsWithData.length === 0) {
          console.log(`⚠️ No hay más registros con datos de customer para procesar`);
          break;
        }
        
        const batchRecordIds = batchRecordsWithData.map(r => r.id);
        
        console.log(`📦 Procesando lote ${batchIndex} (${batchRecordsWithData.length} registros)...`);
        console.log(`🔍 IDs del lote ${batchIndex}:`, batchRecordIds);
        
        try {
          const response = await fetch('/api/google-maps-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recordIds: batchRecordIds,
              recordsToProcess: batchRecordsWithData,
            }),
          });
          
          const result = await response.json();
          
          if (result.success) {
            allResults = [...allResults, ...result.results];
            
            // Acumular estadísticas
            if (result.stats) {
              totalStats.success += result.stats.success || result.stats.successful || 0;
              totalStats.failed += result.stats.failed || 0;
              totalStats.not_found += result.stats.not_found || result.stats.notFound || 0;
              totalStats.skipped += result.stats.skipped || 0;
            }
            
            totalProcessed += result.results.length;
            
            console.log(`✅ Lote ${batchIndex} completado: ${result.results.length} registros procesados`);
            console.log(`📊 Total procesado hasta ahora: ${totalProcessed}/${maxRecords}`);
            
            // Mostrar estadísticas detalladas del lote
            if (result.stats) {
              const stats = result.stats;
              console.log(`📊 Estadísticas del lote ${batchIndex}:`);
              console.log(`   ✅ Exitosos: ${stats.success || stats.successful || 0}`);
              console.log(`   ❌ Fallidos: ${stats.failed || 0}`);
              console.log(`   ⚠️ No encontrados: ${stats.not_found || stats.notFound || 0}`);
              console.log(`   ⏭️ Omitidos: ${stats.skipped || 0}`);
            }
            
            // Actualizar resultados en la interfaz después de cada lote
            setProcessResults([...allResults]);
            
            // Pequeña pausa entre lotes para no sobrecargar la API
            if (totalProcessed < maxRecords) {
              console.log('⏳ Esperando 2 segundos antes del siguiente lote...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else {
            console.error(`❌ Error en lote ${batchIndex}:`, result.error);
            totalStats.failed += batchRecordsWithData.length;
            break;
          }
        } catch (err) {
          console.error(`❌ Error procesando lote ${batchIndex}:`, err);
          totalStats.failed += batchRecordsWithData.length;
          break;
        }
      }
      
      // Mostrar estadísticas finales
      const totalProcessedFinal = totalStats.success + totalStats.failed + totalStats.not_found;
      const totalSkipped = totalStats.skipped;
      const skippedText = totalSkipped > 0 ? `\n⏭️ Omitidos (duplicados/place_id existente): ${totalSkipped}` : '';
      
      console.log(`🎯 RESUMEN FINAL:`);
      console.log(`   📋 Registros solicitados: ${maxRecords}`);
      console.log(`   📊 Registros procesados: ${totalProcessedFinal}`);
      console.log(`   ⏭️ Registros omitidos: ${totalSkipped}`);
      console.log(`   ✅ Exitosos: ${totalStats.success}`);
      console.log(`   ❌ Fallidos: ${totalStats.failed}`);
      console.log(`   ⚠️ No encontrados: ${totalStats.not_found}`);
      
      alert(`🎉 Procesamiento COMPLETO finalizado!\n\n` +
        `📊 Procesados ${batchIndex} lotes de ${batchSize} registros\n` +
        `📋 Registros solicitados: ${maxRecords}\n` +
        `✅ Exitosos: ${totalStats.success}\n` +
        `❌ Fallidos: ${totalStats.failed}\n` +
        `⚠️ No encontrados: ${totalStats.not_found}${skippedText}\n\n` +
        `🔄 Recargando vista...`);
      
      // Limpiar selección después del procesamiento exitoso
      setSelectedRecords(new Set());
      // Recargar datos para actualizar la vista
      console.log('🔄 Actualizando vista después del procesamiento completo...');
      
      // Limpiar registros procesados exitosamente de google_maps_pending
      try {
        console.log('🧹 Limpiando registros procesados exitosamente...');
        const cleanupResponse = await fetch('/api/google-maps-cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processedRecordIds: allResults.filter(r => r.status === 'success').map(r => r.recordId)
          }),
        });
        
        const cleanupResult = await cleanupResponse.json();
        if (cleanupResult.success) {
          console.log(`✅ Limpieza completada: ${cleanupResult.cleanedCount} registros eliminados`);
        } else {
          console.log('⚠️ Error en limpieza, continuando...');
        }
      } catch (error) {
        console.log('⚠️ Error en limpieza, continuando...', error);
      }
      
      // Recargar todos los registros pendientes para mostrar los cambios
      try {
        console.log('🔄 Iniciando recarga completa de registros pendientes...');
        const refreshResponse = await fetch('/api/google-maps-pending?page=1&pageSize=10000&onlyPending=true');
        const refreshResult = await refreshResponse.json();
        
        if (refreshResult.success) {
          // Actualizar la vista con todos los registros pendientes
          setPendingRecords(refreshResult.data);
          setStats(refreshResult.stats);
          console.log(`✅ Vista actualizada: ${refreshResult.data.length} registros pendientes`);
          console.log(`📊 Estadísticas actualizadas:`, refreshResult.stats);
          
          // También actualizar los resultados del procesamiento para mostrar todos los cambios
          setProcessResults([...allResults]);
          console.log(`📊 Resultados del procesamiento actualizados: ${allResults.length} registros`);
        } else {
          console.error('❌ Error recargando vista:', refreshResult.error);
          // Fallback a la función normal
          await fetchPendingRecords();
        }
      } catch (error) {
        console.error('❌ Error recargando vista completa:', error);
        // Fallback a la función normal
        await fetchPendingRecords();
      }
      
    } catch (err) {
      console.error('❌ Error procesando todos los registros:', err);
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setProcessing(false);
    }
  };








  // Seleccionar/deseleccionar registro
  const toggleRecordSelection = (recordId: number) => {
    const newSelection = new Set(selectedRecords);
    if (newSelection.has(recordId)) {
      newSelection.delete(recordId);
    } else {
      newSelection.add(recordId);
    }
    setSelectedRecords(newSelection);
  };

  // Seleccionar todos los registros con datos de customer
  const selectAllWithCustomerData = () => {
    const recordsWithData = pendingRecords
      .filter(r => r.customer_data !== null)
      .map(r => r.id);
    setSelectedRecords(new Set(recordsWithData));
  };

  useEffect(() => {
    checkApiConfiguration();
    fetchPendingRecords();
  }, [currentPage]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Fecha no válida';
    }
  };

  if (apiKeyConfigured === false) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 text-yellow-600 mb-4">
          <AlertTriangle className="w-6 h-6" />
          <h2 className="text-xl font-semibold">Configuración Requerida</h2>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Para usar esta funcionalidad, necesitas configurar tu API key de Outscraper.
          </p>
          <p className="text-sm text-yellow-700 mt-2">
            Añade tu API key en el archivo <code className="bg-yellow-100 px-1 py-0.5 rounded">lib/config.ts</code> 
            en la sección <code className="bg-yellow-100 px-1 py-0.5 rounded">outscraper.apiKey</code>
          </p>
        </div>
      </div>
    );
  }

  if (apiKeyConfigured === null) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Verificando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPinOff className="w-6 h-6 text-orange-600" />
          <h2 className="text-xl font-semibold text-gray-800">
            Procesador de Registros Pendientes
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPendingRecords}
            disabled={loading || processing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Pendientes</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Con Datos Customer</p>
                <p className="text-2xl font-bold text-green-800">{stats.with_customer_data}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Sin Datos Customer</p>
                <p className="text-2xl font-bold text-red-800">{stats.without_customer_data}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAllWithCustomerData}
            disabled={loading || processing}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:text-gray-400"
          >
            Seleccionar todos con datos ({stats?.with_customer_data || 0})
          </button>
          <span className="text-gray-400">|</span>
          <button
            onClick={() => setSelectedRecords(new Set())}
            disabled={loading || processing}
            className="text-gray-600 hover:text-gray-700 text-sm disabled:text-gray-400"
          >
            Limpiar selección
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={processSelectedRecords}
            disabled={loading || processing || selectedRecords.size === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando con Outscraper...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Procesar {selectedRecords.size} registros con Outscraper
              </>
            )}
          </button>
          
          <button
            onClick={processAllPendingRecords}
            disabled={loading || processing || !stats?.with_customer_data || stats.with_customer_data === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando en lotes...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Procesar (máx. 100)
              </>
            )}
          </button>
          
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Resultados del procesamiento */}
      {processResults.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Search className="w-5 h-5" />
            Resultados del Procesamiento con Outscraper
          </h3>
          
          {/* Información de debug */}
          {processResults.length > 0 && (
            <div className="mb-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">🔍 Información de Debug</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• Revisa la consola del navegador para ver los logs detallados de Outscraper</p>
                <p>• Los logs del servidor aparecen en la terminal donde ejecutas `npm run dev`</p>
                <p>• Si no ves logs de Outscraper, verifica que la API key esté configurada correctamente</p>
              </div>
            </div>
          )}
          
          {/* Análisis de Errores */}
          {processResults.some(r => r.status === 'failed') && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-lg font-semibold text-red-800 mb-3">🔍 Análisis de Errores</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border">
                  <h4 className="font-medium text-gray-800 mb-2">📊 Estadísticas de Errores</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Total fallidos:</span> {processResults.filter(r => r.status === 'failed').length}</p>
                    <p><span className="font-medium">Con place_id:</span> {processResults.filter(r => r.status === 'failed' && r.placeId).length}</p>
                    <p><span className="font-medium">Sin place_id:</span> {processResults.filter(r => r.status === 'failed' && !r.placeId).length}</p>
                  </div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <h4 className="font-medium text-gray-800 mb-2">🔧 Tipos de Errores</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Error de BD:</span> {processResults.filter(r => r.status === 'failed' && r.error?.includes('base de datos')).length}</p>
                    <p><span className="font-medium">No encontrado:</span> {processResults.filter(r => r.status === 'not_found').length}</p>
                    <p><span className="font-medium">Otros:</span> {processResults.filter(r => r.status === 'failed' && !r.error?.includes('base de datos')).length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {processResults.map((result, index) => (
              <div key={`${result.recordId}-${index}`} className="border border-blue-200 rounded-lg p-3 bg-white">
                <div className="flex items-start gap-2 mb-2">
                  {result.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  ) : result.status === 'not_found' ? (
                    <MapPinOff className="w-4 h-4 text-yellow-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">
                      {result.name || 'Registro sin nombre'}
                    </h4>
                    <p className={`text-sm ${
                      result.status === 'success' ? 'text-green-700' :
                      result.status === 'not_found' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {result.status === 'success' ? '✅ Encontrado y actualizado en Google Maps' :
                       result.status === 'not_found' ? '⚠️ No encontrado en Google Maps' :
                       `❌ Error: ${result.error || 'Error desconocido'}`}
                    </p>
                  </div>
                </div>
                
                {/* Mostrar detalles de error si está disponible */}
                {result.status === 'failed' && result.errorDetails && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                    <h5 className="font-medium text-red-800 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Detalles del Error
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-red-600 font-medium">Tiene place_id:</span>
                        <span className="ml-1">{result.errorDetails.hasPlaceId ? 'Sí' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-red-600 font-medium">Tiene nombre:</span>
                        <span className="ml-1">{result.errorDetails.hasName ? 'Sí' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-red-600 font-medium">Tiene dirección:</span>
                        <span className="ml-1">{result.errorDetails.hasAddress ? 'Sí' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-red-600 font-medium">Campos disponibles:</span>
                        <span className="ml-1">{result.errorDetails.dataKeys?.length || 0}</span>
                      </div>
                    </div>
                    {result.errorDetails.dataKeys && (
                      <div className="mt-2">
                        <span className="text-red-600 font-medium text-xs">Campos:</span>
                        <div className="text-xs text-gray-600 mt-1">
                          {result.errorDetails.dataKeys.slice(0, 5).join(', ')}
                          {result.errorDetails.dataKeys.length > 5 && ` ... (+${result.errorDetails.dataKeys.length - 5} más)`}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Mostrar detalles de Outscraper si están disponibles */}
                {result.data && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <h5 className="font-medium text-blue-800 mb-2 flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      Datos de Outscraper
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {result.data.place_id && (
                        <div>
                          <span className="text-blue-600 font-medium">Place ID:</span>
                          <span className="ml-1">{result.data.place_id}</span>
                        </div>
                      )}
                      {result.data.rating && (
                        <div>
                          <span className="text-blue-600 font-medium">Rating:</span>
                          <span className="ml-1">{result.data.rating} ⭐</span>
                        </div>
                      )}
                      {result.data.reviews && (
                        <div>
                          <span className="text-blue-600 font-medium">Reviews:</span>
                          <span className="ml-1">{result.data.reviews}</span>
                        </div>
                      )}
                      {result.data.phone && (
                        <div>
                          <span className="text-blue-600 font-medium">Teléfono:</span>
                          <span className="ml-1">{result.data.phone}</span>
                        </div>
                      )}
                      {result.data.site && (
                        <div>
                          <span className="text-blue-600 font-medium">Website:</span>
                          <span className="ml-1 text-blue-600 underline">
                            <a href={result.data.site} target="_blank" rel="noopener noreferrer">
                              {result.data.site}
                            </a>
                          </span>
                        </div>
                      )}
                      {result.data.full_address && (
                        <div className="col-span-2">
                          <span className="text-blue-600 font-medium">Dirección:</span>
                          <span className="ml-1">{result.data.full_address}</span>
                        </div>
                      )}
                      {result.data.category && (
                        <div>
                          <span className="text-blue-600 font-medium">Categoría:</span>
                          <span className="ml-1">{result.data.category}</span>
                        </div>
                      )}
                      {result.data.latitude && result.data.longitude && (
                        <div className="col-span-2">
                          <span className="text-blue-600 font-medium">Coordenadas:</span>
                          <span className="ml-1">{result.data.latitude}, {result.data.longitude}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de registros */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Cargando registros...</span>
        </div>
      ) : pendingRecords.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay registros pendientes para procesar
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRecords.map((record) => (
            <div
              key={record.id}
              className={`border rounded-lg p-4 transition-colors ${
                selectedRecords.has(record.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedRecords.has(record.id)}
                  onChange={() => toggleRecordSelection(record.id)}
                  disabled={processing || !record.customer_data}
                  className="mt-1"
                />
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        {record.metabase_id ? `ID: ${record.metabase_id}` : 'Sin ID'}
                      </h4>
                      {record.name && record.name !== 'null' && (
                        <p className="text-sm text-gray-500 mt-1">
                          Nombre: {record.name}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3" />
                        {record.customer_data ? `${record.customer_data.address}, ${record.customer_data.city}` : 'Sin datos de ubicación'}
                      </p>
                      
                                             {record.customer_data?.phone && (
                         <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                           <Phone className="w-3 h-3" />
                           {record.customer_data.phone}
                         </p>
                       )}
                       
                       {record.customer_data?.website && (
                         <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                           <Globe className="w-3 h-3" />
                           {record.customer_data.website}
                         </p>
                       )}
                    </div>
                    
                    <div className="text-right">
                      {record.customer_data ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Con datos
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                          <XCircle className="w-3 h-3" />
                          Sin datos
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {record.customer_data && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Datos de Customer:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Nombre:</span>
                          <span className="ml-1 font-medium">{record.customer_data.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Ciudad:</span>
                          <span className="ml-1 font-medium">{record.customer_data.city}</span>
                        </div>
                        {record.customer_data.phone && (
                          <div>
                            <span className="text-gray-600">Teléfono:</span>
                            <span className="ml-1 font-medium">{record.customer_data.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Creado: {formatDate(record.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {stats && stats.total > pageSize && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loading || processing}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Anterior
          </button>
          
          <span className="text-sm text-gray-600">
            Página {currentPage} de {Math.ceil(stats.total / pageSize)}
          </span>
          
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage >= Math.ceil(stats.total / pageSize) || loading || processing}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleMapsPendingProcessor;
