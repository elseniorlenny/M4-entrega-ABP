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
    renderVentas()
    renderCarritoVenta()
    renderEnvioTareasVenta()

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

    const matNombre = `${item.material} ${item.color} ${item.espesor}mm`
    const enCarrito = carritoVenta.filter(c => c.materialId === item.id).reduce((s, c) => s + c.cantidad, 0)
    const sinStockSuficiente = (cantidad + enCarrito) > item.stock

    if (item.stock === 0) {
        const vendedor = usuarioActual ? usuarioActual.nombre : 'Gerente';
        alertasEnvioVenta.push({
            id: Date.now() + Math.random(),
            tipoTarget: 'reposicion',
            cliente,
            materialId: item.id,
            sku: item.sku,
            materialNombre: matNombre,
            cantidad,
            precioUnitario: item.precio,
            prioridad: 'alta',
            canal: 'local',
            tipoEntrega: 'inmediata',
            vendedor,
            notas: `Producto sin stock (${item.stock} und.)`
        });
        alert(`⚠️ El producto "${item.sku}" no tiene stock (0 und.). Se generó una tarea con Prioridad ALTA dirigida a Reposición.`);
    } else {
        // Agregar al carrito
        const existente = carritoVenta.find(c => c.materialId === item.id);
        if (existente) {
            existente.cantidad += cantidad;
        } else {
            carritoVenta.push({
                materialId: item.id,
                sku: item.sku,
                materialNombre: matNombre,
                cantidad,
                precioUnitario: item.precio,
                stockActual: item.stock
            });
        }
        // Si no tiene stock suficiente -> generar tarea Prioridad Alta con destino a Reposición en Envío Tareas
        if (sinStockSuficiente) {
            const vendedor = usuarioActual ? usuarioActual.nombre : 'Gerente';
            alertasEnvioVenta.push({
                id: Date.now() + Math.random(),
                tipoTarget: 'reposicion',
                cliente,
                materialId: item.id,
                sku: item.sku,
                materialNombre: matNombre,
                cantidad,
                precioUnitario: item.precio,
                prioridad: 'alta',
                canal: 'local',
                tipoEntrega: 'inmediata',
                vendedor,
                notas: `Producto sin stock suficiente (${item.stock} und disp. en bodega)`
            });
            alert(`⚠️ El producto "${item.sku}" no tiene stock suficiente (${item.stock} und). Se agregó al carrito y se generó automáticamente una tarea con Prioridad ALTA con destino a Reposición.`);
        }
    }

    document.getElementById('venta-material').value = ''
    document.getElementById('venta-cantidad').value = ''
    document.getElementById('venta-stock-info').textContent = '0'
    document.getElementById('venta-precio-info').textContent = '$0'
    document.getElementById('venta-total-preview').textContent = '$0'

    guardarTodo()
    renderCarritoVenta()
    renderEnvioTareasVenta()
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

    const vendedor = usuarioActual ? usuarioActual.nombre : 'Gerente'

    carritoVenta.forEach(item => {
        const itemInv = inventario.find(i => i.id === item.materialId || i.sku === item.sku)
        const stockActual = itemInv ? itemInv.stock : 0

        if (stockActual >= item.cantidad) {
            alertasEnvioVenta.push({
                id: Date.now() + Math.random(),
                tipoTarget: 'bodega',
                cliente,
                materialId: item.materialId,
                sku: item.sku,
                materialNombre: item.materialNombre,
                cantidad: item.cantidad,
                precioUnitario: item.precioUnitario,
                prioridad: 'alta',
                canal: 'local',
                tipoEntrega: 'inmediata',
                vendedor,
                notas: ''
            })
        } else {
            alertasEnvioVenta.push({
                id: Date.now() + Math.random(),
                tipoTarget: 'reposicion',
                cliente,
                materialId: item.materialId,
                sku: item.sku,
                materialNombre: item.materialNombre,
                cantidad: item.cantidad,
                precioUnitario: item.precioUnitario,
                prioridad: 'urgente',
                canal: 'local',
                tipoEntrega: 'inmediata',
                vendedor,
                notas: `Stock insuficiente (${stockActual} und disp.)`
            })
        }
    })

    carritoVenta = []
    renderCarritoVenta()
    guardarTodo()
    renderEnvioTareasVenta()
    document.getElementById('venta-cliente').value = ''
    document.getElementById('venta-material').value = ''
    document.getElementById('venta-cantidad').value = ''
    document.getElementById('venta-stock-info').textContent = '0'
    document.getElementById('venta-precio-info').textContent = '$0'
    document.getElementById('venta-total-preview').textContent = '$0'
}

function renderEnvioTareasVenta() {
    const container = document.getElementById('envio-tareas-drop')
    const countEl = document.getElementById('envio-tareas-count')
    const btnEnviarTodo = document.getElementById('btn-enviar-todo-venta')
    if (!container) return

    if (!alertasEnvioVenta || alertasEnvioVenta.length === 0) {
        container.innerHTML = '<div class="kanban-empty">Sin tareas pendientes de envío</div>'
        if (countEl) countEl.textContent = '0'
        if (btnEnviarTodo) btnEnviarTodo.disabled = true
        return
    }

    if (countEl) countEl.textContent = alertasEnvioVenta.length
    if (btnEnviarTodo) {
        btnEnviarTodo.disabled = false
        btnEnviarTodo.textContent = `🚀 Enviar Todo (${alertasEnvioVenta.length})`
    }

    container.innerHTML = alertasEnvioVenta.map((a, idx) => {
        const colorPrioridad = a.prioridad === 'urgente' || a.prioridad === 'alta' ? 'var(--danger)' : a.prioridad === 'media' ? 'var(--warning)' : 'var(--success)'
        const isBodega = a.tipoTarget === 'bodega'
        const labelTarget = isBodega ? '📦 A Bodega' : '🛒 A Reposición'
        const bgTarget = isBodega ? 'var(--info)' : 'var(--danger)'

        return `
        <div class="kanban-card" style="border-left:4px solid ${colorPrioridad};margin-bottom:8px;padding:8px;background:var(--bg-card);border-radius:var(--radius);border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="background:${bgTarget};color:#000;padding:1px 5px;border-radius:3px;font-size:0.75em;font-weight:bold">${labelTarget}</span>
                <span style="background:${colorPrioridad};color:#fff;padding:1px 5px;border-radius:3px;font-size:0.75em;font-weight:bold">${a.prioridad.toUpperCase()}</span>
            </div>
            <div style="font-size:0.85em;font-weight:bold;margin-bottom:2px">Cliente: ${a.cliente}</div>
            <div style="font-size:0.8em;color:var(--text)"><code>${a.sku}</code> ${a.materialNombre}</div>
            <div style="font-size:0.8em;margin-top:2px">Cant: <strong>${a.cantidad} und.</strong></div>
            <div style="font-size:0.75em;color:var(--text-muted);margin-top:2px">Plataforma: ${(a.canal || 'local').toUpperCase()} | Entrega: ${(a.tipoEntrega || 'inmediata').toUpperCase()}</div>
            ${a.notas ? `<div style="font-size:0.75em;color:var(--warning);margin-top:2px">Nota: ${a.notas}</div>` : ''}

            <div style="display:flex;gap:4px;margin-top:6px">
                <button onclick="appEditarAlertaVenta(${idx})" style="font-size:0.75em;background:var(--info);color:#000;flex:1;padding:3px;border-radius:3px;font-weight:600">✏️ Editar</button>
                <button onclick="appEnviarAlertaVentaUnica(${idx})" style="font-size:0.75em;background:${isBodega ? 'var(--success)' : 'var(--danger)'};color:#fff;flex:1.2;padding:3px;font-weight:bold;border-radius:3px">📤 ${isBodega ? 'A Bodega' : 'A Reposición'}</button>
                <button onclick="appEliminarAlertaVenta(${idx})" style="font-size:0.75em;background:var(--danger);padding:3px;border-radius:3px">🗑️</button>
            </div>
        </div>
        `
    }).join('')
}

function renderEnvioTareasBodega() {
    const container = document.getElementById('bodega-envio-drop')
    const countEl = document.getElementById('kanban-alert-count')
    const btnEnviarTodo = document.getElementById('btn-enviar-todo-bodega')
    if (!container) return

    if (!alertasStockPendientes || alertasStockPendientes.length === 0) {
        container.innerHTML = '<div class="kanban-empty">Sin alertas de stock pendientes</div>'
        if (countEl) countEl.textContent = '0'
        if (btnEnviarTodo) btnEnviarTodo.disabled = true
        return
    }

    if (countEl) countEl.textContent = alertasStockPendientes.length
    if (btnEnviarTodo) {
        btnEnviarTodo.disabled = false
        btnEnviarTodo.textContent = `🚀 Enviar Todo (${alertasStockPendientes.length})`
    }

    container.innerHTML = alertasStockPendientes.map((a, idx) => {
        const colorPrioridad = a.prioridad === 'urgente' || a.prioridad === 'alta' ? 'var(--danger)' : a.prioridad === 'media' ? 'var(--warning)' : 'var(--success)'
        return `
        <div class="kanban-card" style="border-left:4px solid ${colorPrioridad};margin-bottom:8px;padding:8px;background:var(--bg-card);border-radius:var(--radius);border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="background:${colorPrioridad};color:#fff;padding:1px 5px;border-radius:3px;font-size:0.75em;font-weight:bold">🛒 A Reposición</span>
                <span style="background:${colorPrioridad};color:#fff;padding:1px 5px;border-radius:3px;font-size:0.75em;font-weight:bold">${(a.prioridad || 'alta').toUpperCase()}</span>
            </div>
            <div style="font-size:0.8em;color:var(--text);font-weight:bold"><code>${a.sku}</code> ${a.materialNombre}</div>
            <div style="font-size:0.8em;margin-top:2px">Sugerido pedir: <strong>${a.cantidad} und.</strong></div>
            ${a.notas ? `<div style="font-size:0.75em;color:var(--text-muted);margin-top:2px">Detalle: ${a.notas}</div>` : ''}

            <div style="display:flex;gap:4px;margin-top:6px">
                <button onclick="appEditarAlertaBodega(${idx})" style="font-size:0.75em;background:var(--info);color:#000;flex:1;padding:3px;border-radius:3px;font-weight:600">✏️ Editar</button>
                <button onclick="appEnviarAlertaBodegaUnica(${idx})" style="font-size:0.75em;background:${colorPrioridad};color:#fff;flex:1.2;padding:3px;font-weight:bold;border-radius:3px">📤 A Reposición</button>
                <button onclick="appEliminarAlertaBodega(${idx})" style="font-size:0.75em;background:${colorPrioridad};padding:3px;border-radius:3px">🗑️</button>
            </div>
        </div>
        `
    }).join('')
}

window.appEnviarAlertaVentaUnica = function(idx) {
    const a = alertasEnvioVenta[idx]
    if (!a) return

    const vendedor = a.vendedor || (usuarioActual ? usuarioActual.nombre : 'Gerente')
    const fecha = new Date().toISOString()
    const ventaId = siguienteId(ventas)

    if (a.tipoTarget === 'bodega') {
        const total = a.precioUnitario * a.cantidad
        const neto = Math.round(total / 1.19)
        const iva = total - neto

        ventas.push({
            id: ventaId, fecha, cliente: a.cliente,
            materialId: a.materialId, sku: a.sku,
            materialNombre: a.materialNombre,
            cantidad: a.cantidad, precioUnitario: a.precioUnitario,
            neto, iva, total, vendedor, canal: a.canal, estado: 'completada'
        })

        const clienteObj = clientes.find(c => c.nombre === a.cliente)
        if (!clienteObj && a.cliente) {
            clientes.push({
                id: clientes.length + 1,
                nombre: a.cliente,
                rut: 'CLI-' + String(clientes.length + 1).padStart(4, '0'),
                email: '-', telefono: '-', saldo: 0
            })
        }

        const notasTarea = `Entregar a: ${a.cliente} | Entrega: ${a.tipoEntrega}` + (a.notas ? ` | Nota: ${a.notas}` : '')
        const tarea = new Tarea(siguienteId(tareas), 'entrega', a.materialId, a.sku, a.materialNombre, a.cantidad, 'venta', notasTarea)
        tarea.asignadoA = 'bodega'
        tarea.ventaId = ventaId
        tarea.prioridad = a.prioridad || 'normal'
        tarea.vendedor = vendedor
        tarea.fechaCompra = fecha
        tarea.canal = a.canal || 'local'
        tarea.tipoRetiro = (a.tipoEntrega === 'inmediata' || !a.tipoEntrega) ? 'local' : a.tipoEntrega
        tarea.cliente = a.cliente
        gestorTareas.agregarTarea(tarea)
    } else {
        const notasRepo = `Cliente: ${a.cliente}. Necesita: ${a.cantidad} und.` + (a.notas ? ` | Nota: ${a.notas}` : '')
        const tarea = new Tarea(siguienteId(tareas), 'reposicion', a.materialId, a.sku, a.materialNombre, a.cantidad, 'stock-insuficiente', notasRepo)
        tarea.prioridad = a.prioridad || 'urgente'
        tarea.estado = 'enviada'
        tarea.asignadoA = 'proveedores'
        tarea.fuente = 'ventas'
        tarea.enviadoPor = vendedor
        gestorTareas.agregarTarea(tarea)
    }

    alertasEnvioVenta.splice(idx, 1)
    guardarTodo()
    renderEnvioTareasVenta()
    renderVentas()
    renderBodegaKanban()
    renderReposicionKanban()
}

window.appEnviarTodasAlertasVenta = function() {
    if (!alertasEnvioVenta || alertasEnvioVenta.length === 0) return
    const total = alertasEnvioVenta.length
    while (alertasEnvioVenta.length > 0) {
        appEnviarAlertaVentaUnica(0)
    }
    alert(`🚀 Las ${total} tareas de envío fueron procesadas y transmitidas exitosamente.`)
}

window.appEliminarAlertaVenta = function(idx) {
    alertasEnvioVenta.splice(idx, 1)
    guardarTodo()
    renderEnvioTareasVenta()
}

window.appEnviarAlertaBodegaUnica = function(idx) {
    const a = alertasStockPendientes[idx]
    if (!a) return

    const tarea = new Tarea(siguienteId(tareas), 'reposicion', a.materialId, a.sku, a.materialNombre, a.cantidad, a.origen || 'stock-bajo', a.notas || 'Solicitado desde bodega')
    tarea.prioridad = a.prioridad || 'urgente'
    tarea.estado = 'enviada'
    tarea.asignadoA = 'proveedores'
    tarea.fuente = 'bodega'
    tarea.enviadoPor = a.enviadoPor || (usuarioActual ? usuarioActual.nombre : 'Bodega')
    tareas.push(tarea)

    alertasStockPendientes.splice(idx, 1)
    guardarTodo()
    renderEnvioTareasBodega()
    if (seccionActual === 'reposicion') renderReposicionKanban()
}

window.appEnviarTodasAlertasBodega = function() {
    if (!alertasStockPendientes || alertasStockPendientes.length === 0) return
    const total = alertasStockPendientes.length
    while (alertasStockPendientes.length > 0) {
        appEnviarAlertaBodegaUnica(0)
    }
    alert(`🚀 Las ${total} alertas de stock fueron enviadas a Reposición.`)
}

window.appEliminarAlertaBodega = function(idx) {
    alertasStockPendientes.splice(idx, 1)
    guardarTodo()
    renderEnvioTareasBodega()
}

window.appEditarAlertaVenta = function(idx) {
    const a = alertasEnvioVenta[idx]
    if (!a) return
    document.getElementById('alerta-edit-idx').value = idx
    document.getElementById('alerta-edit-origen').value = 'venta'
    document.getElementById('alerta-edit-prioridad').value = a.prioridad || 'alta'
    document.getElementById('alerta-edit-cantidad').value = a.cantidad || 1
    document.getElementById('alerta-edit-canal').value = a.canal || 'local'
    document.getElementById('alerta-edit-entrega').value = a.tipoEntrega || 'inmediata'
    document.getElementById('alerta-edit-notas').value = a.notas || ''
    document.getElementById('modal-editar-alerta').style.display = 'flex'
}

window.appEditarAlertaBodega = function(idx) {
    const a = alertasStockPendientes[idx]
    if (!a) return
    document.getElementById('alerta-edit-idx').value = idx
    document.getElementById('alerta-edit-origen').value = 'bodega'
    document.getElementById('alerta-edit-prioridad').value = a.prioridad || 'urgente'
    document.getElementById('alerta-edit-cantidad').value = a.cantidad || 1
    document.getElementById('alerta-edit-canal').value = 'local'
    document.getElementById('alerta-edit-entrega').value = 'inmediata'
    document.getElementById('alerta-edit-notas').value = a.notas || ''
    document.getElementById('modal-editar-alerta').style.display = 'flex'
}

window.appCerrarModalEditarAlerta = function() {
    const modal = document.getElementById('modal-editar-alerta')
    if (modal) modal.style.display = 'none'
}

window.appGuardarAtributosAlerta = function() {
    const idx = parseInt(document.getElementById('alerta-edit-idx').value)
    const origen = document.getElementById('alerta-edit-origen').value
    const prioridad = document.getElementById('alerta-edit-prioridad').value
    const cantidad = parseInt(document.getElementById('alerta-edit-cantidad').value) || 1
    const canal = document.getElementById('alerta-edit-canal').value
    const tipoEntrega = document.getElementById('alerta-edit-entrega').value
    const notas = document.getElementById('alerta-edit-notas').value.trim()

    if (origen === 'venta') {
        const a = alertasEnvioVenta[idx]
        if (a) {
            a.prioridad = prioridad
            a.cantidad = cantidad
            a.canal = canal
            a.tipoEntrega = tipoEntrega
            a.notas = notas
        }
        renderEnvioTareasVenta()
    } else {
        const a = alertasStockPendientes[idx]
        if (a) {
            a.prioridad = prioridad
            a.cantidad = cantidad
            a.notas = notas
        }
        renderEnvioTareasBodega()
    }

    guardarTodo()
    appCerrarModalEditarAlerta()
}

/* ==================== RENDER: BODEGA ==================== */
function onRenderBodega() {
    renderBodegaKanban()
    renderBodegaInventario()
    renderEnvioTareasBodega()

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
    const egresosCompras = tareas.filter(t => t.tipo === 'reposicion' && ['comprada', 'completada'].includes(t.estado)).reduce((s, t) => s + (t.totalCompra || 0), 0)
    const reembolsos = ventasAnuladas.reduce((s, v) => s + (v.montoReembolso || 0), 0)
    const egresosTotales = egresosCompras + reembolsos
    const dinero = (tiendaConfig.dineroInicial !== undefined ? tiendaConfig.dineroInicial : 5000000)

    const gananciaBruta = ingresos - egresosCompras
    const margenGananciaPct = ingresos > 0 ? Math.round((gananciaBruta / ingresos) * 100) : 0
    const margenPerdidaPct = ingresos > 0 ? Math.round((reembolsos / ingresos) * 100) : 0

    const el = (id) => document.getElementById(id)
    if (el('est-dinero')) el('est-dinero').textContent = formatearCLP(dinero)
    if (el('est-egresos')) el('est-egresos').textContent = formatearCLP(egresosTotales)
    if (el('est-ingresos')) el('est-ingresos').textContent = formatearCLP(ingresos)
    if (el('est-margen-ganancia')) el('est-margen-ganancia').textContent = `${formatearCLP(gananciaBruta)} (${margenGananciaPct}%)`
    if (el('est-margen-perdida')) el('est-margen-perdida').textContent = `${formatearCLP(reembolsos)} (${margenPerdidaPct}%)`
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
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${v.cliente}</td>
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
    if (entregas.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">Sin entregas completadas</td></tr>'; return }
    tbody.innerHTML = entregas.map(t => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${t.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">V-${String(t.ventaId || 0).padStart(4, '0')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${t.cliente || '-'}</td>
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
    if (ventasAnuladas.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">Sin ventas anuladas</td></tr>'; return }
    tbody.innerHTML = ventasAnuladas.map(v => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">V-${String(v.ventaOriginalId || 0).padStart(4, '0')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${new Date(v.fecha).toLocaleDateString('es-CL')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${v.cliente}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.materialNombre}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.cantidad}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--danger)">${formatearCLP(v.montoReembolso || 0)}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.motivo}</td>
    </tr>`).join('')
}

function estRenderReembolsos() {
    const tbody = document.getElementById('est-reembolsos-lista')
    if (!tbody) return
    if (ventasAnuladas.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text-muted)">Sin reembolsos registrados</td></tr>'; return }
    tbody.innerHTML = ventasAnuladas.map(v => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">V-${String(v.ventaOriginalId || 0).padStart(4, '0')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${v.cliente}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--danger)">${formatearCLP(v.montoReembolso || 0)}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${new Date(v.fecha).toLocaleDateString('es-CL')}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${v.motivo}</td>
    </tr>`).join('')
}

function estRenderEmpleados() {
    const tbody = document.getElementById('est-empleados-lista')
    if (!tbody) return
    const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    if (empleados.length === 0) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:12px;color:var(--text-muted)">Sin empleados registrados</td></tr>'; return }
    tbody.innerHTML = empleados.map((e, i) => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${e.nombre} ${e.apellido || ''}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.rut || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center"><span style="background:var(--info);color:#000;padding:1px 5px;border-radius:3px;font-size:0.75em">${e.rol}</span></td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.email}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.cumpleanos || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.telefono || '-'}</td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estEditarEmpleado(${i})" style="font-size:0.75em;background:var(--info);color:#000;padding:3px 6px">Editar</button></td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estDespedirEmpleado(${i})" style="font-size:0.75em;background:var(--danger);padding:3px 6px">X</button></td>
    </tr>`).join('')
}

window.estAbrirFormEmpleado = function(idx) {
    const modal = document.getElementById('modal-empleado')
    if (!modal) return
    const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    if (idx !== undefined && idx !== '') {
        const e = empleados[idx]
        if (!e) return
        document.getElementById('emp-form-titulo').textContent = 'Editar Empleado'
        document.getElementById('emp-form-idx').value = idx
        document.getElementById('emp-form-nombre').value = e.nombre || ''
        document.getElementById('emp-form-apellido').value = e.apellido || ''
        document.getElementById('emp-form-rut').value = e.rut || ''
        document.getElementById('emp-form-cumpleanos').value = e.cumpleanos || ''
        document.getElementById('emp-form-rol').value = e.rol || 'Vendedor'
        document.getElementById('emp-form-email').value = e.email || ''
        document.getElementById('emp-form-password').value = e.password || ''
        document.getElementById('emp-form-telefono').value = e.telefono || ''
    } else {
        document.getElementById('emp-form-titulo').textContent = 'Contratar Empleado'
        document.getElementById('emp-form-idx').value = ''
        document.getElementById('emp-form-nombre').value = ''
        document.getElementById('emp-form-apellido').value = ''
        document.getElementById('emp-form-rut').value = ''
        document.getElementById('emp-form-cumpleanos').value = ''
        document.getElementById('emp-form-rol').value = 'Vendedor'
        document.getElementById('emp-form-email').value = ''
        document.getElementById('emp-form-password').value = ''
        document.getElementById('emp-form-telefono').value = ''
    }
    modal.style.display = 'flex'
}

window.estEditarEmpleado = function(idx) {
    estAbrirFormEmpleado(idx)
}

window.estGuardarEmpleado = function() {
    const idx = document.getElementById('emp-form-idx').value
    const nombre = document.getElementById('emp-form-nombre').value.trim()
    const apellido = document.getElementById('emp-form-apellido').value.trim()
    const rut = document.getElementById('emp-form-rut').value.trim()
    const cumpleanos = document.getElementById('emp-form-cumpleanos').value
    const rol = document.getElementById('emp-form-rol').value
    const email = document.getElementById('emp-form-email').value.trim()
    const password = document.getElementById('emp-form-password').value.trim()
    const telefono = document.getElementById('emp-form-telefono').value.trim()

    if (!nombre) { alert('Ingrese el nombre del empleado'); return }

    if (!datosJSON.perfiles) datosJSON.perfiles = { empleados: [] }
    if (!datosJSON.perfiles.empleados) datosJSON.perfiles.empleados = []
    const empleados = datosJSON.perfiles.empleados

    if (idx !== '') {
        const emp = empleados[parseInt(idx)]
        if (emp) {
            emp.nombre = nombre
            emp.apellido = apellido
            emp.rut = rut
            emp.cumpleanos = cumpleanos
            emp.rol = rol
            emp.email = email
            emp.password = password
            emp.telefono = telefono
        }
    } else {
        const maxId = empleados.length > 0 ? Math.max(...empleados.map(e => e.id)) : 0
        empleados.push({
            id: maxId + 1,
            nombre,
            apellido,
            rut,
            cumpleanos,
            rol,
            email,
            password,
            telefono
        })
    }
    guardarTodo()
    estRenderEmpleados()
    estCerrarFormEmpleado()
}

window.estDespedirEmpleado = function(idx) {
    if (!confirm('¿Está seguro de despedir a este empleado?')) return
    const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    empleados.splice(idx, 1)
    guardarTodo()
    estRenderEmpleados()
}

function estRenderClientes() {
    const tbody = document.getElementById('est-clientes-lista')
    if (!tbody) return
    if (clientes.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">Sin clientes registrados</td></tr>'; return }
    tbody.innerHTML = clientes.map((c, i) => {
        const totalComprasCliente = ventas.filter(v => v.cliente === c.nombre && v.estado === 'completada').reduce((s, v) => s + v.total, 0)
        return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.id || (i + 1)}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${c.nombre}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.rut || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.email || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${c.telefono || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--success)">${formatearCLP(totalComprasCliente)}</td>
            <td style="padding:6px 8px;text-align:center"><button onclick="estEditarCliente(${i})" style="font-size:0.75em;background:var(--info);color:#000;padding:3px 6px">Editar</button></td>
            <td style="padding:6px 8px;text-align:center"><button onclick="estEliminarCliente(${i})" style="font-size:0.75em;background:var(--danger);padding:3px 6px">X</button></td>
        </tr>`
    }).join('')
}

function estRenderInventarioPrecios() {
    const tbody = document.getElementById('est-inv-precios')
    if (!tbody) return
    tbody.innerHTML = inventario.map(item => {
        const margen = item.margen || 30
        const precioVentaPublico = item.precio
        const iva = Math.round(precioVentaPublico - (precioVentaPublico / 1.19))
        const costoProveedorUnit = Math.round(precioVentaPublico / ((1 + margen / 100) * 1.19))

        return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.sku}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.material} ${item.color} ${item.espesor}mm</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${item.marca || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:${item.stock === 0 ? 'var(--danger)' : item.stock <= STOCK_MINIMO ? 'var(--warning)' : 'var(--success)'}">${item.stock}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${formatearCLP(precioVentaPublico)}</td>
            <td style="padding:6px 8px;text-align:center">
                <input type="number" value="${margen}" min="0" max="200" onchange="estUpdateMargen(${item.id}, this.value)" style="width:65px;text-align:center;padding:3px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">%
            </td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${formatearCLP(iva)}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--accent)">${formatearCLP(costoProveedorUnit)}</td>
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
    if (proveedores.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:12px;color:var(--text-muted)">Sin proveedores registrados</td></tr>'; return }
    tbody.innerHTML = proveedores.map(p => {
        const comps = compras.filter(t => t.proveedorId === p.id)
        const totalGastado = comps.reduce((s, t) => s + (t.totalCompra || 0), 0)
        return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.id}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${p.nombre}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.marcas || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.contacto || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.telefono || ''} | ${p.email || ''}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${comps.length}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--danger)">${formatearCLP(totalGastado)}</td>
        </tr>`
    }).join('')
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

