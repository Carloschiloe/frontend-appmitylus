// /js/abastecimiento/contactos/table-search.js

export function createTableSearchModule({
  debounce,
  refreshConsultaFilterStates,
  consultaFilterState
}) {
  function bindTableSearch(inputId, onInput) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.bound === '1') return;
    const handler = debounce(() => {
      onInput?.(input.value || '');
      refreshConsultaFilterStates();
    }, 120);
    input.addEventListener('input', handler);
    input.dataset.bound = '1';
  }

  function bindSearchContactos() {
    bindTableSearch('searchContactos');
  }

  function bindSearchPersonas() {
    bindTableSearch('searchPersonas');
  }

  function bindSearchVisitas() {
    bindTableSearch('searchVisitas', (value) => {
      if (value && consultaFilterState.visitasPreset) consultaFilterState.visitasPreset = '';
    });
  }

  function refreshContactosTableUI() {
    bindSearchContactos();
  }

  function refreshVisitasTableUI() {
    bindSearchVisitas();
  }

  function refreshPersonasTableUI() {
    bindSearchPersonas();
  }

  function bindConsultaFilterStateListeners() {
    if (document.body.dataset.consultaStateBound === '1') return;
    document.body.dataset.consultaStateBound = '1';

    ['fltSemana', 'fltComuna', 'fltResp', 'fltVisSem', 'fltVisComuna'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        if ((id === 'fltVisSem' || id === 'fltVisComuna') && consultaFilterState.visitasPreset) {
          consultaFilterState.visitasPreset = '';
        }
        refreshConsultaFilterStates();
      });
    });

    refreshConsultaFilterStates();
  }

  return {
    bindSearchContactos,
    bindSearchPersonas,
    bindSearchVisitas,
    refreshContactosTableUI,
    refreshVisitasTableUI,
    refreshPersonasTableUI,
    bindConsultaFilterStateListeners
  };
}
