import * as THREE from './vendor/three.module.min.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const ui = {
  start: $('#startScreen'), over: $('#gameOverScreen'), hud: $('#hud'),
  floors: $('#floors'), score: $('#score'), finalScore: $('#finalScore'), finalFloors: $('#finalFloors'), best: $('#bestLine'),
  resultKicker: $('#resultKicker'), resultLevel: $('#resultLevel'), gameOverTitle: $('#gameOverTitle'),
  resultMessage: $('#resultMessage'), celebration: $('#resultCelebration'),
  feedback: $('#feedback'), play: $('#playButton'), replay: $('#replayButton'), sound: $('#soundButton'), home: $('#homeButton'), restart: $('#restartButton'),
  siteReadout: $('#siteReadout'), windArrow: $('#windArrow'), windValue: $('#windValue'),
  windSpeed: $('#windSpeed'), windState: $('#windState'), gustMeter: $('#gustMeter'),
  prizeProgress: $('#prizeProgress'), prizeReadout: document.querySelector('.prize-readout'), prizeResult: $('#prizeResult'),
  prizeResultTitle: $('#prizeResultTitle'), prizeResultText: $('#prizeResultText'), prizeResultHelp: $('#prizeResultHelp'),
  claimForm: $('#claimForm'), claimName: $('#claimName'), claimCompany: $('#claimCompany'), claimEmail: $('#claimEmail'),
  claimConsent: $('#claimConsent'), claimPrize: $('#claimPrize'), claimScore: $('#claimScore'), claimFloors: $('#claimFloors'),
  claimButton: $('#claimButton'), claimStatus: $('#claimStatus'), claimSuccess: $('#claimSuccess'),
  claimSuccessName: $('#claimSuccessName'), claimReference: $('#claimReference')
};

// Add the production CRM/form endpoint here. The demo fallback completes the UX
// without transmitting or persisting personal data.
const CLAIM_ENDPOINT = '';

const C = {
  paper: 0xf1efe9, glacier: 0x43aec4, pale: 0xc9eaf0, ink: 0x171918,
  concrete: 0xb8b6af, concreteTop: 0xd1cfc8, steel: 0x444a4a, glass: 0x84bcc5,
  white: 0xe9e8e3, soil: 0xd7d3ca, bronze: 0xb2763f, silver: 0xaeb7bd, gold: 0xc7a354
};
const MILESTONES = [
  { floor: 15, type: 'bronze', label: 'BRONZE', color: C.bronze, bonus: 600 },
  { floor: 20, type: 'silver', label: 'SILVER', color: C.silver, bonus: 1000 },
  { floor: 30, type: 'gold', label: 'GOLD', color: C.gold, bonus: 1800 }
];
const AWARD_TYPES = new Set(MILESTONES.map(({ type }) => type));
const UP = new THREE.Vector3(0, 1, 0);
const cableStart = new THREE.Vector3(), cableEnd = new THREE.Vector3(), cableDelta = new THREE.Vector3();
const clock = new THREE.Clock();

let mode = 'start', score = 0, floors = 0, combo = 0, instability = 0;
let towerTop = 0.42, swingTime = 0, swingSpeed = 1.18, falling = null;
let blocks = [], bodies = [], particles = [];
let cameraFocusY = 3.2, cameraTargetY = 3.2, shake = 0, impactFlash = 0;
let soundOn = localStorage.getItem('stack-smarter-sound') !== 'off';
let audioContext = null, craneY = 13, lastLoadX = 0, loadSerial = 0;
const windTurbines = [];
let siteContainer = null;
let highestAward = null;
let wind = {
  baseSpeed: 2.7, currentSpeed: 2.7, fromAngle: Math.PI * 1.75,
  vector: new THREE.Vector3(0.7, 0, 0.7), label: 'NW', calm: false, gustDepth: 0.16, gustPhase: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.paper);
scene.fog = new THREE.FogExp2(C.paper, 0.017);
const camera = new THREE.PerspectiveCamera(37, innerWidth / innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const textureLoader = new THREE.TextureLoader();
const logoTexture = textureLoader.load('images/Symetri-logo-RGB-blue-pos.png');
logoTexture.colorSpace = THREE.SRGBColorSpace;
logoTexture.anisotropy = maxAnisotropy;
const workTexture = textureLoader.load('images/work_smarter_1row_black.png');
workTexture.colorSpace = THREE.SRGBColorSpace;
workTexture.anisotropy = maxAnisotropy;

const materials = createMaterials();
const world = new THREE.Group(), structure = new THREE.Group(), effects = new THREE.Group(), crane = new THREE.Group();
scene.add(world, structure, effects, crane);
setupLighting();
buildSite();
const craneParts = buildCrane();
resetStructure(true);
resize();
updateSoundButton();
renderer.setAnimationLoop(animate);

function createMaterials() {
  const concreteMap = proceduralTexture('concrete');
  const steelMap = proceduralTexture('steel');
  return {
    concrete: new THREE.MeshStandardMaterial({ color: C.concrete, roughness: 0.88, metalness: 0.02, map: concreteMap, bumpMap: concreteMap, bumpScale: 0.022 }),
    concreteTop: new THREE.MeshStandardMaterial({ color: C.concreteTop, roughness: 0.92, map: concreteMap }),
    white: new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.66 }),
    glacier: new THREE.MeshStandardMaterial({ color: C.glacier, roughness: 0.48, metalness: 0.08 }),
    glacierDark: new THREE.MeshStandardMaterial({ color: 0x278da1, roughness: 0.5 }),
    bronze: new THREE.MeshStandardMaterial({ color: C.bronze, roughness: 0.34, metalness: 0.62 }),
    bronzeDark: new THREE.MeshStandardMaterial({ color: 0x704625, roughness: 0.42, metalness: 0.52 }),
    silver: new THREE.MeshStandardMaterial({ color: C.silver, roughness: 0.27, metalness: 0.78 }),
    silverDark: new THREE.MeshStandardMaterial({ color: 0x66747a, roughness: 0.36, metalness: 0.66 }),
    gold: new THREE.MeshStandardMaterial({ color: C.gold, roughness: 0.3, metalness: 0.72 }),
    goldDark: new THREE.MeshStandardMaterial({ color: 0x8d6b25, roughness: 0.38, metalness: 0.62 }),
    steel: new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.38, metalness: 0.72, map: steelMap }),
    steelDark: new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.34, metalness: 0.62 }),
    glass: new THREE.MeshPhysicalMaterial({ color: C.glass, roughness: 0.17, metalness: 0.12, transparent: true, opacity: 0.83, transmission: 0.08 }),
    darkGlass: new THREE.MeshStandardMaterial({ color: 0x314144, roughness: 0.2, metalness: 0.2 }),
    ground: new THREE.MeshStandardMaterial({ color: C.soil, roughness: 0.98 }),
    fence: new THREE.MeshStandardMaterial({ color: 0xcac7bf, roughness: 0.78, metalness: 0.18 }),
    cable3D: new THREE.MeshStandardMaterial({ color: 0x252928, roughness: 0.32, metalness: 0.82 })
  };
}

function proceduralTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const base = kind === 'concrete' ? 186 : 78;
  g.fillStyle = `rgb(${base},${base},${base - (kind === 'concrete' ? 5 : 1)})`;
  g.fillRect(0, 0, 256, 256);
  const dots = kind === 'concrete' ? 4800 : 1200;
  for (let i = 0; i < dots; i++) {
    const a = Math.random() * (kind === 'concrete' ? 0.14 : 0.08);
    const light = Math.random() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${light},${light},${light},${a})`;
    const s = Math.random() * (kind === 'concrete' ? 1.6 : 0.7) + 0.3;
    g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 1.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function setupLighting() {
  scene.add(new THREE.HemisphereLight(0xe9f5f7, 0x918b80, 2.15));
  const sun = new THREE.DirectionalLight(0xfffbf2, 3.35);
  sun.position.set(10, 20, 13);
  sun.castShadow = true;
  const shadowSize = innerWidth < 700 ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 24, bottom: -8, near: 1, far: 55 });
  sun.shadow.bias = -0.00025;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  const fill = new THREE.DirectionalLight(C.glacier, 0.6);
  fill.position.set(-8, 7, -10);
  scene.add(fill);
}

function buildSite() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);
  const grid = new THREE.GridHelper(50, 34, 0xaaa69d, 0xc7c3ba);
  grid.material.transparent = true;
  grid.material.opacity = 0.2;
  grid.position.y = 0.012;
  world.add(grid);
  createFence(0, -5.8, 19, 0);
  createFence(8.8, 1.35, 5.2, Math.PI / 2);
  siteContainer = createContainer(5.85, 0, -4.18);
  createPallet(-3.8, 0, -4.5);
  createWindTurbine(-13.5, -17.5, 1.08);
  createWindTurbine(13.5, -22, 0.72);
  createTreeCluster();
  createCitySilhouette();
  const workSign = imagePlane(workTexture, 1.68, 0.247, false);
  workSign.position.set(-3, 0.82, -5.758);
  world.add(workSign);
}

function createWindTurbine(x, z, scale) {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 8.4, 18), materials.white);
  tower.position.y = 4.2;
  tower.castShadow = true;
  group.add(tower);
  const nacelle = box(0.78, 0.42, 1.15, materials.white);
  nacelle.position.set(0, 8.48, 0.12);
  group.add(nacelle);
  const rotor = new THREE.Group();
  rotor.position.set(0, 8.47, 0.73);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), materials.glacier);
  hub.castShadow = true;
  rotor.add(hub);
  const bladeGeometry = new THREE.BoxGeometry(0.16, 2.55, 0.075);
  bladeGeometry.translate(0, 1.25, 0);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeometry, materials.white);
    blade.rotation.z = i * Math.PI * 2 / 3;
    blade.castShadow = true;
    rotor.add(blade);
  }
  group.add(rotor);
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  world.add(group);
  windTurbines.push({ rotor, offset: Math.random() * Math.PI * 2 });
}

function createTreeCluster() {
  const trees = [
    [-10.2, -12.8, 0.88], [-5.7, -15.1, 1.08], [5.8, -14.4, 0.92],
    [10.1, -15.8, 1.16], [14.3, -18.2, 0.82]
  ];
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x67655e, roughness: 0.96 });
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x809188, roughness: 0.92 });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.15, 1, 10), trunkMaterial, trees.length);
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), foliageMaterial, trees.length * 2);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const foliageColors = [new THREE.Color(0x758980), new THREE.Color(0x8c9a92)];
  trees.forEach(([x, z, size], index) => {
    const trunkHeight = 1.85 * size;
    matrix.compose(position.set(x, trunkHeight / 2, z), rotation, scale.set(size, trunkHeight, size));
    trunks.setMatrixAt(index, matrix);
    matrix.compose(position.set(x, 2.02 * size, z), rotation, scale.set(0.72 * size, 0.92 * size, 0.72 * size));
    crowns.setMatrixAt(index * 2, matrix);
    crowns.setColorAt(index * 2, foliageColors[index % 2]);
    matrix.compose(position.set(x + 0.08 * size, 2.78 * size, z - 0.03 * size), rotation, scale.set(0.54 * size, 0.78 * size, 0.54 * size));
    crowns.setMatrixAt(index * 2 + 1, matrix);
    crowns.setColorAt(index * 2 + 1, foliageColors[(index + 1) % 2]);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  crowns.instanceColor.needsUpdate = true;
  trunks.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = crowns.receiveShadow = true;
  world.add(trunks, crowns);
}

function createFence(x, z, length, rotation) {
  const group = new THREE.Group(), panelCount = Math.ceil(length / 2);
  for (let i = 0; i < panelCount; i++) {
    const panel = box(1.94, 1.4, 0.07, materials.fence);
    panel.position.set((i - (panelCount - 1) / 2) * 2, 0.76, 0);
    group.add(panel);
    const post = box(0.07, 1.65, 0.11, materials.steelDark);
    post.position.set((i - panelCount / 2) * 2, 0.83, 0.02);
    group.add(post);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  world.add(group);
}

function createContainer(x, y, z) {
  const group = new THREE.Group();
  const body = box(4, 1.7, 1.8, materials.glacier);
  body.position.y = 0.85;
  group.add(body);
  for (let i = -4; i <= 4; i++) {
    const rib = box(0.035, 1.48, 0.035, materials.glacierDark);
    rib.position.set(i * 0.43, 0.85, 0.916);
    group.add(rib);
  }
  const logo = imagePlane(logoTexture, 2.15, 0.83, false);
  logo.position.set(0, 0.88, 0.932);
  group.add(logo);
  group.position.set(x, y, z);
  group.rotation.y = -0.08;
  world.add(group);
  return group;
}

function createPallet(x, y, z) {
  const group = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const slab = box(2.3, 0.16, 1.25, materials.concrete);
    slab.position.y = 0.15 + i * 0.2;
    group.add(slab);
  }
  const timber = new THREE.MeshStandardMaterial({ color: 0x9c7d58, roughness: 0.9 });
  [-0.8, 0, 0.8].forEach(px => {
    const board = box(0.12, 0.08, 1.4, timber);
    board.position.set(px, 0.04, 0);
    group.add(board);
  });
  group.position.set(x, y, z);
  world.add(group);
}

function createCitySilhouette() {
  const city = new THREE.Group();
  const matte = new THREE.MeshStandardMaterial({ color: 0xc7c4bc, roughness: 1 });
  for (let i = 0; i < 13; i++) {
    const w = 2.2 + Math.random() * 3.8, h = 2.5 + Math.random() * 6, d = 2 + Math.random() * 2;
    const building = box(w, h, d, matte, false);
    building.position.set(-24 + i * 4.4, h / 2, -20 - Math.random() * 5);
    city.add(building);
  }
  world.add(city);
}

function buildCrane() {
  const mast = new THREE.Group();
  mast.position.x = -7.2;
  const mastHeight = 48, legGeo = new THREE.BoxGeometry(0.12, mastHeight, 0.12);
  for (const x of [-0.48, 0.48]) for (const z of [-0.48, 0.48]) {
    const leg = new THREE.Mesh(legGeo, materials.steelDark);
    leg.position.set(x, mastHeight / 2, z);
    leg.castShadow = true;
    mast.add(leg);
  }
  for (let y = 0.5; y < mastHeight; y += 1.25) for (const z of [-0.5, 0.5]) {
    mast.add(brace(new THREE.Vector3(-0.5, y, z), new THREE.Vector3(0.5, y + 1.15, z), 0.055, materials.glacierDark));
    mast.add(brace(new THREE.Vector3(0.5, y, z), new THREE.Vector3(-0.5, y + 1.15, z), 0.055, materials.glacierDark));
  }
  crane.add(mast);

  const head = new THREE.Group();
  head.position.y = craneY;
  const jibStart = -7.2, jibEnd = 7.4;
  for (const z of [-0.34, 0.34]) {
    const chord = box(jibEnd - jibStart, 0.1, 0.1, materials.steelDark);
    chord.position.set((jibEnd + jibStart) / 2, 0, z);
    head.add(chord);
  }
  for (let x = jibStart; x < jibEnd; x += 1.1) {
    head.add(brace(new THREE.Vector3(x, 0, 0.34), new THREE.Vector3(x + 1.05, 0.72, 0.34), 0.04, materials.steelDark));
    head.add(brace(new THREE.Vector3(x + 1.05, 0.72, -0.34), new THREE.Vector3(x, 0, -0.34), 0.04, materials.steelDark));
  }
  const upper = box(jibEnd - jibStart - 0.8, 0.08, 0.08, materials.steelDark);
  upper.position.set((jibEnd + jibStart) / 2, 0.72, 0);
  head.add(upper);
  const slewRing = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.22, 24), materials.steelDark);
  slewRing.position.set(-7.2, -0.18, 0);
  head.add(slewRing);
  const turntable = box(1.7, 0.22, 1.22, materials.glacierDark);
  turntable.position.set(-7.2, 0.02, 0);
  head.add(turntable);
  const apex = box(0.16, 2.05, 0.16, materials.steelDark);
  apex.position.set(-7.2, 1.4, 0);
  head.add(apex);
  head.add(brace(new THREE.Vector3(-7.2, 2.4, 0), new THREE.Vector3(4.9, 0.7, 0), 0.035, materials.steelDark));
  head.add(brace(new THREE.Vector3(-7.2, 2.4, 0), new THREE.Vector3(-9.35, 0.2, 0), 0.045, materials.steelDark));
  const cabin = box(1.2, 0.82, 1.05, materials.glacier);
  cabin.position.set(-6.3, -0.47, 0);
  head.add(cabin);
  const cabinGlass = box(0.76, 0.43, 0.015, materials.darkGlass);
  cabinGlass.position.set(-6.05, -0.4, 0.535);
  head.add(cabinGlass);
  const logo = imagePlane(logoTexture, 0.92, 0.355, false);
  logo.position.set(-6.55, -0.49, 0.54);
  head.add(logo);
  const counter = box(2.4, 0.42, 0.8, materials.concrete);
  counter.position.set(-8.25, -0.15, 0);
  head.add(counter);
  crane.add(head);
  const trolley = new THREE.Group();
  const trolleyFrame = box(0.94, 0.2, 0.9, materials.glacierDark);
  trolleyFrame.position.y = -0.08;
  trolley.add(trolleyFrame);
  const hoistMotor = box(0.48, 0.34, 0.5, materials.steelDark);
  hoistMotor.position.y = -0.3;
  trolley.add(hoistMotor);
  const motorCap = box(0.5, 0.055, 0.52, materials.glacier);
  motorCap.position.y = -0.495;
  trolley.add(motorCap);
  for (const x of [-0.32, 0.32]) for (const z of [-0.39, 0.39]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), materials.steelDark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.02, z);
    trolley.add(wheel);
  }
  trolley.position.y = -0.22;
  head.add(trolley);

  const hook = new THREE.Group();
  const hookBlock = bevelBox(0.5, 0.38, 0.34, 0.045, materials.steelDark);
  hook.add(hookBlock);
  for (const z of [-0.2, 0.2]) {
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.055, 18), materials.glacierDark);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(0, 0.02, z);
    hook.add(pulley);
  }
  const spreader = box(0.92, 0.08, 0.18, materials.steelDark);
  spreader.position.y = -0.25;
  hook.add(spreader);
  const hookMesh = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.065, 10, 22, Math.PI * 1.55), materials.steelDark);
  hookMesh.rotation.z = 0.16;
  hookMesh.position.y = -0.48;
  hook.add(hookMesh);
  crane.add(hook);

  const cables = new THREE.Group();
  const cableGeometry = new THREE.CylinderGeometry(0.018, 0.018, 1, 8);
  for (let i = 0; i < 6; i++) {
    const cable = new THREE.Mesh(cableGeometry, materials.cable3D);
    cable.castShadow = true;
    cables.add(cable);
  }
  crane.add(cables);
  return { head, trolley, hook, cables };
}

function resetStructure(preview = false) {
  structure.clear();
  effects.clear();
  blocks = [];
  bodies = [];
  particles = [];
  falling = null;
  const foundation = createFoundation();
  foundation.position.set(0, 0.21, 0);
  structure.add(foundation);
  blocks.push({ object: foundation, x: 0, z: 0, w: 5.8, d: 3.45, h: 0.42, centerY: 0.21, type: 'foundation' });
  towerTop = 0.42;
  cameraFocusY = preview ? 3.2 : 3.5;
  cameraTargetY = cameraFocusY;
  craneY = 13;
  craneParts.head.position.y = craneY;
  spawnLoad(preview);
}

function createFoundation() {
  const group = new THREE.Group();
  const footing = box(6.8, 0.22, 4.25, materials.concrete);
  footing.position.y = -0.1;
  group.add(footing);
  group.add(box(5.8, 0.42, 3.45, materials.steelDark));
  for (let x = -2.5; x <= 2.5; x += 1) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), materials.glacier);
    bolt.position.set(x, 0.25, 1.45);
    group.add(bolt);
  }
  return group;
}

function spawnLoad(preview = false) {
  const type = chooseType(), dims = dimensionsFor(type), object = createElement(type, dims);
  loadSerial++;
  craneY = Math.max(13, towerTop + 10.6);
  craneParts.head.position.y = craneY;
  const cable = Math.max(4.8, craneY - towerTop - 5.2);
  falling = {
    object, type, ...dims, state: 'swing', x: 0, z: 0, y: craneY - cable - dims.h / 2,
    vx: 0, vy: 0, vz: 0, avx: 0, avy: 0, avz: 0, cable, phase: loadSerial * 0.73, preview
  };
  structure.add(object);
  updateLoadTransform();
  updatePrizeUI();
  if (!preview && mode === 'playing') playCraneCue();
}

function chooseType() {
  const milestone = MILESTONES.find(({ floor }) => floor === floors + 1);
  if (milestone) return milestone.type;
  if ((floors + 1) % 8 === 0) return 'smart';
  return ['slab', 'module', 'beam', 'facade'][floors % 4];
}

function dimensionsFor(type) {
  const jitter = 0.95 + Math.random() * 0.08;
  if (type === 'module') return { w: 4.85 * jitter, h: 1.22, d: 2.82 };
  if (type === 'beam') return { w: 5.3 * jitter, h: 0.62, d: 2.15 };
  if (type === 'facade') return { w: 4.95 * jitter, h: 1.05, d: 2.72 };
  if (type === 'smart') return { w: 5.05, h: 1.05, d: 2.9 };
  if (AWARD_TYPES.has(type)) return { w: 5.15, h: 1.18, d: 2.92 };
  return { w: 5.18 * jitter, h: 0.52, d: 3.02 };
}

function setWind(preview = false) {
  const directions = [
    ['N', 0], ['NE', Math.PI * 0.25], ['E', Math.PI * 0.5], ['SE', Math.PI * 0.75],
    ['S', Math.PI], ['SW', Math.PI * 1.25], ['W', Math.PI * 1.5], ['NW', Math.PI * 1.75]
  ];
  const selected = preview ? directions[7] : directions[Math.floor(Math.random() * directions.length)];
  const calm = !preview && Math.random() < 0.08;
  const baseSpeed = preview ? 2.7 : calm ? 0.7 + Math.random() * 0.45 : 2.1 + Math.random() * 1.1;
  const fromAngle = selected[1];
  wind = {
    label: selected[0], fromAngle, baseSpeed, currentSpeed: baseSpeed, calm,
    gustDepth: calm ? 0.07 : 0.13 + Math.random() * 0.12,
    gustPhase: Math.random() * Math.PI * 2,
    vector: new THREE.Vector3(Math.sin(fromAngle + Math.PI), 0, Math.cos(fromAngle + Math.PI)).normalize()
  };
  updateWeatherUI();
}

function heightWindMultiplier() {
  if (mode === 'start') return 1;
  return 1 + Math.min(floors, 40) * 0.014;
}

function updateWeatherUI() {
  const degrees = Math.round(THREE.MathUtils.radToDeg(wind.fromAngle)) % 360;
  const heightMultiplier = heightWindMultiplier();
  const exposedSpeed = wind.baseSpeed * heightMultiplier;
  const exposure = Math.round((heightMultiplier - 1) * 100);
  const flag = exposedSpeed < 3.2 ? 'green' : exposedSpeed < 4 ? 'yellow' : exposedSpeed < 4.7 ? 'orange' : 'red';
  ui.siteReadout.classList.remove('wind-green', 'wind-yellow', 'wind-orange', 'wind-red');
  ui.siteReadout.classList.add(`wind-${flag}`);
  ui.windValue.textContent = `FROM ${wind.label} · ${degrees}°`;
  ui.windSpeed.textContent = exposedSpeed.toFixed(1);
  ui.windState.textContent = exposure > 0 ? `${flag.toUpperCase()} FLAG · +${exposure}% AT HEIGHT` : `${flag.toUpperCase()} FLAG · DRY 16°C`;
  ui.windArrow.style.transform = `rotate(${wind.fromAngle + Math.PI}rad)`;
  const activeBars = Math.max(1, Math.ceil(exposedSpeed / 1.7));
  [...ui.gustMeter.children].forEach((bar, index) => bar.classList.toggle('active', index < activeBars));
}

function createElement(type, dims) {
  const group = new THREE.Group();
  if (type === 'slab') {
    group.add(bevelBox(dims.w, dims.h, dims.d, 0.08, materials.concrete));
    const edge = box(dims.w * 0.96, 0.045, dims.d * 1.01, materials.concreteTop);
    edge.position.y = dims.h / 2 - 0.035;
    group.add(edge);
    addLiftPoints(group, dims);
  } else if (type === 'module') {
    const floorPlate = box(dims.w, 0.17, dims.d, materials.concrete);
    floorPlate.position.y = -dims.h / 2 + 0.085;
    group.add(floorPlate);
    const roof = box(dims.w, 0.15, dims.d, materials.concreteTop);
    roof.position.y = dims.h / 2 - 0.075;
    group.add(roof);
    [-dims.w / 2 + 0.11, dims.w / 2 - 0.11].forEach(x => [-dims.d / 2 + 0.11, dims.d / 2 - 0.11].forEach(z => {
      const column = box(0.18, dims.h - 0.18, 0.18, materials.steelDark);
      column.position.set(x, 0, z);
      group.add(column);
    }));
    for (let i = -1; i <= 1; i++) {
      const glass = box(dims.w / 3 - 0.12, dims.h * 0.58, 0.055, materials.glass);
      glass.position.set(i * dims.w / 3, 0.05, dims.d / 2 - 0.03);
      group.add(glass);
    }
  } else if (type === 'beam') {
    for (const z of [-dims.d / 2 + 0.13, dims.d / 2 - 0.13]) {
      const beamGroup = new THREE.Group();
      beamGroup.add(box(dims.w, 0.11, 0.36, materials.steel));
      const top = box(dims.w, 0.11, 0.36, materials.steel);
      top.position.y = dims.h - 0.11;
      beamGroup.add(top);
      const web = box(dims.w, dims.h - 0.15, 0.09, materials.steelDark);
      web.position.y = dims.h / 2 - 0.06;
      beamGroup.add(web);
      beamGroup.position.set(0, -dims.h / 2 + 0.06, z);
      group.add(beamGroup);
    }
    for (let x = -dims.w / 2 + 0.18; x <= dims.w / 2 - 0.18; x += dims.w / 5) {
      const cross = box(0.09, 0.16, dims.d, materials.glacierDark);
      cross.position.set(x, 0.04, 0);
      group.add(cross);
    }
  } else if (type === 'facade') {
    group.add(box(dims.w, dims.h, dims.d, materials.white));
    for (const z of [-dims.d / 2 - 0.012, dims.d / 2 + 0.012]) {
      for (let i = -2; i <= 2; i++) {
        const panel = box(dims.w / 5 - 0.075, dims.h * 0.72, 0.045, materials.glass);
        panel.position.set(i * dims.w / 5, 0.01, z);
        group.add(panel);
      }
      for (let i = -2; i <= 3; i++) {
        const mullion = box(0.045, dims.h * 0.86, 0.075, materials.steelDark);
        mullion.position.set((i - 0.5) * dims.w / 5, 0.01, z + Math.sign(z) * 0.025);
        group.add(mullion);
      }
    }
  } else if (AWARD_TYPES.has(type)) {
    const milestone = MILESTONES.find(({ type: awardType }) => awardType === type);
    const awardMaterial = materials[type];
    const awardDarkMaterial = materials[`${type}Dark`];
    group.add(bevelBox(dims.w, dims.h, dims.d, 0.055, awardMaterial));
    for (let x = -dims.w / 2 + 0.14; x <= dims.w / 2 - 0.14; x += dims.w / 10) {
      const rib = box(0.035, dims.h * 0.82, dims.d + 0.04, awardDarkMaterial);
      rib.position.set(x, 0, 0);
      group.add(rib);
    }
    const darkBand = box(dims.w * 0.92, dims.h * 0.45, dims.d + 0.065, awardDarkMaterial);
    darkBand.position.y = -0.02;
    group.add(darkBand);
    const logo = imagePlane(logoTexture, 1.68, 0.648, false);
    logo.position.set(-dims.w * 0.2, 0, dims.d / 2 + 0.055);
    group.add(logo);
    const prizeText = textPlane(`${milestone.label} LIFT · LEVEL ${milestone.floor}`, 2.05, 0.38, '#ffffff');
    prizeText.position.set(dims.w * 0.22, 0, dims.d / 2 + 0.06);
    group.add(prizeText);
  } else {
    group.add(bevelBox(dims.w, dims.h, dims.d, 0.07, materials.glacier));
    const inset = box(dims.w * 0.83, dims.h * 0.5, dims.d + 0.035, materials.glacierDark);
    inset.position.y = -0.02;
    group.add(inset);
    const logo = imagePlane(logoTexture, 1.62, 0.624, false);
    logo.position.set(-dims.w * 0.2, 0, dims.d / 2 + 0.04);
    group.add(logo);
    const message = textPlane('STACK SMARTER', 1.75, 0.36, '#ffffff');
    message.position.set(dims.w * 0.25, 0, dims.d / 2 + 0.045);
    group.add(message);
  }
  group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  group.userData.type = type;
  return group;
}

function addLiftPoints(group, dims) {
  for (const x of [-dims.w * 0.32, dims.w * 0.32]) for (const z of [-dims.d * 0.3, dims.d * 0.3]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 12), materials.steelDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, dims.h / 2 + 0.035, z);
    group.add(ring);
  }
}

function releaseLoad() {
  if (mode !== 'playing' || !falling || falling.state !== 'swing') return;
  falling.state = 'drop';
  falling.vx = (falling.x - lastLoadX) * 1.4;
  falling.vy = -0.18;
  falling.vz = Math.cos(swingTime * 1.7 + falling.phase) * 0.28;
  falling.avx = Math.cos(swingTime * 1.42) * 0.15;
  falling.avy = Math.sin(swingTime) * 0.1;
  falling.avz = Math.cos(swingTime * 1.18 + falling.phase) * 0.24;
  playRelease();
}

function landLoad() {
  const support = blocks[blocks.length - 1], f = falling;
  const overlapX = Math.max(0, Math.min(f.x + f.w / 2, support.x + support.w / 2) - Math.max(f.x - f.w / 2, support.x - support.w / 2));
  const overlapZ = Math.max(0, Math.min(f.z + f.d / 2, support.z + support.d / 2) - Math.max(f.z - f.d / 2, support.z - support.d / 2));
  const ratioX = overlapX / Math.min(f.w, support.w), ratioZ = overlapZ / Math.min(f.d, support.d);
  const supportRatio = ratioX * ratioZ;
  if (supportRatio < 0.28) { beginCollapse(f); return; }
  const dx = f.x - support.x, dz = f.z - support.z;
  const normalizedOffset = Math.sqrt((dx / (support.w * 0.5)) ** 2 + (dz / (support.d * 0.5)) ** 2);
  const tilt = Math.min(0.18, (Math.abs(f.object.rotation.x) + Math.abs(f.object.rotation.z)) * 0.25);
  const accuracy = THREE.MathUtils.clamp(1 - normalizedOffset - tilt, 0, 1);
  const perfect = accuracy > 0.89 && supportRatio > 0.86;
  const nearPerfect = !perfect && accuracy > 0.74 && supportRatio > 0.66;
  f.state = 'placed';
  f.y = towerTop + f.h / 2;
  f.object.position.set(f.x, f.y, f.z);
  const landingLeanZ = THREE.MathUtils.clamp(-(f.x - support.x) / (support.w * 0.5) * 0.13, -0.12, 0.12);
  const landingLeanX = THREE.MathUtils.clamp((f.z - support.z) / (support.d * 0.5) * 0.1, -0.09, 0.09);
  f.object.rotation.x = THREE.MathUtils.lerp(f.object.rotation.x * 0.22, landingLeanX, 0.72);
  f.object.rotation.z = THREE.MathUtils.lerp(f.object.rotation.z * 0.22, landingLeanZ, 0.72);
  f.object.userData.impact = {
    elapsed: 0, baseY: f.y, baseX: f.x, baseZ: f.z, baseRotZ: f.object.rotation.z,
    strength: 0.11 + Math.min(0.11, Math.abs(f.vy) * 0.018), near: nearPerfect || perfect
  };
  blocks.push({ object: f.object, x: f.x, z: f.z, w: f.w, d: f.d, h: f.h, centerY: f.y, type: f.type });
  towerTop += f.h;
  floors++;
  if (perfect) {
    combo++;
    score += 120 + floors * 5 + Math.min(combo, 6) * 25;
    instability = Math.max(0, instability - 0.12);
    showFeedback(combo > 1 ? `PERFECT STREAK · ${combo}` : 'PERFECT DROP', true);
    spawnParticles(f.x, towerTop + 0.05, f.z, C.glacier, 20, 1.35);
    spawnImpactRing(f.x, towerTop + 0.04, f.z, C.glacier, 1.25);
    playChord(590 + combo * 22);
  } else if (nearPerfect) {
    combo = 0;
    score += Math.round(102 + accuracy * 48 + floors * 3);
    instability = Math.max(0, instability - 0.035 + (1 - supportRatio) * 0.045);
    showFeedback(`ALMOST PERFECT · ${Math.round(accuracy * 100)}%`, 'near');
    spawnParticles(f.x, towerTop + 0.03, f.z, C.glacier, 17, 1.05);
    spawnImpactRing(f.x, towerTop + 0.04, f.z, C.glacier, 1);
    playNearPerfect(accuracy);
  } else {
    combo = 0;
    score += Math.round(38 + accuracy * 68 + floors * 3);
    const overhangRisk = Math.pow(1 - supportRatio, 1.18) * 0.52;
    instability += overhangRisk + normalizedOffset * 0.16 + tilt * 0.66;
    showFeedback(accuracy > 0.68 ? 'SOLID PLACEMENT' : elementLabel(f.type), false);
    spawnParticles(f.x, towerTop, f.z, 0xb3aea4, 13, 0.72);
    playImpact(accuracy);
  }
  const milestone = MILESTONES.find(({ type }) => type === f.type);
  if (milestone) {
    highestAward = milestone.type;
    const storageKey = `stack-smarter-${milestone.type}-wins`;
    const wins = Number(localStorage.getItem(storageKey) || 0) + 1;
    localStorage.setItem(storageKey, String(wins));
    score += milestone.bonus;
    showFeedback(`${milestone.label} UNLOCKED`, milestone.type);
    spawnParticles(f.x, towerTop + 0.2, f.z, milestone.color, 42, 2.3);
    spawnImpactRing(f.x, towerTop + 0.04, f.z, milestone.color, 1.8);
    playPrize();
  }
  shake = nearPerfect || perfect ? 0.15 : 0.065 + (1 - accuracy) * 0.12;
  impactFlash = 1;
  swingSpeed = Math.min(2.4, 1.18 + floors * 0.052);
  cameraTargetY = Math.max(3.4, towerTop + 2.6);
  updateUI();
  falling = null;
  if (instability > 1.12 && floors > 4) setTimeout(() => mode === 'playing' && beginCollapse(), 260);
  else setTimeout(() => mode === 'playing' && spawnLoad(), 230);
}

function beginCollapse(extraLoad = null) {
  if (mode !== 'playing') return;
  mode = 'collapse';
  combo = 0;
  updateUI();
  showFeedback('COLLAPSE', false);
  shake = 0.72;
  playCollapse();
  let lean = 0;
  for (let i = 1; i < blocks.length; i++) lean += blocks[i].x - blocks[i - 1].x;
  const direction = Math.sign(lean || (Math.random() - 0.5)) || 1;
  const pivot = Math.max(1, Math.floor(blocks.length * (0.18 + Math.random() * 0.22)));
  const doomed = blocks.splice(pivot);
  if (extraLoad) doomed.push({ object: extraLoad.object, x: extraLoad.x, z: extraLoad.z, w: extraLoad.w, d: extraLoad.d, h: extraLoad.h, centerY: extraLoad.y });
  falling = null;
  doomed.forEach((block, index) => {
    bodies.push({
      object: block.object,
      velocity: new THREE.Vector3(direction * (0.7 + index * 0.13) + (Math.random() - 0.5) * 0.7, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6),
      angular: new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.6, -direction * (0.8 + Math.random() * 1.4)),
      radius: Math.max(block.h * 0.5, 0.24), settled: false
    });
  });
  for (let i = 0; i < 28; i++) spawnParticles(0, towerTop * (0.35 + Math.random() * 0.55), 0, 0x8c8982, 2, 2.2);
  setTimeout(showGameOver, 1700);
}

function updatePhysics(dt) {
  bodies.forEach(body => {
    if (body.settled) return;
    body.velocity.y -= 9.8 * dt;
    body.object.position.addScaledVector(body.velocity, dt);
    body.object.rotation.x += body.angular.x * dt;
    body.object.rotation.y += body.angular.y * dt;
    body.object.rotation.z += body.angular.z * dt;
    body.angular.multiplyScalar(Math.pow(0.975, dt * 60));
    if (body.object.position.y - body.radius < 0.05) {
      body.object.position.y = body.radius + 0.05;
      if (Math.abs(body.velocity.y) > 0.65) {
        body.velocity.y *= -0.23;
        body.velocity.x *= 0.72;
        body.velocity.z *= 0.72;
        shake = Math.max(shake, 0.08);
      } else {
        body.velocity.set(0, 0, 0);
        body.angular.multiplyScalar(0.5);
        body.settled = true;
      }
    }
  });
}

function updateLoad(dt) {
  if (!falling) { updateCables(null); return; }
  const f = falling;
  if (f.state === 'swing') {
    const range = Math.min(3.75, 2.9 + floors * 0.035);
    lastLoadX = f.x;
    const trolleyX = Math.sin(swingTime * swingSpeed + f.phase) * range;
    const pendulum = Math.sin(swingTime * swingSpeed * 1.34 + f.phase + 0.52);
    const gustWave = Math.sin(swingTime * (1.05 + wind.currentSpeed * 0.04) + wind.gustPhase + f.phase * 0.35);
    const windPush = wind.currentSpeed * (0.025 + gustWave * 0.055);
    const pendulumAmplitude = 0.28 + floors * 0.006 + wind.currentSpeed * 0.035;
    f.x = trolleyX - pendulum * pendulumAmplitude + wind.vector.x * windPush;
    f.z = Math.sin(swingTime * 1.63 + f.phase) * (0.18 + Math.min(0.22, floors * 0.009) + wind.currentSpeed * 0.018) + wind.vector.z * windPush;
    f.y = craneY - f.cable - f.h / 2 + Math.abs(pendulum) * 0.045;
    f.object.rotation.z = -pendulum * (0.075 + Math.min(0.07, floors * 0.003) + wind.currentSpeed * 0.008) + wind.vector.x * gustWave * wind.currentSpeed * 0.008;
    f.object.rotation.x = Math.cos(swingTime * 1.58 + f.phase) * (0.03 + wind.currentSpeed * 0.006) + wind.vector.z * gustWave * wind.currentSpeed * 0.006;
    f.object.rotation.y = Math.sin(swingTime * 0.83) * 0.035;
    craneParts.trolley.position.x = trolleyX;
  } else if (f.state === 'drop') {
    f.vy -= 9.8 * dt;
    f.vx += wind.vector.x * wind.currentSpeed * 0.115 * dt;
    f.vz += wind.vector.z * wind.currentSpeed * 0.115 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.z += f.vz * dt;
    f.vx *= Math.pow(0.985, dt * 60);
    f.vz *= Math.pow(0.988, dt * 60);
    f.object.rotation.x += f.avx * dt;
    f.object.rotation.y += f.avy * dt;
    f.object.rotation.z += f.avz * dt;
    if (f.y - f.h / 2 <= towerTop) landLoad();
  }
  if (falling) { updateLoadTransform(); updateCables(falling); }
}

function updateLoadTransform() { if (falling) falling.object.position.set(falling.x, falling.y, falling.z); }

function setCableSegment(mesh, ax, ay, az, bx, by, bz) {
  cableStart.set(ax, ay, az);
  cableEnd.set(bx, by, bz);
  cableDelta.subVectors(cableEnd, cableStart);
  mesh.position.copy(cableStart).add(cableEnd).multiplyScalar(0.5);
  mesh.scale.set(1, cableDelta.length(), 1);
  mesh.quaternion.setFromUnitVectors(UP, cableDelta.normalize());
}

function updateCables(load) {
  craneParts.hook.visible = Boolean(load);
  craneParts.cables.visible = Boolean(load);
  if (!load) return;
  const trolleyX = craneParts.trolley.position.x;
  const anchorY = craneY - 0.47;
  if (load.state === 'swing') {
    const hookY = load.y + load.h / 2 + 0.72;
    craneParts.hook.position.set(load.x, hookY, load.z);
  }
  const { x: hookX, y: hookY, z: hookZ } = craneParts.hook.position;
  const wires = craneParts.cables.children;
  setCableSegment(wires[0], trolleyX - 0.14, anchorY, -0.16, hookX - 0.11, hookY + 0.17, hookZ - 0.1);
  setCableSegment(wires[1], trolleyX + 0.14, anchorY, 0.16, hookX + 0.11, hookY + 0.17, hookZ + 0.1);
  const rigged = load.state === 'swing';
  for (let i = 2; i < wires.length; i++) wires[i].visible = rigged;
  if (!rigged) return;
  const loadTop = load.y + load.h / 2 + 0.07;
  const spreadX = Math.min(1.45, load.w * 0.31);
  const spreadZ = Math.min(0.72, load.d * 0.27);
  setCableSegment(wires[2], hookX - 0.42, hookY - 0.22, hookZ - 0.07, load.x - spreadX, loadTop, load.z - spreadZ);
  setCableSegment(wires[3], hookX + 0.42, hookY - 0.22, hookZ - 0.07, load.x + spreadX, loadTop, load.z - spreadZ);
  setCableSegment(wires[4], hookX - 0.42, hookY - 0.22, hookZ + 0.07, load.x - spreadX, loadTop, load.z + spreadZ);
  setCableSegment(wires[5], hookX + 0.42, hookY - 0.22, hookZ + 0.07, load.x + spreadX, loadTop, load.z + spreadZ);
}

function updateImpacts(dt) {
  blocks.forEach(block => {
    const impact = block.object.userData.impact;
    if (!impact) return;
    impact.elapsed += dt;
    const damping = Math.exp(-impact.elapsed * (impact.near ? 6.6 : 8.5));
    block.object.position.y = impact.baseY + Math.sin(impact.elapsed * 24) * damping * impact.strength;
    if (impact.near) {
      block.object.position.x = impact.baseX + Math.sin(impact.elapsed * 18) * damping * 0.075;
      block.object.position.z = impact.baseZ + Math.cos(impact.elapsed * 16) * damping * 0.035;
      block.object.rotation.z = impact.baseRotZ + Math.sin(impact.elapsed * 21) * damping * 0.026;
    }
    if (impact.elapsed > 0.9) {
      block.object.position.set(impact.baseX, impact.baseY, impact.baseZ);
      block.object.rotation.z = impact.baseRotZ;
      delete block.object.userData.impact;
    }
  });
}

function updateParticles(dt) {
  particles.forEach(p => {
    p.life -= dt;
    if (p.ring) {
      const progress = 1 - Math.max(0, p.life) / p.duration;
      p.mesh.scale.setScalar(0.65 + progress * p.growth);
      p.mesh.material.opacity = Math.max(0, p.life / p.duration) * 0.58;
      return;
    }
    p.velocity.y -= 3.4 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.x += p.spin.x * dt;
    p.mesh.rotation.y += p.spin.y * dt;
    p.mesh.scale.setScalar(Math.max(0.01, p.life / p.duration));
    p.mesh.material.opacity = Math.max(0, p.life / p.duration);
  });
  particles = particles.filter(p => {
    if (p.life > 0) return true;
    effects.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
    return false;
  });
}

function spawnParticles(x, y, z, color, count, force) {
  for (let i = 0; i < count; i++) {
    const size = 0.025 + Math.random() * 0.075;
    const geometry = Math.random() > 0.35 ? new THREE.BoxGeometry(size, size, size) : new THREE.SphereGeometry(size, 5, 4);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + (Math.random() - 0.5) * 2.2, y, z + (Math.random() - 0.5) * 1.5);
    effects.add(mesh);
    const duration = 0.55 + Math.random() * 0.5;
    particles.push({ mesh, life: duration, duration, velocity: new THREE.Vector3((Math.random() - 0.5) * force, Math.random() * force * 0.9, (Math.random() - 0.5) * force), spin: new THREE.Vector3(Math.random() * 4, Math.random() * 4, 0) });
  }
}

function spawnImpactRing(x, y, z, color, growth) {
  const geometry = new THREE.RingGeometry(0.65, 0.71, 48);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  effects.add(mesh);
  particles.push({ mesh, ring: true, growth, life: 0.58, duration: 0.58 });
}

function updateCamera(dt) {
  const mobile = innerWidth < 700;
  if (mode === 'playing') {
    const workZone = towerTop + (falling?.state === 'swing' ? 3.15 : 2.75);
    cameraTargetY = Math.max(3.4, workZone);
  }
  cameraFocusY = THREE.MathUtils.damp(cameraFocusY, cameraTargetY, mobile ? 5.2 : 3.4, dt);
  const pullback = THREE.MathUtils.clamp((towerTop - 4) * 0.68, 0, 14);
  const framingPullback = mobile ? pullback * 1.08 : pullback;
  const desired = new THREE.Vector3(
    (mobile ? 10.8 : 11.8) + framingPullback * 0.46,
    cameraFocusY + (mobile ? 7.2 : 6.4) + framingPullback * 0.16,
    (mobile ? 17.4 : 15.4) + framingPullback
  );
  camera.position.lerp(desired, 1 - Math.exp(-dt * 3.2));
  if (shake > 0.002) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake * 0.55;
    camera.position.z += (Math.random() - 0.5) * shake;
  }
  camera.lookAt(0, cameraFocusY, 0);
  shake *= Math.exp(-dt * 6.8);
}

function startGame() {
  initAudio();
  playTone(250, 0.07, 'sine', 0.035);
  mode = 'playing';
  score = floors = combo = 0;
  instability = 0;
  highestAward = null;
  swingTime = 0;
  swingSpeed = 1.18;
  loadSerial = 0;
  ui.start.hidden = true;
  ui.over.hidden = true;
  ui.over.classList.remove('celebrate');
  ui.celebration.replaceChildren();
  ui.prizeResult.hidden = true;
  ui.prizeResult.classList.remove('bronze', 'silver', 'gold');
  resetClaimFlow();
  ui.siteReadout.hidden = false;
  ui.home.hidden = false;
  ui.restart.hidden = false;
  setWind(false);
  ui.hud.classList.add('visible');
  resetStructure();
  updateUI();
}

function returnHome() {
  mode = 'start';
  ui.start.hidden = false;
  ui.over.hidden = true;
  ui.over.classList.remove('celebrate');
  ui.celebration.replaceChildren();
  ui.hud.classList.remove('visible');
  ui.siteReadout.hidden = true;
  ui.home.hidden = true;
  ui.restart.hidden = true;
  setWind(true);
  swingSpeed = 0.75;
  resetStructure(true);
}

function showGameOver() {
  if (mode !== 'collapse') return;
  mode = 'over';
  ui.hud.classList.remove('visible');
  ui.siteReadout.hidden = true;
  const previousScore = Number(localStorage.getItem('stack-smarter-best') || 0);
  const previousFloors = Number(localStorage.getItem('stack-smarter-best-floors') || 0);
  const isNewBest = score > previousScore || floors > previousFloors;
  const bestScore = Math.max(previousScore, score), bestFloors = Math.max(previousFloors, floors);
  localStorage.setItem('stack-smarter-best', String(bestScore));
  localStorage.setItem('stack-smarter-best-floors', String(bestFloors));
  ui.finalScore.textContent = score.toLocaleString();
  ui.finalFloors.textContent = floors;
  ui.best.textContent = isNewBest ? `NEW BEST · ${bestScore.toLocaleString()} · ${bestFloors} FLOORS` : `BEST ${bestScore.toLocaleString()} · ${bestFloors} FLOORS`;
  const award = highestAward ? MILESTONES.find(({ type }) => type === highestAward) : null;
  const nextAward = MILESTONES.find(({ floor }) => floor > floors);
  if (award) {
    ui.resultKicker.textContent = 'SYMETRI PRIZE RUN';
    ui.resultLevel.textContent = `${award.label} LIFT SECURED`;
    ui.gameOverTitle.textContent = `${award.label} WON`;
    ui.resultMessage.textContent = nextAward
      ? `You landed the ${award.label.toLowerCase()} module and reached ${floors} floors. Next target: ${nextAward.label.toLowerCase()} at floor ${nextAward.floor}.`
      : `You landed every prize module and finished with ${floors} floors. Show this screen to the Symetri team.`;
  } else if (isNewBest) {
    ui.resultKicker.textContent = 'PERSONAL RECORD';
    ui.resultLevel.textContent = `${floors} FLOORS`;
    ui.gameOverTitle.textContent = 'NEW HEIGHT';
    ui.resultMessage.textContent = nextAward ? `Your tallest structure yet. Only ${nextAward.floor - floors} floors to the ${nextAward.label.toLowerCase()} lift.` : 'Your tallest structure yet. Every prize milestone is below you.';
  } else if (floors >= 10) {
    ui.resultKicker.textContent = 'STRUCTURAL REPORT';
    ui.resultLevel.textContent = 'STRONG RUN';
    ui.gameOverTitle.textContent = 'STRONG BUILD';
    ui.resultMessage.textContent = nextAward ? `${floors} floors held. The ${nextAward.label.toLowerCase()} lift is ${nextAward.floor - floors} floors away.` : `${floors} floors held. Every prize milestone was cleared.`;
  } else if (floors >= 5) {
    ui.resultKicker.textContent = 'STRUCTURAL REPORT';
    ui.resultLevel.textContent = 'SOLID RUN';
    ui.gameOverTitle.textContent = 'NICE STACK';
    ui.resultMessage.textContent = `${floors} floors complete. Read the wind and tighten the next placement.`;
  } else {
    ui.resultKicker.textContent = 'STRUCTURAL REPORT';
    ui.resultLevel.textContent = 'RUN COMPLETE';
    ui.gameOverTitle.textContent = 'BUILD AGAIN';
    ui.resultMessage.textContent = `You were ${MILESTONES[0].floor - floors} floors from the bronze lift. One tap starts the next build.`;
  }
  ui.prizeResult.hidden = !award;
  ui.claimForm.hidden = !award;
  ui.claimSuccess.hidden = true;
  ui.prizeResult.classList.remove('bronze', 'silver', 'gold');
  if (award) {
    ui.prizeResult.classList.add(award.type);
    ui.prizeResultTitle.textContent = `${award.label} PRIZE UNLOCKED`;
    ui.prizeResultText.textContent = `YOU LANDED THE ${award.label} LIFT`;
    ui.claimPrize.value = award.label;
    ui.claimScore.value = score;
    ui.claimFloors.value = floors;
  }
  ui.over.hidden = false;
  const celebrate = Boolean(award) || isNewBest || floors >= 10;
  ui.over.classList.toggle('celebrate', celebrate);
  requestAnimationFrame(() => createResultCelebration(award ? 46 : celebrate ? 30 : 16, award?.type));
  playResultFanfare(award?.type, celebrate);
}

function createResultCelebration(count, awardType = null) {
  ui.celebration.replaceChildren();
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    if (awardType) piece.classList.add(awardType);
    else if (Math.random() > 0.58) piece.classList.add('gold');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty('--delay', `${Math.random() * 0.75}s`);
    piece.style.setProperty('--duration', `${1.8 + Math.random() * 1.6}s`);
    piece.style.setProperty('--drift', `${-90 + Math.random() * 180}px`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 900}deg`);
    ui.celebration.append(piece);
  }
}

function resetClaimFlow() {
  ui.claimForm.reset();
  ui.claimForm.hidden = true;
  ui.claimSuccess.hidden = true;
  ui.claimStatus.textContent = '';
  ui.prizeResultHelp.textContent = 'Register below to claim your prize.';
  ui.claimButton.disabled = false;
  ui.claimButton.querySelector('span').textContent = 'SUBSCRIBE & CLAIM';
}

async function submitPrizeClaim(event) {
  event.preventDefault();
  ui.claimStatus.textContent = '';
  if (!ui.claimForm.reportValidity()) return;

  const formData = new FormData(ui.claimForm);
  ui.claimButton.disabled = true;
  ui.claimButton.querySelector('span').textContent = 'CLAIMING…';

  try {
    if (CLAIM_ENDPOINT) {
      const response = await fetch(CLAIM_ENDPOINT, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Claim failed (${response.status})`);
    }

    const reference = createClaimReference(formData.get('prize'));
    ui.claimSuccessName.textContent = `THANK YOU, ${String(formData.get('name')).trim().split(/\s+/)[0].toUpperCase()}`;
    ui.claimReference.textContent = `CLAIM REFERENCE · ${reference}`;
    ui.claimForm.hidden = true;
    ui.claimSuccess.hidden = false;
    ui.prizeResultHelp.textContent = 'Your prize is registered and ready to collect.';
    playPrize();
  } catch (error) {
    ui.claimStatus.textContent = 'We could not register your claim. Please try again or ask the Symetri team for help.';
    ui.claimButton.disabled = false;
    ui.claimButton.querySelector('span').textContent = 'TRY AGAIN';
    console.error(error);
  }
}

function createClaimReference(prize) {
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${String(prize).slice(0, 1)}-${stamp}-${random}`;
}

function updateUI() {
  ui.floors.textContent = floors;
  ui.score.textContent = String(score).padStart(4, '0');
  updateWeatherUI();
  updatePrizeUI();
}

function updatePrizeUI() {
  const airborneAward = MILESTONES.find(({ type }) => type === falling?.type);
  const nextAward = MILESTONES.find(({ floor }) => floor > floors);
  const activeAward = airborneAward || nextAward || MILESTONES[MILESTONES.length - 1];
  ui.prizeReadout.classList.remove('bronze', 'silver', 'gold');
  ui.prizeReadout.classList.add(activeAward.type);
  if (airborneAward) {
    ui.prizeProgress.textContent = `${airborneAward.label} LIFT IN AIR`;
    return;
  }
  if (!nextAward) {
    ui.prizeProgress.textContent = 'ALL PRIZES SECURED';
    return;
  }
  const remaining = nextAward.floor - floors;
  ui.prizeProgress.textContent = `${nextAward.label} · ${remaining} ${remaining === 1 ? 'FLOOR' : 'FLOORS'}`;
}

function showFeedback(text, style = false) {
  ui.feedback.textContent = text;
  ui.feedback.className = 'feedback';
  void ui.feedback.offsetWidth;
  ui.feedback.classList.add('show');
  if (style === true) ui.feedback.classList.add('perfect');
  else if (style) ui.feedback.classList.add(style);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.034);
  swingTime += dt;
  const altitude = heightWindMultiplier();
  const altitudeGust = 1 + Math.min(floors, 40) * 0.006;
  const slowGust = Math.sin(swingTime * 0.52 + wind.gustPhase) * wind.gustDepth * altitudeGust;
  const softFlutter = Math.sin(swingTime * 1.31 + wind.gustPhase * 0.7) * wind.gustDepth * 0.28 * altitudeGust;
  wind.currentSpeed = Math.max(0.35, wind.baseSpeed * altitude * (1 + slowGust + softFlutter));
  if (mode === 'start' && falling) swingSpeed = 0.75;
  updateLoad(dt);
  updateImpacts(dt);
  updatePhysics(dt);
  updateParticles(dt);
  updateCamera(dt);
  windTurbines.forEach(turbine => {
    turbine.rotor.rotation.z = turbine.offset - swingTime * (0.28 + wind.currentSpeed * 0.17);
  });
  impactFlash = Math.max(0, impactFlash - dt * 5);
  renderer.toneMappingExposure = 1.04 + impactFlash * 0.045;
  renderer.render(scene, camera);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  if (siteContainer) {
    siteContainer.position.x = w < 700 ? 1 : 5.85;
    siteContainer.position.z = w < 700 ? -4.35 : -4.18;
  }
  camera.aspect = w / h;
  camera.fov = w < 700 ? THREE.MathUtils.clamp(44 + (700 - w) * 0.018, 44, 50) : 37;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, w < 520 ? 1.65 : 2));
  renderer.setSize(w, h, false);
}

function box(w, h, d, material, shadows = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

function bevelBox(w, h, d, bevel, material) {
  const shape = new THREE.Shape(), x = w / 2, y = d / 2;
  shape.moveTo(-x + bevel, -y);
  shape.lineTo(x - bevel, -y);
  shape.quadraticCurveTo(x, -y, x, -y + bevel);
  shape.lineTo(x, y - bevel);
  shape.quadraticCurveTo(x, y, x - bevel, y);
  shape.lineTo(-x + bevel, y);
  shape.quadraticCurveTo(-x, y, -x, y - bevel);
  shape.lineTo(-x, -y + bevel);
  shape.quadraticCurveTo(-x, -y, -x + bevel, -y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1 });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, h / 2, 0);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function brace(a, b, radius, material) {
  const delta = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, delta.clone().normalize());
  mesh.castShadow = true;
  return mesh;
}

function imagePlane(texture, width, height, transparent = true) {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function textPlane(text, width, height, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.font = '700 44px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return imagePlane(texture, width, height, true);
}

function elementLabel(type) {
  return ({ slab: 'CONCRETE SLAB', module: 'PREFAB MODULE', beam: 'STEEL FRAME', facade: 'FAÇADE ELEMENT', smart: 'SMART MODULE', bronze: 'BRONZE PRIZE LIFT', silver: 'SILVER PRIZE LIFT', gold: 'GOLD PRIZE LIFT' })[type];
}

function initAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function playTone(frequency, duration, type = 'sine', volume = 0.03, delay = 0) {
  if (!soundOn) return;
  initAudio();
  const now = audioContext.currentTime + delay, oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.72), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playNoise(duration, volume, frequency, filterType = 'bandpass', delay = 0) {
  if (!soundOn) return;
  initAudio();
  const rate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, Math.ceil(rate * duration), rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.35);
  const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
  const now = audioContext.currentTime + delay;
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, now);
  filter.Q.value = filterType === 'bandpass' ? 0.75 : 0.3;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start(now);
}

function playRelease() {
  playTone(185, 0.075, 'square', 0.024);
  playTone(820, 0.045, 'triangle', 0.018, 0.018);
  playNoise(0.34, 0.022 + wind.currentSpeed * 0.0015, 480 + wind.currentSpeed * 85, 'bandpass', 0.025);
}

function playCraneCue() {
  playTone(112, 0.18, 'triangle', 0.018);
  playTone(168, 0.12, 'sine', 0.012, 0.07);
  playNoise(0.16, 0.009, 620, 'bandpass');
}

function playChord(base) {
  playTone(base, 0.16, 'sine', 0.038);
  playTone(base * 1.25, 0.18, 'sine', 0.028, 0.045);
  playTone(base * 1.5, 0.2, 'triangle', 0.022, 0.085);
}

function playImpact(accuracy) {
  playTone(95 + accuracy * 45, 0.12, 'triangle', 0.055);
  playTone(310 + accuracy * 130, 0.05, 'sine', 0.016, 0.018);
  playNoise(0.13, 0.034, 180, 'lowpass');
}

function playNearPerfect(accuracy) {
  playNoise(0.16, 0.03, 220, 'lowpass');
  playTone(420 + accuracy * 80, 0.16, 'sine', 0.036);
  playTone(630 + accuracy * 90, 0.22, 'triangle', 0.026, 0.055);
  playTone(840, 0.12, 'sine', 0.014, 0.105);
}

function playPrize() {
  playNoise(0.22, 0.028, 260, 'lowpass');
  [523, 659, 784, 1047].forEach((note, index) => playTone(note, 0.34, index < 2 ? 'triangle' : 'sine', 0.034, index * 0.09));
}

function playResultFanfare(awardType, celebrate) {
  if (awardType) {
    const notes = awardType === 'gold' ? [392, 523, 659, 784, 1047] : [392, 523, 659, 784];
    notes.forEach((note, index) => playTone(note, 0.42, 'sine', 0.03, index * 0.085));
    playNoise(0.35, 0.018, 720, 'bandpass');
  } else if (celebrate) {
    [330, 440, 554].forEach((note, index) => playTone(note, 0.32, index === 0 ? 'triangle' : 'sine', 0.026, index * 0.08));
  } else {
    playTone(260, 0.18, 'triangle', 0.02);
    playTone(330, 0.22, 'sine', 0.015, 0.08);
  }
}

function playCollapse() {
  playTone(78, 0.8, 'sawtooth', 0.075);
  playTone(52, 1.05, 'triangle', 0.065, 0.14);
  playTone(122, 0.45, 'square', 0.018, 0.08);
  playNoise(1.1, 0.055, 135, 'lowpass');
}

function updateSoundButton() {
  ui.sound.classList.toggle('muted', !soundOn);
  ui.sound.setAttribute('aria-pressed', String(soundOn));
  ui.sound.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
}

ui.play.addEventListener('click', startGame);
ui.replay.addEventListener('click', startGame);
ui.claimForm.addEventListener('submit', submitPrizeClaim);
ui.home.addEventListener('click', returnHome);
ui.restart.addEventListener('click', startGame);
ui.sound.addEventListener('click', event => {
  event.stopPropagation();
  soundOn = !soundOn;
  localStorage.setItem('stack-smarter-sound', soundOn ? 'on' : 'off');
  updateSoundButton();
  if (soundOn) playTone(440, 0.07);
});
canvas.addEventListener('pointerdown', event => { event.preventDefault(); releaseLoad(); });
addEventListener('keydown', event => {
  if ((event.code === 'Space' || event.code === 'Enter') && mode === 'playing') { event.preventDefault(); releaseLoad(); }
});
addEventListener('resize', resize, { passive: true });
