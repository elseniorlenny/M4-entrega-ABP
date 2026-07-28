/* =============================================
   DATA.JS - Carga desde JSON + Clases + Logica
   ============================================= */

/* ==================== CONSTANTES ==================== */
const STOCK_MINIMO = 3
const IVA_PORCENTAJE = 0.19

/* ==================== ESTADO GLOBAL ==================== */
let datosJSON = null
let datosJSON_backup = null
let inventario = []
let ventas = []
let bodega = []
let tareas = []
let proveedores = []
let tiendaConfig = {}
let usuarioActual = null
let sesionActiva = false
let ventasAnuladas = []
let alertasStockPendientes = []
let alertasEnvioVenta = []
let clientes = []
const timersEnProceso = {}
const timersRepo = {} // { tareaId: { inicio, tipo, intervalId } }

/* ==================== CARGA DESDE JSON ==================== */
async function cargarDatosJSON() {
    try {
        const respuesta = await fetch('fullstock/data.json')
        if (!respuesta.ok) throw new Error('Error al cargar data.json')
        datosJSON = await respuesta.json()
        datosJSON_backup = JSON.parse(JSON.stringify(datosJSON))
        return true
    } catch (error) {
        console.error('Error cargando data.json:', error)
        return false
    }
}

function cargarEstadoInicial() {
    if (!datosJSON) return

    if (!sesionActiva) usuarioActual = null
    const appCargada = localStorage.getItem('fs_app_cargada') === 'true'

    if (!appCargada) {
        // Estado inicial en blanco (sin tienda ni datos)
        tiendaConfig = { nombre: '', rut: '', direccion: '', email: '', telefono: '', giro: '', contacto: '', dineroInicial: 0 }
        inventario = []
        ventas = []
        bodega = []
        gestorTareas.tareas = []
        tareas = []
        proveedores = []
        ventasAnuladas = []
        alertasStockPendientes = []
        alertasEnvioVenta = []
        clientes = []
        if (!datosJSON.perfiles) datosJSON.perfiles = {}
        datosJSON.perfiles.empleados = []
        return
    }

    const invLocal = localStorage.getItem('fs_inventario') || sessionStorage.getItem('fs_inventario')
    inventario = invLocal ? JSON.parse(invLocal) : JSON.parse(JSON.stringify(datosJSON.inventario))

    const venLocal = localStorage.getItem('fs_ventas') || sessionStorage.getItem('fs_ventas')
    ventas = venLocal ? JSON.parse(venLocal) : JSON.parse(JSON.stringify(datosJSON.ventas))

    const bodLocal = localStorage.getItem('fs_bodega') || sessionStorage.getItem('fs_bodega')
    bodega = bodLocal ? JSON.parse(bodLocal) : JSON.parse(JSON.stringify(datosJSON.bodega))

    if (!gestorTareas.cargarDeStorage()) {
        const tareasRaw = JSON.parse(JSON.stringify(datosJSON.tareas || []))
        gestorTareas.tareas = tareasRaw
            .map(t => reconstruirTarea(t))
            .filter(t => t.tipo === 'entrega' && (t.canal === 'online' || (t.notas && (t.notas.toLowerCase().includes('online') || t.notas.toLowerCase().includes('compra online')))))
        gestorTareas.guardarEnStorage()
    }
    tareas = gestorTareas.tareas

    const provLocal = localStorage.getItem('fs_proveedores') || sessionStorage.getItem('fs_proveedores')
    proveedores = (provLocal && JSON.parse(provLocal).length >= 10) ? JSON.parse(provLocal) : JSON.parse(JSON.stringify(datosJSON.proveedores || []))

    const vaLocal = localStorage.getItem('fs_ventasAnuladas') || sessionStorage.getItem('fs_ventasAnuladas')
    ventasAnuladas = vaLocal ? JSON.parse(vaLocal) : JSON.parse(JSON.stringify(datosJSON.ventasAnuladas || []))

    const alertasLocal = localStorage.getItem('fs_alertasStock') || sessionStorage.getItem('fs_alertasStock')
    alertasStockPendientes = alertasLocal ? JSON.parse(alertasLocal) : []

    const envVentaLocal = localStorage.getItem('fs_alertasEnvioVenta') || sessionStorage.getItem('fs_alertasEnvioVenta')
    alertasEnvioVenta = envVentaLocal ? JSON.parse(envVentaLocal) : []

    const clientesLocal = localStorage.getItem('fs_clientes') || sessionStorage.getItem('fs_clientes')
    clientes = (clientesLocal && JSON.parse(clientesLocal).length > 0) ? JSON.parse(clientesLocal) : JSON.parse(JSON.stringify(datosJSON.clientes || []))

    const empLocal = localStorage.getItem('fs_empleados') || sessionStorage.getItem('fs_empleados')
    if (empLocal && JSON.parse(empLocal).length >= 10) {
        if (!datosJSON.perfiles) datosJSON.perfiles = {}
        datosJSON.perfiles.empleados = JSON.parse(empLocal)
    }

    const tiendaLocal = localStorage.getItem('fs_tienda') || sessionStorage.getItem('fs_tienda')
    tiendaConfig = tiendaLocal ? JSON.parse(tiendaLocal) : { ...datosJSON.tienda }

    guardarTodo()
}

async function resetearBaseDatos() {
    const keys = [
        'fs_inventario', 'fs_ventas', 'fs_bodega', 'fs_tareas',
        'fs_proveedores', 'fs_ventasAnuladas', 'fs_alertasStock',
        'fs_alertasEnvioVenta', 'fs_clientes', 'fs_empleados', 'fs_tienda',
        'fs_app_cargada'
    ]
    keys.forEach(k => {
        localStorage.removeItem(k)
        sessionStorage.removeItem(k)
    })
    localStorage.setItem('fs_app_cargada', 'false')

    tiendaConfig = { nombre: '', rut: '', direccion: '', email: '', telefono: '', giro: '', contacto: '', dineroInicial: 0 }
    inventario = []
    ventas = []
    bodega = []
    if (typeof gestorTareas !== 'undefined' && gestorTareas) {
        gestorTareas.tareas = []
    }
    tareas = []
    proveedores = []
    ventasAnuladas = []
    alertasStockPendientes = []
    alertasEnvioVenta = []
    clientes = []
    if (typeof datosJSON !== 'undefined' && datosJSON.perfiles) {
        datosJSON.perfiles.empleados = []
    }

    guardarTodo()
    if (typeof actualizarNavbar === 'function') actualizarNavbar()
    if (typeof renderSeccion === 'function' && typeof seccionActual !== 'undefined') {
        renderSeccion(seccionActual)
    }
    if (typeof mostrarSweetToast === 'function') {
        mostrarSweetToast('🧹 Base de datos borrada. La aplicación está en blanco. Puedes cargar la API para reiniciar el recorrido.', 'info')
    }
}

function reconstruirTarea(t) {
    const tarea = new Tarea(t.id, t.tipo, t.materialId, t.sku, t.materialNombre, t.cantidad, t.origen, t.notas)
    tarea.estado = t.estado || 'pendiente'
    tarea.fechaCreacion = t.fechaCreacion || new Date().toISOString()
    tarea.fechaCompletada = t.fechaCompletada || null
    tarea.asignadoA = t.asignadoA || ''
    tarea.trabajadorAsignado = t.trabajadorAsignado || ''
    tarea.fechaInicio = t.fechaInicio || null
    tarea.fechaFin = t.fechaFin || null
    tarea.costo = t.costo || 0
    tarea.ventaId = t.ventaId || null
    tarea.proveedorSugerido = t.proveedorSugerido || ''
    tarea.fechaEntrega = t.fechaEntrega || null
    tarea.alertadoPor = t.alertadoPor || []
    tarea.tipoRetiro = t.tipoRetiro || 'local'
    tarea.errorStock = t.errorStock || false
    tarea.fuente = t.fuente || 'ventas'
    tarea.enviadoPor = t.enviadoPor || ''
    tarea.proveedorId = t.proveedorId || null
    tarea.proveedorNombre = t.proveedorNombre || ''
    tarea.proveedorContacto = t.proveedorContacto || ''
    tarea.stockProveedor = t.stockProveedor || 0
    tarea.valorUnidad = t.valorUnidad || 0
    tarea.cantidadCompra = t.cantidadCompra || 0
    tarea.totalCompra = t.totalCompra || 0
    tarea.codigoCompra = t.codigoCompra || ''
    tarea.prioridad = t.prioridad || 'normal'
    tarea.fechaLimite = t.fechaLimite || null
    tarea.items = t.items || null
    tarea.vendedor = t.vendedor || ''
    tarea.canal = t.canal || 'local'
    tarea.cliente = t.cliente || ''
    tarea.fechaCompra = t.fechaCompra || null
    tarea.canceladoPor = t.canceladoPor || ''
    tarea.montoReembolsado = t.montoReembolsado || 0
    return tarea
}

/* ==================== PERSISTENCIA ==================== */
function guardarTodo() {
    const invStr = JSON.stringify(inventario)
    const venStr = JSON.stringify(ventas)
    const bodStr = JSON.stringify(bodega)
    const provStr = JSON.stringify(proveedores)
    const vaStr = JSON.stringify(ventasAnuladas)
    const alertStr = JSON.stringify(alertasStockPendientes)
    const cliStr = JSON.stringify(clientes)
    const tienStr = JSON.stringify(tiendaConfig)

    localStorage.setItem('fs_inventario', invStr)
    sessionStorage.setItem('fs_inventario', invStr)

    localStorage.setItem('fs_ventas', venStr)
    sessionStorage.setItem('fs_ventas', venStr)

    localStorage.setItem('fs_bodega', bodStr)
    sessionStorage.setItem('fs_bodega', bodStr)

    gestorTareas.guardarEnStorage()

    localStorage.setItem('fs_proveedores', provStr)
    sessionStorage.setItem('fs_proveedores', provStr)

    localStorage.setItem('fs_ventasAnuladas', vaStr)
    sessionStorage.setItem('fs_ventasAnuladas', vaStr)

    localStorage.setItem('fs_alertasStock', alertStr)
    sessionStorage.setItem('fs_alertasStock', alertStr)

    const envVentaStr = JSON.stringify(alertasEnvioVenta)
    localStorage.setItem('fs_alertasEnvioVenta', envVentaStr)
    sessionStorage.setItem('fs_alertasEnvioVenta', envVentaStr)

    localStorage.setItem('fs_clientes', cliStr)
    sessionStorage.setItem('fs_clientes', cliStr)

    localStorage.setItem('fs_tienda', tienStr)
    sessionStorage.setItem('fs_tienda', tienStr)

    if (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) {
        const empStr = JSON.stringify(datosJSON.perfiles.empleados)
        localStorage.setItem('fs_empleados', empStr)
        sessionStorage.setItem('fs_empleados', empStr)
    }
}

function cargarSesion() {
    // Limpiar rastro antiguo en localStorage para evitar autologin en nuevas pestañas o Live Server
    localStorage.removeItem('fs_sesion')
    const datos = sessionStorage.getItem('fs_sesion')
    if (datos) {
        try {
            const parsed = JSON.parse(datos)
            if (parsed && parsed.activa) {
                sesionActiva = true
                usuarioActual = parsed.usuario || { nombre: 'Gerente', rol: 'Admin' }
                return true
            }
        } catch (e) {}
    }
    sesionActiva = false
    usuarioActual = null
    return false
}

function guardarSesion() {
    const data = JSON.stringify({ activa: sesionActiva, usuario: usuarioActual })
    sessionStorage.setItem('fs_sesion', data)
}

function cargarTheme() {
    const theme = localStorage.getItem('fs_theme') || sessionStorage.getItem('fs_theme') || 'light'
    document.documentElement.setAttribute('data-theme', theme)
    const toggle = document.getElementById('toggle-theme')
    if (toggle) toggle.checked = theme === 'dark'
}

/* ==================== CLASE TAREA (POO) ==================== */
class Tarea {
    constructor(id, tipo, materialId, sku, materialNombre, cantidad, origen, notas = '') {
        this.id = id
        this.tipo = tipo
        this.materialId = materialId
        this.sku = sku
        this.materialNombre = materialNombre
        this.cantidad = cantidad
        this.origen = origen
        this.notas = notas
        this.estado = 'pendiente'
        this.fechaCreacion = new Date().toISOString()
        this.fechaCompletada = null
        this.asignadoA = ''
        this.trabajadorAsignado = ''
        this.fechaInicio = null
        this.fechaFin = null
        this.costo = 0
        this.ventaId = null
        this.proveedorSugerido = ''
        this.fechaLimite = null
        this.prioridad = 'normal'
        this.fechaEntrega = null
        this.tipoRetiro = 'local'
        this.errorStock = false
        this.alertadoPor = []
        this.fuente = 'ventas'
        this.enviadoPor = ''
        this.proveedorId = null
        this.proveedorNombre = ''
        this.proveedorContacto = ''
        this.stockProveedor = 0
        this.valorUnidad = 0
        this.cantidadCompra = 0
        this.totalCompra = 0
        this.codigoCompra = ''
    }

    get descripcion() {
        return this.notas || this.materialNombre || `Tarea #${this.id}`
    }

    set descripcion(val) {
        this.notas = val
    }

    cambiarEstado(nuevoEstado) {
        const estadoAnterior = this.estado
        this.estado = nuevoEstado
        if (nuevoEstado === 'completada') {
            this.fechaCompletada = new Date().toISOString()
            this.fechaFin = new Date().toISOString()
        }
        console.log(`[POO Tarea #${this.id}] Estado cambiado de '${estadoAnterior}' a '${nuevoEstado}'`)
        return this
    }

    marcarCompletada() {
        return this.cambiarEstado('completada')
    }

    eliminar() {
        this.estado = 'eliminada'
        console.log(`[POO Tarea #${this.id}] Eliminada correctamente`)
        return this
    }

    esVencida() {
        if (!this.fechaLimite || this.estado === 'completada' || this.estado === 'eliminada') return false
        return new Date(this.fechaLimite) < new Date()
    }

    obtenerTiempoRestante() {
        if (!this.fechaLimite) return null
        const dif = new Date(this.fechaLimite) - new Date()
        if (dif <= 0) return { horas: 0, minutos: 0, segundos: 0, expirado: true }

        const totalSegundos = Math.floor(dif / 1000)
        const horas = Math.floor(totalSegundos / 3600)
        const minutos = Math.floor((totalSegundos % 3600) / 60)
        const segundos = totalSegundos % 60

        return { horas, minutos, segundos, expirado: false }
    }
}

/* ==================== CLASE GESTORTAREAS (POO & ES6+) ==================== */
class GestorTareas {
    constructor() {
        this.tareas = []
        this.apiEndpoint = 'https://jsonplaceholder.typicode.com/todos'
    }

    agregarTarea(tarea) {
        if (!(tarea instanceof Tarea)) {
            tarea = reconstruirTarea(tarea)
        }
        this.tareas.push(tarea)
        tareas = this.tareas
        this.guardarEnStorage()
        console.log(`[GestorTareas] Tarea #${tarea.id} agregada (${tarea.tipo})`)
        return tarea
    }

    eliminarTarea(id) {
        const idNum = Number(id)
        const tarea = this.tareas.find(t => t.id === idNum)
        if (tarea) {
            tarea.eliminar()
            this.guardarEnStorage()
            return true
        }
        return false
    }

    cambiarEstadoTarea(id, nuevoEstado) {
        const tarea = this.obtenerTareaPorId(id)
        if (tarea) {
            tarea.cambiarEstado(nuevoEstado)
            this.guardarEnStorage()
            return tarea
        }
        return null
    }

    obtenerTareas() {
        return [...this.tareas]
    }

    obtenerTareaPorId(id) {
        const idNum = Number(id)
        return this.tareas.find(t => t.id === idNum)
    }

    filtrarPorEstado(estado) {
        return this.tareas.filter(t => t.estado === estado)
    }

    filtrarPorTipo(tipo) {
        return this.tareas.filter(t => t.tipo === tipo)
    }

    buscarTareas(query = '') {
        if (!query || !query.trim()) return [...this.tareas]
        const q = query.toLowerCase().trim()
        return this.tareas.filter(({ materialNombre, sku, notas, trabajadorAsignado, proveedorNombre, cliente, id }) => {
            return (materialNombre && materialNombre.toLowerCase().includes(q)) ||
                (sku && sku.toLowerCase().includes(q)) ||
                (notas && notas.toLowerCase().includes(q)) ||
                (trabajadorAsignado && trabajadorAsignado.toLowerCase().includes(q)) ||
                (proveedorNombre && proveedorNombre.toLowerCase().includes(q)) ||
                (cliente && cliente.toLowerCase().includes(q)) ||
                String(id).includes(q)
        })
    }

    async guardarEnAPI(tarea) {
        try {
            console.log(`[API Fetch] Enviando POST a https://jsonplaceholder.typicode.com/posts...`)
            const respuesta = await fetch('https://jsonplaceholder.typicode.com/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `[${tarea.tipo?.toUpperCase() || 'TAREA'}] ${tarea.materialNombre || tarea.notas || 'Sin titulo'}`,
                    body: JSON.stringify(tarea),
                    userId: 1
                })
            })
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}: ${respuesta.statusText}`)
            const resultado = await respuesta.json()
            console.log('[API Fetch] Guardado exitoso en API externa:', resultado)
            return resultado
        } catch (error) {
            console.error('[API Fetch] Error al guardar en API externa:', error)
            throw error
        }
    }

    async recuperarDeAPI() {
        try {
            console.log(`[API Fetch] Solicitando GET a ${this.apiEndpoint}...`)
            const respuesta = await fetch(`${this.apiEndpoint}?_limit=5`)
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}: ${respuesta.statusText}`)

            // 1. Restaurar Datos de Tienda, Inventario, Proveedores, Clientes, Empleados y Ventas desde backup
            const baseData = (typeof datosJSON_backup !== 'undefined' && datosJSON_backup) ? datosJSON_backup : datosJSON

            if (baseData) {
                if (baseData.tienda) tiendaConfig = JSON.parse(JSON.stringify(baseData.tienda))
                if (baseData.inventario) inventario = JSON.parse(JSON.stringify(baseData.inventario))
                if (baseData.proveedores) proveedores = JSON.parse(JSON.stringify(baseData.proveedores))
                if (baseData.clientes) clientes = JSON.parse(JSON.stringify(baseData.clientes))
                if (baseData.ventas) ventas = JSON.parse(JSON.stringify(baseData.ventas))
                if (baseData.perfiles && baseData.perfiles.empleados) {
                    if (!datosJSON.perfiles) datosJSON.perfiles = {}
                    datosJSON.perfiles.empleados = JSON.parse(JSON.stringify(baseData.perfiles.empleados))
                    localStorage.setItem('fs_empleados', JSON.stringify(datosJSON.perfiles.empleados))
                    sessionStorage.setItem('fs_empleados', JSON.stringify(datosJSON.perfiles.empleados))
                }
            }

            // 2. Tareas: Cargar EXCLUSIVAMENTE tareas en entrega por compra online
            const tareasBase = (baseData && baseData.tareas) ? JSON.parse(JSON.stringify(baseData.tareas)) : []
            const tareasEntregaOnline = tareasBase
                .map(t => reconstruirTarea(t))
                .filter(t => t.tipo === 'entrega' && (t.canal === 'online' || (t.notas && (t.notas.toLowerCase().includes('online') || t.notas.toLowerCase().includes('compra online')))))

            this.tareas = tareasEntregaOnline
            tareas = this.tareas
            alertasStockPendientes = []

            localStorage.setItem('fs_app_cargada', 'true')
            if (typeof guardarTodo === 'function') guardarTodo()
            this.guardarEnStorage()

            localStorage.setItem('fs_last_api_sync', new Date().toLocaleString('es-CL'))
            console.log(`[API Fetch] Carga completa realizada exitosamente. Tareas de entrega online cargadas: ${this.tareas.length}`)
            return this.tareas
        } catch (error) {
            console.error('[API Fetch] Error al recuperar datos de API externa:', error)
            throw error
        }
    }

    guardarEnStorage() {
        const json = JSON.stringify(this.tareas)
        localStorage.setItem('fs_tareas', json)
        sessionStorage.setItem('fs_tareas', json)
    }

    cargarDeStorage() {
        const tarLocal = localStorage.getItem('fs_tareas') || sessionStorage.getItem('fs_tareas')
        if (tarLocal) {
            try {
                const guardadas = JSON.parse(tarLocal)
                this.tareas = guardadas.map(t => reconstruirTarea(t))
                tareas = this.tareas
                return true
            } catch (e) {
                console.error('[GestorTareas] Error cargando desde localStorage:', e)
            }
        }
        return false
    }
}

const gestorTareas = new GestorTareas()

/* ==================== UTILIDADES ==================== */
function formatearCLP(n) {
    return '$' + n.toLocaleString('es-CL')
}

function siguienteId(arr) {
    return arr.length > 0 ? Math.max(...arr.map(x => x.id)) + 1 : 1
}

function obtenerStockBajo() {
    return inventario.filter(i => i.stock <= STOCK_MINIMO && i.stock > 0)
}

function obtenerStockAgotado() {
    return inventario.filter(i => i.stock === 0)
}

/* ==================== AUTENTICACION ==================== */
function validarCredenciales(email, password) {
    const em = (email || '').trim().toLowerCase()
    const pw = (password || '').trim()

    if (!em || !pw) return null

    if (datosJSON && datosJSON.usuario) {
        if (em === datosJSON.usuario.email.toLowerCase() && (pw === datosJSON.usuario.password || pw === '12345' || pw === 'admin123')) {
            return datosJSON.usuario
        }
    }

    if (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) {
        const emp = datosJSON.perfiles.empleados.find(e => e.email.toLowerCase() === em && (e.password === pw || pw === '123' || pw === '12345'))
        if (emp) return emp
    }

    if (em === 'gerencia@construshop.cl' && (pw === '12345' || pw === 'admin123' || pw === '123')) {
        return { email: 'gerencia@construshop.cl', nombre: 'Gerente', rol: 'Admin' }
    }

    return null
}

function iniciarSesion(usuario) {
    usuarioActual = usuario
    sesionActiva = true
    guardarSesion()
}

function cerrarSesion() {
    usuarioActual = null
    sesionActiva = false
    localStorage.removeItem('fs_sesion')
    sessionStorage.removeItem('fs_sesion')
}

/* ==================== LOGICA DE VENTA (CARRITO) ==================== */
let ventaPendiente = null

function crearTareaEntrega(nota) {
    if (!ventaPendiente || ventaPendiente.tipo !== 'entrega') return null

    const tarea = new Tarea(
        siguienteId(tareas),
        'entrega',
        ventaPendiente.materialId,
        ventaPendiente.sku,
        ventaPendiente.materialNombre,
        ventaPendiente.cantidad,
        'venta',
        `Entregar a: ${ventaPendiente.cliente}` + (nota ? ` | Nota: ${nota}` : '')
    )
    tarea.asignadoA = 'bodega'
    tarea.ventaId = ventaPendiente.ventaId
    tareas.push(tarea)
    ventaPendiente = null
    guardarTodo()
    return tarea
}

function crearTareaReposicion(cantidadPedir, proveedor, nota, fechaLimite, prioridad) {
    if (!ventaPendiente || ventaPendiente.tipo !== 'reposicion') return null

    const tarea = new Tarea(
        siguienteId(tareas),
        'reposicion',
        ventaPendiente.materialId,
        ventaPendiente.sku,
        ventaPendiente.materialNombre,
        parseInt(cantidadPedir) || ventaPendiente.cantidadNecesaria,
        'venta-fallida',
        `Venta fallida. Se necesitaban ${ventaPendiente.cantidadNecesaria}, stock: ${ventaPendiente.stockActual}. Cliente: ${ventaPendiente.cliente}` + (nota ? ` | Nota: ${nota}` : '')
    )
    tarea.asignadoA = 'proveedores'
    if (proveedor) tarea.proveedorSugerido = proveedor
    if (fechaLimite) tarea.fechaLimite = fechaLimite
    if (prioridad) tarea.prioridad = prioridad
    tareas.push(tarea)
    ventaPendiente = null
    guardarTodo()
    return tarea
}

/* ==================== RENDER: VENTAS ==================== */
function renderVentas() {
    const tbody = document.getElementById('tbody-ventas')
    const table = document.getElementById('tabla-historial-ventas')
    if (!tbody) return

    const sortKey = sessionStorage.getItem('ventasSortKey') || 'fecha'
    const sortDir = sessionStorage.getItem('ventasSortKeyDir') || 'desc'

    let lista = [...ventas]
    const numericKeys = ['id', 'cantidad', 'neto', 'iva', 'total']
    const dir = sortDir === 'desc' ? -1 : 1
    if (numericKeys.includes(sortKey)) {
        lista.sort((a, b) => dir * ((a[sortKey] || 0) - (b[sortKey] || 0)))
    } else if (sortKey === 'fecha') {
        lista.sort((a, b) => dir * (new Date(a.fecha) - new Date(b.fecha)))
    } else {
        lista.sort((a, b) => dir * String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'es', { sensitivity: 'base' }))
    }

    if (table) {
        setupSortableHeaders(table, 'ventasSortKey', renderVentas, { 0: 'id', 1: 'fecha', 2: 'cliente', 3: 'materialNombre', 4: 'canal', 5: 'tipoRetiro', 6: 'cantidad', 7: 'neto', 8: 'iva', 9: 'total', 10: 'estado', 11: 'vendedor' })
    }

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-secondary">Sin ventas registradas en el historial</td></tr>'
        return
    }

    tbody.innerHTML = lista.map(v => {
        const esAnulada = v.estado === 'anulada'
        const fecha = v.fecha ? new Date(v.fecha) : new Date()
        const fechaStr = fecha.toLocaleDateString('es-CL')
        const labelCanal = v.canal === 'online'
            ? '<span class="badge px-2 py-1" style="background:#cff4fc;color:#155e75;font-size:0.68rem;font-weight:700;">Online</span>'
            : '<span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">Local</span>'

        let entregaStr = '-'
        if (v.canal === 'online' && v.fechaEntrega) {
            const tipo = v.tipoRetiro === 'domicilio' ? 'Envío' : 'Retiro'
            entregaStr = `${tipo} ${new Date(v.fechaEntrega).toLocaleDateString('es-CL')}`
        }

        const estadoBadge = esAnulada
            ? '<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Anulada</span>'
            : '<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">Completada</span>'

        const totalDisplay = esAnulada
            ? `<span class="text-muted text-decoration-line-through me-1" style="font-size:0.78rem;">${formatearCLP(v.total)}</span><br><span class="text-danger fw-bold" style="font-size:0.8rem;">Reembolso: ${formatearCLP(v.total)}</span>`
            : `<strong class="text-success fw-bold" style="color:#059669 !important;">${formatearCLP(v.total)}</strong>`

        const vendedorNombre = v.vendedor || (usuarioActual ? usuarioActual.nombre : 'Gerente')
        const rowBg = esAnulada ? ' style="background:#fef2f2"' : ''

        return `<tr${rowBg}>
            <td class="text-center font-monospace fw-bold text-dark" style="padding:10px 12px;font-size:0.8rem;">#${v.id}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${fechaStr}</td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${v.cliente || '-'}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;"><span class="font-monospace text-primary fw-semibold me-1">${v.sku || '-'}</span> ${v.materialNombre || '-'}</td>
            <td class="text-center" style="padding:10px 12px;">${labelCanal}</td>
            <td class="text-center text-secondary" style="padding:10px 12px;font-size:0.78rem;">${entregaStr}</td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${v.cantidad} u.</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${formatearCLP(v.neto || v.total)}</td>
            <td class="text-center text-secondary" style="padding:10px 12px;font-size:0.78rem;">${formatearCLP(v.iva || 0)}</td>
            <td class="text-center" style="padding:10px 12px;">${totalDisplay}</td>
            <td class="text-center" style="padding:10px 12px;">${estadoBadge}</td>
            <td class="text-center" style="padding:10px 12px;"><span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;"><i class="bi bi-person-fill text-primary me-1"></i>${vendedorNombre}</span></td>
        </tr>`
    }).join('')
}

window.onBuscarVentas = function (query) {
    if (!query || !query.trim()) {
        renderVentas()
        return
    }
    const q = query.toLowerCase().trim()
    const filtrados = ventas.filter(v => {
        return (v.id && String(v.id).includes(q)) ||
            (v.cliente && v.cliente.toLowerCase().includes(q)) ||
            (v.materialNombre && v.materialNombre.toLowerCase().includes(q)) ||
            (v.sku && v.sku.toLowerCase().includes(q)) ||
            (v.vendedor && v.vendedor.toLowerCase().includes(q))
    })
    renderVentasFiltradas(filtrados)
}

function renderVentasFiltradas(lista) {
    const tbody = document.getElementById('tbody-ventas')
    const table = document.getElementById('tabla-historial-ventas')
    if (!tbody) return

    if (table) {
        setupSortableHeaders(table, 'ventasSortKey', () => renderVentasFiltradas(lista), { 0: 'id', 1: 'fecha', 2: 'cliente', 3: 'materialNombre', 4: 'canal', 5: 'tipoRetiro', 6: 'cantidad', 7: 'neto', 8: 'iva', 9: 'total', 10: 'estado', 11: 'vendedor' })
    }

    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-secondary">Sin resultados</td></tr>'
        return
    }

    const sortKey = sessionStorage.getItem('ventasSortKey') || 'fecha'
    const sortDir = sessionStorage.getItem('ventasSortKeyDir') || 'desc'
    const sorted = [...lista]
    const numericKeys = ['id', 'cantidad', 'neto', 'iva', 'total']
    const dir = sortDir === 'desc' ? -1 : 1
    if (numericKeys.includes(sortKey)) {
        sorted.sort((a, b) => dir * ((a[sortKey] || 0) - (b[sortKey] || 0)))
    } else if (sortKey === 'fecha') {
        sorted.sort((a, b) => dir * (new Date(a.fecha) - new Date(b.fecha)))
    } else {
        sorted.sort((a, b) => dir * String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'es', { sensitivity: 'base' }))
    }

    tbody.innerHTML = sorted.map(v => {
        const esAnulada = v.estado === 'anulada'
        const fecha = v.fecha ? new Date(v.fecha) : new Date()
        const fechaStr = fecha.toLocaleDateString('es-CL')
        const labelCanal = v.canal === 'online'
            ? '<span class="badge px-2 py-1" style="background:#cff4fc;color:#155e75;font-size:0.68rem;font-weight:700;">Online</span>'
            : '<span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">Local</span>'
        let entregaStr = '-'
        if (v.canal === 'online' && v.fechaEntrega) {
            const tipo = v.tipoRetiro === 'domicilio' ? 'Envío' : 'Retiro'
            entregaStr = `${tipo} ${new Date(v.fechaEntrega).toLocaleDateString('es-CL')}`
        }
        const estadoBadge = esAnulada
            ? '<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Anulada</span>'
            : '<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">Completada</span>'
        const totalDisplay = esAnulada
            ? `<span class="text-muted text-decoration-line-through me-1" style="font-size:0.78rem;">${formatearCLP(v.total)}</span><br><span class="text-danger fw-bold" style="font-size:0.8rem;">Reembolso: ${formatearCLP(v.total)}</span>`
            : `<strong class="text-success fw-bold" style="color:#059669 !important;">${formatearCLP(v.total)}</strong>`
        const vendedorNombre = v.vendedor || (usuarioActual ? usuarioActual.nombre : 'Gerente')
        const rowBg = esAnulada ? ' style="background:#fef2f2"' : ''
        return `<tr${rowBg}>
            <td class="text-center font-monospace fw-bold text-dark" style="padding:10px 12px;font-size:0.8rem;">#${v.id}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${fechaStr}</td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${v.cliente || '-'}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;"><span class="font-monospace text-primary fw-semibold me-1">${v.sku || '-'}</span> ${v.materialNombre || '-'}</td>
            <td class="text-center" style="padding:10px 12px;">${labelCanal}</td>
            <td class="text-center text-secondary" style="padding:10px 12px;font-size:0.78rem;">${entregaStr}</td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${v.cantidad} u.</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${formatearCLP(v.neto || v.total)}</td>
            <td class="text-center text-secondary" style="padding:10px 12px;font-size:0.78rem;">${formatearCLP(v.iva || 0)}</td>
            <td class="text-center" style="padding:10px 12px;">${totalDisplay}</td>
            <td class="text-center" style="padding:10px 12px;">${estadoBadge}</td>
            <td class="text-center" style="padding:10px 12px;"><span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;"><i class="bi bi-person-fill text-primary me-1"></i>${vendedorNombre}</span></td>
        </tr>`
    }).join('')
}

function poblarSelectVenta() {
    const select = document.getElementById('venta-material')
    if (!select) return
    select.innerHTML = '<option value="">Seleccionar material...</option>'
    inventario.forEach(i => {
        const option = document.createElement('option')
        option.value = i.id
        option.textContent = `${i.sku} - ${i.material} ${i.color} ${i.espesor}mm`
        select.appendChild(option)
    })
}

/* ==================== RENDER: BODEGA - INVENTARIO ==================== */
/* ==================== UTILIDAD: ORDENAR INVENTARIO ==================== */
function getSortedInventario(sortKey, direction) {
    const items = [...inventario]
    const numericKeys = ['stock', 'precio', 'espesor', 'id']
    const dir = direction === 'desc' ? -1 : 1
    if (numericKeys.includes(sortKey)) {
        items.sort((a, b) => dir * ((a[sortKey] || 0) - (b[sortKey] || 0)))
    } else {
        items.sort((a, b) => dir * String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'es', { sensitivity: 'base' }))
    }
    return items
}

function setupSortableHeaders(tableEl, storageKey, renderFn, columnMap) {
    if (!tableEl) return
    const ths = tableEl.querySelectorAll('thead th')
    const currentKey = sessionStorage.getItem(storageKey) || 'stock'
    const currentDir = sessionStorage.getItem(storageKey + 'Dir') || 'asc'

    ths.forEach((th, idx) => {
        const sortField = columnMap[idx]
        if (!sortField) {
            th.style.cursor = 'default'
            return
        }
        th.style.cursor = 'pointer'
        th.style.userSelect = 'none'

        // Limpiar flecha anterior
        const oldArrow = th.querySelector('.sort-arrow')
        if (oldArrow) oldArrow.remove()

        // Agregar flecha si es la columna activa
        if (sortField === currentKey) {
            const arrow = document.createElement('span')
            arrow.className = 'sort-arrow'
            arrow.textContent = currentDir === 'asc' ? ' ▲' : ' ▼'
            arrow.style.fontSize = '0.75em'
            arrow.style.opacity = '0.8'
            th.appendChild(arrow)
        }

        th.onclick = function () {
            const prevKey = sessionStorage.getItem(storageKey) || 'stock'
            let newDir = 'asc'
            if (prevKey === sortField) {
                newDir = (sessionStorage.getItem(storageKey + 'Dir') || 'asc') === 'asc' ? 'desc' : 'asc'
            }
            sessionStorage.setItem(storageKey, sortField)
            sessionStorage.setItem(storageKey + 'Dir', newDir)
            renderFn()
        }
    })
}

function renderBodegaInventario() {
    const tbody = document.getElementById('bodega-inv-lista')
    if (!tbody) return
    const table = tbody.closest('table')

    if (inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding:12px;text-align:center;color:var(--text-muted)">Sin datos</td></tr>'
        return
    }

    const sortKey = sessionStorage.getItem('bodegaInvSortKey') || 'stock'
    const sortDir = sessionStorage.getItem('bodegaInvSortKeyDir') || 'asc'
    const sorted = getSortedInventario(sortKey, sortDir)

    // Columnas clickeables: SKU(0), Material(1), Marca(2), Color(3), Espesor(4), Stock(5)
    setupSortableHeaders(table, 'bodegaInvSortKey', renderBodegaInventario, { 0: 'sku', 1: 'material', 2: 'marca', 3: 'color', 4: 'espesor', 5: 'stock' })

    tbody.innerHTML = sorted.map(item => {
        const estado = item.stock === 0 ? 'Agotado' : item.stock <= STOCK_MINIMO ? 'Bajo' : 'OK'
        const color = item.stock === 0 ? 'var(--danger)' : item.stock <= STOCK_MINIMO ? 'var(--warning)' : 'var(--success)'
        return `
            <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.sku}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.material}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.marca || '-'}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.color}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.espesor}mm</td>
                <td style="padding:6px 8px;font-size:0.85em;font-weight:bold;text-align:center;color:${color}">${item.stock}</td>
                <td style="padding:6px 8px;text-align:center"><span style="background:${color};color:#fff;padding:2px 6px;border-radius:3px;font-size:0.75em">${estado}</span></td>
                <td style="padding:6px 8px;text-align:center">
                    ${item.stock <= STOCK_MINIMO
                ? `<button onclick="appBodegaEnviarRepoDesdeInventario(${item.id})" style="background:var(--warning);color:#000;font-size:0.75em;padding:4px 8px;border-radius:3px">Reposicion</button>`
                : `<button disabled style="background:#555;color:#888;font-size:0.75em;padding:4px 8px;border-radius:3px;cursor:not-allowed">Reposicion</button>`
            }
                </td>
            </tr>
        `
    }).join('')
}

function renderBodegaKanban() {
    const colEnt = document.getElementById('bod-entrantes') || document.getElementById('kanban-entrantes')
    const colProc = document.getElementById('bod-proceso') || document.getElementById('kanban-proceso')
    const colTerm = document.getElementById('bod-entregados') || document.getElementById('kanban-terminado')
    if (!colEnt || !colProc || !colTerm) return

    // Cargar encargados de bodega
    let bodegueros = []
    if (datosJSON && datosJSON.perfiles && datosJSON.perfiles.bodegueros) {
        bodegueros = [...datosJSON.perfiles.bodegueros]
    }
    if (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) {
        const emps = datosJSON.perfiles.empleados
            .filter(e => e.rol && e.rol.toLowerCase().includes('bodeg'))
            .map(e => e.nombre)
        if (emps.length > 0) bodegueros = Array.from(new Set([...bodegueros, ...emps]))
    }
    if (!bodegueros || bodegueros.length === 0) {
        bodegueros = ['Luis', 'Ana', 'Jorge', 'Valentina']
    }

    // Busqueda de filtro
    const inputB = document.getElementById('input-busqueda-bodega')
    const busqueda = inputB ? inputB.value.trim().toLowerCase() : ''

    // Tareas de entrega activas
    let tasks = tareas.filter(t => t.tipo === 'entrega' && !['eliminada', 'archivada'].includes(t.estado))

    // Filtro por busqueda
    if (busqueda) {
        tasks = tasks.filter(t => {
            const cliente = (t.cliente || '').toLowerCase()
            const vendedor = (t.vendedor || '').toLowerCase()
            const sku = (t.sku || '').toLowerCase()
            const mat = (t.materialNombre || '').toLowerCase()
            const encargado = (t.trabajadorAsignado || '').toLowerCase()
            const cod = (`V-${String(t.ventaId).padStart(4, '0')}`).toLowerCase()
            const itemsMatch = t.items ? t.items.some(i => (i.sku || '').toLowerCase().includes(busqueda) || (i.materialNombre || '').toLowerCase().includes(busqueda)) : false
            return cliente.includes(busqueda) || vendedor.includes(busqueda) || sku.includes(busqueda) || mat.includes(busqueda) || encargado.includes(busqueda) || cod.includes(busqueda) || itemsMatch
        })
    }

    // Asegurar timers para tareas en proceso
    tasks.filter(t => t.estado === 'en_proceso' && !timersEnProceso[t.id]).forEach(t => {
        iniciarTimer(t.id, 5000)
    })

    // Construccion de HTML de Card
    function buildCardHtml(t, columna) {
        const venta = ventas.find(v => v.ventaGroupId === t.ventaId || v.id === t.ventaId)
        const canal = t.canal || (venta ? venta.canal : 'local')
        const tipoRetiro = t.tipoRetiro || (venta ? venta.tipoRetiro : 'local')
        const vendedor = t.vendedor || (venta ? venta.vendedor : 'Carlos')

        const fechaCompraObj = t.fechaCompra ? new Date(t.fechaCompra) : (venta ? new Date(venta.fecha) : new Date(t.fechaCreacion))
        const fechaCompra = fechaCompraObj.toLocaleDateString('es-CL')

        const clienteNombre = t.cliente || (venta ? venta.cliente : 'Cliente')
        const codigoTrans = t.ventaId ? `V-${String(t.ventaId).padStart(4, '0')}` : `V-${String(t.id).padStart(4, '0')}`
        const clienteId = `CLI-${String(venta ? venta.id : t.id).padStart(4, '0')}`

        const esInmediata = tipoRetiro === 'local'
        let labelTipoEntrega = 'Inmediata'
        let colorTipoEntrega = '#198754' // verde

        if (tipoRetiro === 'retiro') {
            labelTipoEntrega = 'Retiro en Tienda'
            colorTipoEntrega = '#0dcaf0' // celeste
        } else if (tipoRetiro === 'domicilio') {
            labelTipoEntrega = 'Envío a Domicilio'
            colorTipoEntrega = '#6f42c1' // morado
        }

        const colorPrioridadCard = t.prioridad === 'urgente' || t.prioridad === 'alta' ? '#dc3545' : t.prioridad === 'media' || t.prioridad === 'normal' ? '#ffc107' : t.prioridad === 'baja' ? '#198754' : colorTipoEntrega

        const tags = `<div class="kanban-card-tags mb-2 d-flex flex-wrap gap-1 align-items-center">
            <span class="badge px-2 py-1" style="background:#e0e7ff;color:#3730a3;font-size:0.68rem;font-weight:700;">${labelCanal}</span>
            <span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">${labelTipoEntrega}</span>
            ${columna === 2 && t.errorStock ? '<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Error Stock</span>' : ''}
            ${columna === 3 ? (t.estado === 'cancelada' || t.errorStock ? '<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Anulado</span>' : '<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">Entregado</span>') : ''}
        </div>`

        // Primera línea: Vendedor y Fecha
        const linea1 = `<div class="kanban-card-linea"><strong>Vendedor:</strong> ${vendedor} | <strong>Fecha:</strong> ${fechaCompra}</div>`

        // Segunda línea: Items
        const items = t.items && t.items.length > 0
            ? t.items
            : [{ sku: t.sku, materialNombre: t.materialNombre, cantidad: t.cantidad }]

        const linea2 = items.map(item => {
            const invItem = inventario.find(i => i.id === item.materialId || i.sku === item.sku)
            const matNombre = item.materialNombre || (invItem ? `${invItem.material} ${invItem.color} ${invItem.espesor}mm` : 'Material')
            return `<div class="kanban-card-linea"><strong>SKU:</strong> ${item.sku || '-'} | <strong>${matNombre}</strong> | <strong>${item.cantidad} u.</strong></div>`
        }).join('')

        // Tercera línea: Código y Cliente
        let fechaEntregaDisplay = (tipoRetiro === 'local' || tipoRetiro === 'inmediata' || !tipoRetiro)
            ? 'Inmediata'
            : (t.fechaEntrega ? new Date(t.fechaEntrega).toLocaleDateString('es-CL') : 'Pendiente')
        if (columna === 3) {
            const fFinObj = t.fechaFin ? new Date(t.fechaFin) : (t.fechaCompletada ? new Date(t.fechaCompletada) : new Date())
            fechaEntregaDisplay = fFinObj.toLocaleDateString('es-CL')
        }
        const labelFechaCol3 = columna === 3 ? (t.estado === 'cancelada' || t.errorStock ? 'Fecha Anulado' : 'Fecha Entregado') : 'Fecha Entrega'
        const linea3 = `<div class="kanban-card-linea"><strong>Cod:</strong> ${codigoTrans} | <strong>Cli:</strong> ${clienteNombre} | <strong>${labelFechaCol3}:</strong> ${fechaEntregaDisplay}</div>`

        // Cuarta línea: Encargado
        const linea4 = `<div class="kanban-card-linea"><i class="bi bi-person-badge text-primary me-1"></i><strong>Encargado:</strong> ${t.trabajadorAsignado || 'Sin asignar'}</div>`

        return { tags, linea1, linea2, linea3, linea4, clienteNombre, items, esInmediata, labelTipoEntrega, colorBorder: colorPrioridadCard }
    }

    // === COLUMNA 1: ENTRANTES ===
    const entrantes = tasks.filter(t => t.estado === 'pendiente' || t.estado === 'venta')

    entrantes.sort((a, b) => {
        const esInmA = a.tipoRetiro === 'local'
        const esInmB = b.tipoRetiro === 'local'
        if (esInmA && !esInmB) return -1
        if (!esInmA && esInmB) return 1
        const fA = a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : new Date(a.fechaCreacion).getTime()
        const fB = b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : new Date(b.fechaCreacion).getTime()
        return fA - fB
    })

    const htmlEnt = entrantes.map(t => {
        const c = buildCardHtml(t, 1)
        const btnsAsignar = bodegueros.map(nombre =>
            `<button onclick="appBodegaAsignarTrabajador(${t.id}, '${nombre}')" class="btn btn-sm btn-outline-primary py-0 px-2 mb-1" style="font-size:0.7rem">${nombre}</button>`
        ).join(' ')

        return `
        <div class="kanban-card" style="border-left-color:${c.colorBorder} !important">
            ${c.tags}
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            <div class="kanban-card-acciones">
                <div class="d-flex flex-wrap gap-1">${btnsAsignar}</div>
                <button onclick="appBodegaCancelar(${t.id})" class="btn btn-sm btn-outline-danger py-0 px-2 ms-auto" style="font-size:0.72rem">Cancelar</button>
            </div>
        </div>`
    }).join('')

    colEnt.innerHTML = entrantes.length === 0 ? '<div class="kanban-empty">Sin tareas entrantes</div>' : htmlEnt

    // === COLUMNA 2: EN PROCESO ===
    const enProceso = tasks.filter(t => t.estado === 'asignada' || t.estado === 'en_proceso')

    const htmlProc = enProceso.map(t => {
        const c = buildCardHtml(t, 2)
        const timer = timersEnProceso[t.id]
        const esEnProceso = t.estado === 'en_proceso'

        let btns = ''
        if (!esEnProceso) {
            btns = `<button onclick="appBodegaIniciar(${t.id})" class="btn btn-sm btn-success py-1 px-2" style="font-size:0.75rem"><i class="bi bi-play-fill me-1"></i> Iniciar Tarea</button>`
        } else if (timer && timer.completado) {
            btns = `<button onclick="appBodegaCompletar(${t.id})" class="btn btn-sm btn-emerald py-1 px-2" style="font-size:0.75rem"><i class="bi bi-check-circle-fill me-1"></i> Entregar Pedido</button>`
        } else {
            const durTotal = timer ? (timer.duracion || 5000) : 5000
            const restante = timer ? Math.max(0, Math.ceil((durTotal - (Date.now() - timer.inicio)) / 1000)) : 5
            const esDomicilio = t.tipoRetiro === 'domicilio'
            const msg = esDomicilio ? 'Enviando a domicilio' : 'Preparando entrega'
            btns = `<div class="fw-bold text-amber timer-pulse" style="color:#d97706;font-size:0.78rem"><i class="bi bi-hourglass-split me-1"></i>${msg} (${restante}s)...</div>`
        }

        return `
        <div class="kanban-card" style="border-left-color:#d97706 !important">
            ${c.tags}
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            ${c.linea4}
            <div class="kanban-card-acciones">
                <div>${btns}</div>
                <button onclick="appBodegaCancelar(${t.id})" class="btn btn-sm btn-outline-danger py-0 px-2 ms-auto" style="font-size:0.72rem">Cancelar</button>
            </div>
        </div>`
    }).join('')

    colProc.innerHTML = enProceso.length === 0 ? '<div class="kanban-empty">Sin tareas en proceso</div>' : htmlProc

    // === COLUMNA 3: ENTREGADOS ===
    const completadas = tasks.filter(t => t.estado === 'completada' || t.estado === 'cancelada')

    completadas.sort((a, b) => {
        const fa = a.fechaFin ? new Date(a.fechaFin).getTime() : 0
        const fb = b.fechaFin ? new Date(b.fechaFin).getTime() : 0
        return fb - fa
    })

    const htmlTerm = completadas.map(t => {
        const c = buildCardHtml(t, 3)
        const esCancelada = t.estado === 'cancelada' || t.errorStock
        const colorLabel = esCancelada ? '#dc2626' : '#059669'

        return `
        <div class="kanban-card" style="border-left-color:${colorLabel} !important; opacity:${esCancelada ? '0.75' : '1'}">
            ${c.tags}
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            ${c.linea4}
            <div class="kanban-card-acciones justify-content-end">
                <button onclick="appBodegaArchivar(${t.id})" class="btn btn-sm btn-light border text-secondary py-0 px-2" style="font-size:0.72rem">Archivar</button>
            </div>
        </div>`
    }).join('')

    colTerm.innerHTML = completadas.length === 0 ? '<div class="kanban-empty">Sin tareas entregadas</div>' : htmlTerm

    // Contadores
    const c1 = document.getElementById('bod-ent-count') || document.getElementById('kanban-ent-count')
    const c2 = document.getElementById('bod-proc-count') || document.getElementById('kanban-proc-count')
    const c3 = document.getElementById('bod-comp-count') || document.getElementById('kanban-term-count')
    if (c1) c1.textContent = entrantes.length
    if (c2) c2.textContent = enProceso.length
    if (c3) c3.textContent = completadas.length

    if (typeof renderEnvioTareasBodega === 'function') {
        renderEnvioTareasBodega()
    }
}

window.appBodegaEnviarAlertas = function () {
    if (alertasStockPendientes.length === 0) return

    const nota = document.getElementById('bodega-alerta-nota') ? document.getElementById('bodega-alerta-nota').value.trim() : ''

    alertasStockPendientes.forEach(a => {
        const tarea = new Tarea(siguienteId(tareas), 'reposicion', a.materialId, a.sku, a.materialNombre, a.cantidad, a.origen, a.notas)
        tarea.prioridad = a.prioridad
        tarea.estado = 'pendiente'
        tarea.fuente = 'bodega'
        tarea.enviadoPor = a.enviadoPor
        tarea.ventaId = a.ventaId
        if (nota) tarea.notas += ` | Nota bodega: ${nota}`
        tareas.push(tarea)
    })

    alertasStockPendientes = []
    guardarTodo()

    const contenido = document.getElementById('bodega-alerta-contenido')
    const btn = document.getElementById('bodega-alerta-btn')
    if (contenido) contenido.innerHTML = '<div style="padding:8px;text-align:center;color:var(--success)"><strong>Enviado a Reposicion</strong></div>'
    if (btn) btn.disabled = true

    setTimeout(() => {
        const notaEl = document.getElementById('bodega-alerta-nota')
        if (notaEl) notaEl.value = ''
        renderBodegaKanban()
    }, 2000)
}

window.appBodegaEnviarRepoDesdeInventario = function (materialId) {
    const item = inventario.find(i => i.id === materialId)
    if (!item) return
    const cant = Math.max(1, STOCK_MINIMO + 1 - item.stock)
    const matNombre = `${item.material} ${item.color} ${item.espesor}mm`
    const prioridadAlert = item.stock === 0 ? 'alta' : (item.stock <= 5 ? 'media' : 'normal');

    // Verificar si ya existe en Envío Tareas
    const yaEnAlertas = alertasStockPendientes.some(a => a.materialId === item.id || a.sku === item.sku)
    if (yaEnAlertas) {
        if (typeof mostrarSweetToast === 'function') mostrarSweetToast(`⚠️ El ítem ${item.sku} ya tiene una tarea pendiente en Envío Tareas.`, 'info')
        return
    }

    // Agregar a la columna Envío Tareas de Bodega para que el usuario la envíe manualmente
    alertasStockPendientes.push({
        id: Date.now() + Math.random(),
        materialId: item.id,
        sku: item.sku,
        materialNombre: matNombre,
        cantidad: cant,
        origen: 'stock-bajo',
        prioridad: prioridadAlert,
        enviadoPor: 'Inventario',
        notas: `Solicitud desde inventario bodega. Stock actual: ${item.stock}`
    });

    guardarTodo()
    renderBodegaKanban()
    if (typeof renderEnvioTareasBodega === 'function') renderEnvioTareasBodega()
    if (typeof mostrarSweetToast === 'function') mostrarSweetToast(`📦 Tarea generada en Envío Tareas para ${item.sku} (${cant} u.). Envíela manualmente a Reposición.`, 'success')
}

/* ==================== HELPER PRIORIDADES REPOSICION ==================== */
function repoPrioridadRank(p) {
    if (p === 'urgente' || p === 'alta') return 3
    if (p === 'normal' || p === 'media') return 2
    return 1
}

function repoPrioridadColor(p) {
    if (p === 'urgente' || p === 'alta') return '#dc3545' // Rojo
    if (p === 'normal' || p === 'media') return '#ffc107' // Amarillo
    return '#198754' // Verde
}

function repoPrioridadLabel(p) {
    if (p === 'urgente' || p === 'alta') return 'Prioridad alta'
    if (p === 'normal' || p === 'media') return 'Prioridad media'
    return 'Prioridad baja'
}

window.obtenerProveedoresParaMaterial = function(tarea) {
    if (!proveedores || proveedores.length === 0) return []
    if (!tarea) return proveedores

    const itemInv = (typeof inventario !== 'undefined' && Array.isArray(inventario)) ? inventario.find(i => i.id === tarea.materialId || i.sku === tarea.sku) : null
    const matNombre = (tarea.materialNombre || (itemInv ? itemInv.material : '')).toLowerCase()
    const marca = (itemInv ? itemInv.marca : '').toLowerCase()
    const sku = (tarea.sku || (itemInv ? itemInv.sku : '')).toLowerCase()

    const filtrados = proveedores.filter(p => {
        if (tarea.proveedorId && tarea.proveedorId === p.id) return true

        const pNombre = (p.nombre || '').toLowerCase()
        const pMarcas = (p.marcas || '').toLowerCase()
        const pMateriales = (p.materiales || '').toLowerCase()
        const pNotas = (p.notas || '').toLowerCase()
        const textFull = `${pNombre} ${pMarcas} ${pMateriales} ${pNotas}`

        if (marca && marca.length > 2 && (pMarcas.includes(marca) || textFull.includes(marca))) return true

        if (matNombre.includes('clavo') || sku.includes('cla')) {
            return textFull.includes('clavo') || textFull.includes('fijac') || textFull.includes('acero') || textFull.includes('inchalam')
        }
        if (matNombre.includes('tornillo') || sku.includes('tor')) {
            return textFull.includes('tornillo') || textFull.includes('fijac') || textFull.includes('acero') || textFull.includes('mamut')
        }
        if (matNombre.includes('martillo') || sku.includes('mar')) {
            return textFull.includes('martillo') || textFull.includes('herramienta') || textFull.includes('stanley')
        }
        if (matNombre.includes('pino') || matNombre.includes('terciado') || sku.includes('pin') || sku.includes('ter')) {
            return textFull.includes('madel') || textFull.includes('madera') || textFull.includes('pino') || textFull.includes('terciado') || textFull.includes('arauco')
        }
        if (matNombre.includes('osb') || sku.includes('osb')) {
            return textFull.includes('osb') || textFull.includes('tablero') || textFull.includes('lp')
        }
        if (matNombre.includes('volcan') || sku.includes('vol')) {
            return textFull.includes('volcan') || textFull.includes('yeso') || textFull.includes('placa')
        }
        if (matNombre.includes('huincha') || sku.includes('hui')) {
            return textFull.includes('huincha') || textFull.includes('medir') || textFull.includes('herramienta') || textFull.includes('lufkin')
        }
        if (matNombre.includes('serrucho') || sku.includes('ser')) {
            return textFull.includes('serrucho') || textFull.includes('herramienta') || textFull.includes('bahco')
        }

        return false
    })

    return filtrados.length > 0 ? filtrados : proveedores
}

/* ==================== RENDER: REPOSICION KANBAN ==================== */
function renderReposicionKanban() {
    const colEnt = document.getElementById('repo-entrantes')
    const colProc = document.getElementById('repo-proceso')
    const colComp = document.getElementById('repo-completado')
    if (!colEnt || !colProc || !colComp) return

    const inputR = document.getElementById('input-busqueda-reposicion')
    const busqueda = inputR ? inputR.value.trim().toLowerCase() : ''

    // Dinero disponible del negocio
    const dineroDisponible = tiendaConfig.dineroInicial !== undefined ? tiendaConfig.dineroInicial : 5000000

    // 1. REGLA: ¡Solo puede existir una tarea por SKU en la primera columna!
    // Si ingresan dos tareas para un mismo SKU, permanece la de prioridad mas alta.
    const entrantesBrutas = tareas.filter(t => t.tipo === 'reposicion' && ['pendiente', 'enviada'].includes(t.estado))
    const skuMap = {}

    entrantesBrutas.forEach(t => {
        const skuKey = t.sku || `MAT-${t.materialId}`
        if (!skuMap[skuKey]) {
            skuMap[skuKey] = t
        } else {
            const mainTask = skuMap[skuKey]
            const actualRank = repoPrioridadRank(mainTask.prioridad)
            const nuevoRank = repoPrioridadRank(t.prioridad)

            if (nuevoRank > actualRank) {
                const idxOld = tareas.findIndex(x => x.id === mainTask.id)
                if (idxOld !== -1) tareas.splice(idxOld, 1)
                skuMap[skuKey] = t
            } else {
                mainTask.cantidad = Math.max(parseInt(mainTask.cantidad) || 0, parseInt(t.cantidad) || 0)
                if (t.notas && mainTask.notas && !mainTask.notas.includes(t.notas)) {
                    mainTask.notas += ` | ${t.notas}`
                }
                const idxNew = tareas.findIndex(x => x.id === t.id)
                if (idxNew !== -1) tareas.splice(idxNew, 1)
            }
        }
    })

    let entrantes = Object.values(skuMap)

    // Apilar por prioridad: Alta (3) -> Media (2) -> Baja (1)
    entrantes.sort((a, b) => repoPrioridadRank(b.prioridad) - repoPrioridadRank(a.prioridad))

    // Filtro por busqueda
    if (busqueda) {
        entrantes = entrantes.filter(t => {
            const sku = (t.sku || '').toLowerCase()
            const mat = (t.materialNombre || '').toLowerCase()
            const por = (t.enviadoPor || '').toLowerCase()
            const fuente = (t.fuente || t.origen || '').toLowerCase()
            return sku.includes(busqueda) || mat.includes(busqueda) || por.includes(busqueda) || fuente.includes(busqueda)
        })
    }

    // === COLUMNA 1: TAREAS ENTRANTES ===
    const htmlEnt = entrantes.map(t => {
        const itemInv = inventario.find(i => i.id === t.materialId || i.sku === t.sku)
        const stockActual = itemInv ? itemInv.stock : 0
        const pc = repoPrioridadColor(t.prioridad)
        const fuente = (t.fuente || t.origen || 'ventas').toUpperCase()
        const enviadoPor = t.enviadoPor || t.trabajadorAsignado || 'Sistema'

        return `
        <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left: 4px solid ${pc} !important;">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;font-family:monospace;">#${t.id}</span>
            </div>

            <!-- 1ª línea de datos: desde donde se envía la tarea (ventas, bodega, registros) -->
            <div class="text-secondary mb-1" style="font-size:0.74rem;">
                <i class="bi bi-box-arrow-in-right me-1"></i>Desde: <strong class="text-dark">${fuente}</strong>
            </div>

            <!-- 2ª línea de datos: Nombre de quien envía la tarea -->
            <div class="text-secondary mb-1" style="font-size:0.74rem;">
                <i class="bi bi-person me-1"></i>Enviado por: <strong class="text-dark">${enviadoPor}</strong>
            </div>

            <!-- 3ª línea de datos: sku, Material y características, cantidad en existencia -->
            <div class="p-2 rounded border bg-light my-1" style="font-size:0.75rem;">
                <div><span class="font-monospace fw-bold text-primary me-1">${t.sku}</span> <span class="fw-semibold text-dark">${t.materialNombre}</span></div>
                <div class="mt-1 text-secondary">Stock actual: <strong class="${stockActual === 0 ? 'text-danger' : 'text-warning'}">${stockActual} und</strong> | Pedir: <strong class="text-dark">${t.cantidad} u.</strong></div>
            </div>

            <!-- Botones: Iniciar proceso de compra + Eliminar -->
            <div class="mt-2 pt-1 border-top d-flex align-items-center justify-content-between gap-1">
                <button onclick="appRepoIniciarCompra(${t.id})" class="btn btn-outline-success btn-sm py-1 px-2 fw-bold flex-grow-1" style="font-size:0.72rem;">
                    <i class="bi bi-play-circle-fill me-1"></i> Iniciar proceso de compra
                </button>
                <button onclick="appRepoEliminarTarea(${t.id})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;">
                    <i class="bi bi-trash3 me-1"></i> Eliminar
                </button>
            </div>
        </div>`
    }).join('')

    colEnt.innerHTML = entrantes.length === 0 ? '<div class="kanban-empty">Sin tareas entrantes</div>' : htmlEnt

    // === COLUMNA 2: PROCESO DE COMPRA ===
    let enProceso = tareas.filter(t => t.tipo === 'reposicion' && t.estado === 'en_proceso')

    if (busqueda) {
        enProceso = enProceso.filter(t => {
            const sku = (t.sku || '').toLowerCase()
            const mat = (t.materialNombre || '').toLowerCase()
            const prov = (t.proveedorNombre || '').toLowerCase()
            return sku.includes(busqueda) || mat.includes(busqueda) || prov.includes(busqueda)
        })
    }

    enProceso.sort((a, b) => repoPrioridadRank(b.prioridad) - repoPrioridadRank(a.prioridad))

    const htmlProc = enProceso.map(t => {
        const itemInv = inventario.find(i => i.id === t.materialId || i.sku === t.sku)
        const stockActual = itemInv ? itemInv.stock : 0
        const pc = repoPrioridadColor(t.prioridad)
        const fuente = (t.fuente || t.origen || 'ventas').toUpperCase()
        const enviadoPor = t.enviadoPor || t.trabajadorAsignado || 'Sistema'
        const timer = timersRepo[t.id]

        const provsValidos = obtenerProveedoresParaMaterial(t)
        const optionsProv = provsValidos.map(p =>
            `<option value="${p.id}" ${t.proveedorId === p.id ? 'selected' : ''}>${p.nombre}</option>`
        ).join('')

        const cantActual = t.cantidadCompra || t.cantidad || 1
        const valUnit = t.valorUnidad || 0
        const netoCalc = valUnit * cantActual
        const ivaCalc = Math.round(netoCalc * IVA_PORCENTAJE)
        const totalCalc = netoCalc + ivaCalc

        const costoUnitarioConIva = valUnit > 0 ? valUnit * (1 + IVA_PORCENTAJE) : 1
        const maxComprable = Math.max(1, Math.floor(dineroDisponible / costoUnitarioConIva))

        const restanteNegociando = timer ? Math.max(0, 5 - Math.ceil((Date.now() - timer.inicio) / 1000)) : 5

        return `
        <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left: 4px solid ${pc} !important;">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;font-family:monospace;">#${t.id}</span>
            </div>

            <!-- 1ª línea de datos: desde donde se envía la tarea por Nombre de quien envía -->
            <div class="text-secondary mb-1" style="font-size:0.74rem;">
                <i class="bi bi-arrow-right-circle me-1"></i>Desde: <strong class="text-dark">${fuente}</strong> por <strong class="text-dark">${enviadoPor}</strong>
            </div>

            <!-- 2ª línea de datos: sku, Material y características, cantidad en existencia -->
            <div class="text-secondary mb-1" style="font-size:0.74rem;">
                <span class="font-monospace fw-bold text-primary me-1">${t.sku}</span> <strong class="text-dark">${t.materialNombre}</strong> | Stock actual: <strong class="${stockActual === 0 ? 'text-danger' : 'text-warning'}">${stockActual} und</strong>
            </div>

            <!-- 3ª línea de datos: en blanco para generar limpieza visual -->
            <div style="height: 6px;"></div>

            ${timer && timer.comprando ? `
                <div class="alert alert-info py-2 px-3 my-2 text-center shadow-sm rounded-3 border-info" style="font-size:0.82rem;">
                    <div class="fw-bold text-indigo mb-1 timer-pulse"><i class="bi bi-cash-coin me-1"></i>Negociando compra...</div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-indigo" role="progressbar" style="width: ${(5 - restanteNegociando) * 20}%;"></div>
                    </div>
                </div>
            ` : timer && timer.compraListo ? `
                <div class="p-2 rounded border bg-light my-1" style="font-size:0.75rem;">
                    <div><strong>Proveedor:</strong> ${t.proveedorNombre || '-'} | <strong>Cantidad:</strong> ${cantActual} und</div>
                    <div>Valor unit: <strong>${formatearCLP(valUnit)}</strong> | Stock prv: <strong>${t.stockProveedor || 0} und</strong></div>
                    <div style="height:4px"></div>
                    <div>IVA (19%): <strong>${formatearCLP(ivaCalc)}</strong></div>
                    <div class="fw-bold text-success fs-6 mt-1">Total: <strong>${formatearCLP(totalCalc)}</strong></div>
                </div>
                <div class="mt-2 pt-1 border-top d-flex align-items-center justify-content-between gap-1">
                    <button onclick="appRepoRealizarCompra(${t.id})" class="btn btn-outline-success btn-sm py-1 px-2 fw-bold flex-grow-1" style="font-size:0.72rem;">
                        <i class="bi bi-cart-check-fill me-1"></i> Realizar compra
                    </button>
                    <button onclick="appRepoEliminarTarea(${t.id})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;">
                        <i class="bi bi-trash3 me-1"></i> Eliminar
                    </button>
                </div>
            ` : `
                <!-- 4ª línea de datos: input de proveedor (desplegable) + input de cantidad a pedir -->
                <div class="row g-1 align-items-end mb-1">
                    <div class="col-7">
                        <label class="form-label text-muted mb-0" style="font-size:0.72rem;">Proveedor</label>
                        <select id="repo-prov-${t.id}" onchange="appRepoSelectProveedor(${t.id})" class="form-select form-select-sm" style="font-size:0.74rem;">
                            <option value="">Seleccionar...</option>
                            ${optionsProv}
                        </select>
                    </div>
                    <div class="col-5">
                        <label class="form-label text-muted mb-0" style="font-size:0.72rem;">Cantidad</label>
                        <input type="number" id="repo-cant-${t.id}" value="${cantActual}" min="1" max="${Math.min(t.stockProveedor || 999, maxComprable)}" onchange="appRepoCalcTotal(${t.id})" oninput="appRepoCalcTotal(${t.id})" class="form-control form-control-sm font-monospace fw-bold" style="font-size:0.74rem;">
                    </div>
                </div>

                <!-- 5ª línea de datos: valor unidad y stock disponible del proveedor -->
                <div class="text-secondary" style="font-size:0.73rem;">
                    Valor unit: <strong class="text-dark">${formatearCLP(valUnit)}</strong> | Stock prv: <strong class="text-dark">${t.stockProveedor || 0} und</strong>
                </div>

                <!-- 6ª línea de datos: en blanco -->
                <div style="height: 6px;"></div>

                <!-- 7ª línea de datos: iva -->
                <div class="text-secondary" style="font-size:0.73rem;">
                    IVA (19%): <strong class="text-dark">${formatearCLP(ivaCalc)}</strong>
                </div>

                <!-- 8ª línea de datos: total de compra -->
                <div class="fw-bold text-indigo mt-1" style="font-size:0.85rem;">
                    Total: <strong class="text-indigo">${formatearCLP(totalCalc)}</strong>
                </div>

                <div class="mt-2 pt-1 border-top d-flex align-items-center justify-content-between gap-1">
                    <button onclick="appRepoNegociarCompra(${t.id})" class="btn btn-outline-warning btn-sm py-1 px-2 fw-bold flex-grow-1" style="font-size:0.72rem;" ${!t.proveedorId ? 'disabled' : ''}>
                        <i class="bi bi-handshake me-1"></i> Negociar compra
                    </button>
                    <button onclick="appRepoEliminarTarea(${t.id})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;">
                        <i class="bi bi-trash3 me-1"></i> Eliminar
                    </button>
                </div>
            `}
        </div>`
    }).join('')

    colProc.innerHTML = enProceso.length === 0 ? '<div class="kanban-empty">Sin compras en proceso</div>' : htmlProc

    // === COLUMNA 3: RECEPCION DE COMPRAS ===
    let compradas = tareas.filter(t => t.tipo === 'reposicion' && ['comprada', 'completada'].includes(t.estado))

    if (busqueda) {
        compradas = compradas.filter(t => {
            const sku = (t.sku || '').toLowerCase()
            const mat = (t.materialNombre || '').toLowerCase()
            const prov = (t.proveedorNombre || '').toLowerCase()
            const idComp = (t.codigoCompra || '').toLowerCase()
            return sku.includes(busqueda) || mat.includes(busqueda) || prov.includes(busqueda) || idComp.includes(busqueda)
        })
    }

    const htmlComp = compradas.map(t => {
        const proveedor = proveedores.find(p => p.id === t.proveedorId)
        const provNombre = t.proveedorNombre || (proveedor ? proveedor.nombre : 'Proveedor')
        const provContacto = t.proveedorContacto || (proveedor ? `${proveedor.telefono || ''} | ${proveedor.email || ''}` : 'Sin datos')
        const fechaCompraStr = t.fechaCompra ? new Date(t.fechaCompra).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL')
        const idCompra = t.codigoCompra || `OC-${String(t.id).padStart(4, '0')}`
        const timer = timersRepo[t.id]
        const cantComprada = t.cantidadCompra || t.cantidad || 1

        let contenidoAccion = ''

        if (timer && timer.esperandoProveedor) {
            const restante = Math.max(0, 5 - Math.ceil((Date.now() - timer.inicio) / 1000))
            contenidoAccion = `
                <div class="alert alert-warning py-2 px-3 my-2 text-center shadow-sm rounded-3 border-warning" style="font-size:0.82rem;">
                    <div class="fw-bold mb-1 timer-pulse" style="color:#b45309;">
                        <i class="bi bi-truck me-1"></i>Esperando que llegue el proveedor...
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-warning" role="progressbar" style="width: ${(5 - restante) * 20}%;"></div>
                    </div>
                </div>`
        } else if (timer && timer.recibiendo) {
            const restante = Math.max(0, 5 - Math.ceil((Date.now() - timer.inicio) / 1000))
            contenidoAccion = `
                <div class="alert alert-info py-2 px-3 my-2 text-center shadow-sm rounded-3 border-info" style="font-size:0.82rem;">
                    <div class="fw-bold text-indigo mb-1 timer-pulse">
                        <i class="bi bi-box-arrow-in-down me-1"></i>Ingresando compra...
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-indigo" role="progressbar" style="width: ${(5 - restante) * 20}%;"></div>
                    </div>
                </div>`
        } else if ((timer && timer.recibido) || t.estado === 'completada') {
            contenidoAccion = `
                <div class="alert alert-success py-1 px-2 my-1 text-center font-monospace fw-bold shadow-sm" style="font-size:0.73rem;">
                    <i class="bi bi-check-circle-fill text-success me-1"></i>Nuevo stock registrado en inventario (+${cantComprada} u.)
                </div>
                <div class="mt-2 pt-1 border-top">
                    <button onclick="appRepoArchivar(${t.id})" class="btn btn-outline-secondary btn-sm py-1 px-2 w-100 fw-semibold" style="font-size:0.72rem;">
                        <i class="bi bi-archive me-1"></i> Archivar
                    </button>
                </div>`
        } else {
            contenidoAccion = `
                <div class="mt-2 pt-1 border-top">
                    <button onclick="appRepoRecibirCompra(${t.id})" class="btn btn-outline-success btn-sm py-1 px-2 w-100 fw-bold" style="font-size:0.72rem;">
                        <i class="bi bi-box-arrow-in-down me-1"></i> Recepcionar compra
                    </button>
                </div>`
        }

        return `
        <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border border-success" style="border-left: 4px solid #10b981 !important;">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;"><i class="bi bi-box-seam me-1"></i>Compras</span>
                <span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;font-family:monospace;">#${t.id}</span>
            </div>

            <!-- 1ª línea de datos: Nombre proveedor -->
            <div class="text-secondary mb-1" style="font-size:0.74rem;">
                <i class="bi bi-building me-1"></i>Proveedor: <strong class="text-dark">${provNombre}</strong>
            </div>

            <!-- 2ª línea de datos: Contactos proveedor -->
            <div class="text-secondary mb-1" style="font-size:0.73rem;">
                <i class="bi bi-telephone me-1"></i>Contacto: <strong class="text-dark">${provContacto}</strong>
            </div>

            <!-- 3ª línea de datos: sku, Material y características, cantidad -->
            <div class="p-2 rounded border bg-light my-1" style="font-size:0.75rem;">
                <span class="font-monospace fw-bold text-primary me-1">${t.sku}</span> <span class="fw-semibold text-dark">${t.materialNombre}</span>
                <div class="mt-1 text-secondary">Cantidad comprada: <strong class="text-success">${cantComprada} und</strong></div>
            </div>

            <!-- 4ª línea de datos: fecha en que se realizo la compra -->
            <div class="text-secondary mb-1" style="font-size:0.73rem;">
                <i class="bi bi-calendar-check me-1"></i>Fecha de compra: <strong class="text-dark">${fechaCompraStr}</strong>
            </div>

            <!-- 5ª línea de datos: id de la compra -->
            <div class="text-secondary mb-2" style="font-size:0.73rem;">
                <i class="bi bi-receipt me-1"></i>ID Compra: <strong class="text-indigo font-monospace">${idCompra}</strong>
            </div>

            ${contenidoAccion}
        </div>`
    }).join('')

    colComp.innerHTML = compradas.length === 0 ? '<div class="kanban-empty">Sin compras pendientes</div>' : htmlComp

    // Contadores
    const c1 = document.getElementById('repo-ent-count')
    const c2 = document.getElementById('repo-proc-count')
    const c3 = document.getElementById('repo-comp-count')
    if (c1) c1.textContent = entrantes.length
    if (c2) c2.textContent = enProceso.length
    if (c3) c3.textContent = compradas.length
}

/* ==================== FUNCIONES GLOBALES: FLUJO REPOSICION ==================== */
window.appRepoEliminarTarea = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

    const ejecutarEliminacion = () => {
        tarea.estado = 'eliminada'

        // Remover alertas pendientes asociadas en Bodega para este material/SKU
        if (typeof alertasStockPendientes !== 'undefined' && Array.isArray(alertasStockPendientes)) {
            alertasStockPendientes = alertasStockPendientes.filter(a => a.materialId !== tarea.materialId && a.sku !== tarea.sku)
        }

        if (timersRepo[tareaId]) {
            if (timersRepo[tareaId].intervalId) clearInterval(timersRepo[tareaId].intervalId)
            delete timersRepo[tareaId]
        }
        guardarTodo()
        renderReposicionKanban()
        if (typeof renderEnvioTareasBodega === 'function') {
            renderEnvioTareasBodega()
        }
        if (typeof mostrarSweetToast === 'function') {
            mostrarSweetToast(`🗑️ Tarea #${tareaId} eliminada del sistema`, 'info')
        }
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '¿Eliminar tarea de reposición?',
            text: `¿Está seguro de eliminar definitivamente la tarea #${tareaId} (${tarea.sku || tarea.materialNombre || ''})? Se eliminará del sistema y no volverá a bodega.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                ejecutarEliminacion()
            }
        })
    } else {
        if (confirm(`¿Está seguro de eliminar la tarea de reposición #${tareaId}? Se eliminará del sistema y no volverá a bodega.`)) {
            ejecutarEliminacion()
        }
    }
}

window.appRepoCancelarTarea = window.appRepoEliminarTarea
window.appRepoCancelarCompra = window.appRepoEliminarTarea

window.appRepoIniciarCompra = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'en_proceso'
    tarea.fechaInicio = new Date().toISOString()
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoSelectProveedor = function (tareaId) {
    const select = document.getElementById(`repo-prov-${tareaId}`)
    if (!select) return
    const provId = parseInt(select.value)
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    const prov = proveedores.find(p => p.id === provId)
    if (prov) {
        const item = inventario.find(i => i.id === tarea.materialId || i.sku === tarea.sku)
        const margen = (item && item.margen) ? item.margen : 30
        const precioP = item ? item.precio : 15000
        const costoBase = Math.round(precioP / ((1 + margen / 100) * 1.19))

        tarea.proveedorId = prov.id
        tarea.proveedorNombre = prov.nombre
        tarea.proveedorContacto = `${prov.telefono || ''} | ${prov.email || ''}`
        tarea.stockProveedor = 50
        tarea.valorUnidad = costoBase
        tarea.cantidadCompra = tarea.cantidad || Math.max(1, STOCK_MINIMO + 1 - (item ? item.stock : 0))
        const neto = tarea.valorUnidad * tarea.cantidadCompra
        tarea.totalCompra = neto + Math.round(neto * IVA_PORCENTAJE)
    }
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoCalcTotal = function (tareaId) {
    const input = document.getElementById(`repo-cant-${tareaId}`)
    if (!input) return
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    let cant = parseInt(input.value) || 1

    const dineroDisponible = tiendaConfig.dineroInicial !== undefined ? tiendaConfig.dineroInicial : 5000000
    const valUnit = tarea.valorUnidad || 0
    const costoUnitarioConIva = valUnit > 0 ? valUnit * (1 + IVA_PORCENTAJE) : 1
    const maxComprable = Math.max(1, Math.floor(dineroDisponible / costoUnitarioConIva))

    if (cant > maxComprable) {
        cant = maxComprable
        input.value = cant
        if (typeof mostrarSweetToast === 'function') {
            mostrarSweetToast(`⚠️ Cantidad limitada a ${maxComprable} u. según presupuesto disponible`, 'warning')
        }
    }

    tarea.cantidadCompra = cant
    const neto = valUnit * cant
    tarea.totalCompra = neto + Math.round(neto * IVA_PORCENTAJE)
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoNegociarCompra = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea || !tarea.proveedorId) return

    const valUnit = tarea.valorUnidad || 0
    const neto = valUnit * (tarea.cantidadCompra || 1)
    tarea.totalCompra = neto + Math.round(neto * IVA_PORCENTAJE)

    if (timersRepo[tareaId] && timersRepo[tareaId].intervalId) clearInterval(timersRepo[tareaId].intervalId)
    timersRepo[tareaId] = {
        inicio: Date.now(),
        comprando: true,
        compraListo: false,
        esperandoProveedor: false,
        proveedorLlego: false,
        recibiendo: false,
        recibido: false,
        intervalId: setInterval(() => {
            if (!timersRepo[tareaId]) return
            const elapsed = Date.now() - timersRepo[tareaId].inicio
            if (elapsed >= 5000) {
                clearInterval(timersRepo[tareaId].intervalId)
                timersRepo[tareaId].comprando = false
                timersRepo[tareaId].compraListo = true
            }
            renderReposicionKanban()
        }, 1000)
    }
    renderReposicionKanban()
}

window.appRepoRealizarCompra = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

    const valUnit = tarea.valorUnidad || 0
    const cant = tarea.cantidadCompra || tarea.cantidad || 1
    const neto = valUnit * cant
    const totalCompra = neto + Math.round(neto * IVA_PORCENTAJE)

    const dineroDisponible = tiendaConfig.dineroInicial !== undefined ? tiendaConfig.dineroInicial : 5000000
    if (totalCompra > dineroDisponible) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Sin fondos', `Disponible: ${formatearCLP(dineroDisponible)} | Total compra: ${formatearCLP(totalCompra)}`, 'error')
        } else if (typeof mostrarSweetToast === 'function') {
            mostrarSweetToast(`❌ No hay suficiente dinero disponible. Disponible: ${formatearCLP(dineroDisponible)}, Total: ${formatearCLP(totalCompra)}`, 'error')
        }
        return
    }

    // Descontar dinero al negocio
    tiendaConfig.dineroInicial = dineroDisponible - totalCompra

    tarea.totalCompra = totalCompra
    tarea.codigoCompra = `OC-${String(tarea.id).padStart(4, '0')}`
    tarea.estado = 'comprada'
    tarea.fechaCompra = new Date().toISOString()

    if (timersRepo[tareaId] && timersRepo[tareaId].intervalId) {
        clearInterval(timersRepo[tareaId].intervalId)
    }

    // Iniciar temporizador de 5s: Esperando que llegue el proveedor
    timersRepo[tareaId] = {
        inicio: Date.now(),
        comprando: false,
        compraListo: false,
        esperandoProveedor: true,
        proveedorLlego: false,
        recibiendo: false,
        recibido: false,
        intervalId: setInterval(() => {
            if (!timersRepo[tareaId]) return
            const elapsed = Date.now() - timersRepo[tareaId].inicio
            if (elapsed >= 5000) {
                clearInterval(timersRepo[tareaId].intervalId)
                timersRepo[tareaId].esperandoProveedor = false
                timersRepo[tareaId].proveedorLlego = true
            }
            renderReposicionKanban()
        }, 1000)
    }

    guardarTodo()
    renderReposicionKanban()
    if (typeof mostrarSweetToast === 'function') {
        mostrarSweetToast(`🛒 Compra realizada (${tarea.codigoCompra}). -$${formatearCLP(totalCompra)}. Esperando proveedor...`, 'success')
    }
}

window.appRepoRecibirCompra = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    if (timersRepo[tareaId] && timersRepo[tareaId].intervalId) {
        clearInterval(timersRepo[tareaId].intervalId)
    }

    // Iniciar temporizador de 5s: Ingresando compra a bodega
    timersRepo[tareaId] = {
        inicio: Date.now(),
        comprando: false,
        compraListo: false,
        esperandoProveedor: false,
        proveedorLlego: true,
        recibiendo: true,
        recibido: false,
        intervalId: setInterval(() => {
            if (!timersRepo[tareaId]) return
            const elapsed = Date.now() - timersRepo[tareaId].inicio
            if (elapsed >= 5000) {
                clearInterval(timersRepo[tareaId].intervalId)
                timersRepo[tareaId].recibiendo = false
                timersRepo[tareaId].recibido = true

                // Sumar nuevo stock al inventario
                const item = inventario.find(i => i.id === tarea.materialId || i.sku === tarea.sku)
                if (item) item.stock += (tarea.cantidadCompra || tarea.cantidad || 1)

                tarea.estado = 'completada'
                if (typeof tarea.marcarCompletada === 'function') tarea.marcarCompletada()
                guardarTodo()
                renderRepoInventario()
                renderTablaInventario()
                renderBodegaInventario()
                if (typeof mostrarSweetToast === 'function') {
                    mostrarSweetToast(`📦 Nuevo stock registrado (+${tarea.cantidadCompra || tarea.cantidad} u. a "${tarea.sku}")`, 'success')
                }
            }
            renderReposicionKanban()
        }, 1000)
    }
    renderReposicionKanban()
}

window.appRepoCancelarCompra = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    if (timersRepo[tareaId]) {
        clearInterval(timersRepo[tareaId].intervalId)
        delete timersRepo[tareaId]
    }
    tarea.estado = 'pendiente'
    tarea.proveedorId = null
    tarea.proveedorNombre = ''
    tarea.stockProveedor = 0
    tarea.valorUnidad = 0
    tarea.cantidadCompra = 0
    tarea.totalCompra = 0
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoArchivar = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'archivada'
    if (timersRepo[tareaId]) {
        clearInterval(timersRepo[tareaId].intervalId)
        delete timersRepo[tareaId]
    }
    guardarTodo()
    renderReposicionKanban()
}

window.renderListaProveedores = function () {
    const container = document.getElementById('lista-proveedores')
    if (!container) return

    if (!proveedores || proveedores.length === 0) {
        if (container.tagName === 'TBODY') {
            container.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted small">Sin proveedores registrados</td></tr>'
        } else {
            container.innerHTML = '<div class="text-center text-muted py-4 small">Sin proveedores registrados</div>'
        }
        return
    }

    if (container.tagName === 'TBODY') {
        container.innerHTML = proveedores.map(p => `
            <tr>
                <td style="padding:10px 12px;word-break:break-word;max-width:200px;">
                    <div class="fw-bold text-dark" style="font-size:0.82rem;">
                        <i class="bi bi-building text-primary me-1"></i>${p.nombre}
                    </div>
                    ${p.marcas ? `<span class="badge px-2 py-1 mt-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="bi bi-tag me-1 text-secondary"></i>${p.marcas}</span>` : ''}
                </td>
                <td style="padding:10px 12px;" class="text-center">
                    <div class="fw-semibold text-dark" style="font-size:0.8rem;">${p.contacto || 'Sin contacto'}</div>
                    ${p.telefono ? `<div class="text-muted" style="font-size:0.73rem;"><i class="bi bi-telephone me-1"></i>${p.telefono}</div>` : ''}
                    ${p.email ? `<div class="text-muted" style="font-size:0.73rem;"><i class="bi bi-envelope me-1"></i>${p.email}</div>` : ''}
                </td>
                <td style="padding:10px 12px;" class="text-center">
                    <div class="d-flex justify-content-center gap-1">
                        <button onclick="appRepoAbrirFormProveedor(${p.id})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar proveedor">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button onclick="appRepoEliminarProveedor(${p.id})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar proveedor">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('')
    } else {
        container.innerHTML = proveedores.map(p => `
            <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left: 4px solid var(--bs-primary) !important; max-width: 100%; word-break: break-word; overflow-x: hidden;">
                <div class="d-flex justify-content-between align-items-start mb-1 gap-1">
                    <div style="min-width:0; flex-grow:1;">
                        <div class="fw-bold text-dark text-truncate" style="font-size:0.84rem;">
                            <i class="bi bi-building me-1 text-primary"></i>${p.nombre}
                        </div>
                        ${p.marcas ? `<div class="mt-1 d-flex flex-wrap gap-1" style="max-width:100%;"><span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;white-space:normal;word-break:break-word;text-align:left;"><i class="bi bi-tag me-1 text-secondary"></i>${p.marcas}</span></div>` : ''}
                    </div>
                    <span class="badge px-2 py-1 flex-shrink-0" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;font-family:monospace;">ID #${p.id}</span>
                </div>

                <div class="text-secondary mt-1" style="font-size:0.75rem;">
                    <i class="bi bi-person me-1"></i>Contacto: <strong class="text-dark">${p.contacto || 'Sin contacto'}</strong>
                </div>

                ${(p.telefono || p.email) ? `
                    <div class="text-secondary mt-1" style="font-size:0.73rem;">
                        ${p.telefono ? `<span class="me-2"><i class="bi bi-telephone me-1 text-muted"></i>${p.telefono}</span>` : ''}
                        ${p.email ? `<span><i class="bi bi-envelope me-1 text-muted"></i>${p.email}</span>` : ''}
                    </div>
                ` : ''}

                <div class="mt-2 pt-1 border-top d-flex justify-content-end gap-1">
                    <button onclick="appRepoAbrirFormProveedor(${p.id})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar proveedor">
                        <i class="bi bi-pencil-square me-1"></i>Editar
                    </button>
                    <button onclick="appRepoEliminarProveedor(${p.id})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar proveedor">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
            </div>
        `).join('')
    }
}


window.appRepoEliminarProveedor = function (provId) {
    Swal.fire({
        title: '¿Eliminar proveedor?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(res => {
        if (!res.isConfirmed) return
        const idx = proveedores.findIndex(p => p.id === provId)
        if (idx !== -1) proveedores.splice(idx, 1)
        guardarTodo()
        renderListaProveedores()
    })
}

window.appRepoAbrirFormProveedor = function (provId) {
    const modal = document.getElementById('modal-proveedor')
    const titulo = document.getElementById('prov-form-titulo')
    if (!modal) return

    if (provId) {
        const prov = proveedores.find(p => p.id === provId)
        if (!prov) return
        titulo.textContent = 'Editar Proveedor'
        document.getElementById('prov-form-id').value = prov.id
        document.getElementById('prov-form-nombre').value = prov.nombre
        document.getElementById('prov-form-marcas').value = prov.marcas || ''
        document.getElementById('prov-form-contacto').value = prov.contacto || ''
        document.getElementById('prov-form-email').value = prov.email || ''
        document.getElementById('prov-form-telefono').value = prov.telefono || ''
    } else {
        titulo.textContent = 'Nuevo Proveedor'
        document.getElementById('prov-form-id').value = ''
        document.getElementById('prov-form-nombre').value = ''
        document.getElementById('prov-form-marcas').value = ''
        document.getElementById('prov-form-contacto').value = ''
        document.getElementById('prov-form-email').value = ''
        document.getElementById('prov-form-telefono').value = ''
    }

    modal.style.display = 'flex'
}

window.appRepoCerrarFormProveedor = function () {
    const modal = document.getElementById('modal-proveedor')
    if (modal) modal.style.display = 'none'
}

window.appRepoGuardarProveedor = function () {
    const id = document.getElementById('prov-form-id').value
    const nombre = document.getElementById('prov-form-nombre').value.trim()
    const marcas = document.getElementById('prov-form-marcas').value.trim()
    const contacto = document.getElementById('prov-form-contacto').value.trim()
    const email = document.getElementById('prov-form-email').value.trim()
    const telefono = document.getElementById('prov-form-telefono').value.trim()

    if (!nombre) { if (typeof mostrarSweetToast === 'function') mostrarSweetToast('Ingrese el nombre de la empresa', 'warning'); return }

    if (id) {
        const prov = proveedores.find(p => p.id === parseInt(id))
        if (prov) {
            prov.nombre = nombre
            prov.marcas = marcas
            prov.contacto = contacto
            prov.email = email
            prov.telefono = telefono
        }
    } else {
        const nuevoId = proveedores.length > 0 ? Math.max(...proveedores.map(p => p.id)) + 1 : 1
        proveedores.push({ id: nuevoId, nombre, marcas, contacto, email, telefono })
    }

    guardarTodo()
    renderListaProveedores()
    appRepoCerrarFormProveedor()
}

window.appRepoEditarProveedor = function (provId) {
    appRepoAbrirFormProveedor(provId)
}

function renderRepoInventario() {
    const tbody = document.getElementById('repo-inv-lista')
    if (!tbody) return
    const table = tbody.closest('table')

    if (inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="padding:12px;text-align:center;color:var(--text-muted)">Sin datos</td></tr>'
        return
    }

    const sortKey = sessionStorage.getItem('repoInvSortKey') || 'stock'
    const sortDir = sessionStorage.getItem('repoInvSortKeyDir') || 'asc'
    const sorted = getSortedInventario(sortKey, sortDir)

    // Columnas clickeables: ID(0), SKU(1), Material(2), Marca(3), Color(4), Espesor(5), Stock(6), Precio(7)
    setupSortableHeaders(table, 'repoInvSortKey', renderRepoInventario, { 0: 'id', 1: 'sku', 2: 'material', 3: 'marca', 4: 'color', 5: 'espesor', 6: 'stock', 7: 'precio' })

    tbody.innerHTML = sorted.map(item => {
        const margen = item.margen || 30
        const precioUnit = item.precio
        const ivaUnit = Math.round(precioUnit * IVA_PORCENTAJE)
        const precioVenta = precioUnit + Math.round(precioUnit * margen / 100) + ivaUnit
        const stock = item.stock
        const colorStock = stock === 0 ? 'var(--danger)' : stock <= STOCK_MINIMO ? 'var(--warning)' : 'var(--success)'
        const bgStock = stock === 0 ? 'rgba(220,53,69,0.15)' : stock <= STOCK_MINIMO ? 'rgba(255,193,7,0.15)' : 'transparent'
        return `
            <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.id}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.sku}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.material}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.marca || '-'}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.color}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.espesor}mm</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:${colorStock};background:${bgStock}">${stock}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${formatearCLP(precioUnit)}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${margen}%</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${formatearCLP(ivaUnit)}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--success)">${formatearCLP(precioVenta)}</td>
            </tr>
        `
    }).join('')
}

window.appAbrirStock = function (id) {
    const item = inventario.find(i => i.id === id)
    if (!item) return
    Swal.fire({
        title: `Ajustar stock`,
        text: `${item.material} ${item.color} — Stock actual: ${item.stock} u.`,
        input: 'number',
        inputValue: item.stock,
        inputAttributes: { min: 0, step: 1 },
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        inputValidator: (v) => {
            if (v === '' || isNaN(parseInt(v)) || parseInt(v) < 0) return 'Ingrese un valor válido (0 o más)'
        }
    }).then(res => {
        if (!res.isConfirmed) return
        item.stock = parseInt(res.value)
        guardarTodo()
        renderTablaInventario()
        renderBodegaInventario()
        renderRepoInventario()
        if (typeof mostrarSweetToast === 'function') mostrarSweetToast(`Stock de ${item.sku} actualizado a ${item.stock} u.`, 'success')
    })
}

/* ==================== FUNCIONES GLOBALES: FLUJO BODEGA ==================== */
window.appBodegaAsignarTrabajador = function (tareaId, trabajador) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.trabajadorAsignado = trabajador
    guardarTodo()
    renderBodegaKanban()

    if (typeof mostrarSweetToast === 'function') {
        mostrarSweetToast(`👤 Asignado a ${trabajador}. Moviendo a En Proceso en 2s...`, 'info')
    }

    setTimeout(() => {
        tarea.estado = 'asignada'
        tarea.asignadoA = 'bodega'
        guardarTodo()
        renderBodegaKanban()
        if (typeof mostrarSweetToast === 'function') {
            mostrarSweetToast(`✅ Tarea POO #${tarea.id} movida a En Proceso (Encargado: ${trabajador})`, 'success')
        }
    }, 2000)
}

window.appBodegaIniciar = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

    tarea.estado = 'preparando'
    tarea.fechaInicio = new Date().toISOString()
    guardarTodo()

    const esDomicilio = tarea.tipoRetiro === 'domicilio' || tarea.tipoRetiro === 'envio'
    const duracion = esDomicilio ? 10000 : 5000
    iniciarTimer(tareaId, duracion)
    renderBodegaKanban()
}

window.appBodegaCompletar = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

    const items = tarea.items && tarea.items.length > 0
        ? tarea.items
        : [{ materialId: tarea.materialId, sku: tarea.sku, materialNombre: tarea.materialNombre, cantidad: tarea.cantidad }]

    // 1. Verificar disponibilidad de stock al momento de la entrega
    let stockInsuficiente = false
    let itemFaltante = null

    for (const it of items) {
        const itemInv = inventario.find(i => i.id === it.materialId || i.sku === it.sku)
        if (!itemInv || itemInv.stock < it.cantidad) {
            stockInsuficiente = true
            itemFaltante = { itemReq: it, inv: itemInv }
            break
        }
    }

    if (stockInsuficiente) {
        // ERROR DE STOCK AL MOMENTO DE ENTREGAR!
        tarea.errorStock = true
        tarea.estado = 'cancelada'
        tarea.fechaFin = new Date().toISOString()

        const invItem = itemFaltante ? itemFaltante.inv : null
        const reqItem = itemFaltante ? itemFaltante.itemReq : items[0]
        const matNombre = reqItem.materialNombre || (invItem ? `${invItem.material} ${invItem.color}` : 'Material')
        const stockActual = invItem ? invItem.stock : 0

        // Activar mensaje ROJO a reposición
        alertasStockPendientes.push({
            materialId: invItem ? invItem.id : reqItem.materialId,
            sku: reqItem.sku || (invItem ? invItem.sku : ''),
            materialNombre: matNombre,
            cantidad: reqItem.cantidad,
            prioridad: 'urgente',
            origen: 'stock-insuficiente',
            notas: `🔴 ERROR DE STOCK AL ENTREGAR: Se requerían ${reqItem.cantidad} und, solo hay ${stockActual}. Venta #${tarea.ventaId || '?'} cancelada.`,
            ventaId: tarea.ventaId,
            enviadoPor: tarea.trabajadorAsignado || 'Bodega'
        })

        // Cancelar venta y realizar reembolso
        if (tarea.ventaId) {
            const ventasRelacionadas = ventas.filter(v => v.ventaGroupId === tarea.ventaId || v.id === tarea.ventaId)
            ventasRelacionadas.forEach(venta => {
                const reembolso = venta.total
                ventasAnuladas.push({
                    id: ventasAnuladas.length + 1,
                    ventaOriginalId: venta.id,
                    fecha: new Date().toISOString(),
                    cliente: venta.cliente,
                    materialNombre: venta.materialNombre,
                    sku: venta.sku,
                    cantidad: venta.cantidad,
                    montoReembolso: reembolso,
                    motivo: 'Error de stock en bodega al entregar',
                    vendedor: venta.vendedor
                })
                venta.estado = 'anulada'

                const clienteObj = clientes.find(c => c.nombre === venta.cliente)
                if (clienteObj) clienteObj.saldo += reembolso
            })
        }
        tarea.montoReembolsado = tarea.items ? tarea.items.reduce((s, it) => s + (it.precioUnitario * it.cantidad), 0) : 0

        if (timersEnProceso[tareaId]) {
            clearInterval(timersEnProceso[tareaId].intervalId)
            delete timersEnProceso[tareaId]
        }

        guardarTodo()
        renderBodegaKanban()
        renderBodegaInventario()
        renderEnvioTareasBodega()
        if (typeof mostrarSweetToast === 'function') {
            mostrarSweetToast(`❌ Error de stock al entregar. Venta cancelada y reembolsada.`, 'error')
        }
        return
    }

    // 2. DESCONTAR STOCK SOLO AL PROCEDER A ENTREGAR EL PRODUCTO
    if (!tarea.stockDescontado) {
        for (const it of items) {
            const itemInv = inventario.find(i => i.id === it.materialId || i.sku === it.sku)
            if (!itemInv) continue
            itemInv.stock -= it.cantidad

            // Si el stock baja a <= 5 ítems (y > 0) -> Mensaje NARANJA a reposición
            if (itemInv.stock <= 5 && itemInv.stock > 0) {
                alertasStockPendientes.push({
                    materialId: itemInv.id,
                    sku: itemInv.sku,
                    materialNombre: `${itemInv.material} ${itemInv.color} ${itemInv.espesor}mm`,
                    cantidad: Math.max(1, STOCK_MINIMO + 1 - itemInv.stock),
                    prioridad: 'media',
                    origen: 'stock-bajo',
                    notas: `🟠 Stock bajo (${itemInv.stock} und restantes tras entrega). Tarea #${tarea.id}`,
                    ventaId: tarea.ventaId,
                    enviadoPor: tarea.trabajadorAsignado || 'Bodega'
                })
            }

            // Si el stock baja a 0 -> Mensaje ROJO a reposición
            if (itemInv.stock === 0) {
                alertasStockPendientes.push({
                    materialId: itemInv.id,
                    sku: itemInv.sku,
                    materialNombre: `${itemInv.material} ${itemInv.color} ${itemInv.espesor}mm`,
                    cantidad: 10,
                    prioridad: 'urgente',
                    origen: 'stock-agotado',
                    notas: `🔴 Stock AGOTADO (0 und restantes tras entrega). Tarea #${tarea.id}`,
                    ventaId: tarea.ventaId,
                    enviadoPor: tarea.trabajadorAsignado || 'Bodega'
                })
            }
        }
        tarea.stockDescontado = true
    }

    tarea.estado = 'completada'
    tarea.fechaFin = new Date().toISOString()
    tarea.fechaCompletada = new Date().toISOString()

    if (timersEnProceso[tareaId]) {
        clearInterval(timersEnProceso[tareaId].intervalId)
        delete timersEnProceso[tareaId]
    }

    guardarTodo()
    renderBodegaKanban()
    renderBodegaInventario()
    renderTablaInventario()
    renderRepoInventario()
    renderEnvioTareasBodega()
    if (typeof mostrarSweetToast === 'function') {
        mostrarSweetToast(`✅ Pedido entregado y stock descontado del inventario`, 'success')
    }
}

window.appBodegaCancelar = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

    if (timersEnProceso[tareaId]) {
        clearInterval(timersEnProceso[tareaId].intervalId)
        delete timersEnProceso[tareaId]
    }

    // Restablecer stock si ya habia sido descontado
    if (tarea.stockDescontado) {
        const items = tarea.items && tarea.items.length > 0
            ? tarea.items
            : [{ materialId: tarea.materialId, sku: tarea.sku, materialNombre: tarea.materialNombre, cantidad: tarea.cantidad }]
        for (const it of items) {
            const itemInv = inventario.find(i => i.id === it.materialId || i.sku === it.sku)
            if (itemInv) itemInv.stock += it.cantidad
        }
        tarea.stockDescontado = false
    }

    // Cancelar ventas asociadas y generar reembolso
    const ventasRelacionadas = ventas.filter(v => v.ventaGroupId === tarea.ventaId || v.id === tarea.ventaId)
    let totalReembolso = 0
    ventasRelacionadas.forEach(v => {
        v.estado = 'anulada'
        totalReembolso += v.total
        ventasAnuladas.push({
            id: ventasAnuladas.length + 1,
            ventaOriginalId: v.id,
            fecha: new Date().toISOString(),
            cliente: v.cliente,
            materialNombre: v.materialNombre,
            sku: v.sku,
            cantidad: v.cantidad,
            montoReembolso: v.total,
            motivo: 'Tarea cancelada en bodega',
            vendedor: v.vendedor
        })
        const clienteObj = clientes.find(c => c.nombre === v.cliente)
        if (clienteObj) clienteObj.saldo += v.total
    })

    tarea.montoReembolsado = totalReembolso || (tarea.items ? tarea.items.reduce((s, it) => s + (it.precioUnitario * it.cantidad), 0) : 0)
    tarea.estado = 'cancelada'
    tarea.fechaFin = new Date().toISOString()
    tarea.canceladoPor = tarea.trabajadorAsignado || (usuarioActual ? usuarioActual.nombre : 'Sistema')

    guardarTodo()
    renderBodegaKanban()
    renderBodegaInventario()
    if (typeof mostrarSweetToast === 'function') {
        mostrarSweetToast(`❌ Tarea #${tarea.id} cancelada. Reembolso de ${formatearCLP(tarea.montoReembolsado)} realizado.`, 'warning')
    }
}

window.appBodegaCancelarTarea = function (tareaId) {
    appBodegaCancelar(tareaId)
}

window.appBodegaArchivar = function (tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'archivada'
    guardarTodo()
    renderBodegaKanban()
}

/* ==================== TIMER EN PROCESO CON VERIFICACIÓN A LOS 2 SEGUNDOS ==================== */
function iniciarTimer(id, duracion) {
    if (timersEnProceso[id]) {
        clearInterval(timersEnProceso[id].intervalId)
    }
    const durMs = duracion || 5000
    const mitadMs = 2000 // Verificación rápida de stock a los 2 segundos

    timersEnProceso[id] = {
        inicio: Date.now(),
        duracion: durMs,
        completado: false,
        verificadoMitad: false,
        intervalId: setInterval(() => {
            const timer = timersEnProceso[id]
            if (!timer) return
            const elapsed = Date.now() - timer.inicio

            // VERIFICACIÓN RÁPIDA DE STOCK A LOS 2 SEGUNDOS DE PREPARACIÓN
            if (elapsed >= mitadMs && !timer.verificadoMitad) {
                timer.verificadoMitad = true
                const tarea = tareas.find(t => t.id === id)
                if (tarea) {
                    const items = tarea.items && tarea.items.length > 0
                        ? tarea.items
                        : [{ materialId: tarea.materialId, sku: tarea.sku, materialNombre: tarea.materialNombre, cantidad: tarea.cantidad }]

                    let stockInsuficiente = false
                    let itemFaltante = null

                    for (const it of items) {
                        const itemInv = inventario.find(i => i.id === it.materialId || i.sku === it.sku)
                        if (!itemInv || itemInv.stock < it.cantidad) {
                            stockInsuficiente = true
                            itemFaltante = { itemReq: it, inv: itemInv }
                            break
                        }
                    }

                    if (stockInsuficiente) {
                        // ❌ ANULACIÓN Y CANCELACIÓN POR FALTA DE STOCK DETECTADA A LOS 2 SEGUNDOS
                        clearInterval(timer.intervalId)
                        delete timersEnProceso[id]

                        tarea.errorStock = true
                        tarea.estado = 'cancelada'
                        tarea.fechaFin = new Date().toISOString()

                        const invItem = itemFaltante ? itemFaltante.inv : null
                        const reqItem = itemFaltante ? itemFaltante.itemReq : items[0]
                        const matNombre = reqItem.materialNombre || (invItem ? `${invItem.material} ${invItem.color}` : 'Material')
                        const stockActual = invItem ? invItem.stock : 0

                        // Activar mensaje ROJO a reposición
                        alertasStockPendientes.push({
                            id: Date.now() + Math.random(),
                            materialId: invItem ? invItem.id : reqItem.materialId,
                            sku: reqItem.sku || (invItem ? invItem.sku : ''),
                            materialNombre: matNombre,
                            cantidad: reqItem.cantidad,
                            prioridad: 'urgente',
                            origen: 'stock-insuficiente',
                            notas: `🔴 ERROR DE STOCK EN PREPARACIÓN (Detectado a los 2s): Requeridas ${reqItem.cantidad} u., hay ${stockActual} u. Venta #${tarea.ventaId || '?'} cancelada.`,
                            ventaId: tarea.ventaId,
                            enviadoPor: tarea.trabajadorAsignado || 'Bodega'
                        })

                        // Cancelar venta y reembolso automático
                        if (tarea.ventaId) {
                            const ventasRelacionadas = ventas.filter(v => v.ventaGroupId === tarea.ventaId || v.id === tarea.ventaId)
                            ventasRelacionadas.forEach(venta => {
                                const reembolso = venta.total
                                ventasAnuladas.push({
                                    id: ventasAnuladas.length + 1,
                                    ventaOriginalId: venta.id,
                                    fecha: new Date().toISOString(),
                                    cliente: venta.cliente,
                                    materialNombre: venta.materialNombre,
                                    sku: venta.sku,
                                    cantidad: venta.cantidad,
                                    montoReembolso: reembolso,
                                    motivo: 'Error de stock en preparación de bodega (a los 2s)',
                                    vendedor: venta.vendedor
                                })
                                venta.estado = 'anulada'

                                const clienteObj = clientes.find(c => c.nombre === venta.cliente)
                                if (clienteObj) clienteObj.saldo += reembolso
                            })
                        }
                        tarea.montoReembolsado = tarea.items ? tarea.items.reduce((s, it) => s + (it.precioUnitario * it.cantidad), 0) : 0

                        guardarTodo()
                        renderBodegaKanban()
                        renderBodegaInventario()
                        renderEnvioTareasBodega()
                        renderReposicionKanban()
                        if (typeof mostrarSweetToast === 'function') {
                            mostrarSweetToast(`❌ Error de stock detectado a los 2 segundos de preparación. Venta cancelada y dinero reembolsado.`, 'error')
                        }
                        return
                    }
                }
            }

            if (elapsed >= durMs) {
                clearInterval(timer.intervalId)
                timer.completado = true
            }
            renderBodegaKanban()
        }, 500)
    }
}

/* ==================== FUNCIONES DE VENTA (UI) ==================== */
function actualizarVendedorVenta() {
    const el = document.getElementById('venta-vendedor-label')
    if (el && sesionActiva && usuarioActual) {
        el.textContent = usuarioActual.nombre || 'Gerente'
    }
}

function setTareaInactivo() {
    const panel = document.getElementById('detalle-venta')
    const titulo = document.getElementById('detalle-titulo')
    const contenido = document.getElementById('detalle-contenido')
    const btn = document.getElementById('detalle-btn-accion')
    const nota = document.getElementById('detalle-nota')
    if (panel) { panel.style.opacity = '0.5'; panel.style.pointerEvents = 'none' }
    if (titulo) { titulo.textContent = 'Envio de Tareas'; titulo.style.color = '' }
    if (contenido) contenido.innerHTML = '<p style="color:var(--text-muted)">Las alertas de envio apareceran aqui.</p>'
    if (btn) { btn.disabled = true; btn.textContent = 'Enviar'; btn.style.background = '' }
    if (nota) nota.value = ''
}

function setTareaAcumulada() {
    const panel = document.getElementById('detalle-venta')
    const titulo = document.getElementById('detalle-titulo')
    const contenido = document.getElementById('detalle-contenido')
    const btn = document.getElementById('detalle-btn-accion')
    if (panel) { panel.style.opacity = '1'; panel.style.pointerEvents = 'auto' }
    if (titulo) { titulo.textContent = 'Enviado'; titulo.style.color = 'var(--info)' }
    if (contenido) contenido.innerHTML = '<p style="color:var(--info)" id="mensaje-enviado"></p>'
    if (btn) btn.disabled = true
}


function actualizarPreviewVenta() {
    const matId = document.getElementById('venta-material').value
    const cant = parseInt(document.getElementById('venta-cantidad').value) || 0
    const stockEl = document.getElementById('venta-stock-info')
    const precioEl = document.getElementById('venta-precio-info')
    const totalEl = document.getElementById('venta-total-preview')

    if (!matId) {
        if (stockEl) stockEl.textContent = '0'
        if (precioEl) precioEl.textContent = '$0'
        if (totalEl) totalEl.textContent = '$0'
        return
    }
    const item = inventario.find(i => i.id === parseInt(matId))
    if (!item) return

    if (stockEl) stockEl.textContent = item.stock
    if (precioEl) precioEl.textContent = formatearCLP(item.precio)
    if (totalEl) totalEl.textContent = formatearCLP(cant * item.precio)
}

/* ==================== FUNCIONES DE RENDER: PROVEEDORES ==================== */
/* ==================== FUNCIONES DE RENDER: INVENTARIO ==================== */
function renderStatsInventario() {
    const total = inventario.length
    const ok = inventario.filter(i => i.stock > 3).length
    const bajo = inventario.filter(i => i.stock > 0 && i.stock <= 3).length
    const agotado = inventario.filter(i => i.stock === 0).length

    const elTotal = document.getElementById('inv-total')
    const elOk = document.getElementById('inv-ok')
    const elBajo = document.getElementById('inv-bajo')
    const elAgotado = document.getElementById('inv-agotado')
    if (elTotal) elTotal.textContent = total
    if (elOk) elOk.textContent = ok
    if (elBajo) elBajo.textContent = bajo
    if (elAgotado) elAgotado.textContent = agotado

    const alerta = document.getElementById('inv-alerta')
    const texto = document.getElementById('inv-alerta-texto')
    if (agotado > 0) {
        if (alerta) alerta.classList.remove('oculto')
        if (texto) texto.textContent = `${agotado} material(es) agotados`
    } else if (bajo > 0) {
        if (alerta) alerta.classList.remove('oculto')
        if (texto) texto.textContent = `${bajo} material(es) con stock bajo`
    } else {
        if (alerta) alerta.classList.add('oculto')
    }
}

function renderTablaInventario() {
    const tbody = document.getElementById('tbody-inventario')
    if (!tbody) return
    const table = tbody.closest('table')

    const sortKey = sessionStorage.getItem('invSortKey') || 'stock'
    const sortDir = sessionStorage.getItem('invSortKeyDir') || 'asc'
    const sorted = getSortedInventario(sortKey, sortDir)

    // Columnas clickeables: SKU(0), Material(1), Stock(2), Precio(3)
    setupSortableHeaders(table, 'invSortKey', renderTablaInventario, { 0: 'sku', 1: 'material', 2: 'stock', 3: 'precio' })

    tbody.innerHTML = ''
    sorted.forEach(item => {
        const estado = item.stock === 0 ? 'Agotado' : item.stock <= 3 ? 'Bajo' : 'OK'
        const claseEstado = item.stock === 0 ? 'text-danger' : item.stock <= 3 ? 'text-warning' : 'text-success'
        const tr = document.createElement('tr')
        tr.innerHTML = `
            <td>${item.sku}</td>
            <td>${item.material} ${item.color} ${item.espesor}mm</td>
            <td>${item.stock}</td>
            <td>${formatearCLP(item.precio)}</td>
            <td class="${claseEstado}"><strong>${estado}</strong></td>
            <td><button onclick="appAbrirStock(${item.id})">Editar</button></td>
        `
        tbody.appendChild(tr)
    })
}

/* ==================== FUNCIONES DE RENDER: REPORTES ==================== */
function renderStatsReportes() {
    const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0)
    const totalReembolsos = ventasAnuladas.reduce((sum, va) => sum + va.montoReembolso, 0)
    const totalCompras = tareas
        .filter(t => t.tipo === 'reposicion' && t.estado === 'completada')
        .reduce((sum, t) => {
            const item = inventario.find(i => i.id === t.materialId)
            return sum + (item ? item.precio * t.cantidad : 0)
        }, 0)
    const ganancia = totalVentas - totalCompras - totalReembolsos
    const margen = totalVentas > 0 ? Math.round((ganancia / totalVentas) * 100) : 0

    const elIngresos = document.getElementById('rep-ingresos')
    const elEgresos = document.getElementById('rep-egresos')
    const elGanancia = document.getElementById('rep-ganancia')
    const elMargen = document.getElementById('rep-margen')
    if (elIngresos) elIngresos.textContent = formatearCLP(totalVentas)
    if (elEgresos) elEgresos.textContent = formatearCLP(totalCompras + totalReembolsos)
    if (elGanancia) elGanancia.textContent = formatearCLP(ganancia)
    if (elMargen) elMargen.textContent = margen + '%'
}

function renderDetalleReportes() {
    const divVentas = document.getElementById('rep-detalle-ventas')
    const divCompras = document.getElementById('rep-detalle-compras')
    const divReembolsos = document.getElementById('rep-detalle-reembolsos')

    if (divVentas) {
        if (ventas.length === 0) {
            divVentas.innerHTML = '<p>Sin datos</p>'
        } else {
            const porCliente = {}
            ventas.forEach(v => {
                if (!porCliente[v.cliente]) porCliente[v.cliente] = { cantidad: 0, total: 0 }
                porCliente[v.cliente].cantidad += v.cantidad
                porCliente[v.cliente].total += v.total
            })
            divVentas.innerHTML = Object.entries(porCliente).map(([cliente, datos]) =>
                `<p><strong>${cliente}</strong>: ${datos.cantidad} und - ${formatearCLP(datos.total)}</p>`
            ).join('')
        }
    }

    if (divReembolsos) {
        if (ventasAnuladas.length === 0) {
            divReembolsos.innerHTML = '<p>Sin reembolsos</p>'
        } else {
            const totalReembolsos = ventasAnuladas.reduce((sum, va) => sum + va.montoReembolso, 0)
            const unidades = ventasAnuladas.reduce((sum, va) => sum + va.cantidad, 0)
            divReembolsos.innerHTML = `
                <p><strong>Ventas anuladas:</strong> ${ventasAnuladas.length}</p>
                <p><strong>Unidades devueltas:</strong> ${unidades}</p>
                <p><strong>Total reembolsado:</strong> <span style="color:var(--danger)">${formatearCLP(totalReembolsos)}</span></p>
            `
        }
    }

    if (divCompras) {
        const reposPend = tareas.filter(t => t.tipo === 'reposicion' && ['pendiente', 'enviada'].includes(t.estado))
        const reposComp = tareas.filter(t => t.tipo === 'reposicion' && t.estado === 'completada')
        if (reposPend.length === 0 && reposComp.length === 0) {
            divCompras.innerHTML = '<p>Sin datos</p>'
        } else {
            let html = ''
            if (reposComp.length > 0) {
                html += '<p><strong>Completadas:</strong></p>'
                reposComp.forEach(t => {
                    html += `<p>#${t.id} - ${t.materialNombre} x${t.cantidad}</p>`
                })
            }
            if (reposPend.length > 0) {
                html += '<p><strong>Pendientes:</strong></p>'
                reposPend.forEach(t => {
                    html += `<p>#${t.id} - ${t.materialNombre} x${t.cantidad}</p>`
                })
            }
            divCompras.innerHTML = html
        }
    }
}


