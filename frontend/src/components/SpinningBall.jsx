import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getBallTexture } from './ballTexture';

/**
 * Interactive ping-pong ball — Three.js sphere with the leagues.lol mark
 * baked into the texture, drag/flick physics, orbital ink streaks,
 * crack-on-double-tap and shatter, plus a vertical power meter and a
 * compact stats panel (RPM / Combo / Best).
 *
 * Shatter physics differ from the original prototype: shards and splatter
 * dots travel in CIRCULAR arcs around the ball (not ballistic + gravity),
 * with angular velocity matching the ball's current spin direction. This
 * gives the burst a unified "everything is spinning off the ball" feel.
 */
export default function SpinningBall() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const inkSvgRef = useRef(null);
  const meterFillRef = useRef(null);
  const sweetZoneRef = useRef(null);
  const rpmTextRef = useRef(null);
  const comboTextRef = useRef(null);
  const comboSubRef = useRef(null);
  const bestTextRef = useRef(null);
  const flashRef = useRef(null);
  const flashWordRef = useRef(null);
  const shadowRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const inkSvg = inkSvgRef.current;
    if (!wrap || !canvas || !inkSvg) return undefined;

    // ===== Three.js scene =====
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const tex = getBallTexture();
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 8;
    const geo = new THREE.SphereGeometry(1, 128, 96);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
    const ball = new THREE.Mesh(geo, mat);
    scene.add(ball);

    const crackGroup = new THREE.Group();
    scene.add(crackGroup);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-2.5, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8a55, 0.6);
    rim.position.set(3, -1, -2);
    scene.add(rim);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    fillLight.position.set(2, -2, 3);
    scene.add(fillLight);

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ===== Spin / combo state =====
    const state = {
      velocity: 0,
      velX: 0,
      combo: 1.0,
      lastFlickAt: 0,
      bestRpm: 0,
      cracked: false,
      crackStage: 0,
      ink: [],
      lastInkAt: 0,
      flashShown1200: false,
      flashShownSmash: false,
      hintHidden: false,
      boostUntil: 0,
    };
    // Game: a fixed "sweet zone" band high on the meter. The spin decays
    // toward zero quickly; the player has to time their flick to catch the
    // power level inside the band on the way down for an infinite-spin boost.
    const SWEET_ZONE_CENTER = 65;
    const SWEET_ZONE_HALF = 6; // ±6% band
    const BOOST_DURATION = 2000; // ms of friction-free spin per perfect
    // Faster decay so the spin passes through the sweet zone quickly,
    // forcing the player to time their flicks on the way down.
    const FRICTION_LOW = 0.965; // near-zero — let the ball linger so it doesn't snap to rest
    const FRICTION_MID = 0.94;
    const FRICTION_HIGH = 0.93; // high-speed decay is the most aggressive
    const MAX_V = 2400; // used only for meter scaling — velocity itself is unbounded
    const COMBO_WINDOW = 600;
    const COMBO_STEP = 0.25;
    const COMBO_MAX = 6.0;
    let comboDecayTimer = null;

    const rpmFromVel = (v) => Math.round((Math.abs(v) / 360) * 60);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const updateComboUI = () => {
      if (comboTextRef.current) comboTextRef.current.textContent = 'x' + state.combo.toFixed(1);
      if (comboSubRef.current) {
        if (state.combo >= 4) comboSubRef.current.textContent = 'INSANE — keep flicking';
        else if (state.combo >= 2.5) comboSubRef.current.textContent = 'hot streak';
        else if (state.combo > 1) comboSubRef.current.textContent = 'chain it!';
        else comboSubRef.current.textContent = 'flick within 600ms';
      }
    };
    const bumpCombo = () => {
      const now = performance.now();
      if (now - state.lastFlickAt < COMBO_WINDOW) {
        state.combo = Math.min(COMBO_MAX, state.combo + COMBO_STEP);
      } else {
        state.combo = 1.0;
      }
      state.lastFlickAt = now;
      updateComboUI();
      clearTimeout(comboDecayTimer);
      comboDecayTimer = setTimeout(() => {
        state.combo = 1.0;
        updateComboUI();
      }, COMBO_WINDOW + 50);
    };

    const showFlash = (word) => {
      const flash = flashRef.current;
      const flashWord = flashWordRef.current;
      if (!flash || !flashWord) return;
      flashWord.textContent = word;
      flash.classList.remove('go');
      // force reflow to restart animation
      void flash.offsetWidth;
      flash.classList.add('go');
    };

    // ===== Inky orbital streaks — thinner, jaggier, more varied =====
    const spawnInk = (speed) => {
      const speedFactor = Math.min(1.4, speed / 1600);
      const ballR = 36;
      const burstAngle = Math.random() * Math.PI * 2;
      const burstSize = 4 + Math.floor(Math.random() * 5);

      const pickRadius = () => {
        // Strongly varied distance — some hug the ball, some fling far out
        const roll = Math.random();
        if (roll < 0.35) return ballR + 1 + Math.random() * 6; // tight hug
        if (roll < 0.75) return ballR + 8 + Math.random() * 22; // mid orbit
        return ballR + 30 + Math.random() * 40; // outer fling
      };

      for (let k = 0; k < burstSize; k += 1) {
        const jitter = (Math.random() - 0.5) * 0.7;
        const r = pickRadius();
        const kindRoll = Math.random();
        const baseColor = Math.random() < 0.12 ? '#ffffff' : '#000000';

        if (kindRoll < 0.72) {
          // smooth arc — the bread-and-butter circular streak
          state.ink.push({
            kind: 'arc',
            a: burstAngle + jitter,
            r,
            arcLen: 0.12 + speedFactor * 0.4 + Math.random() * 0.18,
            thick: 0.6 + Math.random() * 1.6,
            born: performance.now(),
            life: 320 + Math.random() * 260,
            color: baseColor,
          });
        } else if (kindRoll < 0.92) {
          // tangential tapered streak — sumi-e brush mark pointing along the
          // direction the ball surface is moving (parallel to ball edge)
          const len = 6 + Math.random() * 16 + speedFactor * 6;
          state.ink.push({
            kind: 'streak',
            a: burstAngle + jitter,
            r,
            len,
            thick: 0.5 + Math.random() * 1.6,
            born: performance.now(),
            life: 240 + Math.random() * 200,
            color: baseColor,
          });
        } else {
          // ink splat — small irregular polygon
          const sides = 5 + Math.floor(Math.random() * 5);
          const blotR = 0.7 + Math.random() * 2.6;
          const splatPts = [];
          for (let j = 0; j < sides; j += 1) {
            const ang = (j / sides) * Math.PI * 2 + Math.random() * 0.4;
            const radius = blotR * (0.55 + Math.random() * 0.7);
            splatPts.push({
              x: Math.cos(ang) * radius,
              y: Math.sin(ang) * radius,
            });
          }
          state.ink.push({
            kind: 'splat',
            a: burstAngle + jitter,
            r,
            points: splatPts,
            born: performance.now(),
            life: 260 + Math.random() * 200,
            color: baseColor,
          });
        }
      }

      // tiny dot droplets — sparser, smaller
      if (Math.random() < 0.45) {
        const dotCount = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < dotCount; k += 1) {
          state.ink.push({
            kind: 'dot',
            a: Math.random() * Math.PI * 2,
            r: pickRadius(),
            size: 0.5 + Math.random() * 1.4,
            born: performance.now(),
            life: 260 + Math.random() * 200,
            color: '#000000',
          });
        }
      }

      if (state.ink.length > 220) state.ink.splice(0, state.ink.length - 220);
    };

    const drawInk = (now, vel) => {
      let s = '';
      const dir = Math.sign(vel) || 1;
      for (let i = state.ink.length - 1; i >= 0; i -= 1) {
        const m = state.ink[i];
        const t = (now - m.born) / m.life;
        if (t >= 1) {
          state.ink.splice(i, 1);
          continue;
        }
        const op = 1 - t;

        if (m.kind === 'arc') {
          const sweep = dir * (1 - t) * 0.85;
          const a0 = m.a + sweep;
          const a1 = a0 + dir * m.arcLen * (1 - t * 0.25);
          const r = m.r + t * 4;
          const x0 = Math.cos(a0) * r;
          const y0 = Math.sin(a0) * r;
          const x1 = Math.cos(a1) * r;
          const y1 = Math.sin(a1) * r;
          const sweepFlag = dir > 0 ? 1 : 0;
          s += `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweepFlag} ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${m.color}" stroke-width="${m.thick.toFixed(2)}" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;
        } else if (m.kind === 'streak') {
          // Tangential tapered triangle — pointed in the direction of spin
          const sweep = dir * (1 - t) * 0.85;
          const a = m.a + sweep;
          const r = m.r + t * 4;
          const cx = Math.cos(a) * r;
          const cy = Math.sin(a) * r;
          // Tangent direction at this point (perpendicular to radial), pointing along spin
          const tx = -Math.sin(a) * dir;
          const ty = Math.cos(a) * dir;
          // Perpendicular to tangent (radial)
          const px = -ty * dir;
          const py = tx * dir;
          const halfBase = m.thick * 1.2;
          const tipLen = m.len * (1 - t * 0.3);
          // Triangle: wide at the trailing end, pointed at the leading end
          const ax = cx - tx * tipLen * 0.45 + px * halfBase;
          const ay = cy - ty * tipLen * 0.45 + py * halfBase;
          const bx = cx - tx * tipLen * 0.45 - px * halfBase;
          const by = cy - ty * tipLen * 0.45 - py * halfBase;
          const cxTip = cx + tx * tipLen * 0.55;
          const cyTip = cy + ty * tipLen * 0.55;
          s += `<polygon points="${ax.toFixed(2)},${ay.toFixed(2)} ${bx.toFixed(2)},${by.toFixed(2)} ${cxTip.toFixed(2)},${cyTip.toFixed(2)}" fill="${m.color}" opacity="${(op * 0.9).toFixed(2)}"/>`;
        } else if (m.kind === 'splat') {
          const sweep = dir * (1 - t) * 0.55;
          const a = m.a + sweep;
          const r = m.r + t * 5;
          const cx = Math.cos(a) * r;
          const cy = Math.sin(a) * r;
          let pts = '';
          for (let j = 0; j < m.points.length; j += 1) {
            pts += `${(cx + m.points[j].x).toFixed(2)},${(cy + m.points[j].y).toFixed(2)} `;
          }
          s += `<polygon points="${pts.trim()}" fill="${m.color}" opacity="${(op * 0.85).toFixed(2)}"/>`;
        } else if (m.kind === 'dot') {
          const sweep = dir * (1 - t) * 0.6;
          const a = m.a + sweep;
          const r = m.r + t * 6;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          s += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(m.size * (1 - t * 0.4)).toFixed(2)}" fill="${m.color}" opacity="${(op * 0.9).toFixed(2)}"/>`;
        }
      }
      inkSvg.innerHTML = s;
    };

    // ===== Animation loop =====
    let lastT = performance.now();
    let rafId = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const speed = Math.abs(state.velocity);
      const inBoost = now < state.boostUntil;
      const fric = speed < 200 ? FRICTION_LOW : speed < 800 ? FRICTION_MID : FRICTION_HIGH;
      // During the boost window, suspend friction → infinite spin
      if (!inBoost) {
        state.velocity *= Math.pow(fric, dt * 60);
      }
      state.velX *= Math.pow(0.96, dt * 60);
      if (Math.abs(state.velocity) < 1) state.velocity = 0;
      if (Math.abs(state.velX) < 1) state.velX = 0;

      // Toggle visual state: meter glows during boost, sweet zone lights up if you're inside it
      const currentMeterPct = Math.min(100, (speed / MAX_V) * 100);
      const inSweet = Math.abs(currentMeterPct - SWEET_ZONE_CENTER) < SWEET_ZONE_HALF;
      if (meterFillRef.current) {
        meterFillRef.current.classList.toggle('boost', inBoost);
      }
      if (sweetZoneRef.current) {
        sweetZoneRef.current.classList.toggle('active', inSweet);
      }

      ball.rotation.y += (state.velocity * dt * Math.PI) / 180;
      ball.rotation.x += (state.velX * dt * Math.PI) / 180;
      crackGroup.rotation.copy(ball.rotation);

      renderer.render(scene, camera);

      if (shadowRef.current) {
        shadowRef.current.style.transform = `translateX(-50%) scaleX(${1 - Math.min(0.35, speed / 3000)})`;
        shadowRef.current.style.opacity = String(0.85 - Math.min(0.5, speed / 2400));
      }

      const pct = Math.min(100, (speed / MAX_V) * 100);
      if (meterFillRef.current) meterFillRef.current.style.height = pct + '%';
      const cur = rpmFromVel(state.velocity);
      if (rpmTextRef.current) rpmTextRef.current.textContent = cur.toLocaleString();
      if (cur > state.bestRpm) {
        state.bestRpm = cur;
        if (bestTextRef.current) bestTextRef.current.textContent = state.bestRpm.toLocaleString();
      }

      if (cur >= 2400 && !state.flashShownSmash) {
        state.flashShownSmash = true;
        showFlash('SMASH!');
      } else if (cur >= 1200 && !state.flashShown1200) {
        state.flashShown1200 = true;
        showFlash('SPIN!');
      }
      if (cur < 400) {
        state.flashShown1200 = false;
        state.flashShownSmash = false;
      }

      if (speed > 250) {
        const interval = Math.max(20, 200 - speed / 15);
        if (now - state.lastInkAt > interval) {
          state.lastInkAt = now;
          spawnInk(speed);
        }
      }
      drawInk(now, state.velocity);

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // ===== Crack lines on the sphere =====
    const addCrackLines = () => {
      const center = new THREE.Vector3(
        Math.random() * 0.6 - 0.3,
        Math.random() * 0.6 - 0.3,
        1
      )
        .normalize()
        .multiplyScalar(1.005);
      for (let i = 0; i < 6; i += 1) {
        const pts = [center.clone()];
        let cur = center.clone();
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
        for (let j = 0; j < 6; j += 1) {
          const step = 0.09 + Math.random() * 0.08;
          const next = cur.clone().add(dir.clone().multiplyScalar(step));
          next.normalize().multiplyScalar(1.003);
          pts.push(next);
          cur = next;
          dir.x += (Math.random() - 0.5) * 0.6;
          dir.y += (Math.random() - 0.5) * 0.6;
          dir.normalize();
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.TubeGeometry(curve, 24, 0.006, 6, false);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const tubeMesh = new THREE.Mesh(tube, lineMat);
        crackGroup.add(tubeMesh);
      }
    };

    // ===== inkBurst & shatter — orbital flavor =====
    const fxNodes = new Set();
    const trackFx = (el) => {
      fxNodes.add(el);
      return el;
    };
    const removeFx = (el) => {
      fxNodes.delete(el);
      el.remove();
    };

    // Manga-style radial impact burst — sumi-e speed lines fanning outward
    const radialImpactBurst = (cx, cy, ballR) => {
      const size = Math.max(900, ballR * 10);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
      svg.style.cssText = `position:fixed;left:${cx - size / 2}px;top:${cy - size / 2}px;z-index:15;pointer-events:none;overflow:visible;`;
      document.body.appendChild(trackFx(svg));

      const center = size / 2;
      const lines = [];
      const N = 96;
      for (let i = 0; i < N; i += 1) {
        // Even distribution with jitter so it doesn't look mechanical
        const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
        const startR = ballR * (0.95 + Math.random() * 0.18);
        // Skewed length distribution — many short, occasional very long
        const lenRoll = Math.random();
        const length =
          lenRoll < 0.55
            ? 50 + Math.random() * 90
            : lenRoll < 0.85
            ? 110 + Math.random() * 160
            : 240 + Math.random() * 200;
        const thick = 0.5 + Math.random() * 2.2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const x1 = center + cosA * startR;
        const y1 = center + sinA * startR;
        const x2 = center + cosA * (startR + length);
        const y2 = center + sinA * (startR + length);
        const styleRoll = Math.random();
        if (styleRoll < 0.7) {
          // solid line — drawn via stroke-dashoffset
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          el.setAttribute('x1', String(x1));
          el.setAttribute('y1', String(y1));
          el.setAttribute('x2', String(x2));
          el.setAttribute('y2', String(y2));
          const isWhite = Math.random() < 0.04;
          const isAccent = !isWhite && Math.random() < 0.04;
          el.setAttribute('stroke', isAccent ? '#ff5a1f' : isWhite ? '#ffffff' : '#000000');
          el.setAttribute('stroke-width', thick.toFixed(2));
          el.setAttribute('stroke-linecap', 'round');
          el.setAttribute('stroke-dasharray', length.toFixed(1));
          el.setAttribute('stroke-dashoffset', length.toFixed(1));
          el.setAttribute('opacity', '0');
          svg.appendChild(el);
          lines.push({ el, length, delay: Math.random() * 110, kind: 'line' });
        } else {
          // tapered triangular brush mark — wide at the inner end, sharp at the tip
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          const px = -sinA;
          const py = cosA;
          const wideHalf = thick * 1.4;
          const narrowHalf = thick * 0.18;
          const points = [
            `${(x1 + px * wideHalf).toFixed(1)},${(y1 + py * wideHalf).toFixed(1)}`,
            `${(x1 - px * wideHalf).toFixed(1)},${(y1 - py * wideHalf).toFixed(1)}`,
            `${(x2 - px * narrowHalf).toFixed(1)},${(y2 - py * narrowHalf).toFixed(1)}`,
            `${(x2 + px * narrowHalf).toFixed(1)},${(y2 + py * narrowHalf).toFixed(1)}`,
          ].join(' ');
          el.setAttribute('points', points);
          el.setAttribute('fill', Math.random() < 0.06 ? '#ffffff' : '#000000');
          el.setAttribute('opacity', '0');
          // Shrink toward the inner end via transform-origin and scale during draw-in
          el.style.transformBox = 'fill-box';
          el.style.transformOrigin = `${x1.toFixed(1)}px ${y1.toFixed(1)}px`;
          svg.appendChild(el);
          lines.push({ el, length, delay: Math.random() * 110, kind: 'tri' });
        }
      }

      const start = performance.now();
      const lifetime = 720;
      const animLines = () => {
        const elapsed = performance.now() - start;
        let alive = false;
        for (let i = 0; i < lines.length; i += 1) {
          const l = lines[i];
          const t = (elapsed - l.delay) / lifetime;
          if (t < 0) {
            alive = true;
            continue;
          }
          if (t >= 1) {
            l.el.setAttribute('opacity', '0');
            continue;
          }
          alive = true;
          // 0–0.25: draw in; 0.25–0.6: hold; 0.6–1: fade
          const drawT = Math.min(1, t / 0.25);
          const fadeT = Math.max(0, (t - 0.6) / 0.4);
          const op = drawT * (1 - fadeT);
          if (l.kind === 'line') {
            l.el.setAttribute('stroke-dashoffset', (l.length * (1 - drawT)).toFixed(1));
          }
          l.el.setAttribute('opacity', op.toFixed(2));
        }
        if (!alive) {
          removeFx(svg);
          return;
        }
        requestAnimationFrame(animLines);
      };
      requestAnimationFrame(animLines);
    };

    const inkBurst = () => {
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const ballR = rect.width / 2;
      const spinDir = Math.sign(state.velocity) || (Math.random() < 0.5 ? -1 : 1);
      const angVel = (Math.abs(state.velocity) || 200) / 360 * Math.PI * 2 * 0.0008; // rad/ms (gentle)

      // Manga radial speed-line burst — fires first so it reads as the impact frame
      radialImpactBurst(cx, cy, ballR);

      // Concentric arc rings — already parallel to the ball edge
      const ringCount = 5;
      for (let r = 0; r < ringCount; r += 1) {
        const segs = 6 + Math.floor(Math.random() * 4);
        const radius = ballR * (1.05 + r * 0.12);
        const ringDelay = r * 40;
        for (let i = 0; i < segs; i += 1) {
          const a0 = (i / segs) * Math.PI * 2 + Math.random() * 0.2;
          const a1 = a0 + ((Math.PI * 2) / segs) * (0.4 + Math.random() * 0.4);
          const isWhite = Math.random() < 0.18;
          const thick = 3 + Math.random() * 6;
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', String(radius * 2.4));
          svg.setAttribute('height', String(radius * 2.4));
          svg.style.cssText = `position:fixed;left:${cx - radius * 1.2}px;top:${cy - radius * 1.2}px;z-index:14;pointer-events:none;overflow:visible;opacity:0;`;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const x0 = radius * 1.2 + Math.cos(a0) * radius;
          const y0 = radius * 1.2 + Math.sin(a0) * radius;
          const x1 = radius * 1.2 + Math.cos(a1) * radius;
          const y1 = radius * 1.2 + Math.sin(a1) * radius;
          path.setAttribute('d', `M ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1}`);
          path.setAttribute('stroke', isWhite ? '#fff' : '#000');
          path.setAttribute('stroke-width', String(thick));
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('fill', 'none');
          svg.appendChild(path);
          document.body.appendChild(trackFx(svg));
          const start = performance.now() + ringDelay;
          const animRing = () => {
            const elapsed = performance.now() - start;
            if (elapsed < 0) {
              requestAnimationFrame(animRing);
              return;
            }
            const t = elapsed / 520;
            if (t >= 1) {
              removeFx(svg);
              return;
            }
            const e = 1 - Math.pow(1 - t, 2);
            svg.style.transform = `scale(${1 + e * 0.5})`;
            svg.style.transformOrigin = `${radius * 1.2}px ${radius * 1.2}px`;
            svg.style.opacity = String(1 - t);
            requestAnimationFrame(animRing);
          };
          requestAnimationFrame(animRing);
        }
      }

      // Splat blobs — stay near impact center, no motion (random shape only)
      for (let i = 0; i < 7; i += 1) {
        const el = document.createElement('div');
        const isWhite = i % 3 === 0;
        const sz = 60 + Math.random() * 100;
        const ox = (Math.random() - 0.5) * 40;
        const oy = (Math.random() - 0.5) * 40;
        el.style.cssText = `position:fixed;left:${cx - sz / 2 + ox}px;top:${cy - sz / 2 + oy}px;width:${sz}px;height:${sz}px;background:${isWhite ? '#fff' : '#000'};border-radius:${30 + Math.random() * 40}% ${30 + Math.random() * 40}% ${30 + Math.random() * 40}% ${30 + Math.random() * 40}%;z-index:13;pointer-events:none;opacity:0.8;`;
        document.body.appendChild(trackFx(el));
        const start = performance.now();
        const animBlob = () => {
          const t = (performance.now() - start) / 600;
          if (t >= 1) {
            removeFx(el);
            return;
          }
          el.style.transform = `scale(${1 + t * 1.4}) rotate(${t * 30}deg)`;
          el.style.opacity = String(0.8 * (1 - t));
          requestAnimationFrame(animBlob);
        };
        requestAnimationFrame(animBlob);
      }

      // Splatter dots — ORBITAL: spiral outward in the spin direction
      for (let i = 0; i < 22; i += 1) {
        const el = document.createElement('div');
        const sz = 4 + Math.random() * 9;
        el.style.cssText = `position:fixed;left:${cx - sz / 2}px;top:${cy - sz / 2}px;width:${sz}px;height:${sz}px;background:#000;border-radius:50%;z-index:14;pointer-events:none;`;
        document.body.appendChild(trackFx(el));
        const initAngle = Math.random() * Math.PI * 2;
        const startRadius = ballR * (1 + Math.random() * 0.05);
        const radialSpeed = 60 + Math.random() * 140; // px/s outward
        const angSpeed = spinDir * (Math.PI * (0.6 + Math.random() * 0.9)) + angVel * 1000;
        const start = performance.now();
        const animDot = () => {
          const elapsed = (performance.now() - start) / 1000; // s
          const t = elapsed / 0.7;
          if (t >= 1) {
            removeFx(el);
            return;
          }
          const a = initAngle + angSpeed * elapsed;
          const r = startRadius + radialSpeed * elapsed;
          const x = Math.cos(a) * r - Math.cos(initAngle) * startRadius;
          const y = Math.sin(a) * r - Math.sin(initAngle) * startRadius;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.style.opacity = String(1 - t);
          requestAnimationFrame(animDot);
        };
        requestAnimationFrame(animDot);
      }

      // Two clean shockwave rings — concentric, expanding outward (kept)
      for (let i = 0; i < 2; i += 1) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:20px;height:20px;border:${3 - i}px solid ${i === 0 ? '#000' : '#fff'};border-radius:50%;transform:translate(-50%,-50%) scale(1);z-index:13;pointer-events:none;`;
        document.body.appendChild(trackFx(el));
        const start = performance.now() + i * 80;
        const animShock = () => {
          const elapsed = performance.now() - start;
          if (elapsed < 0) {
            requestAnimationFrame(animShock);
            return;
          }
          const t = elapsed / 550;
          if (t >= 1) {
            removeFx(el);
            return;
          }
          el.style.transform = `translate(-50%,-50%) scale(${1 + t * 22})`;
          el.style.opacity = String(1 - t);
          requestAnimationFrame(animShock);
        };
        requestAnimationFrame(animShock);
      }
    };

    const shatter = () => {
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const ballR = rect.width / 2;
      const spinDir = Math.sign(state.velocity) || (Math.random() < 0.5 ? -1 : 1);

      // Shards — ORBITAL: trace circular arcs around the ball, drifting outward
      const N = 22;
      for (let i = 0; i < N; i += 1) {
        const s = document.createElement('div');
        s.className = 'shard';
        const sz = 20 + Math.random() * 42;
        s.style.width = sz + 'px';
        s.style.height = sz * (0.5 + Math.random() * 0.7) + 'px';
        s.style.left = cx - sz / 2 + 'px';
        s.style.top = cy - sz / 2 + 'px';
        s.style.position = 'fixed';
        s.style.zIndex = '12';
        s.style.borderRadius =
          Math.random() * 40 + '% ' + Math.random() * 40 + '% ' + Math.random() * 40 + '% ' + Math.random() * 40 + '%';
        document.body.appendChild(trackFx(s));

        const initAngle = Math.random() * Math.PI * 2;
        const startRadius = ballR * (0.9 + Math.random() * 0.15);
        const radialSpeed = 110 + Math.random() * 180; // px/s outward
        const angSpeed = spinDir * (Math.PI * (0.5 + Math.random() * 1.1)); // rad/s
        const ownRot = (Math.random() - 0.5) * 720; // deg/s self-rotation
        const start = performance.now();
        const fall = () => {
          const elapsed = (performance.now() - start) / 1000;
          const t = elapsed / 1.4;
          if (t >= 1) {
            removeFx(s);
            return;
          }
          const a = initAngle + angSpeed * elapsed;
          const r = startRadius + radialSpeed * elapsed;
          const x = Math.cos(a) * r - Math.cos(initAngle) * startRadius;
          const y = Math.sin(a) * r - Math.sin(initAngle) * startRadius;
          const rotDeg = ownRot * elapsed;
          s.style.transform = `translate(${x}px, ${y}px) rotate(${rotDeg}deg)`;
          s.style.opacity = String(Math.max(0, 1 - t * 0.85));
          requestAnimationFrame(fall);
        };
        requestAnimationFrame(fall);
      }

      // Hide the canvas (the ball is "gone")
      canvas.style.transition = 'opacity .25s, transform .25s';
      canvas.style.opacity = '0';
      canvas.style.transform = 'scale(0.92)';
      if (shadowRef.current) shadowRef.current.style.opacity = '0';
      state.velocity = 0;
      state.velX = 0;
    };

    const doCrack = () => {
      if (state.crackStage === 0) {
        state.crackStage = 1;
        state.cracked = true;
        addCrackLines();
        inkBurst();
        state.velocity *= 0.35;
        showFlash('CRACK!');
      } else if (state.crackStage === 1) {
        state.crackStage = 2;
        shatter();
      }
    };

    const reset = () => {
      // remove tracked FX nodes
      fxNodes.forEach((n) => n.remove());
      fxNodes.clear();
      while (crackGroup.children.length) {
        const m = crackGroup.children.pop();
        m.geometry?.dispose();
        m.material?.dispose();
      }
      state.crackStage = 0;
      state.cracked = false;
      canvas.style.opacity = '';
      canvas.style.transition = '';
      canvas.style.transform = '';
      ball.rotation.set(0, 0, 0);
      state.velocity = 0;
      state.velX = 0;
      state.combo = 1;
      updateComboUI();
      state.bestRpm = 0;
      if (bestTextRef.current) bestTextRef.current.textContent = '0';
      state.flashShown1200 = false;
      state.flashShownSmash = false;
      if (shadowRef.current) shadowRef.current.style.opacity = '';
    };

    // ===== Pointer / wheel / keyboard handlers =====
    let dragging = false;
    let samples = [];
    let lastTapTime = 0;

    const onPointerDown = (e) => {
      if (state.cracked && state.crackStage >= 2) return;
      dragging = true;
      wrap.setPointerCapture?.(e.pointerId);
      samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      state.velocity *= 0.5;
      state.velX *= 0.5;
      const now = performance.now();
      if (now - lastTapTime < 320) doCrack();
      lastTapTime = now;
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (samples.length > 6) samples.shift();
      const last = samples[samples.length - 2];
      const cur = samples[samples.length - 1];
      if (last) {
        ball.rotation.y += (cur.x - last.x) * 0.005;
        ball.rotation.x += (cur.y - last.y) * 0.005;
      }
    };
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      if (samples.length >= 2) {
        const a = samples[0];
        const b = samples[samples.length - 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dt = Math.max(16, b.t - a.t);
        const pxX = dx / (dt / 1000);
        const pxY = dy / (dt / 1000);
        if (Math.abs(pxX) >= 250 || Math.abs(pxY) >= 250) {
          const sign = Math.sign(pxX) || 1;
          const mag = Math.pow(Math.abs(pxX) / 300, 1.4);
          const add = sign * mag * 220 * state.combo;
          // Perfect-timing check: was the meter inside the sweet zone at the moment of flick?
          const preFlickPct = Math.min(100, (Math.abs(state.velocity) / MAX_V) * 100);
          const inSweet = Math.abs(preFlickPct - SWEET_ZONE_CENTER) < SWEET_ZONE_HALF;
          if (inSweet) {
            // Uncapped boost — chained perfects can drive velocity past MAX_V indefinitely
            state.velocity += add * 1.6;
            state.boostUntil = performance.now() + BOOST_DURATION;
            showFlash('PERFECT!');
          } else {
            state.velocity += add;
          }
          state.velX = clamp(state.velX + (pxY / 300) * 60 * state.combo, -300, 300);
          bumpCombo();
        }
      }
      samples = [];
    };
    const applyFlickAdd = (add) => {
      const preFlickPct = Math.min(100, (Math.abs(state.velocity) / MAX_V) * 100);
      const inSweet = Math.abs(preFlickPct - SWEET_ZONE_CENTER) < SWEET_ZONE_HALF;
      if (inSweet) {
        state.velocity += add * 1.6;
        state.boostUntil = performance.now() + BOOST_DURATION;
        showFlash('PERFECT!');
      } else {
        state.velocity += add;
      }
    };
    const onWheel = (e) => {
      // Only react when pointer is hovering the ball area; otherwise allow page scroll.
      const r = wrap.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      const d = e.deltaY + e.deltaX;
      if (Math.abs(d) < 8) return;
      e.preventDefault();
      applyFlickAdd(d * 0.6 * state.combo);
      bumpCombo();
    };
    const onKeyDown = (e) => {
      // Only handle if the user has interacted with the ball recently
      if (e.key === 'r' || e.key === 'R') reset();
      if (e.key === 'c' || e.key === 'C') doCrack();
    };

    wrap.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());

    updateComboUI();

    // ===== Cleanup =====
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      wrap.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(comboDecayTimer);
      fxNodes.forEach((n) => n.remove());
      fxNodes.clear();
      while (crackGroup.children.length) {
        const m = crackGroup.children.pop();
        m.geometry?.dispose();
        m.material?.dispose();
      }
      // Texture is module-cached and shared with BallLoader instances —
      // do not dispose it here.
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="spinning-ball-root" style={{ position: 'relative', width: '100%' }}>
      {/* Ball + side-stack (meter + RPM) — top-aligned in a flex row */}
      <div
        className="ball-and-side"
        style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}
      >
        <div
          ref={wrapRef}
          className="spinning-ball-wrap"
          style={{
            position: 'relative',
            flex: 1,
            aspectRatio: '1 / 1',
            touchAction: 'none',
            userSelect: 'none',
            cursor: 'grab',
          }}
        >
          <div
            ref={shadowRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '-10%',
              width: '80%',
              height: '14%',
              transform: 'translateX(-50%)',
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.6), rgba(0,0,0,0) 70%)',
              filter: 'blur(8px)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
          <svg
            ref={inkSvgRef}
            aria-hidden="true"
            viewBox="-100 -100 200 200"
            style={{
              position: 'absolute',
              inset: '-15%',
              width: '130%',
              height: '130%',
              display: 'block',
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'block',
              zIndex: 3,
            }}
          />
        </div>

        {/* Side-stack — meter at top (top-aligned with ball), RPM below */}
        <div
          className="side-stack"
          style={{
            width: 92,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
          }}
        >
          <div
            aria-hidden="true"
            className="spin-meter"
            style={{
              width: 12,
              flex: 1,
              minHeight: 0,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 999,
              position: 'relative',
              overflow: 'visible',
            }}
          >
            {/* Moving "sweet zone" target — flick when your fill is inside it for an infinite-spin boost */}
            <div
              ref={sweetZoneRef}
              className="spin-sweet-zone"
              style={{
                position: 'absolute',
                left: -4,
                right: -4,
                height: '12%',
                bottom: '59%',
                borderRadius: 6,
                pointerEvents: 'none',
                background:
                  'linear-gradient(to top, rgba(255,255,255,0.06), rgba(255,255,255,0.22), rgba(255,255,255,0.06))',
                border: '1px solid rgba(255,255,255,0.18)',
                transition: 'background .18s ease, border-color .18s ease, box-shadow .18s ease',
                zIndex: 1,
              }}
            />
            <div
              ref={meterFillRef}
              className="spin-meter-fill"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '0%',
                background: 'linear-gradient(to top, var(--accent), var(--accent-2))',
                transition: 'height .12s linear',
                borderRadius: 999,
                zIndex: 2,
              }}
            />
          </div>

          <div className="spin-rpm-stat" style={{ textAlign: 'center', width: '100%' }}>
            <div className="eyebrow" style={{ fontSize: 9.5, lineHeight: 1.2 }}>
              Spin RPM
            </div>
            <div
              ref={rpmTextRef}
              style={{
                fontFamily: '"Inter Tight", sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(28px, 3.2vw, 38px)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
                color: 'var(--fg)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 6,
              }}
            >
              0
            </div>
          </div>
        </div>
      </div>

      {/* Flash text — appears momentarily over the ball */}
      <div
        ref={flashRef}
        aria-hidden="true"
        className="spin-flash"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 6,
          display: 'grid',
          placeItems: 'center',
          opacity: 0,
        }}
      >
        <div
          ref={flashWordRef}
          style={{
            fontFamily: '"Inter Tight", sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(40px, 9vw, 96px)',
            letterSpacing: '-0.04em',
            WebkitTextStroke: '3px #000',
            color: 'var(--accent)',
            paintOrder: 'stroke fill',
            transform: 'rotate(-6deg)',
          }}
        >
          SPIN!
        </div>
      </div>

      <style>{`
        .spinning-ball-wrap:active { cursor: grabbing; }
        .spin-flash.go { animation: spin-flash-in 0.9s ease forwards; }
        @keyframes spin-flash-in {
          0%   { opacity: 0; transform: scale(0.6) rotate(-12deg); }
          20%  { opacity: 1; transform: scale(1.05) rotate(-6deg); }
          100% { opacity: 0; transform: scale(1.4) rotate(-2deg); }
        }
        .shard {
          background: radial-gradient(circle at 30% 30%, #fff, #e8ddc7 60%, #b9a988);
          border: 2px solid #000;
          will-change: transform, opacity;
        }
        /* Sweet-zone band lights up while the player's power level is inside it */
        .spin-sweet-zone.active {
          background: linear-gradient(to top, rgba(255,255,255,0.18), rgba(255,255,255,0.5), rgba(255,255,255,0.18));
          border-color: rgba(255,255,255,0.55);
          box-shadow: 0 0 8px rgba(255,255,255,0.25);
        }
        /* Boost mode — friction is suspended, meter glows accent-bright */
        .spin-meter-fill.boost {
          background: linear-gradient(to top, var(--accent), #fff);
          box-shadow: 0 0 14px var(--accent), 0 0 28px var(--accent);
          animation: spin-boost-pulse 0.55s ease-in-out infinite alternate;
        }
        @keyframes spin-boost-pulse {
          from { box-shadow: 0 0 8px var(--accent), 0 0 18px var(--accent); }
          to   { box-shadow: 0 0 18px var(--accent), 0 0 36px var(--accent); }
        }
      `}</style>
    </div>
  );
}

function StatBox({ label, valueRef, valueRefSub, sub, accent, subAccent }) {
  return (
    <div
      style={{
        background: 'rgba(20,19,18,0.7)',
        border: '1px solid var(--line-soft)',
        borderRadius: 12,
        padding: '10px 12px',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
        }}
      >
        {label}
      </div>
      <div
        ref={valueRef}
        style={{
          fontFamily: '"Inter Tight", sans-serif',
          fontWeight: 900,
          fontSize: 24,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          marginTop: 4,
          color: accent ? 'var(--accent)' : 'var(--fg)',
        }}
      >
        0
      </div>
      {valueRefSub ? (
        <div
          ref={valueRefSub}
          style={{
            fontSize: 9,
            letterSpacing: '0.16em',
            color: 'var(--fg-3)',
            marginTop: 6,
            textTransform: 'uppercase',
          }}
        >
          flick within 600ms
        </div>
      ) : sub ? (
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.16em',
            color: 'var(--fg-3)',
            marginTop: 6,
            textTransform: 'uppercase',
          }}
        >
          {subAccent ? (
            <>
              target <b style={{ color: 'var(--accent)' }}>2,400+</b>
            </>
          ) : (
            sub
          )}
        </div>
      ) : null}
    </div>
  );
}
