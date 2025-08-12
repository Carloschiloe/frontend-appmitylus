// /js/abastecimiento/planificacion/state.js

export const state = {
  centros: [], proveedores: [], bloques: [],
  filtros: { vista:'semana', semana:null, mes:null, anio:null, escenario:'base', texto:'', soloConfirmado:false, ocultarCancelados:true },
  params: { objetivo:400, lead:7, buffer:2 },
  editingId: null,
};

const KEYS = { BLOQUES:'plan_bloques_v1', PARAMS:'plan_params_v1', FILTROS:'plan_filtros_v1' };

export function loadState(){
  try { const raw = JSON.parse(localStorage.getItem(KEYS.BLOQUES) || '[]'); state.bloques = Array.isArray(raw) ? raw : []; } catch { state.bloques = []; }
  try { const p = JSON.parse(localStorage.getItem(KEYS.PARAMS) || '{}'); state.params = { ...state.params, ...p }; } catch {}
  try { const f = JSON.parse(localStorage.getItem(KEYS.FILTROS) || '{}'); state.filtros = { ...state.filtros, ...f }; } catch {}
}
export const saveBlocks  = ()=> localStorage.setItem(KEYS.BLOQUES, JSON.stringify(state.bloques));
export const saveParams  = ()=> localStorage.setItem(KEYS.PARAMS, JSON.stringify(state.params));
export const saveFiltros = ()=> localStorage.setItem(KEYS.FILTROS, JSON.stringify({ vista:state.filtros.vista, semana:state.filtros.semana, mes:state.filtros.mes, anio:state.filtros.anio, escenario:state.filtros.escenario }));