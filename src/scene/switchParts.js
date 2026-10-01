/**
 * مكوّنات السويتش الداخلية لمشهد التفكيك (exploded view)
 * + خيوط الضوء الزرقاء الرفيعة بين القطع + نبضة الضوء عند إعادة التجميع.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './config.js';

/* منحنى حلزوني للنابض */
class Helix extends THREE.Curve {
  constructor(radius = 0.3, height = 0.62, coils = 6) {
    super();
    this.radius = radius;
    this.height = height;
    this.coils = coils;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2 * this.coils;
    return target.set(
      Math.cos(a) * this.radius,
      t * this.height - this.height / 2,
      Math.sin(a) * this.radius
    );
  }
}

export function buildSwitch() {
  const group = new THREE.Group();
  const parts = {};

  const addPart = (id, mesh, y) => {
    mesh.position.y = y;
    mesh.userData.baseY = y;
    mesh.castShadow = true;
    group.add(mesh);
    parts[id] = mesh;
    return mesh;
  };

  /* الغلاف العلوي الشفاف */
  const topHousing = new THREE.Group();
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.housingTop,
    roughness: 0.14,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.6,
    ior: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.95,
    envMapIntensity: 1.6,
  });
  const shell = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.6, 1.42, 3, 0.1), shellMat);
  topHousing.add(shell);
  const lip = new THREE.Mesh(
    new RoundedBoxGeometry(1.56, 0.12, 1.56, 2, 0.05),
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.housingTop,
      roughness: 0.25,
      transmission: 0.3,
      transparent: true,
      opacity: 0.9,
    })
  );
  lip.position.y = -0.26;
  topHousing.add(lip);
  addPart('housingTop', topHousing, 0.2);

  /* الساق + صليب التثبيت */
  const stemMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.stem,
    roughness: 0.38,
    metalness: 0.05,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.2,
  });
  const stem = new THREE.Group();
  const stemBody = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.52, 0.86, 3, 0.07), stemMat);
  stem.add(stemBody);
  const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.12), stemMat);
  const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.42), stemMat);
  crossA.position.y = crossB.position.y = 0.4;
  stem.add(crossA, crossB);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.16, 0.3), stemMat);
  rail.position.y = -0.18;
  stem.add(rail);
  addPart('stem', stem, 0.48);

  /* النابض */
  const spring = new THREE.Mesh(
    new THREE.TubeGeometry(new Helix(0.27, 0.6, 6), 150, 0.045, 8, false),
    new THREE.MeshStandardMaterial({
      color: PALETTE.spring,
      roughness: 0.22,
      metalness: 1,
      envMapIntensity: 1.8,
    })
  );
  addPart('spring', spring, -0.06);

  /* الريشة المعدنية (نقاط التلامس) */
  const contacts = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: PALETTE.contact,
    roughness: 0.18,
    metalness: 1,
    envMapIntensity: 2,
  });
  [-0.34, 0.34].forEach((x, i) => {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.5), metalMat);
    leaf.position.set(x, 0, 0);
    leaf.rotation.z = i ? 0.16 : -0.16;
    contacts.add(leaf);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 10), metalMat);
    pin.position.set(x, -0.42, 0.18);
    contacts.add(pin);
  });
  addPart('contacts', contacts, -0.42);

  /* الغلاف السفلي */
  const bottom = new THREE.Group();
  const bottomMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.housingBottom,
    roughness: 0.62,
    metalness: 0.18,
    clearcoat: 0.3,
    envMapIntensity: 0.9,
  });
  const shellB = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.66, 1.5, 3, 0.1), bottomMat);
  bottom.add(shellB);
  const ledSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.1, 0.22),
    new THREE.MeshBasicMaterial({ color: PALETTE.glowBlue })
  );
  ledSeat.position.set(0, 0.34, -0.42);
  bottom.add(ledSeat);
  addPart('housingBottom', bottom, -0.78);

  /* قطعة من اللوحة الإلكترونية مع وسائد اللحام */
  const pcb = new THREE.Group();
  const board = new THREE.Mesh(
    new RoundedBoxGeometry(3.3, 0.14, 3.3, 2, 0.06),
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.pcb,
      roughness: 0.5,
      metalness: 0.35,
      clearcoat: 0.6,
      envMapIntensity: 1,
    })
  );
  pcb.add(board);
  const padMat = new THREE.MeshStandardMaterial({
    color: PALETTE.pad,
    roughness: 0.25,
    metalness: 1,
    envMapIntensity: 1.6,
  });
  [[-0.34, 0.18], [0.34, 0.18], [0, -0.52]].forEach(([x, z]) => {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 14), padMat);
    pad.position.set(x, 0.04, z);
    pcb.add(pad);
  });
  const trace = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.03, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x2f7ea8, transparent: true, opacity: 0.85 })
  );
  trace.position.set(0, 0.09, 0.85);
  pcb.add(trace);
  const trace2 = trace.clone();
  trace2.position.z = -1.0;
  trace2.scale.x = 0.7;
  pcb.add(trace2);
  addPart('pcb', pcb, -1.12);

  return { group, parts };
}

/* ------------------------------------------------------------------ */
/* خيوط الضوء الزرقاء بين المكوّنات الطائرة                            */
/* ------------------------------------------------------------------ */
const STREAK_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const STREAK_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main(){
    float edge = smoothstep(0.0,0.14,vUv.y) * smoothstep(1.0,0.86,vUv.y);
    float core = smoothstep(0.5,1.0,1.0-abs(vUv.x-0.5)*2.0);
    float travel = fract(vUv.y * 1.6 - uTime * 0.85);
    float pulse = smoothstep(0.78,1.0,travel) * 1.7;
    float a = (0.55 + pulse) * edge * (0.5 + core * 1.0) * uOpacity;
    gl_FragColor = vec4(uColor * (1.0 + pulse * 1.5), a);
  }
`;

export function buildStreaks(count) {
  const group = new THREE.Group();
  const items = [];
  const geo = new THREE.CylinderGeometry(0.042, 0.042, 1, 10, 1, true);
  geo.translate(0, 0.5, 0); // الأصل عند القاعدة ليسهل التمدد

  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(PALETTE.glowBlue) },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: STREAK_VERT,
      fragmentShader: STREAK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    group.add(m);
    items.push(m);
  }
  return { group, items };
}

const UP = new THREE.Vector3(0, 1, 0);
const DIR = new THREE.Vector3();

/** توجيه خيط الضوء بين نقطتين */
export function aimStreak(mesh, a, b, opacity, time) {
  DIR.subVectors(b, a);
  const len = DIR.length();
  if (len < 0.0001 || opacity <= 0.001) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, DIR.normalize());
  mesh.scale.set(1, len, 1);
  mesh.material.uniforms.uOpacity.value = opacity;
  mesh.material.uniforms.uTime.value = time;
}

/* ------------------------------------------------------------------ */
/* نبضة الضوء الزرقاء عند إعادة التجميع                                */
/* ------------------------------------------------------------------ */
export function buildPulse() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.glowBlue) },
      uProgress: { value: 0 },
    },
    vertexShader: STREAK_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uProgress;
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float r = uProgress;
        float ring = smoothstep(r, r - 0.26, d) * smoothstep(r - 0.42, r - 0.3, d);
        float core = smoothstep(0.55, 0.0, d) * (1.0 - smoothstep(0.0, 0.45, uProgress));
        float a = (ring * 0.9 + core * 0.8) * (1.0 - uProgress);
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor * 1.7, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}
