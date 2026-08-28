const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('passwordToggle');

passwordToggle.addEventListener('click', () => {
  const visible = passwordInput.type === 'text';
  passwordInput.type = visible ? 'password' : 'text';
  passwordToggle.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
  passwordToggle.setAttribute('aria-pressed', String(!visible));
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorText = document.getElementById('errorText');
  errorText.textContent = '';
  try {
    await api.post('/api/auth/login', { username, password });
    location.href = 'index.html';
  } catch (err) {
    errorText.textContent = 'Identifiant ou mot de passe incorrect.';
  }
});
