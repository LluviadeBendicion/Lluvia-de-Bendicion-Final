(() => {
  const controls = [...document.querySelectorAll('[data-verse-font]')];
  const key = 'lldb-verse-font';
  let choice = 'bodoni';
  try { if (localStorage.getItem(key) === 'original') choice = 'original'; } catch {}
  function apply(value) {
    choice = value === 'original' ? 'original' : 'bodoni';
    document.documentElement.dataset.verseFont = choice;
    controls.forEach(control => { control.value = choice; });
    try { localStorage.setItem(key, choice); } catch {}
    window.dispatchEvent(new Event('versefontchange'));
    if (choice === 'bodoni') document.fonts.load('italic 900 32px "Bodoni Moda"').then(() => window.dispatchEvent(new Event('versefontchange')), () => {});
  }
  controls.forEach(control => control.addEventListener('change', () => apply(control.value)));
  window.LLDBVerseStyle = { font: () => choice === 'bodoni' ? 'italic 900' : 'normal 400', family: () => choice === 'bodoni' ? '"Bodoni Moda"' : 'Georgia' };
  apply(choice);
})();
