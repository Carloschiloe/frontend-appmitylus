// /js/abastecimiento/contactos/gestion-actions.js

export function createGestionActionsModule({
  activateTab,
  applyConsultaPreset,
  initVisitasTab,
  openVisitaModal,
  openInteraccionModal,
  openMuestreoPanel,
  onSavedGestion,
  setVisitasBooted
}) {
  function bindHomeActions() {
    if (document.body.dataset.gestionBound === '1') return;
    document.body.dataset.gestionBound = '1';

    // Event delegation sobre document — funciona aunque los elementos se creen dinámicamente
    // (ej: los botones del dropdown de Nueva actividad se generan en mountActivityTable de forma lazy)
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[id]');
      if (!btn) return;

      switch (btn.id) {
        case 'qaNuevoContacto':
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('mmpp:open-contacto-modal'));
          break;

        case 'qaNuevaVisita':
          e.preventDefault();
          await initVisitasTab().catch(() => {});
          setVisitasBooted?.(true);
          try { await openVisitaModal({}); } catch {}
          break;

        case 'qaNuevaLlamada':
          e.preventDefault();
          openInteraccionModal({
            preset: { tipo: 'llamada', proximoPaso: 'Contacto telefonico' },
            onSaved: () => { onSavedGestion?.()?.catch(() => {}); }
          });
          break;

        case 'qaNuevaReunion':
          e.preventDefault();
          openInteraccionModal({
            preset: { tipo: 'reunion', proximoPaso: 'Reunion' },
            onSaved: () => { onSavedGestion?.()?.catch(() => {}); }
          });
          break;

        case 'qaNuevoCompromiso':
          e.preventDefault();
          openInteraccionModal({
            preset: { tipo: 'tarea', proximoPaso: 'Nueva visita', estado: 'agendado' },
            onSaved: () => { onSavedGestion?.()?.catch(() => {}); }
          });
          break;

        case 'qaTomarMuestras':
          e.preventDefault();
          openMuestreoPanel?.({ route: 'terreno', view: 'form' });
          break;
      }
    });

    // data-gestion-jump y data-open-consulta-panel también via delegation
    document.addEventListener('click', async (e) => {
      const jump = e.target.closest('[data-gestion-jump]');
      if (jump) {
        e.preventDefault();
        activateTab(jump.getAttribute('data-gestion-jump'));
        return;
      }

      const consulta = e.target.closest('[data-open-consulta-panel]');
      if (consulta) {
        e.preventDefault();
        const target = consulta.getAttribute('data-open-consulta-panel');
        const preset = consulta.getAttribute('data-consulta-preset') || '';
        activateTab(target);
        location.hash = target;
        await applyConsultaPreset(target, preset);
        return;
      }

      const volver = e.target.closest('[data-volver-consulta]');
      if (volver) {
        e.preventDefault();
        activateTab('#tab-gestion');
        location.hash = '#tab-gestion';
      }
    });
  }

  return { bindHomeActions };
}
