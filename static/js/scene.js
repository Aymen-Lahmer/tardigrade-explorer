/**
 * Scène Three.js du tardigrade.
 *
 * Ce module ne touche pas au HTML de l'interface : il expose un petit objet
 * (setPieces, setZoom, setView, setRotate, select, reset) que main.js pilote.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BACKGROUND = 0xf2f3f3;
const GROUND_COLOR = 0xd5d9dc;

/** Une teinte par famille de pièces ; beige pour les sensilla. */
const PART_COLORS = {
  Body: 0x9db5a8,
  'Mouth & stylets': 0xb98d9a,
};
const DEFAULT_PIECE_COLOR = 0xc9b0a5;
const SELECTED_COLOR = 0x59c6b4;

const MODEL_HEIGHT = 3.2;    // hauteur du modèle en unités de scène
const ZOOM_MAX_SCALE = 1.45; // agrandissement du modèle à 100 % de zoom
const PROTEIN_SWITCH = 0.5;  // seuil où la couche protéines remplace le tardigrade
const PROTEIN_COLOR = 0x2fb8a3;

/** Direction de caméra de chaque bouton de vue (¾, face, côté, dos). */
const VIEW_DIRECTIONS = {
  'three-quarter': new THREE.Vector3(0.22, 0.18, 1).normalize(),
  front: new THREE.Vector3(-1, 0.05, 0).normalize(),
  back: new THREE.Vector3(1, 0.05, 0).normalize(),
  side: new THREE.Vector3(0, 0.05, 1).normalize(),
};

export function createTardigradeScene(host) {
  // --- Moteur de rendu ----------------------------------------------------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    throw new Error('Ce navigateur ne peut pas démarrer la vue 3D (WebGL indisponible).');
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setClearColor(BACKGROUND);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive tardigrade. Drag to orbit, scroll to zoom.',
  );
  host.appendChild(renderer.domElement);

  // --- Scène, caméra, contrôles ------------------------------------------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 100);
  camera.position.set(1.9, 1.4, 4.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.minDistance = 0.3;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.96;
  controls.target.set(0, 0.55, 0);

  // --- Lumière et sol -----------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa7acb2, 1.05));

  const keyLight = new THREE.DirectionalLight(0xfffaf4, 2.3);
  keyLight.position.set(-2, 4, 3);
  const rimLight = new THREE.DirectionalLight(0xe9f0ff, 1.8);
  rimLight.position.set(2, 2, -3);
  scene.add(keyLight, rimLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(30, 96),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.019;
  scene.add(ground);

  // Toutes les pièces sont ajoutées à ce groupe, qui porte l'échelle,
  // l'orientation et la position « posée sur le sol » du modèle complet.
  const group = new THREE.Group();
  scene.add(group);

  // Couche « protéines » : un marqueur par emplacement, affiché à partir de
  // 50 % de zoom. Les protéines elles-mêmes restent à modéliser.
  const proteinLayer = new THREE.Group();
  proteinLayer.visible = false;
  group.add(proteinLayer);

  // --- État ---------------------------------------------------------------
  const pieces = []; // { part, mesh, baseColor }
  const fitTarget = new THREE.Vector3();
  let fitRadius = 1;
  let baseScale = 1;
  let zoomTarget = 0;
  let zoomAmount = 0;

  const api = {};

  // --- Cadrage ------------------------------------------------------------
  function fitDistance() {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    return Math.max(
      fitRadius / Math.sin(verticalFov / 2),
      fitRadius / Math.sin(horizontalFov / 2),
    ) * 1.08;
  }

  function resize() {
    const width = host.clientWidth;
    const height = Math.max(host.clientHeight, 1);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 768 ? 1.5 : 2));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (!pieces.length) return;

    // On ne resserre jamais la caméra sous la distance qui cadre le modèle.
    const needed = fitDistance();
    const offset = camera.position.clone().sub(controls.target);
    if (offset.length() < needed) {
      camera.position.copy(controls.target).add(offset.setLength(needed));
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // --- Construction des pièces -------------------------------------------
  function setPieces(atlas, geometries) {
    // 1. Boîte englobante du modèle complet, en coordonnées source.
    const sourceBox = new THREE.Box3();
    for (const part of atlas.parts) {
      sourceBox.expandByPoint(new THREE.Vector3().fromArray(part.bounds[0]));
      sourceBox.expandByPoint(new THREE.Vector3().fromArray(part.bounds[1]));
    }
    const sourceSize = sourceBox.getSize(new THREE.Vector3());

    // 2. Orientation : le GLB est couché sur le flanc, puis roulé sur le ventre.
    const layDown = new THREE.Matrix4().set(
      0, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, -1, 0,
      0, 0, 0, 1,
    );
    const orientation = new THREE.Quaternion()
      .setFromRotationMatrix(layDown)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));

    // 3. Échelle : la hauteur du modèle devient MODEL_HEIGHT.
    const scale = MODEL_HEIGHT / Math.max(sourceSize.y, 0.001);
    baseScale = scale;
    group.quaternion.copy(orientation);
    group.scale.setScalar(scale);

    // 4. Boîte englobante une fois orientée et mise à l'échelle.
    const rotatedBox = new THREE.Box3();
    for (const x of [sourceBox.min.x, sourceBox.max.x]) {
      for (const y of [sourceBox.min.y, sourceBox.max.y]) {
        for (const z of [sourceBox.min.z, sourceBox.max.z]) {
          rotatedBox.expandByPoint(
            new THREE.Vector3(x, y, z).applyQuaternion(orientation).multiplyScalar(scale),
          );
        }
      }
    }

    // 5. Centrage sur la scène et pose sur le disque de sol (y = 0).
    const rotatedCenter = rotatedBox.getCenter(new THREE.Vector3());
    group.position.set(-rotatedCenter.x, 0.002 - rotatedBox.min.y, -rotatedCenter.z);

    const worldBox = rotatedBox.clone().translate(group.position);
    fitTarget.copy(worldBox.getCenter(new THREE.Vector3()));
    fitRadius = worldBox.getSize(new THREE.Vector3()).length() / 2;

    // 6. Un mesh par pièce, laissé à sa place : le tardigrade reste entier.
    const markerGeometry = new THREE.SphereGeometry(sourceSize.length() * 0.008, 16, 12);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: PROTEIN_COLOR,
      transparent: true,
      opacity: 0.9,
    });

    geometries.forEach(({ part, geometry }) => {
      const baseColor = PART_COLORS[part.name] ?? DEFAULT_PIECE_COLOR;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: baseColor,
          metalness: 0.08,
          roughness: 0.53,
          side: THREE.DoubleSide,
        }),
      );
      mesh.frustumCulled = false;

      group.add(mesh);
      pieces.push({ part, mesh, baseColor });

      // Emplacement de la future protéine : le centre de la pièce.
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(geometry.boundingBox.getCenter(new THREE.Vector3()));
      proteinLayer.add(marker);
    });

    camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    camera.updateProjectionMatrix();
    controls.target.copy(fitTarget);
    api.setView('three-quarter');
    resize();
  }

  // --- Sélection ----------------------------------------------------------
  function select(id) {
    for (const piece of pieces) {
      piece.mesh.material.color.set(piece.part.id === id ? SELECTED_COLOR : piece.baseColor);
    }
  }

  // --- Boucle d'animation -------------------------------------------------
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    zoomAmount = THREE.MathUtils.damp(zoomAmount, zoomTarget, 8, delta);

    // Jusqu'à 50 % : le tardigrade entier grossit. À partir de 50 % : il
    // disparaît au profit de la couche protéines.
    const showProteins = zoomTarget >= PROTEIN_SWITCH;
    if (proteinLayer.visible !== showProteins) {
      proteinLayer.visible = showProteins;
      for (const piece of pieces) piece.mesh.visible = !showProteins;
    }

    group.scale.setScalar(baseScale * (1 + (ZOOM_MAX_SCALE - 1) * zoomAmount));

    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  // --- API utilisée par main.js ------------------------------------------
  api.setPieces = setPieces;

  api.setZoom = (amount) => {
    zoomTarget = THREE.MathUtils.clamp(amount, 0, 1);
  };

  api.setView = (name) => {
    const direction = VIEW_DIRECTIONS[name] ?? VIEW_DIRECTIONS['three-quarter'];
    camera.position.copy(controls.target).addScaledVector(direction, fitDistance());
  };

  api.setRotate = (on) => {
    controls.autoRotate = on;
    controls.autoRotateSpeed = 1.2;
  };

  api.select = select;

  api.reset = () => {
    select(null);
    zoomTarget = 0;
    zoomAmount = 0;
    group.scale.setScalar(baseScale);
    proteinLayer.visible = false;
    for (const piece of pieces) piece.mesh.visible = true;
    controls.autoRotate = false;
    api.setView('three-quarter');
  };

  return api;
}
