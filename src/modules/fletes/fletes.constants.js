export const TIPO_CAMION_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'con_carro', label: 'Con carro' },
  { value: 'con_rampa', label: 'Con rampa' },
  { value: 'tolva_simple', label: 'Tolva simple' },
  { value: 'tolva_doble', label: 'Tolva doble' },
];

export const TIPO_CAMION_LABELS = TIPO_CAMION_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export const EMPTY_TRANSPORTISTA = {
  nombre: '',
  rut: '',
  contacto: '',
  telefono: '',
  email: '',
  activo: true,
};

export const EMPTY_TARIFA = {
  comuna: '',
  tipoCamion: 'simple',
  costoFijoPorViaje: '',
  costoPorKilo: '',
  vigenciaDesde: '',
  vigenciaHasta: '',
  notas: '',
};
