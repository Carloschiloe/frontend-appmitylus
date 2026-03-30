/* /spa-mmpp/nav.jsx */
import './index.css';

const { useMemo } = React;

function Sidebar() {
  const here = (typeof location !== "undefined"
    ? ((location.pathname || "").toLowerCase() + " " + (location.hash || "").toLowerCase())
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

  function isActive(href) {
    const f = href.split("/").pop().toLowerCase(); 
    const token = f.indexOf("#") >= 0 ? f.split("#")[1] : "";
    const active = here.indexOf(f) >= 0 || (token && here.indexOf(token) >= 0);
    return active ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/10" : "hover:bg-slate-800/50 hover:text-white";
  }

  function onClickItem(e, it) {
    if (it.panel === "transportistas" && window.openTransportistasPanel) {
      e.preventDefault();
      window.openTransportistasPanel();
    }
  }

  const NavItem = ({ it }) => (
    <a key={it.href}
       className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium ${isActive(it.href)}`}
       href={it.href}
       onClick={(e) => onClickItem(e, it)}>
      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/50 group-hover:bg-brand-600 transition-colors shadow-inner text-base">
        {it.icon}
      </span>
      {it.label}
    </a>
  );

  return (
    <aside className="mmpp-nav w-[260px] p-4 gap-6">
      <div className="flex items-center gap-4 px-2 py-4 border-b border-white/5 mb-2">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-600/20">
          M
        </div>
        <div className="flex flex-col">
          <span className="text-white font-bold tracking-tight">AppMitylus</span>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Abastecimiento</span>
        </div>
      </div>

      <nav className="flex flex-col gap-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold text-slate-500 px-4 mb-2 tracking-[0.2em]">Principal</div>
        {itemsMain.map(it => <NavItem key={it.href} it={it} />)}

        {here.indexOf("centros") >= 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-4 mb-2 tracking-[0.2em]">Centros</div>
            {itemsCentros.map(it => <NavItem key={it.href} it={it} />)}
          </div>
        )}

        <div className="mt-4">
          <div className="text-[10px] uppercase font-bold text-slate-500 px-4 mb-2 tracking-[0.2em]">Planificación</div>
          {itemsAsignacion.map(it => <NavItem key={it.href} it={it} />)}
        </div>
      </nav>

      <div className="mt-auto px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs">CS</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Carlos Serv</span>
            <span className="text-[10px] text-slate-500">Administrador</span>
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

