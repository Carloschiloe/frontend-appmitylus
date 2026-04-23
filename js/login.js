// js/login.js — maneja el formulario de login (cargado desde html/login.html)
(function () {
  var TOKEN_KEY = 'ammpp_token';
  var USER_KEY  = 'ammpp_user';
  var HOME_URL  = '/index.html';

  // Si ya hay sesión activa, ir directo al inicio
  if (localStorage.getItem(TOKEN_KEY)) {
    window.location.replace(HOME_URL);
    return;
  }

  var form       = document.getElementById('loginForm');
  var emailInput = document.getElementById('email');
  var passInput  = document.getElementById('password');
  var btnLogin   = document.getElementById('btnLogin');
  var errorBar   = document.getElementById('errorBar');
  var errorMsg   = document.getElementById('errorMsg');
  var toggleBtn  = document.getElementById('togglePassword');
  var eyeIcon    = document.getElementById('eyeIcon');

  function showError(msg) {
    errorMsg.textContent = msg;
    errorBar.classList.add('show');
  }

  function hideError() {
    errorBar.classList.remove('show');
  }

  function setLoading(loading) {
    btnLogin.disabled = loading;
    btnLogin.classList.toggle('loading', loading);
  }

  toggleBtn.addEventListener('click', function () {
    var isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
    eyeIcon.className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();

    var email    = emailInput.value.trim();
    var password = passInput.value;

    if (!email || !password) {
      showError('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (r) {
        if (r.status === 200 && r.data.token) {
          localStorage.setItem(TOKEN_KEY, r.data.token);
          if (r.data.usuario) localStorage.setItem(USER_KEY, JSON.stringify(r.data.usuario));
          window.location.replace(HOME_URL);
        } else {
          var msg = (r.data && r.data.message) || (r.data && r.data.error) || 'Credenciales incorrectas';
          showError(msg);
          setLoading(false);
        }
      })
      .catch(function (err) {
        showError('No se pudo conectar con el servidor. Intenta nuevamente.');
        setLoading(false);
      });
  });
})();
