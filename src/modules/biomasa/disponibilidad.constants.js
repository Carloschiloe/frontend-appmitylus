export const DISPONIBILIDAD_ESTADOS = [
  { value: 'disponible', label: 'Disponible', tone: 'info' },
  { value: 'semi_cerrado', label: 'Semi-cerrado', tone: 'warning' },
  { value: 'cerrado', label: 'Cerrado', tone: 'success' },
  { value: 'perdido', label: 'Perdido', tone: 'danger' },
  { value: 'descartado', label: 'Descartado', tone: 'muted' },
];

export const DISPONIBILIDAD_PRODUCTOS = [
  { value: 'entero', label: 'Entero' },
  { value: 'carne', label: 'Carne' },
  { value: 'media_concha', label: 'Media concha' },
  { value: 'sin_definir', label: 'Sin definir' },
];

export const DISPONIBILIDAD_ORIGENES = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'visita', label: 'Visita' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'otro', label: 'Otro' },
];

export const optionLabel = (options, value) => (
  options.find((option) => option.value === value)?.label || value || 'Sin definir'
);
