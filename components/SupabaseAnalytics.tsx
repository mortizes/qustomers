'use client';

import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertCircle, Users, MapPin, Clock } from 'lucide-react';

interface TableStats {
  count: number;
  lastUpdated?: string;
}

interface SupabaseStats {
  total: number;
  tables: {
    metabase_customers: TableStats;
    google_maps: TableStats;
    google_maps_pending: TableStats;
  };
  lastUpdated?: string;
}

interface SupabaseAnalyticsProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const SupabaseAnalytics: React.FC<SupabaseAnalyticsProps> = ({ 
  autoRefresh = true, 
  refreshInterval = 30000 // 30 segundos
}) => {
  const [stats, setStats] = useState<SupabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/supabase-stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
        
        // Formatear la fecha de la base de datos si existe
        if (result.data.lastUpdated) {
          // Parsear la fecha UTC y convertir a la zona horaria local para mostrar la fecha correcta
          const utcDate = new Date(result.data.lastUpdated);
          
          // Obtener la fecha en la zona horaria local (España)
          const localDay = utcDate.getDate().toString().padStart(2, '0');
          const localMonth = (utcDate.getMonth() + 1).toString().padStart(2, '0');
          const localYear = utcDate.getFullYear();
          const localHours = utcDate.getHours().toString().padStart(2, '0');
          const localMinutes = utcDate.getMinutes().toString().padStart(2, '0');
          const localSeconds = utcDate.getSeconds().toString().padStart(2, '0');
          
          setLastUpdated(`${localDay}/${localMonth}/${localYear} - ${localHours}:${localMinutes}:${localSeconds}`);
        } else {
          setLastUpdated('No disponible');
        }
      } else {
        setError(result.error || 'Error obteniendo estadísticas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  if (loading && !stats) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Cargando estadísticas...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <span className="ml-2">Error: {error}</span>
        </div>
        <div className="text-center mt-4">
          <button
            onClick={fetchStats}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  const formatLastUpdated = (dateString: string): string => {
    try {
      const utcDate = new Date(dateString);
      
      // Obtener la fecha en la zona horaria local (España)
      const localDay = utcDate.getDate().toString().padStart(2, '0');
      const localMonth = (utcDate.getMonth() + 1).toString().padStart(2, '0');
      const localYear = utcDate.getFullYear();
      const localHours = utcDate.getHours().toString().padStart(2, '0');
      const localMinutes = utcDate.getMinutes().toString().padStart(2, '0');
      const localSeconds = utcDate.getSeconds().toString().padStart(2, '0');
      
      return `${localDay}/${localMonth}/${localYear} - ${localHours}:${localMinutes}:${localSeconds}`;
    } catch (error) {
      return 'Fecha no disponible';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-end mb-6">
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Última actualización de datos:</p>
            <p className="text-sm text-gray-700 font-medium">{lastUpdated}</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customers */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Customers</h3>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-800">
                {stats ? formatNumber(stats.tables.metabase_customers.count) : '0'}
              </p>
              <p className="text-xs text-gray-500">registros</p>
            </div>
          </div>
          
          {stats?.tables.metabase_customers.lastUpdated && (
            <div className="text-xs text-gray-600 border-t pt-2">
              <span className="text-gray-500">Actualizado: </span>
              {formatLastUpdated(stats.tables.metabase_customers.lastUpdated)}
            </div>
          )}
        </div>

        {/* Google Maps */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-800">Google Maps</h3>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-800">
                {stats ? formatNumber(stats.tables.google_maps.count) : '0'}
              </p>
              <p className="text-xs text-gray-500">registros totales</p>
            </div>
          </div>

          {/* Subsección de Pendientes */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Pendientes</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-800">
                  {stats ? formatNumber(stats.tables.google_maps_pending.count) : '0'}
                </p>
                <p className="text-xs text-yellow-600">sin completar</p>
              </div>
            </div>
          </div>
          
          {stats?.tables.google_maps.lastUpdated && (
            <div className="text-xs text-gray-600 border-t pt-2">
              <span className="text-gray-500">Actualizado: </span>
              {formatLastUpdated(stats.tables.google_maps.lastUpdated)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupabaseAnalytics;
