/** Relie un libellé voisin à son champ, et annonce les encadrés d’erreur. */

const FIELD = 'input, select, textarea';
let sequence = 0;
let frame = 0;

function bindLabels(root) {
  root.querySelectorAll('label').forEach((label) => {
    if (label.htmlFor || label.querySelector(FIELD)) return;
    const next = label.nextElementSibling;
    if (!next || !next.matches(FIELD)) return;
    if (!next.id) {
      sequence += 1;
      next.id = `champ-${sequence}`;
    }
    label.htmlFor = next.id;
  });
}

function markErrors(root) {
  root.querySelectorAll('[class*="bg-alert"]').forEach((node) => {
    if (!node.getAttribute('role')) node.setAttribute('role', 'alert');
  });
}

function scan() {
  if (!document.body) return;
  bindLabels(document.body);
  markErrors(document.body);
}

export function installA11y() {
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      scan();
    });
  };
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
}
