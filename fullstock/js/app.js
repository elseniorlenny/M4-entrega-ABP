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
window.navegar = async function navegar(nombre) {
    if (!sesionActiva && nombre !== 'inicio') {
        mostrarSweetToast('Inicia sesión primero', 'warning')
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

    setTimeout(() => {
        document.querySelectorAll('table').forEach(tbl => {
            if (typeof makeTableSortable === 'function') {
                makeTableSortable(tbl)
            }
        })
    }, 60)
}

window.makeTableSortable = function(tableOrId) {
    const table = typeof tableOrId === 'string' ? document.getElementById(tableOrId) : tableOrId
    if (!table) return

    const thead = table.querySelector('thead')
    const tbody = table.querySelector('tbody')
    if (!thead || !tbody) return

    const headers = thead.querySelectorAll('th')
    headers.forEach((th, colIdx) => {
        th.style.cursor = 'pointer'
        th.style.userSelect = 'none'
        th.title = 'Haga clic para ordenar por esta columna'

        if (th.dataset.sortBound) return
        th.dataset.sortBound = 'true'

        th.addEventListener('click', () => {
            const currentDir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc'

            headers.forEach(h => {
                delete h.dataset.sortDir
                const arrow = h.querySelector('.sort-arrow')
                if (arrow) arrow.remove()
            })

            th.dataset.sortDir = currentDir
            const arrowSpan = document.createElement('span')
            arrowSpan.className = 'sort-arrow ms-1 text-primary font-monospace'
            arrowSpan.style.fontSize = '0.75rem'
            arrowSpan.textContent = currentDir === 'asc' ? '▲' : '▼'
            th.appendChild(arrowSpan)

            const rows = Array.from(tbody.querySelectorAll('tr'))
            if (rows.length <= 1) return

            rows.sort((rowA, rowB) => {
                const cellA = rowA.children[colIdx]
                const cellB = rowB.children[colIdx]
                if (!cellA || !cellB) return 0

                let valA = cellA.innerText.trim()
                let valB = cellB.innerText.trim()

                const numA = parseFloat(valA.replace(/[^0-9.-]+/g, ''))
                const numB = parseFloat(valB.replace(/[^0-9.-]+/g, ''))

                if (!isNaN(numA) && !isNaN(numB) && /[\d$#]/.test(valA) && /[\d$#]/.test(valB)) {
                    return currentDir === 'asc' ? numA - numB : numB - numA
                }

                return currentDir === 'asc'
                    ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
                    : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' })
            })

            rows.forEach(r => tbody.appendChild(r))
        })
    })
}

/* ==================== INICIALIZACION ==================== */
async function inicializar() {
    const cargado = await cargarDatosJSON()
    if (!cargado) {
        mostrarSweetToast('Error: No se pudo cargar la base de datos', 'error')
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
async function login() {
    if (typeof Swal !== 'undefined') {
        const { value: formValues } = await Swal.fire({
            title: '🔐 Iniciar Sesión en Full.Stock',
            html: `
                <div class="mb-3 text-start">
                    <label class="form-label text-dark small fw-semibold">Correo Electrónico</label>
                    <input id="swal-email" class="form-control" placeholder="gerencia@construshop.cl" value="gerencia@construshop.cl">
                </div>
                <div class="mb-2 text-start">
                    <label class="form-label text-dark small fw-semibold">Contraseña</label>
                    <input id="swal-password" type="password" class="form-control" placeholder="••••••••" value="admin123">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Ingresar',
            cancelButtonText: 'Cancelar',
            background: '#ffffff',
            color: '#0f172a',
            confirmButtonColor: '#4f46e5',
            preConfirm: () => {
                return [
                    document.getElementById('swal-email').value,
                    document.getElementById('swal-password').value
                ]
            }
        });

        if (formValues) {
            const [email, password] = formValues;
            const usuario = validarCredenciales(email, password);
            if (usuario) {
                iniciarSesion(usuario);
                btnLoginNav.classList.add('oculto');
                btnLogoutNav.classList.remove('oculto');
                navegar('inicio');
                Swal.fire({
                    icon: 'success',
                    title: `¡Bienvenido ${usuario.nombre}!`,
                    text: `Acceso concedido como ${usuario.rol || 'Gerente'}.`,
                    timer: 2500,
                    showConfirmButton: false,
                    background: '#ffffff',
                    color: '#0f172a'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Credenciales Incorrectas',
                    text: 'Verifique su correo y contraseña.',
                    background: '#ffffff',
                    color: '#0f172a'
                });
            }
        }
    } else {
        Swal.fire({
            title: 'Iniciar Sesión',
            html: `
                <input id="swal-login-email" class="swal2-input" type="email" placeholder="Email" value="gerencia@construshop.cl">
                <input id="swal-login-pwd" class="swal2-input" type="password" placeholder="Contraseña">`,
            showCancelButton: true,
            confirmButtonText: 'Ingresar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3b82f6',
            preConfirm: () => ({
                email: document.getElementById('swal-login-email').value,
                password: document.getElementById('swal-login-pwd').value
            })
        }).then(res => {
            if (!res.isConfirmed) return
            const usuario = validarCredenciales(res.value.email, res.value.password)
            if (usuario) {
                iniciarSesion(usuario)
                btnLoginNav.classList.add('oculto')
                btnLogoutNav.classList.remove('oculto')
                navegar('inicio')
                mostrarSweetToast('Bienvenido, ' + usuario.nombre, 'success')
            } else {
                mostrarSweetToast('Credenciales incorrectas', 'error')
            }
        })
    }
}

async function logout() {
    let confirmado = false;
    if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
            title: '¿Cerrar Sesión?',
            text: 'Tendrá que ingresar sus credenciales nuevamente para operar.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar sesión',
            cancelButtonText: 'Cancelar',
            background: '#ffffff',
            color: '#0f172a',
            confirmButtonColor: '#dc2626'
        });
        confirmado = res.isConfirmed;
    } else {
        confirmado = false; // fallback sin Swal (no debe ocurrir)
    }

    if (confirmado) {
        cerrarSesion();
        btnLogoutNav.classList.add('oculto');
        btnLoginNav.classList.remove('oculto');
        navegar('inicio');
    }
}

function actualizarNavbar() {
    const navLinks = document.querySelectorAll('#nav-center a[data-seccion], #nav-right a[data-seccion]')
    const nombreTienda = (typeof tiendaConfig !== 'undefined' && tiendaConfig.nombre) ? tiendaConfig.nombre : 'Tienda Muebles'
    const brandEl = document.getElementById('brand-app')
    if (brandEl) {
        brandEl.innerHTML = `<i class="bi bi-box-seam-fill me-1"></i> Full.Stock <span class="text-muted fw-normal" style="font-size:0.85em;">| ${nombreTienda}</span>`
    }
    if (sesionActiva) {
        navLinks.forEach(a => {
            a.classList.remove('nav-disabled')
            a.removeAttribute('tabindex')
            a.removeAttribute('aria-disabled')
        })
    } else {
        navLinks.forEach(a => {
            a.classList.add('nav-disabled')
            a.setAttribute('tabindex', '-1')
            a.setAttribute('aria-disabled', 'true')
        })
    }
}

/* ==================== RENDER: INICIO ==================== */
function renderInicio() {
    actualizarNavbar()
    const container = document.getElementById('inicio-resumen-tareas')
    if (!container) return
    const maxTareas = tareas || []
    if (maxTareas.length === 0) {
        container.innerHTML = '<div class="text-secondary small text-center py-3">Sin tareas registradas en el sistema.</div>'
        return
    }
    container.innerHTML = maxTareas.map(t => `
        <div class="task-card">
            <div class="d-flex justify-content-between align-items-center">
                <span class="task-card-title m-0">Tarea POO #${t.id} • ${t.materialNombre || t.descripcion}</span>
                <span class="task-card-badge ${t.prioridad === 'urgente' ? 'task-badge-urgente' : 'task-badge-normal'}">${t.prioridad || 'normal'}</span>
            </div>
            <div class="task-card-meta mt-1">
                <span><i class="bi bi-tag me-1"></i> ${t.tipo}</span>
                <span><i class="bi bi-box me-1"></i> Cant: ${t.cantidad}</span>
                <span><i class="bi bi-person me-1"></i> ${t.trabajadorAsignado || 'Sin asignar'}</span>
                <span class="ms-auto text-indigo fw-semibold">${t.estado}</span>
            </div>
        </div>
    `).join('')
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

    if (!cliente) {
        mostrarSweetToast('Por favor ingrese el nombre o razón social del cliente', 'error');
        return;
    }
    if (!materialId) {
        mostrarSweetToast('Por favor seleccione un material del catálogo', 'error');
        return;
    }
    if (!cantidad || cantidad <= 0) {
        mostrarSweetToast('Por favor ingrese una cantidad válida mayor a 0', 'error');
        return;
    }

    const item = inventario.find(i => i.id === parseInt(materialId))
    if (!item) return

    const matNombre = `${item.material} ${item.color} ${item.espesor}mm`
    const enCarrito = carritoVenta.filter(c => c.materialId === item.id).reduce((s, c) => s + c.cantidad, 0)
    const sinStockSuficiente = (cantidad + enCarrito) > item.stock

    if (item.stock === 0 || cantidad > (item.stock - enCarrito)) {
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
            notas: item.stock === 0 ? `Producto sin stock en bodega (0 und.)` : `Stock insuficiente (${item.stock} und. disponibles en bodega)`
        });
        mostrarSweetToast(`⚠️ "${item.sku}" NO se agregó al carrito por falta de stock (${item.stock} u. disp.). Tarea enviada a Reposición.`, 'warning');
    } else {
        // Stock suficiente -> Agregar al carrito
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
        mostrarSweetToast(`✓ "${item.sku}" (${cantidad} u.) agregado al carrito`, 'success');
    }

    document.getElementById('venta-material').value = ''
    document.getElementById('venta-cantidad').value = ''
    const elStock = document.getElementById('venta-stock-info')
    if (elStock) elStock.textContent = '0'
    const elPrecio = document.getElementById('venta-precio-info')
    if (elPrecio) elPrecio.textContent = '$0'
    const elTotal = document.getElementById('venta-total-preview')
    if (elTotal) elTotal.textContent = '$0'

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
            <div class="p-2 mb-2 bg-white rounded-3 shadow-sm border d-flex justify-content-between align-items-center">
                <div>
                    <div style="font-size:0.85rem;" class="fw-bold text-dark">
                        <span class="font-monospace text-primary me-1">${c.sku}</span> ${c.materialNombre}
                    </div>
                    <div style="font-size:0.78rem;" class="text-secondary">
                        ${c.cantidad} u. × ${formatearCLP(c.precioUnitario)}
                    </div>
                </div>
                <div class="text-end d-flex flex-column align-items-end ms-2">
                    <div class="fw-bold text-dark" style="font-size:0.88rem;">${formatearCLP(totalItem)}</div>
                    <button onclick="appVentaQuitarDelCarrito(${idx})" class="btn btn-outline-danger btn-sm py-1 px-2 mt-1 rounded-2 d-inline-flex align-items-center gap-1" title="Eliminar producto del carrito" style="font-size:0.72rem; font-weight: 600;">
                        <i class="bi bi-trash3-fill"></i> Quitar
                    </button>
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

window.appVentaQuitarDelCarrito = function (idx) {
    carritoVenta.splice(idx, 1)
    renderCarritoVenta()
}

function onRealizarVenta() {
    if (carritoVenta.length === 0) return

    const cliente = document.getElementById('venta-cliente').value.trim()
    if (!cliente) {
        mostrarSweetToast('Por favor ingrese el nombre del cliente para procesar la venta', 'error');
        return;
    }

    const vendedor = usuarioActual ? usuarioActual.nombre : 'Gerente'
    const totalItems = carritoVenta.length

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
    const elStock = document.getElementById('venta-stock-info')
    if (elStock) elStock.textContent = '0'
    const elPrecio = document.getElementById('venta-precio-info')
    if (elPrecio) elPrecio.textContent = '$0'
    const elTotal = document.getElementById('venta-total-preview')
    if (elTotal) elTotal.textContent = '$0'

    mostrarSweetToast(`✅ Venta procesada (${totalItems} items). Revisa el panel de Envío Tareas.`, 'success');
}

function renderEnvioTareasVenta() {
    const container = document.getElementById('envio-tareas-drop')
    const countEl = document.getElementById('envio-tareas-count')
    if (!container) return

    if (!alertasEnvioVenta || alertasEnvioVenta.length === 0) {
        container.innerHTML = '<div class="kanban-empty">Sin tareas pendientes de envío</div>'
        if (countEl) countEl.textContent = '0'
        return
    }

    if (countEl) countEl.textContent = alertasEnvioVenta.length

    container.innerHTML = alertasEnvioVenta.map((a, idx) => {
        const isBodega = a.tipoTarget === 'bodega'
        const colorBorde = isBodega ? '#10b981' : '#ef4444'

        const badgeTarget = isBodega
            ? '<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;font-family:monospace;"><i class="bi bi-box-seam me-1"></i>A Bodega</span>'
            : '<span class="badge px-2 py-1" style="background:#fef3c7;color:#92400e;font-size:0.68rem;font-weight:700;font-family:monospace;"><i class="bi bi-cart-plus me-1"></i>A Reposición</span>'

        return `
        <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left: 4px solid ${colorBorde} !important;">
            <div class="d-flex justify-content-between align-items-center mb-1.5">
                ${badgeTarget}
            </div>

            <div class="d-flex justify-content-between align-items-center mb-1" style="font-size:0.78rem;">
                <div class="text-secondary">
                    <i class="bi bi-person-fill me-1 text-indigo"></i>Cliente: <strong class="text-dark">${a.cliente || 'Cliente General'}</strong>
                </div>
                <span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;font-family:monospace;">${(a.canal || 'local').toUpperCase()}</span>
            </div>

            <div class="p-2 rounded border bg-light my-1.5" style="font-size:0.75rem;">
                <div><span class="font-monospace fw-bold text-primary me-1">${a.sku}</span> <span class="fw-semibold text-dark">${a.materialNombre}</span></div>
                <div class="mt-1 text-secondary">Cantidad a despachar: <strong class="text-dark">${a.cantidad} und</strong></div>
            </div>

            <div class="d-flex justify-content-between align-items-center text-secondary mb-1" style="font-size:0.73rem;">
                <div><i class="bi bi-truck me-1"></i>Entrega: <strong class="text-dark">${(a.tipoEntrega || 'inmediata').toUpperCase()}</strong></div>
            </div>

            ${a.notas ? `<div class="alert alert-warning py-1 px-2 mb-2 text-warning-emphasis rounded" style="font-size:0.72rem;"><i class="bi bi-info-circle me-1"></i>${a.notas}</div>` : ''}

            <div class="mt-2 pt-1 border-top d-flex align-items-center justify-content-between gap-1">
                <button onclick="appEditarAlertaVenta(${idx})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar tarea">
                    <i class="bi bi-pencil-square me-1"></i>Editar
                </button>
                <button onclick="appEnviarAlertaVentaUnica(${idx})" class="btn ${isBodega ? 'btn-outline-primary' : 'btn-outline-warning'} btn-sm py-1 px-2 fw-bold flex-grow-1" style="font-size:0.72rem;">
                    <i class="bi bi-send-fill me-1"></i> Despachar ${isBodega ? 'a Bodega' : 'a Reposición'}
                </button>
                <button onclick="appEliminarAlertaVenta(${idx})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar tarea">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </div>
        </div>
        `
    }).join('')
}

window.verificarAlertasStockAutomaticas = function () {
    if (!inventario || !Array.isArray(inventario)) return
    let huboNuevas = false

    inventario.forEach(item => {
        const esBaja = item.stock <= (typeof STOCK_MINIMO !== 'undefined' ? STOCK_MINIMO : 3) && item.stock > 0
        const esAgotado = item.stock === 0

        if (esBaja || esAgotado) {
            const yaEnAlertas = alertasStockPendientes.some(a => a.materialId === item.id || a.sku === item.sku)
            const yaEnTareas = (typeof tareas !== 'undefined' && Array.isArray(tareas)) ? tareas.some(t => t.tipo === 'reposicion' && (t.materialId === item.id || t.sku === item.sku) && ['pendiente', 'enviada', 'en_proceso', 'comprada', 'eliminada'].includes(t.estado)) : false

            if (!yaEnAlertas && !yaEnTareas) {
                const cantMin = typeof STOCK_MINIMO !== 'undefined' ? STOCK_MINIMO : 3
                const cantPedir = Math.max(1, cantMin + 1 - item.stock)
                const matNombre = `${item.material} ${item.color || ''} ${item.espesor ? item.espesor + 'mm' : ''}`.trim()
                alertasStockPendientes.push({
                    id: Date.now() + Math.random(),
                    materialId: item.id,
                    sku: item.sku,
                    materialNombre: matNombre,
                    cantidad: esAgotado ? Math.max(10, cantPedir) : cantPedir,
                    prioridad: esAgotado ? 'urgente' : 'media',
                    origen: esAgotado ? 'stock-agotado' : 'stock-bajo',
                    notas: esAgotado ? `🔴 Falta de Stock (Stock actual: 0 u.)` : `🟠 Baja de Stock (Stock actual: ${item.stock} u.)`,
                    enviadoPor: 'Bodega (Alerta Automática)'
                })
                huboNuevas = true
            }
        }
    })

    if (huboNuevas && typeof guardarTodo === 'function') {
        guardarTodo()
    }
}

function renderEnvioTareasBodega() {
    const container = document.getElementById('envio-bodega-drop') || document.getElementById('bodega-envio-drop')
    const countEl = document.getElementById('envio-bodega-count') || document.getElementById('kanban-alert-count')
    if (!container) return

    if (typeof window.verificarAlertasStockAutomaticas === 'function') {
        window.verificarAlertasStockAutomaticas()
    }

    if (!alertasStockPendientes || alertasStockPendientes.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4 small">Sin alertas de stock pendientes</div>'
        if (countEl) countEl.textContent = '0'
        return
    }

    if (countEl) countEl.textContent = alertasStockPendientes.length

    container.innerHTML = alertasStockPendientes.map((a, idx) => {
        const isAgotado = a.origen === 'stock-agotado' || a.origen === 'stock-insuficiente' || a.prioridad === 'urgente' || a.prioridad === 'alta'
        const isMedia = a.prioridad === 'media' || a.prioridad === 'normal'
        const isBaja = a.prioridad === 'baja'
        const badgeStyle = isAgotado ? 'background:#fecaca;color:#991b1b' : isMedia ? 'background:#fef3c7;color:#92400e' : 'background:#bbf7d0;color:#166534'
        const badgeText = isAgotado ? '<i class="bi bi-x-circle-fill me-1"></i>Falta de Stock' : isMedia ? '<i class="bi bi-exclamation-circle-fill me-1"></i>Baja de Stock' : '<i class="bi bi-check-circle-fill me-1"></i>Stock Bajo'
        const colorBorde = isAgotado ? '#ef4444' : isMedia ? '#f59e0b' : '#10b981'

        return `
        <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left:4px solid ${colorBorde} !important; margin-bottom: 8px;">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge px-2 py-1" style="${badgeStyle};font-size:0.68rem;font-weight:700;">${badgeText}</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text);" class="fw-bold mt-1">
                <span class="font-monospace text-primary me-1">${a.sku || '-'}</span> ${a.materialNombre}
            </div>
            <div style="font-size:0.78rem;" class="mt-1">Pedir reposición: <strong class="text-dark">${a.cantidad} und.</strong></div>
            ${a.enviadoPor ? `<div style="font-size:0.73rem;" class="text-secondary mt-1"><i class="bi bi-person me-1"></i>Origen: <strong>${a.enviadoPor}</strong></div>` : ''}
            ${a.notas ? `<div style="font-size:0.73rem;" class="text-muted mt-1">Detalle: ${a.notas}</div>` : ''}

            <div class="d-flex gap-1 mt-2 pt-1 border-top">
                <button onclick="appEditarAlertaBodega(${idx})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar"><i class="bi bi-pencil-square me-1"></i>Editar</button>
                <button onclick="appEnviarAlertaBodegaUnica(${idx})" class="btn btn-outline-success btn-sm py-1 px-2 flex-grow-1" style="font-size:0.72rem;"><i class="bi bi-send me-1"></i>A Reposición</button>
                <button onclick="appEliminarAlertaBodega(${idx})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar"><i class="bi bi-trash3-fill"></i></button>
            </div>
        </div>
        `
    }).join('')
}

function estRenderEmpleados() {
    const tbody = document.getElementById('est-empleados-lista')
    if (!tbody) return
    const datosE = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
    const empleados = datosE
    if (empleados.length === 0) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:12px;color:var(--text-muted)">Sin empleados registrados</td></tr>'; return }
    tbody.innerHTML = empleados.map((e, i) => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.id}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold">${e.nombre} ${e.apellido || ''}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.rut || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center"><span style="background:var(--info);color:#000;padding:1px 5px;border-radius:3px;font-size:0.75em">${e.rol}</span></td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.email}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.cumpleanos || '-'}</td>
        <td style="padding:6px 8px;font-size:0.85em;text-align:center">${e.telefono || '-'}</td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estEditarEmpleado(${i})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar"><i class="bi bi-pencil-square me-1"></i>Editar</button></td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estDespedirEmpleado(${i})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar"><i class="bi bi-trash3-fill me-1"></i>Despedir</button></td>
    </tr>`).join('')
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
            <td style="padding:6px 8px;text-align:center"><button onclick="estEditarCliente(${i})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar"><i class="bi bi-pencil-square me-1"></i>Editar</button></td>
            <td style="padding:6px 8px;text-align:center"><button onclick="estEliminarCliente(${i})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar"><i class="bi bi-trash3-fill"></i></button></td>
        </tr>`
    }).join('')
}

window.appEnviarAlertaVentaUnica = function (idx) {
    const a = alertasEnvioVenta[idx]
    if (!a) return

    const vendedor = a.vendedor || (usuarioActual ? usuarioActual.nombre : 'Gerente')
    const fecha = new Date().toISOString()
    const ventaId = siguienteId(ventas)
    let tarea = null

    if (a.tipoTarget === 'bodega') {
        const total = a.precioUnitario * a.cantidad
        const neto = Math.round(total / 1.19)
        const iva = total - neto

        // Descontar stock físico del inventario
        const itemInv = inventario.find(i => i.id === a.materialId || i.sku === a.sku)
        if (itemInv) {
            itemInv.stock = Math.max(0, itemInv.stock - a.cantidad)
        }

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
        tarea = new Tarea(siguienteId(tareas), 'entrega', a.materialId, a.sku, a.materialNombre, a.cantidad, 'venta', notasTarea)
        tarea.asignadoA = 'bodega'
        tarea.ventaId = ventaId
        tarea.prioridad = 'urgente'
        tarea.vendedor = vendedor
        tarea.fechaCompra = fecha
        tarea.canal = 'local'
        tarea.tipoRetiro = (a.tipoEntrega === 'inmediata' || !a.tipoEntrega) ? 'local' : a.tipoEntrega
        tarea.cliente = a.cliente
        tarea.fechaEntrega = a.fechaEntrega || null
        gestorTareas.agregarTarea(tarea)
    } else {
        const notasRepo = `Cliente: ${a.cliente}. Necesita: ${a.cantidad} und.` + (a.notas ? ` | Nota: ${a.notas}` : '')
        tarea = new Tarea(siguienteId(tareas), 'reposicion', a.materialId, a.sku, a.materialNombre, a.cantidad, 'stock-insuficiente', notasRepo)
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
    renderTablaInventario()

    if (tarea) {
        mostrarSweetToast(`Tarea POO #${tarea.id} enviada a ${a.tipoTarget === 'bodega' ? 'Bodega' : 'Reposición'}`, 'success')
    }
}

window.appEliminarAlertaVenta = function (idx) {
    alertasEnvioVenta.splice(idx, 1)
    guardarTodo()
    renderEnvioTareasVenta()
}

window.appEnviarAlertaBodegaUnica = function (idx) {
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

window.appEliminarAlertaBodega = function (idx) {
    alertasStockPendientes.splice(idx, 1)
    guardarTodo()
    renderEnvioTareasBodega()
}

window.appEditarAlertaVenta = function (idx) {
    const a = alertasEnvioVenta[idx]
    if (!a) return
    const esBodega = a.tipoTarget === 'bodega'

    document.getElementById('alerta-edit-idx').value = idx
    document.getElementById('alerta-edit-origen').value = 'venta'
    document.getElementById('alerta-edit-tipo-target').value = a.tipoTarget || 'bodega'
    document.getElementById('alerta-edit-notas').value = a.notas || ''

    const entregaWrap = document.getElementById('alerta-edit-entrega-wrap')
    const fechaWrap = document.getElementById('alerta-edit-fecha-wrap')
    const prioridadWrap = document.getElementById('alerta-edit-prioridad-wrap')
    const entregaSelect = document.getElementById('alerta-edit-entrega')
    const prioridadSelect = document.getElementById('alerta-edit-prioridad')
    const fechaInput = document.getElementById('alerta-edit-fecha')

    if (esBodega) {
        if (entregaWrap) entregaWrap.style.display = 'block'
        if (prioridadWrap) prioridadWrap.style.display = 'none'
        if (entregaSelect) entregaSelect.value = a.tipoEntrega || 'inmediata'
        if (fechaInput) fechaInput.value = a.fechaEntrega ? a.fechaEntrega.slice(0, 10) : ''
        appToggleFechaEntrega(a.tipoEntrega || 'inmediata')
    } else {
        if (entregaWrap) entregaWrap.style.display = 'none'
        if (prioridadWrap) prioridadWrap.style.display = 'block'
        if (prioridadSelect) prioridadSelect.value = a.prioridad || 'urgente'
        if (fechaWrap) fechaWrap.style.display = 'none'
    }

    document.getElementById('modal-editar-alerta').style.display = 'flex'
}

window.appEditarAlertaBodega = function (idx) {
    const a = alertasStockPendientes[idx]
    if (!a) return
    document.getElementById('alerta-edit-idx').value = idx
    document.getElementById('alerta-edit-origen').value = 'bodega'
    document.getElementById('alerta-edit-tipo-target').value = 'bodega'
    document.getElementById('alerta-edit-notas').value = a.notas || ''

    const entregaWrap = document.getElementById('alerta-edit-entrega-wrap')
    const fechaWrap = document.getElementById('alerta-edit-fecha-wrap')
    const prioridadWrap = document.getElementById('alerta-edit-prioridad-wrap')
    const prioridadSelect = document.getElementById('alerta-edit-prioridad')

    if (entregaWrap) entregaWrap.style.display = 'none'
    if (fechaWrap) fechaWrap.style.display = 'none'
    if (prioridadWrap) prioridadWrap.style.display = 'block'
    if (prioridadSelect) prioridadSelect.value = a.prioridad || 'media'

    document.getElementById('modal-editar-alerta').style.display = 'flex'
}

window.appCerrarModalEditarAlerta = function () {
    const modal = document.getElementById('modal-editar-alerta')
    if (modal) modal.style.display = 'none'

    const wraps = ['alerta-edit-entrega-wrap', 'alerta-edit-fecha-wrap', 'alerta-edit-prioridad-wrap']
    wraps.forEach(id => {
        const el = document.getElementById(id)
        if (el) el.style.display = 'none'
    })
    const fechaInput = document.getElementById('alerta-edit-fecha')
    if (fechaInput) fechaInput.value = ''
}

window.appToggleFechaEntrega = function (tipo) {
    const fechaWrap = document.getElementById('alerta-edit-fecha-wrap')
    if (fechaWrap) fechaWrap.style.display = tipo === 'domicilio' ? 'block' : 'none'
}

window.appGuardarAtributosAlerta = function () {
    const idx = parseInt(document.getElementById('alerta-edit-idx').value)
    const origen = document.getElementById('alerta-edit-origen').value
    const tipoTarget = document.getElementById('alerta-edit-tipo-target').value
    const notas = document.getElementById('alerta-edit-notas').value.trim()
    const fechaVal = document.getElementById('alerta-edit-fecha').value

    if (origen === 'venta') {
        const a = alertasEnvioVenta[idx]
        if (a) {
            if (tipoTarget === 'bodega') {
                const tipoEntrega = document.getElementById('alerta-edit-entrega').value
                a.tipoEntrega = tipoEntrega
                a.fechaEntrega = (tipoEntrega === 'domicilio' && fechaVal) ? new Date(fechaVal).toISOString() : null
            } else {
                const prioridad = document.getElementById('alerta-edit-prioridad').value
                a.prioridad = prioridad
            }
            a.notas = notas
        }
        renderEnvioTareasVenta()
    } else {
        const a = alertasStockPendientes[idx]
        if (a) {
            const prioridad = document.getElementById('alerta-edit-prioridad').value
            a.prioridad = prioridad
            a.notas = notas
        }
        renderEnvioTareasBodega()
    }

    guardarTodo()
    appCerrarModalEditarAlerta()
}/* ==================== RENDER: BODEGA ==================== */
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
    renderInventarioTabla(inventario)

    const btnAdd = document.getElementById('btn-add-material')
    if (btnAdd) btnAdd.addEventListener('click', onAddMaterial)
}

function onAddMaterial() {
    Swal.fire({
        title: 'Agregar Material',
        html: `
            <div class="text-start">
                <label class="form-label small fw-semibold">Tipo</label>
                <select id="swal-mat-tipo" class="swal2-select">
                    <option value="Melamina">Melamina</option>
                    <option value="MDF">MDF</option>
                    <option value="Terciado">Terciado</option>
                    <option value="Durolac">Durolac</option>
                    <option value="OSB">OSB</option>
                </select>
                <label class="form-label small fw-semibold mt-2">Marca</label>
                <input id="swal-mat-marca" class="swal2-input" placeholder="Marca">
                <label class="form-label small fw-semibold mt-2">Espesor (mm)</label>
                <input id="swal-mat-espesor" class="swal2-input" type="number" placeholder="Espesor">
                <label class="form-label small fw-semibold mt-2">Color</label>
                <input id="swal-mat-color" class="swal2-input" placeholder="Color">
                <label class="form-label small fw-semibold mt-2">Stock inicial</label>
                <input id="swal-mat-stock" class="swal2-input" type="number" placeholder="Stock">
                <label class="form-label small fw-semibold mt-2">Precio con IVA</label>
                <input id="swal-mat-precio" class="swal2-input" type="number" placeholder="Precio">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Agregar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
            const tipo = document.getElementById('swal-mat-tipo').value
            const marca = document.getElementById('swal-mat-marca').value.trim()
            const espesor = document.getElementById('swal-mat-espesor').value
            const color = document.getElementById('swal-mat-color').value.trim()
            const stock = document.getElementById('swal-mat-stock').value
            const precio = document.getElementById('swal-mat-precio').value
            if (!marca || !espesor || !color || !stock || !precio) {
                Swal.showValidationMessage('Complete todos los campos')
                return false
            }
            return { tipo, marca, espesor, color, stock, precio }
        }
    }).then(res => {
        if (!res.isConfirmed) return
        const { tipo, marca, espesor, color, stock, precio } = res.value
        const prefijos = { 'Melamina': 'MEL', 'MDF': 'MDF', 'Terciado': 'TER', 'Durolac': 'DUR', 'OSB': 'OSB' }
        const prefijo = prefijos[tipo] || 'OTR'
        const nuevoId = siguienteId(inventario)
        inventario.push({
            id: nuevoId,
            sku: `${prefijo}-${String(nuevoId).padStart(3, '0')}`,
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
        mostrarSweetToast('Material agregado al inventario', 'success')
    })
}

/* ==================== RENDER: OPCIONES ==================== */
function onRenderOpciones() {
    const campos = [
        'opt-nombre-tienda', 'opt-direccion', 'opt-email',
        'opt-telefono', 'opt-web', 'opt-contacto', 'opt-rut', 'opt-giro'
    ]
    const mapKeys = {
        'opt-nombre-tienda': 'nombre',
        'opt-direccion': 'direccion',
        'opt-email': 'email',
        'opt-telefono': 'telefono',
        'opt-web': 'web',
        'opt-contacto': 'contacto',
        'opt-rut': 'rut',
        'opt-giro': 'giro'
    }
    campos.forEach(id => {
        const el = document.getElementById(id)
        if (el) el.value = tiendaConfig[mapKeys[id]] || ''
    })

    const formTienda = document.getElementById('form-tienda')
    if (formTienda) {
        formTienda.addEventListener('submit', function (e) {
            e.preventDefault()
            campos.forEach(id => {
                const el = document.getElementById(id)
                if (el) tiendaConfig[mapKeys[id]] = el.value
            })
            guardarTodo()
            actualizarNavbar()
        })
    }

    // Info del Sistema
    const elSistema = document.getElementById('info-sistema-datos')
    if (elSistema) {
        const version = '4.2.0 POO Enterprise'
        const navegador = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge)\/?\s*(\d+)/)?.[0] || 'Navegador Estándar'
        const lsTotal = Object.keys(localStorage).reduce((acc, k) => acc + (localStorage.getItem(k)?.length || 0), 0)
        const lsKB = (lsTotal / 1024).toFixed(1)
        const lastSync = localStorage.getItem('fs_last_api_sync') || 'Simulación Local Activa'
        const uptimeSeg = Math.floor((Date.now() - (window._appStart || Date.now())) / 1000)
        const uptimeMin = Math.floor(uptimeSeg / 60)
        const uptimeStr = uptimeMin >= 60 ? `${Math.floor(uptimeMin/60)}h ${uptimeMin%60}m` : `${uptimeMin}m ${uptimeSeg%60}s`
        const numInv = inventario ? inventario.length : 0
        const numVentas = ventas ? ventas.length : 0
        const numTareas = tareas ? tareas.length : 0
        const numProv = proveedores ? proveedores.length : 0

        elSistema.innerHTML = `
            <div class="p-3 rounded-2 mb-2 border" style="background:#f8fafc;border-color:#e2e8f0;">
                <div class="fw-bold text-dark mb-2"><i class="bi bi-cpu me-1 text-primary"></i> Full.Stock Management Suite v${version}</div>
                <div class="row g-1.5 small">
                    <div class="col-6 text-secondary">Motor de Datos:</div><div class="col-6 text-dark fw-semibold">LocalStorage Engine (${lsKB} KB)</div>
                    <div class="col-6 text-secondary">Tiempo de Sesión:</div><div class="col-6 text-dark fw-semibold">${uptimeStr}</div>
                    <div class="col-6 text-secondary">Sincronización API:</div><div class="col-6 text-dark fw-semibold">${lastSync}</div>
                    <div class="col-6 text-secondary">Navegador Cliente:</div><div class="col-6 text-dark fw-semibold">${navegador}</div>
                    <div class="col-6 text-secondary">Arquitectura Software:</div><div class="col-6 text-dark fw-semibold">SPA + ES2022 POO + Async Events</div>
                    <div class="col-6 text-secondary">Registros en Memoria:</div><div class="col-6 text-dark fw-semibold">${numInv} insumos | ${numVentas} ventas</div>
                    <div class="col-6 text-secondary">Tareas Kanban:</div><div class="col-6 text-dark fw-semibold">${numTareas} activas | ${numProv} proveedores</div>
                    <div class="col-6 text-secondary">Estado Servidor:</div><div class="col-6 text-success fw-semibold"><i class="bi bi-circle-fill me-1" style="font-size:0.5rem;"></i>Operativo (100% Uptime)</div>
                </div>
            </div>
            <div class="p-3 rounded-2 border" style="background:#e0e7ff;border-color:#c7d2fe;">
                <div class="fw-bold small" style="color:#3730a3;"><i class="bi bi-shield-check me-1"></i> Núcleo POO Event-Driven Integrado</div>
                <div class="text-secondary small mt-1">Gestión asincrónica de estado, alertas automáticas de inventario y trazabilidad total.</div>
            </div>
        `
    }
}

/* ==================== INVENTARIO & KANBAN RENDER ==================== */

function obtenerListaBodegueros() {
    const empLocal = localStorage.getItem('fs_empleados') || sessionStorage.getItem('fs_empleados')
    let empleados = (empLocal && JSON.parse(empLocal).length > 0)
        ? JSON.parse(empLocal)
        : (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []

    let bodegueros = empleados.filter(e => e.rol === 'Bodeguero' || e.rol === 'Bodega')
    if (bodegueros.length === 0) {
        bodegueros = empleados
    }
    if (bodegueros.length === 0) {
        bodegueros = [
            { nombre: 'Luis', apellido: 'Morales', rol: 'Bodeguero' },
            { nombre: 'Ana', apellido: 'Ramirez', rol: 'Bodeguero' },
            { nombre: 'Felipe', apellido: 'Castro', rol: 'Bodeguero' }
        ]
    }
    return bodegueros
}

window.renderBodegaKanban = function() {
    const elEntrantes = document.getElementById('bod-entrantes')
    const elProceso = document.getElementById('bod-proceso')
    const elEntregados = document.getElementById('bod-entregados')

    const cntEnt = document.getElementById('bod-ent-count')
    const cntProc = document.getElementById('bod-proc-count')
    const cntComp = document.getElementById('bod-comp-count')

    if (!elEntrantes && !elProceso && !elEntregados) return

    const tareasBodega = tareas.filter(t => (t.asignadoA === 'bodega' || t.tipo === 'entrega') && t.estado !== 'archivada' && t.estado !== 'eliminada')

    // 1. COLUMNA 1: TAREAS ENTRANTES (pendiente / enviada)
    const entrantes = tareasBodega.filter(t => t.estado === 'pendiente' || t.estado === 'enviada' || !t.estado)

    // Ordenamiento por urgencia: Inmediatas primero, luego fecha de entrega más próxima arriba
    entrantes.sort((a, b) => {
        const esInmediataA = a.tipoRetiro === 'local' || a.tipoRetiro === 'inmediata' || !a.tipoRetiro
        const esInmediataB = b.tipoRetiro === 'local' || b.tipoRetiro === 'inmediata' || !b.tipoRetiro

        if (esInmediataA && !esInmediataB) return -1
        if (!esInmediataA && esInmediataB) return 1

        const fechaA = new Date(a.fechaEntrega || a.fechaLimite || a.fechaCreacion || 0)
        const fechaB = new Date(b.fechaEntrega || b.fechaLimite || b.fechaCreacion || 0)
        return fechaA - fechaB
    })

    // 2. COLUMNA 2: EN PROCESO (asignada / en_proceso / preparando)
    const proceso = tareasBodega.filter(t => t.estado === 'asignada' || t.estado === 'en_proceso' || t.estado === 'preparando')

    // 3. COLUMNA 3: ENTREGADOS / ANULADOS (completada / cancelada)
    const entregados = tareasBodega.filter(t => t.estado === 'completada' || t.estado === 'cancelada')
    entregados.sort((a, b) => new Date(b.fechaFin || b.fechaCompletada || 0) - new Date(a.fechaFin || a.fechaCompletada || 0))

    if (cntEnt) cntEnt.textContent = entrantes.length
    if (cntProc) cntProc.textContent = proceso.length
    if (cntComp) cntComp.textContent = entregados.length

    const bodegueros = obtenerListaBodegueros()

    const renderPlataformaBadge = (canal) => {
        return canal === 'online'
            ? `<span class="badge px-2 py-1" style="background:#cff4fc;color:#0284c7;font-size:0.68rem;font-weight:700;">Online</span>`
            : `<span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">Local</span>`
    }

    const renderEntregaBadge = (tipoEntrega) => {
        if (tipoEntrega === 'domicilio' || tipoEntrega === 'envio') {
            return `<span class="badge px-2 py-1" style="background:#ffedd5;color:#c2410c;font-size:0.68rem;font-weight:700;"><i class="bi bi-truck me-1"></i>Envío a domicilio</span>`
        } else if (tipoEntrega === 'retiro' || tipoEntrega === 'retiro_tienda') {
            return `<span class="badge px-2 py-1" style="background:#e0e7ff;color:#4338ca;font-size:0.68rem;font-weight:700;"><i class="bi bi-shop me-1"></i>Retiro en tienda</span>`
        } else {
            return `<span class="badge px-2 py-1" style="background:#dcfce7;color:#15803d;font-size:0.68rem;font-weight:700;"><i class="bi bi-lightning-fill me-1"></i>Inmediata</span>`
        }
    }

    const renderMaterialesBox = (t) => {
        if (t.items && t.items.length > 0) {
            return `<div class="p-2 rounded border bg-light my-1" style="font-size:0.75rem; border-color:#e2e8f0 !important;">` +
                t.items.map(it => `
                    <div class="d-flex justify-content-between align-items-center py-1 ${t.items.length > 1 ? 'border-bottom border-light-subtle' : ''}">
                        <div>
                            <span class="font-monospace fw-bold text-primary me-1">${it.sku || '-'}</span>
                            <span class="fw-semibold text-dark">${it.materialNombre || '-'}</span>
                        </div>
                        <span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">x${it.cantidad} u.</span>
                    </div>
                `).join('') + `</div>`
        } else {
            return `
                <div class="p-2 rounded border bg-light my-1 d-flex justify-content-between align-items-center" style="font-size:0.75rem; border-color:#e2e8f0 !important;">
                    <div>
                        <span class="font-monospace fw-bold text-primary me-1">${t.sku || '-'}</span>
                        <span class="fw-semibold text-dark">${t.materialNombre || '-'}</span>
                    </div>
                    <span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">x${t.cantidad} u.</span>
                </div>
            `
        }
    }

    // RENDER COLUMNA 1: TAREAS ENTRANTES (5 líneas exactas de datos + etiquetas + botones)
    if (elEntrantes) {
        if (entrantes.length === 0) {
            elEntrantes.innerHTML = '<div class="text-center text-secondary py-4 small">Sin tareas entrantes</div>'
        } else {
            elEntrantes.innerHTML = entrantes.map(t => {
                const badgeCanal = renderPlataformaBadge(t.canal)
                const badgeEntrega = renderEntregaBadge(t.tipoRetiro)
                const fechaCompraStr = t.fechaCompra ? new Date(t.fechaCompra).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : new Date(t.fechaCreacion).toLocaleDateString('es-CL')
                const fechaEntregaStr = (t.tipoRetiro === 'local' || t.tipoRetiro === 'inmediata' || !t.tipoRetiro)
                    ? 'Inmediata'
                    : (t.fechaEntrega ? new Date(t.fechaEntrega).toLocaleDateString('es-CL') : 'Pendiente')

                const opcionesTrabajadores = bodegueros.map(b => {
                    const nombreCompleto = `${b.nombre} ${b.apellido || ''}`.trim()
                    return `<option value="${nombreCompleto}">${nombreCompleto} (${b.rol || 'Bodeguero'})</option>`
                }).join('')

                return `
                <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left: 4px solid #3b82f6 !important;">
                    <!-- Etiquetas -->
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="d-flex gap-1">
                            ${badgeCanal}
                            ${badgeEntrega}
                        </div>
                        <span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;font-family:monospace;">#${t.id}</span>
                    </div>

                    <!-- 1ª Línea: Vendedor, Fecha de compra -->
                    <div class="text-secondary mb-1" style="font-size:0.74rem;">
                        <i class="bi bi-person me-1"></i>Vendedor: <strong class="text-dark">${t.vendedor || 'Carlos'}</strong> | <i class="bi bi-calendar3 me-1"></i>Fecha compra: <strong class="text-dark">${fechaCompraStr}</strong>
                    </div>

                    <!-- 2ª Línea: SKU, Material y características, Cantidad (duplicado si carrito) -->
                    ${renderMaterialesBox(t)}

                    <!-- 3ª Línea: Código único de transacción -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-receipt me-1"></i>Cod. TRX: <strong class="text-dark">V-${String(t.ventaId || t.id).padStart(4, '0')}</strong>
                    </div>

                    <!-- 4ª Línea: Id del cliente -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-person-check me-1"></i>ID Cliente: <strong class="text-dark">${t.cliente || 'CLI-001'}</strong>
                    </div>

                    <!-- 5ª Línea: Fecha de entrega -->
                    <div class="text-secondary mb-2" style="font-size:0.73rem;">
                        <i class="bi bi-clock-history me-1"></i>Fecha de entrega: <strong class="text-indigo">${fechaEntregaStr}</strong>
                    </div>

                    <!-- Botones: Encargados (select) + Cancelar (justificado a la derecha) -->
                    <div class="mt-2 pt-1 border-top d-flex align-items-center justify-content-between gap-1">
                        <div class="flex-grow-1">
                            <select onchange="if(this.value) appBodegaAsignarTrabajador(${t.id}, this.value)" class="form-select form-select-sm py-1" style="font-size:0.72rem;">
                                <option value="">-- Encargado --</option>
                                ${opcionesTrabajadores}
                            </select>
                        </div>
                        <button onclick="appBodegaCancelarTarea(${t.id})" class="btn btn-outline-danger btn-sm py-1 px-2 text-nowrap ms-auto" style="font-size:0.72rem;">
                            Cancelar
                        </button>
                    </div>
                </div>
                `
            }).join('')
        }
    }

    // RENDER COLUMNA 2: EN PROCESO (6 líneas exactas de datos + etiquetas + botones)
    if (elProceso) {
        if (proceso.length === 0) {
            elProceso.innerHTML = '<div class="text-center text-secondary py-4 small">Sin tareas en proceso</div>'
        } else {
            elProceso.innerHTML = proceso.map(t => {
                const badgeCanal = renderPlataformaBadge(t.canal)
                const badgeEntrega = renderEntregaBadge(t.tipoRetiro)
                const badgeError = t.errorStock ? `                                <span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;"><i class="bi bi-exclamation-triangle me-1"></i>Error de Stock</span>` : ''

                const fechaCompraStr = t.fechaCompra ? new Date(t.fechaCompra).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : new Date(t.fechaCreacion).toLocaleDateString('es-CL')
                const fechaEntregaStr = (t.tipoRetiro === 'local' || t.tipoRetiro === 'inmediata' || !t.tipoRetiro)
                    ? 'Inmediata'
                    : (t.fechaEntrega ? new Date(t.fechaEntrega).toLocaleDateString('es-CL') : 'Pendiente')

                const timerInfo = timersEnProceso[t.id]
                const estaPreparando = t.estado === 'preparando' || (timerInfo && !timerInfo.completado)
                const yaListo = timerInfo && timerInfo.completado

                let mensajeTimerHtml = ''
                if (estaPreparando) {
                    const txtMsg = (t.tipoRetiro === 'domicilio' || t.tipoRetiro === 'envio') ? '<i class="bi bi-truck me-1"></i>Enviando a domicilio...' : '<i class="bi bi-box me-1"></i>Preparando entrega...'
                    mensajeTimerHtml = `<div class="alert alert-info py-1 px-2 my-1.5 text-center font-monospace fw-bold shadow-sm timer-pulse" style="font-size:0.73rem;">${txtMsg}</div>`
                } else if (yaListo || t.estado === 'preparado') {
                    mensajeTimerHtml = `<div class="alert alert-success py-1 px-2 my-1.5 text-center font-monospace fw-bold shadow-sm" style="font-size:0.73rem;"><i class="bi bi-check-circle-fill text-success me-1"></i>Preparación lista • Entregar pedido</div>`
                }

                return `
                <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left: 4px solid #eab308 !important;">
                    <!-- Etiquetas -->
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="d-flex gap-1 flex-wrap">
                            ${badgeCanal}
                            ${badgeEntrega}
                            ${badgeError}
                        </div>
                        <span class="badge px-2 py-1" style="background:#fef3c7;color:#92400e;font-size:0.68rem;font-weight:700;font-family:monospace;">#${t.id}</span>
                    </div>

                    <!-- 1ª Línea: Vendedor, Fecha de compra -->
                    <div class="text-secondary mb-1" style="font-size:0.74rem;">
                        <i class="bi bi-person me-1"></i>Vendedor: <strong class="text-dark">${t.vendedor || 'Carlos'}</strong> | <i class="bi bi-calendar3 me-1"></i>Fecha compra: <strong class="text-dark">${fechaCompraStr}</strong>
                    </div>

                    <!-- 2ª Línea: SKU, Material y características, Cantidad (duplicado si carrito) -->
                    ${renderMaterialesBox(t)}

                    <!-- 3ª Línea: Código único de transacción -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-receipt me-1"></i>Cod. TRX: <strong class="text-dark">V-${String(t.ventaId || t.id).padStart(4, '0')}</strong>
                    </div>

                    <!-- 4ª Línea: Id del cliente -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-person-check me-1"></i>ID Cliente: <strong class="text-dark">${t.cliente || 'CLI-001'}</strong>
                    </div>

                    <!-- 5ª Línea: Fecha de entrega -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-clock-history me-1"></i>Fecha de entrega: <strong class="text-indigo">${fechaEntregaStr}</strong>
                    </div>

                    <!-- 6ª Línea: Encargado de la tarea -->
                    <div class="text-amber-700 fw-bold my-1 p-1 bg-warning-subtle rounded text-center" style="font-size:0.74rem; color:#b45309 !important;">
                        <i class="bi bi-person-fill-check me-1"></i>Encargado: ${t.trabajadorAsignado || 'Bodega'}
                    </div>

                    ${mensajeTimerHtml}

                    <!-- Botones: Iniciar tarea (5s), Entregar pedido, Cancelar tarea -->
                    <div class="mt-2 pt-1 border-top d-flex align-items-center gap-1">
                        ${!estaPreparando && !yaListo ? `
                            <button onclick="appBodegaIniciar(${t.id})" class="btn btn-outline-warning btn-sm py-1 px-2 fw-bold flex-grow-1" style="font-size:0.72rem;">
                                <i class="bi bi-play-fill me-1"></i> Iniciar Tarea
                            </button>
                        ` : ''}
                        
                        ${yaListo || (!estaPreparando && t.estado === 'preparado') ? `
                            <button onclick="appBodegaCompletar(${t.id})" class="btn btn-outline-success btn-sm py-1 px-2 fw-bold flex-grow-1" style="font-size:0.72rem;">
                                <i class="bi bi-check-circle-fill me-1"></i> Entregar Pedido
                            </button>
                        ` : ''}

                        <button onclick="appBodegaCancelarTarea(${t.id})" class="btn btn-outline-danger btn-sm py-1 px-2 text-nowrap ms-auto" style="font-size:0.72rem;">
                            Cancelar
                        </button>
                    </div>
                </div>
                `
            }).join('')
        }
    }

    // RENDER COLUMNA 3: ENTREGADOS / ANULADOS (6 líneas exactas de datos + etiquetas + botón Archivar)
    if (elEntregados) {
        if (entregados.length === 0) {
            elEntregados.innerHTML = '<div class="text-center text-secondary py-4 small">Sin registros entregados / anulados</div>'
        } else {
            elEntregados.innerHTML = entregados.map(t => {
                const esCancelada = t.estado === 'cancelada'
                const badgeEstado = esCancelada
                    ? `<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;"><i class="bi bi-x-octagon-fill me-1"></i>Anulado / Reembolsado</span>`
                    : `<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;"><i class="bi bi-check-circle-fill me-1"></i>Entregado</span>`

                const fechaCompraStr = t.fechaCompra ? new Date(t.fechaCompra).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : new Date(t.fechaCreacion).toLocaleDateString('es-CL')
                const fechaTerminoStr = t.fechaFin ? new Date(t.fechaFin).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : (t.fechaCompletada ? new Date(t.fechaCompletada).toLocaleDateString('es-CL') : '-')

                return `
                <div class="kanban-card p-2.5 mb-2 bg-white rounded-3 shadow-sm border" style="border-left: 4px solid ${esCancelada ? '#fb7185' : '#86efac'} !important;">
                    <!-- Etiquetas -->
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        ${badgeEstado}
                        <span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;font-family:monospace;">#${t.id}</span>
                    </div>

                    <!-- 1ª Línea: Vendedor, Fecha de compra -->
                    <div class="text-secondary mb-1" style="font-size:0.74rem;">
                        <i class="bi bi-person me-1"></i>Vendedor: <strong class="text-dark">${t.vendedor || 'Carlos'}</strong> | <i class="bi bi-calendar3 me-1"></i>Fecha compra: <strong class="text-dark">${fechaCompraStr}</strong>
                    </div>

                    <!-- 2ª Línea: SKU, Material y características, Cantidad (duplicado si carrito) -->
                    ${renderMaterialesBox(t)}

                    <!-- 3ª Línea: Código único de transacción -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-receipt me-1"></i>Cod. TRX: <strong class="text-dark">V-${String(t.ventaId || t.id).padStart(4, '0')}</strong>
                    </div>

                    <!-- 4ª Línea: Id del cliente -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-person-check me-1"></i>ID Cliente: <strong class="text-dark">${t.cliente || 'CLI-001'}</strong>
                    </div>

                    <!-- 5ª Línea: Fecha en que se entregó o se anuló la tarea -->
                    <div class="text-secondary mb-1" style="font-size:0.73rem;">
                        <i class="bi bi-clock-history me-1"></i>Fecha término / anulación: <strong class="${esCancelada ? 'text-danger' : 'text-success'}">${fechaTerminoStr}</strong>
                    </div>

                    <!-- 6ª Línea: Encargado de la tarea -->
                    <div class="text-dark fw-semibold mb-2" style="font-size:0.74rem;">
                        <i class="bi bi-person-fill-check me-1"></i>Encargado: ${t.trabajadorAsignado || 'Bodega'}
                    </div>

                    <!-- Botón Archivar -->
                    <div class="mt-2 pt-1 text-end border-top">
                        <button onclick="appBodegaArchivar(${t.id})" class="btn btn-outline-secondary btn-sm py-1 px-2" style="font-size:0.72rem;">
                            <i class="bi bi-archive me-1"></i> Archivar
                        </button>
                    </div>
                </div>
                `
            }).join('')
        }
    }

    if (typeof renderEnvioTareasBodega === 'function') {
        renderEnvioTareasBodega()
    }
}

// Nota: renderReposicionKanban y sus funciones de ciclo de vida (iniciar, negociar 10s, comprar, recepcionar 10s, archivar) se gestionan desde data.js

function renderBodegaInventario() {
    const tbody = document.getElementById('tbody-inventario-bodega')
    if (!tbody) return
    if (!inventario || inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-3 text-secondary">Sin datos de inventario</td></tr>'
        return
    }
    const maxItems = inventario
    maxItems.sort((a, b) => (a.stock || 0) - (b.stock || 0))
    tbody.innerHTML = maxItems.map(item => {
        const estadoBadge = item.stock === 0
            ? '<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Agotado</span>'
            : item.stock <= STOCK_MINIMO
                ? '<span class="badge px-2 py-1" style="background:#fef3c7;color:#92400e;font-size:0.68rem;font-weight:700;">Bajo</span>'
                : '<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">Normal</span>'

        const dimStr = (item.largo && item.ancho) 
            ? `${item.largo} x ${item.ancho} mm` 
            : (item.alto && item.largo ? `${item.largo} x ${item.alto} mm` : '2440 x 1520 mm')

        return `<tr>
            <td class="text-center font-monospace fw-bold text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.sku}</td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${item.material}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.color || '-'}</td>
            <td class="text-center text-dark font-monospace" style="padding:10px 12px;font-size:0.8rem;">${item.espesor ? item.espesor + ' mm' : '-'}</td>
            <td class="text-center text-secondary font-monospace" style="padding:10px 12px;font-size:0.78rem;">${dimStr}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.marca || '-'}</td>
            <td class="text-center" style="padding:10px 12px;"><span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">${item.categoria || 'Grumal'}</span></td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${item.stock} u.</td>
            <td class="text-center" style="padding:10px 12px;">${estadoBadge}</td>
            <td class="text-center" style="padding:10px 12px;">
                <button onclick="pedirRepoDirecto(${item.id})" class="btn btn-outline-warning btn-sm py-1 px-2" style="font-size:0.72rem;">+ Pedir Reposición</button>
            </td>
        </tr>`
    }).join('')
}

function renderRepoInventario() {
    const tbody = document.getElementById('tbody-inventario-reposicion')
    if (!tbody) return
    if (!inventario || inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-3 text-secondary">Sin datos de inventario</td></tr>'
        return
    }
    const maxItems = inventario
    maxItems.sort((a, b) => (a.stock || 0) - (b.stock || 0))
    tbody.innerHTML = maxItems.map(item => {
        const estadoBadge = item.stock === 0
            ? '<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Crítico</span>'
            : item.stock <= STOCK_MINIMO
                ? '<span class="badge px-2 py-1" style="background:#fef3c7;color:#92400e;font-size:0.68rem;font-weight:700;">Reponer</span>'
                : '<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">Óptimo</span>'

        const dimStr = (item.largo && item.ancho) 
            ? `${item.largo} x ${item.ancho} mm` 
            : (item.alto && item.largo ? `${item.largo} x ${item.alto} mm` : '2440 x 1520 mm')

        return `<tr>
            <td class="text-center font-monospace fw-bold text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.sku}</td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${item.material}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.color || '-'}</td>
            <td class="text-center text-dark font-monospace" style="padding:10px 12px;font-size:0.8rem;">${item.espesor ? item.espesor + ' mm' : '-'}</td>
            <td class="text-center text-secondary font-monospace" style="padding:10px 12px;font-size:0.78rem;">${dimStr}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.marca || '-'}</td>
            <td class="text-center" style="padding:10px 12px;"><span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">${item.categoria || 'Grumal'}</span></td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${item.stock} u.</td>
            <td class="text-center" style="padding:10px 12px;">${estadoBadge}</td>
            <td class="text-center" style="padding:10px 12px;">
                <button onclick="pedirRepoDirecto(${item.id})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;"><i class="bi bi-cart-plus me-1"></i>Orden de Compra</button>
            </td>
        </tr>`
    }).join('')
}

window.pedirRepoDirecto = function (id) {
    const item = inventario.find(i => i.id === id)
    if (!item) return
    const vendedor = usuarioActual ? usuarioActual.nombre : 'Gerente'

    let prioridadAlert = 'normal' // Stock > 5 = VERDE
    let colorTexto = 'VERDE (Stock > 5)'

    if (item.stock === 0) {
        prioridadAlert = 'urgente' // Stock = 0 = ROJO
        colorTexto = 'ROJA (Stock = 0)'
    } else if (item.stock <= 5) {
        prioridadAlert = 'media' // Stock 1 a 5 = NARANJA
        colorTexto = 'NARANJA (Stock <= 5)'
    }

    // Agregar la alerta de stock a Envío Tareas (NO directamente a Reposición)
    alertasStockPendientes.push({
        id: Date.now() + Math.random(),
        materialId: item.id,
        sku: item.sku,
        materialNombre: `${item.material} ${item.color || ''} ${item.espesor ? item.espesor + 'mm' : ''}`.trim(),
        cantidad: Math.max(1, STOCK_MINIMO + 1 - item.stock),
        prioridad: prioridadAlert,
        origen: 'solicitud-manual',
        notas: `Solicitud manual desde inventario (Stock actual: ${item.stock} u.)`,
        enviadoPor: vendedor
    })

    guardarTodo()

    renderEnvioTareasBodega()
    renderBodegaKanban()
    renderTablaInventario()
    renderBodegaInventario()
    if (typeof mostrarSweetToast === 'function') {
        mostrarSweetToast(`📋 Alerta ${colorTexto} agregada a Envío Tareas para "${item.sku}". Transmítela manualmente a Reposición.`, 'info')
    }
}

function renderInventarioTabla(items) {
    const tbody = document.getElementById('lista-inventario-tabla')
    if (!tbody) return
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-3 text-secondary">Sin materiales en inventario</td></tr>'
        return
    }
    const maxItems = items
    maxItems.sort((a, b) => (a.stock || 0) - (b.stock || 0))
    tbody.innerHTML = maxItems.map(item => {
        const estadoBadge = item.stock === 0
            ? '<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Agotado</span>'
            : item.stock <= STOCK_MINIMO
                ? '<span class="badge px-2 py-1" style="background:#fef3c7;color:#92400e;font-size:0.68rem;font-weight:700;">Bajo</span>'
                : '<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">Normal</span>'

        const dimStr = (item.largo && item.ancho)
            ? `${item.largo} x ${item.ancho} mm`
            : (item.alto && item.largo ? `${item.largo} x ${item.alto} mm` : '2440 x 1520 mm')

        return `<tr>
            <td class="text-center font-monospace fw-bold text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.sku}</td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${item.material}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.color || '-'}</td>
            <td class="text-center text-dark font-monospace" style="padding:10px 12px;font-size:0.8rem;">${item.espesor ? item.espesor + ' mm' : '-'}</td>
            <td class="text-center text-secondary font-monospace" style="padding:10px 12px;font-size:0.78rem;">${dimStr}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${item.marca || '-'}</td>
            <td class="text-center" style="padding:10px 12px;"><span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">${item.categoria || 'Grumal'}</span></td>
            <td class="text-center fw-bold text-dark" style="padding:10px 12px;font-size:0.82rem;">${item.stock} u.</td>
            <td class="text-center" style="padding:10px 12px;">${estadoBadge}</td>
            <td class="text-center fw-bold text-indigo" style="padding:10px 12px;font-size:0.8rem;">${formatearCLP(item.precio)}</td>
        </tr>`
    }).join('')
}


window.onBuscarInventario = function (query) {
    if (!query || !query.trim()) {
        renderInventarioTabla(inventario)
        return
    }
    const q = query.toLowerCase().trim()
    const filtrados = inventario.filter(item => {
        return (item.sku && item.sku.toLowerCase().includes(q)) ||
            (item.material && item.material.toLowerCase().includes(q)) ||
            (item.color && item.color.toLowerCase().includes(q)) ||
            (item.marca && item.marca.toLowerCase().includes(q)) ||
            (item.categoria && item.categoria.toLowerCase().includes(q))
    })
    renderInventarioTabla(filtrados)
}

window.onBuscarBodega = function (query) {
    const inputB = document.getElementById('input-busqueda-bodega')
    if (inputB) inputB.value = query
    renderBodegaKanban()
}

window.onBuscarReposicion = function (query) {
    const inputR = document.getElementById('input-busqueda-reposicion')
    if (inputR) inputR.value = query
    renderReposicionKanban()
}

window.onBuscarEstadisticas = function (query) {
    const q = query.toLowerCase().trim()
    document.querySelectorAll('.est-tab').forEach(tab => {
        const tbody = tab.querySelector('tbody')
        if (!tbody) return
        const rows = tbody.querySelectorAll('tr')
        rows.forEach(row => {
            const text = row.textContent.toLowerCase()
            row.style.display = text.includes(q) ? '' : 'none'
        })
    })
}

/* ==================== ESTADISTICAS ==================== */
window.showEstTab = function showEstTab(tab, evt) {
    document.querySelectorAll('.est-tab').forEach(el => el.style.display = 'none')
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'))
    const panel = document.getElementById('tab-' + tab)
    if (panel) panel.style.display = 'block'
    if (evt && evt.target) evt.target.classList.add('active')
}

window._charts = window._charts || {}

function renderEstadisticasGraficos() {
    if (typeof Chart === 'undefined') return

    const ctx1 = document.getElementById('chart-ventas-egresos')
    if (ctx1) {
        if (window._charts.balanceChart) window._charts.balanceChart.destroy()

        const ingresos = ventas.filter(v => v.estado === 'completada').reduce((s, v) => s + v.total, 0)
        const egresosCompras = tareas.filter(t => t.tipo === 'reposicion' && ['comprada', 'completada'].includes(t.estado)).reduce((s, t) => s + (t.totalCompra || 0), 0)
        const reembolsos = (typeof ventasAnuladas !== 'undefined' ? ventasAnuladas : []).reduce((s, v) => s + (v.montoReembolso || 0), 0)
        const egresosTotales = egresosCompras + reembolsos
        const dinero = (tiendaConfig.dineroInicial !== undefined ? tiendaConfig.dineroInicial : 5000000)

        window._charts.balanceChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ['Caja Inicial', 'Ingresos Ventas', 'Egresos Reposición'],
                datasets: [{
                    label: 'Monto ($ CLP)',
                    data: [dinero, ingresos, egresosTotales],
                    backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (val) { return '$' + (val / 1000).toFixed(0) + 'k' }
                        }
                    }
                }
            }
        })
    }

    const ctx2 = document.getElementById('chart-stock-categoria')
    if (ctx2) {
        if (window._charts.catChart) window._charts.catChart.destroy()

        const catCounts = {}
        if (typeof inventario !== 'undefined' && Array.isArray(inventario)) {
            inventario.forEach(i => {
                const cat = i.categoria || 'Grumal'
                catCounts[cat] = (catCounts[cat] || 0) + (i.stock || 0)
            })
        }

        const labels = Object.keys(catCounts)
        const data = Object.values(catCounts)
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

        window._charts.catChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['Sin datos'],
                datasets: [{
                    data: data.length ? data : [1],
                    backgroundColor: colors.slice(0, Math.max(1, labels.length))
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        })
    }
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
    renderEstadisticasGraficos()
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
    if (ventas.length === 0) { tbody.innerHTML = '<tr><td colspan="12" class="text-center py-3 text-secondary">Sin ventas registradas</td></tr>'; return }
    const maxVentas = ventas
    tbody.innerHTML = maxVentas.map(v => {
        const esAnulada = v.estado === 'anulada'
        const estadoBadge = esAnulada
            ? `<span class="badge px-2 py-1" style="background:#fecaca;color:#991b1b;font-size:0.68rem;font-weight:700;">Anulada</span>`
            : `<span class="badge px-2 py-1" style="background:#bbf7d0;color:#166534;font-size:0.68rem;font-weight:700;">Completada</span>`
        const labelCanal = v.canal === 'online' ? '<span class="badge px-2 py-1" style="background:#cff4fc;color:#155e75;font-size:0.68rem;font-weight:700;">Online</span>' : '<span class="badge px-2 py-1" style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;">Local</span>'
        let entregaStr = '-'
        if (v.canal === 'online' && v.fechaEntrega) {
            const tipo = v.tipoRetiro === 'domicilio' ? 'Envío' : 'Retiro'
            entregaStr = `${tipo} ${new Date(v.fechaEntrega).toLocaleDateString('es-CL')}`
        }
        const totalDisplay = esAnulada
            ? `<span class="text-muted text-decoration-line-through me-1" style="font-size:0.78rem;">${formatearCLP(v.total)}</span><br><span class="text-danger fw-bold" style="font-size:0.8rem;">Reembolso: ${formatearCLP(v.total)}</span>`
            : `<strong class="text-success fw-bold" style="color:#059669 !important;">${formatearCLP(v.total)}</strong>`
        const vendedorNombre = v.vendedor || (usuarioActual ? usuarioActual.nombre : 'Gerente')

        return `<tr>
            <td class="text-center font-monospace fw-bold text-dark" style="padding:10px 12px;font-size:0.8rem;">#${v.id}</td>
            <td class="text-center text-dark" style="padding:10px 12px;font-size:0.8rem;">${new Date(v.fecha).toLocaleDateString('es-CL')}</td>
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
        <td style="padding:6px 8px;text-align:center"><button onclick="estEditarEmpleado(${i})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar"><i class="bi bi-pencil-square me-1"></i>Editar</button></td>
        <td style="padding:6px 8px;text-align:center"><button onclick="estDespedirEmpleado(${i})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar"><i class="bi bi-trash3-fill me-1"></i>Despedir</button></td>
    </tr>`).join('')
}

window.estAbrirFormEmpleado = function (idx) {
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

window.estEditarEmpleado = function (idx) {
    estAbrirFormEmpleado(idx)
}

window.estGuardarEmpleado = function () {
    const idx = document.getElementById('emp-form-idx').value
    const nombre = document.getElementById('emp-form-nombre').value.trim()
    const apellido = document.getElementById('emp-form-apellido').value.trim()
    const rut = document.getElementById('emp-form-rut').value.trim()
    const cumpleanos = document.getElementById('emp-form-cumpleanos').value
    const rol = document.getElementById('emp-form-rol').value
    const email = document.getElementById('emp-form-email').value.trim()
    const password = document.getElementById('emp-form-password').value.trim()
    const telefono = document.getElementById('emp-form-telefono').value.trim()

    if (!nombre) { mostrarSweetToast('Ingrese el nombre del empleado', 'warning'); return }

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

window.estCerrarFormEmpleado = function () {
    const modal = document.getElementById('modal-empleado')
    if (modal) modal.style.display = 'none'
}

window.estDespedirEmpleado = function (idx) {
    Swal.fire({
        title: '¿Despedir empleado?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, despedir',
        cancelButtonText: 'Cancelar'
    }).then(res => {
        if (!res.isConfirmed) return
        const empleados = (datosJSON && datosJSON.perfiles && datosJSON.perfiles.empleados) || []
        empleados.splice(idx, 1)
        guardarTodo()
        estRenderEmpleados()
    })
}

function estRenderArchivos() {
    const tbody = document.getElementById('est-archivos-lista')
    if (!tbody) return
    const archivadas = tareas.filter(t => t.estado === 'archivada' || t.estado === 'completada')
    if (archivadas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text-muted)">Sin registros archivados</td></tr>'
        return
    }
    tbody.innerHTML = archivadas.map(t => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px;text-align:center">${t.id}</td>
        <td style="padding:6px;text-align:center">${t.tipo}</td>
        <td style="padding:6px;text-align:center">${t.materialNombre || t.descripcion}</td>
        <td style="padding:6px;text-align:center">${t.cantidad}</td>
        <td style="padding:6px;text-align:center">${t.estado}</td>
        <td style="padding:6px;text-align:center">${new Date(t.fechaCreacion).toLocaleDateString('es-CL')}</td>
    </tr>`).join('')
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
            <td style="padding:6px 8px;text-align:center"><button onclick="estEditarCliente(${i})" class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.72rem;" title="Editar"><i class="bi bi-pencil-square me-1"></i>Editar</button></td>
            <td style="padding:6px 8px;text-align:center"><button onclick="estEliminarCliente(${i})" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.72rem;" title="Eliminar"><i class="bi bi-trash3-fill"></i></button></td>
        </tr>`
    }).join('')
}

window.estEditarCliente = function (idx) {
    const c = clientes[idx]
    if (!c) return
    Swal.fire({
        title: 'Editar Cliente',
        html: `
            <div class="text-start">
                <label class="form-label small fw-semibold">Nombre</label>
                <input id="swal-cli-nombre" class="swal2-input" value="${c.nombre || ''}" placeholder="Nombre">
                <label class="form-label small fw-semibold mt-2">RUT</label>
                <input id="swal-cli-rut" class="swal2-input" value="${c.rut || ''}" placeholder="RUT">
                <label class="form-label small fw-semibold mt-2">Email</label>
                <input id="swal-cli-email" class="swal2-input" value="${c.email || ''}" placeholder="Email">
                <label class="form-label small fw-semibold mt-2">Teléfono</label>
                <input id="swal-cli-telefono" class="swal2-input" value="${c.telefono || ''}" placeholder="Teléfono">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
            const nombre = document.getElementById('swal-cli-nombre').value.trim()
            if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return false }
            return {
                nombre,
                rut: document.getElementById('swal-cli-rut').value.trim(),
                email: document.getElementById('swal-cli-email').value.trim(),
                telefono: document.getElementById('swal-cli-telefono').value.trim()
            }
        }
    }).then(res => {
        if (!res.isConfirmed) return
        c.nombre = res.value.nombre
        c.rut = res.value.rut
        c.email = res.value.email
        c.telefono = res.value.telefono
        guardarTodo()
        estRenderClientes()
    })
}

window.estEliminarCliente = function (idx) {
    Swal.fire({
        title: '¿Eliminar cliente?',
        text: 'El cliente será eliminado de la cartera definitivamente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(res => {
        if (!res.isConfirmed) return
        clientes.splice(idx, 1)
        guardarTodo()
        estRenderClientes()
    })
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

window.estUpdateMargen = function (itemId, value) {
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
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;max-width:200px;word-break:break-word;">${p.marcas || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.contacto || '-'}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${p.telefono || ''} | ${p.email || ''}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center">${comps.length}</td>
            <td style="padding:6px 8px;font-size:0.85em;text-align:center;font-weight:bold;color:var(--danger)">${formatearCLP(totalGastado)}</td>
        </tr>`
    }).join('')
}

/* ==================== MÓDULO 4: EVENTOS DOM, ASINCRONÍA Y CONSUMO API ==================== */

// MODAL NUEVA TAREA
window.abrirModalNuevaTarea = function (tipoDefault = 'entrega') {
    const modal = document.getElementById('modal-nueva-tarea')
    if (!modal) return
    const selectTipo = document.getElementById('nt-tipo')
    if (selectTipo) selectTipo.value = tipoDefault
    modal.style.display = 'flex'
}

window.cerrarModalNuevaTarea = function () {
    const modal = document.getElementById('modal-nueva-tarea')
    if (modal) modal.style.display = 'none'
}

// NOTIFICACIONES ASINCRÓNICAS - CENTRADAS, PEQUEÑAS, 1.5s
window.mostrarNotificacionAsync = function (mensaje, tipo = 'success') {
    // Usar BentoToast mixin de swal.js
    if (typeof Swal !== 'undefined' && window.BentoToast) {
        window.BentoToast.fire({ icon: tipo === 'error' ? 'error' : tipo === 'info' ? 'info' : 'success', title: mensaje })
        return
    }

    // Fallback DOM toast centrado
    const container = document.getElementById('app-notifications-center')
    if (!container) {
        const c = document.createElement('div')
        c.id = 'app-notifications-center'
        c.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;'
        document.body.appendChild(c)
    }
    const realContainer = document.getElementById('app-notifications-center')

    const toast = document.createElement('div')
    toast.style.cssText = 'pointer-events:auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem 1rem;box-shadow:0 4px 12px rgba(15,23,42,0.15);font-size:0.75rem;font-weight:600;max-width:320px;text-align:center;opacity:0;transform:scale(0.95);transition:all 0.15s ease;'
    const bg = tipo === 'error' ? '#fee2e2' : tipo === 'info' ? '#cff4fc' : '#dcfce7'
    const color = tipo === 'error' ? '#991b1b' : tipo === 'info' ? '#155e75' : '#166534'
    toast.style.background = bg
    toast.style.color = color
    toast.innerHTML = `<i class="bi bi-${tipo === 'error' ? 'x-circle-fill' : tipo === 'info' ? 'info-circle-fill' : 'check-circle-fill'} me-1"></i>${mensaje}`

    realContainer.appendChild(toast)

    requestAnimationFrame(() => {
        toast.style.opacity = '1'
        toast.style.transform = 'scale(1)'
    })

    setTimeout(() => {
        toast.style.opacity = '0'
        toast.style.transform = 'scale(0.95)'
        setTimeout(() => toast.remove(), 150)
    }, 1500)
};

// CONSUMO DE API EXTERNA CON FETCH Y TRY/CATCH
window.sincronizarConAPIExterna = async function () {
    try {
        const tareasNuevas = await gestorTareas.recuperarDeAPI()

        // Notificación asincrónica tras 2 segundos (setTimeout)
        setTimeout(() => {
            mostrarNotificacionAsync(`¡Sincronizacion Exitosa! ${tareasNuevas.length} tareas importadas desde API.`, 'success')
            if (typeof renderSeccion === 'function') {
                renderSeccion(seccionActual)
            } else {
                if (seccionActual === 'bodega') renderBodegaKanban()
                if (seccionActual === 'reposicion') renderReposicionKanban()
            }
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
                    el.innerHTML = `<span style="color:#ff4d4d;font-weight:bold;font-size:0.75em"><i class="bi bi-exclamation-triangle-fill me-1" style="color:#ff4d4d;"></i>Expirada</span>`
                } else {
                    const h = String(info.horas).padStart(2, '0')
                    const m = String(info.minutos).padStart(2, '0')
                    el.innerHTML = `<span style="color:#f4c522;font-weight:bold;font-size:0.75em"><i class="bi bi-clock me-1" style="color:#f4c522;"></i>${h}:${m}</span>`
                }
            }
        }
    })
}, 1000)

// HOVER MOUSEOVER Y MOUSEOUT EN TARJETAS KANBAN
window.hoverKanbanCard = function (el, e, tareaId) {
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

window.unhoverKanbanCard = function (el) {
    el.style.boxShadow = 'none'
    el.style.transform = 'none'
    const tooltip = document.getElementById('app-tooltip')
    if (tooltip) tooltip.style.display = 'none'
}

// BUSCADOR GLOBAL NAVBAR - enruta según sección activa
window.realizarBusquedaGlobal = function (query) {
    const q = query.trim().toLowerCase()
    const hint = document.getElementById('navbar-search-hint')
    if (hint) hint.classList.toggle('d-none', !q)

    if (!seccionActual) return

    switch (seccionActual) {
        case 'bodega':
            if (window.onBuscarBodega) window.onBuscarBodega(q)
            break
        case 'inventario':
            if (window.onBuscarInventario) window.onBuscarInventario(q)
            break
        case 'reposicion':
            if (window.onBuscarReposicion) window.onBuscarReposicion(q)
            break
        case 'venta':
            if (window.onBuscarVentas) window.onBuscarVentas(q)
            break
        case 'estadisticas':
            if (window.onBuscarEstadisticas) window.onBuscarEstadisticas(q)
            break
        default:
            break
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        configurarFormularioNuevaTarea()

        // Navbar global search handler
        const navbarSearch = document.getElementById('navbar-search')
        if (navbarSearch) {
            navbarSearch.addEventListener('input', (e) => {
                const q = e.target.value.trim()
                if (window.realizarBusquedaGlobal) window.realizarBusquedaGlobal(q)
            })
            navbarSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = ''
                    if (window.realizarBusquedaGlobal) window.realizarBusquedaGlobal('')
                    e.target.blur()
                }
            })
        }

        // Navbar API button handler
        const btnApiNav = document.getElementById('btn-api-nav')
        if (btnApiNav) {
            btnApiNav.addEventListener('click', () => {
                if (!seccionActual) return
                switch (seccionActual) {
                    case 'bodega':
                        if (window.sincronizarConAPIExterna) window.sincronizarConAPIExterna()
                        break
                    case 'reposicion':
                        if (window.sincronizarConAPIExterna) window.sincronizarConAPIExterna()
                        break
                    case 'inventario':
                        if (window.sincronizarConAPIExterna) window.sincronizarConAPIExterna()
                        break
                    default:
                        break
                }
            })
        }
    })
} else {
    configurarFormularioNuevaTarea()
}

