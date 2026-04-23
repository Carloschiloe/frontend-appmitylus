/**
 * js/index-modern.js
 * Orquestador principal del Dashboard de Mitylus.
 * Migrado de monolito (+1000 loc) a arquitectura modular.
 */

import { fetchAllDashboardData } from './dashboard/api.js';
import { renderAll, populateGlobalFilters } from './dashboard/render.js';
import { bindEvents } from './dashboard/events.js';

/**
 * Inicialización de la aplicación
 */
async function initDashboard() {
  try {
    // 1. Carga inicial de datos de forma paralela
    const data = await fetchAllDashboardData();
    
    // 2. Renderizado inicial de todo el dashboard (puebla state.raw)
    renderAll(data);
    
    // 3. Poblar filtros globales (Responsables, Comunas) basados en data cargada
    populateGlobalFilters();
    
    // 4. Registro de eventos de usuario
    bindEvents();
    
  } catch (error) {
    console.error('[Dashboard] Error de inicialización crítica:', error);
    // Silent fail para el usuario, manteniendo la UI en estado base.
  }
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
