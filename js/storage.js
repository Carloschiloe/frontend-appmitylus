// storage.js
export function getCentros() {
  return JSON.parse(localStorage.getItem('centros') || '[]');
}
export function saveCentros(centros) {
  localStorage.setItem('centros', JSON.stringify(centros));
}

