// js/usuarios/index.js — Gestión de usuarios (solo admin)

const API = '/api/auth/usuarios';

let usuarios = [];
let editingId = null;

// ── Helpers ──────────────────────────────────────────────────────────
function initials(nombre) {
  return nombre.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function rolBadge(rol) {
  const map = { admin: ['admin', 'Administrador'], usuario: ['usuario', 'Usuario'], lectura: ['lectura', 'Solo lectura'] };
  const [cls, label] = map[rol] || ['usuario', rol];
  return `<span class="usr-badge usr-badge-${cls}"><i class="bi bi-shield-check"></i> ${label}</span>`;
}

function estadoBadge(activo) {
  return activo
    ? `<span class="usr-badge usr-badge-activo"><i class="bi bi-circle-fill" style="font-size:7px;"></i> Activo</span>`
    : `<span class="usr-badge usr-badge-inactivo"><i class="bi bi-circle-fill" style="font-size:7px;"></i> Inactivo</span>`;
}

// ── Render tabla ─────────────────────────────────────────────────────
function renderTabla() {
  const tbody = document.getElementById('tbody-usuarios');
  const count = document.getElementById('usr-count');
  count.textContent = `Usuarios (${usuarios.length})`;

  if (!usuarios.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="usr-empty"><i class="bi bi-people"></i>No hay usuarios creados aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td>
        <div class="usr-name-cell">
          <div class="usr-initials">${initials(u.nombre)}</div>
          <div>
            <div class="usr-name">${u.nombre}</div>
            <div class="usr-email">${u.email}</div>
          </div>
        </div>
      </td>
      <td>${rolBadge(u.rol)}</td>
      <td>${estadoBadge(u.activo)}</td>
      <td style="font-size:12px;color:#64748b;">${formatDate(u.ultimoLogin)}</td>
      <td style="text-align:right;">
        <button class="am-btn am-btn-flat" style="padding:4px 10px;font-size:12px;" data-edit="${u._id}" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="am-btn am-btn-flat" style="padding:4px 10px;font-size:12px;${u.activo ? 'color:#f87171;' : 'color:#4ade80;'}"
                data-toggle="${u._id}" data-activo="${u.activo}" title="${u.activo ? 'Desactivar' : 'Activar'}">
          <i class="bi bi-${u.activo ? 'person-slash' : 'person-check'}"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ── Cargar usuarios ──────────────────────────────────────────────────
async function cargarUsuarios() {
  try {
    const res = await fetch(API);
    const data = await res.json();
    if (data.ok) {
      usuarios = data.items || [];
      renderTabla();
    } else {
      throw new Error(data.error || 'Error al cargar');
    }
  } catch (e) {
    document.getElementById('tbody-usuarios').innerHTML =
      `<tr><td colspan="5" class="usr-empty"><i class="bi bi-wifi-off"></i>${e.message}</td></tr>`;
  }
}

// ── Modal ────────────────────────────────────────────────────────────
function openModal(usuario = null) {
  editingId = usuario ? usuario._id : null;

  const modal   = document.getElementById('modalUsuario');
  const title   = document.getElementById('modalUsuarioTitle');
  const emailRow = document.getElementById('u-email-row');
  const passRow  = document.getElementById('u-password-row');

  title.textContent = usuario ? 'Editar usuario' : 'Nuevo usuario';

  // Email y contraseña solo en creación
  emailRow.style.display = usuario ? 'none' : '';
  passRow.style.display  = usuario ? 'none' : '';

  document.getElementById('u-nombre').value   = usuario?.nombre  || '';
  document.getElementById('u-email').value    = usuario?.email   || '';
  document.getElementById('u-password').value = '';
  document.getElementById('u-rol').value      = usuario?.rol     || 'usuario';
  document.getElementById('u-activo').checked = usuario ? usuario.activo : true;
  ocultarError();

  modal.classList.add('open');
  document.getElementById('u-nombre').focus();
}

function closeModal() {
  document.getElementById('modalUsuario').classList.remove('open');
  editingId = null;
}

function mostrarError(msg) {
  document.getElementById('u-error').style.display = 'block';
  document.getElementById('u-error-msg').textContent = msg;
}

function ocultarError() {
  document.getElementById('u-error').style.display = 'none';
}

// ── Guardar ──────────────────────────────────────────────────────────
async function guardar() {
  ocultarError();
  const btn = document.getElementById('u-guardar');
  const nombre   = document.getElementById('u-nombre').value.trim();
  const email    = document.getElementById('u-email').value.trim();
  const password = document.getElementById('u-password').value;
  const rol      = document.getElementById('u-rol').value;
  const activo   = document.getElementById('u-activo').checked;

  if (!nombre) return mostrarError('El nombre es obligatorio.');
  if (!editingId && !email) return mostrarError('El correo es obligatorio.');
  if (!editingId && password.length < 8) return mostrarError('La contraseña debe tener al menos 8 caracteres.');

  btn.disabled = true;
  btn.innerHTML = '<span style="width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;"></span> Guardando…';

  try {
    let res, data;

    if (!editingId) {
      res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, email, password, rol }) });
      data = await res.json();
    } else {
      res  = await fetch(`${API}/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, rol, activo }) });
      data = await res.json();
    }

    if (!res.ok || !data.ok) throw new Error(data.error || data.errores?.[0]?.msg || 'Error al guardar');

    closeModal();
    await cargarUsuarios();
  } catch (e) {
    mostrarError(e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar';
  }
}

// ── Toggle activo ────────────────────────────────────────────────────
async function toggleActivo(id, estaActivo) {
  const accion = estaActivo ? 'desactivar' : 'activar';
  if (!confirm(`¿Confirmas ${accion} este usuario?`)) return;

  try {
    if (estaActivo) {
      const res  = await fetch(`${API}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } else {
      const res  = await fetch(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: true }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    }
    await cargarUsuarios();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ── Eventos ──────────────────────────────────────────────────────────
document.getElementById('btnNuevoUsuario').addEventListener('click', () => openModal());

document.getElementById('u-guardar').addEventListener('click', guardar);

document.querySelectorAll('.js-usr-close').forEach(btn =>
  btn.addEventListener('click', closeModal)
);

document.getElementById('u-toggle-eye').addEventListener('click', function () {
  const inp = document.getElementById('u-password');
  const ico = document.getElementById('u-eye-icon');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  ico.className = inp.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
});

document.getElementById('tbody-usuarios').addEventListener('click', e => {
  const editBtn   = e.target.closest('[data-edit]');
  const toggleBtn = e.target.closest('[data-toggle]');

  if (editBtn) {
    const u = usuarios.find(x => x._id === editBtn.dataset.edit);
    if (u) openModal(u);
  }
  if (toggleBtn) {
    toggleActivo(toggleBtn.dataset.toggle, toggleBtn.dataset.activo === 'true');
  }
});

// Enter en campos del modal
document.getElementById('modalUsuario').addEventListener('keydown', e => {
  if (e.key === 'Enter') guardar();
});

// ── Solo admin puede ver este módulo ────────────────────────────────
(function checkAdmin() {
  const user = window.__AUTH__?.getUser();
  if (user && user.rol !== 'admin') {
    document.querySelector('.maest-shell').innerHTML = `
      <div style="text-align:center;padding:80px 20px;color:#64748b;">
        <i class="bi bi-lock" style="font-size:48px;display:block;margin-bottom:16px;"></i>
        <p style="font-size:16px;font-weight:600;">Acceso restringido</p>
        <p style="font-size:13px;">Solo los administradores pueden gestionar usuarios.</p>
      </div>`;
  }
})();

// ── Init ─────────────────────────────────────────────────────────────
cargarUsuarios();
