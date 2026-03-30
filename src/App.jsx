import React, { useEffect, useState } from "react";
import { 
  Package, 
  Calendar, 
  BarChart3, 
  LayoutDashboard, 
  Settings,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import InventoryMMPP from "./modules/mmpp/InventoryMMPP";
import BalanceMMPP from "./modules/mmpp/mmpp-balance"; // We will refactor this to export a component

const UI = {
  primary: "#6366f1", // Indigo 500
  secondary: "#a855f7", // Purple 500
  accent: "#f43f5e", // Rose 500
  bg: "#f8fafc", // Slate 50
  surface: "#ffffff",
  text: "#0f172a", // Slate 900
  textMuted: "#64748b", // Slate 500
  border: "#e2e8f0", // Slate 200
  shadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  radius: "1rem"
};

const NavigationItem = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 group ${
      active 
        ? "bg-indigo-50 text-indigo-600 shadow-sm" 
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`}
    style={{
      border: active ? `1px solid ${UI.primary}20` : "1px solid transparent"
    }}
  >
    <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`} />
    <span className="font-medium">{label}</span>
    {active && <ChevronRight className="w-4 h-4 ml-auto" />}
  </button>
);

export default function App() {
  const [page, setPage] = useState(() => {
    const h = window.location.hash.replace("#", "");
    return h || "inventario";
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h) setPage(h);
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    window.location.hash = page;
  }, [page]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 italic-none">
      {/* Sidebar Overlay for Mobile */}
      {!sidebarOpen && (
        <button 
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-lg lg:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center gap-3 border-b border-slate-100">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Mitylus
              </h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Enterprise</p>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="ml-auto p-2 text-slate-400 hover:text-slate-600 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 flex flex-col gap-2 mt-4">
            <div className="px-4 py-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gestión MMPP</p>
            </div>
            <NavigationItem 
              id="inventario" 
              icon={Package} 
              label="Inventario" 
              active={page === "inventario"} 
              onClick={setPage} 
            />
            <NavigationItem 
              id="balance" 
              icon={BarChart3} 
              label="Balance General" 
              active={page === "balance"} 
              onClick={setPage} 
            />
            
            <div className="px-4 py-2 mt-6">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operaciones</p>
            </div>
            <NavigationItem 
              id="calendario" 
              icon={Calendar} 
              label="Calendario" 
              active={page === "calendario"} 
              onClick={setPage} 
            />
          </nav>

          <div className="p-6 border-t border-slate-100">
            <button className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-slate-900 transition-colors">
              <Settings className="w-5 h-5" />
              <span className="font-medium">Configuración</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">
            {page.replace("-", " ")}
          </h2>
          <div className="flex items-center gap-4">
            {/* Demo Mode Badge */}
            <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Demo Mode</span>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">Carlos S.</p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
               <img src="https://ui-avatars.com/api/?name=Carlos+S&background=6366f1&color=fff" alt="Avatar" />
            </div>
          </div>
        </header>

        <section className="p-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {page === "inventario" && <InventoryMMPP />}
          {page === "balance" && <BalanceMMPP />}
          {page === "calendario" && (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-6">
                <Calendar className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Calendario en Desarrollo</h3>
              <p className="text-slate-500 max-w-md">
                Estamos trabajando para integrar el calendario dinámico de MMPP directamente en esta vista.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

