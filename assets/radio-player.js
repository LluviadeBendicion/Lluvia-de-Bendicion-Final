(() => {
  const radio = document.getElementById('radio');
  const host = document.getElementById('lldb-casterfm-player');
  const controls = document.getElementById('lldb-radio-controls');
  const status = document.getElementById('lldb-player-status');
  const open = radio.querySelector('.lldb-radio-controls-open');
  const ledLabel = document.getElementById('lldb-function-status-label');
  let script;
  let timeout;
  let active = false;

  function report(message) {
    status.textContent = message;
  }

  function clearPlayer() {
    clearTimeout(timeout);
    // Removing the iframe ends its media session before another can be created.
    host.replaceChildren();
  }

  function loadPlayer() {
    clearPlayer();
    report('Cargando reproductor oficial de Caster.fm…');
    const embed = document.createElement('div');
    embed.className = 'cstrEmbed';
    embed.setAttribute('data-type', 'newStreamPlayer');
    embed.setAttribute('data-publicToken', '6cd292b6-2d65-47a8-aa43-21cacdf34938');
    embed.setAttribute('data-theme', 'dark');
    embed.setAttribute('data-color', 'd5a34e');
    embed.setAttribute('data-channelId', '');
    embed.setAttribute('data-rendered', 'false');
    // Caster.fm checks the exact three attribution links before creating its iframe.
    for (const text of ['Shoutcast Hosting', 'Stream Hosting', 'Radio Server Hosting']) {
      const link = document.createElement('a');
      link.href = 'https://www.caster.fm';
      link.textContent = text;
      embed.append(link);
    }
    host.append(embed);
    timeout = setTimeout(() => {
      report('No se pudo confirmar la carga de Caster.fm. Comprueba tu conexión y pulsa Recargar reproductor.');
    }, 20000);

    if (typeof window.casterfmWidgetsRescan === 'function') {
      window.casterfmWidgetsRescan();
      return;
    }
    if (script) return;
    script = document.createElement('script');
    script.src = 'https://cdn.cloud.caster.fm/widgets/embed.js';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      report('No se pudo cargar Caster.fm. Comprueba tu conexión y pulsa Recargar reproductor.');
      script.remove();
      script = null;
    };
    document.head.append(script);
  }

  // Only a validated message from this instance confirms the widget initialized.
  // Caster.fm exposes no documented playback/volume commands for custom buttons.
  window.addEventListener('message', event => {
    const frame = host.querySelector('iframe');
    if (!active || !frame || event.source !== frame.contentWindow) return;
    if (event.origin !== 'https://widgets.cloud.caster.fm') return;
    if (event.data?.type !== 'validate') return;
    if (frame.id !== 'casterfmWidgetIframe_' + event.data.frameId) return;
    clearTimeout(timeout);
    frame.title = 'Reproductor oficial de Lluvia de Bendición en Caster.fm';
    report('Controles de Caster.fm disponibles. Pulsa PLAY para iniciar. El estado de la señal se muestra en el reproductor.');
  });

  function syncView() {
    const next = radio.classList.contains('active');
    if (next === active) return;
    active = next;
    if (active) {
      // The illustration cannot establish whether the audio is playing.
      ledLabel.textContent = 'AUDIO';
      document.getElementById('lldb-function-led').setAttribute('aria-label', 'Estado de audio en el reproductor oficial');
      loadPlayer();
    } else {
      clearPlayer();
      report('Reproducción detenida al salir de Radio.');
      radio.scrollTop = 0;
    }
  }

  open.addEventListener('click', () => {
    // Prevent the entrance sound from overlapping the visitor's stream selection.
    const video = document.getElementById('lldb-radio-startup-video');
    video.pause();
    video.style.display = 'none';
    radio.querySelectorAll('.video-active').forEach(element => element.classList.remove('video-active'));
    controls.scrollIntoView({ block: 'start', behavior: 'instant' });
    controls.focus({ preventScroll: true });
  });
  document.getElementById('lldb-radio-return').addEventListener('click', () => {
    radio.scrollTo({ top: 0, behavior: 'instant' });
    open.focus({ preventScroll: true });
  });
  document.getElementById('lldb-radio-stop').addEventListener('click', () => {
    clearPlayer();
    ledLabel.textContent = 'AUDIO';
    report('Audio detenido. Pulsa Recargar reproductor y después PLAY para volver a escuchar.');
  });
  window.addEventListener('pagehide', () => {
    clearPlayer();
    active = false;
  });
  window.addEventListener('pageshow', syncView);
  document.getElementById('lldb-radio-retry').addEventListener('click', () => {
    if (active) loadPlayer();
  });
  document.addEventListener('lldb:view-change', syncView);
  syncView();
})();
