/* /spa-mmpp/nav.jsx */
import './index.css';

function Sidebar() {
  const here = (typeof location !== "undefined"
    ? ((location.pathname || "").toLowerCase() + " " + (location.hash || "").toLowerCase())
    : "");

  const pathname = (typeof location !== "undefined" && location.pathname
    ? location.pathname.toLowerCase()
    : "");
  const isAsignacionFlow = pathname.startsWith("/html/abastecimiento/asignacion/");

  const itemsMain = [
    { href: "/html/Abastecimiento/categorias.html",           label:"Categorías",      icon:"🏠" },
    { href: "/html/Abastecimiento/contactos/contactos.html",   label:"Contactos",       icon:"👥" },
    { href: "/html/Centros/index.html",                        label:"Centros",         icon:"📍" },
  ];

  const asignacionExcludedMain = ["categorías", "contactos", "centros"];
  const itemsMainVisible = isAsignacionFlow
    ? itemsMain.filter((it) => !asignacionExcludedMain.includes(it.label.toLowerCase()))
    : itemsMain;

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

  function isActive(href) {
    const f = href.split("/").pop().toLowerCase(); 
    const token = f.indexOf("#") >= 0 ? f.split("#")[1] : "";
    const active = here.indexOf(f) >= 0 || (token && here.indexOf(token) >= 0);
    return active ? "is-active" : "";
  }

  function onClickItem(e, it) {
    if (it.panel === "transportistas" && window.openTransportistasPanel) {
      e.preventDefault();
      window.openTransportistasPanel();
    }
  }

  const NavItem = ({ it }) => (
    <a key={it.href}
       className={`nav-item ${isActive(it.href)}`}
       href={it.href}
       onClick={(e) => onClickItem(e, it)}>
      <span className="i">{it.icon}</span>
      {it.label}
    </a>
  );

  return (
    <aside className="mmpp-nav">
      <div className="brand">
        <div className="logo">M</div>
        <div className="brand-text">
          <span className="title">AppMitylus</span>
          <span className="subtitle">Abastecimiento</span>
        </div>
      </div>

      <nav className="nav-scroll">
        {itemsMainVisible.length > 0 && (
          <div className="nav-group">
            <div className="section">Principal</div>
            {itemsMainVisible.map(it => <NavItem key={it.href} it={it} />)}
          </div>
        )}

        {here.indexOf("centros") >= 0 && (
          <div className="nav-group">
            <div className="section">Centros</div>
            {itemsCentros.map(it => <NavItem key={it.href} it={it} />)}
          </div>
        )}

        <div className="nav-group">
          <div className="section">Planificación</div>
          {itemsAsignacion.map(it => <NavItem key={it.href} it={it} />)}
        </div>
      </nav>

      <div className="nav-footer">
        <div className="nav-user">
          <div className="avatar">CS</div>
          <div className="meta">
            <span className="name">Carlos Serv</span>
            <span className="role">Administrador</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

(function autoMount() {
  function go() {
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

