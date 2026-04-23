import React, { useEffect, useState } from "react";
import InventoryMMPP from "./modules/mmpp/InventoryMMPP";
import BalanceMMPP from "./modules/mmpp/mmpp-balance";
import Compras from "./modules/mmpp/Compras";

const PAGES = ['compras', 'inventario', 'balance'];

export default function App() {
  const [page, setPage] = useState(() => {
    const h = window.location.hash.replace("#", "");
    return PAGES.includes(h) ? h : 'compras';
  });

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace("#", "");
      if (PAGES.includes(h)) setPage(h);
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  return (
    <>
      {page === "compras"    && <Compras />}
      {page === "inventario" && <InventoryMMPP />}
      {page === "balance"    && <BalanceMMPP />}
    </>
  );
}
