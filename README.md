# Full.Stock - Sistema de Gestión Integral para Ferreterías

> **Proyecto ABP - Módulo 4**  
> **Desarrollado por: Fabian Ortiz Pena**  
> **Empresa simulada: ConstruShop**  
> **Fecha: Julio 2026**

---

## 📋 Descripción General

**Full.Stock** es una aplicación web SPA (Single Page Application) desarrollada en **JavaScript vanilla**, HTML5 y CSS3, diseñada para simular la gestión completa de una ferretería/tienda de materiales de construcción. El proyecto evolucionó desde un sistema básico de reposición de inventario (ABP3) hacia una **plataforma integral de gestión comercial** que permite al gerente operar como si estuviera físicamente recorriendo cada área de su tienda.

### 🎯 Concepto del Proyecto

> *"Ahora funciona como un gerente que quiere probar cómo funciona su tienda. Para esto accede a cada punto de su tienda: va a **ventas** y aprovecha de vender para probar cómo es el sistema, luego va a **bodega**, asigna trabajadores y realiza entregas, luego va a las **oficinas** a comprar a partir de las tareas anteriores, y ve en su **propia oficina** todos los movimientos de la tienda."*

---

## ✅ Cumplimiento de Requerimientos del Módulo #4 (Programación Avanzada en JavaScript)

Esta aplicación cumple estrictamente con los 5 puntos de evaluación del Módulo 4:

### 1. Orientación a Objetos (POO) en JavaScript
- **Clase `Tarea`** (`fullstock/js/data.js`):
  - Propiedades: `id`, `descripcion` (getter/setter mapped a notas/materialNombre), `tipo`, `estado`, `fechaCreacion`, `fechaLimite`, `prioridad`, etc.
  - Métodos: `cambiarEstado(nuevoEstado)`, `marcarCompletada()`, `eliminar()`, `esVencida()`, `obtenerTiempoRestante()`.
- **Clase `GestorTareas`** (`fullstock/js/data.js`):
  - Administra el listado de tareas con los métodos: `agregarTarea(tarea)`, `eliminarTarea(id)`, `cambiarEstadoTarea(id, nuevoEstado)`, `obtenerTareas()`, `obtenerTareaPorId(id)`, `filtrarPorEstado(estado)`, `filtrarPorTipo(tipo)`, `buscarTareas(query)`, `guardarEnAPI(tarea)`, `recuperarDeAPI()`, `guardarEnStorage()`, `cargarDeStorage()`.
  - Instancia global accesible en la aplicación: `gestorTareas`.

### 2. Características ES6+
- **Variables**: Uso exclusivo de `let` y `const` en todo el proyecto.
- **Template Literals**: Construcción dinámica de HTML y mensajes formateados usando `` `... ${var} ...` ``.
- **Arrow Functions**: Implementado ampliamente en manipuladores de eventos, iteradores de arreglos (`map`, `filter`, `forEach`, `sort`, `find`, `findIndex`).
- **Destructuring**: Extracción de propiedades directamente en parámetros e iteraciones (`const { materialNombre, sku, notas } = tarea`).
- **Spread & Rest Operators (`...`)**: Utilizado para clonar y combinar objetos/arreglos (`[...this.tareas]`, `{ ...datosJSON.tienda }`).

### 3. Eventos y Manipulación del DOM
- **Formularios e Interacción HTML**: Formulario modal `#form-nueva-tarea` para agregar tareas con captura del evento `submit` y `e.preventDefault()`.
- **Eventos `click`**: Navegación, botones de acción en tarjetas Kanban (Iniciar, Entregar, Negociar, Cancelar), modales y autenticación.
- **Eventos `keyup`**: Búsqueda y filtrado en tiempo real de tareas en Bodega (`#input-busqueda-bodega`) y Reposición (`#input-busqueda-reposicion`).
- **Eventos `mouseover` y `mouseout`**: Tooltips dinámicos con información extendida (`hoverKanbanCard` y `unhoverKanbanCard`) al pasar el cursor sobre las tarjetas Kanban y elementos del inventario.

### 4. JavaScript Asíncrono
- **Retardo Simulado (`setTimeout`)**: Retardo asíncrono de 1.5 segundos con indicador de carga (`#nt-spinner`) al procesar la creación de una tarea.
- **Notificaciones Asincrónicas (2s)**: Mensajes emergentes (`mostrarNotificacionAsync`) generados con 2 segundos de retraso tras la finalización de acciones o peticiones.
- **Contador Regresivo en Tiempo Real (`setInterval`)**: Temporizador continuo de 1 segundo que calcula y refresca el tiempo restante hasta la `fechaLimite` de cada tarea (`⏳ HH:MM:SS` o `🔴 Expirada`).

### 5. Consumo de APIs y Persistencia
- **Peticiones `fetch()` con `try/catch`**:
  - GET a `https://jsonplaceholder.typicode.com/todos?_limit=5` para importar tareas externas al sistema (`gestorTareas.recuperarDeAPI()`).
  - POST a `https://jsonplaceholder.typicode.com/posts` para enviar nuevas tareas a la API (`gestorTareas.guardarEnAPI(tarea)`).
  - Manejo completo de errores con bloques `try/catch` y notificaciones al usuario.
- **Almacenamiento Local (`localStorage`)**: Persistencia continua de `tareas`, `inventario`, `ventas`, `proveedores` y configuración en `localStorage` (sincronizado con `sessionStorage`).

---

## 🏗️ Arquitectura del Sistema

### Estructura de Archivos
```
M4-entrega-ABP/
├── index.html                 # Entry point SPA
├── .gitignore
├── sections/                  # Vistas parciales (cargadas por fetch)
│   ├── inicio.html           # Dashboard / Landing
│   ├── venta.html            # Módulo Ventas (Punto de venta)
│   ├── bodega.html           # Módulo Bodega (Kanban entregas)
│   ├── reposicion.html       # Módulo Reposición (Kanban compras)
│   ├── inventario.html       # Módulo Inventario + Reportes
│   ├── estadisticas.html     # Módulo Estadísticas (10 tabs)
│   └── opciones.html         # Configuración tienda/tema/reset
└── fullstock/
    ├── css/
    │   └── estilos.css       # Estilos base + themes (light/dark)
    ├── js/
    │   ├── app.js            # Navegación SPA, Login, Render por sección
    │   ├── data.js           # Carga JSON, Clase Tarea, Persistencia, Lógica negocio
    │   └── swal.js           # Alertas tipo SweetAlert personalizadas
    └── data.json             # Base de datos semilla (JSON estático)
```

### Stack Tecnológico
- **Frontend**: HTML5, CSS3 (Custom Properties, Grid, Flexbox), ES6+ Vanilla JS
- **Arquitectura**: SPA con navegación dinámica vía `fetch()` + `innerHTML`
- **Persistencia**: `sessionStorage` (simula base de datos en memoria de sesión)
- **Datos iniciales**: `data.json` (15 materiales, 15 ventas, 6 proveedores, 10 clientes, 5 empleados)
- **Patrones**: Clase `Tarea` con máquina de estados, módulos por sección, pub/sub implícito vía `render*()`

---

## 🏪 Módulos Funcionales (Secciones de la Tienda)

### 1. 🏠 **INICIO** (`inicio.html`)
Dashboard de bienvenida con acceso rápido a módulos. Muestra:
- Nombre de la tienda (configurable)
- Resumen de módulos disponibles
- Botón de login para acceder al sistema

---

### 2. 🛒 **VENTAS** (`venta.html` + `app.js:renderSeccion('venta')`)
**Punto de venta completo con carrito y validación de stock en tiempo real**

#### Flujo Principal
1. **Selección de material** → Dropdown poblado desde inventario con stock visible
2. **Validación cantidad** → Preview dinámico (stock disponible, precio unitario, total)
3. **Carrito multi-producto** → Agregar/quitar items, cálculo automático neto/IVA/total
4. **Cliente** → Nombre libre (se auto-registra si es nuevo)
5. **Confirmación** → Panel lateral con resumen antes de enviar

#### Lógica de Stock Inteligente
| Escenario | Comportamiento |
|-----------|----------------|
| **Stock suficiente** | Agrega al carrito, descuenta al confirmar venta |
| **Stock = 0** | **Bloquea venta** → Abre panel "Sin Stock" → Botón **"Enviar a Reposición"** crea tarea `reposicion` urgente |
| **Stock parcial** | Permite vender lo disponible, resto va a reposición automática |

#### Generación de Entregas Automáticas
Al confirmar venta (`onRealizarVenta`):
- Crea registros en `ventas[]` (con neto, IVA, total, grupo `ventaGroupId`)
- **Crea tarea `entrega`** en `tareas[]` con:
  - `asignadoA: 'bodega'`
  - `items[]` con detalle completo
  - `ventaId` vinculado
  - `tipoRetiro`: `local` (inmediata) / `retiro` / `domicilio` (programada)
- Limpia carrito y formulario

---

### 3. 📦 **BODEGA** (`bodega.html` + `data.js:renderBodegaKanban()`)
**Kanban 3 columnas para gestión de entregas físicas**

#### Columnas (Estados de Tarea `entrega`)
| Columna | Estados | Acciones |
|---------|---------|----------|
| **Entrantes** | `pendiente`, `venta` | Asignar bodeguero (Carlos, Luis, Ana...), Cancelar |
| **En Proceso** | `asignada`, `en_proceso` | **Iniciar tarea** → Timer 10s → **Entregar pedido**, Cancelar |
| **Entregados** | `completada`, `cancelada` | Archivar |

#### Características Avanzadas
- **Priorización visual**: Tareas urgentes (retiro local) arriba, con borde rojo
- **Tags informativos**: Canal (Online/Local), Tipo entrega (Inmediata/Retiro/Domicilio), Vendedor, Fecha compra
- **Multi-items**: Soporta ventas con múltiples materiales (`tarea.items[]`)
- **Timer realista**: Simula tiempo de preparación/entrega con `setInterval`
- **Panel de Alertas Stock**: Recolecta alertas rojas (agotado) y naranjas (bajo) → Botón **"Enviar a Reposición"** masivo

#### Asignación de Trabajadores
- Lista dinámica desde `data.json → perfiles.bodegueros`
- Botones uno por trabajador → `appBodegaAsignarTrabajador(tareaId, nombre)`
- Guarda `trabajadorAsignado` y cambia estado a `asignada`

---

### 4. 🔄 **REPOSICIÓN** (`reposicion.html` + `data.js:renderReposicionKanban()`)
**Kanban 3 columnas para gestión completa de compras a proveedores**

#### Flujo de Compra Completo
```
ENTRANTES (pendiente/enviada)
    ↓ "Iniciar proceso de compra"
EN PROCESO (en_proceso)
    → Seleccionar proveedor → Auto-completa: stock proveedor, precio unitario
    → Ajustar cantidad → "Negociar compra" (timer 10s)
    → "Realizar compra" → Genera código C-XXXX, fecha, total con IVA
    ↓
COMPRADAS (comprada)
    → "Recepcionar compra" (timer 15s espera + 10s ingreso bodega)
    ↓
COMPLETADA → **Suma stock real al inventario** + Archiva
```

#### Columnas y Estados
| Columna | Estados | Descripción |
|---------|---------|-------------|
| **Entrantes** | `pendiente`, `enviada` | Tareas recibidas de Ventas/Bodega/Inventario. Prioridad: Urgente > Normal > Baja |
| **En Proceso** | `en_proceso` | Negociación con proveedor, selección, cálculo totales |
| **Completado** | `comprada`, `completada` | Recepción física, actualización stock, archivo |

#### Deduplicación Inteligente
- **Mismo SKU en entrantes** → Solo muestra la más urgente, elimina duplicados automáticamente
- **Fuente trazable**: `fuente` = `ventas` | `bodega` | `registros` (inventario manual)

#### Gestión de Proveedores (CRUD Completo)
- Modal para crear/editar: Nombre, Marcas, Contacto, Email, Teléfono, Notas
- 6 proveedores semilla (Distrimel, Maderas del Sur, Trupan, Easy, Sodimac, LP Chile)
- Asociación automática en negociación: `proveedorId`, `proveedorNombre`, `stockProveedor` (random 10-60), `valorUnidad` (random 5k-25k)

---

### 5. 📊 **INVENTARIO** (`inventario.html` + `app.js:onRenderInventario()`)
**Base de datos de materiales + Reportes financieros integrados**

#### Tabla Principal (Editable)
| Columna | Detalle |
|---------|---------|
| ID, SKU, Material, Marca, Color, Espesor | Datos base |
| Stock | Color: 🔴 Agotado (0) / 🟡 Bajo (≤3) / 🟢 OK |
| Precio Base | Costo unitario (sin IVA) |
| **Margen %** | **Editable in-line** → Recalcula precio venta en tiempo real |
| IVA Unitario | 19% automático |
| **Precio Venta Final** | `precio + margen% + IVA` (destacado en verde) |

#### Acciones
- **Agregar Material** → Modal con prompts secuenciales (tipo, marca, espesor, color, stock, precio) → Auto-genera SKU (`MEL-001`, `MDF-002`, etc.)
- **Botón Reposición** → Solo visible si stock ≤ mínimo → Crea tarea `reposicion` directa

#### Reportes Financieros (3 Paneles)
- **Resumen Ventas**: Total neto, IVA, total bruto
- **Resumen Compras**: Gasto total en reposiciones completadas
- **Resumen Reembolsos**: Ventas anuladas y montos devueltos
- **KPIs**: Ingresos, Egresos, Ganancia Neta, Margen %

---

### 6. 📈 **ESTADÍSTICAS** (`estadisticas.html` + `app.js:onRenderEstadisticas()`)
**Centro de control gerencial - 10 Pestañas (Tabs)**

| Tab | Contenido | Funcionalidad |
|-----|-----------|---------------|
| **Métricas** | Dinero disponible, Ingresos, Egresos, Margen ganancia/pérdida | KPIs en tarjetas coloridas |
| **Ventas** | Tabla completa con filtros visuales | Estado (completada/anulada), canal, vendedor |
| **Entregas** | Historial de tareas `entrega` completadas | Trabajador, fechas inicio/fin, tipo retiro |
| **Anulados** | Ventas canceladas con motivo y reembolso | Monto en rojo, motivo |
| **Reembolsos** | Vista financiera de devoluciones | Solo montos y fechas |
| **Empleados** | CRUD completo (Contratar/Editar/Despedir) | Modal, roles: Vendedor/Bodeguero/Admin |
| **Clientes** | CRUD completo + Saldo cuenta corriente | Modal, auto-registro desde ventas |
| **Archivos** | Entregas archivadas + Compras archivadas | 2 tablas lado a lado |
| **Inventario** | Precios editables con margen % en vivo | Input number → `estUpdateMargen()` |
| **Proveedores** | Historial de compras por proveedor | Conteos y totales gastados |

#### Gestión de Personal (Empleados)
- **Contratar**: Nombre, Rol (Vendedor/Bodeguero/Admin), Email, Teléfono → Genera password automático (`nombre123`)
- **Editar/Despedir**: Botones por fila
- **Persistencia**: En `data.json.perfiles.empleados` + `sessionStorage`

#### Gestión de Clientes
- Auto-creados al confirmar venta si no existen
- Campos: Nombre, RUT, Email, Teléfono, **Saldo** (cuenta corriente)
- Edición/Eliminación con modales

---

### 7. ⚙️ **OPCIONES** (`opciones.html`)
Configuración global del sistema:
- **Datos Tienda**: Nombre, Dirección, Email (se muestra en navbar)
- **Tema**: Claro / Oscuro (persiste en `sessionStorage`)
- **Resetear Datos**: Limpia `sessionStorage` → Recarga `data.json` original

---

## 🔐 Autenticación y Sesión

```javascript
// Credenciales por defecto (data.json)
Email: gerencia@construshop.cl
Password: 12345
Rol: Admin (Gerente)
```

- **Login**: Modal con prompt nativo (email + password)
- **Validación**: Contra `data.json.usuario`
- **Sesión**: `sessionStorage.fs_sesion` + variable `sesionActiva`
- **Navbar dinámico**: Muestra "Full.Stock | ConstruShop" + botón Logout cuando logueado
- **Protección rutas**: `navegar()` bloquea secciones si no hay sesión (excepto Inicio)

---

## 💾 Modelo de Datos (Entidades Principales)

### `inventario[]` - Materiales
```javascript
{
  id, sku, material, marca, espesor, color,
  stock, precio, margen  // precio = costo base, margen% editable
}
```
**Tipos**: Melamina, MDF, Terciado, Durolac, OSB, Triplay, Formica

### `ventas[]` - Ventas Confirmadas
```javascript
{
  id, fecha, cliente, materialId, sku, materialNombre,
  cantidad, precioUnitario, neto, iva, total,
  vendedor, canal: 'local'|'online',
  estado: 'completada'|'anulada',
  ventaGroupId,  // agrupa items de una misma venta
  fechaEntrega, tipoRetiro: 'local'|'retiro'|'domicilio'
}
```

### `tareas[]` - Motor Operativo (Clase `Tarea`)
```javascript
// Tipos: 'entrega' | 'reposicion'
{
  id, tipo, materialId, sku, materialNombre, cantidad,
  origen: 'venta'|'venta-fallida'|'stock-bajo'|'stock-agotado',
  notas, estado, fechaCreacion, fechaCompletada,
  asignadoA, trabajadorAsignado, fechaInicio, fechaFin,
  ventaId, proveedorId, proveedorNombre, stockProveedor,
  valorUnidad, cantidadCompra, totalCompra, codigoCompra,
  prioridad: 'urgente'|'normal'|'baja',
  items[], vendedor, canal, tipoRetiro, cliente, fuente, ...
}
```

**Estados Entrega**: `pendiente` → `asignada` → `en_proceso` → `completada`|`cancelada`|`archivada`  
**Estados Reposición**: `pendiente`|`enviada` → `en_proceso` → `comprada` → `completada`|`archivada`

### `proveedores[]`
```javascript
{ id, nombre, marcas, contacto, telefono, email, notas }
```

### `clientes[]`
```javascript
{ id, nombre, rut, email, telefono, saldo }
```

### `ventasAnuladas[]` - Auditoría
```javascript
{ id, ventaOriginalId, fecha, cliente, materialNombre, cantidad, montoReembolso, motivo, vendedor }
```

### `tiendaConfig`
```javascript
{ nombre, direccion, telefono, email, contacto, dineroInicial: 5000000 }
```

---

## ⚙️ Lógica de Negocio Clave

### 1. Cálculo Precio Venta (Tiempo Real)
```javascript
// En inventario y estadísticas
const iva = Math.round(precioBase * 0.19);
const precioVenta = precioBase + Math.round(precioBase * margen / 100) + iva;
```

### 2. Stock Mínimo Configurable
```javascript
const STOCK_MINIMO = 3;  // En data.js línea 6
// Alerta roja: stock === 0
// Alerta naranja: stock <= STOCK_MINIMO
```

### 3. Generación SKU Automática
```javascript
prefijos = { Melamina:'MEL', MDF:'MDF', Terciado:'TER', Durolac:'DUR', OSB:'OSB' }
sku = `${prefijo}-${String(id).padStart(3,'0')}`
```

### 4. Persistencia sessionStorage
```javascript
// Claves: fs_inventario, fs_ventas, fs_bodega, fs_tareas, 
//         fs_proveedores, fs_ventasAnuladas, fs_alertasStock, 
//         fs_clientes, fs_tienda, fs_sesion, fs_theme
```

### 5. Timer de Procesos (Simulación Realista)
- **Entrega bodega**: 10 segundos (preparación + entrega)
- **Negociación compra**: 10 segundos
- **Espera proveedor**: 15 segundos
- **Recepción bodega**: 10 segundos
- **UI reactiva**: `setInterval` + `render*()` cada segundo

---

## 🎨 UI/UX - Detalles de Diseño

### Temas (CSS Custom Properties)
```css
:root { --bg:#1a1a1a; --bg-card:#2a2a2a; --accent:#F4C522; ... }
[data-theme="light"] { --bg:#f5f5f5; --bg-card:#fff; --text:#1a1a1a; ... }
```

### Componentes Reutilizables
- **Kanban Cards**: Bordes coloreados por prioridad/estado, tags, líneas de info, botones de acción
- **Tablas**: Scroll horizontal, headers fijos visualmente, filas hover
- **Modales**: Overlay oscuro, centrado, formularios validados
- **Alertas Panel**: Slide lateral en Bodega para stock crítico
- **Tags/Badges**: Estados con colores semánticos (success, danger, warning, info, primary)

### Navegación SPA
- `fetch('sections/${nombre}.html')` + `innerHTML`
- `renderSeccion(nombre)` despacha a función específica
- Highlight activo en navbar (`classList.add('active')`)

---

## 🚀 Cómo Ejecutar

### Requisitos
- Servidor local HTTP (requerido por `fetch` de secciones y `data.json`)
- Navegador moderno (ES6+)

### Opción 1: VS Code Live Server (Recomendado)
1. Abrir carpeta `M4-entrega-ABP` en VS Code
2. Click derecho en `index.html` → **"Open with Live Server"**

### Opción 2: Python
```bash
cd M4-entrega-ABP
python -m http.server 8000
# Abrir http://localhost:8000
```

### Opción 3: Node.js (http-server)
```bash
npx http-server M4-entrega-ABP -p 8000
```

### Credenciales de Acceso
```
Email: gerencia@construshop.cl
Contraseña: 12345
```

---

## 📦 Flujo Completo de Simulación (User Journey)

### Escenario: "Gerente prueba su tienda"

1. **LOGIN** → Accede como Gerente (Admin)

2. **VENTAS** → Simula atención a cliente:
   - Selecciona "Melamina Blanco 18mm"
   - Ingresa cantidad 5, cliente "Constructora Nueva"
   - Ve preview: Stock 8, Precio $32.000, Total $160.000
   - Agrega al carrito → Ve totales (Neto/IVA/Total)
   - Confirma "Enviar" → **Crea venta y genera tarea de entrega en el panel de envío**

3. **BODEGA** → Gestiona la entrega:
   - Ve tarea en "Entrantes" con tag "Local" + "Inmediata"
   - Asigna a "Luis" (bodeguero) → Pasa a "En Proceso"
   - "Iniciar tarea" → Timer 10s → "Entregar pedido"
   - Tarea va a "Entregados" → Archivar

4. **REPOSICIÓN** → Compra materiales:
   - Si vendió stock bajo → Alerta en Bodega → "Enviar a Reposición"
   - En Reposición: Tarea en "Entrantes" prioridad Urgente
   - "Iniciar compra" → Selecciona "Distrimel SpA"
   - Auto-completa: Stock proveedor 45, Precio $18.000
   - "Negociar compra" (10s) → "Realizar compra" → Código C-0001
   - "Recepcionar compra" (25s total) → **Stock real aumenta en Inventario**

5. **INVENTARIO** → Verifica:
   - Stock actualizado
   - Ajusta margen % → Precio venta se recalcula en vivo
   - Agrega nuevo material si necesita

6. **ESTADÍSTICAS** → Revisa oficina:
   - **Métricas**: Dinero disponible, márgenes
   - **Ventas**: Lista completa con filtros visuales
   - **Entregas**: Tiempos por trabajador
   - **Empleados**: Contrata nuevo vendedor
   - **Clientes**: Ve saldos, edita datos
   - **Proveedores**: Historial de compras y totales

7. **OPCIONES** → Configura:
   - Cambia nombre tienda → Se ve en navbar
   - Modo oscuro/claro → Persiste
   - Reset datos → Vuelve a estado inicial

---

## 🔧 Extensibilidad y Puntos de Mejora

### Posibles Evoluciones
| Área | Propuesta |
|------|-----------|
| **Backend** | Migrar `sessionStorage` → API REST + BD (Node/Express, Python/FastAPI, PHP) |
| **Auth** | JWT, roles granulares (vendedor solo ve ventas, bodeguero solo bodega) |
| **Tiempo Real** | WebSockets para kanban colaborativo multi-usuario |
| **Reportes** | Exportar PDF/Excel, gráficos Chart.js en Estadísticas |
| **Notificaciones** | Push/email para alertas stock, tareas asignadas |
| **Mobile** | PWA + Service Worker para uso offline en bodega |
| **Testing** | Jest + Playwright para flujos críticos |

### Estructura Preparada para Escalar
- Separación clara: `app.js` (UI/Nav) | `data.js` (Modelo/Logic) | `sections/` (Vistas)
- Clase `Tarea` extensible con `reconstruirTarea()` para hidratación
- `guardarTodo()` centralizado → Fácil cambiar a API
- `data.json` como semilla → Migración directa a BD

---

## 📄 Licencia y Créditos

**Proyecto Académico - ABP Módulo 4**  
Desarrollo Full Stack JavaScript Trainee  
**Autor**: Fabian Ortiz Pena  
**Año**: 2026

---

## 📞 Contacto
- **GitHub**: [@fabianortizpena](https://github.com/fabianortizpena)
- **Email**: fabian.ortiz.pena@ejemplo.cl

---

> *"De una simple lista de reposición a un simulador completo de gestión comercial. El viaje del código refleja el crecimiento del negocio."*