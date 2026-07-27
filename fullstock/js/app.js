/* =============================================
   APP.JS - Navegacion por fetch, Login, Eventos
   ============================================= */

const contenido = document.getElementById('app-contenido')
const navCenter = document.getElementById('nav-center')
const navRight = document.getElementById('nav-right')
const btnLoginNav = document.getElementById('btn-login-nav')
const btnLogoutNav = document.getElementById('btn-logout-nav')

let seccionActual = null
let carritoVenta = []

/* ==================== NAVEGACION ==================== */
async function navegar(nombre) {
    if (!sesionActiva && nombre !== 'inicio') {
        alert('Inicia sesion primero')
        return
    }

    try {
        const resp = await fetch(`sections/${nombre}.html`)
        if (!resp.ok) throw new Error(`No se pudo cargar ${nombre}.html`)
        const html = await resp.text()
        contenido.innerHTML = html
        seccionActual = nombre

        // Resaltar link activo
        document.querySelectorAll('#nav-center a, #nav-right a').forEach(a => a.classList.remove('active'))
        const link = document.querySelector(`#nav-center [data-seccion="${nombre}"], #nav-right [data-seccion="${nombre}"]`)
        if (link) link.classList.add('active')

        // Renderizar contenido de la seccion
        renderSeccion(nombre)
    } catch (err) {
        contenido.innerHTML = `<p>Error cargando seccion: ${err.message}</p>`
    }
}

function renderSeccion(nombre) {
    switch (nombre) {
        case 'inicio': renderInicio(); break
        case 'venta': onRenderVenta(); break
        case 'bodega': onRenderBodega(); break
        case 'reposicion': onRenderReposicion(); break
        case 'inventario': onRenderInventario(); break
        case 'estadisticas': onRenderEstadisticas(); break
        case 'opciones': onRenderOpciones(); break
    }
}

/* ==================== INICIALIZACION ==================== */
async function inicializar() {
    const cargado = await cargarDatosJSON()
    if (!cargado) {
        alert('Error: No se pudo cargar la base de datos')
        return
    }

    cargarTheme()
    cargarEstadoInicial()
    actualizarNavbar()

    // Eventos del navbar
    navCenter.querySelectorAll('a[data-seccion]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault()
            navegar(a.dataset.seccion)
        })
    })
    navRight.querySelectorAll('a[data-seccion]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault()
            navegar(a.dataset.seccion)
        })
    })

    btnLoginNav.addEventListener('click', login)
    btnLogoutNav.addEventListener('click', logout)

    if (cargarSesion()) {
        sesionActiva = true
        btnLoginNav.classList.add('oculto')
        btnLogoutNav.classList.remove('oculto')
        navegar('inicio')
    } else {
        navegar('inicio')
    }
}

inicializar()

/* ==================== LOGIN ==================== */
function login() {
    const email = prompt('Email:', 'gerencia@construshop.cl')
    if (!email) return
    const password = prompt('Contrasena:')
    if (!password) return

    const usuario = validarCredenciales(email, password)
    if (usuario) {
        iniciarSesion(usuario)
        btnLoginNav.classList.add('oculto')
        btnLogoutNav.classList.remove('oculto')
        navegar('inicio')
        alert('Bienvenido ' + usuario.nombre)
    } else {
        alert('Credenciales incorrectas')
    }
}

function logout() {
    if (confirm('Cerrar sesion?')) {
        cerrarSesion()
        btnLogoutNav.classList.add('oculto')
        btnLoginNav.classList.remove('oculto')
        navegar('inicio')
    }
}

function actualizarNavbar() {
    if (sesionActiva) {
        document.getElementById('brand-app').innerHTML = `Full.Stock <small>| ${tiendaConfig.nombre}</small>`
    } else {
        document.getElementById('brand-app').textContent = 'Full.Stock'
    }
}

/* ==================== RENDER: INICIO ==================== */
function renderInicio() {
    actualizarNavbar()
}

/* ==================== RENDER: VENTA ==================== */
function onRenderVenta() {
    carritoVenta = []
    poblarSelectVenta()
    actualizarVendedorVenta()
    setTareaInactivo()
    renderVentas()
    renderCarritoVenta()

    const form = document.getElementById('form-venta')
    if (form) {
        form.removeEventListener('submit', onFormVentaSubmit)
        form.addEventListener('submit', onFormVentaSubmit)
    }

    const inputCantidad = document.getElementById('venta-cantidad')
    const selectMaterial = document.getElementById('venta-material')
    if (inputCantidad) inputCantidad.addEventListener('input', actualizarPreviewVenta)
    if (selectMaterial) selectMaterial.addEventListener('change', actualizarPreviewVenta)
}

function onFormVentaSubmit(e) {
    e.preventDefault()
    const cliente = document.getElementById('venta-cliente').value.trim()
    const materialId = document.getElementById('venta-material').value
    const cantidad = parseInt(document.getElementById('venta-cantidad').value)

    if (!cliente) { alert('Ingresa el nombre del cliente'); return }
    if (!materialId) { alert('Selecciona un material'); return }
    if (!cantidad || cantidad <= 0) { alert('Cantidad invalida'); return }

    const item = inventario.find(i => i.id === parseInt(materialId))
    if (!item) return

    const enCarrito = carritoVenta.filter(c => c.materialId === item.id).reduce((s, c) => s + c.cantidad, 0)
    if (cantidad + enCarrito > item.stock) {
        window._repoPendiente = { item, cantidad, cliente }

        const panel = document.getElementById('detalle-venta')
        const titulo = document.getElementById('detalle-titulo')
        const contenido = document.getElementById('detalle-contenido')
        const btn = document.getElementById('detalle-btn-accion')

        if (panel) { panel.style.opacity = '1'; panel.style.pointerEvents = 'auto' }
        if (titulo) { titulo.textContent = 'Sin Stock'; titulo.style.color = 'var(--danger)' }
        if (contenido) {
            contenido.innerHTML = `
                <div style="margin-bottom:6px"><strong>${item.material} ${item.color} ${item.espesor}mm</strong></div>
                <div style="font-size:0.9em;margin-bottom:4px">Stock: <strong>${item.stock}</strong> | Solicitado: <strong>${cantidad}</strong></div>
                <div style="font-size:0.85em;color:var(--text-muted)">Cliente: ${cliente}</div>
            `
        }
        if (btn) {
            btn.disabled = false
            btn.textContent = 'Enviar a Reposicion'
            btn.style.background = 'var(--danger)'
            btn.onclick = onDetalleEnviar
        }

        window._accionPendiente = 'reposicion'

        document.getElementById('venta-material').value = ''
        document.getElementById('venta-cantidad').value = ''
        document.getElementById('venta-stock-info').textContent = '0'
        document.getElementById('venta-precio-info').textContent = '$0'
        document.getElementById('venta-total-preview').textContent = '$0'
        return
    }

    // Stock OK → agregar al carrito
    const existente = carritoVenta.find(c => c.materialId === item.id)
    if (existente) {
        existente.cantidad += cantidad
    } else {
        carritoVenta.push({
            materialId: item.id,
            sku: item.sku,
            materialNombre: `${item.material} ${item.color} ${item.espesor}mm`,
            cantidad,
            precioUnitario: item.precio,
            stockActual: item.stock
        })
    }

    document.getElementById('venta-material').value = ''
    document.getElementById('venta-cantidad').value = ''
    document.getElementById('venta-stock-info').textContent = '0'
    document.getElementById('venta-precio-info').textContent = '$0'
    document.getElementById('venta-total-preview').textContent = '$0'

    renderCarritoVenta()
}

function enviarRepoDesdeAlerta() {
    const pendiente = window._repoPendiente
    if (!pendiente) return

    const nota = document.getElementById('detalle-nota') ? document.getElementById('detalle-nota').value.trim() : ''
    const { item, cantidad, cliente } = pendiente

    const tarea = new Tarea(siguienteId(tareas), 'reposicion', item.id, item.sku, `${item.material} ${item.color} ${item.espesor}mm`, cantidad, 'stock-agotado', `Cliente: ${cliente}. Necesita: ${cantidad} und.` + (nota ? ` | Nota: ${nota}` : ''))
    tarea.prioridad = 'urgente'
    tarea.estado = 'enviada'
    tarea.asignadoA = 'proveedores'
    tarea.fuente = 'ventas'
    tarea.enviadoPor = document.getElementById('venta-vendedor-label')?.textContent || 'Ventas'
    tareas.push(tarea)
    guardarTodo()

    setTareaAcumulada()
    document.getElementById('mensaje-enviado').textContent = `Reposicion enviada - ${item.material} ${item.color}`

    window._repoPendiente = null

    setTimeout(() => setTareaInactivo(), 2000)
}

function renderCarritoVenta() {
    const lista = document.getElementById('venta-carrito-lista')
    const countEl = document.getElementById('venta-carrito-count')
    const btnRealizar = document.getElementById('btn-realizar-venta')
    if (!lista) return

    if (carritoVenta.length === 0) {
        lista.innerHTML = '<div class="kanban-empty">Sin productos en el carrito</div>'
        if (countEl) countEl.textContent = '0'
        if (btnRealizar) btnRealizar.disabled = true
        document.getElementById('venta-neto-total').textContent = '$0'
        document.getElementById('venta-iva-total').textContent = '$0'
        document.getElementById('venta-gran-total').textContent = '$0'
        return
    }

    if (countEl) countEl.textContent = carritoVenta.length

    lista.innerHTML = carritoVenta.map((c, idx) => {
        const totalItem = c.precioUnitario * c.cantidad
        return `
            <div style="padding:6px;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                        <div style="font-size:0.9em"><strong>${c.sku}</strong> ${c.materialNombre}</div>
                        <div style="font-size:0.8em;color:var(--text-muted)">${c.cantidad} und x ${formatearCLP(c.precioUnitario)}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-weight:bold">${formatearCLP(totalItem)}</div>
                        <button onclick="appVentaQuitarDelCarrito(${idx})" style="font-size:0.7em;background:var(--danger);margin-top:2px">X</button>
                    </div>
                </div>
            </div>
        `
    }).join('')

    const netoTotal = carritoVenta.reduce((sum, c) => sum + Math.round((c.precioUnitario * c.cantidad) / 1.19), 0)
    const ivaTotal = carritoVenta.reduce((sum, c) => sum + (c.precioUnitario * c.cantidad) - Math.round((c.precioUnitario * c.cantidad) / 1.19), 0)
    const granTotal = carritoVenta.reduce((sum, c) => sum + c.precioUnitario * c.cantidad, 0)

    document.getElementById('venta-neto-total').textContent = formatearCLP(netoTotal)
    document.getElementById('venta-iva-total').textContent = formatearCLP(ivaTotal)
    document.getElementById('venta-gran-total').textContent = formatearCLP(granTotal)

    if (btnRealizar) {
        btnRealizar.disabled = false
        btnRealizar.onclick = onRealizarVenta
    }
}

window.appVentaQuitarDelCarrito = function(idx) {
    carritoVenta.splice(idx, 1)
    renderCarritoVenta()
}

function onRealizarVenta() {
    if (carritoVenta.length === 0) return

    const cliente = document.getElementById('venta-cliente').value.trim()
    if (!cliente) { alert('Ingresa el nombre del cliente'); return }

    // Preparar resumen para Columna 3
    const granTotal = carritoVenta.reduce((sum, c) => sum + c.precioUnitario * c.cantidad, 0)
    const panel = document.getElementById('detalle-venta')
    const titulo = document.getElementById('detalle-titulo')
    const contenido = document.getElementById('detalle-contenido')
    const btn = document.getElementById('detalle-btn-accion')

    if (panel) { panel.style.opacity = '1'; panel.style.pointerEvents = 'auto' }
    if (titulo) { titulo.textContent = 'Confirmar Envio'; titulo.style.color = 'var(--success)' }
    if (contenido) {
        contenido.innerHTML = `
            <div><strong>Cliente:</strong> ${cliente}</div>
            <div><strong>Productos:</strong> ${carritoVenta.length}</div>
            <div><strong>Total:</strong> ${formatearCLP(granTotal)}</div>
            <div style="margin-top:6px;font-size:0.85em;color:var(--text-muted)">Presiona Enviar para confirmar la venta y enviar a bodega.</div>
        `
    }
    if (btn) {
        btn.disabled = false
        btn.textContent = 'Enviar'
        btn.style.background = 'var(--success)'
        btn.onclick = onDetalleEnviar
    }

    window._ventaPendiente = {
        cliente,
        items: [...carritoVenta],
        total: granTotal
    }
    window._accionPendiente = 'venta'
}

function onDetalleEnviar() {
    if (window._accionPendiente === 'venta') {
        enviarVentaPendiente()
    } else if (window._accionPendiente === 'reposicion') {
        enviarRepoDesdeAlerta()
    }
}

function enviarVentaPendiente() {
    const pendiente = window._ventaPendiente
    if (!pendiente) return

    const nota = document.getElementById('detalle-nota') ? document.getElementById('detalle-nota').value.trim() : ''
    const vendedor = usuarioActual ? usuarioActual.nombre : 'Gerente'
    const fecha = new Date().toISOString()
    const ventaId = siguienteId(ventas)

    pendiente.items.forEach(c => {
        const total = c.precioUnitario * c.cantidad
        const neto = Math.round(total / 1.19)
        const iva = total - neto
        ventas.push({
            id: siguienteId(ventas), fecha, cliente: pendiente.cliente,
            materialId: c.materialId, sku: c.sku,
            materialNombre: c.materialNombre,
            cantidad: c.cantidad, precioUnitario: c.precioUnitario,
            neto, iva, total, vendedor, canal: 'local', estado: 'completada',
            ventaGroupId: ventaId
        })
    })

    if (pendiente.cliente) {
        const existente = clientes.find(c => c.nombre === pendiente.cliente)
        if (!existente) {
            const maxId = clientes.length > 0 ? Math.max(...clientes.map(c => c.id)) : 0
            clientes.push({
                id: maxId + 1,
                nombre: pendiente.cliente,
                rut: 'CLI-' + String(maxId + 1).padStart(4, '0'),
                email: '-',
                telefono: '-',
                saldo: 0
            })
        }
    }

    const notasTarea = `Entregar a: ${pendiente.cliente}` + (nota ? ` | Nota: ${nota}` : '')
    const primerItem = pendiente.items[0]
    const tarea = new Tarea(siguienteId(tareas), 'entrega', primerItem.materialId, primerItem.sku, primerItem.materialNombre, primerItem.cantidad, 'venta', notasTarea)
    tarea.asignadoA = 'bodega'
    tarea.ventaId = ventaId
    tarea.items = pendiente.items.map(c => ({
        materialId: c.materialId, sku: c.sku,
        materialNombre: c.materialNombre, cantidad: c.cantidad,
        precioUnitario: c.precioUnitario
    }))
    tarea.vendedor = vendedor
    tarea.fechaCompra = fecha
    tarea.canal = 'local'
    tarea.tipoRetiro = 'local'
    tarea.cliente = pendiente.cliente
    tareas.push(tarea)

    guardarTodo()
    renderVentas()

    setTareaAcumulada()
    document.getElementById('mensaje-enviado').textContent = 'Venta realizada - ' + formatearCLP(pendiente.total)

    window._ventaPendiente = null
    window._accionPendiente = null
    carritoVenta = []
    renderCarritoVenta()
    document.getElementById('venta-cliente').value = ''
    document.getElementById('venta-material').value = ''
    document.getElementById('venta-cantidad').value = ''
    document.getElementById('venta-stock-info').textContent = '0'
    document.getElementById('venta-precio-info').textContent = '$0'
    document.getElementById('venta-total-preview').textContent = '$0'

    setTimeout(function() { setTareaInactivo() }, 2000)
}

/* ==================== RENDER: BODEGA ==================== */
function onRenderBodega() {
    renderBodegaKanban()
    renderBodegaInventario()

    const inputB = document.getElementById('input-busqueda-bodega')
    if (inputB) {
        inputB.removeEventListener('keyup', onBusquedaBodegaKeyup)
        inputB.addEventListener('keyup', onBusquedaBodegaKeyup)
    }
}

function onBusquedaBodegaKeyup() {
    renderBodegaKanban()
}

/* ==================== RENDER: REPOSICION ==================== */
function onRenderReposicion() {
    renderReposicionKanban()
    renderListaProveedores()
    renderRepoInventario()

    const inputR = document.getElementById('input-busqueda-reposicion')
    if (inputR) {
        inputR.removeEventListener('keyup', onBusquedaReposicionKeyup)
        inputR.addEventListener('keyup', onBusquedaReposicionKeyup)
    }
}

function onBusquedaReposicionKeyup() {
    renderReposicionKanban()
}

/* ==================== RENDER: INVENTARIO ==================== */
function onRenderInventario() {
    renderStatsInventario()
    renderTablaInventario()
    renderStatsReportes()
    renderDetalleReportes()

    const btnAdd = document.getElementById('btn-add-material')
    if (btnAdd) btnAdd.addEventListener('click', onAddMaterial)
}

function onAddMaterial() {
    const tipo = prompt('Tipo de material (Melamina, MDF, Terciado, Durolac, OSB):')
    if (!tipo) return
    const marca = prompt('Marca:')
    if (!marca) return
    const espesor = prompt('Espesor (mm):')
    if (!espesor) return
    const color = prompt('Color:')
    if (!color) return
    const stock = prompt('Stock inicial:')
    if (!stock) return
    const precio = prompt('Precio con IVA:')
    if (!precio) return

    const prefijos = { 'Melamina': 'MEL', 'MDF': 'MDF', 'Terciado': 'TER', 'Durolac': 'DUR', 'OSB': 'OSB' }
    const prefijo = prefijos[tipo] || 'OTR'
    const nuevoId = siguienteId(inventario)
    const numStr = String(nuevoId).padStart(3, '0')

    inventario.push({
        id: nuevoId,
        sku: `${prefijo}-${numStr}`,
        material: tipo,
        marca,
        espesor: parseInt(espesor),
        color,
        stock: parseInt(stock),
        precio: parseInt(precio)
    })
    guardarTodo()
    renderTablaInventario()
    renderStatsInventario()
    alert('Material agregado al inventario')
}

/* ==================== RENDER: OPCIONES ==================== */
function onRenderOpciones() {
    document.getElementById('opt-nombre-tienda').value = tiendaConfig.nombre || ''
    document.getElementById('opt-direccion').value = tiendaConfig.direccion || ''
    document.getElementById('opt-email').value = tiendaConfig.email || ''

    const formTienda = document.getElementById('form-tienda')
    if (formTienda) {
        formTienda.addEventListener('submit', function(e) {
            e.preventDefault()
            tiendaConfig.nombre = document.getElementById('opt-nombre-tienda').value
            tiendaConfig.direccion = document.getElementById('opt-direccion').value
            tiendaConfig.email = document.getElementById('opt-email').value
            guardarTodo()
            actualizarNavbar()
            alert('Datos de la tienda actualizados')
        })
    }

    const formUsuario = document.getElementById('form-usuario')
    if (formUsuario) {
        formUsuario.addEventListener('submit', function(e) {
            e.preventDefault()
            const tema = document.getElementById('opt-tema').value
            document.documentElement.setAttribute('data-theme', tema)
            sessionStorage.setItem('fs_theme', tema)
            alert('Tema actualizado')
        })
    }

    const btnReset = document.getElementById('btn-reset-datos')
    if (btnReset) {
        btnReset.addEventListener('click', function() {
            if (!confirm('Resetear todos los datos? Se cargaran los datos originales de la base.')) return
            sessionStorage.removeItem('fs_inventario')
            sessionStorage.removeItem('fs_ventas')
            sessionStorage.removeItem('fs_bodega')
            sessionStorage.removeItem('fs_tareas')
            sessionStorage.removeItem('fs_proveedores')
            sessionStorage.removeItem('fs_tienda')
            cargarEstadoInicial()
            navegar('inicio')
            alert('Datos reseteados')
        })
    }
}

/* ==================== ESTADISTICAS ==================== */
function showEstTab(tab, evt) {
    document.querySelectorAll('.est-tab').forEach(el => el.style.display = 'none')
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'))
    const panel = document.getElementById('tab-' + tab)
    if (panel) panel.style.display = 'block'
    if (evt && evt.target) evt.target.classList.add('active')
}

function onRenderEstadisticas() {
    estRenderMetricas()
    estRenderVentas()
    estRenderEntregas()
    estRenderAnulados()
    estRenderReembolsos()
    estRenderEmpleados()
    estRenderClientes()
    estRenderArchivos()
    estRenderInventarioPrecios()
    estRenderProvHistorial()
}

function estRenderMetricas() {
    const ingresos = ventas.filter(v => v.estado === 'completada').reduce((s, v) => s + v.total, 0)
    const egresos = alertasStockPendientes.length * 5000 + tareas.filter(t => t.tipo === 'reposicion' && t.estado === 'comprada').reduce((s, t) => s + (t.totalCompra || 0), 0)
    const reembolsos = ventasAnuladas.reduce((s, v) => s + (v.montoReembolso || 0), 0)
    const dinero = (tiendaConfig.dineroInicial || 0) + ingresos - egresos - reembolsos
    const margenGanancia = ingresos > 0 ? Math.round(((ingresos - egresos) / ingresos) * 100) : 0
    const margenPerdida = egresos > 0 ? Math.round((reembolsos / egresos) * 100) : 0

    const el = (id) => document.getElementById(id)
    if (el('est-dinero')) el('est-dinero').textContent = formatearCLP(dinero)
    if (el('est-egresos')) el('est-egresos').textContent = formatearCLP(egresos)
    if (el('est-ingresos')) el('est-ingresos').textContent = formatearCLP(ingresos)
    if (el('est-margen-ganancia')) el('est-margen-ganancia').textContent = margenGanancia + '%'
    if (el('est-margen-perdida')) el('est-margen-perdida').textContent = margenPerdida + '%'
}

function estRenderVentas() {
    const tbody = document.getElementById('est-ventas-lista')
    if (!tbody) return
    if (ventas.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">Sin ventas</td></tr>'; return }
    tbody.innerHTML = ventas.map(v => {
        const estado = v.estado === 'completada' ? '<span style="background:var(--success);color:#fff;padding:1px 5px;border-radius:3px;font-size:0.75em">Completada</span>' : '<span style="background:var(--danger);color:#fff;padding:1px 5px;border-radius:3px;font-size:0.75em">Anulada</span>'
        return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.id}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${new Date(v.fecha).toLocaleDateString('es-CL')}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.cliente}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.vendedor}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.materialNombre || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.cantidad}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${formatearCLP(v.total)}</td>
            <td style="padding:6px 8px;text-align:center">${estado}</td>
        </tr>`
    }).join('')
}

function estRenderEntregas() {
    const tbody = document.getElementById('est-entregas-lista')
    if (!tbody) return
    const entregas = tareas.filter(t => t.tipo === 'entrega' && t.estado === 'completada')
    if (entregas.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">Sin entregas</td></tr>'; return }
    tbody.innerHTML = entregas.map(t => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">V-${String(t.ventaId || 0).padStart(4, '0')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.cliente || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.materialNombre}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.cantidad}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.trabajadorAsignado || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.fechaInicio ? new Date(t.fechaInicio).toLocaleDateString('es-CL') : '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.fechaFin ? new Date(t.fechaFin).toLocaleDateString('es-CL') : '-'}</td>
    </tr>`).join('')
}

function estRenderAnulados() {
    const tbody = document.getElementById('est-anulados-lista')
    if (!tbody) return
    if (ventasAnuladas.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">Sin anulados</td></tr>'; return }
    tbody.innerHTML = ventasAnuladas.map(v => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">V-${String(v.ventaOriginalId || 0).padStart(4, '0')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${new Date(v.fecha).toLocaleDateString('es-CL')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.cliente}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.materialNombre}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.cantidad}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--danger)">${formatearCLP(v.montoReembolso || 0)}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.motivo}</td>
    </tr>`).join('')
}

function estRenderReembolsos() {
    const tbody = document.getElementById('est-reembolsos-lista')
    if (!tbody) return
    if (ventasAnuladas.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text-muted)">Sin reembolsos</td></tr>'; return }
    tbody.innerHTML = ventasAnuladas.map(v => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">V-${String(v.ventaOriginalId || 0).padStart(4, '0')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.cliente}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--danger)">${formatearCLP(v.montoReembolso || 0)}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${new Date(v.fecha).toLocaleDateString('es-CL')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.motivo}</td>
    </tr>`).join('')
}

function estRenderEmpleados() {
    const tbody = document.getElementById('est-empleados-lista')
    if (!tbody) return
    const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    if (empleados.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:12px;color:var(--text-muted)">Sin empleados</td></tr>'; return }
    tbody.innerHTML = empleados.map((e, i) => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${e.nombre} ${e.apellido}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center"><span style="background:var(--info);color:#000;padding:1px 5px;border-radius:3px;font-size:0.75em">${e.rol}</span></td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.email}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.telefono}</td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estEditarEmpleado(${i})" style="font-size:0.75em;background:var(--info);color:#000;padding:3px 6px">Editar</button></td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estDespedirEmpleado(${i})" style="font-size:0.75em;background:var(--danger);padding:3px 6px">X</button></td>
    </tr>`).join('')
}

function estRenderClientes() {
    const tbody = document.getElementById('est-clientes-lista')
    if (!tbody) return
    if (clientes.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">Sin clientes</td></tr>'; return }
    tbody.innerHTML = clientes.map((c, i) => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.id || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${c.nombre}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.rut}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.email || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.telefono || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:${c.saldo > 0 ? 'var(--success)' : 'var(--danger)'}">${formatearCLP(c.saldo || 0)}</td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estEditarCliente(${i})" style="font-size:0.75em;background:var(--info);color:#000;padding:3px 6px">Editar</button></td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estEliminarCliente(${i})" style="font-size:0.75em;background:var(--danger);padding:3px 6px">X</button></td>
    </tr>`).join('')
}

window.estAbrirFormCliente = function(idx) {
    const modal = document.getElementById('modal-cliente')
    if (!modal) return
    if (idx !== undefined) {
        const c = clientes[idx]
        if (!c) return
        document.getElementById('cli-form-titulo').textContent = 'Editar Cliente'
        document.getElementById('cli-form-idx').value = idx
        document.getElementById('cli-form-nombre').value = c.nombre
        document.getElementById('cli-form-rut').value = c.rut || ''
        document.getElementById('cli-form-email').value = c.email || ''
        document.getElementById('cli-form-telefono').value = c.telefono || ''
    } else {
        document.getElementById('cli-form-titulo').textContent = 'Registrar Cliente'
        document.getElementById('cli-form-idx').value = ''
        document.getElementById('cli-form-nombre').value = ''
        document.getElementById('cli-form-rut').value = ''
        document.getElementById('cli-form-email').value = ''
        document.getElementById('cli-form-telefono').value = ''
    }
    modal.style.display = 'flex'
}

window.estCerrarFormCliente = function() {
    const modal = document.getElementById('modal-cliente')
    if (modal) modal.style.display = 'none'
}

window.estGuardarCliente = function() {
    const idx = document.getElementById('cli-form-idx').value
    const nombre = document.getElementById('cli-form-nombre').value.trim()
    const rut = document.getElementById('cli-form-rut').value.trim()
    const email = document.getElementById('cli-form-email').value.trim()
    const telefono = document.getElementById('cli-form-telefono').value.trim()
    if (!nombre) { alert('Ingrese el nombre'); return }
    if (idx !== '') {
        const c = clientes[parseInt(idx)]
        if (c) { c.nombre = nombre; c.rut = rut; c.email = email; c.telefono = telefono }
    } else {
        const maxId = clientes.length > 0 ? Math.max(...clientes.map(c => c.id)) : 0
        clientes.push({ id: maxId + 1, nombre, rut, email, telefono, saldo: 0 })
    }
    guardarTodo()
    estRenderClientes()
    estCerrarFormCliente()
}

window.estEditarCliente = function(idx) {
    estAbrirFormCliente(idx)
}

window.estEliminarCliente = function(idx) {
    if (!confirm('Eliminar cliente?')) return
    clientes.splice(idx, 1)
    guardarTodo()
    estRenderClientes()
}

function estRenderArchivos() {
    const tbodyE = document.getElementById('est-arch-entregas')
    const tbodyC = document.getElementById('est-arch-compras')
    const archEnt = tareas.filter(t => t.tipo === 'entrega' && t.estado === 'completada')
    const archComp = tareas.filter(t => t.tipo === 'reposicion' && t.estado === 'completada')

    if (tbodyE) {
        if (archEnt.length === 0) { tbodyE.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text-muted)">Sin archivos</td></tr>' }
        else {
            tbodyE.innerHTML = archEnt.map(t => `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.id}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">V-${String(t.ventaId || 0).padStart(4, '0')}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.fechaFin ? new Date(t.fechaFin).toLocaleDateString('es-CL') : '-'}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.materialNombre}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.trabajadorAsignado || '-'}</td>
            </tr>`).join('')
        }
    }
    if (tbodyC) {
        if (archComp.length === 0) { tbodyC.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text-muted)">Sin archivos</td></tr>' }
        else {
            tbodyC.innerHTML = archComp.map(t => `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.codigoCompra || `C-${String(t.id).padStart(4, '0')}`}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.proveedorNombre || '-'}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.fechaCompra ? new Date(t.fechaCompra).toLocaleDateString('es-CL') : '-'}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.materialNombre}</td>
                <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${formatearCLP(t.totalCompra || 0)}</td>
            </tr>`).join('')
        }
    }
}

function estRenderInventarioPrecios() {
    const tbody = document.getElementById('est-inv-precios')
    if (!tbody) return
    tbody.innerHTML = inventario.map(item => {
        const margen = item.margen || 30
        const iva = Math.round(item.precio * IVA_PORCENTAJE)
        const precioVenta = item.precio + Math.round(item.precio * margen / 100) + iva
        return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.sku}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.material}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.marca || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:${item.stock === 0 ? 'var(--danger)' : item.stock <= STOCK_MINIMO ? 'var(--warning)' : 'var(--success)'}">${item.stock}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${formatearCLP(item.precio)}</td>
            <td style="padding:6px 8px;text-align:center"><input type="number" value="${margen}" min="0" max="100" onchange="estUpdateMargen(${item.id}, this.value)" style="width:60px;text-align:center;padding:3px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)"></td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${formatearCLP(iva)}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--success)">${formatearCLP(precioVenta)}</td>
        </tr>`
    }).join('')
}

window.estUpdateMargen = function(itemId, value) {
    const item = inventario.find(i => i.id === itemId)
    if (!item) return
    item.margen = parseInt(value) || 0
    guardarTodo()
    estRenderInventarioPrecios()
}

function estRenderProvHistorial() {
    const tbody = document.getElementById('est-prov-historial')
    if (!tbody) return
    const compras = tareas.filter(t => t.tipo === 'reposicion' && ['comprada', 'completada'].includes(t.estado))
    if (proveedores.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text-muted)">Sin proveedores</td></tr>'; return }
    tbody.innerHTML = proveedores.map(p => {
        const comps = compras.filter(t => t.proveedorId === p.id)
        const total = comps.reduce((s, t) => s + (t.totalCompra || 0), 0)
        return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.id}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${p.nombre}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.contacto || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.telefono || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${comps.length}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${formatearCLP(total)}</td>
        </tr>`
    }).join('')
}

window.estAbrirFormEmpleado = function() {
    const modal = document.getElementById('modal-empleado')
    if (modal) {
        document.getElementById('emp-form-titulo').textContent = 'Contratar Empleado'
        document.getElementById('emp-form-idx').value = ''
        document.getElementById('emp-form-nombre').value = ''
        document.getElementById('emp-form-rol').value = 'vendedor'
        document.getElementById('emp-form-email').value = ''
        document.getElementById('emp-form-telefono').value = ''
        modal.style.display = 'flex'
    }
}

window.estCerrarFormEmpleado = function() {
    const modal = document.getElementById('modal-empleado')
    if (modal) modal.style.display = 'none'
}

window.estGuardarEmpleado = function() {
    const idx = document.getElementById('emp-form-idx').value
    const nombre = document.getElementById('emp-form-nombre').value.trim()
    const rol = document.getElementById('emp-form-rol').value
    const email = document.getElementById('emp-form-email').value.trim()
    const telefono = document.getElementById('emp-form-telefono').value.trim()
    if (!nombre) { alert('Ingrese el nombre'); return }
    const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    if (idx !== '') {
        const emp = empleados[parseInt(idx)]
        if (emp) {
            emp.nombre = nombre
            emp.rol = rol.charAt(0).toUpperCase() + rol.slice(1)
            emp.email = email
            emp.telefono = telefono
        }
    } else {
        const nuevoId = empleados.length > 0 ? Math.max(...empleados.map(e => e.id)) + 1 : 1
        empleados.push({
            id: nuevoId, nombre, apellido: '', email,
            password: nombre.toLowerCase() + '123',
            rut: '-', cumpleanos: '-',
            rol: rol.charAt(0).toUpperCase() + rol.slice(1),
            telefono
        })
        if (datosJSON && datosJSON.perfiles) datosJSON.perfiles.empleados = empleados
    }
    guardarTodo()
    estRenderEmpleados()
    estCerrarFormEmpleado()
}

window.estEditarEmpleado = function(idx) {
    const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    const emp = empleados[idx]
    if (!emp) return
    const modal = document.getElementById('modal-empleado')
    if (modal) {
        document.getElementById('emp-form-titulo').textContent = 'Editar Empleado'
        document.getElementById('emp-form-idx').value = idx
        document.getElementById('emp-form-nombre').value = emp.nombre
        document.getElementById('emp-form-rol').value = emp.rol.toLowerCase()
        document.getElementById('emp-form-email').value = emp.email || ''
        document.getElementById('emp-form-telefono').value = emp.telefono || ''
        modal.style.display = 'flex'
    }
}

window.estDespedirEmpleado = function(idx) {
    const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    const emp = empleados[idx]
    if (!emp) return
    if (!confirm(`Despedir a ${emp.nombre} ${emp.apellido}?`)) return
    empleados.splice(idx, 1)
    if (datosJSON && datosJSON.perfiles) datosJSON.perfiles.empleados = empleados
    guardarTodo()
    estRenderEmpleados()
}

/* ==================== MÓDULO 4: EVENTOS DOM, ASINCRONÍA Y CONSUMO API ==================== */

// MODAL NUEVA TAREA
window.abrirModalNuevaTarea = function(tipoDefault = 'entrega') {
    const modal = document.getElementById('modal-nueva-tarea')
    if (!modal) return
    const selectTipo = document.getElementById('nt-tipo')
    if (selectTipo) selectTipo.value = tipoDefault
    modal.style.display = 'flex'
}

window.cerrarModalNuevaTarea = function() {
    const modal = document.getElementById('modal-nueva-tarea')
    if (modal) modal.style.display = 'none'
}

// NOTIFICACIONES ASINCRÓNICAS (SETTIMEOUT 2s)
window.mostrarNotificacionAsync = function(mensaje, tipo = 'success') {
    const container = document.getElementById('app-notifications')
    if (!container) return

    const toast = document.createElement('div')
    toast.style.background = tipo === 'success' ? '#198754' : tipo === 'error' ? '#dc3545' : '#0dcaf0'
    toast.style.color = '#fff'
    toast.style.padding = '12px 18px'
    toast.style.borderRadius = '8px'
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)'
    toast.style.fontWeight = '600'
    toast.style.fontSize = '0.9em'
    toast.style.transition = 'all 0.3s ease'
    toast.innerHTML = `🔔 Notificacion (2s Delay): ${mensaje}`

    container.appendChild(toast)

    setTimeout(() => {
        toast.style.opacity = '0'
        setTimeout(() => toast.remove(), 300)
    }, 4000)
}

// CONSUMO DE API EXTERNA CON FETCH Y TRY/CATCH
window.sincronizarConAPIExterna = async function() {
    try {
        mostrarNotificacionAsync('Iniciando peticion GET a API JSONPlaceholder...', 'info')
        const tareasNuevas = await gestorTareas.recuperarDeAPI()
        
        // Notificación asincrónica tras 2 segundos (setTimeout)
        setTimeout(() => {
            mostrarNotificacionAsync(`¡Sincronizacion Exitosa! ${tareasNuevas.length} tareas importadas desde API.`, 'success')
            if (seccionActual === 'bodega') renderBodegaKanban()
            if (seccionActual === 'reposicion') renderReposicionKanban()
        }, 2000)
    } catch (err) {
        console.error('Error al sincronizar con API:', err)
        mostrarNotificacionAsync(`Error al conectar con API externa: ${err.message}`, 'error')
    }
}

// CONFIGURACIÓN DEL FORMULARIO NUEVA TAREA (SUBMIT, RETARDO SETTIMEOUT 1.5s + NOTIF 2s)
function configurarFormularioNuevaTarea() {
    const form = document.getElementById('form-nueva-tarea')
    if (!form) return

    form.addEventListener('submit', async (e) => {
        e.preventDefault()

        const tipo = document.getElementById('nt-tipo').value
        const materialNombre = document.getElementById('nt-material').value
        const cantidad = document.getElementById('nt-cantidad').value
        const prioridad = document.getElementById('nt-prioridad').value
        const fechaLimite = document.getElementById('nt-fecha-limite').value
        const notas = document.getElementById('nt-notas').value

        const btnSubmit = document.getElementById('nt-btn-submit')
        const spinner = document.getElementById('nt-spinner')

        if (btnSubmit) btnSubmit.disabled = true
        if (spinner) spinner.style.display = 'block'

        // 1. Simular retardo con setTimeout (1.5 segundos)
        setTimeout(async () => {
            const nuevaTarea = new Tarea(
                siguienteId(tareas),
                tipo,
                1,
                `MAN-${Date.now().toString().slice(-4)}`,
                materialNombre,
                parseInt(cantidad) || 1,
                'manual',
                notas
            )
            nuevaTarea.prioridad = prioridad
            if (fechaLimite) nuevaTarea.fechaLimite = new Date(fechaLimite).toISOString()

            // POO GestorTareas
            gestorTareas.agregarTarea(nuevaTarea)

            // API POST (fetch)
            try {
                await gestorTareas.guardarEnAPI(nuevaTarea)
            } catch (err) {
                console.warn('No se pudo hacer POST a API, guardado local exitoso.', err)
            }

            if (spinner) spinner.style.display = 'none'
            if (btnSubmit) btnSubmit.disabled = false
            cerrarModalNuevaTarea()
            form.reset()

            if (seccionActual === 'bodega') renderBodegaKanban()
            if (seccionActual === 'reposicion') renderReposicionKanban()

            // 2. Notificación asincrónica tras 2 segundos (setTimeout)
            setTimeout(() => {
                mostrarNotificacionAsync(`Tarea POO #${nuevaTarea.id} ("${nuevaTarea.materialNombre}") creada con exito.`, 'success')
            }, 2000)

        }, 1500)
    })
}

// TIMER REGRESIVO CONTINUO (SETINTERVAL 1s)
setInterval(() => {
    document.querySelectorAll('.kanban-countdown').forEach(el => {
        const tareaId = el.getAttribute('data-tarea-id')
        if (!tareaId) return
        const tarea = gestorTareas.obtenerTareaPorId(tareaId)
        if (tarea && tarea.fechaLimite) {
            const info = tarea.obtenerTiempoRestante()
            if (info) {
                if (info.expirado) {
                    el.innerHTML = `<span style="color:#ff4d4d;font-weight:bold;font-size:0.75em">🔴 Expirada</span>`
                } else {
                    const h = String(info.horas).padStart(2, '0')
                    const m = String(info.minutos).padStart(2, '0')
                    const s = String(info.segundos).padStart(2, '0')
                    el.innerHTML = `<span style="color:#f4c522;font-weight:bold;font-size:0.75em">⏳ ${h}:${m}:${s}</span>`
                }
            }
        }
    })
}, 1000)

// HOVER MOUSEOVER Y MOUSEOUT EN TARJETAS KANBAN
window.hoverKanbanCard = function(el, e, tareaId) {
    el.style.boxShadow = '0 0 15px var(--primary)'
    el.style.transform = 'translateY(-2px)'
    el.style.transition = 'all 0.2s ease'
    
    const tarea = gestorTareas.obtenerTareaPorId(tareaId)
    if (tarea) {
        const tooltip = document.getElementById('app-tooltip')
        if (tooltip) {
            const fechaFormateada = new Date(tarea.fechaCreacion).toLocaleString('es-CL')
            tooltip.innerHTML = `
                <div><strong>Tarea POO #${tarea.id}</strong> (${tarea.tipo})</div>
                <div>Estado: <span style="color:var(--accent)">${tarea.estado}</span></div>
                <div>Creada: ${fechaFormateada}</div>
                <div>Prioridad: ${tarea.prioridad || 'normal'}</div>
                <div>Detalle: ${tarea.descripcion}</div>
            `
            tooltip.style.display = 'block'
            tooltip.style.top = (e.clientY + 12) + 'px'
            tooltip.style.left = (e.clientX + 12) + 'px'
        }
    }
}

window.unhoverKanbanCard = function(el) {
    el.style.boxShadow = 'none'
    el.style.transform = 'none'
    const tooltip = document.getElementById('app-tooltip')
    if (tooltip) tooltip.style.display = 'none'
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        configurarFormularioNuevaTarea()
    })
} else {
    configurarFormularioNuevaTarea()
}

