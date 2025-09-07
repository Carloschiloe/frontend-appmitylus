import React, { useState } from "react";
import InventoryMMPP from "./modules/mmpp/InventoryMMPP";

const UI = { bg:"#f5f7fb", bgPanel:"#ffffff", text:"#111827", textSoft:"#6b7280", brand:"#2155ff", border:"#e5e7eb", shadow:"0 10px 30px rgba(17,24,39,.06)", radius:18 };

function GlobalStyles(){ return (<style>{`
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
`}</style>); }

const ICON = {
  box: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/></svg>),
  cal: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>),
};

function Sidebar({ page, setPage }) {
  const link = (id, icon, label) => (
    <a href="#" className={page === id ? "active" : ""} onClick={(e) => { e.preventDefault(); setPage(id); }}>
      {icon} <span>{label}</span>
    </a>
  );
  return (
    <aside className="sidebar">
      <div className="brand"><span style={{ color: UI.brand }} dangerouslySetInnerHTML={{ __html: "&#x25A3;" }} /> Mitylus</div>
      <nav className="nav">
        {link("inventario", <ICON.box/>, "Inventario MMPP")}
        {link("calendario", <ICON.cal/>, "Calendario")}
      </nav>
    </aside>
  )
}

export default function App(){
  const [page,setPage]=useState('inventario');
  return (
    <div className="app">
      <GlobalStyles/>
      <Sidebar page={page} setPage={setPage}/>
      <main className="content">
        {page==='inventario' && <InventoryMMPP/>}
        {page==='calendario' && (
          <div className="card pad">
            <div className="header">📅 <div>Calendario (se integra después)</div></div>
          </div>
        )}
      </main>
    </div>
  );
}
