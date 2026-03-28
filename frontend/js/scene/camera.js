/**
 * @file camera.js
 * @description Управление камерой — орбитальные контролы (drag + zoom),
 * плавное перемещение к спутнику, сброс вида.
 */

/** Сферические координаты камеры */
const spherical = {
  radius: 4,
  phi: Math.PI / 3,     // угол от оси Y (полярный)
  theta: 0,             // азимутальный угол
};

/** Настройки ограничений */
const LIMITS = {
  minRadius: 1.5,
  maxRadius: 20,
  minPhi: 0.1,
  maxPhi: Math.PI - 0.1,
};

/** Состояние перетаскивания */
let isDragging = false;
let prevPointer = { x: 0, y: 0 };

/** Целевые координаты для плавной анимации */
let target = null;
const LERP_SPEED = 0.05;

/**
 * Инициализировать орбитальные контролы (pointer drag + wheel zoom).
 * @param {THREE.WebGLRenderer} renderer
 */
export function initOrbitControls(renderer) {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    prevPointer.x = e.clientX;
    prevPointer.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevPointer.x;
    const dy = e.clientY - prevPointer.y;
    prevPointer.x = e.clientX;
    prevPointer.y = e.clientY;

    // Вращение: 0.005 рад на пиксель
    spherical.theta -= dx * 0.005;
    spherical.phi = Math.max(
      LIMITS.minPhi,
      Math.min(LIMITS.maxPhi, spherical.phi - dy * 0.005)
    );

    // Сбросить анимацию при ручном управлении
    target = null;
  });

  canvas.addEventListener('pointerup', (e) => {
    isDragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    spherical.radius *= 1 + e.deltaY * 0.001;
    spherical.radius = Math.max(
      LIMITS.minRadius,
      Math.min(LIMITS.maxRadius, spherical.radius)
    );
    target = null;
  }, { passive: false });
}

/**
 * Применить сферические координаты к камере.
 * @param {THREE.PerspectiveCamera} camera
 */
export function updateCamera(camera) {
  // Плавная анимация к целевой точке
  if (target) {
    spherical.radius += (target.radius - spherical.radius) * LERP_SPEED;
    spherical.phi    += (target.phi    - spherical.phi)    * LERP_SPEED;
    spherical.theta  += (target.theta  - spherical.theta)  * LERP_SPEED;

    // Завершить анимацию при достижении цели
    const dr = Math.abs(target.radius - spherical.radius);
    if (dr < 0.01) target = null;
  }

  // Сферические → декартовы
  camera.position.set(
    spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
    spherical.radius * Math.cos(spherical.phi),
    spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
  );
  camera.lookAt(0, 0, 0);
}

/**
 * Сбросить вид камеры к начальному положению.
 */
export function resetView() {
  target = {
    radius: 4,
    phi: Math.PI / 3,
    theta: 0,
  };
}

/**
 * Плавный переход камеры к позиции спутника.
 * @param {THREE.Vector3} position — позиция спутника в сцене
 */
export function focusOnSatellite(position) {
  const r = position.length();
  target = {
    radius: r + 0.5,
    phi: Math.acos(position.y / r),
    theta: Math.atan2(position.x, position.z),
  };
}

/**
 * Получить текущие сферические координаты камеры.
 * @returns {{ radius: number, phi: number, theta: number }}
 */
export function getSpherical() {
  return { ...spherical };
}
