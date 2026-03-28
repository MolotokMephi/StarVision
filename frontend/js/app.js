// ═══════════════════════════════════════════════════════════════
//  STARVISION — Главный модуль приложения
//  Цифровой двойник группировки кубсатов «Сфера-КС»
// ═══════════════════════════════════════════════════════════════

import { config, simState, displayState, updateConfig } from './core/config.js';
import {
  orbitalPeriod, orbitalVelocity, estimateCoverage,
  earthRotationAngle, coverageAngle
} from './core/orbitalMechanics.js';
import { generateConstellation, getSatState, groundStations } from './core/constellation.js';
import { SCALE, TEXTURE_OFFSET, DEG, RAD, R_EARTH } from './core/constants.js';
import { initScene, getScene, getCamera, getRenderer, getRaycaster, getMouse } from './scene/sceneManager.js';
import { createEarth, getEarthMesh, updateEarthRotation } from './scene/earth.js';
import {
  rebuildSatellites, updateSatellitePositions,
  getSatMeshes, getOrbitLines, getCoverageCones
} from './scene/satellites.js';
import { createGroundStations, toggleGSVisibility } from './scene/groundStations.js';
import { initOrbitControls, updateCamera, resetView as resetCameraView } from './scene/camera.js';
import { updateSatList, showSelectedSatCard, hideSelectedSatCard } from './ui/panels.js';
import { updateTelemetry, updateSelectedSatTelemetry, updateClocks } from './ui/telemetry.js';
import { drawCoverageMap } from './ui/coverageMap.js';
import { PowerChart } from './ui/powerChart.js';
import { initControls, bindSliders, setSpeed } from './ui/controls.js';
import { showTooltip, hideTooltip } from './ui/tooltip.js';
import { AIPanel } from './ai/assistant.js';

// ═══ Состояние приложения ═══
let satellites = [];
let lastFrameTime = performance.now();
let frameCount = 0;
let powerChart;
let aiPanel;

// ═══ ИНИЦИАЛИЗАЦИЯ ═══
function init() {
  const { scene, renderer } = initScene();

  createEarth(scene);
  initOrbitControls(renderer);

  // Генерация группировки
  satellites = generateConstellation(config);
  rebuildSatellites(scene, satellites, config);

  // Наземные станции — дочерние объекты Земли (вращаются корректно)
  const earthMesh = getEarthMesh();
  createGroundStations(earthMesh, groundStations);

  // Энергобюджет
  powerChart = new PowerChart();

  // UI контролы
  initControls({
    onPause: () => {
      simState.paused = !simState.paused;
      const btn = document.getElementById('btnPause');
      btn.innerHTML = simState.paused
        ? '<span class="btn-icon">▶</span> Пуск'
        : '<span class="btn-icon">⏸</span> Пауза';
      btn.classList.toggle('active', simState.paused);
    },
    onSpeedChange: (speed) => {
      simState.simSpeed = speed;
      setSpeed(speed);
    },
    onToggleOrbits: () => {
      displayState.showOrbits = !displayState.showOrbits;
      getOrbitLines().forEach(l => (l.visible = displayState.showOrbits));
      document.getElementById('btnOrbits')?.classList.toggle('active', displayState.showOrbits);
    },
    onToggleCoverage: () => {
      displayState.showCoverage = !displayState.showCoverage;
      getCoverageCones().forEach(c => (c.visible = displayState.showCoverage));
      document.getElementById('btnCoverage')?.classList.toggle('active', displayState.showCoverage);
    },
    onToggleGS: () => {
      displayState.showGS = !displayState.showGS;
      toggleGSVisibility(displayState.showGS);
      document.getElementById('btnGS')?.classList.toggle('active', displayState.showGS);
    },
    onResetView: () => {
      resetCameraView();
      displayState.selectedSatIndex = -1;
      hideSelectedSatCard();
      updateSatList(satellites, -1, selectSat);
    },
    onConfigChange: (key, value) => {
      config[key] = value;
      satellites = generateConstellation(config);
      rebuildSatellites(getScene(), satellites, config);
      // Пересоздаём наземные станции
      const earth = getEarthMesh();
      createGroundStations(earth, groundStations);
      updateTelemetry(config);
      updateSatList(satellites, displayState.selectedSatIndex, selectSat);
    },
  });

  bindSliders(config, (key, value) => {
    config[key] = value;
    satellites = generateConstellation(config);
    rebuildSatellites(getScene(), satellites, config);
    const earth = getEarthMesh();
    createGroundStations(earth, groundStations);
    updateTelemetry(config);
    updateSatList(satellites, displayState.selectedSatIndex, selectSat);
  });

  // Список спутников
  updateSatList(satellites, -1, selectSat);
  updateTelemetry(config);

  // AI ассистент
  aiPanel = new AIPanel('#aiPanel', handleAIAction);
  const aiToggle = document.getElementById('aiToggle');
  if (aiToggle) aiToggle.addEventListener('click', () => aiPanel.toggle());

  // Raycast события
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMouseClick);

  // Начальные состояния кнопок
  document.getElementById('btnOrbits')?.classList.add('active');
  document.getElementById('btnGS')?.classList.add('active');

  // Скрыть загрузочный экран
  setTimeout(() => {
    document.getElementById('loadingOverlay')?.classList.add('hidden');
  }, 6000);

  // Запуск анимации
  lastFrameTime = performance.now();
  animate(lastFrameTime);
}

// ═══ ВЫБОР СПУТНИКА ═══
function selectSat(index) {
  displayState.selectedSatIndex = index;
  if (index >= 0 && index < satellites.length) {
    const sat = satellites[index];
    const state = getSatState(sat, simState.simTime);
    showSelectedSatCard(sat, state);
  } else {
    hideSelectedSatCard();
  }
  updateSatList(satellites, index, selectSat);
}

// ═══ RAYCAST ═══
function onMouseMove(e) {
  const mouse = getMouse();
  const raycaster = getRaycaster();
  const camera = getCamera();
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = getSatMeshes();
  const hits = raycaster.intersectObjects(meshes);

  if (hits.length > 0) {
    const idx = hits[0].object.userData.satIndex;
    if (idx !== undefined && idx < satellites.length) {
      const sat = satellites[idx];
      const state = getSatState(sat, simState.simTime);
      showTooltip(e, sat, state);
      document.body.style.cursor = 'pointer';
      return;
    }
  }
  hideTooltip();
  document.body.style.cursor = 'default';
}

function onMouseClick() {
  const raycaster = getRaycaster();
  raycaster.setFromCamera(getMouse(), getCamera());
  const hits = raycaster.intersectObjects(getSatMeshes());
  if (hits.length > 0 && hits[0].object.userData.satIndex !== undefined) {
    selectSat(hits[0].object.userData.satIndex);
  }
}

// ═══ AI ДЕЙСТВИЯ ═══
function handleAIAction(action, params) {
  if (action === 'getContext') {
    return {
      totalSats: satellites.length,
      planes: config.planes,
      altitude: config.altitude,
      inclination: config.inclination,
      coverage: estimateCoverage(config.planes, config.satsPerPlane, config.altitude, config.inclination).toFixed(1),
    };
  }

  const actions = {
    selectSatellite: () => {
      const idx = satellites.findIndex(s =>
        s.name.toLowerCase().includes(params.name?.toLowerCase())
      );
      if (idx >= 0) selectSat(idx);
    },
    focusSatellite: () => {
      const idx = satellites.findIndex(s =>
        s.name.toLowerCase().includes(params.name?.toLowerCase())
      );
      if (idx >= 0) selectSat(idx);
    },
    setSpeed: () => {
      simState.simSpeed = params.speed;
      setSpeed(params.speed);
    },
    togglePause: () => {
      simState.paused = true;
      document.getElementById('btnPause')?.click();
    },
    resume: () => {
      simState.paused = false;
      document.getElementById('btnPause')?.click();
    },
    toggleOrbits: () => {
      displayState.showOrbits = params.show;
      getOrbitLines().forEach(l => (l.visible = params.show));
      document.getElementById('btnOrbits')?.classList.toggle('active', params.show);
    },
    toggleCoverage: () => {
      displayState.showCoverage = params.show;
      getCoverageCones().forEach(c => (c.visible = params.show));
      document.getElementById('btnCoverage')?.classList.toggle('active', params.show);
    },
    toggleGS: () => {
      displayState.showGS = params.show;
      toggleGSVisibility(params.show);
      document.getElementById('btnGS')?.classList.toggle('active', params.show);
    },
    resetView: () => {
      resetCameraView();
      displayState.selectedSatIndex = -1;
      hideSelectedSatCard();
    },
    setAltitude: () => {
      config.altitude = params.altitude;
      document.getElementById('altitudeSlider').value = params.altitude;
      document.getElementById('altitudeVal').textContent = params.altitude + ' км';
      satellites = generateConstellation(config);
      rebuildSatellites(getScene(), satellites, config);
      updateTelemetry(config);
    },
    setInclination: () => {
      config.inclination = params.inclination;
      document.getElementById('inclinationSlider').value = params.inclination;
      document.getElementById('inclinationVal').textContent = params.inclination + '°';
      satellites = generateConstellation(config);
      rebuildSatellites(getScene(), satellites, config);
      updateTelemetry(config);
    },
    setPlanes: () => {
      config.planes = params.planes;
      document.getElementById('planesSlider').value = params.planes;
      document.getElementById('planesVal').textContent = params.planes;
      satellites = generateConstellation(config);
      rebuildSatellites(getScene(), satellites, config);
      updateTelemetry(config);
    },
  };

  if (actions[action]) actions[action]();
}

// ═══ ГЛАВНЫЙ ЦИКЛ АНИМАЦИИ ═══
function animate(now) {
  requestAnimationFrame(animate);

  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  if (!simState.paused) simState.simTime += dt * simState.simSpeed * 1000;

  // Вращение Земли (GMST)
  updateEarthRotation(simState.simTime);

  // Позиции спутников (ECI — не вращаются с Землёй)
  updateSatellitePositions(satellites, simState.simTime, displayState);

  // Камера
  updateCamera(getCamera());

  // Часы
  updateClocks(simState.simTime);

  // Периодические обновления (каждые N кадров для производительности)
  frameCount++;
  if (frameCount % 15 === 0) {
    updateTelemetry(config);
    if (displayState.selectedSatIndex >= 0 && displayState.selectedSatIndex < satellites.length) {
      const sat = satellites[displayState.selectedSatIndex];
      const state = getSatState(sat, simState.simTime);
      updateSelectedSatTelemetry(sat, state, config);
    }
  }
  if (frameCount % 30 === 0) {
    drawCoverageMap(satellites, simState.simTime, config, groundStations);
    powerChart.update(config, simState.simTime, simState.simSpeed);
    powerChart.draw(document.getElementById('powerChart'));
  }

  getRenderer().render(getScene(), getCamera());
}

// ═══ ЗАПУСК ═══
document.addEventListener('DOMContentLoaded', init);
