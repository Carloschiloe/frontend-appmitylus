import React, { useEffect, useState } from "react";
import InventoryMMPP from "./modules/mmpp/InventoryMMPP";
import BalanceMMPP from "./modules/mmpp/BalanceMMPP";

const UI = {
  bg:"#f5f7fb",
  bgPanel:"#ffffff",
  text:"#111827",
  textSoft:"#6b7280",
  brand:"#2155ff",
  border:"#e5e7eb",
  shadow:"0 10px 30px rgba(17,24,39,.06)",
  radius:18
};

function GlobalStyles(){
  return (
    <style>{`
      *{box-sizing:border-box}
      body{margin:0; background:${UI.bg}; color:${UI.text}; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
      .app{display:grid; grid-template-columns:78px 1fr; min-height:100vh}
      .sidebar{background:${UI.bgPanel}; border-right:1px solid ${UI.border}; padding:12px 10px; position:sticky; top:0; height:100vh}
      .brand{display:flex; align-items:center; gap:10px; font-weight:800; font-size:18px; margin-bottom:18px}
      .nav{display:flex; flex-direction:column; gap:8px}
      .nav a{display:flex; align-items:center; gap:10px; padding:10px; border-radius:14px; text-decoration:none; color:${UI.text}}
      .nav a:hover{background:#f3f4f6}
      .nav a.active{background:#ebf1ff; color:${UI.brand}; font-weight:700}
      .nav a svg{width:18px; height:18px}
      .content{padding:24px 28px}
      .card{background:${UI.bgPanel}; border:1px solid ${UI.border}; border-radius:${UI.radius}px; box-shadow:${UI.shadow}}
      .pad{padding:18px}
      .header{display:flex; align-items:center; gap:12px; font-size:26px; font-weight:800; margin-bottom:12px}

      /* estilos básicos usados por BalanceMMPP */
      .toolbar{margin:6px 0 12px 0}
      .toolbar .row{display:flex; gap:12px; flex-wrap:wrap}
      .toolbar .col{display:flex; flex-direction:column; gap:6px}
      .toolbar select{padding:8px 10px; border:1px solid ${UI.border}; border-radius:10px; background:#fff}
      .btn{padding:10px 12px; border:1px solid ${UI.border}; border-radius:12px; background:#fff; cursor:pointer}
      .btn:hover{background:#f9fafb}
      .table{width:100%; border-collapse:separate; border-spacing:0}
      .table th,.table td{padding:10px 12px; border-bottom:1px solid ${UI.border}}
      .alert.error{background:#fee2e2; color:#991b1b; padding:10px 12px; border-radius:12px; border:1px solid #fecaca}
      .skeleton{background:linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6); background-size:200% 100%; animation:shimmer 1.2s infinite}
      @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    `}</style>
  );
}

const ICON = {
  box: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/>
    </svg>
  ),
  cal: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  ),
  chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="10" width="4" height="10" rx="1"/>
      <rect x="10" y="6" width="4" height="14" rx="1"/>
      <rect x="17" y="3" width="4" height="17" rx="1"/>
    </svg>
  ),
};

function Sidebar({ page, setPage }) {
  const link = (id, icon, label) => (
    <a
      href="#"
      className={page === id ? "active" : ""}
      onClick={(e) => {
        e.preventDefault();
        // Cambia hash para que se pueda compartir/enlazar
        if (id === "inventario") window.location.hash = "inventario-mmpp";
        if (id === "calendario") window.location.hash = "calendario";
        if (id === "balance")    window.location.hash = "balance-mmpp";
        setPage(id);
      }}
    >
      {icon} <span>{label}</span>
    </a>
  );
  return (
    <aside className="sidebar">
      <div className="brand">
        <span style={{ color: UI.brand }} dangerouslySetInnerHTML={{ __html: "&#x25A3;" }} />
        Mitylus
      </div>
      <nav className="nav">
        {link("inventario", <ICON.box/>, "Inventario MMPP")}
        {link("calendario", <ICON.cal/>, "Calendario")}
        {link("balance", <ICON.chart/>, "Balance MMPP")}
      </nav>
    </aside>
  );
}

export default function App(){
  // --- Determina la página inicial según query/hash (HTML puente) ---
  const initialPage = (() => {
    const q = new URLSearchParams(window.location.search);
    const h = (window.location.hash || "").toLowerCase();
    if (q.get("view") === "inventario-mmpp") return "inventario";
    if (q.get("view") === "balance-mmpp")    return "balance";
    if (h.includes("inventario-mmpp") || h.includes("inventario")) return "inventario";
    if (h.includes("balance-mmpp") || h.includes("balance"))       return "balance";
    if (h.includes("calendario"))                                   return "calendario";
    return "inventario";
  })();

  const [page, setPage] = useState(initialPage);

  // Sincroniza el hash cuando se cambia de pestaña desde el propio SPA
  useEffect(() => {
    const h = (window.location.hash || "").toLowerCase();
    if (page === "inventario" && h !== "#inventario-mmpp") window.location.hash = "inventario-mmpp";
    if (page === "calendario" && h !== "#calendario")      window.location.hash = "calendario";
    if (page === "balance"    && h !== "#balance-mmpp")    window.location.hash = "balance-mmpp";
  }, [page]);

  // Responde a cambios de hash / navegación atrás-adelante
  useEffect(() => {
    const handleLocChange = () => {
      const q = new URLSearchParams(window.location.search);
      const h = (window.location.hash || "").toLowerCase();

      if (q.get("view") === "inventario-mmpp" || h.includes("inventario-mmpp") || h.includes("inventario")) {
        setPage("inventario");
        return;
      }
      if (q.get("view") === "balance-mmpp" || h.includes("balance-mmpp") || h.includes("balance")) {
        setPage("balance");
        return;
      }
      if (h.includes("calendario")) {
        setPage("calendario");
        return;
      }
    };
    window.addEventListener("hashchange", handleLocChange);
    window.addEventListener("popstate", handleLocChange);
    return () => {
      window.removeEventListener("hashchange", handleLocChange);
      window.removeEventListener("popstate", handleLocChange);
    };
  }, []);

  return (
    <div className="app">
      <GlobalStyles/>
      <Sidebar page={page} setPage={setPage}/>
      <main className="content">
        {page === "inventario" && <InventoryMMPP/>}
        {page === "calendario" && (
          <div className="card pad">
            <div className="header">📅 <div>Calendario (se integra después)</div></div>
          </div>
        )}
        {page === "balance" && <BalanceMMPP/>}
      </main>
    </div>
  );
}
