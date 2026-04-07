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

    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

    on('qaNuevoContacto', (e) => {
      e.preventDefault();
      document.getElementById('btnOpenContactoModal')?.click();
    });

    on('qaNuevaVisita', async (e) => {
      e.preventDefault();
      await initVisitasTab().catch(() => {});
      setVisitasBooted?.(true);
      try { await openVisitaModal({}); } catch {}
    });

    on('qaNuevaLlamada', (e) => {
      e.preventDefault();
      openInteraccionModal({
        preset: { tipo: 'llamada', proximoPaso: 'Contacto telefonico' },
        onSaved: () => { onSavedGestion?.().catch?.(() => {}); }
      });
    });

    on('qaNuevaReunion', (e) => {
      e.preventDefault();
      openInteraccionModal({
        preset: { tipo: 'reunion', proximoPaso: 'Reunion' },
        onSaved: () => { onSavedGestion?.().catch?.(() => {}); }
      });
    });

    on('qaTomarMuestras', (e) => {
      e.preventDefault();
      openMuestreoPanel?.({ route: 'terreno', view: 'form' });
    });

    on('qaNuevoCompromiso', (e) => {
      e.preventDefault();
      openInteraccionModal({
        preset: { tipo: 'tarea', proximoPaso: 'Nueva visita', estado: 'agendado' },
        onSaved: () => { onSavedGestion?.().catch?.(() => {}); }
      });
    });

    document.querySelectorAll('[data-gestion-jump]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = a.getAttribute('data-gestion-jump');
        activateTab(target);
      });
    });

    document.querySelectorAll('[data-open-consulta-panel]').forEach((a) => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const target = a.getAttribute('data-open-consulta-panel');
        const preset = a.getAttribute('data-consulta-preset') || '';
        activateTab(target);
        location.hash = target;
        await applyConsultaPreset(target, preset);
      });
    });

    document.querySelectorAll('[data-volver-consulta]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab('#tab-consulta');
        location.hash = '#tab-consulta';
      });
    });
  }

  return { bindHomeActions };
}

