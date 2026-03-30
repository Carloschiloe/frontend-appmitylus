/* /spa-mmpp/nav.jsx */
const { useMemo } = React;

function Sidebar(){
  const here = (typeof location!=="undefined"
    ? ((location.pathname||"").toLowerCase() + " " + (location.hash||"").toLowerCase())
    : "");

  const itemsMain = [
    { href: "/html/Abastecimiento/categorias.html",           label:"Categorías",      icon:"🏠" },
    { href: "/html/Abastecimiento/contactos/contactos.html",   label:"Contactos",       icon:"👥" },
    { href: "/html/Centros/index.html",                        label:"Centros",         icon:"📍" },
  ];

  const itemsCentros = [
    { href: "/html/Centros/index.html#tab-centros",            label:"Directorio",      icon:"📋" },
    { href: "/html/Centros/index.html#tab-mapa",               label:"Mapa",            icon:"🗺️" },
  ];

  const itemsAsignacion = [
    { href: "/html/Abastecimiento/asignacion/inventario_mmpp.html",     label:"Inventario",      icon:"📦" },
    { href: "/html/Abastecimiento/asignacion/calendario_mmpp.html",     label:"Calendario",      icon:"📅" },
    { href: "/html/Abastecimiento/asignacion/balance_mmpp.html",        label:"Balance MMPP",    icon:"📈" },
    { href: "/html/Abastecimiento/asignacion/transportistas_mmpp.html", label:"Transportistas",  icon:"🚚", panel:"transportistas" },
    { href: "/html/Abastecimiento/asignacion/resumen_mmpp.html",        label:"Resumen Stock",   icon:"📊" },
    { href: "/html/Abastecimiento/asignacion/pipeline_mmpp.html",       label:"Pipeline",        icon:"🧭" },
  ];

  function isActive(href){
    const f = href.split("/").pop().toLowerCase(); // 'balance_mmpp.html'
    const token = f.indexOf("#")>=0 ? f.split("#")[1] : "";
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

      <div className="section">PRINCIPAL</div>
      {itemsMain.map(it =>
        <a key={it.href}
           className={isActive(it.href)}
           href={it.href}
           onClick={(e)=>onClickItem(e,it)}>
          <span className="i">{it.icon}</span>{it.label}
        </a>
      )}

      {here.indexOf("centros") >= 0 && (
        <>
          <div className="section">CENTROS</div>
          {itemsCentros.map(it =>
            <a key={it.href}
               className={isActive(it.href)}
               href={it.href}
               onClick={(e)=>onClickItem(e,it)}>
              <span className="i">{it.icon}</span>{it.label}
            </a>
          )}
        </>
      )}

      <div className="section">PLANIFICACIÓN</div>
      {itemsAsignacion.map(it =>
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
    if (!host) return;
    try {
      const root = ReactDOM.createRoot(host);
      root.render(React.createElement(Sidebar, null));
    } catch(e) {
      console.error("Sidebar mount error:", e);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})();

