// 3D reveal: the picked dish drops into a steaming ceramic bowl. Drag to spin. Lazy-loads three.js.
import { sfx } from './sketch.js';
import { media } from './modes.js';

let THREE;
const canWebGL = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };

function softDot(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, color); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function emojiTex(d) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4e3c4'; g.fillRect(0, 0, 256, 256);
  g.font = '160px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(d.emoji || '🍽️', 128, 140);
  return new THREE.CanvasTexture(c);
}

export async function bowlDrop(d) {
  if (!canWebGL()) return;
  THREE = THREE || (await import('../vendor/three.module.min.js'));
  const W = innerWidth, H = innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cv = renderer.domElement;
  cv.className = 'bowl3d';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  cam.position.set(0, 4.4, 8.6);
  cam.lookAt(0, 0.3, 0);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6b5a48, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const bowl = new THREE.Group();
  scene.add(bowl);
  const prof = [[0, -1], [0.7, -1], [0.78, -1.08], [1.12, -0.96], [1.58, -0.3], [1.88, 0.45], [1.8, 0.47], [1.5, -0.24], [1.02, -0.8], [0, -0.86]].map(([x, y]) => new THREE.Vector2(x, y));
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xfbf7ef, roughness: 0.3, metalness: 0, side: THREE.DoubleSide });
  bowl.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 72), ceramic));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.84, 0.045, 12, 96), new THREE.MeshStandardMaterial({ color: 0xcc2018, roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.46;
  bowl.add(rim);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.03, 8, 96), new THREE.MeshStandardMaterial({ color: 0x2c4fb0, roughness: 0.5 }));
  band.rotation.x = Math.PI / 2; band.position.y = -0.45; band.scale.set(1.03, 1.03, 1);
  bowl.add(band);
  const broth = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), new THREE.MeshStandardMaterial({ color: 0xc98a3a, roughness: 0.15, transparent: true, opacity: 0.92 }));
  broth.rotation.x = -Math.PI / 2; broth.position.y = -0.05;
  bowl.add(broth);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: i % 3 ? 0x4d9a3a : 0xd94a2a }));
    const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.45;
    leaf.position.set(Math.cos(a) * r, -0.02, Math.sin(a) * r); leaf.scale.y = 0.35;
    bowl.add(leaf);
  }

  const tex = media.has.has(d.id)
    ? await new THREE.TextureLoader().loadAsync(`img/dishes/${d.id}.webp`).catch(() => emojiTex(d))
    : emojiTex(d);
  tex.colorSpace = THREE.SRGBColorSpace;
  const side = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 64), [side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), side]);
  disc.position.set(0, 5, 0);
  scene.add(disc);

  const steamTex = softDot('rgba(255,255,255,.8)');
  const steam = Array.from({ length: 8 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false }));
    s.userData = { off: i / 8, x: (Math.random() - 0.5) * 1.6 };
    scene.add(s);
    return s;
  });
  const brothTex = softDot('rgba(201,138,58,1)');
  const drops = Array.from({ length: 18 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: brothTex, transparent: true, opacity: 0 }));
    s.scale.setScalar(0.22);
    scene.add(s);
    return s;
  });

  // drag to spin
  let spin = 0.6, dragX = null;
  const down = (e) => (dragX = e.clientX);
  const move = (e) => { if (dragX != null) { spin += (e.clientX - dragX) * 0.0006; bowl.rotation.y += (e.clientX - dragX) * 0.01; dragX = e.clientX; } };
  const up = () => (dragX = null);
  cv.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);

  const T0 = performance.now(), FALL = 700, TOTAL = 2400;
  let landed = false;
  await new Promise((resolve) => {
    const frame = (t) => {
      const k = t - T0, dt = 1 / 60;
      bowl.rotation.y += spin * dt;
      // falling disc
      if (k < FALL) {
        const p = k / FALL;
        disc.position.y = 5 - 4.95 * p * p;
        disc.rotation.y = p * 6;
        disc.rotation.x = (1 - p) * 1.1;
      } else {
        if (!landed) {
          landed = true; sfx.drop();
          drops.forEach((s) => { const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random(); s.userData = { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 2 + Math.random() * 2 }; s.position.set(0, 0.1, 0); s.material.opacity = 1; });
        }
        const b = Math.min(1, (k - FALL) / 450);
        disc.position.y = 0.05 + Math.sin(b * Math.PI) * 0.12 * (1 - b);
        disc.rotation.x = 0;
        disc.rotation.y += spin * dt;
        bowl.scale.y = 1 - Math.sin(b * Math.PI) * 0.08 * (1 - b);
        drops.forEach((s) => {
          const u = s.userData;
          u.vy -= 9 * dt;
          s.position.x += u.vx * dt; s.position.z += u.vz * dt; s.position.y += u.vy * dt;
          s.material.opacity = Math.max(0, s.material.opacity - dt * 0.9);
        });
      }
      steam.forEach((s) => {
        const p = ((k / 1600) + s.userData.off) % 1;
        s.position.set(s.userData.x + Math.sin(p * 6 + s.userData.off * 9) * 0.2, 0.3 + p * 2.6, 0);
        s.scale.setScalar(0.6 + p * 1.4);
        s.material.opacity = Math.sin(p * Math.PI) * 0.55;
      });
      cv.style.opacity = k > TOTAL - 350 ? String(Math.max(0, (TOTAL - k) / 350)) : '1';
      renderer.render(scene, cam);
      if (k < TOTAL) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
  cv.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
  scene.traverse((o) => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
  renderer.dispose();
  cv.remove();
}
