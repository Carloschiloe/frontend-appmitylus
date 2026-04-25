/**
 * Sidebar.js - Componente de navegación centralizado
 * Maneja el renderizado del menú lateral y su lógica de interacción.
 */

const MENU_STRUCTURE = [
  {
    id: 'dashboard',
    label: 'Inicio',
    icon: 'bi-speedometer2',
    links: [
      { label: 'Dashboard', href: '/index.html#dashboard-home', icon: 'bi-house-door' }
    ]
  },
  {
    id: 'contactos',
    label: 'Proveedores MMPP',
    icon: 'bi-person-lines-fill',
    links: [
      { label: 'Bandeja', href: '/html/Abastecimiento/contactos/contactos.html#tab-gestion', icon: 'bi-inbox' },
      { label: 'Directorio', href: '/html/Abastecimiento/contactos/contactos.html#tab-directorio', icon: 'bi-buildings' },
      { label: 'Calendario', href: '/html/Abastecimiento/contactos/contactos.html#tab-calendario', icon: 'bi-calendar3' },
      { label: 'Interacciones', href: '/html/Abastecimiento/contactos/contactos.html#tab-interacciones', icon: 'bi-chat-left-dots' },
      { label: 'Tratos', href: '/html/Abastecimiento/contactos/contactos.html#tab-tratos', icon: 'bi-people' },
      { label: 'Muestreos', href: '/html/Abastecimiento/contactos/contactos.html#tab-muestreos', icon: 'bi-eyedropper' }
    ]
  },
  {
    id: 'centros',
    label: 'Directorio de Centros',
    icon: 'bi-buildings',
    links: [
      { label: 'Centros', href: '/html/Centros/index.html#tab-centros', icon: 'bi-grid-1x2' },
      { label: 'Mapa', href: '/html/Centros/index.html#tab-mapa', icon: 'bi-geo-alt' }
    ]
  },
  {
    id: 'biomasa',
    label: 'Biomasa',
    icon: 'bi-droplet-half',
    links: [
      { label: 'Planificación', href: '/index.html#biomasa', icon: 'bi-bar-chart-steps' }
    ]
  },
  {
    id: 'historial',
    label: 'Historial',
    icon: 'bi-clock-history',
    links: [
      { label: 'Gestiones', href: '/html/Abastecimiento/historial/index.html', icon: 'bi-journal-text' }
    ]
  },
  {
    id: 'config',
    label: 'Configuración',
    icon: 'bi-sliders',
    links: [
      { label: 'Maestros', href: '/html/Maestros/index.html', icon: 'bi-table' },
      { label: 'Usuarios', href: '/html/Usuarios/index.html', icon: 'bi-people' }
    ]
  }
];

export class Sidebar {
  constructor(containerId = 'sidebar-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`Sidebar: No se encontró el contenedor #${containerId}`);
      return;
    }
    if (this.container.dataset.sidebarInited === '1') return;
    this.container.dataset.sidebarInited = '1';
    this.init();
  }

  init() {
    this.render();
    this.setupEventListeners();
    this.updateActiveState();
    window.addEventListener('hashchange', () => this.updateActiveState());
    window.addEventListener('mmpp:navigate', () => this.updateActiveState());

    // Red de seguridad: Eliminar overlays de tutoriales legados (TapTarget)
    const nuke = () => {
      document
        .querySelectorAll('.tap-target, .tap-target-wrapper, .tap-target-wave, .tap-target-origin, .tap-target-content, [class*="tap-target"]')
        .forEach((el) => el.remove());
    };
    nuke();
    setTimeout(nuke, 1000); // Reintento por si se inyecta tarde

    // Red de seguridad: si quedÃ³ un overlay pegado sin ningÃºn modal abierto, lo removemos
    this.cleanupStuckOverlays();
  }

  cleanupStuckOverlays() {
    const hasVisibleOpenModal = [...document.querySelectorAll('.modal.open')].some((el) => {
      try {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
        return el.getClientRects().length > 0;
      } catch {
        return false;
      }
    });
    if (hasVisibleOpenModal) return;
    document.querySelectorAll('.modal-overlay, .sidenav-overlay').forEach((el) => el.remove());
    document.body.style.overflow = '';
  }

  render() {
    const user = (typeof window.__AUTH__ !== 'undefined' && window.__AUTH__.getUser())
      ? window.__AUTH__.getUser()
      : null;
    const userName = user ? (user.nombre || user.email || '') : '';
    const userRole = user ? (user.rol || '') : '';

    this.container.innerHTML = `
      <aside class="sidebar" aria-label="Navegacion principal">
        <div class="brand">
          <span class="brand-mark">AM</span>
          <div>
            <p class="brand-title">Abastecimiento MMPP</p>
            <p class="brand-sub">Control operativo</p>
          </div>
        </div>

        <nav id="sideNav" class="menu">
          ${MENU_STRUCTURE.map(group => this.renderGroup(group)).join('')}
        </nav>

        <div class="sidebar-foot">
          ${userName ? `
          <div class="sidebar-user">
            <span class="sidebar-user-avatar"><i class="bi bi-person-circle"></i></span>
            <div class="sidebar-user-info">
              <p class="sidebar-user-name">${userName}</p>
              ${userRole ? `<p class="sidebar-user-role">${userRole}</p>` : ''}
            </div>
          </div>` : ''}
          <button id="btnLogout" class="sidebar-logout" type="button">
            <i class="bi bi-box-arrow-right"></i> Cerrar sesión
          </button>
        </div>
      </aside>
    `;

    const logoutBtn = this.container.querySelector('#btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (typeof window.__AUTH__ !== 'undefined') {
          window.__AUTH__.logout();
        } else {
          localStorage.removeItem('ammpp_token');
          localStorage.removeItem('ammpp_user');
          window.location.replace('/html/login.html');
        }
      });
    }
  }

  renderGroup(group) {
    return `
      <section class="menu-group" data-group="${group.id}">
        <button class="menu-head" type="button" data-toggle-group="${group.id}" aria-expanded="false">
          <span class="menu-head-text"><i class="bi ${group.icon}"></i> ${group.label}</span>
          <i class="bi bi-chevron-down caret"></i>
        </button>
        <div class="submenu">
          ${group.links.map(link => `
            <a href="${link.href}" data-link-id="${link.href}">
              <i class="bi ${link.icon}"></i> ${link.label}
            </a>
          `).join('')}
        </div>
      </section>
    `;
  }

  setupEventListeners() {
    this.container.addEventListener('click', (e) => {
      this.cleanupStuckOverlays();

      const target = e.target;
      if (!(target instanceof Element)) return;

      const toggleBtn = target.closest('[data-toggle-group]');
      if (toggleBtn) {
        const group = toggleBtn.closest('.menu-group');
        if (!group) return;
        const willOpen = !group.classList.contains('is-open');

        // Cerrar otros (opcional, según comportamiento deseado)
        this.container.querySelectorAll('.menu-group.is-open').forEach((g) => {
          if (g !== group) {
            g.classList.remove('is-open');
            g.querySelector('.menu-head')?.setAttribute('aria-expanded', 'false');
          }
        });

        group.classList.toggle('is-open', willOpen);
        toggleBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      }
    }, true);
  }

  updateActiveState() {
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;
    const fullUrl = currentPath + currentHash;

    this.container.querySelectorAll('.submenu a').forEach(a => {
      const href = a.getAttribute('href');
      const isActive = fullUrl.endsWith(href) || (currentPath === href && !currentHash);
      
      a.classList.toggle('is-active-link', isActive);
      
      if (isActive) {
        const group = a.closest('.menu-group');
        group.classList.add('is-open', 'has-active-link');
        group.querySelector('.menu-head')?.setAttribute('aria-expanded', 'true');
      }
    });
  }
}

// Auto-inicialización si el contenedor existe
document.addEventListener('DOMContentLoaded', () => {
  const c = document.getElementById('sidebar-container');
  if (c && c.dataset.sidebarInited !== '1') {
    new Sidebar();
  }
});
