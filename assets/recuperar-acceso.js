(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const user = params.get('usuario');
  let code = params.get('enlace');
  history.replaceState(null, '', location.pathname);
  const form = document.querySelector('form');
  const result = document.getElementById('recovery-result');
  if (!['omar-rivera', 'ever-caraballo'].includes(user) || !/^[A-Za-z0-9_-]{43}$/.test(code || '')) {
    result.textContent = 'Abre el enlace completo del correo de recuperación. Si ya venció, solicita otro desde el Panel Maestro.';
    return;
  }
  form.hidden = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const { password } = form.elements;
    const button = form.querySelector('button');
    button.disabled = true;
    result.textContent = 'Guardando…';
    try {
      const response = await fetch('/api/prayer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'redeem-email-recovery', user, code, newPassword:password.value }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar la contraseña.');
      code = '';
      form.reset();
      form.hidden = true;
      result.textContent = 'Contraseña actualizada. Ve a Inicio y haz cinco clics en LLDB para volver a entrar al Panel Maestro.';
    } catch (error) {
      result.textContent = error instanceof TypeError ? 'No pudimos conectar. Inténtalo de nuevo.' : error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
