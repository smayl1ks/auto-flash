// Lightweight high-performance fullscreen celebration confetti particle system
export function triggerConfetti(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = window.innerWidth || document.documentElement.clientWidth || 1200;
  const height = window.innerHeight || document.documentElement.clientHeight || 800;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.display = 'block';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const colors = [
    '#6366f1', '#4f46e5', '#38bdf8', '#06b6d4', 
    '#10b981', '#34d399', '#f59e0b', '#ec4899', 
    '#a855f7', '#fb7185', '#fbbf24'
  ];

  const particles = [];
  const count = 120;

  // 1. Center burst
  for (let i = 0; i < count * 0.5; i++) {
    const angle = (Math.PI * 2 * i) / (count * 0.5) + (Math.random() - 0.5) * 0.5;
    const speed = Math.random() * 12 + 6;
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 60,
      y: height * 0.45 + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.28,
      wobble: Math.random() * 10
    });
  }

  // 2. Left bottom cannon
  for (let i = 0; i < count * 0.25; i++) {
    const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.4;
    const speed = Math.random() * 16 + 10;
    particles.push({
      x: width * 0.15,
      y: height * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.3,
      wobble: Math.random() * 10
    });
  }

  // 3. Right bottom cannon
  for (let i = 0; i < count * 0.25; i++) {
    const angle = -(3 * Math.PI) / 4 + (Math.random() - 0.5) * 0.4;
    const speed = Math.random() * 16 + 10;
    particles.push({
      x: width * 0.85,
      y: height * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.3,
      wobble: Math.random() * 10
    });
  }

  let animationFrame;
  const startTime = Date.now();

  function render() {
    ctx.clearRect(0, 0, width, height);
    const elapsed = Date.now() - startTime;

    let activeCount = 0;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.985;
      p.rotation += p.rotationSpeed;
      p.wobble += 0.1;

      if (elapsed > 1400) {
        p.opacity = Math.max(0, 1 - (elapsed - 1400) / 900);
      }

      if (p.opacity > 0 && p.y < height + 60) {
        activeCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        
        const scaleX = Math.sin(p.wobble);
        ctx.scale(scaleX, 1);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }

    if (activeCount > 0 && elapsed < 2500) {
      animationFrame = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, width, height);
      canvas.style.display = 'none';
      if (animationFrame) cancelAnimationFrame(animationFrame);
    }
  }

  render();
}
