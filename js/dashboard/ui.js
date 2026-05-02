/**
 * js/dashboard/ui.js
 * Referencias a elementos del DOM del Dashboard principal.
 */

export const ui = {
  nav: document.getElementById('sideNav'),
  activity: document.getElementById('dashboardActivity'),
  hint: document.getElementById('dashboardDateHint'),
  refresh: document.getElementById('btnRefreshDashboard'),
  fResp: document.getElementById('dashFiltroResp'),
  fComuna: document.getElementById('dashFiltroComuna'),
  fPeriodo: document.getElementById('dashFiltroPeriodo'),
  fTexto: document.getElementById('dashFiltroProveedor'),
  fClear: document.getElementById('dashClear'),
  goHistorial: document.getElementById('dashGoHistorial'),

  // KPIs prospectivos
  kpiAcordada:    document.getElementById('kpiAcordada'),
  kpiProxMes:     document.getElementById('kpiProxMes'),
  kpiNegociacion: document.getElementById('kpiNegociacion'),
  kpiAlertas:     document.getElementById('kpiAlertas'),

  // Horizonte de abastecimiento
  dshHorizonte: document.getElementById('dshHorizonte'),

  // Pipeline y top proveedores
  dshPipeline:       document.getElementById('dshPipeline'),
  dshPipelineHint:   document.getElementById('dshPipelineHint'),
  dshTopProveedores: document.getElementById('dshTopProveedores'),
  dshTopHint:        document.getElementById('dshTopHint'),

  // Pendientes
  dshPendientes: document.getElementById('dshPendientes'),

  // Biomasa detalle
  bioCardDisponible: document.getElementById('bioCardDisponible'),
  bioCardSemi: document.getElementById('bioCardSemi'),
  bioCardConfirmado: document.getElementById('bioCardConfirmado'),
  bioCardDescartado: document.getElementById('bioCardDescartado'),
  bioCardPerdido: document.getElementById('bioCardPerdido'),
  bioTableBody: document.getElementById('bioTableBody'),
  bioChart: document.getElementById('bioChart'),
  bioScaleWeek: document.getElementById('bioScaleWeek'),
  bioScaleMonth: document.getElementById('bioScaleMonth'),
  bioScaleYear: document.getElementById('bioScaleYear'),
  bioPrev: document.getElementById('bioPrev'),
  bioNext: document.getElementById('bioNext'),
  bioPeriodLabel: document.getElementById('bioPeriodLabel'),
  bioProvidersTitle: document.getElementById('bioProvidersTitle'),
  bioProvidersHint: document.getElementById('bioProvidersHint'),
  bioProvidersList: document.getElementById('bioProvidersList'),
  bioCardsWrap: document.querySelector('.bio-cards'),
  bioAnnualChart: document.getElementById('bioAnnualChart'),
  bioAnnualTitle: document.getElementById('bioAnnualTitle'),
  bioAnnualHint: document.getElementById('bioAnnualHint'),
  bioAnnualModeLine: document.getElementById('bioAnnualModeLine'),
  bioAnnualModeBar: document.getElementById('bioAnnualModeBar'),
  bioAnnualProvidersTitle: document.getElementById('bioAnnualProvidersTitle'),
  bioAnnualProvidersHint: document.getElementById('bioAnnualProvidersHint'),
  bioAnnualProvidersBody: document.getElementById('bioAnnualProvidersBody'),
  bioAnnualProvidersSearch: document.getElementById('bioAnnualProvidersSearch'),
  bioAnnualProviderClear: document.getElementById('bioAnnualProviderClear'),
  bioSection: document.getElementById('dashboard-biomasa')
};
