/* ==================================================
   SWAL.JS - Integración de SweetAlert2
   ================================================== */

// Toast personalizado de SweetAlert2 - Abajo a la izquierda, compacto y rápido
window.BentoToast = typeof Swal !== 'undefined' ? Swal.mixin({
    toast: true,
    position: 'bottom-start',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    width: '320px',
    padding: '0.5rem 1rem',
    background: '#ffffff',
    color: '#0f172a',
    customClass: {
        popup: 'bento-swal-toast-popup border shadow-lg'
    },
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
}) : null;

// Modal personalizado de SweetAlert2
const BentoAlert = typeof Swal !== 'undefined' ? Swal.mixin({
    background: '#ffffff',
    color: '#0f172a',
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: '#64748b',
    customClass: {
        popup: 'bento-swal-modal-popup border shadow-lg rounded-3',
        title: 'bento-swal-title text-dark fw-bold',
        confirmButton: 'btn btn-indigo px-4 py-2 font-weight-bold',
        cancelButton: 'btn btn-light border px-4 py-2 text-secondary'
    }
}) : null;

window.mostrarSweetToast = function (title, icon = 'success') {
    if (typeof Swal !== 'undefined' && BentoToast) {
        BentoToast.fire({ icon, title });
    }
};

window.confirmarAccionBento = async function (titulo, texto, confirmText = 'Sí, continuar', icon = 'question') {
    if (typeof Swal !== 'undefined') {
        const res = await BentoAlert.fire({
            title: titulo,
            text: texto,
            icon: icon,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: 'Cancelar',
            reverseButtons: true
        });
        return res.isConfirmed;
    }
    return confirm(`${titulo}\n${texto}`);
};
