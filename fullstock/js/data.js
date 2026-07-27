/* =============================================
   DATA.JS - Carga desde JSON + Clases + Logica
   ============================================= */

/* ==================== CONSTANTES ==================== */
const STOCK_MINIMO = 3
const IVA_PORCENTAJE = 0.19

/* ==================== ESTADO GLOBAL ==================== */
let datosJSON = null
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
let clientes = []
const timersEnProceso = {}
const timersRepo = {} // { tareaId: { inicio, tipo, intervalId } }

/* ==================== CARGA DESDE JSON ==================== */
async function cargarDatosJSON() {
    try {
        const respuesta = await fetch('fullstock/data.json')
        if (!respuesta.ok) throw new Error('Error al cargar data.json')
        datosJSON = await respuesta.json()
        return true
    } catch (error) {
        console.error('Error cargando data.json:', error)
        return false
    }
}

function cargarEstadoInicial() {
    if (!datosJSON) return

    tiendaConfig = { ...datosJSON.tienda }
    usuarioActual = null

    const invLocal = localStorage.getItem('fs_inventario') || sessionStorage.getItem('fs_inventario')
    inventario = invLocal ? JSON.parse(invLocal) : JSON.parse(JSON.stringify(datosJSON.inventario))

    const venLocal = localStorage.getItem('fs_ventas') || sessionStorage.getItem('fs_ventas')
    ventas = venLocal ? JSON.parse(venLocal) : JSON.parse(JSON.stringify(datosJSON.ventas))

    const bodLocal = localStorage.getItem('fs_bodega') || sessionStorage.getItem('fs_bodega')
    bodega = bodLocal ? JSON.parse(bodLocal) : JSON.parse(JSON.stringify(datosJSON.bodega))

    if (!gestorTareas.cargarDeStorage()) {
        gestorTareas.tareas = JSON.parse(JSON.stringify(datosJSON.tareas)).map(t => reconstruirTarea(t))
        gestorTareas.guardarEnStorage()
    }
    tareas = gestorTareas.tareas

    const provLocal = localStorage.getItem('fs_proveedores') || sessionStorage.getItem('fs_proveedores')
    proveedores = provLocal ? JSON.parse(provLocal) : JSON.parse(JSON.stringify(datosJSON.proveedores))

    const vaLocal = localStorage.getItem('fs_ventasAnuladas') || sessionStorage.getItem('fs_ventasAnuladas')
    ventasAnuladas = vaLocal ? JSON.parse(vaLocal) : JSON.parse(JSON.stringify(datosJSON.ventasAnuladas || []))

    const alertasLocal = localStorage.getItem('fs_alertasStock') || sessionStorage.getItem('fs_alertasStock')
    alertasStockPendientes = alertasLocal ? JSON.parse(alertasLocal) : []

    const clientesLocal = localStorage.getItem('fs_clientes') || sessionStorage.getItem('fs_clientes')
    clientes = clientesLocal ? JSON.parse(clientesLocal) : []

    const tiendaLocal = localStorage.getItem('fs_tienda') || sessionStorage.getItem('fs_tienda')
    tiendaConfig = tiendaLocal ? JSON.parse(tiendaLocal) : { ...datosJSON.tienda }

    guardarTodo()
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

    localStorage.setItem('fs_clientes', cliStr)
    sessionStorage.setItem('fs_clientes', cliStr)

    localStorage.setItem('fs_tienda', tienStr)
    sessionStorage.setItem('fs_tienda', tienStr)
}

function cargarSesion() {
    const datos = localStorage.getItem('fs_sesion') || sessionStorage.getItem('fs_sesion')
    if (datos) return JSON.parse(datos).activa
    return false
}

function guardarSesion() {
    const data = JSON.stringify({ activa: sesionActiva })
    localStorage.setItem('fs_sesion', data)
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
            const datosApi = await respuesta.json()
            
            const nuevasTareas = datosApi.map(item => {
                const nueva = new Tarea(
                    item.id + 9000,
                    'reposicion',
                    1,
                    `API-${item.id}`,
                    `Material API #${item.id}: ${item.title.substring(0, 20)}`,
                    10,
                    'api-externa',
                    `Sincronizado de JSONPlaceholder. Detalle: ${item.title}`
                )
                nueva.estado = item.completed ? 'completada' : 'pendiente'
                nueva.prioridad = item.completed ? 'baja' : 'urgente'
                nueva.fechaLimite = new Date(Date.now() + 86400000 * 2).toISOString()
                return nueva
            })

            let agregadasCount = 0
            nuevasTareas.forEach(t => {
                if (!this.tareas.some(exist => exist.id === t.id)) {
                    this.tareas.push(t)
                    agregadasCount++
                }
            })

            tareas = this.tareas
            this.guardarEnStorage()
            console.log(`[API Fetch] Recuperadas e integradas ${agregadasCount} tareas nuevas desde API externa`)
            return nuevasTareas
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
    if (!datosJSON) return null
    if (email === datosJSON.usuario.email && password === datosJSON.usuario.password) {
        return datosJSON.usuario
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
    if (!tbody) return
    tbody.innerHTML = ''

    const ventasOrd = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

    ventasOrd.forEach(v => {
        const tr = document.createElement('tr')
        if (v.estado === 'anulada') tr.style.opacity = '0.4'
        const fecha = new Date(v.fecha)
        const fechaStr = fecha.toLocaleDateString('es-CL')
        const colorCanal = v.canal === 'online' ? '#0dcaf0' : '#6c757d'
        const labelCanal = v.canal === 'online' ? 'Online' : 'Local'
        let entregaStr = '-'
        if (v.canal === 'online' && v.fechaEntrega) {
            const tipo = v.tipoRetiro === 'domicilio' ? 'Envio' : 'Retiro'
            entregaStr = `${tipo} ${new Date(v.fechaEntrega).toLocaleDateString('es-CL')}`
        }
        tr.innerHTML = `
            <td>${v.id}</td>
            <td>${fechaStr}</td>
            <td>${v.cliente}</td>
            <td><code>${v.sku}</code> ${v.materialNombre}</td>
            <td><span style="background:${colorCanal};color:#000;padding:2px 6px;border-radius:3px;font-size:0.8em">${labelCanal}</span></td>
            <td style="font-size:0.85em">${entregaStr}</td>
            <td>${v.cantidad}</td>
            <td>${formatearCLP(v.neto || v.total)}</td>
            <td>${formatearCLP(v.iva || 0)}</td>
            <td style="font-weight:bold">${formatearCLP(v.total)}</td>
            <td>${v.vendedor}</td>
        `
        tbody.appendChild(tr)
    })

    // Ventas anuladas
    const tbodyAnuladas = document.getElementById('tbody-ventas-anuladas')
    if (tbodyAnuladas) {
        tbodyAnuladas.innerHTML = ''
        const anuladas = [...ventasAnuladas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        if (anuladas.length === 0) {
            tbodyAnuladas.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">Sin ventas anuladas</td></tr>'
        } else {
            anuladas.forEach(va => {
                const tr = document.createElement('tr')
                tr.style.opacity = '0.7'
                tr.innerHTML = `
                    <td>${va.id}</td>
                    <td>${new Date(va.fecha).toLocaleDateString('es-CL')}</td>
                    <td>${va.cliente}</td>
                    <td><code>${va.sku}</code> ${va.materialNombre}</td>
                    <td>${va.cantidad}</td>
                    <td style="color:var(--danger);font-weight:bold">${formatearCLP(va.montoReembolso)}</td>
                    <td style="font-size:0.85em">${va.motivo}</td>
                    <td>${va.vendedor}</td>
                `
                tbodyAnuladas.appendChild(tr)
            })
        }
    }
}

function poblarSelectVenta() {
    const select = document.getElementById('venta-material')
    if (!select) return
    select.innerHTML = '<option value="">Seleccionar material...</option>'
    inventario.forEach(i => {
        const option = document.createElement('option')
        option.value = i.id
        option.textContent = `${i.sku} - ${i.material} ${i.color} ${i.espesor}mm (Stock: ${i.stock})`
        select.appendChild(option)
    })
}

/* ==================== RENDER: BODEGA - INVENTARIO ==================== */
function renderBodegaInventario() {
    const tbody = document.getElementById('bodega-inv-lista')
    if (!tbody) return

    if (inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding:12px;text-align:center;color:var(--text-muted)">Sin datos</td></tr>'
        return
    }

    tbody.innerHTML = inventario.map(item => {
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
    const colEnt = document.getElementById('kanban-entrantes')
    const colProc = document.getElementById('kanban-proceso')
    const colTerm = document.getElementById('kanban-terminado')
    const panel = document.getElementById('bodega-alerta-panel')
    const contenido = document.getElementById('bodega-alerta-contenido')
    const btn = document.getElementById('bodega-alerta-btn')
    const countEl = document.getElementById('kanban-alert-count')
    if (!colEnt || !colProc || !colTerm || !panel || !contenido || !btn) return

    const bodegueros = datosJSON && datosJSON.perfiles && datosJSON.perfiles.bodegueros
        ? datosJSON.perfiles.bodegueros
        : []

    const tasks = tareas.filter(t => t.tipo === 'entrega' && !['eliminada'].includes(t.estado))

    tasks.filter(t => t.estado === 'en_proceso' && !timersEnProceso[t.id]).forEach(t => {
        iniciarTimer(t.id)
    })

    function buildCardHtml(t) {
        const venta = ventas.find(v => v.ventaGroupId === t.ventaId || v.id === t.ventaId)
        const canal = t.canal || (venta ? venta.canal : 'local')
        const tipoRetiro = t.tipoRetiro || (venta ? venta.tipoRetiro : 'local')
        const vendedor = t.vendedor || (venta ? venta.vendedor : '-')
        const fechaCompra = t.fechaCompra ? new Date(t.fechaCompra).toLocaleDateString('es-CL') : (venta ? new Date(venta.fecha).toLocaleDateString('es-CL') : '-')
        const cliente = t.cliente || venta ? (t.cliente || venta.cliente) : (t.notas || '-').replace('Entregar a: ', '').split('|')[0].trim()
        const codigoTrans = venta ? `V-${String(venta.id).padStart(4, '0')}` : '-'
        const clienteId = venta ? `CLI-${String(venta.id).padStart(4, '0')}` : '-'

        const esInmediata = tipoRetiro === 'local'
        const labelTipoEntrega = esInmediata ? 'Inmediata' : tipoRetiro === 'retiro' ? 'Retiro en Tienda' : 'Envio a Domicilio'
        const colorTipoEntrega = esInmediata ? '#198754' : tipoRetiro === 'retiro' ? '#0dcaf0' : '#6f42c1'
        const colorCanal = canal === 'online' ? '#0dcaf0' : '#6c757d'
        const labelCanal = canal === 'online' ? 'Online' : 'Local'

        let fechaEntregaStr = 'Inmediata'
        if (!esInmediata && t.fechaEntrega) {
            fechaEntregaStr = new Date(t.fechaEntrega).toLocaleDateString('es-CL')
        }

        const tags = `<div class="kanban-card-tags">
            <span class="kanban-card-estado" style="background:${colorCanal}">${labelCanal}</span>
            <span class="kanban-card-estado" style="background:${colorTipoEntrega}">${labelTipoEntrega}</span>
        </div>`
        const linea1 = `<div class="kanban-card-linea"><strong>${vendedor}</strong> | ${fechaCompra}</div>`

        let linea2 = ''
        const items = t.items || [{ sku: t.sku, materialNombre: t.materialNombre, cantidad: t.cantidad }]
        linea2 = items.map(item =>
            `<div class="kanban-card-linea"><strong>${item.sku}</strong> ${item.materialNombre} | ${item.cantidad} und</div>`
        ).join('')

        const linea3 = `<div class="kanban-card-linea">${codigoTrans} | ${clienteId} | ${fechaEntregaStr}</div>`

        return { tags, linea1, linea2, linea3, cliente, colorCanal, labelCanal, colorTipoEntrega, labelTipoEntrega }
    }

    // === COLUMN 1: ENTRANTES (solo pendiente) ===
    const entrantes = tasks.filter(t => t.estado === 'pendiente' || t.estado === 'venta')

    entrantes.sort((a, b) => {
        const esInmA = a.tipoRetiro === 'local'
        const esInmB = b.tipoRetiro === 'local'
        if (esInmA && !esInmB) return -1
        if (!esInmA && esInmB) return 1
        const fA = a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : 0
        const fB = b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : 0
        return fA - fB
    })

    const htmlEnt = entrantes.map(t => {
        const c = buildCardHtml(t)
        const esUrgente = t.prioridad === 'urgente' || t.fechaEntrega && new Date(t.fechaEntrega) < new Date(Date.now() + 86400000)
        const borderColor = esUrgente ? '#dc3545' : '#0d6efd'

        const btnsAsignar = bodegueros.map(nombre =>
            `<button onclick="appBodegaAsignarTrabajador(${t.id}, '${nombre}')" style="font-size:0.7em;padding:3px 6px;margin:1px">${nombre}</button>`
        ).join('')

        return `
        <div class="kanban-card" style="border-left-color:${borderColor}">
            ${c.tags}
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            <div class="kanban-card-acciones" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
                <div>${btnsAsignar}</div>
                <button onclick="appBodegaCancelar(${t.id})" style="background:var(--danger);font-size:0.7em;padding:3px 6px;margin:1px">Cancelar tarea</button>
            </div>
        </div>`
    }).join('')

    colEnt.innerHTML = entrantes.length === 0 ? '<div class="kanban-empty">Sin tareas entrantes</div>' : htmlEnt

    // === COLUMN 2: EN PROCESO ===
    const enProceso = tasks.filter(t => t.estado === 'asignada' || t.estado === 'en_proceso')

    const htmlProc = enProceso.map(t => {
        const c = buildCardHtml(t)
        const timer = timersEnProceso[t.id]
        const esEnProceso = t.estado === 'en_proceso'

        let btns = ''
        if (!esEnProceso) {
            btns = `<button onclick="appBodegaIniciar(${t.id})" style="background:var(--success)">Iniciar tarea</button>`
        } else if (timer && timer.completado) {
            btns = `<button onclick="appBodegaCompletar(${t.id})" style="background:var(--success)">Entregar pedido</button>`
        } else {
            const durTotal = timer ? (timer.duracion || 10000) : 10000
            const restante = timer ? Math.max(0, Math.ceil((durTotal - (Date.now() - timer.inicio)) / 1000)) : 10
            const esDomicilio = c.labelTipoEntrega === 'Envio a Domicilio'
            const msg = esDomicilio ? 'Entrega en camino' : 'Preparando entrega'
            btns = `<div class="kanban-timer" style="width:100%;text-align:center;color:var(--accent);font-size:0.85em">${msg}...</div>`
        }

        const stockError = t.errorStock ? '<span class="kanban-card-estado" style="background:#dc3545;margin-left:4px">Error Stock</span>' : ''

        return `
        <div class="kanban-card" style="border-left-color:#fd7e14">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:${c.colorCanal}">${c.labelCanal}</span>
                <span class="kanban-card-estado" style="background:${c.colorTipoEntrega}">${c.labelTipoEntrega}</span>
                ${stockError}
            </div>
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            <div class="kanban-card-linea">Encargado: <strong>${t.trabajadorAsignado || '-'}</strong></div>
            <div class="kanban-card-acciones" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
                <div>${btns}</div>
                ${esEnProceso && timer && !timer.completado ?
                    `<button disabled style="background:#555;color:#888;cursor:not-allowed;font-size:0.7em;padding:3px 6px;margin:1px">Cancelar tarea</button>` :
                    `<button onclick="appBodegaCancelar(${t.id})" style="background:var(--danger);font-size:0.7em;padding:3px 6px;margin:1px">Cancelar tarea</button>`
                }
            </div>
        </div>`
    }).join('')

    colProc.innerHTML = enProceso.length === 0 ? '<div class="kanban-empty">Sin tareas en proceso</div>' : htmlProc

    // === COLUMN 3: ENTREGADOS ===
    const completadas = tasks.filter(t => t.estado === 'completada' || t.estado === 'cancelada')

    completadas.sort((a, b) => {
        const fa = a.fechaFin ? new Date(a.fechaFin).getTime() : 0
        const fb = b.fechaFin ? new Date(b.fechaFin).getTime() : 0
        return fb - fa
    })

    const htmlTerm = completadas.map(t => {
        const c = buildCardHtml(t)
        const esCancelada = t.estado === 'cancelada'
        const colorLabel = esCancelada ? '#dc3545' : '#198754'
        const textLabel = esCancelada ? 'Anulada' : 'Entregado'
        const fechaFin = t.fechaFin ? new Date(t.fechaFin).toLocaleDateString('es-CL') : '-'

        return `
        <div class="kanban-card" style="border-left-color:${colorLabel};opacity:${esCancelada ? '0.6' : '1'}">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:${colorLabel}">${textLabel}</span>
            </div>
            ${c.linea1}
            ${c.linea2}
            <div class="kanban-card-linea">${c.linea3.replace(/Inmediata|Retiro en Tienda|Envio a Domicilio/, fechaFin)}</div>
            <div class="kanban-card-linea">Encargado: <strong>${t.trabajadorAsignado || '-'}</strong></div>
            <div class="kanban-card-acciones" style="margin-top:6px">
                <button onclick="appBodegaArchivar(${t.id})" style="background:#6c757d;font-size:0.75em">Archivar</button>
            </div>
        </div>`
    }).join('')

    colTerm.innerHTML = completadas.length === 0 ? '<div class="kanban-empty">Sin tareas entregadas</div>' : htmlTerm

    // === COUNTS ===
    document.getElementById('kanban-ent-count').textContent = entrantes.length
    document.getElementById('kanban-proc-count').textContent = enProceso.length
    document.getElementById('kanban-term-count').textContent = completadas.length

    // === ALERTAS PANEL ===
    if (countEl) countEl.textContent = alertasStockPendientes.length

    if (alertasStockPendientes.length > 0) {
        panel.style.opacity = '1'
        panel.style.pointerEvents = 'auto'
        btn.disabled = false
        btn.textContent = `Enviar a Reposicion (${alertasStockPendientes.length})`
        btn.onclick = appBodegaEnviarAlertas
        contenido.innerHTML = alertasStockPendientes.map(a => {
            const esRoja = a.origen === 'stock-agotado' || a.prioridad === 'urgente'
            const color = esRoja ? '#dc3545' : '#fd7e14'
            const label = esRoja ? 'ROJA' : 'NARANJA'
            return `
                <div style="padding:6px;border-bottom:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <span style="background:${color};color:#fff;padding:1px 4px;border-radius:2px;font-size:0.7em">${label}</span>
                            <strong style="font-size:0.85em">${a.sku}</strong>
                        </div>
                        <span style="font-size:0.8em;color:var(--text-muted)">${a.cantidad} und</span>
                    </div>
                    <div style="font-size:0.8em;color:var(--text-muted)">${a.materialNombre}</div>
                </div>
            `
        }).join('')
    } else {
        panel.style.opacity = '0.5'
        panel.style.pointerEvents = 'none'
        btn.disabled = true
        btn.textContent = 'Enviar a Reposicion'
        btn.onclick = null
        contenido.innerHTML = '<p style="color:var(--text-muted)">Las alertas de stock apareceran aqui.</p>'
    }
}

window.appBodegaEnviarAlertas = function() {
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

window.appBodegaEnviarRepoDesdeInventario = function(materialId) {
    const item = inventario.find(i => i.id === materialId)
    if (!item) return
    const cant = Math.max(1, STOCK_MINIMO + 1 - item.stock)

    const tarea = new Tarea(siguienteId(tareas), 'reposicion', item.id, item.sku, `${item.material} ${item.color} ${item.espesor}mm`, cant, 'stock-bajo', `Solicitud desde inventario bodega. Stock actual: ${item.stock}`)
    tarea.prioridad = item.stock === 0 ? 'urgente' : 'normal'
    tarea.estado = 'pendiente'
    tarea.asignadoA = 'proveedores'
    tarea.fuente = 'registros'
    tarea.enviadoPor = 'Inventario'
    tareas.push(tarea)
    guardarTodo()
    renderBodegaKanban()
}

/* ==================== RENDER: REPOSICION KANBAN ==================== */
function renderReposicionKanban() {
    const colEnt = document.getElementById('repo-entrantes')
    const colProc = document.getElementById('repo-proceso')
    const colComp = document.getElementById('repo-completado')
    if (!colEnt || !colProc || !colComp) return

    function prioridadColor(t) {
        if (t.prioridad === 'urgente') return '#dc3545'
        if (t.prioridad === 'normal') return '#ffc107'
        return '#198754'
    }
    function prioridadLabel(t) {
        if (t.prioridad === 'urgente') return 'Alta'
        if (t.prioridad === 'normal') return 'Media'
        return 'Baja'
    }
    function fuenteLabel(t) {
        return t.fuente || 'ventas'
    }

    // === COL 1: TAREAS ENTRANTES ===
    const entrantes = tareas.filter(t => t.tipo === 'reposicion' && ['pendiente', 'enviada'].includes(t.estado))

    entrantes.sort((a, b) => {
        const pA = a.prioridad === 'urgente' ? 0 : a.prioridad === 'normal' ? 1 : 2
        const pB = b.prioridad === 'urgente' ? 0 : b.prioridad === 'normal' ? 1 : 2
        return pA - pB
    })

    const skuVisto = new Set()
    const entrantesFiltradas = entrantes.filter(t => {
        if (skuVisto.has(t.sku)) {
            const idx = tareas.findIndex(x => x.id === t.id)
            if (idx !== -1) tareas.splice(idx, 1)
            return false
        }
        skuVisto.add(t.sku)
        return true
    })

    const htmlEnt = entrantesFiltradas.map(t => {
        const item = inventario.find(i => i.id === t.materialId)
        const stockActual = item ? item.stock : '?'
        const pc = prioridadColor(t)
        const pl = prioridadLabel(t)
        return `
        <div class="kanban-card" style="border-left-color:${pc}">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:${pc}">${pl}</span>
            </div>
            <div class="kanban-card-linea">Desde: <strong>${fuenteLabel(t)}</strong></div>
            <div class="kanban-card-linea">Por: <strong>${t.enviadoPor || '-'}</strong></div>
            <div class="kanban-card-linea"><strong>${t.sku}</strong> ${t.materialNombre} | Stock: <strong>${stockActual}</strong></div>
            <div class="kanban-card-acciones" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <button onclick="appRepoIniciarCompra(${t.id})" style="background:var(--success)">Iniciar proceso de compra</button>
                </div>
                <button onclick="appRepoCancelarTarea(${t.id})" style="background:var(--danger);font-size:0.7em;padding:3px 6px;margin:1px">Cancelar</button>
            </div>
        </div>`
    }).join('')
    colEnt.innerHTML = entrantesFiltradas.length === 0 ? '<div class="kanban-empty">Sin tareas pendientes</div>' : htmlEnt

    // === COL 2: PROCESO DE COMPRA ===
    const enProceso = tareas.filter(t => t.tipo === 'reposicion' && t.estado === 'en_proceso')

    enProceso.sort((a, b) => {
        const pA = a.prioridad === 'urgente' ? 0 : a.prioridad === 'normal' ? 1 : 2
        const pB = b.prioridad === 'urgente' ? 0 : b.prioridad === 'normal' ? 1 : 2
        return pA - pB
    })

    const htmlProc = enProceso.map(t => {
        const item = inventario.find(i => i.id === t.materialId)
        const stockActual = item ? item.stock : '?'
        const pc = prioridadColor(t)
        const pl = prioridadLabel(t)
        const timer = timersRepo[t.id]

        const optionsProv = proveedores.map(p =>
            `<option value="${p.id}" ${t.proveedorId === p.id ? 'selected' : ''}>${p.nombre}</option>`
        ).join('')

        let contenido = ''
        if (timer && timer.comprando) {
            const restante = Math.max(0, 10 - Math.floor((Date.now() - timer.inicio) / 1000))
            contenido = `<div style="text-align:center;padding:10px 0">
                <div class="kanban-timer">Negociando compra...</div>
            </div>`
        } else if (timer && timer.compraListo) {
            contenido = `
                <div class="kanban-card-linea">Valor unit: <strong>${formatearCLP(t.valorUnidad)}</strong> | Stock prv: <strong>${t.stockProveedor || 0}</strong> und</div>
                <div class="kanban-card-linea">Cant: <strong>${t.cantidadCompra}</strong> und</div>
                <div class="kanban-card-linea">IVA: <strong>${formatearCLP(Math.round(t.totalCompra * IVA_PORCENTAJE))}</strong></div>
                <div class="kanban-card-linea" style="font-weight:bold;font-size:0.9em">Total: <strong>${formatearCLP(t.totalCompra)}</strong></div>
                <div class="kanban-card-acciones" style="margin-top:6px">
                    <button onclick="appRepoRealizarCompra(${t.id})" style="background:var(--success)">Realizar compra</button>
                </div>`
        } else {
            const totalCalc = t.valorUnidad * t.cantidadCompra
            const ivaCalc = Math.round(totalCalc * IVA_PORCENTAJE)
            contenido = `
                <div class="kanban-card-linea" style="height:6px"></div>
                <div class="kanban-card-linea" style="display:flex;gap:6px">
                    <div style="flex:1">
                        <label style="font-size:0.8em;color:var(--text-muted)">Proveedor
                            <select id="repo-prov-${t.id}" onchange="appRepoSelectProveedor(${t.id})" style="width:100%;font-size:0.85em;padding:4px;margin-top:2px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">
                                <option value="">Seleccionar...</option>
                                ${optionsProv}
                            </select>
                        </label>
                    </div>
                    <div style="flex:1">
                        <label style="font-size:0.8em;color:var(--text-muted)">Cantidad
                            <input type="number" id="repo-cant-${t.id}" value="${t.cantidadCompra || t.cantidad}" min="1" max="${t.stockProveedor || 999}" onchange="appRepoCalcTotal(${t.id})" oninput="appRepoCalcTotal(${t.id})" style="width:100%;font-size:0.85em;padding:4px;margin-top:2px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">
                        </label>
                    </div>
                </div>
                <div class="kanban-card-linea">Valor unit: <strong>${formatearCLP(t.valorUnidad)}</strong> | Stock prv: <strong>${t.stockProveedor || 0}</strong> und</div>
                <div class="kanban-card-linea" style="height:6px"></div>
                <div class="kanban-card-linea">IVA: <strong>${formatearCLP(ivaCalc)}</strong></div>
                <div class="kanban-card-linea" style="font-weight:bold;font-size:0.9em">Total: <strong>${formatearCLP(totalCalc)}</strong></div>
                <div class="kanban-card-acciones" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <button onclick="appRepoNegociarCompra(${t.id})" style="background:var(--info);color:#000" ${!t.proveedorId ? 'disabled style="background:#555;color:#888;cursor:not-allowed"' : ''}>Negociar compra</button>
                    </div>
                    <button onclick="appRepoCancelarCompra(${t.id})" style="background:var(--danger);font-size:0.7em;padding:3px 6px;margin:1px">Cancelar</button>
                </div>`
        }

        return `
        <div class="kanban-card" style="border-left-color:${pc}">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:${pc}">${pl}</span>
                <span class="kanban-card-estado" style="background:#0d6efd">En Proceso</span>
            </div>
            <div class="kanban-card-linea">Desde: <strong>${fuenteLabel(t)}</strong> | Por: <strong>${t.enviadoPor || '-'}</strong></div>
            <div class="kanban-card-linea"><strong>${t.sku}</strong> ${t.materialNombre} | Stock: <strong>${stockActual}</strong></div>
            ${contenido}
        </div>`
    }).join('')
    colProc.innerHTML = enProceso.length === 0 ? '<div class="kanban-empty">Sin compras en proceso</div>' : htmlProc

    // === COL 3: RECEPCION DE COMPRAS ===
    const compradas = tareas.filter(t => t.tipo === 'reposicion' && ['comprada', 'completada'].includes(t.estado))

    const htmlComp = compradas.map(t => {
        const pc = prioridadColor(t)
        const proveedor = proveedores.find(p => p.id === t.proveedorId)
        const timer = timersRepo[t.id]

        let contenido = ''
        if (timer && timer.esperando) {
            const restante = Math.max(0, 15 - Math.floor((Date.now() - timer.inicio) / 1000))
            contenido = `<div style="text-align:center;padding:10px 0">
                <div class="kanban-timer">Esperando la llegada del proveedor con el producto...</div>
            </div>`
        } else if (timer && timer.recibiendo) {
            const restante = Math.max(0, 10 - Math.floor((Date.now() - timer.inicio) / 1000))
            const msg = restante > 5 ? 'Ingresando materiales a bodega...' : 'Nuevo stock registrado'
            contenido = `<div style="text-align:center;padding:10px 0">
                <div class="kanban-timer">${msg}</div>
            </div>`
        } else if (t.estado === 'comprada') {
            contenido = `
                <div class="kanban-card-linea">Proveedor: <strong>${t.proveedorNombre || (proveedor ? proveedor.nombre : '-')}</strong></div>
                <div class="kanban-card-linea">${proveedor ? proveedor.telefono : ''} | ${proveedor ? proveedor.email : ''}</div>
                <div class="kanban-card-linea"><strong>${t.sku}</strong> ${t.materialNombre} | ${t.cantidadCompra || t.cantidad} und</div>
                <div class="kanban-card-linea">Fecha compra: ${t.fechaCompra ? new Date(t.fechaCompra).toLocaleDateString('es-CL') : '-'}</div>
                <div class="kanban-card-linea">ID Compra: <strong>${t.codigoCompra || `C-${String(t.id).padStart(4, '0')}`}</strong></div>
                <div class="kanban-card-acciones" style="margin-top:6px">
                    <button onclick="appRepoRecibirCompra(${t.id})" style="background:var(--success)">Recepcionar compra</button>
                </div>`
        } else {
            contenido = `
                <div class="kanban-card-linea">Proveedor: <strong>${t.proveedorNombre || '-'}</strong></div>
                <div class="kanban-card-linea"><strong>${t.sku}</strong> ${t.materialNombre} | ${t.cantidadCompra || t.cantidad} und</div>
                <div class="kanban-card-acciones" style="margin-top:6px">
                    <button onclick="appRepoArchivar(${t.id})" style="background:#6c757d">Archivar</button>
                </div>`
        }

        return `
        <div class="kanban-card" style="border-left-color:#0d6efd">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:#0d6efd">Compras</span>
            </div>
            ${contenido}
        </div>`
    }).join('')
    colComp.innerHTML = compradas.length === 0 ? '<div class="kanban-empty">Sin compras pendientes</div>' : htmlComp

    document.getElementById('repo-ent-count').textContent = entrantesFiltradas.length
    document.getElementById('repo-proc-count').textContent = enProceso.length
    document.getElementById('repo-comp-count').textContent = compradas.length
}

/* ==================== FUNCIONES REPOSICION ==================== */
window.appRepoCancelarTarea = function(tareaId) {
    const idx = tareas.findIndex(t => t.id === tareaId)
    if (idx !== -1) tareas.splice(idx, 1)
    if (timersRepo[tareaId]) {
        clearInterval(timersRepo[tareaId].intervalId)
        delete timersRepo[tareaId]
    }
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoIniciarCompra = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'en_proceso'
    tarea.fechaInicio = new Date().toISOString()
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoSelectProveedor = function(tareaId) {
    const select = document.getElementById(`repo-prov-${tareaId}`)
    if (!select) return
    const provId = parseInt(select.value)
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    const prov = proveedores.find(p => p.id === provId)
    if (prov) {
        tarea.proveedorId = prov.id
        tarea.proveedorNombre = prov.nombre
        tarea.proveedorContacto = `${prov.telefono} | ${prov.email}`
        tarea.stockProveedor = Math.floor(Math.random() * 50) + 10
        tarea.valorUnidad = Math.floor(Math.random() * 20000) + 5000
        tarea.cantidadCompra = Math.max(1, STOCK_MINIMO + 1 - (inventario.find(i => i.id === tarea.materialId)?.stock || 0))
        tarea.totalCompra = tarea.valorUnidad * tarea.cantidadCompra
    }
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoCalcTotal = function(tareaId) {
    const input = document.getElementById(`repo-cant-${tareaId}`)
    if (!input) return
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    const cant = parseInt(input.value) || 0
    tarea.cantidadCompra = cant
    tarea.totalCompra = tarea.valorUnidad * cant
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoNegociarCompra = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea || !tarea.proveedorId) return
    tarea.totalCompra = tarea.valorUnidad * tarea.cantidadCompra

    if (timersRepo[tareaId]) clearInterval(timersRepo[tareaId].intervalId)
    timersRepo[tareaId] = {
        inicio: Date.now(),
        comprando: true,
        compraListo: false,
        recibiendo: false,
        intervalId: setInterval(() => {
            const elapsed = Date.now() - timersRepo[tareaId].inicio
            if (elapsed >= 10000) {
                clearInterval(timersRepo[tareaId].intervalId)
                timersRepo[tareaId].comprando = false
                timersRepo[tareaId].compraListo = true
            }
            renderReposicionKanban()
        }, 1000)
    }
    renderReposicionKanban()
}

window.appRepoRealizarCompra = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.totalCompra = tarea.valorUnidad * tarea.cantidadCompra
    tarea.codigoCompra = `C-${String(tarea.id).padStart(4, '0')}`
    tarea.estado = 'comprada'
    tarea.fechaCompra = new Date().toISOString()
    if (timersRepo[tareaId]) { clearInterval(timersRepo[tareaId].intervalId); delete timersRepo[tareaId] }

    timersRepo[tareaId] = {
        inicio: Date.now(),
        esperando: true,
        recibiendo: false,
        intervalId: setInterval(() => {
            const elapsed = Date.now() - timersRepo[tareaId].inicio
            if (elapsed >= 15000) {
                clearInterval(timersRepo[tareaId].intervalId)
                timersRepo[tareaId].esperando = false
            }
            renderReposicionKanban()
        }, 1000)
    }

    guardarTodo()
    renderReposicionKanban()
}

window.appRepoRecibirCompra = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    if (timersRepo[tareaId]) clearInterval(timersRepo[tareaId].intervalId)
    timersRepo[tareaId] = {
        inicio: Date.now(),
        comprando: false,
        compraListo: false,
        recibiendo: true,
        intervalId: setInterval(() => {
            const elapsed = Date.now() - timersRepo[tareaId].inicio
            if (elapsed >= 10000) {
                clearInterval(timersRepo[tareaId].intervalId)
                delete timersRepo[tareaId]
                const item = inventario.find(i => i.id === tarea.materialId)
                if (item) item.stock += tarea.cantidadCompra || tarea.cantidad
                tarea.estado = 'completada'
                tarea.marcarCompletada()
                guardarTodo()
            }
            renderReposicionKanban()
        }, 1000)
    }
    renderReposicionKanban()
}

window.appRepoCancelarCompra = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    if (timersRepo[tareaId]) { clearInterval(timersRepo[tareaId].intervalId); delete timersRepo[tareaId] }
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

window.appRepoArchivar = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'archivada'
    guardarTodo()
    renderReposicionKanban()
}


window.appRepoArchivar = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'archivada'
    guardarTodo()
    renderReposicionKanban()
}

function renderListaProveedores() {
    const container = document.getElementById('lista-proveedores')
    if (!container) return

    if (proveedores.length === 0) {
        container.innerHTML = '<tr><td colspan="8" style="padding:12px;text-align:center;color:var(--text-muted)">Sin proveedores registrados</td></tr>'
        return
    }

    container.innerHTML = proveedores.map(p => `
        <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.id}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.nombre}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.marcas || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.contacto || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.email || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.telefono || '-'}</td>
            <td style="padding:6px 8px;text-align:center">
                <button onclick="appRepoEditarProveedor(${p.id})" style="font-size:0.75em;background:var(--info);color:#000;padding:3px 6px">Editar</button>
            </td>
            <td style="padding:6px 8px;text-align:center">
                <button onclick="appRepoEliminarProveedor(${p.id})" style="font-size:0.75em;background:var(--danger);padding:3px 6px">X</button>
            </td>
        </tr>
    `).join('')
}


window.appRepoEliminarProveedor = function(provId) {
    if (!confirm('Eliminar proveedor?')) return
    const idx = proveedores.findIndex(p => p.id === provId)
    if (idx !== -1) proveedores.splice(idx, 1)
    guardarTodo()
    renderListaProveedores()
}

window.appRepoAbrirFormProveedor = function(provId) {
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

window.appRepoCerrarFormProveedor = function() {
    const modal = document.getElementById('modal-proveedor')
    if (modal) modal.style.display = 'none'
}

window.appRepoGuardarProveedor = function() {
    const id = document.getElementById('prov-form-id').value
    const nombre = document.getElementById('prov-form-nombre').value.trim()
    const marcas = document.getElementById('prov-form-marcas').value.trim()
    const contacto = document.getElementById('prov-form-contacto').value.trim()
    const email = document.getElementById('prov-form-email').value.trim()
    const telefono = document.getElementById('prov-form-telefono').value.trim()

    if (!nombre) { alert('Ingrese el nombre de la empresa'); return }

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

window.appRepoEditarProveedor = function(provId) {
    appRepoAbrirFormProveedor(provId)
}

function renderRepoInventario() {
    const tbody = document.getElementById('repo-inv-lista')
    if (!tbody) return

    if (inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="padding:12px;text-align:center;color:var(--text-muted)">Sin datos</td></tr>'
        return
    }

    tbody.innerHTML = inventario.map(item => {
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

window.appAbrirStock = function(id) {
    const item = inventario.find(i => i.id === id)
    if (!item) return
    const nuevoStock = prompt(`Stock de "${item.material} ${item.color}": ${item.stock}\nNuevo stock:`, item.stock)
    if (nuevoStock === null) return
    const val = parseInt(nuevoStock)
    if (isNaN(val) || val < 0) { alert('Valor invalido'); return }
    item.stock = val
    guardarTodo()
    renderTablaInventario()
}

/* ==================== FUNCIONES GLOBALES: FLUJO BODEGA ==================== */
window.appBodegaAsignarTrabajador = function(tareaId, trabajador) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'asignada'
    tarea.trabajadorAsignado = trabajador
    tarea.asignadoA = 'bodega'
    guardarTodo()
    renderBodegaKanban()
}

window.appBodegaIniciar = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'en_proceso'
    tarea.fechaInicio = new Date().toISOString()
    guardarTodo()
    const esDomicilio = tarea.tipoRetiro === 'domicilio'
    const duracion = esDomicilio ? 20000 : 10000
    iniciarTimer(tareaId, duracion)
    renderBodegaKanban()
}

window.appBodegaCancelar = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

    if (timersEnProceso[tareaId]) {
        clearInterval(timersEnProceso[tareaId].intervalId)
        delete timersEnProceso[tareaId]
    }

    const ventasRelacionadas = ventas.filter(v => v.ventaGroupId === tarea.ventaId || v.id === tarea.ventaId)
    ventasRelacionadas.forEach(v => { v.estado = 'cancelada' })
    const total = tarea.items ? tarea.items.reduce((s, it) => s + (it.precioUnitario * it.cantidad), 0) : (ventasRelacionadas[0] ? ventasRelacionadas[0].total : 0)
    const cliente = ventasRelacionadas[0] ? clientes.find(c => c.nombre === ventasRelacionadas[0].cliente) : null
    if (cliente) cliente.saldo += total
    tarea.montoReembolsado = total

    tarea.estado = 'cancelada'
    tarea.fechaFin = new Date().toISOString()
    tarea.canceladoPor = tarea.trabajadorAsignado || 'Sistema'
    guardarTodo()
    renderBodegaKanban()
}

window.appBodegaCompletar = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

    const items = tarea.items || [{ materialId: tarea.materialId, sku: tarea.sku, materialNombre: tarea.materialNombre, cantidad: tarea.cantidad }]

    for (const it of items) {
        const item = inventario.find(i => i.id === it.materialId)
        if (!item) continue

        if (item.stock < it.cantidad) {
            tarea.estado = 'cancelada'
            tarea.fechaFin = new Date().toISOString()
            tarea.fechaCompletada = new Date().toISOString()
            tarea.errorStock = true

            const alerta = new Tarea(siguienteId(tareas), 'reposicion', item.id, item.sku, `${item.material} ${item.color} ${item.espesor}mm`, it.cantidad, 'stock-agotado', `Error stock: se necesitaban ${it.cantidad} und, solo hay ${item.stock}. Venta #${tarea.ventaId || '?'} cancelada.`)
            alerta.prioridad = 'urgente'
            alerta.estado = 'pendiente'
            alerta.ventaId = tarea.ventaId
            alerta.fuente = 'ventas'
            alerta.enviadoPor = tarea.trabajadorAsignado || 'Bodega'
            tareas.push(alerta)

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
                        motivo: 'Error de stock en bodega',
                        vendedor: venta.vendedor
                    })
                    venta.estado = 'anulada'
                })
            }

            if (timersEnProceso[tareaId]) {
                clearInterval(timersEnProceso[tareaId].intervalId)
                delete timersEnProceso[tareaId]
            }
            guardarTodo()
            renderBodegaKanban()
            renderBodegaInventario()
            return
        }

        item.stock -= it.cantidad
        if (item.stock <= 5 && item.stock > 0) {
            const existente = alertasStockPendientes.find(a => a.materialId === item.id)
            if (existente) {
                existente.prioridad = 'urgente'
                existente.notas = `Stock bajo: ${item.stock} restantes tras entrega. Venta #${tarea.ventaId || '?'}`
            } else {
                alertasStockPendientes.push({
                    materialId: item.id, sku: item.sku,
                    materialNombre: `${item.material} ${item.color} ${item.espesor}mm`,
                    cantidad: Math.max(1, STOCK_MINIMO + 1 - item.stock),
                    prioridad: 'normal',
                    origen: 'stock-bajo',
                    notas: `Stock bajo: ${item.stock} restantes tras entrega. Venta #${tarea.ventaId || '?'}`,
                    ventaId: tarea.ventaId,
                    enviadoPor: tarea.trabajadorAsignado || 'Bodega'
                })
            }
        }
        if (item.stock === 0) {
            const existente = alertasStockPendientes.find(a => a.materialId === item.id)
            if (existente) {
                existente.prioridad = 'urgente'
                existente.notas = `Stock AGOTADO tras entrega. Venta #${tarea.ventaId || '?'} completada con stock agotado.`
            } else {
                alertasStockPendientes.push({
                    materialId: item.id, sku: item.sku,
                    materialNombre: `${item.material} ${item.color} ${item.espesor}mm`,
                    cantidad: Math.max(1, STOCK_MINIMO + 1),
                    prioridad: 'urgente',
                    origen: 'stock-agotado',
                    notas: `Stock AGOTADO tras entrega. Venta #${tarea.ventaId || '?'} completada con stock agotado.`,
                    ventaId: tarea.ventaId,
                    enviadoPor: tarea.trabajadorAsignado || 'Bodega'
                })
            }
        }
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
}

window.appBodegaArchivar = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    tarea.estado = 'archivada'
    guardarTodo()
    renderBodegaKanban()
}

/* ==================== TIMER EN PROCESO (10s) ==================== */
function iniciarTimer(id, duracion) {
    if (timersEnProceso[id]) {
        clearInterval(timersEnProceso[id].intervalId)
    }
    const durMs = duracion || 10000
    timersEnProceso[id] = {
        inicio: Date.now(),
        duracion: durMs,
        completado: false,
        intervalId: setInterval(() => {
            const elapsed = Date.now() - timersEnProceso[id].inicio
            if (elapsed >= durMs) {
                clearInterval(timersEnProceso[id].intervalId)
                timersEnProceso[id].completado = true
            }
            renderBodegaKanban()
        }, 1000)
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
    tbody.innerHTML = ''
    inventario.forEach(item => {
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


