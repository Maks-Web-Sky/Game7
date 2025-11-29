// script.js — Fullscreen shooting gallery with WebAudio sounds, explosion animation, hit/miss counters
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hitsEl = document.getElementById('hits');
const missesEl = document.getElementById('misses');
const restartBtn = document.getElementById('restart');

// images (provided)
const crossImg = new Image(); crossImg.src = 'crosshair.webp';
const laptopImg = new Image(); laptopImg.src = 'laptop.png';

// resize canvas to full window devicePixelRatio-aware
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

// AudioManager using WebAudio for shot and hit sounds
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.enabled = false;
      }
    }
  }
  playShoot() {
    if (!this.enabled) return;
    this.ensure();
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square'; o.frequency.value = 900;
    g.gain.value = 0.12;
    o.connect(g); g.connect(c.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    o.stop(c.currentTime + 0.08);
  }
  playHit() {
    if (!this.enabled) return;
    this.ensure();
    const c = this.ctx;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 520;
    o2.type = 'sine'; o2.frequency.value = 320;
    g.gain.value = 0.16;
    o.connect(g); o2.connect(g); g.connect(c.destination);
    o.start(); o2.start();
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
    o.stop(c.currentTime + 0.22); o2.stop(c.currentTime + 0.22);
  }
  playMiss() {
    if (!this.enabled) return;
    this.ensure();
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine'; o.frequency.value = 220;
    g.gain.value = 0.08;
    o.connect(g); g.connect(c.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    o.stop(c.currentTime + 0.12);
  }
}

const audio = new AudioManager();

// Game state
let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
let hits = 0, misses = 0;

canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
});
canvas.addEventListener('touchmove', (e) => {
  if (e.touches && e.touches[0]) {
    mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY;
  }
}, {passive:false});

// Targets (laptops) move slower now
class Target {
  constructor() {
    this.reset();
  }
  reset() {
    // spawn randomly spread along bottom
    this.x = Math.random() * (window.innerWidth - 200) + 100;
    this.y = window.innerHeight + (20 + Math.random() * 80);
    // much slower velocities than before
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.vx = dir * (0.2 + Math.random() * 0.6); // px per ms scaled later
    this.vy = - (0.8 + Math.random() * 1.3);
    this.size = 70 + Math.random()*30;
    this.dead = false;
    this.rot = Math.random()*0.6 - 0.3;
  }
  update(dt) {
    // dt in ms
    // small gravity to curve trajectory
    const G = 0.0009;
    this.x += this.vx * dt;
    this.y += this.vy * dt + 0.5 * G * dt * dt;
    this.vy += G * dt;
    this.rot += 0.0006 * dt;
    // if off-screen remove
    if (this.y < -200 || this.x < -200 || this.x > window.innerWidth + 200) this.reset();
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const w = this.size; const h = this.size * 0.7;
    if (laptopImg.complete) ctx.drawImage(laptopImg, -w/2, -h/2, w, h);
    else {
      ctx.fillStyle = '#333'; ctx.fillRect(-w/2, -h/2, w, h);
    }
    ctx.restore();
  }
  isHit(px,py) {
    const w = this.size; const h = this.size*0.7;
    return px >= this.x - w/2 && px <= this.x + w/2 && py >= this.y - h/2 && py <= this.y + h/2;
  }
}

// Explosion effect
class Explosion {
  constructor(x,y,color='#ff8a65') {
    this.x = x; this.y = y; this.t = 0; this.d = 500; this.color = color; this.dead = false;
  }
  update(dt) {
    this.t += dt; if (this.t >= this.d) this.dead = true;
  }
  draw(ctx) {
    const p = this.t / this.d;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    // radial particles
    const count = 12;
    for (let i=0;i<count;i++) {
      const ang = (i / count) * Math.PI*2 + p*2;
      const r = 10 + p*70 * (0.6 + Math.random()*0.8);
      const sx = this.x + Math.cos(ang) * r;
      const sy = this.y + Math.sin(ang) * r;
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.arc(sx, sy, 4 * (1 - p) + 1, 0, Math.PI*2);
      ctx.fill();
    }
    // center flash
    ctx.beginPath();
    ctx.fillStyle = '#fff3e0';
    ctx.arc(this.x, this.y, 6 + p*28, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

// Game arrays
const targets = [];
const explosions = [];
let lastSpawn = 0;
let spawnInterval = 900; // ms
let lastTime = performance.now();

// initialize a few targets
for (let i=0;i<6;i++) targets.push(new Target());

// Shooting logic
function shoot(x,y) {
  audio.playShoot();
  let hitAny = false;
  // iterate in reverse to find topmost hits first
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (t.isHit(x,y)) {
      hitAny = true;
      hits++;
      hitsEl.textContent = hits;
      t.reset();
      explosions.push(new Explosion(t.x, t.y));
      audio.playHit();
      break;
    }
  }
  if (!hitAny) {
    misses++;
    missesEl.textContent = misses;
    audio.playMiss();
  }
}

canvas.addEventListener('mousedown', (e) => {
  shoot(e.clientX, e.clientY);
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches && e.touches[0]) {
    const t = e.touches[0];
    shoot(t.clientX, t.clientY);
  }
}, {passive:false});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') shoot(mouse.x, mouse.y);
});

restartBtn.addEventListener('click', () => {
  hits = 0; misses = 0; hitsEl.textContent = hits; missesEl.textContent = misses;
  targets.length = 0; explosions.length = 0;
  for (let i=0;i<6;i++) targets.push(new Target());
});

// main loop
function loop() {
  const now = performance.now();
  let dt = now - lastTime;
  if (dt > 50) dt = 50;
  lastTime = now;

  // spawn new targets gradually faster as time passes or based on score
  lastSpawn += dt;
  if (lastSpawn > spawnInterval) {
    lastSpawn = 0;
    targets.push(new Target());
    // slowly reduce spawnInterval but clamp
    spawnInterval = Math.max(400, spawnInterval * 0.995);
  }

  // update
  for (const t of targets) t.update(dt);
  for (const e of explosions) e.update(dt);
  // remove dead explosions
  for (let i = explosions.length - 1; i >= 0; i--) if (explosions[i].dead) explosions.splice(i,1);

  // draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // white background (canvas may be scaled)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,window.innerWidth, window.innerHeight);

  // ground hint
  ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, window.innerHeight - 60, window.innerWidth, 60);

  // draw targets
  for (const t of targets) t.draw(ctx);

  // draw explosions
  for (const e of explosions) e.draw(ctx);

  // draw crosshair centered at pointer
  const size = 56;
  const mx = mouse.x, my = mouse.y;
  if (crossImg.complete) {
    ctx.drawImage(crossImg, mx - size/2, my - size/2, size, size);
  } else {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(mx-16,my); ctx.lineTo(mx+16,my);
    ctx.moveTo(mx,my-16); ctx.lineTo(mx,my+16);
    ctx.stroke(); ctx.restore();
  }

  requestAnimationFrame(loop);
}

loop();
