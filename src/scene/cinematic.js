/**
 * محرّك المشهد السينمائي للكيبورد الوردي
 * ------------------------------------------------------------------
 * بيئة كحلية داكنة + إضاءة زرقاء/سماوية + انعكاسات ماجنتا،
 * حركة كاميرا ماكرو → تفكيك رأسي → دوران وتغيير بؤرة → إعادة تجميع
 * → لقطة بطل ثلاثة أرباع، مع عمق ميدان حقيقي وتوهّج سينمائي.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

import { PALETTE, DURATION, CAMERA_KEYS, EXPLODE, PULSE, SWITCH_PARTS } from './config.js';
import { buildKeyboard } from './keyboard.js';
import { buildSwitch, buildStreaks, buildPulse, aimStreak } from './switchParts.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smoother = (t) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const range = (v, a, b) => smoother((v - a) / (b - a || 1));

/* ------------------------------------------------------------------ */
/* خريطة البيئة (equirect) لانعكاسات واقعية                            */
/* ------------------------------------------------------------------ */
function environmentTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');

  const base = g.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#0b1a3a');
  base.addColorStop(0.45, '#071027');
  base.addColorStop(1, '#02040c');
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 512);

  const blob = (x, y, r, color, alpha) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba'));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  blob(230, 120, 260, 'rgb(90,210,255)', 0.95); // مفتاح ضوء سماوي
  blob(760, 170, 230, 'rgb(255,70,150)', 0.8); // حافة ماجنتا
  blob(520, 60, 180, 'rgb(220,245,255)', 0.7); // ضوء علوي
  blob(60, 330, 200, 'rgb(40,90,220)', 0.55);

  // شرائط سوفت بوكس للانعكاسات الخطية
  g.globalAlpha = 0.85;
  g.fillStyle = 'rgba(190,235,255,0.9)';
  g.fillRect(150, 40, 420, 16);
  g.fillStyle = 'rgba(255,120,185,0.75)';
  g.fillRect(620, 95, 300, 12);
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#010206';
  g.fillRect(0, 0, 512, 512);
  const rg = g.createRadialGradient(256, 256, 20, 256, 256, 250);
  rg.addColorStop(0, '#0d1934');
  rg.addColorStop(0.55, '#060c1c');
  rg.addColorStop(1, '#010206');
  g.fillStyle = rg;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
export class CinematicKeyboard {
  constructor(container, opts = {}) {
    this.container = container;
    this.quality = opts.quality || 'auto';
    this.onTime = opts.onTime || (() => {});
    this.time = 0;
    this.playing = true;
    this.speed = 1;
    this.pointer = new THREE.Vector2(0, 0);
    this.parallax = new THREE.Vector2(0, 0);
    this._disposed = false;
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._focusPoint = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._camTgt = new THREE.Vector3();

    this._initQuality();
    this._initRenderer();
    this._initScene();
    this._initComposer();
    this._bind();
    this.update(0, true);
    this._loop();
  }

  /* ---------------- جودة تلقائية حسب الجهاز ---------------- */
  _initQuality() {
    if (this.quality === 'auto') {
      const w = window.innerWidth;
      const cores = navigator.hardwareConcurrency || 4;
      const mobile = w < 760 || /Mobi|Android/i.test(navigator.userAgent);
      this.quality = mobile ? 'low' : cores <= 4 ? 'medium' : 'high';
    }
    const q = this.quality;
    this.cfg = {
      dpr: q === 'high' ? 1.7 : q === 'medium' ? 1.35 : 1,
      bokeh: q !== 'low',
      shadows: q === 'high',
      bloomStrength: q === 'low' ? 0.42 : 0.52,
      particles: q === 'high' ? 420 : q === 'medium' ? 240 : 120,
    };
  }

  _initRenderer() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.cfg.dpr));
    this.renderer.setSize(w || 960, h || 540);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    if (this.cfg.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.canvas);
  }

  _initScene() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color(PALETTE.env);
    scene.fog = new THREE.FogExp2(0x03060f, 0.0085);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = environmentTexture();
    this.envRT = pmrem.fromEquirectangular(envTex);
    scene.environment = this.envRT.texture;
    envTex.dispose();
    pmrem.dispose();

    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera = new THREE.PerspectiveCamera(28, (w || 960) / (h || 540), 0.1, 400);
    this.camera.position.set(-10, 2, 6);

    /* ----- خلفية كحلية متدرّجة ----- */
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(170, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color(0x0a1634) },
          uBottom: { value: new THREE.Color(0x01030a) },
          uGlow: { value: new THREE.Color(PALETTE.glowBlue) },
          uGlow2: { value: new THREE.Color(PALETTE.glowMagenta) },
        },
        vertexShader: `
          varying vec3 vPos;
          void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: `
          uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform vec3 uGlow2;
          varying vec3 vPos;
          void main(){
            float h = vPos.y * 0.5 + 0.5;
            vec3 col = mix(uBottom, uTop, pow(h, 0.85));
            float a = max(0.0, dot(normalize(vPos), normalize(vec3(-0.75, 0.42, -0.5))));
            col += uGlow * pow(a, 7.0) * 0.5;
            float b = max(0.0, dot(normalize(vPos), normalize(vec3(0.85, 0.15, -0.35))));
            col += uGlow2 * pow(b, 9.0) * 0.32;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    scene.add(sky);

    /* ----- الأرضية العاكسة ----- */
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({
        map: floorTexture(),
        color: 0x7e8ba8,
        roughness: 0.38,
        metalness: 0.7,
        envMapIntensity: 0.5,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.06;
    floor.receiveShadow = this.cfg.shadows;
    scene.add(floor);

    /* ----- بركة ضوء ملوّنة تحت الكيبورد ----- */
    const poolC = document.createElement('canvas');
    poolC.width = poolC.height = 256;
    const pg2 = poolC.getContext('2d');
    const pr = pg2.createRadialGradient(128, 128, 6, 128, 128, 126);
    pr.addColorStop(0, 'rgba(255,120,185,0.95)');
    pr.addColorStop(0.35, 'rgba(150,90,220,0.42)');
    pr.addColorStop(0.7, 'rgba(60,170,255,0.16)');
    pr.addColorStop(1, 'rgba(0,0,0,0)');
    pg2.fillStyle = pr;
    pg2.fillRect(0, 0, 256, 256);
    const poolTex = new THREE.CanvasTexture(poolC);
    poolTex.colorSpace = THREE.SRGBColorSpace;
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(74, 42),
      new THREE.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, -2.02, 1.5);
    scene.add(pool);

    /* ----- الكيبورد ----- */
    const kb = buildKeyboard();
    this.kb = kb;
    scene.add(kb.group);

    /* ----- مكوّنات السويتش للمفتاح البطل ----- */
    const sw = buildSwitch();
    this.sw = sw;
    sw.group.position.set(kb.heroSlot.x, 0, kb.heroSlot.z);
    kb.group.add(sw.group);
    this.partList = SWITCH_PARTS.filter((p) => p.id !== 'cap').map((p) => ({
      ...p,
      mesh: sw.parts[p.id],
    }));
    this.capPart = SWITCH_PARTS.find((p) => p.id === 'cap');

    // إخفاء المكوّنات حتى بداية التفكيك
    Object.values(sw.parts).forEach((m) => (m.visible = false));

    /* ----- خيوط الضوء ----- */
    const streaks = buildStreaks(SWITCH_PARTS.length - 1);
    this.streaks = streaks;
    scene.add(streaks.group);

    /* ----- نبضة الضوء ----- */
    this.pulse = buildPulse();
    kb.group.add(this.pulse);
    this.pulse.position.set(kb.heroSlot.x, 1.52, kb.heroSlot.z);

    this.pulseLight = new THREE.PointLight(PALETTE.glowBlue, 0, 26, 2);
    kb.group.add(this.pulseLight);
    this.pulseLight.position.set(kb.heroSlot.x, 2.2, kb.heroSlot.z);

    /* ----- الإضاءة ----- */
    RectAreaLightUniformsLib.init();

    scene.add(new THREE.HemisphereLight(0x20406e, 0x05070f, 0.42));

    const key = new THREE.DirectionalLight(0x8fd8ff, 1.75);
    key.position.set(-14, 16, 11);
    if (this.cfg.shadows) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 4;
      key.shadow.camera.far = 60;
      key.shadow.camera.left = -24;
      key.shadow.camera.right = 24;
      key.shadow.camera.top = 18;
      key.shadow.camera.bottom = -18;
      key.shadow.bias = -0.0012;
      key.shadow.normalBias = 0.03;
    }
    scene.add(key);

    const rim = new THREE.DirectionalLight(PALETTE.glowMagenta, 1.25);
    rim.position.set(16, 7, -13);
    scene.add(rim);

    const strip = new THREE.RectAreaLight(0x62d9ff, 4.2, 30, 2.4);
    strip.position.set(-8, 9.5, 7);
    strip.lookAt(0, 0, 0);
    scene.add(strip);

    const strip2 = new THREE.RectAreaLight(0xff4f9c, 3.0, 22, 2);
    strip2.position.set(11, 6.5, -9);
    strip2.lookAt(0, 0, 0);
    scene.add(strip2);

    const under = new THREE.PointLight(PALETTE.glowBlue, 7, 22, 2.2);
    under.position.set(0, -1.75, 0);
    scene.add(under);

    this.macroLight = new THREE.PointLight(0xbfe9ff, 2.2, 16, 2);
    scene.add(this.macroLight);

    // إضاءة مشهد التفكيك: مفتاح دافئ وردي + ملء أزرق من الأسفل
    this.stackKey = new THREE.PointLight(0xffe0ef, 0, 20, 2);
    this.stackKey.position.set(kb.heroSlot.x + 2.4, 4.6, kb.heroSlot.z + 2.8);
    kb.group.add(this.stackKey);

    this.stackFill = new THREE.PointLight(PALETTE.glowBlue, 0, 18, 2);
    this.stackFill.position.set(kb.heroSlot.x - 2.2, 0.4, kb.heroSlot.z - 2.0);
    kb.group.add(this.stackFill);

    this.stackRim = new THREE.SpotLight(0x9fe8ff, 0, 26, 0.7, 0.6, 1.6);
    this.stackRim.position.set(kb.heroSlot.x - 4, 9, kb.heroSlot.z - 5);
    this.stackRim.target.position.set(kb.heroSlot.x, 2, kb.heroSlot.z);
    kb.group.add(this.stackRim, this.stackRim.target);

    /* ----- ذرات الغبار السينمائية ----- */
    const count = this.cfg.particles;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 48;
      pos[i * 3 + 1] = Math.random() * 14 - 1.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 32;
      seed[i] = Math.random() * 6.283;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dust = new THREE.Points(
      pg,
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0x9fe4ff) },
          uSize: { value: this.renderer.getPixelRatio() * 34 },
        },
        vertexShader: `
          attribute float aSeed; uniform float uTime; uniform float uSize;
          varying float vA;
          void main(){
            vec3 p = position;
            p.y += sin(uTime * 0.22 + aSeed) * 0.9;
            p.x += cos(uTime * 0.16 + aSeed * 1.7) * 0.7;
            vec4 mv = modelViewMatrix * vec4(p,1.0);
            vA = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * 0.9 + aSeed * 3.1));
            gl_PointSize = uSize / max(1.0, -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor; varying float vA;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float a = smoothstep(0.5, 0.0, d) * vA * 0.55;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(this.dust);
  }

  _initComposer() {
    const { clientWidth: w, clientHeight: h } = this.container;
    const size = new THREE.Vector2(w || 960, h || 540);
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(size.x, size.y);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.cfg.bokeh) {
      this.bokeh = new BokehPass(this.scene, this.camera, {
        focus: 10,
        aperture: 0.0003,
        maxblur: 0.009,
      });
      this.composer.addPass(this.bokeh);
    }

    this.bloom = new UnrealBloomPass(size, this.cfg.bloomStrength, 0.62, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  _bind() {
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.container);
    }
    this._onPointer = (e) => {
      const r = this.container.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        ((e.clientY - r.top) / r.height) * 2 - 1
      );
    };
    window.addEventListener('pointermove', this._onPointer, { passive: true });

    this._onVisibility = () => {
      this._hidden = document.hidden;
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    if (window.IntersectionObserver) {
      this._io = new IntersectionObserver(
        (entries) => {
          this._offscreen = !entries[0].isIntersecting;
        },
        { threshold: 0.02 }
      );
      this._io.observe(this.container);
    }

    this._onLost = (e) => {
      e.preventDefault();
      this._contextLost = true;
    };
    this._onRestored = () => {
      this._contextLost = false;
    };
    this.canvas.addEventListener('webglcontextlost', this._onLost);
    this.canvas.addEventListener('webglcontextrestored', this._onRestored);
  }

  resize() {
    const w = this.container.clientWidth || 960;
    const h = this.container.clientHeight || 540;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  /* ---------------- حركة الكاميرا ---------------- */
  _sampleCamera(t) {
    const keys = CAMERA_KEYS;
    let i = 0;
    while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const k = smoother((t - a.t) / (b.t - a.t || 1));

    this._camPos.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], k),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], k),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], k)
    );
    this._camTgt.set(
      THREE.MathUtils.lerp(a.target[0], b.target[0], k),
      THREE.MathUtils.lerp(a.target[1], b.target[1], k),
      THREE.MathUtils.lerp(a.target[2], b.target[2], k)
    );
    return {
      fov: THREE.MathUtils.lerp(a.fov, b.fov, k),
      aperture: THREE.MathUtils.lerp(a.aperture, b.aperture, k),
      maxblur: THREE.MathUtils.lerp(a.maxblur, b.maxblur, k),
      focusOn: k < 0.5 ? a.focusOn : b.focusOn,
      focusMix: k,
      focusA: a.focusOn,
      focusB: b.focusOn,
    };
  }

  _focusTarget(name, out) {
    const kb = this.kb;
    switch (name) {
      case 'hero':
        return kb.hero.getWorldPosition(out);
      case 'cap':
        return kb.hero.getWorldPosition(out);
      case 'pcb':
        return this.sw.parts.pcb.getWorldPosition(out);
      case 'board':
        return out.set(0, 0, 0);
      case 'surface':
      default:
        return out.copy(this._camTgt);
    }
  }

  /* ---------------- تحديث الإطار ---------------- */
  update(dt, force = false) {
    if (this.playing || force) {
      this.time = (this.time + dt * this.speed) % DURATION;
      if (this.time < 0) this.time += DURATION;
    }
    const t = this.time;

    /* الكاميرا */
    const cam = this._sampleCamera(t);
    this.parallax.x += (this.pointer.x - this.parallax.x) * Math.min(1, dt * 2.2);
    this.parallax.y += (this.pointer.y - this.parallax.y) * Math.min(1, dt * 2.2);
    const breathe = Math.sin(t * 0.73) * 0.045 + Math.sin(t * 1.9) * 0.015;

    this.camera.position.set(
      this._camPos.x + this.parallax.x * 0.55 + breathe,
      this._camPos.y + this.parallax.y * -0.3 + breathe * 0.6,
      this._camPos.z + Math.cos(t * 0.51) * 0.05
    );
    this.camera.lookAt(this._camTgt);
    // قفل زاوية الرؤية الأفقية: الشاشات الضيقة ترى نفس العرض بدل قصّ الكيبورد
    const REF_ASPECT = 1.72;
    const aspect = this.camera.aspect || REF_ASPECT;
    let fov = cam.fov;
    if (aspect < REF_ASPECT) {
      const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * (REF_ASPECT / aspect);
      fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.atan(halfH) * 2), 10, 78);
    }
    if (Math.abs(this.camera.fov - fov) > 0.001) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    /* التفكيك وإعادة التجميع */
    let p = 0;
    if (t >= EXPLODE.start && t < EXPLODE.open) p = range(t, EXPLODE.start, EXPLODE.open);
    else if (t >= EXPLODE.open && t < EXPLODE.hold) p = 1;
    else if (t >= EXPLODE.hold && t < EXPLODE.close) p = 1 - range(t, EXPLODE.hold, EXPLODE.close);

    const visible = p > 0.0005;
    const cap = this.kb.hero;
    const capRise = this.capPart.rise;
    cap.position.y = cap.userData.baseY + capRise * p;
    cap.rotation.z = Math.sin(p * Math.PI) * 0.045;
    cap.rotation.y = p * 0.09;

    this.partList.forEach((part, idx) => {
      const m = part.mesh;
      m.visible = visible;
      if (!visible) return;
      const d = part.delay;
      const pp = smoother((p - d) / (1 - d));
      m.position.y = m.userData.baseY + part.rise * pp;
      m.rotation.y = pp * (0.12 + idx * 0.035);
      m.scale.setScalar(0.985 + 0.015 * pp);
    });

    /* خيوط الضوء بين القطع */
    const order = [cap, ...this.partList.map((p2) => p2.mesh)];
    const streakAlpha = Math.pow(p, 1.35);
    this.streaks.items.forEach((s, i) => {
      if (!visible || streakAlpha < 0.01) {
        s.visible = false;
        return;
      }
      order[i].getWorldPosition(this._tmpA);
      order[i + 1].getWorldPosition(this._tmpB);
      aimStreak(s, this._tmpB, this._tmpA, streakAlpha, t);
    });

    /* نبضة الضوء عند إعادة التجميع */
    const pulseP = range(t, PULSE.at, PULSE.at + PULSE.length);
    const pulseActive = t >= PULSE.at && t <= PULSE.at + PULSE.length;
    this.pulse.visible = pulseActive;
    if (pulseActive) {
      this.pulse.material.uniforms.uProgress.value = pulseP;
      this.pulseLight.intensity = Math.sin(pulseP * Math.PI) * 55;
      this.kb.glow.material.opacity = 0.8 + Math.sin(pulseP * Math.PI) * 0.2;
    } else {
      this.pulseLight.intensity = 0;
      this.kb.glow.material.opacity = 0.7 + Math.sin(t * 1.4) * 0.12;
    }

    /* إضاءة مشهد التفكيك */
    const lit = Math.pow(p, 0.65);
    this.stackKey.intensity = 30 * lit;
    this.stackFill.intensity = 16 * lit;
    this.stackRim.intensity = 40 * lit;

    /* ضوء ماكرو يتحرك مع الكاميرا في البداية */
    const macroOn = 1 - range(t, 6.5, 9);
    this.macroLight.intensity = 2.4 * macroOn;
    this.macroLight.position.set(
      this._camTgt.x - 2.6,
      4.2,
      this._camTgt.z + 3.6
    );

    /* عمق الميدان: تغيير بؤرة حقيقي */
    if (this.bokeh) {
      this._focusTarget(cam.focusA, this._tmpA);
      this._focusTarget(cam.focusB, this._tmpB);
      this._focusPoint.lerpVectors(this._tmpA, this._tmpB, cam.focusMix);
      const dist = this.camera.position.distanceTo(this._focusPoint);
      const u = this.bokeh.uniforms;
      u.focus.value += (dist - u.focus.value) * Math.min(1, dt * 3.4);
      u.aperture.value = cam.aperture;
      u.maxblur.value = cam.maxblur;
    }

    /* الغبار */
    this.dust.material.uniforms.uTime.value = t;

    /* تلاشي سينمائي عند بداية ونهاية الدورة */
    const fade = Math.min(range(t, 0, 0.5), 1 - range(t, DURATION - 0.55, DURATION));
    this.renderer.toneMappingExposure = 0.95 * (0.04 + 0.96 * fade);

    this.onTime(t, DURATION);
  }

  _loop() {
    const clock = new THREE.Clock();
    const tick = () => {
      if (this._disposed) return;
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (this._hidden || this._contextLost) return;
      if (this._offscreen && !this.recording) return;
      this.update(dt);
      this.composer.render();
    };
    this._raf = requestAnimationFrame(tick);
  }

  /* ---------------- تحكّم ---------------- */
  play() {
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  toggle() {
    this.playing = !this.playing;
    return this.playing;
  }
  seek(t) {
    this.time = clamp(t, 0, DURATION - 0.001);
    this.update(0, false);
  }

  /* ---------------- تسجيل فيديو WebM من الكانفس ---------------- */
  startRecording(onProgress, onDone) {
    if (this.recording || typeof MediaRecorder === 'undefined') return false;
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) return false;

    const stream = this.canvas.captureStream(30);
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kawkap-keyboard-cinematic.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      this.recording = false;
      clearInterval(this._recTimer);
      onDone && onDone();
    };

    this.recording = true;
    this.playing = true;
    this.time = 0;
    rec.start(250);
    const t0 = performance.now();
    this._recTimer = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      onProgress && onProgress(Math.min(1, el / DURATION));
      if (el >= DURATION + 0.25) rec.stop();
    }, 200);
    return true;
  }

  dispose() {
    this._disposed = true;
    cancelAnimationFrame(this._raf);
    clearInterval(this._recTimer);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._onPointer);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._ro && this._ro.disconnect();
    this._io && this._io.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
          m.dispose();
        });
      }
    });
    this.envRT && this.envRT.dispose();
    this.composer && this.composer.dispose && this.composer.dispose();
    this.renderer.dispose();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
