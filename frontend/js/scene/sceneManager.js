/**
 * @file sceneManager.js
 * @description Оркестратор Three.js сцены — инициализация, освещение,
 * фон звёздного неба, цикл анимации.
 */

let scene, camera, renderer;
let raycaster, mouse;
let prevTime = 0;

/**
 * Инициализация сцены, камеры и рендерера.
 * @returns {{ scene, camera, renderer }}
 */
export function initScene() {
  scene = new THREE.Scene();

  // Перспективная камера
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
  );
  camera.position.set(0, 0, 4);

  // WebGL рендерер
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x050510);
  renderer.outputEncoding = THREE.sRGBEncoding;
  const container = document.getElementById('canvas-container');
  (container || document.body).appendChild(renderer.domElement);

  // Освещение — имитация Солнца
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  const ambient = new THREE.AmbientLight(0x333344, 0.4);
  scene.add(ambient);

  // Звёздный фон
  _createStars();

  // Raycaster для выделения спутников
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Обработка ресайза
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer };
}

/** Генерация звёздного фона (точечные спрайты). */
function _createStars() {
  const geo = new THREE.BufferGeometry();
  const count = 6000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 600;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.4,
    sizeAttenuation: true,
  });
  scene.add(new THREE.Points(geo, mat));
}

/** Обработчик изменения размера окна. */
export function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Основной цикл анимации.
 * @param {function(number): void} callback — вызывается каждый кадр с delta (с)
 */
export function animate(callback) {
  function loop(time) {
    requestAnimationFrame(loop);
    const delta = prevTime ? (time - prevTime) / 1000 : 0;
    prevTime = time;
    callback(delta);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}

export function getScene()    { return scene; }
export function getCamera()   { return camera; }
export function getRenderer() { return renderer; }
export function getRaycaster() { return raycaster; }
export function getMouse()    { return mouse; }
