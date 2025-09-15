/* /spa-mmpp/nav.jsx */
const { useMemo } = React;

function Sidebar(){
  // normaliza path (sin query ni hash)
  const here = (typeof location!=="undefined"
    ? (location.pathname || "").toLowerCase()
    : "");

  const itemsMain = [
    { href: "/html/Abastecimiento/asignacion/inventario_mmpp.html", label:"Inventario", icon:"📦" },
    { href: "/html/Abastecimiento/asignacion/calendario_mmpp.html", label:"Calendario", icon:"📅" },
    { href: "/html/Abastecimiento/asignacion/resumen_mmpp.html",   label:"Resumen Disp.",   icon:"📊" }, // ← NUEVO
  ];

  // Si más módulos luego:
  const itemsOther = [
    // { href: "/html/reportes_mmpp.html", label:"Reportes", icon:"📈" },
  ];

  function isActive(href){
    // activa por nombre de archivo
    const f = href.split("/").pop().toLowerCase();
    return here.indexOf(f) >= 0 ? "is-active" : "";
  }

  return (
    <aside className="mmpp-nav">
      <div className="brand">
        <div className="logo">M</div>
        <div>MMPP</div>
      </div>

      <div className="section">Principal</div>
      {itemsMain.map(it =>
        <a key={it.href} className={isActive(it.href)} href={it.href}>
          <span className="i">{it.icon}</span>{it.label}
        </a>
      )}

      {itemsOther.length > 0 && (<div className="section">Más</div>)}
      {itemsOther.map(it =>
        <a key={it.href} className={isActive(it.href)} href={it.href}>
          <span className="i">{it.icon}</span>{it.label}
        </a>
      )}
    </aside>
  );
}

// Auto-mount si existe el contenedor
(function autoMount(){
  function go(){
    const host = document.getElementById("mmppNavMount");
    if (host) ReactDOM.createRoot(host).render(<Sidebar/>);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})();
