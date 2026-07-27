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

    const envVentaLocal = localStorage.getItem('fs_alertasEnvioVenta') || sessionStorage.getItem('fs_alertasEnvioVenta')
    alertasEnvioVenta = envVentaLocal ? JSON.parse(envVentaLocal) : []

    const clientesLocal = localStorage.getItem('fs_clientes') || sessionStorage.getItem('fs_clientes')
    clientes = (clientesLocal && JSON.parse(clientesLocal).length > 0) ? JSON.parse(clientesLocal) : JSON.parse(JSON.stringify(datosJSON.clientes || []))

    const empLocal = localStorage.getItem('fs_empleados') || sessionStorage.getItem('fs_empleados')
    if (empLocal && JSON.parse(empLocal).length > 0) {
        if (!datosJSON.perfiles) datosJSON.perfiles = {}
        datosJSON.perfiles.empleados = JSON.parse(empLocal)
    }

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

    if (!ventas || ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="padding:12px;text-align:center;color:var(--text-muted)">Sin ventas registradas en el historial</td></tr>'
        return
    }

    const ventasOrd = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

    ventasOrd.forEach(v => {
        const tr = document.createElement('tr')
        tr.style.borderBottom = '1px solid var(--border)'
        if (v.estado === 'anulada') {
            tr.style.background = 'rgba(220, 53, 69, 0.08)'
        }
        const fecha = v.fecha ? new Date(v.fecha) : new Date()
        const fechaStr = fecha.toLocaleDateString('es-CL')
        const colorCanal = v.canal === 'online' ? '#0dcaf0' : '#6c757d'
        const labelCanal = v.canal === 'online' ? 'Online' : 'Local'
        let entregaStr = '-'
        if (v.canal === 'online' && v.fechaEntrega) {
            const tipo = v.tipoRetiro === 'domicilio' ? 'Envío' : 'Retiro'
            entregaStr = `${tipo} ${new Date(v.fechaEntrega).toLocaleDateString('es-CL')}`
        }

        const esAnulada = v.estado === 'anulada'
        const estadoBadge = esAnulada 
            ? `<span style="background:var(--danger);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold">🚫 Anulada & Reembolsada</span>`
            : `<span style="background:var(--success);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold">✅ Completada</span>`

        const totalDisplay = esAnulada 
            ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:0.85em">${formatearCLP(v.total)}</span><br><span style="color:var(--danger);font-weight:bold;font-size:0.85em">Reembolsado: ${formatearCLP(v.total)}</span>`
            : `<strong style="color:var(--success)">${formatearCLP(v.total)}</strong>`

        tr.innerHTML = `
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.id}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${fechaStr}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${v.cliente || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center"><code>${v.sku || '-'}</code> ${v.materialNombre || '-'}</td>
            <td style="padding:6px 8px;text-align:center"><span style="background:${colorCanal};color:#000;padding:2px 6px;border-radius:3px;font-size:0.75em">${labelCanal}</span></td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${entregaStr}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.cantidad}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${formatearCLP(v.neto || v.total)}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${formatearCLP(v.iva || 0)}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${totalDisplay}</td>
            <td style="padding:6px 8px;text-align:center">${estadoBadge}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.vendedor || '-'}</td>
        `
        tbody.appendChild(tr)
    })
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

        th.onclick = function() {
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
    setupSortableHeaders(table, 'bodegaInvSortKey', renderBodegaInventario, {0:'sku',1:'material',2:'marca',3:'color',4:'espesor',5:'stock'})

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
    const colEnt = document.getElementById('kanban-entrantes')
    const colProc = document.getElementById('kanban-proceso')
    const colTerm = document.getElementById('kanban-terminado')
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
        iniciarTimer(t.id, 10000)
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

        const labelCanal = canal === 'online' ? 'Online' : 'Local'
        const colorCanal = canal === 'online' ? '#0dcaf0' : '#6c757d'

        let fechaEntregaStr = 'Inmediata'
        if (!esInmediata && t.fechaEntrega) {
            fechaEntregaStr = new Date(t.fechaEntrega).toLocaleDateString('es-CL')
        }

        const tags = `<div class="kanban-card-tags">
            <span class="kanban-card-estado" style="background:${colorCanal}">${labelCanal}</span>
            <span class="kanban-card-estado" style="background:${colorTipoEntrega}">${labelTipoEntrega}</span>
            ${columna === 2 && t.errorStock ? '<span class="kanban-card-estado" style="background:#dc3545">Error de Stock</span>' : ''}
            ${columna === 3 ? (t.estado === 'cancelada' || t.errorStock ? '<span class="kanban-card-estado" style="background:#dc3545">Anulado</span>' : '<span class="kanban-card-estado" style="background:#198754">Entregado</span>') : ''}
        </div>`

        // Primera linea de datos: Vendedor, fecha de compra
        const linea1 = `<div class="kanban-card-linea"><strong>Vendedor:</strong> ${vendedor} | <strong>Fecha compra:</strong> ${fechaCompra}</div>`

        // Segunda linea de datos: SKU, Material y características, cantidad (duplicada si es carrito con multiples items)
        const items = t.items && t.items.length > 0 
            ? t.items 
            : [{ sku: t.sku, materialNombre: t.materialNombre, cantidad: t.cantidad }]

        const linea2 = items.map(item => {
            const invItem = inventario.find(i => i.id === item.materialId || i.sku === item.sku)
            const matNombre = item.materialNombre || (invItem ? `${invItem.material} ${invItem.color} ${invItem.espesor}mm` : 'Material')
            return `<div class="kanban-card-linea"><strong>SKU:</strong> ${item.sku || '-'} | <strong>Material:</strong> ${matNombre} | <strong>Cant:</strong> ${item.cantidad} und</div>`
        }).join('')

        // Tercera linea de datos: Codigo unico de transaccion, Id del cliente, fecha de entrega
        let fechaEntregaDisplay = fechaEntregaStr
        if (columna === 3) {
            const fFinObj = t.fechaFin ? new Date(t.fechaFin) : (t.fechaCompletada ? new Date(t.fechaCompletada) : new Date())
            fechaEntregaDisplay = fFinObj.toLocaleDateString('es-CL')
        }
        const labelFechaCol3 = columna === 3 ? (t.estado === 'cancelada' || t.errorStock ? 'Fecha Anulado' : 'Fecha Entregado') : 'Fecha Entrega'
        const linea3 = `<div class="kanban-card-linea"><strong>Cod:</strong> ${codigoTrans} | <strong>ID Cli:</strong> ${clienteId} | <strong>${labelFechaCol3}:</strong> ${fechaEntregaDisplay}</div>`

        // Cuarta linea de datos (para columna 2 y 3): Encargado de la tarea
        const linea4 = `<div class="kanban-card-linea"><strong>Encargado:</strong> ${t.trabajadorAsignado || 'Sin asignar'}</div>`

        return { tags, linea1, linea2, linea3, linea4, clienteNombre, items, esInmediata, labelTipoEntrega }
    }

    // === COLUMNA 1: ENTRANTES ===
    const entrantes = tasks.filter(t => t.estado === 'pendiente' || t.estado === 'venta')

    // Ordenamiento por urgencia: inmediatas siempre primero, luego fecha de entrega mas proxima arriba
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
            `<button onclick="appBodegaAsignarTrabajador(${t.id}, '${nombre}')" style="font-size:0.7em;padding:3px 6px">${nombre}</button>`
        ).join('')

        return `
        <div class="kanban-card" style="border-left-color:#0d6efd">
            ${c.tags}
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
                <div style="display:flex;gap:3px;flex-wrap:wrap">${btnsAsignar}</div>
                <button onclick="appBodegaCancelar(${t.id})" style="background:var(--danger);font-size:0.75em;padding:3px 8px;margin-left:auto">Cancelar tarea</button>
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
            btns = `<button onclick="appBodegaIniciar(${t.id})" style="background:var(--success);font-size:0.8em;padding:4px 8px">Iniciar tarea</button>`
        } else if (timer && timer.completado) {
            btns = `<button onclick="appBodegaCompletar(${t.id})" style="background:var(--success);font-size:0.8em;padding:4px 8px">Entregar pedido</button>`
        } else {
            const durTotal = timer ? (timer.duracion || 10000) : 10000
            const restante = timer ? Math.max(0, Math.ceil((durTotal - (Date.now() - timer.inicio)) / 1000)) : 10
            const esDomicilio = t.tipoRetiro === 'domicilio'
            const msg = esDomicilio ? 'Enviando a domicilio' : 'Preparando entrega'
            btns = `<div class="kanban-timer" style="color:var(--accent);font-size:0.85em;font-weight:600">⏳ ${msg} (${restante}s)...</div>`
        }

        return `
        <div class="kanban-card" style="border-left-color:#fd7e14">
            ${c.tags}
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            ${c.linea4}
            <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
                <div>${btns}</div>
                <button onclick="appBodegaCancelar(${t.id})" style="background:var(--danger);font-size:0.75em;padding:3px 8px;margin-left:auto">Cancelar tarea</button>
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
        const colorLabel = esCancelada ? '#dc3545' : '#198754'

        return `
        <div class="kanban-card" style="border-left-color:${colorLabel};opacity:${esCancelada ? '0.75' : '1'}">
            ${c.tags}
            ${c.linea1}
            ${c.linea2}
            ${c.linea3}
            ${c.linea4}
            <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:flex-end">
                <button onclick="appBodegaArchivar(${t.id})" style="background:#6c757d;font-size:0.75em;padding:3px 8px">Archivar</button>
            </div>
        </div>`
    }).join('')

    colTerm.innerHTML = completadas.length === 0 ? '<div class="kanban-empty">Sin tareas entregadas</div>' : htmlTerm

    // Contadores
    document.getElementById('kanban-ent-count').textContent = entrantes.length
    document.getElementById('kanban-proc-count').textContent = enProceso.length
    document.getElementById('kanban-term-count').textContent = completadas.length

    if (typeof renderEnvioTareasBodega === 'function') {
        renderEnvioTareasBodega()
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
    const matNombre = `${item.material} ${item.color} ${item.espesor}mm`
// Determine priority based on stock level
    const prioridadAlert = item.stock === 0 ? 'alta' : (item.stock <= 5 ? 'media' : 'normal');

    // 1. Registrar tarea en Reposición
    const tarea = new Tarea(siguienteId(tareas), 'reposicion', item.id, item.sku, matNombre, cant, 'stock-bajo', `Solicitud desde inventario bodega. Stock actual: ${item.stock}`);
    tarea.prioridad = prioridadAlert;
    tarea.estado = 'enviada';
    tarea.asignadoA = 'proveedores';
    tarea.fuente = 'bodega';
    tarea.enviadoPor = 'Inventario';
    gestorTareas.agregarTarea(tarea);

    // 2. Agregar a la columna Envío Tareas de Bodega
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
    if (typeof renderReposicionKanban === 'function') renderReposicionKanban()
    alert(`📦 Solicitud de reposición registrada exitosamente para ${item.sku} (${cant} und).`)
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
                mainTask.prioridad = t.prioridad
            }

            // Acumular la cantidad requerida y fusionar detalles de notas
            mainTask.cantidad = (parseInt(mainTask.cantidad) || 0) + (parseInt(t.cantidad) || 0)
            if (t.notas && mainTask.notas && !mainTask.notas.includes(t.notas)) {
                mainTask.notas += ` | ${t.notas}`
            }

            // Eliminar el duplicado de la lista global de tareas
            const idxNew = tareas.findIndex(x => x.id === t.id)
            if (idxNew !== -1) tareas.splice(idxNew, 1)
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
        const pl = repoPrioridadLabel(t.prioridad)
        const fuente = t.fuente || t.origen || 'ventas'
        const enviadoPor = t.enviadoPor || t.trabajadorAsignado || 'Sistema'

        return `
        <div class="kanban-card" style="border-left-color:${pc}">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:${pc}">${pl}</span>
            </div>
            <div class="kanban-card-linea"><strong>Desde:</strong> ${fuente}</div>
            <div class="kanban-card-linea"><strong>Enviado por:</strong> ${enviadoPor}</div>
            <div class="kanban-card-linea"><strong>SKU:</strong> ${t.sku} | <strong>Mat:</strong> ${t.materialNombre} | <strong>Stock actual:</strong> ${stockActual} und</div>
            <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
                <button onclick="appRepoIniciarCompra(${t.id})" style="background:var(--success);font-size:0.8em;padding:4px 8px">Iniciar proceso de compra</button>
                <button onclick="appRepoCancelarTarea(${t.id})" style="background:var(--danger);font-size:0.75em;padding:3px 6px;margin-left:auto">Cancelar</button>
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
        const pl = repoPrioridadLabel(t.prioridad)
        const fuente = t.fuente || t.origen || 'ventas'
        const enviadoPor = t.enviadoPor || t.trabajadorAsignado || 'Sistema'
        const timer = timersRepo[t.id]

        const optionsProv = proveedores.map(p =>
            `<option value="${p.id}" ${t.proveedorId === p.id ? 'selected' : ''}>${p.nombre}</option>`
        ).join('')

        const cantActual = t.cantidadCompra || t.cantidad || 1
        const valUnit = t.valorUnidad || 0
        const netoCalc = valUnit * cantActual
        const ivaCalc = Math.round(netoCalc * IVA_PORCENTAJE)
        const totalCalc = netoCalc + ivaCalc

        // Calcular cantidad maxima comprable segun el dinero disponible del negocio
        const costoUnitarioConIva = valUnit > 0 ? valUnit * (1 + IVA_PORCENTAJE) : 1
        const maxComprable = Math.max(1, Math.floor(dineroDisponible / costoUnitarioConIva))

        // 1ª linea de datos: desde donde se envia por Nombre de quien envia
        const linea1 = `<div class="kanban-card-linea"><strong>Desde:</strong> ${fuente} <strong>por</strong> ${enviadoPor}</div>`
        
        // 2ª linea de datos: sku, Material y caracteristicas, cantidad en existencia
        const linea2 = `<div class="kanban-card-linea"><strong>${t.sku}</strong> ${t.materialNombre} | Stock: <strong>${stockActual}</strong> und</div>`
        
        // 3ª linea de datos: en blanco para generar limpieza visual
        const linea3Blank = `<div class="kanban-card-linea" style="height:6px"></div>`

        let contenidoForm = ''
        if (timer && timer.comprando) {
            const restante = Math.max(0, 10 - Math.ceil((Date.now() - timer.inicio) / 1000))
            contenidoForm = `
                <div style="text-align:center;padding:12px 0">
                    <div class="kanban-timer" style="color:var(--info);font-size:0.9em;font-weight:600">⏳ Negociando compra (${restante}s)...</div>
                </div>`
        } else if (timer && timer.compraListo) {
            contenidoForm = `
                <div class="kanban-card-linea"><strong>Proveedor:</strong> ${t.proveedorNombre || '-'} | <strong>Cantidad:</strong> ${cantActual} und</div>
                <div class="kanban-card-linea">Valor unit: <strong>${formatearCLP(valUnit)}</strong> | Stock prv: <strong>${t.stockProveedor || 0} und</strong></div>
                <div class="kanban-card-linea" style="height:6px"></div>
                <div class="kanban-card-linea">IVA: <strong>${formatearCLP(ivaCalc)}</strong></div>
                <div class="kanban-card-linea" style="font-weight:bold;font-size:0.9em;color:var(--success)">Total: <strong>${formatearCLP(totalCalc)}</strong></div>
                <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
                    <button onclick="appRepoRealizarCompra(${t.id})" style="background:var(--success);font-size:0.8em;padding:4px 10px">Realizar compra</button>
                    <button onclick="appRepoCancelarCompra(${t.id})" style="background:var(--danger);font-size:0.75em;padding:3px 6px;margin-left:auto">Cancelar</button>
                </div>`
        } else {
            contenidoForm = `
                <!-- 4ª linea de datos: input de proveedor + input de cantidad a pedir -->
                <div class="kanban-card-linea" style="display:flex;gap:6px;align-items:flex-end;margin-top:2px">
                    <div style="flex:2">
                        <label style="font-size:0.78em;color:var(--text-muted);display:block;margin:0">Proveedor
                            <select id="repo-prov-${t.id}" onchange="appRepoSelectProveedor(${t.id})" style="width:100%;font-size:0.82em;padding:4px;margin-top:2px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">
                                <option value="">Seleccionar...</option>
                                ${optionsProv}
                            </select>
                        </label>
                    </div>
                    <div style="flex:1">
                        <label style="font-size:0.78em;color:var(--text-muted);display:block;margin:0">Cantidad
                            <input type="number" id="repo-cant-${t.id}" value="${cantActual}" min="1" max="${Math.min(t.stockProveedor || 999, maxComprable)}" onchange="appRepoCalcTotal(${t.id})" oninput="appRepoCalcTotal(${t.id})" style="width:100%;font-size:0.82em;padding:4px;margin-top:2px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">
                        </label>
                    </div>
                </div>
                <!-- 5ª linea de datos: valor unidad y stock disponible del proveedor -->
                <div class="kanban-card-linea" style="margin-top:4px">Valor unit: <strong>${formatearCLP(valUnit)}</strong> | Stock prv: <strong>${t.stockProveedor || 0} und</strong></div>
                <!-- 6ª linea de datos: en blanco -->
                <div class="kanban-card-linea" style="height:6px"></div>
                <!-- 7ª linea de datos: iva -->
                <div class="kanban-card-linea">IVA: <strong>${formatearCLP(ivaCalc)}</strong></div>
                <!-- 8ª linea de datos: total de compra -->
                <div class="kanban-card-linea" style="font-weight:bold;font-size:0.9em;color:var(--accent)">Total: <strong>${formatearCLP(totalCalc)}</strong></div>
                
                <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
                    <button onclick="appRepoNegociarCompra(${t.id})" style="background:var(--info);color:#000;font-size:0.8em;padding:4px 8px" ${!t.proveedorId ? 'disabled style="background:#555;color:#888;cursor:not-allowed"' : ''}>Negociar compra</button>
                    <button onclick="appRepoCancelarCompra(${t.id})" style="background:var(--danger);font-size:0.75em;padding:3px 6px;margin-left:auto">Cancelar</button>
                </div>`
        }

        return `
        <div class="kanban-card" style="border-left-color:${pc}">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:${pc}">${pl}</span>
            </div>
            ${linea1}
            ${linea2}
            ${linea3Blank}
            ${contenidoForm}
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
        const provContacto = t.proveedorContacto || (proveedor ? `${proveedor.telefono} | ${proveedor.email}` : '-')
        const fechaCompraStr = t.fechaCompra ? new Date(t.fechaCompra).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL')
        const idCompra = t.codigoCompra || `C-${String(t.id).padStart(4, '0')}`
        const timer = timersRepo[t.id]

        let contenidoAccion = ''
        if (timer && timer.recibiendo) {
            const restante = Math.max(0, 10 - Math.ceil((Date.now() - timer.inicio) / 1000))
            const msg = restante > 5 ? '📦 Ingresando materiales a bodega' : '✅ Nuevo stock registrado'
            contenidoAccion = `
                <div style="text-align:center;padding:8px 0">
                    <div class="kanban-timer" style="color:var(--success);font-size:0.85em;font-weight:600">⏳ ${msg} (${restante}s)...</div>
                </div>`
        } else if (timer && timer.recibido || t.estado === 'completada') {
            contenidoAccion = `
                <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
                    <button onclick="appRepoArchivar(${t.id})" style="background:#6c757d;font-size:0.8em;padding:4px 8px">Archivar</button>
                    <button onclick="appRepoCancelarTarea(${t.id})" style="background:var(--danger);font-size:0.75em;padding:3px 6px;margin-left:auto">Cancelar</button>
                </div>`
        } else {
            contenidoAccion = `
                <div class="kanban-card-acciones" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
                    <button onclick="appRepoRecibirCompra(${t.id})" style="background:var(--success);font-size:0.8em;padding:4px 8px">Recepcionar compra</button>
                    <button onclick="appRepoCancelarTarea(${t.id})" style="background:var(--danger);font-size:0.75em;padding:3px 6px;margin-left:auto">Cancelar</button>
                </div>`
        }

        return `
        <div class="kanban-card" style="border-left-color:#0d6efd">
            <div class="kanban-card-tags">
                <span class="kanban-card-estado" style="background:#0d6efd">Compras</span>
            </div>
            <div class="kanban-card-linea"><strong>1. Proveedor:</strong> ${provNombre}</div>
            <div class="kanban-card-linea"><strong>2. Contacto:</strong> ${provContacto}</div>
            <div class="kanban-card-linea"><strong>3. SKU:</strong> ${t.sku} | <strong>Mat:</strong> ${t.materialNombre} | <strong>Cant:</strong> ${t.cantidadCompra || t.cantidad} und</div>
            <div class="kanban-card-linea"><strong>4. Fecha compra:</strong> ${fechaCompraStr}</div>
            <div class="kanban-card-linea"><strong>5. ID Compra:</strong> ${idCompra}</div>
            ${contenidoAccion}
        </div>`
    }).join('')

    colComp.innerHTML = compradas.length === 0 ? '<div class="kanban-empty">Sin compras pendientes</div>' : htmlComp

    // Contadores
    document.getElementById('repo-ent-count').textContent = entrantes.length
    document.getElementById('repo-proc-count').textContent = enProceso.length
    document.getElementById('repo-comp-count').textContent = compradas.length
}

/* ==================== FUNCIONES GLOBALES: FLUJO REPOSICION ==================== */
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

window.appRepoCalcTotal = function(tareaId) {
    const input = document.getElementById(`repo-cant-${tareaId}`)
    if (!input) return
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    let cant = parseInt(input.value) || 1

    // Validar con dinero disponible
    const dineroDisponible = tiendaConfig.dineroInicial !== undefined ? tiendaConfig.dineroInicial : 5000000
    const valUnit = tarea.valorUnidad || 0
    const costoUnitarioConIva = valUnit > 0 ? valUnit * (1 + IVA_PORCENTAJE) : 1
    const maxComprable = Math.max(1, Math.floor(dineroDisponible / costoUnitarioConIva))

    if (cant > maxComprable) {
        cant = maxComprable
        input.value = cant
        alert(`La cantidad ha sido limitada a ${maxComprable} unidades segun el dinero disponible del negocio (${formatearCLP(dineroDisponible)}).`)
    }

    tarea.cantidadCompra = cant
    const neto = valUnit * cant
    tarea.totalCompra = neto + Math.round(neto * IVA_PORCENTAJE)
    guardarTodo()
    renderReposicionKanban()
}

window.appRepoNegociarCompra = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea || !tarea.proveedorId) return

    const valUnit = tarea.valorUnidad || 0
    const neto = valUnit * (tarea.cantidadCompra || 1)
    tarea.totalCompra = neto + Math.round(neto * IVA_PORCENTAJE)

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

    const valUnit = tarea.valorUnidad || 0
    const cant = tarea.cantidadCompra || tarea.cantidad || 1
    const neto = valUnit * cant
    const totalCompra = neto + Math.round(neto * IVA_PORCENTAJE)

    const dineroDisponible = tiendaConfig.dineroInicial !== undefined ? tiendaConfig.dineroInicial : 5000000
    if (totalCompra > dineroDisponible) {
        alert(`Error: No hay suficiente dinero disponible en el negocio. Dinero disponible: ${formatearCLP(dineroDisponible)}, Total compra: ${formatearCLP(totalCompra)}`)
        return
    }

    // Descontar dinero al negocio
    tiendaConfig.dineroInicial = dineroDisponible - totalCompra

    tarea.totalCompra = totalCompra
    tarea.codigoCompra = `C-${String(tarea.id).padStart(4, '0')}`
    tarea.estado = 'comprada'
    tarea.fechaCompra = new Date().toISOString()

    if (timersRepo[tareaId]) {
        clearInterval(timersRepo[tareaId].intervalId)
        delete timersRepo[tareaId]
    }

    guardarTodo()
    renderReposicionKanban()
    alert(`🛒 Compra realizada exitosamente. Codigo de compra: ${tarea.codigoCompra}. Se descontaron ${formatearCLP(totalCompra)} del dinero del negocio.`)
}

window.appRepoRecibirCompra = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return
    if (timersRepo[tareaId]) clearInterval(timersRepo[tareaId].intervalId)

    timersRepo[tareaId] = {
        inicio: Date.now(),
        recibiendo: true,
        recibido: false,
        intervalId: setInterval(() => {
            const elapsed = Date.now() - timersRepo[tareaId].inicio
            if (elapsed >= 10000) {
                clearInterval(timersRepo[tareaId].intervalId)
                timersRepo[tareaId].recibiendo = false
                timersRepo[tareaId].recibido = true

                // Sumar nuevo stock al inventario
                const item = inventario.find(i => i.id === tarea.materialId || i.sku === tarea.sku)
                if (item) item.stock += (tarea.cantidadCompra || tarea.cantidad || 1)
                
                tarea.estado = 'completada'
                tarea.marcarCompletada()
                guardarTodo()
                renderRepoInventario()
            }
            renderReposicionKanban()
        }, 1000)
    }
    renderReposicionKanban()
}

window.appRepoCancelarCompra = function(tareaId) {
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

window.appRepoArchivar = function(tareaId) {
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

function renderListaProveedores() {
    const container = document.getElementById('lista-proveedores')
    if (!container) return

    if (proveedores.length === 0) {
        container.innerHTML = '<tr><td colspan="3" style="padding:12px;text-align:center;color:var(--text-muted)">Sin proveedores</td></tr>'
        return
    }

    container.innerHTML = proveedores.map(p => `
        <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 4px;font-size:0.8em;text-align:left;font-weight:bold">
                ${p.nombre}
                <div style="font-size:0.75em;color:var(--text-muted);font-weight:normal">${p.marcas || ''}</div>
            </td>
            <td style="padding:6px 4px;font-size:0.8em;text-align:center">
                ${p.contacto || '-'}<br>
                <small style="color:var(--text-muted)">${p.telefono || ''}</small>
            </td>
            <td style="padding:6px 4px;text-align:center">
                <button onclick="appRepoEditarProveedor(${p.id})" style="font-size:0.7em;background:var(--info);color:#000;padding:2px 4px">✏️</button>
                <button onclick="appRepoEliminarProveedor(${p.id})" style="font-size:0.7em;background:var(--danger);padding:2px 4px;margin-left:2px">🗑️</button>
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
    const table = tbody.closest('table')

    if (inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="padding:12px;text-align:center;color:var(--text-muted)">Sin datos</td></tr>'
        return
    }

    const sortKey = sessionStorage.getItem('repoInvSortKey') || 'stock'
    const sortDir = sessionStorage.getItem('repoInvSortKeyDir') || 'asc'
    const sorted = getSortedInventario(sortKey, sortDir)

    // Columnas clickeables: ID(0), SKU(1), Material(2), Marca(3), Color(4), Espesor(5), Stock(6), Precio(7)
    setupSortableHeaders(table, 'repoInvSortKey', renderRepoInventario, {0:'id',1:'sku',2:'material',3:'marca',4:'color',5:'espesor',6:'stock',7:'precio'})

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

    const items = tarea.items && tarea.items.length > 0 
        ? tarea.items 
        : [{ materialId: tarea.materialId, sku: tarea.sku, materialNombre: tarea.materialNombre, cantidad: tarea.cantidad }]

    // 1. Verificar si existe la cantidad de stock necesaria
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
        // ERROR DE STOCK!
        tarea.errorStock = true
        tarea.estado = 'cancelada'
        tarea.fechaFin = new Date().toISOString()

        const invItem = itemFaltante ? itemFaltante.inv : null
        const reqItem = itemFaltante ? itemFaltante.itemReq : items[0]
        const matNombre = reqItem.materialNombre || (invItem ? `${invItem.material} ${invItem.color}` : 'Material')
        const stockActual = invItem ? invItem.stock : 0

// Activar mensaje de alerta de stock
let prioridadAlert = 'alta';
if (invItem) {
  if (invItem.stock === 0) {
    prioridadAlert = 'alta'; // stock agotado
  } else if (invItem.stock < 5) {
    prioridadAlert = 'media'; // stock bajo
  } else {
    prioridadAlert = 'alta'; // still insufficient but treat as alta
  }
}
alertasStockPendientes.push({
    materialId: invItem ? invItem.id : reqItem.materialId,
    sku: reqItem.sku || (invItem ? invItem.sku : ''),
    materialNombre: matNombre,
    cantidad: reqItem.cantidad,
    prioridad: prioridadAlert,
    origen: 'stock-agotado',
    notas: `ERROR DE STOCK: Se necesitaban ${reqItem.cantidad} und, solo hay ${stockActual}. Venta #${tarea.ventaId || '?'} cancelada.`,
    ventaId: tarea.ventaId,
    enviadoPor: tarea.trabajadorAsignado || 'Bodega'
});

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
                    motivo: 'Error de stock en bodega',
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
        alert(`❌ Error de stock: Se requieren ${reqItem.cantidad} unidades de ${matNombre}, pero solo hay ${stockActual} en inventario. La tarea fue terminada inmediatamente, la venta fue cancelada y se realizó el reembolso.`)
        return
    }

    // 2. Si hay suficiente stock: descontar la cantidad a entregar del inventario durante la preparación
    if (!tarea.stockDescontado) {
        for (const it of items) {
            const itemInv = inventario.find(i => i.id === it.materialId || i.sku === it.sku)
            if (!itemInv) continue
            itemInv.stock -= it.cantidad

            // Si el stock baja a <= 5 ítems (y > 0) -> Mensaje NARANJA a reposición
            if (itemInv.stock <= 5 && itemInv.stock > 0) {
                const existente = alertasStockPendientes.find(a => a.materialId === itemInv.id)
                if (existente) {
                    existente.notas = `Stock bajo (${itemInv.stock} und restantes). Tarea #${tarea.id}`
                } else {
                    alertasStockPendientes.push({
                        materialId: itemInv.id,
                        sku: itemInv.sku,
                        materialNombre: `${itemInv.material} ${itemInv.color} ${itemInv.espesor}mm`,
                        cantidad: Math.max(1, STOCK_MINIMO + 1 - itemInv.stock),
                        prioridad: 'media',
                        origen: 'stock-bajo',
                        notas: `Stock bajo (${itemInv.stock} und restantes tras preparación). Tarea #${tarea.id}`,
                        ventaId: tarea.ventaId,
                        enviadoPor: tarea.trabajadorAsignado || 'Bodega'
                    })
                }
            }

            // Si el stock baja a 0 -> Mensaje ROJO a reposición
            if (itemInv.stock === 0) {
                const existente = alertasStockPendientes.find(a => a.materialId === itemInv.id)
                if (existente) {
                    existente.prioridad = 'urgente'
                    existente.notas = `Stock AGOTADO (0 und). Tarea #${tarea.id}`
                } else {
                    alertasStockPendientes.push({
                        materialId: itemInv.id,
                        sku: itemInv.sku,
                        materialNombre: `${itemInv.material} ${itemInv.color} ${itemInv.espesor}mm`,
                        cantidad: Math.max(1, STOCK_MINIMO + 1),
                        prioridad: 'urgente',
                        origen: 'stock-agotado',
                        notas: `Stock AGOTADO (0 und restantes tras preparación). Tarea #${tarea.id}`,
                        ventaId: tarea.ventaId,
                        enviadoPor: tarea.trabajadorAsignado || 'Bodega'
                    })
                }
            }
        }
        tarea.stockDescontado = true
    }

    tarea.estado = 'en_proceso'
    tarea.fechaInicio = new Date().toISOString()
    guardarTodo()

    // 3. Iniciar contador de 10s que representa el tiempo de preparación
    iniciarTimer(tareaId, 10000)
    renderBodegaKanban()
    renderBodegaInventario()
}

window.appBodegaCompletar = function(tareaId) {
    const tarea = tareas.find(t => t.id === tareaId)
    if (!tarea) return

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

window.appBodegaCancelar = function(tareaId) {
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
    setupSortableHeaders(table, 'invSortKey', renderTablaInventario, {0:'sku',1:'material',2:'stock',3:'precio'})

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


