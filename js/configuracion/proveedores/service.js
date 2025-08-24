// Archivo: /js/configuracion/proveedores/service.js

import { Estado } from '../../core/estado.js'; // Ajusta si tu path es distinto

// Proveedores simulados (reemplaza esto con fetch al backend en el futuro)
let proveedores = window.PROVEEDORES_MOCK || [
  {
    _id: "1",
    rut: "12.345.678-9",
    razon_social: "Proveedor de Prueba S.A.",
    contacto: "Juan Pérez",
    telefono: "+56911112222",
    correo: "proveedor@correo.com",
    comuna: "Castro",
    categoria: "Productor",
    centros: [{ name: "Centro 1", code: "CT1" }],
    observaciones: "Sin observaciones."
  }
];

// Listar todos los proveedores
export async function getProveedores() {
  return proveedores;
}

// Buscar por ID
export async function getProveedorById(id) {
  return proveedores.find(p => p._id == id);
}

// Buscar centros asociados
export function getCentrosByProveedor(proveedorId) {
  // Si usas Estado.centros, asegúrate que esté inicializado
  return (Estado.centros || []).filter(c =>
    (typeof c.proveedor === 'object' ? c.proveedor._id : c.proveedor) == proveedorId
  );
}

// Guardar o actualizar un proveedor individual
export async function saveProveedor(proveedor) {
  if (!proveedor._id) {
    proveedor._id = Date.now().toString() + Math.random().toString(16).slice(2,8);
    proveedores.push(proveedor);
  } else {
    const idx = proveedores.findIndex(p => p._id == proveedor._id);
    if (idx !== -1) proveedores[idx] = proveedor;
  }
}

// Guardado masivo (importación desde Excel)
export async function saveProveedoresMasivo(lista) {
  // Evita duplicados por RUT (agrega sólo nuevos o reemplaza existentes)
  lista.forEach(p => {
    const idx = proveedores.findIndex(e => e.rut === p.rut);
    if (idx === -1) {
      p._id = Date.now().toString() + Math.random().toString(16).slice(2,8);
      proveedores.push(p);
    } else {
      proveedores[idx] = { ...proveedores[idx], ...p };
    }
  });
}
