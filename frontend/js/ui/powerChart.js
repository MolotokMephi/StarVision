/**
 * @file powerChart.js
 * @description График энергобаланса КА: генерация, потребление, заряд АКБ.
 */

const BATTERY_CAPACITY = 20; // Вт·ч
const BUS_POWER = 1.5;       // Вт — бортовые системы
const HISTORY_LEN = 200;

export class PowerChart {
  constructor() {
    this.history = [];
    this.batteryWh = BATTERY_CAPACITY * 0.8; // начальный заряд 80%
    this.lastTime = null;
  }

  /**
   * Обновить энергобаланс.
   * @param {Object} config   — конфигурация (solarPower, payloadPower)
   * @param {number} simTime  — время симуляции (ms)
   * @param {number} simSpeed — множитель скорости
   */
  update(config, simTime, simSpeed) {
    const dtH = this.lastTime
      ? ((simTime - this.lastTime) / 3_600_000) * simSpeed
      : 0;
    this.lastTime = simTime;
    if (dtH <= 0 || dtH > 1) return;

    // Фаза орбиты (упрощённая модель тени)
    const orbitPhase = ((simTime / 60_000) % 90) / 90; // 0..1
    const inShadow = orbitPhase > 0.65; // ~35% орбиты в тени
    const solarGen = inShadow ? 0 : config.solarPower;

    const consumption = config.payloadPower + BUS_POWER;
    const net = solarGen - consumption;

    // Модель заряда/разряда АКБ
    this.batteryWh = Math.max(0, Math.min(BATTERY_CAPACITY,
      this.batteryWh + net * dtH));

    this.history.push({ gen: solarGen, cons: consumption, bat: this.getBatteryCharge() });
    if (this.history.length > HISTORY_LEN) this.history.shift();
  }

  /**
   * Отрисовка графика.
   * @param {HTMLCanvasElement} canvas
   */
  draw(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    const len = this.history.length;
    if (len < 2) return;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const maxP = 25;
    const stepX = w / (HISTORY_LEN - 1);

    // Генерация (зелёная)
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    this.history.forEach((p, i) => {
      const x = i * stepX;
      const y = h - (p.gen / maxP) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Потребление (красная)
    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    this.history.forEach((p, i) => {
      const x = i * stepX;
      const y = h - (p.cons / maxP) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Заряд АКБ (жёлтая пунктирная)
    ctx.beginPath();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    this.history.forEach((p, i) => {
      const x = i * stepX;
      const y = h - (p.bat / 100) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Легенда
    ctx.font = '16px JetBrains Mono';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('● Генер.', 6, 16);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('● Потр.', w * 0.45, 16);

    // Обновить DOM элементы
    const bc = this.getBatteryCharge();
    const be = document.getElementById('batteryVal');
    if (be) {
      be.textContent = bc.toFixed(0);
      be.style.color = bc > 30 ? 'var(--green)' : bc > 15 ? 'var(--amber)' : 'var(--red)';
    }
    const pb = document.getElementById('powerBadge');
    if (pb && this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      const net = last.gen - last.cons;
      pb.textContent = net >= 0 ? 'БАЛАНС +' : 'РАЗРЯД';
      pb.className = 'card-badge ' + (net >= 0 ? 'badge-active' : 'badge-warning');
    }
  }

  /** @returns {number} заряд АКБ в процентах */
  getBatteryCharge() {
    return (this.batteryWh / BATTERY_CAPACITY) * 100;
  }

  /** @returns {string} текущий энергобаланс */
  getPowerBalance() {
    if (this.history.length === 0) return 'Нет данных';
    const last = this.history[this.history.length - 1];
    const net = last.gen - last.cons;
    return net >= 0 ? `+${net.toFixed(1)} Вт` : `${net.toFixed(1)} Вт`;
  }
}
