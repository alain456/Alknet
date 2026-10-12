(function () {
  try {
    var key = 'isoko_hub_theme';
    var stored = localStorage.getItem(key);
    var dark = stored === 'dark'
      || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
