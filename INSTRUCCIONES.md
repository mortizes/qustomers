# 🚀 Instrucciones de Uso - Visor de Metabase

## ⚡ Inicio Rápido

### 1. Configuración Inicial
```bash
# Instalar dependencias
npm install

# Crear archivo de entorno
cp .env.local.example .env.local

# Ejecutar la aplicación
npm run dev
```

### 2. Acceso Inmediato
- Abre: `http://localhost:3000`
- Haz clic en **"Consultar Card 7391"** (botón verde de acceso rápido)
- ¡Listo! Verás los datos inmediatamente

---

## 📊 Configuración Específica de tu Metabase

### Credenciales Configuradas:
- **URL**: `https://qamarero.metabaseapp.com`
- **API Key**: `GYM4tju.adc!auf1ctd`
- **Base de datos**: `customers-database`
- **Card de ejemplo**: ID 7391

### Método de Autenticación:
✅ **API Key** (Implementado - Recomendado por Metabase)
- Más simple: Un solo request
- Más seguro: No expone credenciales
- Más estable: No expira cada 14 días

---

## 🎯 Cómo Usar la Aplicación

### Opción 1: Acceso Rápido (Recomendado)
1. Haz clic en **"Consultar Card 7391"**
2. Los datos se cargarán automáticamente
3. Puedes descargar como CSV si necesitas

### Opción 2: Consulta Manual por Card
1. Selecciona **"📊 Card (Recomendado)"**
2. Ingresa el ID del card (ej: 7391)
3. Haz clic en **"Consultar"**

### Opción 3: Consulta por Tabla
1. Selecciona **"🗃️ Tabla"**
2. Ingresa el ID de la tabla
3. Haz clic en **"Consultar"**

---

## 🔧 Configuración de la API de Metabase

### Request HTTP Directo:
```bash
curl -X POST https://qamarero.metabaseapp.com/api/card/7391/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: GYM4tju.adc!auf1ctd" \
  -d '{
    "constraints": {
      "max-results": 1000
    }
  }'
```

### Configuración para Make.com u otros automatizadores:
- **URL**: `https://qamarero.metabaseapp.com/api/card/7391/query`
- **Método**: POST
- **Headers**:
  - `Content-Type: application/json`
  - `x-api-key: GYM4tju.adc!auf1ctd`
- **Body**:
  ```json
  {
    "constraints": {
      "max-results": 1000
    }
  }
  ```
- **Timeout**: 300 segundos (5 minutos)
- **Parse response**: Sí
- **Follow redirect**: Sí

---

## 📋 Funcionalidades Incluidas

### ✅ Características Principales:
- **Consulta por Card ID** (método recomendado)
- **Consulta por Table ID** (método alternativo)
- **Visualización en tabla responsive**
- **Descarga de datos en CSV**
- **Lista de cards y tablas disponibles**
- **Estados de carga y manejo de errores**
- **Acceso rápido al Card 7391**

### ✅ Beneficios del Card ID:
- **Simplicidad**: Un solo request HTTP
- **Seguridad**: No expone credenciales de usuario
- **Estabilidad**: La API key no expira automáticamente
- **Rendimiento**: Consultas optimizadas y predefinidas

---

## 🛠 Solución de Problemas

### Error de Conexión:
- Verifica que la URL `https://qamarero.metabaseapp.com` sea accesible
- Confirma que la API key `GYM4tju.adc!auf1ctd` sea válida

### Card/Tabla No Encontrada:
- Verifica que el ID existe en tu instancia de Metabase
- Confirma que tienes permisos para acceder a ese recurso

### Timeout:
- Algunos cards pueden tomar más tiempo en ejecutarse
- El timeout está configurado a 5 minutos
- Para consultas grandes, considera usar un límite menor

---

## 🎨 Personalización

### Cambiar Límite de Resultados:
Modifica `config.metabase.defaultLimit` en `lib/config.ts`

### Cambiar Card de Acceso Rápido:
Actualiza `config.metabase.exampleCardId` en `lib/config.ts`

### Personalizar Estilos:
Modifica los colores en `tailwind.config.js`

---

## 📚 Estructura de Respuesta

### Formato de Datos:
```json
{
  "columns": ["id", "nombre", "email", "fecha_creacion"],
  "rows": [
    [1, "Juan Pérez", "juan@email.com", "2024-01-15"],
    [2, "María García", "maria@email.com", "2024-01-16"]
  ],
  "metadata": {
    "table": {
      "id": 7391,
      "name": "card_7391",
      "display_name": "Card 7391"
    },
    "total_rows": 2
  }
}
```

---

## 🚀 Flujo Recomendado

1. **Desarrollo**: `npm run dev`
2. **Acceso**: `http://localhost:3000`
3. **Test rápido**: Botón "Consultar Card 7391"
4. **Exploración**: Usa otros Card IDs según necesites
5. **Descarga**: Botón CSV para exportar datos

¡Tu aplicación está lista para usar con tu configuración específica de Metabase! 🎉
