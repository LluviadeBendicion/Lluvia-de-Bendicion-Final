/* ZaraRadio metadata: presentation only. Does not change audio playback or approved radio styling. */
(() => {
  const now = document.getElementById('now-playing');
  const status = document.getElementById('radio-status');
  if (!now || !status) return;
  let lastVerified = false;
  async function refresh() {
    try {
      const response = await fetch('/api/now-playing', { cache: 'no-store' });
      if (!response.ok) throw new Error('Metadata unavailable');
      const data = await response.json();
      if (data.status === 'playing' && typeof data.title === 'string' && data.title) {
        const artist = typeof data.artist === 'string' && data.artist.trim() ? data.artist.trim() + ' — ' : '';
        now.textContent = artist + data.title;
        status.textContent = 'Programación musical';
        lastVerified = true;
      } else if (lastVerified) {
        now.textContent = 'Información no disponible';
        status.textContent = 'Señal no verificada';
        lastVerified = false;
      }
    } catch {
      if (lastVerified) {
        now.textContent = 'Información no disponible';
        status.textContent = 'Señal no verificada';
        lastVerified = false;
      }
    }
  }
  refresh();
  setInterval(refresh, 15000);
})();
