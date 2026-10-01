/**
 * بناء مجسّم الكيبورد الوردي: الجسم، لوحة التثبيت، والكيكابس المنحوتة.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE, DIMS, LAYOUT, ROW_PROFILE } from './config.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/* ------------------------------------------------------------------ */
/* نسيج الحروف: خلفية بلون الكيكاب + حرف لاتيني وحرف عربي              */
/* ------------------------------------------------------------------ */
const legendCache = new Map();

function legendTexture(color, en, ar, size = 128, big = false, accent = false) {
  const key = `${color}|${en}|${ar}|${size}|${accent}`;
  if (legendCache.has(key)) return legendCache.get(key);

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  g.fillStyle = hex(color);
  g.fillRect(0, 0, size, size);

  // تدرّج خفيف يوحي بانحناء سطح الكيكاب
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.03)');
  grad.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  const pad = size * 0.2;
  g.textBaseline = 'middle';

  const inkMain = accent ? PALETTE.legendOnAccent : PALETTE.legend;
  const inkAlt = accent ? PALETTE.legendOnAccent : PALETTE.legendAlt;

  if (en) {
    const long = en.length > 2;
    g.fillStyle = hex(inkMain);
    g.font = `700 ${size * (big ? 0.4 : long ? 0.2 : 0.3)}px Tajawal, system-ui, sans-serif`;
    g.textAlign = 'left';
    g.fillText(en, pad, ar ? pad * 1.25 : size * 0.5);
  }
  if (ar) {
    g.fillStyle = hex(inkAlt);
    g.font = `700 ${size * (big ? 0.46 : 0.3)}px Tajawal, system-ui, sans-serif`;
    g.textAlign = 'right';
    g.fillText(ar, size - pad, size - pad * 1.15);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  legendCache.set(key, tex);
  return tex;
}

/* ------------------------------------------------------------------ */
/* هندسة الكيكاب: صندوق مدوّر + تضييق للأعلى + تقعّر السطح             */
/* ------------------------------------------------------------------ */
export function keycapGeometry(widthU, height = DIMS.capHeight) {
  const w = widthU * DIMS.pitch - DIMS.gap;
  const d = DIMS.pitch - DIMS.gap;
  const geo = new RoundedBoxGeometry(w, height, d, 5, DIMS.capRadius);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const nrm = geo.attributes.normal;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp((v.y + height / 2) / height, 0, 1);

    // تضييق تدريجي نحو الأعلى
    const s = 1 - DIMS.capTaper * Math.pow(t, 1.35);
    v.x *= s;
    v.z *= s;

    // تقعّر سطح الكيكاب
    if (t > 0.86) {
      const nx = v.x / (w / 2);
      const nz = v.z / (d / 2);
      const r = Math.min(1, Math.sqrt(nx * nx * 0.55 + nz * nz));
      v.y -= DIMS.capDish * (1 - r * r) * ((t - 0.86) / 0.14);
    }
    pos.setXYZ(i, v.x, v.y, v.z);

    // الحروف تُطبع على الوجه العلوي فقط، وبقية الأوجه تأخذ لون الخلفية
    const ny = nrm.getY(i);
    if (ny > 0.55) {
      uv.setXY(i, 0.5 + v.x / (w * 1.12), 0.5 - v.z / (d * 1.12));
    } else {
      uv.setXY(i, 0.035, 0.5);
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* شكل مستطيل بزوايا مدوّرة */
function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = w / 2;
  const z = d / 2;
  s.moveTo(-x + r, -z);
  s.lineTo(x - r, -z);
  s.quadraticCurveTo(x, -z, x, -z + r);
  s.lineTo(x, z - r);
  s.quadraticCurveTo(x, z, x - r, z);
  s.lineTo(-x + r, z);
  s.quadraticCurveTo(-x, z, -x, z - r);
  s.lineTo(-x, -z + r);
  s.quadraticCurveTo(-x, -z, -x + r, -z);
  return s;
}

function roundedRectPath(w, d, r) {
  const s = roundedRect(w, d, r);
  return new THREE.Path(s.getPoints(24));
}

/* ------------------------------------------------------------------ */
/* بناء الكيبورد كاملًا                                                */
/* ------------------------------------------------------------------ */
export function buildKeyboard() {
  const group = new THREE.Group();
  const keys = [];
  let hero = null;

  const unitsWide = LAYOUT.reduce(
    (m, row) => Math.max(m, row.reduce((s, k) => s + k.w, 0)),
    0
  );
  const boardW = unitsWide * DIMS.pitch;
  const boardD = LAYOUT.length * DIMS.pitch;

  /* ----- المواد ----- */
  const capMat = (color, map) =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map,
      roughness: 0.46,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.34,
      sheen: 0.4,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5),
      envMapIntensity: 1.15,
    });

  const caseMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.caseTop,
    roughness: 0.3,
    metalness: 0.55,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.5,
  });

  const baseMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.caseBottom,
    roughness: 0.42,
    metalness: 0.6,
    envMapIntensity: 1.1,
  });

  const plateMat = new THREE.MeshStandardMaterial({
    color: PALETTE.plate,
    roughness: 0.34,
    metalness: 0.92,
    envMapIntensity: 1.3,
  });

  /* ----- إطار الجسم (بزِل) مع فتحة منطقة المفاتيح ----- */
  const outer = roundedRect(boardW + DIMS.bezel * 2, boardD + DIMS.bezel * 2, 1.1);
  outer.holes.push(roundedRectPath(boardW + 0.26, boardD + 0.26, 0.4));
  const bezel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outer, {
      depth: DIMS.caseTopY - DIMS.caseBottomY,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 3,
      curveSegments: 8,
    }),
    caseMat
  );
  bezel.rotation.x = -Math.PI / 2;
  bezel.position.y = DIMS.caseBottomY;
  bezel.castShadow = bezel.receiveShadow = true;
  group.add(bezel);

  /* ----- قاعدة سفلية ----- */
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(
      boardW + DIMS.bezel * 2 - 0.1,
      DIMS.caseBottomY - DIMS.baseY,
      boardD + DIMS.bezel * 2 - 0.1,
      3,
      0.22
    ),
    baseMat
  );
  base.position.y = (DIMS.caseBottomY + DIMS.baseY) / 2;
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  /* ----- شريط إضاءة سفلي (underglow) ----- */
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(boardW + DIMS.bezel * 2 - 0.35, 0.09, boardD + DIMS.bezel * 2 - 0.35),
    new THREE.MeshBasicMaterial({ color: PALETTE.glowBlue, transparent: true, opacity: 0.8 })
  );
  glow.position.y = DIMS.baseY + 0.05;
  group.add(glow);

  /* ----- لوحة التثبيت مع فتحة المفتاح البطل ----- */
  const heroSlot = { x: 0, z: 0 };
  LAYOUT.forEach((row, ri) => {
    const rowW = row.reduce((s, k) => s + k.w, 0) * DIMS.pitch;
    let x = -rowW / 2;
    row.forEach((k) => {
      const kw = k.w * DIMS.pitch;
      if (k.type === 'hero') {
        heroSlot.x = x + kw / 2;
        heroSlot.z = (ri - (LAYOUT.length - 1) / 2) * DIMS.pitch;
      }
      x += kw;
    });
  });

  const plateShape = roundedRect(boardW + 0.2, boardD + 0.2, 0.36);
  const hole = new THREE.Path();
  const hs = 0.71;
  hole.moveTo(heroSlot.x - hs, heroSlot.z - hs);
  hole.lineTo(heroSlot.x - hs, heroSlot.z + hs);
  hole.lineTo(heroSlot.x + hs, heroSlot.z + hs);
  hole.lineTo(heroSlot.x + hs, heroSlot.z - hs);
  hole.lineTo(heroSlot.x - hs, heroSlot.z - hs);
  plateShape.holes.push(hole);
  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(plateShape, {
      depth: DIMS.plateThickness,
      bevelEnabled: false,
      curveSegments: 6,
    }),
    plateMat
  );
  plate.rotation.x = Math.PI / 2;
  plate.position.y = DIMS.plateY;
  plate.receiveShadow = true;
  group.add(plate);

  /* ----- الكيكابس ----- */
  const geoCache = new Map();
  LAYOUT.forEach((row, ri) => {
    const prof = ROW_PROFILE[ri] || ROW_PROFILE[2];
    const rowW = row.reduce((s, k) => s + k.w, 0) * DIMS.pitch;
    let x = -rowW / 2;
    const z = (ri - (LAYOUT.length - 1) / 2) * DIMS.pitch;

    row.forEach((k, ki) => {
      const kw = k.w * DIMS.pitch;
      const cx = x + kw / 2;
      x += kw;

      const color =
        k.type === 'accent' || k.type === 'hero'
          ? PALETTE.keyAccent
          : k.type === 'mod'
          ? PALETTE.keyMod
          : PALETTE.keyBase;

      const gk = `${k.w}`;
      if (!geoCache.has(gk)) geoCache.set(gk, keycapGeometry(k.w));
      const big = k.type === 'hero';
      const accent = k.type === 'accent' || k.type === 'hero';
      const map = legendTexture(color, k.en, k.ar, big ? 320 : 160, big, accent);
      const mesh = new THREE.Mesh(geoCache.get(gk), capMat(color, map));

      mesh.position.set(cx, DIMS.capHeight / 2 + 0.16 + prof.lift, z);
      mesh.rotation.x = prof.tilt;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData = { row: ri, col: ki, type: k.type, baseY: mesh.position.y };
      group.add(mesh);
      keys.push(mesh);
      if (k.type === 'hero') hero = mesh;
    });
  });

  /* ----- ميل الكيبورد الطبيعي ----- */
  group.rotation.x = DIMS.tilt;

  return { group, keys, hero, heroSlot, boardW, boardD, bezel, plate, glow };
}
