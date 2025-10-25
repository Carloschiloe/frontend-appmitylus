// Adapter para reutilizar el calendario de MMPP como visor de Interacciones
// NO modifica tu /spa-mmpp/mmpp-calendario.js

function mapInteraccionesToAsignaciones(items){
  // Toma solo interacciones con fecha futura programada
  return (items || [])
    .filter(i => i && (i.fechaProx || i.proximoPasoFecha))
    .map(i => {
      const fecha = i.fechaProx || i.proximoPasoFecha;
      const d = new Date(fecha);
      // El calendario necesita día/mes/año y campos de agrupación
      return {
        // shape mínimo que tu calendario usa:
        id: i._id || null,
        destFecha: d.toISOString(),
        destDia: d.getDate(),
        destMes: d.getMonth() + 1,
        destAnio: d.getFullYear(),
        // meta negocio (solo lectura)
        proveedorNombre: i.proveedorNombre || i.contactoNombre || '—',
        proveedorKey: i.proveedorKey || i.proveedorId || '',
        centroCodigo: i.centroCodigo || '',
        comuna: i.comuna || '',
        tons: Number(i.tonsConversadas || 0),
        estado: i.estado || 'agendado',
        // por compatibilidad de UI (tu calendario lo muestra en tarjetas si agrupa por “transportista”):
        transportistaNombre: i.responsable || '—',
        // Para diferenciar la fuente si más tarde lo necesitas
        __source: 'interaccion',
        __tipo: i.proximoPaso || i.tipo || 'Interacción'
      };
    });
}

export function mountCalendar(containerEl, interacciones){
  // 1) prepara contenedor con el id que espera tu calendario
  containerEl.innerHTML = '<div id="mmppCalendario"></div>';

  // 2) provee un MMppApi "fake" SOLO para este montaje
  const asignaciones = mapInteraccionesToAsignaciones(interacciones);

  // aislamos API previo si existía
  const prevApi = window.MMppApi;

  window.MMppApi = {
    // El calendario llama estos dos para cargar datos
    getDisponibilidades: () => Promise.resolve([]),
    getAsignaciones:    () => Promise.resolve(asignaciones),

    // Desactivar edición/creación/borrado (doble click)
    crearAsignacion:  () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    editarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    borrarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' })
  };

  // 3) monta tu calendario tal cual
  if (window.MMppCalendario && typeof window.MMppCalendario.mount === 'function'){
    window.MMppCalendario.mount({ capacidadCamion: 10 });
  } else {
    // Fallback mínimo por si el JS no cargó
    containerEl.innerHTML = `
      <div class="card"><div class="card-content">
        <h6 style="margin:0 0 8px;">Calendario</h6>
        <ul style="margin:0;list-style:none;padding-left:0">
          ${asignaciones.map(a => {
            const f = new Date(a.destFecha).toLocaleString('es-CL');
            const txt = [a.__tipo, a.proveedorNombre, a.centroCodigo].filter(Boolean).join(' · ');
            return `<li>${f} — ${txt} (${a.tons||0} t)</li>`;
          }).join('')}
        </ul>
      </div></div>`;
  }

  // 4) bloquea el dblclick para que no abra el modal de asignaciones
  const stopper = (e) => { e.stopPropagation(); e.preventDefault(); };
  const days = containerEl.querySelector('#calDays');
  if (days) days.addEventListener('dblclick', stopper, true);

  // 5) si quieres navegar de mes, refrescamos con las mismas interacciones (solo lectura)
  const hookNav = () => {
    // nada que recargar del backend aquí; el calendario recalcula la vista
  };
  const prevBtn = containerEl.querySelector('#calPrev');
  const nextBtn = containerEl.querySelector('#calNext');
  if (prevBtn) prevBtn.addEventListener('click', hookNav);
  if (nextBtn) nextBtn.addEventListener('click', hookNav);

  // 6) limpia el MMppApi global cuando salgas de la pestaña (opcional)
  //    si prefieres no tocar el global, comenta estas líneas
  const tab = containerEl.closest('#tab-interacciones');
  if (tab){
    const onHide = () => { window.MMppApi = prevApi; };
    tab.addEventListener('mmpp:tab-hide', onHide, { once: true });
  }
}
