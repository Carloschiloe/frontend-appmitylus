// /js/configuracion/proveedores/service.js
import { Estado } from '../../core/estado.js'; // Ajusta el path si es necesario

let proveedores = window.PROVEEDORES_MOCK || []; // Simula la base, cambia a fetch si usas backend

export async function getProveedores() {
  // Si lo quieres dinámico, reemplaza por fetch a tu backend
  return proveedores;
}

export async function getProveedorById(id) {
  return proveedores.find(p => p._id == id);
}

export function getCentrosByProveedor(proveedorId) {
  // Matchea centros por ID de proveedor
  return (Estado.centros || []).filter(c =>
    (typeof c.proveedor === 'object' ? c.proveedor._id : c.proveedor) == proveedorId
  );
}

export async function saveProveedor(proveedor) {
  if (!proveedor._id) {
    proveedor._id = Date.now().toString() + Math.random().toString(16).slice(2,8);
    proveedores.push(proveedor);
  } else {
    const idx = proveedores.findIndex(p => p._id == proveedor._id);
    if (idx !== -1) proveedores[idx] = proveedor;
  }
  // Agrega POST/PUT a backend si lo tienes
}

export async function saveProveedoresMasivo(lista) {
  lista.forEach(p => {
    if (!proveedores.some(e => e.rut === p.rut)) {
      p._id = Date.now().toString() + Math.random().toString(16).slice(2,8);
      proveedores.push(p);
    }
  });
  // Agrega carga masiva al backend si lo tienes
}
