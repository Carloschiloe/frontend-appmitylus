import React, { useEffect, useRef, useState } from 'react';
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
  Layers,
  BellRing,
  Building,
  Mail,
  MessageCircle,
  Loader2,
  Rocket,
  Headphones,
  Lock,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';
import './landing.css';

const CONTACT_EMAIL = 'contacto@marvex.cl';
const WHATSAPP_NUMBER = '56954391455';
const WHATSAPP_MESSAGE = 'Hola, quiero más información sobre Mitynex.';
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const CONTACT_FORM_INITIAL = { nombre: '', empresa: '', email: '', telefono: '', mensaje: '', website: '' };

const MODULES = [
  {
    icon: Building2,
    title: 'Proveedores',
    description: 'Directorio, historial y centros de cultivo de cada proveedor, con seguimiento comercial tipo agenda.',
    accent: 'blue',
  },
  {
    icon: Inbox,
    title: 'Disponibilidad de biomasa',
    description: 'Calibre, producto y volumen disponible por proveedor, actualizado en tiempo real.',
    accent: 'cyan',
  },
  {
    icon: Handshake,
    title: 'Tratos comerciales',
    description: 'Sigue cada negociación desde el primer contacto hasta el acuerdo cerrado.',
    accent: 'navy',
  },
  {
    icon: ShoppingCart,
    title: 'Programa de cosecha',
    description: 'Planifica y ajusta la logística de camiones de cada cosecha.',
    accent: 'blue',
  },
  {
    icon: TestTube2,
    title: 'Muestreo técnico',
    description: 'Registra rendimiento y calidad de cada muestra tomada en terreno.',
    accent: 'cyan',
  },
  {
    icon: ShieldCheck,
    title: 'Estado sanitario',
    description: 'Alertas automáticas por área PSMB, sincronizadas con datos de SERNAPESCA.',
    accent: 'navy',
  },
  {
    icon: Calendar,
    title: 'Agenda operacional',
    description: 'Acciones rápidas y recordatorios para no perder ningún seguimiento comercial.',
    accent: 'blue',
  },
];

const BENEFITS = [
  { icon: Building, text: 'Multiempresa: cada empresa con su propia información' },
  { icon: Layers, text: 'Todo el ciclo conectado, sin planillas sueltas' },
  { icon: BellRing, text: 'Alertas sanitarias automáticas desde SERNAPESCA' },
];

const VALUE_PROPS = [
  { icon: Rocket, title: 'Implementación guiada', text: 'Te acompañamos para cargar tus datos y dejar todo listo para operar.' },
  { icon: Headphones, title: 'Soporte especializado', text: 'Un equipo que conoce la mitilicultura, no solo el software.' },
  { icon: Lock, title: 'Seguridad y respaldo', text: 'Sesión con cookies HTTP-only y datos separados por empresa.' },
];

const NAV_LINKS = [
  { href: '#beneficios', label: 'Beneficios' },
  { href: '#modulos', label: 'Módulos' },
  { href: '#contacto', label: 'Contacto' },
];

function MitynexMark({ tone = 'light', compact = false }) {
  const wordColor = tone === 'light' ? '#F5FAFF' : '#031B4E';
  const subColor = tone === 'light' ? '#A9B8CF' : '#6B7A90';
  return (
    <svg className="landing-mark" viewBox={compact ? '0 0 70 72' : '0 0 300 72'} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mitynex">
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
      {!compact && (
        <>
          <text x="80" y="42" fill={wordColor} fontFamily="Inter, Manrope, Segoe UI, sans-serif" fontSize="30" fontWeight="800" letterSpacing="-1.2">Mity<tspan fill="#0A5CFF">nex</tspan></text>
          <text x="82" y="58" fill={subColor} fontFamily="Inter, Manrope, Segoe UI, sans-serif" fontSize="8.6" fontWeight="600" letterSpacing=".02em">Construimos el futuro. Optimizamos tu presente.</text>
        </>
      )}
    </svg>
  );
}

function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`landing-reveal${visible ? ' is-visible' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

export default function Landing() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const goToLogin = () => navigate('/login');
  const scrolled = useScrolled();

  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, []);

  const [contactForm, setContactForm] = useState(CONTACT_FORM_INITIAL);
  const [sendingContact, setSendingContact] = useState(false);

  const updateContactField = (field) => (e) => {
    setContactForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (sendingContact) return;

    setSendingContact(true);
    try {
      await apiClient.post('/public/contacto', contactForm);
      addToast({
        title: 'Mensaje enviado',
        message: 'Gracias por escribir. Te contactaremos a la brevedad.',
        type: 'success',
      });
      setContactForm(CONTACT_FORM_INITIAL);
    } catch (error) {
      addToast({
        title: 'No se pudo enviar',
        message: error?.data?.error || error?.message || 'Intenta nuevamente en unos minutos.',
        type: 'error',
      });
    } finally {
      setSendingContact(false);
    }
  };

  return (
    <div className="landing-page">
      <header className={`landing-nav${scrolled ? ' is-scrolled' : ''}`}>
        <MitynexMark tone="dark" />
        <nav className="landing-nav-links">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>
        <div className="landing-nav-actions">
          <button type="button" className="landing-nav-login" onClick={goToLogin}>
            Iniciar sesión
          </button>
          <a href="#contacto" className="landing-nav-cta">Solicitar demo</a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-ocean" aria-hidden="true">
          <span className="landing-ocean-glow landing-ocean-glow-a" />
          <span className="landing-ocean-glow landing-ocean-glow-b" />
          <span className="landing-ocean-grid" />
          <span className="landing-ocean-wave landing-ocean-wave-a" />
          <span className="landing-ocean-wave landing-ocean-wave-b" />
        </div>

        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <p className="landing-eyebrow">Plataforma para la mitilicultura</p>
            <h1>Todo el abastecimiento de choritos, en un solo sistema</h1>
            <p className="landing-hero-sub">
              Mitynex centraliza proveedores, disponibilidad de biomasa, tratos comerciales,
              programación de cosecha, muestreo técnico y alertas sanitarias, para que tu equipo
              deje de perseguir información en planillas sueltas.
            </p>
            <div className="landing-hero-actions">
              <a href="#contacto" className="landing-cta-primary">
                Solicitar demo <ArrowRight size={18} />
              </a>
              <a href="#modulos" className="landing-cta-ghost">Ver módulos</a>
            </div>
          </div>

          <div className="landing-hero-visual" aria-hidden="true">
            <div className="landing-visual-card landing-visual-card--main">
              <div className="landing-visual-card-header">
                <span className="landing-visual-dot" />
                <span className="landing-visual-dot" />
                <span className="landing-visual-dot" />
                <span className="landing-visual-card-title">Resumen general</span>
              </div>

              <div className="landing-visual-kpis">
                <div className="landing-visual-kpi">
                  <Building2 size={14} />
                  <span className="landing-visual-kpi-label">Proveedores</span>
                </div>
                <div className="landing-visual-kpi">
                  <Inbox size={14} />
                  <span className="landing-visual-kpi-label">Biomasa</span>
                </div>
                <div className="landing-visual-kpi">
                  <Handshake size={14} />
                  <span className="landing-visual-kpi-label">Tratos</span>
                </div>
                <div className="landing-visual-kpi">
                  <ShoppingCart size={14} />
                  <span className="landing-visual-kpi-label">Cosechas</span>
                </div>
              </div>

              <div className="landing-visual-chart" aria-hidden="true">
                <TrendingUp size={16} />
                <div className="landing-visual-chart-bars">
                  <span style={{ height: '40%' }} />
                  <span style={{ height: '62%' }} />
                  <span style={{ height: '48%' }} />
                  <span style={{ height: '74%' }} />
                  <span style={{ height: '58%' }} />
                  <span style={{ height: '84%' }} />
                </div>
              </div>

              <div className="landing-visual-chip">
                <ShieldCheck size={13} /> Estado sanitario · al día
              </div>
            </div>
            <div className="landing-visual-card landing-visual-card--float">
              <TestTube2 size={18} />
              <span>Muestreo registrado</span>
            </div>
            <div className="landing-visual-card landing-visual-card--float-2">
              <Calendar size={18} />
              <span>Gestión agendada</span>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-benefits" id="beneficios">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <div className="landing-benefit" key={text}>
            <Icon size={18} />
            <span>{text}</span>
          </div>
        ))}
      </div>

      <Reveal as="section" className="landing-what">
        <p className="landing-section-eyebrow">Qué es Mitynex</p>
        <h2>El sistema operativo de tu empresa mitilicultora</h2>
        <p className="landing-what-copy">
          Mitynex reemplaza las planillas sueltas y los seguimientos manuales por una plataforma
          única, pensada para empresas que gestionan abastecimiento de choritos. Cada empresa
          trabaja con su propia información, de forma independiente, dentro de la misma plataforma.
        </p>
      </Reveal>

      <section className="landing-modules" id="modulos">
        <Reveal className="landing-modules-heading">
          <p className="landing-section-eyebrow">Un sistema, todo el ciclo</p>
          <h2>Desde el primer contacto hasta la cosecha</h2>
        </Reveal>
        <div className="landing-modules-grid">
          {MODULES.map(({ icon: Icon, title, description, accent }, index) => (
            <Reveal
              as="div"
              className={`landing-module-card landing-module-card--${accent}`}
              key={title}
              style={{ transitionDelay: `${(index % 4) * 60}ms` }}
            >
              <div className="landing-module-icon">
                <Icon size={20} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <ArrowRight size={16} className="landing-module-arrow" />
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="landing-cta-band">
        <div className="landing-cta-band-main">
          <div>
            <h2>¿Listo para transformar tu operación?</h2>
            <p>Únete a las empresas que ya están ordenando su abastecimiento con Mitynex.</p>
          </div>
          <div className="landing-cta-band-actions">
            <a href="#contacto" className="landing-cta-primary">
              Solicitar demo <ArrowRight size={18} />
            </a>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="landing-cta-outline">
              Hablar con un asesor
            </a>
          </div>
        </div>
        <div className="landing-value-props">
          {VALUE_PROPS.map(({ icon: Icon, title, text }) => (
            <div className="landing-value-prop" key={title}>
              <div className="landing-value-prop-icon"><Icon size={18} /></div>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" className="landing-contact" id="contacto">
        <div className="landing-contact-inner">
          <div className="landing-contact-info">
            <p className="landing-section-eyebrow">Contacto</p>
            <h2>¿Tienes dudas o quieres una demo?</h2>
            <p className="landing-contact-copy">
              Escríbenos y te contactamos a la brevedad para mostrarte Mitynex en funcionamiento.
            </p>
            <a className="landing-contact-link" href={`mailto:${CONTACT_EMAIL}`}>
              <Mail size={18} /> {CONTACT_EMAIL}
            </a>
            <a className="landing-contact-link" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} /> Escríbenos por WhatsApp
            </a>
          </div>

          <form className="landing-contact-form" onSubmit={handleContactSubmit}>
            {/* Honeypot anti-spam: invisible para personas, los bots suelen rellenarlo */}
            <input
              type="text"
              name="website"
              value={contactForm.website}
              onChange={updateContactField('website')}
              className="landing-honeypot"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="landing-contact-row">
              <div className="mx-form-group">
                <label className="mx-label">Nombre</label>
                <input
                  className="mx-input"
                  value={contactForm.nombre}
                  onChange={updateContactField('nombre')}
                  required
                  placeholder="Tu nombre"
                />
              </div>
              <div className="mx-form-group">
                <label className="mx-label">Empresa</label>
                <input
                  className="mx-input"
                  value={contactForm.empresa}
                  onChange={updateContactField('empresa')}
                  placeholder="Nombre de tu empresa (opcional)"
                />
              </div>
            </div>

            <div className="landing-contact-row">
              <div className="mx-form-group">
                <label className="mx-label">Correo</label>
                <input
                  type="email"
                  className="mx-input"
                  value={contactForm.email}
                  onChange={updateContactField('email')}
                  required
                  placeholder="tucorreo@empresa.cl"
                />
              </div>
              <div className="mx-form-group">
                <label className="mx-label">Teléfono</label>
                <input
                  className="mx-input"
                  value={contactForm.telefono}
                  onChange={updateContactField('telefono')}
                  placeholder="+56 9... (opcional)"
                />
              </div>
            </div>

            <div className="mx-form-group">
              <label className="mx-label">Mensaje</label>
              <textarea
                className="mx-textarea"
                rows={4}
                value={contactForm.mensaje}
                onChange={updateContactField('mensaje')}
                required
                placeholder="Cuéntanos qué necesitas"
              />
            </div>

            <button type="submit" className="landing-cta-primary landing-contact-submit" disabled={sendingContact}>
              {sendingContact ? (
                <><Loader2 size={18} className="landing-spin" /> Enviando...</>
              ) : (
                <>Enviar mensaje <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        </div>
      </Reveal>

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <MitynexMark tone="dark" compact />
            <p>La plataforma integral para la gestión del abastecimiento en mitilicultura.</p>
          </div>
          <div className="landing-footer-col">
            <strong>Producto</strong>
            <a href="#modulos">Módulos</a>
            <a href="#beneficios">Beneficios</a>
          </div>
          <div className="landing-footer-col">
            <strong>Empresa</strong>
            <a href="#contacto">Contacto</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
          <div className="landing-footer-col">
            <strong>Cuenta</strong>
            <button type="button" onClick={goToLogin}>Iniciar sesión</button>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; 2026 Mitynex Prime. Todos los derechos reservados.</p>
        </div>
      </footer>

      <a
        className="landing-whatsapp-float"
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chatear por WhatsApp"
        title="Chatear por WhatsApp"
      >
        <MessageCircle size={26} />
      </a>
    </div>
  );
}
