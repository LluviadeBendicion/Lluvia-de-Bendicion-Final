(() => {
  const room = document.getElementById('peticiones');
  const track = room.querySelector('audio');
  const toggle = room.querySelector('.peticion-sonido');
  const label = toggle.querySelector('[data-sound-label]');
  let wantsMusic = true;

  function updateToggle() {
    const playing = !track.paused;
    toggle.setAttribute('aria-pressed', String(playing));
    label.textContent = playing ? 'Pausar música' : 'Activar música suave';
  }

  function updatePlayback() {
    if (wantsMusic && room.classList.contains('active') && !document.hidden) {
      // The direct link may open before a gesture allows autoplay.
      track.play().catch(updateToggle);
    } else {
      track.pause();
    }
  }

  toggle.addEventListener('click', () => {
    wantsMusic = track.paused;
    updatePlayback();
  });
  track.addEventListener('play', () => {
    if (!wantsMusic || !room.classList.contains('active') || document.hidden) track.pause();
    updateToggle();
  });
  track.addEventListener('pause', updateToggle);
  document.addEventListener('lldb:view-change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  window.addEventListener('pagehide', () => track.pause());
  window.addEventListener('pageshow', updatePlayback);
})();
