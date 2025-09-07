'use client';

import React, { useState, useEffect } from 'react';
import { Download, Database, RefreshCw, CheckCircle, AlertCircle, ArrowRight, Clock, Users, TrendingUp, Plus, Edit } from 'lucide-react';


interface ImportStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  time?: number;
}

const Card7391Importer: React.FC = () => {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [progressWidth, setProgressWidth] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [steps, setSteps] = useState<ImportStep[]>([
    { id: 'metabase', title: 'Consultar Card 7391 en Metabase', status: 'pending' },
    { id: 'mapping', title: 'Mapear datos CSV → SQL', status: 'pending' },
    { id: 'analyze', title: 'Analizar registros existentes', status: 'pending' },
    { id: 'upsert', title: 'Sincronizar (INSERT + UPDATE)', status: 'pending' },
    { id: 'analytics', title: 'Generar analítica', status: 'pending' },
  ]);

  const updateStepStatus = (stepId: string, status: ImportStep['status'], details?: string, time?: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, details, time }
        : step
    ));
  };

  const startImport = async () => {
    setImporting(true);
    setImportResult(null);
    setProgressWidth(0);
    setElapsedTime(0);
    
    // Resetear todos los pasos
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', details: undefined, time: undefined })));
    
    // Iniciar contador de tiempo
    const startTime = Date.now();
    const timeInterval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Declarar timeouts fuera del try para poder limpiarlos
    let timeout1: NodeJS.Timeout | undefined;
    let timeout2: NodeJS.Timeout | undefined;
    let timeout3: NodeJS.Timeout | undefined;
    let timeout4: NodeJS.Timeout | undefined;

    try {
      console.log('🚀 Iniciando proceso de importación...');
      
      // Actualizar primer paso como "running" y progreso inicial
      setProgressWidth(10);
      updateStepStatus('metabase', 'running', 'Conectando con Metabase...');
      
      // Iniciar timeouts para feedback visual
      timeout1 = setTimeout(() => {
        setProgressWidth(25);
        updateStepStatus('metabase', 'completed', 'Datos obtenidos de Metabase');
        updateStepStatus('mapping', 'running', 'Procesando y mapeando datos...');
      }, 10000);
      
      timeout2 = setTimeout(() => {
        setProgressWidth(50);
        updateStepStatus('mapping', 'completed', 'Mapeo completado');
        updateStepStatus('analyze', 'running', 'Analizando registros existentes...');
      }, 30000);
      
      timeout3 = setTimeout(() => {
        setProgressWidth(75);
        updateStepStatus('analyze', 'completed', 'Análisis completado');
        updateStepStatus('upsert', 'running', 'Sincronizando en lotes (esto puede tomar tiempo)...');
      }, 45000);
      
      timeout4 = setTimeout(() => {
        setProgressWidth(90);
        updateStepStatus('analytics', 'running', 'Finalizando proceso...');
      }, 90000);

      const response = await fetch('/api/smart-sync-card-7391', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Aumentar timeout para procesos largos
        signal: AbortSignal.timeout(300000), // 5 minutos
      });

      // Limpiar timeouts e intervalo una vez que tenemos respuesta
      clearInterval(timeInterval);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setImportResult(result);
      
      // Actualizar estados finales basado en el resultado real
      if (result.success) {
        setProgressWidth(100);
        updateStepStatus('metabase', 'completed', 
          `${result.metabase?.rows || 0} filas obtenidas`,
          result.metabase?.executionTime);
        
        updateStepStatus('mapping', 'completed',
          `${result.mapping?.valid || 0} registros válidos de ${result.mapping?.processed || 0}`);
        
        updateStepStatus('analyze', 'completed',
          `${result.supabase?.totalBefore || 0} registros existentes`);
        
        updateStepStatus('upsert', 'completed',
          `${result.supabase?.inserted || 0} nuevos + ${result.supabase?.updated || 0} actualizados`);
        
        updateStepStatus('analytics', 'completed',
          `Proceso completado en ${formatElapsedTime(elapsedTime)}`);
      } else {
        // Marcar como error si falló
        setProgressWidth(100);
        updateStepStatus('metabase', 'error', result.error || 'Error en el proceso');
        updateStepStatus('mapping', 'error', 'Proceso interrumpido');
        updateStepStatus('analyze', 'error', 'Proceso interrumpido');
        updateStepStatus('upsert', 'error', 'Proceso interrumpido');
        updateStepStatus('analytics', 'error', 'Proceso interrumpido');
      }

      console.log('✅ Proceso completado:', result);

    } catch (error) {
      console.error('💥 Error en importación:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error de conexión';
      
      // Limpiar timeouts e intervalo en caso de error
      clearInterval(timeInterval);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);
      
      setProgressWidth(100);
      setImportResult({
        success: false,
        error: errorMessage
      });
      
      // Marcar todos los pasos pendientes como error
      setSteps(prev => prev.map(step => 
        step.status === 'pending' || step.status === 'running'
          ? { ...step, status: 'error', details: errorMessage }
          : step
      ));
    } finally {
      // Limpiar todos los timeouts e intervalos al finalizar
      clearInterval(timeInterval);
      if (timeout1) clearTimeout(timeout1);
      if (timeout2) clearTimeout(timeout2);
      if (timeout3) clearTimeout(timeout3);
      if (timeout4) clearTimeout(timeout4);
      setImporting(false);
    }
  };

  const getStepIcon = (step: ImportStep) => {
    switch (step.status) {
      case 'running':
        return <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Sincronizador Card 7391 ↔ Supabase
          </h1>
          <p className="text-gray-600 text-lg">
            Sincronización inteligente: Inserta nuevos registros y actualiza existentes
          </p>
        </div>



        {/* Card de Información */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Origen: Metabase
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Card ID:</strong> 7391</li>
                <li><strong>Tipo:</strong> Consulta compleja con JOINs</li>
                <li><strong>Datos:</strong> Información de restaurantes y métricas</li>
                <li><strong>Campos:</strong> 20 columnas de datos + auditoría</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-green-600" />
                Destino: Supabase
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Tabla:</strong> metabase_customers</li>
                <li><strong>Esquema:</strong> public</li>
                <li><strong>Operación:</strong> Reemplazar datos existentes</li>
                <li><strong>Mapeo:</strong> CSV → SQL con validación</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Botón de Importación */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 text-center">
          <button
            onClick={startImport}
            disabled={importing}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center gap-3 mx-auto text-lg disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin" />
                Sincronizando datos...
              </>
            ) : (
              <>
                <Download className="w-6 h-6" />
                Importar Card 7391 → Supabase
              </>
            )}
          </button>
          
          {importing && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2 max-w-md mx-auto">
                <div 
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-1000" 
                  style={{ width: `${progressWidth}%` }}
                ></div>
              </div>
              <p className="text-gray-600 text-sm mt-2">
                Procesando datos, por favor espere... ({progressWidth}%)
              </p>
              <p className="text-gray-500 text-xs mt-1">
                ⏱️ Tiempo transcurrido: {formatElapsedTime(elapsedTime)}
              </p>
            </div>
          )}
          
          {!importing && (
            <p className="text-gray-600 text-sm mt-3">
              UPSERT: Inserta nuevos registros y actualiza existentes (preserva created_at)
            </p>
          )}
        </div>

        {/* Progreso de Pasos */}
        {(importing || importResult) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Progreso de Importación
            </h3>
            
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-4 p-4 rounded-lg border border-gray-200">
                  <div className="flex-shrink-0">
                    {getStepIcon(step)}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">
                      {index + 1}. {step.title}
                    </h4>
                    {step.details && (
                      <p className="text-sm text-gray-600 mt-1">{step.details}</p>
                    )}
                    {step.time && (
                      <p className="text-xs text-gray-500 mt-1">
                        Tiempo: {formatTime(step.time)}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-sm font-medium">
                    {step.status === 'running' && <span className="text-blue-600">En progreso...</span>}
                    {step.status === 'completed' && <span className="text-green-600">Completado</span>}
                    {step.status === 'error' && <span className="text-red-600">Error</span>}
                    {step.status === 'pending' && <span className="text-gray-400">Pendiente</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultados Finales Simplificados */}
        {importResult && (
          <div className={`rounded-xl shadow-lg p-6 ${
            importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3 mb-6">
              {importResult.success ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-500" />
              )}
              <div>
                <h3 className={`text-2xl font-bold ${
                  importResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {importResult.success ? '¡Sincronización Completada!' : 'Error en Sincronización'}
                </h3>
                <p className={`text-sm ${
                  importResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  Completado en {formatElapsedTime(elapsedTime)}
                </p>
              </div>
            </div>

            {/* Resumen de Registros */}
            {importResult.success && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Plus className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-3xl font-bold text-green-800">
                        {importResult.supabase?.inserted || 0}
                      </p>
                      <p className="text-lg text-green-600 font-medium">Registros Nuevos</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Insertados con created_at actual</p>
                </div>

                <div className="bg-white rounded-lg p-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Edit className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-3xl font-bold text-blue-800">
                        {importResult.supabase?.updated || 0}
                      </p>
                      <p className="text-lg text-blue-600 font-medium">Registros Actualizados</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Preservando created_at original</p>
                </div>
              </div>
            )}



            {/* Error Details */}
            {!importResult.success && importResult.error && (
              <div className="bg-white rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-red-800 mb-2">❌ Detalles del Error</h4>
                <p className="text-sm text-red-600">{importResult.error}</p>
              </div>
            )}
          </div>
        )}



        {/* Estado Vacío */}
        {!importing && !importResult && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Sincronizador Inteligente
            </h3>
            <p className="text-gray-600 mb-6">
              Sincroniza automáticamente los datos del Card 7391 con tu base de datos Supabase
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Registros Nuevos
                </h4>
                <p className="text-sm text-green-700">
                  Se insertan con created_at actual y todos los campos del Card 7391
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Registros Existentes
                </h4>
                <p className="text-sm text-blue-700">
                  Se actualizan preservando created_at original, actualizando updated_at
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-md mx-auto mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">📋 Mapeo de Campos</h4>
              <div className="text-xs text-gray-700 space-y-1 text-left">
                <div>• ID → id (UUID) - Preservado</div>
                <div>• Name → name (VARCHAR) - Actualizable</div>
                <div>• Comandas por Funcionalidad → contadores - Actualizables</div>
                <div>• Panel AM → reservas_count, horario_count - Actualizables</div>
                <div>• Facturación → totales históricos - Actualizables</div>
                <div>• Módulos → scoring y estado - Actualizables</div>
                <div>• created_at - Preservado | updated_at - Actualizado</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Card7391Importer;
