import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Inbox,
  Handshake,
  ShoppingCart,
  TestTube2,
  ShieldCheck,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import './landing.css';

const MODULES = [
  {
    icon: Building2,
    title: 'Proveedores',
    description: 'Directorio, historial y centros de cultivo de cada proveedor, con seguimiento comercial tipo agenda.',
  },
  {
    icon: Inbox,
    title: 'Disponibilidad de biomasa',
    description: 'Calibre, producto y volumen disponible por proveedor, actualizado en tiempo real.',
  },
  {
    icon: Handshake,
    title: 'Tratos comerciales',
    description: 'Sigue cada negociación desde el primer contacto hasta el acuerdo cerrado.',
  },
  {
    icon: ShoppingCart,
    title: 'Programa de cosecha',
    description: 'Planifica y ajusta la logística de camiones de cada cosecha.',
  },
  {
    icon: TestTube2,
    title: 'Muestreo técnico',
    description: 'Registra rendimiento y calidad de cada muestra tomada en terreno.',
  },
  {
    icon: ShieldCheck,
    title: 'Estado sanitario',
    description: 'Alertas automáticas por área PSMB, sincronizadas con datos de SERNAPESCA.',
  },
  {
    icon: Calendar,
    title: 'Agenda operacional',
    description: 'Acciones rápidas y recordatorios para no perder ningún seguimiento comercial.',
  },
];

function MitynexMark({ tone = 'light' }) {
  const wordColor = tone === 'light' ? '#F5FAFF' : '#031B4E';
  const subColor = tone === 'light' ? '#A9B8CF' : '#6B7A90';
  return (
    <svg className="landing-mark" viewBox="0 0 300 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mitynex">
      <defs>
        <linearGradient id="landingShellGrad" x1="12" y1="10" x2="66" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#12D6FF" />
          <stop offset="0.5" stopColor="#0A5CFF" />
          <stop offset="1" stopColor="#001233" />
        </linearGradient>
        <linearGradient id="landingWaveGrad" x1="5" y1="52" x2="66" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0A5CFF" />
          <stop offset="1" stopColor="#12D6FF" />
        </linearGradient>
      </defs>
      <g>
        <path d="M 58 22 C 68 30, 68 48, 54 58 C 42 66, 26 64, 17 56 C 29 58, 42 54, 49 44 C 55 36, 54 26, 58 22 Z" fill="url(#landingShellGrad)" />
        <ellipse cx="41" cy="37" rx="9" ry="5.5" fill="#001233" opacity="0.7" transform="rotate(-30 41 37)" />
        <path d="M 6 62 C 18 56, 34 56, 46 62 C 54 66, 60 66, 64 62 C 58 74, 44 78, 30 74 C 18 71, 9 67, 6 62 Z" fill="url(#landingWaveGrad)" />
      </g>
      <text x="80" y="42" fill={wordColor} fontFamily="Inter, Manrope, Segoe UI, sans-serif" fontSize="30" fontWeight="800" letterSpacing="-1.2">Mity<tspan fill="#0A5CFF">nex</tspan></text>
      <text x="82" y="58" fill={subColor} fontFamily="Inter, Manrope, Segoe UI, sans-serif" fontSize="8.6" fontWeight="600" letterSpacing=".02em">Construimos el futuro. Optimizamos tu presente.</text>
    </svg>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const goToLogin = () => navigate('/login');

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <MitynexMark tone="light" />
        <button type="button" className="landing-nav-cta" onClick={goToLogin}>
          Iniciar sesión
        </button>
      </header>

      <section className="landing-hero">
        <div className="landing-ocean" aria-hidden="true">
          <span className="landing-ocean-glow landing-ocean-glow-a" />
          <span className="landing-ocean-glow landing-ocean-glow-b" />
          <span className="landing-ocean-grid" />
          <span className="landing-ocean-wave landing-ocean-wave-a" />
          <span className="landing-ocean-wave landing-ocean-wave-b" />
        </div>
        <div className="landing-hero-content">
          <p className="landing-eyebrow">Plataforma para la mitilicultura</p>
          <h1>Todo el abastecimiento de choritos, en un solo sistema</h1>
          <p className="landing-hero-sub">
            Mitynex centraliza proveedores, disponibilidad de biomasa, tratos comerciales,
            programación de cosecha, muestreo técnico y alertas sanitarias, para que tu equipo
            deje de perseguir información en planillas sueltas.
          </p>
          <button type="button" className="landing-cta-primary" onClick={goToLogin}>
            Iniciar sesión <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="landing-what">
        <p className="landing-section-eyebrow">Qué es Mitynex</p>
        <h2>El sistema operativo de tu empresa mitilicultora</h2>
        <p className="landing-what-copy">
          Mitynex reemplaza las planillas sueltas y los seguimientos manuales por una plataforma
          única, pensada para empresas que gestionan abastecimiento de choritos. Cada empresa
          trabaja con su propia información, de forma independiente, dentro de la misma plataforma.
        </p>
      </section>

      <section className="landing-modules">
        <p className="landing-section-eyebrow">Un sistema, todo el ciclo</p>
        <h2>Desde el primer contacto hasta la cosecha</h2>
        <div className="landing-modules-grid">
          {MODULES.map(({ icon: Icon, title, description }) => (
            <div className="landing-module-card" key={title}>
              <div className="landing-module-icon">
                <Icon size={20} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta-band">
        <h2>¿Tu empresa ya trabaja con Mitynex?</h2>
        <p>Ingresa con tu cuenta para continuar donde lo dejaste.</p>
        <button type="button" className="landing-cta-primary" onClick={goToLogin}>
          Iniciar sesión <ArrowRight size={18} />
        </button>
      </section>

      <footer className="landing-footer">
        <p>&copy; 2026 Mitynex Prime. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
