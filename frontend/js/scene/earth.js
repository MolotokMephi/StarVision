/**
 * @file earth.js
 * @description Рендеринг Земли — дневная/ночная текстура с терминатором,
 * атмосферное свечение, линии широт.
 */

import { TEX, TEXTURE_OFFSET, DEG } from '../core/constants.js';
import { earthRotationAngle } from '../core/orbitalMechanics.js';

let earthMesh = null;
let atmosphereMesh = null;

/* ------------- Day/Night шейдер с терминатором ------------- */

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDir;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(vNormal);
    float cosAngle = dot(n, normalize(sunDir));
    // Плавный терминатор
    float blend = smoothstep(-0.15, 0.15, cosAngle);
    vec4 dayColor   = texture2D(dayMap, vUv);
    vec4 nightColor = texture2D(nightMap, vUv);
    gl_FragColor = mix(nightColor, dayColor, blend);
  }
`;

/**
 * Создать Землю — меш с day/night шейдером, атмосферу и линии широт.
 * @param {THREE.Scene} scene
 * @returns {{ earthMesh: THREE.Mesh, atmosphereMesh: THREE.Mesh }}
 */
export function createEarth(scene) {
  const loader = new THREE.TextureLoader();
  const dayTex   = loader.load(TEX.day);
  const nightTex = loader.load(TEX.night);
  const bumpTex  = loader.load(TEX.bump);

  // Основной меш — ShaderMaterial для терминатора
  const geo = new THREE.SphereGeometry(1, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap:   { value: dayTex },
      nightMap: { value: nightTex },
      sunDir:   { value: new THREE.Vector3(5, 3, 5).normalize() },
    },
    vertexShader,
    fragmentShader,
  });

  earthMesh = new THREE.Mesh(geo, mat);
  earthMesh.rotation.y = TEXTURE_OFFSET;
  scene.add(earthMesh);

  // Рельеф через bump map (дополнительный слой не нужен — встроим при желании)

  // Атмосферное свечение (rim glow)
  const atmosGeo = new THREE.SphereGeometry(1.015, 64, 64);
  const atmosMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
  });
  atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
  scene.add(atmosphereMesh);

  // Линии широт (каждые 30°)
  _createLatitudeLines(scene);

  return { earthMesh, atmosphereMesh };
}

/**
 * Линии широт для визуальной ориентации.
 * @param {THREE.Scene} scene
 */
function _createLatitudeLines(scene) {
  const latitudes = [-60, -30, 0, 30, 60];
  const material = new THREE.LineBasicMaterial({
    color: 0x4488aa,
    transparent: true,
    opacity: 0.3,
  });

  for (const lat of latitudes) {
    const phi = (90 - lat) * DEG;
    const r = 1.002 * Math.sin(phi);
    const y = 1.002 * Math.cos(phi);

    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        r * Math.cos(theta),
        y,
        r * Math.sin(theta)
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    earthMesh.add(new THREE.Line(geo, material));
  }
}

/**
 * Обновить вращение Земли по GMST.
 * @param {number} simTime — Unix timestamp, мс
 */
export function updateEarthRotation(simTime) {
  if (!earthMesh) return;
  const gmst = earthRotationAngle(simTime);
  earthMesh.rotation.y = TEXTURE_OFFSET + gmst;
}

/** @returns {THREE.Mesh|null} */
export function getEarthMesh() {
  return earthMesh;
}
