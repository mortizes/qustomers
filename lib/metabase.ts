import { config, getMetabaseHeaders, buildApiUrl, validateConfig } from './config';

// Tipos de TypeScript para los datos de Metabase
export interface MetabaseColumn {
  id: number;
  name: string;
  display_name: string;
  base_type: string;
  semantic_type?: string;
  description?: string;
}

export interface MetabaseTable {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  db_id: number;
  schema?: string;
  fields: MetabaseColumn[];
}

export interface MetabaseTableData {
  columns: string[];
  rows: any[][];
  metadata: {
    table: MetabaseTable;
    total_rows?: number;
  };
}

export interface MetabaseSession {
  id: string;
  'is-superuser': boolean;
  'is-qbnewb': boolean;
}

export interface MetabaseError {
  error: string;
  message?: string;
}

// Clase para manejar la API de Metabase
export class MetabaseAPI {
  private baseUrl: string;
  private sessionToken: string | null = null;

  constructor() {
    validateConfig();
    this.baseUrl = config.metabase.url.replace(/\/$/, ''); // Remover slash final
  }

  /**
   * Autentica con Metabase para obtener session token
   */
  private async authenticateWithSession(username: string, password: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error de autenticación: ${response.status} ${response.statusText}`);
      }

      const session: MetabaseSession = await response.json();
      this.sessionToken = session.id;
    } catch (error) {
      throw new Error(`Error al autenticar con Metabase: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene headers para las peticiones autenticadas
   */
  private getAuthHeaders(useSessionToken: boolean = false): Record<string, string> {
    if (useSessionToken && this.sessionToken) {
      return {
        'Content-Type': 'application/json',
        'X-Metabase-Session': this.sessionToken,
      };
    }
    return this.getCorrectHeaders();
  }

  /**
   * Obtiene los metadatos de una tabla específica
   */
  async getTableMetadata(tableId: number): Promise<MetabaseTable> {
    try {
      const response = await fetch(`${this.baseUrl}/api/table/${tableId}/query_metadata`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error al obtener metadatos: ${response.status} ${response.statusText}`);
      }

      const tableData: MetabaseTable = await response.json();
      return tableData;
    } catch (error) {
      throw new Error(`Error al obtener metadatos de la tabla ${tableId}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene headers de autenticación usando el formato correcto
   */
  private getCorrectHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': config.metabase.apiKey,
    };
  }

  /**
   * Obtiene todos los datos de un card específico (recomendado)
   */
  async getCardData(cardId: number, limit: number = 1000): Promise<MetabaseTableData> {
    try {
      const queryPayload = {
        constraints: {
          'max-results': limit,
        },
      };

      // Crear AbortController para manejar timeout personalizado
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.metabase.timeout);

      const response = await fetch(`${this.baseUrl}/api/card/${cardId}/query`, {
        method: 'POST',
        headers: this.getCorrectHeaders(),
        body: JSON.stringify(queryPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error ${response.status}:`, errorText);
        throw new Error(`Error al obtener datos del card: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Verificar si hay error en la respuesta
      if (result.status === 'failed' || result.error) {
        throw new Error(`Error en la consulta de Metabase: ${result.error || 'Consulta falló'}`);
      }
      
      // Verificar que la respuesta tenga la estructura esperada
      if (!result.data || !result.data.cols) {
        throw new Error('Estructura de respuesta inesperada de Metabase');
      }
      
      const rows = result.data.rows || [];
      const cols = result.data.cols || [];
      
      return {
        columns: cols.map((col: any) => col.display_name || col.name),
        rows: rows,
        metadata: {
          table: {
            id: cardId,
            name: `card_${cardId}`,
            display_name: `Card ${cardId}`,
            db_id: 0,
            fields: cols,
          },
          total_rows: rows.length,
        },
      };
    } catch (error) {
      throw new Error(`Error al obtener datos del card ${cardId}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene todos los datos de una tabla específica usando dataset API
   */
  async getTableData(tableId: number, limit: number = 1000): Promise<MetabaseTableData> {
    try {
      // Primero obtener metadatos de la tabla
      const tableMetadata = await this.getTableMetadata(tableId);

      // Crear consulta para obtener todos los datos
      const queryPayload = {
        database: tableMetadata.db_id,
        query: {
          'source-table': tableId,
          limit: limit,
        },
        type: 'query',
      };

      const response = await fetch(`${this.baseUrl}/api/dataset`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(queryPayload),
      });

      if (!response.ok) {
        throw new Error(`Error al obtener datos: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        columns: result.data.cols.map((col: any) => col.display_name || col.name),
        rows: result.data.rows,
        metadata: {
          table: tableMetadata,
          total_rows: result.row_count,
        },
      };
    } catch (error) {
      throw new Error(`Error al obtener datos de la tabla ${tableId}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Lista todas las tablas disponibles en la base de datos
   */
  async getAllTables(): Promise<MetabaseTable[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error al obtener bases de datos: ${response.status} ${response.statusText}`);
      }

      const databases = await response.json();
      const customerDb = databases.data?.find((db: any) => 
        db.name.toLowerCase().includes('customer') || 
        db.name === config.metabase.databaseName
      );

      if (!customerDb) {
        throw new Error(`Base de datos "${config.metabase.databaseName}" no encontrada`);
      }

      // Obtener tablas de la base de datos
      const tablesResponse = await fetch(`${this.baseUrl}/api/database/${customerDb.id}/metadata`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!tablesResponse.ok) {
        throw new Error(`Error al obtener tablas: ${tablesResponse.status} ${tablesResponse.statusText}`);
      }

      const metadata = await tablesResponse.json();
      return metadata.tables || [];
    } catch (error) {
      throw new Error(`Error al obtener todas las tablas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Lista todos los cards disponibles
   */
  async getAllCards(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/card`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error al obtener cards: ${response.status} ${response.statusText}`);
      }

      const cards = await response.json();
      return cards || [];
    } catch (error) {
      throw new Error(`Error al obtener todos los cards: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
}

// Instancia singleton de la API
export const metabaseApi = new MetabaseAPI();
