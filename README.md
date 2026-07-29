# Full.Stock - Sistema de Gestión Integral para Ferreterías

> **Proyecto ABP - Módulo 4: Programación Avanzada en JavaScript**  
> **Desarrollado por: Fabian Ortiz Pena**  
> **Empresa simulada: ConstruShop Ferretería SpA**  
> **Fecha: Julio 2026**


---

## 📋 Descripción General

**Full.Stock** es una aplicación web SPA (*Single Page Application*) desarrollada en **JavaScript Vanilla (ES6+)**, HTML5 y CSS3, diseñada para simular la gestión comercial y operativa completa de una ferretería / tienda de materiales de construcción.

El sistema está diseñado desde la perspectiva de un **Gerente General** que ingresa a auditar y probar cada uno de los procesos de su tienda: desde la autenticación, la carga limpia de datos vía API, la realización de ventas en caja, la asignación de entregas en bodega, la reposición de inventario con proveedores, hasta el análisis de métricas financieras.

---

## 🎭 Flujo de Simulación: La Experiencia del Gerente (User Journey)

La aplicación funciona bajo un flujo de simulación completo que replica el ciclo de vida de un sistema en producción recién instalado:

### 1. 🚀 **Apertura de la Aplicación (Estado Recién Instalado)**
- Al abrir la aplicación en el navegador (por ejemplo, vía **VS Code Live Server**), la página carga en la vista pública de **Inicio**.
- **Sesión Cerrada por Defecto**: No existe ninguna sesión activa guardada. La barra de navegación muestra el botón de **Login**.
- **Estado 100% en Blanco**: El sistema arranca sin datos pre-cargados (0 productos en inventario, 0 ventas, 0 tareas en bodega, 0 proveedores).

### 2. 🔐 **Inicio de Sesión Obligatorio**
- El Gerente hace clic en **Login**.
- Se despliega el modal de autenticación con campos **completamente vacíos** y un placeholder genérico (`usuario@ejemplo.com`).
- El Gerente ingresa sus credenciales:
  - **Correo**: `gerencia@construshop.cl`
  - **Contraseña**: `12345`
- Tras iniciar sesión, la barra de navegación se activa y muestra el perfil del Gerente junto al botón de **Logout**. La aplicación continúa en blanco esperando la carga de datos.

### 3. 🌐 **Carga Inicial de Datos desde la API (Sección Opciones)**
- El Gerente se dirige a la sección **Opciones** y hace clic en **"Cargar todo desde API"**.
- El sistema realiza peticiones asincrónicas (`fetch`) para importar los datos base de la empresa, inventario de materiales, clientes, proveedores y ventas.
- **Carga Exclusiva de Tareas Online**: En la colección de tareas y panel de Bodega, **únicamente** se importan las tareas correspondientes a **entrega por compra online** (`tipo: 'entrega'`). No se generan tareas de reposición ni de otros orígenes en esta etapa inicial.

### 4. 🛒 **Prueba del Módulo de Ventas (Punto de Venta POS)**
- El Gerente va a la sección **Ventas** para realizar pruebas de comercialización:
  - Selecciona productos del inventario y define cantidades.
  - Comprueba la validación de stock físico en tiempo real (si no hay stock, el sistema bloquea la venta o sugiere enviar a reposición).
  - Agrega productos al carrito, ingresa el cliente y confirma la venta.
  - Al vender productos con retiro programado o despacho, el sistema genera automáticamente la tarea de **Entrega** en la Bodega.

### 5. 📦 **Prueba del Módulo de Bodega (Kanban de Despachos)**
- El Gerente accede a **Bodega** para gestionar las entregas físicas:
  - Observa las tareas en la columna **Entrantes** (incluyendo las de compra online cargadas desde la API).
  - Asigna bodegueros (Carlos, Luis, Ana, etc.) a cada tarea.
  - Presiona **"Iniciar tarea"** activando temporizadores realistas de preparación (10s).
  - Presiona **"Entregar pedido"** para finalizar la entrega y pasarla a la columna **Entregados**.

### 6. 🔄 **Prueba del Módulo de Reposición (Compras a Proveedores)**
- El Gerente entra a **Reposición** para reabastecer el inventario:
  - Gestiona solicitudes de compra recibidas por bajo stock.
  - Selecciona proveedores oficiales (Aceros Comerciales, Maderas Arauco, LP Chile, etc.).
  - Simula la negociación de precios y realiza la orden de compra.
  - Presiona **"Recepcionar compra"** (timer de espera y recepción) y verifica que el stock físico **aumenta automáticamente** en el inventario.

### 7. 📊 **Prueba del Módulo de Inventario y Métricas**
- El Gerente ingresa a **Inventario & Métricas**:
  - Revisa la tabla de productos, ajusta márgenes de ganancia in-line (recalculando el precio final de venta en tiempo real con 19% IVA).
  - Consulta los paneles de **Métricas Financieras** (Dinero disponible, ingresos brutos, egresos de compras, nómina de empleados, ventas por canal y balances).

### 8. 🧹 **Reset / Borrado Total del Sistema**
- Si el Gerente desea reiniciar todo el ciclo para realizar una nueva prueba desde cero, va a **Opciones** y hace clic en **"Resetear Datos (Limpiar Sistema)"**.
- El sistema elimina todos los datos de negocio (`localStorage` y `sessionStorage`), devolviendo la app a su estado en blanco.
- **Mantención de Sesión**: La sesión del Gerente permanece activa tras el reset para que pueda presionar **"Cargar todo desde API"** y repetir el recorrido de inmediato sin necesidad de volver a ingresar credenciales.

### 9. 🚪 **Cierre de Sesión (Logout)**
- Finalmente, el Gerente presiona **Logout**.
- La sesión se destruye completamente en `sessionStorage` y `localStorage`.
- Si se recarga la página o se vuelve a abrir con Live Server, la aplicación **permanece cerrada** exigiendo autenticación para ingresar.

---

## ✅ Cumplimiento de Requerimientos del Módulo #4 (Programación Avanzada en JS)

Esta aplicación cumple estrictamente con los 5 pilares de evaluación del Módulo 4:

### 1. Orientación a Objetos (POO) en JavaScript
- **Clase `Tarea`** (`fullstock/js/data.js`):
  - Modela las tareas del sistema con atributos como `id`, `tipo`, `materialNombre`, `cantidad`, `estado`, `fechaCreacion`, `fechaLimite`, `prioridad`, `items[]`, etc.
  - Métodos miembros: `cambiarEstado()`, `marcarCompletada()`, `obtenerTiempoRestante()`.
- **Clase `GestorTareas`** (`fullstock/js/data.js`):
  - Administra la colección global de tareas: `agregarTarea()`, `eliminarTarea()`, `obtenerTareaPorId()`, `filtrarPorEstado()`, `guardarEnAPI()`, `recuperarDeAPI()`, `guardarEnStorage()`, `cargarDeStorage()`.

### 2. Características ES6+
- **Variables**: Declaración estricta con `let` y `const`.
- **Template Literals**: Renderizado dinámico de componentes y modales mediante string interpolation (`` `... ${var} ...` ``).
- **Arrow Functions**: Utilizadas en manipuladores de eventos e iteradores de arreglos (`map`, `filter`, `forEach`, `find`, `sort`).
- **Destructuring**: Extracción limpia de propiedades en objetos y arreglos (`const { materialNombre, sku } = tarea`).
- **Spread Operator (`...`)**: Clonación y combinación inmutable de arreglos y objetos (`[...this.tareas]`, `{ ...datosJSON.tienda }`).

### 3. Eventos y Manipulación del DOM
- **Formularios**: Eventos `submit` con `e.preventDefault()` en modales de creación y edición.
- **Eventos `click`**: Navegación SPA, asignación de trabajadores, cambio de estados Kanban y login/logout.
- **Eventos `input` / `keyup`**: Búsqueda global en navbar y filtrado en tiempo real en tablas.
- **Eventos `mouseover` / `mouseout`**: Tooltips contextuales informativos en tarjetas Kanban.

### 4. JavaScript Asíncrono
- **Temporizadores Asíncronos (`setTimeout`)**: Retardo simulado en procesamiento de formulaciones y notificaciones SweetToast (2s).
- **Relojes Continuos (`setInterval`)**: Contador en tiempo real (1s) para verificar vencimientos de tareas Kanban (`⏳ HH:MM:SS` o `Expirada`).

### 5. Consumo de APIs y Persistencia
- **Fetch API con `async/await` y `try/catch`**:
  - GET a `https://jsonplaceholder.typicode.com/todos?_limit=5` en `gestorTareas.recuperarDeAPI()`.
  - POST a `https://jsonplaceholder.typicode.com/posts` en `gestorTareas.guardarEnAPI()`.
- **Web Storage API (`sessionStorage` vs `localStorage`)**:
  - `sessionStorage`: Manejo de autenticación activa (`fs_sesion`) para asegurar que al abrir en una nueva pestaña o Live Server la sesión esté cerrada.
  - `localStorage`: Persistencia de datos de negocio (`fs_inventario`, `fs_ventas`, `fs_tareas`, `fs_tienda`, `fs_app_cargada`).

---

## 🏗️ Arquitectura del Proyecto

```
M4-entrega-ABP/
├── index.html                 # Punto de entrada SPA
├── README.md                  # Documentación del proyecto
├── sections/                  # Vistas parciales HTML (Cargadas dinámicamente)
│   ├── inicio.html           # Vista principal / Landing
│   ├── venta.html            # Punto de venta (POS)
│   ├── bodega.html           # Kanban de entregas físicas
│   ├── reposicion.html       # Kanban de compras a proveedores
│   ├── inventario.html       # Inventario de materiales + Margen in-line
│   ├── estadisticas.html     # Centro de métricas y gestión de personal
│   └── opciones.html         # Configuración de tienda, Carga API y Reset
└── fullstock/
    ├── css/
    │   └── estilos.css       # Estilos CSS3 (Diseño Light Minimalista Bento Grid)
    ├── js/
    │   ├── app.js            # Enrutador SPA, Login, Controladores de vistas
    │   ├── data.js           # Estado global, Clases POO, Lógica de negocio, API y Storage
    │   └── swal.js           # Notificaciones y modales SweetAlert2
    └── data.json             # Datos semilla iniciales
```

---

## 🏪 Detalle de Módulos Funcionales

### 1. 🏠 **Inicio** (`inicio.html`)
Dashboard principal con información general del sistema, estado de conexión y acceso a los módulos.

### 2. 🛒 **Ventas** (`venta.html`)
- Selección de materiales con stock actualizado.
- Carrito de compras con cálculo automático de Neto, IVA (19%) y Total Bruto.
- Validación de stock en tiempo real.
- Generación automática de tarea de **Entrega** al confirmar la venta.

### 3. 📦 **Bodega** (`bodega.html`)
- Tablero Kanban en 3 columnas: **Entrantes**, **En Proceso** y **Entregados**.
- Importación de tareas de entrega por compra online desde la API.
- Asignación de bodegueros a pedidos.
- Temporizadores de preparación y botón de despacho físico.

### 4. 🔄 **Reposición** (`reposicion.html`)
- Tablero Kanban para gestión de compras de suministros.
- Selección de proveedores de la lista oficial.
- Simulación de negociación y orden de compra (Código C-XXXX).
- Recepción de mercadería con incremento automático del stock físico en inventario.

### 5. 📊 **Inventario** (`inventario.html`)
- Tabla de materiales con indicadores visuales de stock: 🔴 Agotado (0), 🟡 Bajo (≤3), 🟢 Normal (>3).
- **Edición In-line de Margen %**: Permite modificar el porcentaje de ganancia recalculando el precio final en vivo.
- Creación de nuevos productos.

### 6. 📈 **Métricas y Estadísticas** (`estadisticas.html`)
- **Métricas**: Balance de caja, ingresos, egresos y utilidad neta.
- **Historiales**: Tablas detalladas de ventas, entregas completadas y compras.
- **Gestión de Personal**: Contratación y administración de empleados (Vendedores, Bodegueros, Admin).
- **Clientes**: Registro de clientes y estados de saldo.

### 7. ⚙️ **Opciones** (`opciones.html`)
- Configuración de datos comerciales de la empresa.
- **Cargar todo desde API**: Sincronización asincrónica inicial de datos.
- **Resetear Datos (Limpiar Sistema)**: Borrado completo de datos de negocio dejando la app a cero sin cerrar la sesión del Gerente.

---

## 🚀 Instrucciones de Ejecución

### Requisitos Previos
- Servidor web local HTTP (requerido por `fetch()` para cargar componentes y `data.json`).
- Navegador web moderno (Chrome, Edge, Firefox, Safari).

### Ejecución recomendada (VS Code Live Server)
1. Abrir la carpeta raíz `M4-entrega-ABP` en **VS Code**.
2. Hacer clic derecho sobre `index.html` y seleccionar **"Open with Live Server"**.
3. La aplicación se abrirá en `http://127.0.0.1:5500/index.html`.

### Credenciales de Acceso (Gerente)
```
Correo Electrónico: gerencia@construshop.cl
Contraseña:        12345
```

---

## 📄 Licencia y Créditos

**Proyecto Académico - ABP Módulo 4**  
Desarrollo Full Stack JavaScript Trainee  
**Autor**: Fabian Ortiz Pena  
**Año**: 2026

> **https://elseniorlenny.github.io/M4-entrega-ABP/**
