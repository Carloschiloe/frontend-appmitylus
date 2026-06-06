const STORAGE_KEY = 'mitynex_last_actions';
const MAX_ACTIONS = 20;

function readActions() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeActions(actions) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(actions.slice(-MAX_ACTIONS)));
  } catch {
    // No bloquear la UI por storage lleno o deshabilitado.
  }
}

export function recordAction(action = {}) {
  const safe = {
    type: action.type || 'action',
    label: String(action.label || action.text || '').slice(0, 160),
    route: action.route || (typeof window !== 'undefined' ? window.location.pathname : ''),
    at: new Date().toISOString(),
  };
  writeActions([...readActions(), safe]);
  return safe;
}

export function getLastActions() {
  return readActions().slice(-MAX_ACTIONS);
}

export function installActionTrail() {
  if (typeof window === 'undefined' || window.__mitynexActionTrailInstalled) return;
  window.__mitynexActionTrailInstalled = true;

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('button, a, [role="button"]');
    if (!target) return;
    const label = target.getAttribute('aria-label')
      || target.innerText
      || target.textContent
      || target.getAttribute('title')
      || target.tagName;
    recordAction({ type: 'click', label: label.trim().slice(0, 120) });
  }, { capture: true });
}
