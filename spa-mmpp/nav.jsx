/* /spa-mmpp/nav.jsx */
const { useMemo } = React;

function Sidebar(){
  // Path + hash para marcar activo (soporta #balance-mmpp)
  const here = (typeof location!=="undefined"
    ? `${(location.pathname || "").toLowerCase()} ${(location.hash || "").toLowerCase()}`
    : "");

  const itemsMain = [
    { href: "/html/Abastecimiento/asignacion/inventario_mmpp.html",       label:"Inventario",      icon:"📦" },
    { href: "/html/Abastecimiento/asignacion/calendario_mmpp.html",       label:"Calendario",      icon:"📅" },

    // 👉 Usa el index del root con hash (evita 404 en /spa-mmpp/index.html)
    { href: "/#balance-mmpp",                                             label:"Balance MMPP",    icon:"📈" },

    // Mantiene panel de transportistas in-page
    { href: "/html/Abastecimiento/asignacion/transportistas_mmpp.html",   label:"Transportistas",  icon:"🚚", panel:"transportistas" },

    { href: "/html/Abastecimiento/asignacion/resumen_mmpp.html",          label:"Resumen Stock",   icon:"📊" },
    { href: "/html/Abastecimiento/asignacion/pipeline_mmpp.html",         label:"Pipeline",        icon:"🧭" },
  ];

  function isActive(href){
    const f = href.split("/").pop().toLowerCase();     // p.ej. '#balance-mmpp' o 'inventario_mmpp.html'
    const token = f.includes("#") ? f.split("#")[1] : "";
    // Activo si coincide archivo o el token del hash
    return (here.indexOf(f) >= 0 || (token && here.indexOf(token) >= 0)) ? "is-active" : "";
  }

  function onClickItem(e, it){
    if (it.panel === "transportistas" && window.openTransportistasPanel) {
      e.preventDefault();
      window.openTransportistasPanel();
    }
  }

  return (
    <aside className="mmpp-nav">
      <div className="brand">
        <div className="logo">M</div>
        <div>MMPP</div>
      </div>

      <div className="section">Principal</div>
      {itemsMain.map(it =>
        <a key={it.href}
           className={isActive(it.href)}
           href={it.href}
           onClick={(e)=>onClickItem(e,it)}>
          <span className="i">{it.icon}</span>{it.label}
        </a>
      )}
    </aside>
  );
}

(function autoMount(){
  function go(){
    const host = document.getElementById("mmppNavMount");
    if (host) ReactDOM.createRoot(host).render(<Sidebar/>);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})();
