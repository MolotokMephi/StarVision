/**
 * @file panels.js
 * @description Управление UI-панелями: список спутников, карточка выбранного КА.
 */

const MAX_VISIBLE = 24;

/** Инициализация панелей */
export function initPanels() {}

/**
 * Отрисовка списка спутников в #satList.
 * @param {Array} satellites
 * @param {number} selectedIndex — индекс (-1 если нет)
 * @param {Function} onSelect — колбэк(index)
 */
export function updateSatList(satellites, selectedIndex, onSelect) {
  const list = document.getElementById('satList');
  if (!list) return;
  list.innerHTML = '';

  const max = Math.min(satellites.length, MAX_VISIBLE);
  for (let i = 0; i < max; i++) {
    const sat = satellites[i];
    const planeHue = ((sat.plane || 0) * 60) % 360;

    const el = document.createElement('div');
    el.className = 'sat-item' + (i === selectedIndex ? ' selected' : '');

    const name = sat.name || `СК-${String(sat.plane + 1).padStart(2, '0')}${String(sat.index + 1).padStart(2, '0')}`;
    el.innerHTML = `
      <div class="sat-dot" style="background:hsl(${planeHue},80%,60%);box-shadow:0 0 6px hsl(${planeHue},80%,60%)"></div>
      <div class="sat-name">${name}</div>
      <div style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--green-dim);color:var(--green)">ОК</div>
    `;
    el.onclick = () => onSelect(i);
    list.appendChild(el);
  }

  if (satellites.length > max) {
    const m = document.createElement('div');
    m.style.cssText = 'font-size:10px;color:var(--text-muted);padding:6px 8px;text-align:center';
    m.textContent = `...ещё ${satellites.length - max}`;
    list.appendChild(m);
  }

  const badge = document.getElementById('activeSatsBadge');
  if (badge) badge.textContent = `${satellites.length}/${satellites.length}`;
}

/**
 * Показать карточку выбранного КА.
 */
export function showSelectedSatCard(sat, state) {
  const card = document.getElementById('selectedSatCard');
  if (!card) return;
  card.style.display = 'block';

  const nameEl = document.getElementById('selectedSatName');
  const name = sat.name || `СК-${String(sat.plane + 1).padStart(2, '0')}${String(sat.index + 1).padStart(2, '0')}`;
  if (nameEl) nameEl.textContent = name;
}

/** Скрыть карточку */
export function hideSelectedSatCard() {
  const card = document.getElementById('selectedSatCard');
  if (card) card.style.display = 'none';
}
