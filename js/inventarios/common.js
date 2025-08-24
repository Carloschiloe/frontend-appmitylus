// Helpers compartidos para todos los inventarios futuros
export function isoNowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,16); // yyyy-MM-ddTHH:mm
}