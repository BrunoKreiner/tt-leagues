import * as THREE from 'three';

// Cached at module scope so every BallLoader / SpinningBall instance reuses
// the same heavy 2048x1024 canvas + texture (~5–10ms one-time build cost).
let cachedTexture = null;

export function getBallTexture() {
  if (cachedTexture) return cachedTexture;

  const W = 2048;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Off-white base — pure white at top, warm cream at bottom
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(1, '#f4ebd9');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Faint equator seam
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, H * 0.5 - 1, W, 2);
  ctx.globalAlpha = 1;

  // Lockup: paired-dot icon + leagues.lol wordmark
  const drawLockup = (cx, cy, scale) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    const iconSize = 130;
    const iconX = -340;
    const iconY = 0;

    ctx.fillStyle = '#ff5a1f';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(iconX + 48, iconY, iconSize * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbf7ee';
    ctx.beginPath();
    ctx.arc(iconX - 18, iconY, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 180px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    const tx = iconX + 120;
    const ty = iconY;
    ctx.fillStyle = '#fbf7ee';
    ctx.strokeStyle = '#000';
    const t1 = 'leagues';
    ctx.strokeText(t1, tx, ty);
    ctx.fillText(t1, tx, ty);
    const w1 = ctx.measureText(t1).width;
    ctx.fillStyle = '#ff5a1f';
    const t2 = '.lol';
    ctx.strokeText(t2, tx + w1, ty);
    ctx.fillText(t2, tx + w1, ty);
    ctx.restore();
  };
  drawLockup(W * 0.5, H * 0.5, 0.85);

  // Subtle dimple noise
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#3a2d18';
  for (let i = 0; i < 2200; i += 1) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.6 + 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cachedTexture = t;
  return t;
}
