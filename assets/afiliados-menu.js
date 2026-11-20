
(() => {
  const section = document.getElementById('afiliados');
  const menu = section.querySelector('.aff-menu');
  const buttons = Array.from(menu.querySelectorAll('[data-aff-section]'));
  const regions = Array.from(section.querySelectorAll('[data-aff-scroll-region]'));
  const stage = section.querySelector('.lldb-aff-stage');
  const narrow = window.matchMedia('(max-width:700px)');
  function placeMenu() {
    if (narrow.matches) section.insertBefore(menu, stage);
    else stage.append(menu);
  }
  narrow.addEventListener('change', placeMenu);
  placeMenu();
  let pendingFrame = false;
  let navigating = false;
  let navigationTimeout;

  function select(key) {
    for (const button of buttons) {
      if (button.dataset.affSection === key) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    }
  }

  function updateFromScroll() {
    pendingFrame = false;
    if (navigating || !section.classList.contains('active')) return;
    const line = window.innerHeight * .35;
    let visible = regions[0];
    for (const region of regions) {
      if (region.getBoundingClientRect().top <= line) visible = region;
    }
    const contact = regions.find(item => item.dataset.affScrollRegion === 'contact');
    const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    if (atBottom && contact.getBoundingClientRect().top < window.innerHeight) visible = contact;
    select(visible.dataset.affScrollRegion);
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const key = button.dataset.affSection;
      select(key);
      const region = regions.find(item => item.dataset.affScrollRegion === key);
      if (!region) return;
      navigating = true;
      clearTimeout(navigationTimeout);
      const top = region.getBoundingClientRect().top + window.scrollY - Math.min(120, window.innerHeight * .14);
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      navigationTimeout = setTimeout(() => { navigating = false; }, 150);
    });
  }

  window.addEventListener('scroll', () => {
    if (!pendingFrame) {
      pendingFrame = true;
      requestAnimationFrame(updateFromScroll);
    }
  }, { passive: true });
  document.addEventListener('lldb:view-change', () => {
    clearTimeout(navigationTimeout);
    navigating = false;
    if (section.classList.contains('active')) select('overview');
  });
})();
