/* =============================================
   SWEETALERT MINI - Reemplazo nativo
   ============================================= */
const Swal = {
    fire: function(opts) {
        if (typeof opts === 'string') {
            alert(opts)
            return Promise.resolve()
        }

        const title = opts.title || ''
        const text = opts.text || ''
        const html = opts.html || ''
        const icon = opts.icon || ''
        const msg = html || text || ''

        if (opts.showDenyButton) {
            const fullMsg = (title ? title + '\n\n' : '') + msg
            const result = confirm(fullMsg)
            return Promise.resolve({ isConfirmed: result, isDenied: !result })
        }

        if (opts.showConfirmButton === false || opts.timer) {
            alert((title ? title + '\n' : '') + msg)
            return Promise.resolve()
        }

        if (icon === 'error' || icon === 'warning') {
            alert('⚠ ' + (title ? title + '\n' : '') + msg)
        } else if (icon === 'success') {
            alert('✓ ' + (title ? title + '\n' : '') + msg)
        } else {
            alert((title ? title + '\n' : '') + msg)
        }

        return Promise.resolve()
    }
}
