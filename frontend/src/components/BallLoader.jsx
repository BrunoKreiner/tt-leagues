import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getBallTexture } from './ballTexture';

// Lightweight, non-interactive loading variant of the hero SpinningBall:
// the same branded ping-pong ball, auto-rotating with orbital ink streaks
// circling around it. No drag, no meter, no shatter, no HUD.
export default function BallLoader({ size = 64, className = '' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const tex = getBallTexture();
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 8;
    const geo = new THREE.SphereGeometry(1, 64, 48);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
    const ball = new THREE.Mesh(geo, mat);
    scene.add(ball);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-2.5, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8a55, 0.6);
    rim.position.set(3, -1, -2);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(2, -2, 3);
    scene.add(fill);

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spinSpeed = reduceMotion ? 0.6 : 2.4; // rad/s

    let raf = 0;
    let last = performance.now();
    let visible = true;

    const onVis = () => {
      visible = document.visibilityState !== 'hidden';
      if (visible) {
        last = performance.now();
        if (!raf) raf = requestAnimationFrame(tick);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener('visibilitychange', onVis);

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ball.rotation.y += spinSpeed * dt;
      ball.rotation.x = Math.sin(now * 0.0008) * 0.18;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      // Do NOT dispose the cached texture — other instances may still use it.
      renderer.dispose();
    };
  }, []);

  const sz = `${size}px`;
  return (
    <div
      ref={wrapRef}
      className={`ball-loader ${className}`}
      style={{
        position: 'relative',
        width: sz,
        height: sz,
        flexShrink: 0,
      }}
      role="status"
      aria-label="Loading"
    >
      {/* Soft drop shadow under the ball */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '-8%',
          width: '70%',
          height: '12%',
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.45), rgba(0,0,0,0) 70%)',
          filter: 'blur(6px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Orbital ink streaks — same impact-frame language as the hero ball.
          Wrapper rotates via the existing tt-loading-ink-rotate keyframe. */}
      <svg
        aria-hidden="true"
        viewBox="-100 -100 200 200"
        style={{
          position: 'absolute',
          inset: '-15%',
          width: '130%',
          height: '130%',
          pointerEvents: 'none',
          zIndex: 2,
          overflow: 'visible',
        }}
      >
        <g className="tt-loading-ink-spin">
          <path d="M 28 -64 A 70 70 0 0 1 60 -36" />
          <path d="M -62 26 A 67 67 0 0 1 -38 60" strokeOpacity="0.78" />
          <path d="M -72 -22 A 75 75 0 0 1 -50 -56" strokeOpacity="0.6" strokeWidth="2.2" />
          <path d="M 64 32 A 71 71 0 0 1 38 64" strokeOpacity="0.55" strokeWidth="2.4" />
          <circle cx="-18" cy="-78" r="3" fillOpacity="0.78" />
          <circle cx="80" cy="-6" r="2" fillOpacity="0.6" />
          <circle cx="14" cy="84" r="2.4" fillOpacity="0.55" />
        </g>
      </svg>
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
  );
}
