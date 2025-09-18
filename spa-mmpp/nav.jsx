/* /spa-mmpp/nav.jsx */
const { useMemo } = React;

function Sidebar(){
  const here = (typeof location!=="undefined"
    ? (location.pathname || "").toLowerCase()
    : "");

  const itemsMain = [
    { href: "/html/Abastecimiento/asignacion/inventario_mmpp.html",       label:"Inventario",      icon:"📦" },
    { href: "/html/Abastecimiento/asignacion/calendario_mmpp.html",       label:"Calendario",      icon:"📅" },
    // OJO: mantenemos el href “normal” pero capturamos el click para abrir panel
    { href: "/html/Abastecimiento/asignacion/transportistas_mmpp.html",   label:"Transportistas",  icon:"🚚", panel:"transportistas" },
    { href: "/html/Abastecimiento/asignacion/resumen_mmpp.html",          label:"Resumen Stock",   icon:"📊" },
    { href: "/html/Abastecimiento/asignacion/pipeline_mmpp.html",         label:"Pipeline",        icon:"🧭" },
  ];

  function isActive(href){
    const f = href.split("/").pop().toLowerCase();
    return here.indexOf(f) >= 0 ? "is-active" : "";
  }

  function onClickItem(e, it){
    // Si el item tiene "panel", no navegamos: abrimos el panel in-page
    if (it.panel === "transportistas" && window.openTransportistasPanel) {
      e.preventDefault();
      window.openTransportistasPanel(); // ← abre el panel lateral
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
