export const mitynexTours = {
  tratos: {
    id: 'tratos',
    title: 'Guía de Tratos',
    route: '/gestion/tratos',
    summary: 'Conoce cómo buscar, registrar y revisar acuerdos comerciales.',
    steps: [
      { element: '[data-tour="tratos-filtros"]', title: 'Busca y filtra', description: 'Encuentra tratos por proveedor, mes o responsable.', placement: 'bottom' },
      { element: '[data-tour="tratos-registrar"]', title: 'Registrar trato', description: 'Crea un nuevo acuerdo comercial desde aquí.', placement: 'left' },
      { element: '[data-tour="tratos-tabla"]', title: 'Revisa los tratos', description: 'Consulta toneladas, precio, fechas, estado y responsable.', placement: 'top' },
      { element: '[data-tour="tratos-acciones"]', title: 'Acciones del trato', description: 'Abre, comparte, edita o elimina un trato registrado.', placement: 'left' },
    ],
  },
  muestreos: {
    id: 'muestreos',
    title: 'Guía de Muestreos',
    route: '/biomasa/muestreos',
    summary: 'Aprende a buscar, registrar y revisar resultados de muestreo.',
    steps: [
      { element: '[data-tour="muestreos-filtros"]', title: 'Periodo y vista', description: 'Cambia el periodo y la forma de revisar los muestreos.', placement: 'bottom' },
      { element: '[data-tour="muestreos-busqueda"]', title: 'Busca registros', description: 'Encuentra un proveedor o centro rápidamente.', placement: 'bottom' },
      { element: '[data-tour="muestreos-registrar"]', title: 'Registrar muestreo', description: 'Abre el formulario para ingresar un nuevo resultado.', placement: 'left' },
      { element: '[data-tour="muestreos-tabla"]', title: 'Resultados registrados', description: 'Consulta métricas, evidencia disponible y acciones.', placement: 'top' },
    ],
  },
  biomasa: {
    id: 'biomasa',
    title: 'Guía de Programa de Cosecha',
    route: '/biomasa/programa',
    summary: 'Recorre la planificación, el calendario y sus ajustes.',
    steps: [
      { element: '[data-tour="programa-vistas"]', title: 'Elige una vista', description: 'Alterna entre programa, calendario y seguimiento.', placement: 'bottom' },
      { element: '[data-tour="programa-crear"]', title: 'Crear programa', description: 'Inicia una planificación desde un trato acordado.', placement: 'left' },
      { element: '[data-tour="programa-calendario-vistas"]', title: 'Mes o semana', description: 'Cambia la escala del calendario de cosecha.', placement: 'bottom' },
      { element: '[data-tour="programa-calendario"]', title: 'Calendario operativo', description: 'Revisa camiones, toneladas y proveedores programados.', placement: 'top' },
      { element: '[data-tour="programa-ajustar"]', title: 'Ajustar un día', description: 'Suma, descuenta o suspende la planificación diaria.', placement: 'left' },
      { element: '[data-tour="programa-resumen"]', title: 'Resumen semanal', description: 'Consulta totales, promedios y distribución semanal.', placement: 'top' },
    ],
  },
  historial: {
    id: 'historial',
    title: 'Guía de Historial',
    route: '/historial',
    summary: 'Encuentra proveedores, eventos y actividad relacionada.',
    steps: [
      { element: '[data-tour="historial-busqueda"]', title: 'Busca en el historial', description: 'Encuentra proveedores, centros o actividad.', placement: 'bottom' },
      { element: '[data-tour="historial-filtros"]', title: 'Filtra resultados', description: 'Acota la información que necesitas revisar.', placement: 'bottom' },
      { element: '[data-tour="historial-eventos"]', title: 'Eventos registrados', description: 'Consulta la trazabilidad disponible.', placement: 'top' },
    ],
  },
  soporte: {
    id: 'soporte',
    title: 'Guía de Soporte Técnico',
    route: '/gestion/soporte/errores',
    summary: 'Conoce cómo revisar y gestionar reportes técnicos.',
    steps: [
      { element: '[data-tour="soporte-reportar"]', title: 'Reportar problema', description: 'Envía contexto al equipo de soporte.', placement: 'right' },
      { element: '[data-tour="soporte-tabla"]', title: 'Reportes técnicos', description: 'Revisa estado, urgencia y origen.', placement: 'top' },
      { element: '[data-tour="soporte-detalle"]', title: 'Detalle del reporte', description: 'Consulta el contexto técnico registrado.', placement: 'left' },
    ],
  },
};

export const primaryTourIds = ['tratos', 'muestreos', 'biomasa'];

export const toursPageContent = {
  eyebrow: 'Ayuda contextual',
  title: 'Aprende dentro de Mitynex',
  subtitle: 'Abre una guía interactiva en la pantalla real o encuentra una respuesta rápida.',
  toursTitle: 'Guías interactivas',
  toursSubtitle: 'Ve al módulo y presiona “Guía de esta pantalla” para iniciar el recorrido.',
  goToModuleLabel: 'Ir al módulo',
};
