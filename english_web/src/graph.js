// ==========================================================================
// Obsidian-Style Interactive Knowledge Graph for Vocabulary
// ==========================================================================

export class ObsidianWordGraph {
  constructor(canvasContainer, options = {}) {
    this.container = typeof canvasContainer === 'string'
      ? document.querySelector(canvasContainer)
      : canvasContainer;

    if (!this.container) {
      console.warn('ObsidianWordGraph: container not found');
      return;
    }

    this.cards = [];
    this.nodes = [];
    this.links = [];
    this.filter = 'all'; // 'all' | 'mastered' | 'learning' | 'due'

    // Viewport transform
    this.transform = { x: 0, y: 0, scale: 1 };
    this.targetTransform = { x: 0, y: 0, scale: 1 };

    // Interaction states
    this.draggedNode = null;
    this.hoveredNode = null;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.mousePos = { x: -1000, y: -1000 };
    this.animFrameId = null;
    this.physicsAlpha = 1.0;
    this.onNodeClick = options.onNodeClick || null;
    this.onAddWordClick = options.onAddWordClick || null;

    this.initDOM();
    this.bindEvents();
    this.resize();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="obsidian-graph-wrapper">
        <div class="obsidian-graph-toolbar">
          <div class="graph-filter-chips">
            <button class="graph-filter-btn active" data-filter="all">Все слова</button>
            <button class="graph-filter-btn" data-filter="mastered">Выученные</button>
            <button class="graph-filter-btn" data-filter="learning">На изучении</button>
            <button class="graph-filter-btn" data-filter="due">К повторению</button>
          </div>
          <div class="graph-controls-group">
            <button class="graph-tool-btn" id="graph-zoom-in" title="Приблизить">+</button>
            <button class="graph-tool-btn" id="graph-zoom-out" title="Отдалить">−</button>
            <button class="graph-tool-btn" id="graph-reset" title="Сбросить вид">⟲</button>
            <button class="graph-tool-btn" id="graph-fullscreen" title="На весь экран">⛶</button>
          </div>
        </div>

        <canvas class="obsidian-graph-canvas"></canvas>

        <div class="obsidian-node-tooltip" id="obsidian-tooltip">
          <!-- Dynamically populated on hover -->
        </div>

        <div class="obsidian-graph-legend">
          <span class="legend-item"><span class="dot hub"></span>Категории</span>
          <span class="legend-item"><span class="dot mastered"></span>Выучено</span>
          <span class="legend-item"><span class="dot review"></span>Закрепляется</span>
          <span class="legend-item"><span class="dot learning"></span>На изучении</span>
          <span class="legend-item"><span class="dot new"></span>Новое</span>
        </div>

        <div class="obsidian-empty-state" id="graph-empty-state">
          <div class="empty-state-card">
            <h3>Карта слов пуста</h3>
            <p>Добавьте свои первые слова в словарь, чтобы построить интерактивный граф знаний и тренировать память.</p>
            <button class="btn-primary-action" id="btn-graph-add-word" style="margin-top: 6px;">
              <span>Добавить первое слово</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('.obsidian-graph-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = this.container.querySelector('#obsidian-tooltip');
    this.wrapper = this.container.querySelector('.obsidian-graph-wrapper');
    this.emptyState = this.container.querySelector('#graph-empty-state');
    this.toolbar = this.container.querySelector('.obsidian-graph-toolbar');
    this.legend = this.container.querySelector('.obsidian-graph-legend');
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    // Add word button from empty state
    const btnGraphAdd = this.container.querySelector('#btn-graph-add-word');
    if (btnGraphAdd) {
      btnGraphAdd.onclick = () => {
        if (this.onAddWordClick) this.onAddWordClick();
      };
    }

    // Filter clicks
    const filterBtns = this.container.querySelectorAll('.graph-filter-btn');
    filterBtns.forEach(btn => {
      btn.onclick = () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setFilter(btn.getAttribute('data-filter'));
      };
    });

    // Zoom controls
    const btnZoomIn = this.container.querySelector('#graph-zoom-in');
    const btnZoomOut = this.container.querySelector('#graph-zoom-out');
    const btnReset = this.container.querySelector('#graph-reset');
    const btnFullscreen = this.container.querySelector('#graph-fullscreen');

    if (btnZoomIn) btnZoomIn.onclick = () => this.zoom(1.3);
    if (btnZoomOut) btnZoomOut.onclick = () => this.zoom(0.77);
    if (btnReset) btnReset.onclick = () => this.resetView();
    if (btnFullscreen) {
      btnFullscreen.onclick = () => {
        this.wrapper.classList.toggle('fullscreen');
        setTimeout(() => this.resize(), 50);
      };
    }

    // Canvas pointer events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

    // Responsive observer to auto-adapt whenever container dimensions update
    if (window.ResizeObserver && this.wrapper) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.wrapper);
    }
  }

  resize() {
    if (!this.canvas || !this.wrapper) return;
    const rect = this.wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || this.wrapper.clientWidth || window.innerWidth;
    this.height = rect.height || this.wrapper.clientHeight || (window.innerHeight - 130);

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.nodes && this.nodes.length > 0) {
      this.fitToView();
    }
    this.wakePhysics();
  }

  setCards(cards) {
    this.cards = cards || [];
    this.buildGraph();
    this.resetView();
  }

  setFilter(filterName) {
    this.filter = filterName;
    this.buildGraph();
  }

  buildGraph() {
    const rawCards = this.cards;
    const now = new Date();

    if (rawCards.length === 0) {
      if (this.emptyState) this.emptyState.classList.add('active');
      if (this.toolbar) this.toolbar.style.display = 'none';
      if (this.legend) this.legend.style.display = 'none';
      this.nodes = [];
      this.links = [];
      return;
    } else {
      if (this.emptyState) this.emptyState.classList.remove('active');
      if (this.toolbar) this.toolbar.style.display = 'flex';
      if (this.legend) this.legend.style.display = 'flex';
    }

    // Filter cards
    let activeCards = rawCards.filter(c => {
      const isMastered = c.state === 'mastered' || (c.intervalDays && c.intervalDays >= 21);
      const isDue = !c.dueDate || new Date(c.dueDate) <= now || c.state === 'new';

      if (this.filter === 'mastered') return isMastered;
      if (this.filter === 'learning') return !isMastered && c.state !== 'new';
      if (this.filter === 'due') return isDue;
      return true;
    });

    const isMobile = this.width < 768;
    const verticalSpread = isMobile ? 1.5 : 1.0;
    const horizontalSpread = isMobile ? 0.75 : 1.0;

    // Map categories into hub nodes
    const categoryMap = new Map();
    const nodes = [];
    const links = [];

    // Collect category hubs
    const categories = new Set();
    activeCards.forEach(c => {
      const cat = c.category || 'general';
      categories.add(cat);
    });

    const categoryLabels = {
      'phrasal_verbs': 'Phrasal Verbs',
      'idioms': 'Idioms',
      'tech': 'Tech & IT',
      'business': 'Business',
      'general': 'Core',
      'travel': 'Travel'
    };

    const catArray = Array.from(categories);
    catArray.forEach((cat, idx) => {
      const angle = (idx / Math.max(1, catArray.length)) * Math.PI * 2;
      const hubDist = isMobile ? 120 : 160;
      const hubNode = {
        id: `hub-${cat}`,
        isHub: true,
        category: cat,
        label: categoryLabels[cat] || cat.charAt(0).toUpperCase() + cat.slice(1),
        radius: isMobile ? 14 : 16,
        x: Math.cos(angle) * hubDist * horizontalSpread,
        y: Math.sin(angle) * hubDist * verticalSpread,
        vx: 0,
        vy: 0,
        color: '#6366f1',
        glowColor: 'rgba(99, 102, 241, 0.5)'
      };
      categoryMap.set(cat, hubNode);
      nodes.push(hubNode);
    });

    // Build word nodes
    activeCards.forEach((c, idx) => {
      const isMastered = c.state === 'mastered' || (c.intervalDays && c.intervalDays >= 21);
      const isReview = c.state === 'review' || (c.intervalDays && c.intervalDays >= 3);
      const isDue = !c.dueDate || new Date(c.dueDate) <= now;

      let color = '#94a3b8'; // New: neutral slate gray
      let glowColor = 'rgba(148, 163, 184, 0.4)';
      let statusLabel = 'Новое';

      if (isMastered) {
        color = '#10b981'; // Mastered: Emerald green
        glowColor = 'rgba(16, 185, 129, 0.65)';
        statusLabel = 'Выучено';
      } else if (isReview) {
        color = '#06b6d4'; // Review: Bright cyan / sky blue
        glowColor = 'rgba(6, 182, 212, 0.55)';
        statusLabel = 'Закрепляется';
      } else if (c.repetitionCount > 0) {
        color = '#f59e0b'; // Learning: Amber / orange
        glowColor = 'rgba(245, 158, 11, 0.55)';
        statusLabel = 'На изучении';
      }

      // Radius
      const radius = isMastered ? 11 : (isReview ? 9 : 8);
      const cat = c.category || 'general';
      const hub = categoryMap.get(cat);
      const angle = (idx / Math.max(1, activeCards.length)) * Math.PI * 2 + (Math.random() * 0.5);
      const spawnDist = (hub ? (isMobile ? 85 : 120) : (isMobile ? 120 : 180)) + (Math.random() * 40);

      const wordNode = {
        id: `word-${c.id || idx}`,
        isHub: false,
        card: c,
        label: c.word,
        category: cat,
        cefrLevel: c.cefrLevel || 'B1',
        radius,
        statusLabel,
        isMastered,
        isDue,
        x: (hub ? hub.x : 0) + Math.cos(angle) * spawnDist * horizontalSpread,
        y: (hub ? hub.y : 0) + Math.sin(angle) * spawnDist * verticalSpread,
        vx: 0,
        vy: 0,
        color,
        glowColor
      };

      nodes.push(wordNode);

      // Link to Category Hub
      if (hub) {
        links.push({
          source: hub,
          target: wordNode,
          length: isMobile ? (isMastered ? 80 : 100) : (isMastered ? 115 : 135),
          strength: 0.65
        });
      }
    });

    // Cross-link words with same category softly
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        if (!n1.isHub && !n2.isHub) {
          if (n1.category === n2.category && Math.random() < 0.25) {
            links.push({
              source: n1,
              target: n2,
              length: isMobile ? 85 : 120,
              strength: 0.15,
              isInterWord: true
            });
          }
        }
      }
    }

    this.nodes = nodes;
    this.links = links;
    this.wakePhysics();
  }

  wakePhysics() {
    this.physicsAlpha = 1.0;
    if (!this.animFrameId) {
      this.animate();
    }
  }

  updatePhysics() {
    if (this.physicsAlpha < 0.005) {
      this.physicsAlpha = 0;
      return;
    }

    const nodes = this.nodes;
    const links = this.links;
    const alpha = this.physicsAlpha;

    // 1. Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(distSq);

        const repForce = (n1.isHub || n2.isHub ? 2200 : 1200) / (distSq + 120);
        const fx = (dx / dist) * repForce * alpha;
        const fy = (dy / dist) * repForce * alpha;

        if (n1 !== this.draggedNode) {
          n1.vx -= fx;
          n1.vy -= fy;
        }
        if (n2 !== this.draggedNode) {
          n2.vx += fx;
          n2.vy += fy;
        }
      }
    }

    // 2. Spring attraction along links
    links.forEach(link => {
      const source = link.source;
      const target = link.target;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const delta = dist - (link.length || 80);
      const force = delta * 0.035 * (link.strength || 0.5) * alpha;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (source !== this.draggedNode) {
        source.vx += fx;
        source.vy += fy;
      }
      if (target !== this.draggedNode) {
        target.vx -= fx;
        target.vy -= fy;
      }
    });

    // 3. Center gravity pull & friction update
    nodes.forEach(node => {
      if (node === this.draggedNode) return;

      // Gentle center pull
      node.vx -= node.x * 0.008 * alpha;
      node.vy -= node.y * 0.008 * alpha;

      // Friction
      node.vx *= 0.88;
      node.vy *= 0.88;

      // Update position
      node.x += node.vx;
      node.y += node.vy;
    });

    this.physicsAlpha *= 0.985;
  }

  animate() {
    this.updatePhysics();
    this.render();

    // Smooth transform lerp
    this.transform.x += (this.targetTransform.x - this.transform.x) * 0.2;
    this.transform.y += (this.targetTransform.y - this.transform.y) * 0.2;
    this.transform.scale += (this.targetTransform.scale - this.transform.scale) * 0.2;

    this.animFrameId = requestAnimationFrame(() => this.animate());
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Save & apply global view transform
    ctx.save();
    ctx.translate(w / 2 + this.transform.x, h / 2 + this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);

    // Draw background subtle grid
    this.drawBackgroundGrid(ctx);

    // Find active / connected node set
    const activeNeighbors = new Set();
    if (this.hoveredNode) {
      activeNeighbors.add(this.hoveredNode);
      this.links.forEach(l => {
        if (l.source === this.hoveredNode) activeNeighbors.add(l.target);
        if (l.target === this.hoveredNode) activeNeighbors.add(l.source);
      });
    }

    // 1. Draw Links
    this.links.forEach(link => {
      const isConnectedToHover = this.hoveredNode &&
        (link.source === this.hoveredNode || link.target === this.hoveredNode);

      const isDimmed = this.hoveredNode && !isConnectedToHover;

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);

      if (isConnectedToHover) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
        ctx.shadowBlur = 8;
      } else if (link.isInterWord) {
        ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.02)' : 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.03)' : 'rgba(99, 102, 241, 0.25)';
        ctx.lineWidth = 1.4;
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // 2. Draw Nodes
    this.nodes.forEach(node => {
      const isHovered = node === this.hoveredNode;
      const isNeighbor = activeNeighbors.has(node);
      const isDimmed = this.hoveredNode && !isHovered && !isNeighbor;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.22 : 1.0;

      // Glow Halo
      if (!isDimmed) {
        const glowRad = node.radius * (isHovered ? 2.5 : 1.8);
        const glowGrad = ctx.createRadialGradient(node.x, node.y, node.radius * 0.4, node.x, node.y, glowRad);
        glowGrad.addColorStop(0, node.glowColor);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius * (isHovered ? 1.25 : 1), 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border ring
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = isHovered ? 2.5 : 1.2;
      ctx.stroke();

      // Text label
      ctx.font = node.isHub ? '600 12px Outfit, sans-serif' : '500 11px Outfit, sans-serif';
      ctx.fillStyle = isHovered ? '#ffffff' : (node.isHub ? '#cbd5e1' : '#94a3b8');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(node.label, node.x, node.y + node.radius + (isHovered ? 6 : 4));
      ctx.shadowBlur = 0;

      ctx.restore();
    });

    ctx.restore();
  }

  drawBackgroundGrid(ctx) {
    const step = 40;
    const range = 600;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';

    for (let x = -range; x <= range; x += step) {
      for (let y = -range; y <= range; y += step) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
  }

  // Pointer & Touch Coordinates conversion
  toWorldCoords(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = screenX - rect.left - this.width / 2 - this.transform.x;
    const cy = screenY - rect.top - this.height / 2 - this.transform.y;
    return {
      x: cx / this.transform.scale,
      y: cy / this.transform.scale
    };
  }

  findNodeAt(screenX, screenY) {
    const world = this.toWorldCoords(screenX, screenY);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      const dx = world.x - node.x;
      const dy = world.y - node.y;
      const hitRadius = (node.radius + 8);
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  }

  handleMouseDown(e) {
    const node = this.findNodeAt(e.clientX, e.clientY);
    if (node) {
      this.draggedNode = node;
      this.wakePhysics();
    } else {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.targetTransform.x, y: e.clientY - this.targetTransform.y };
    }
  }

  handleMouseMove(e) {
    this.mousePos = { x: e.clientX, y: e.clientY };

    if (this.draggedNode) {
      const world = this.toWorldCoords(e.clientX, e.clientY);
      this.draggedNode.x = world.x;
      this.draggedNode.y = world.y;
      this.draggedNode.vx = 0;
      this.draggedNode.vy = 0;
      this.wakePhysics();
      return;
    }

    if (this.isPanning) {
      this.targetTransform.x = e.clientX - this.panStart.x;
      this.targetTransform.y = e.clientY - this.panStart.y;
      return;
    }

    // Hover state
    const node = this.findNodeAt(e.clientX, e.clientY);
    if (node !== this.hoveredNode) {
      this.hoveredNode = node;
      this.updateTooltip(e.clientX, e.clientY, node);
      this.canvas.style.cursor = node ? 'pointer' : 'default';
    } else if (node && this.tooltip.classList.contains('active')) {
      this.positionTooltip(e.clientX, e.clientY);
    }
  }

  handleMouseUp(e) {
    if (this.draggedNode && this.onNodeClick) {
      // If minimal drag, treat as click
      this.onNodeClick(this.draggedNode);
    }
    this.draggedNode = null;
    this.isPanning = false;
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    this.zoom(zoomFactor, e.clientX, e.clientY);
  }

  zoom(factor, clientX, clientY) {
    const oldScale = this.targetTransform.scale;
    const newScale = Math.max(0.3, Math.min(3.5, oldScale * factor));
    this.targetTransform.scale = newScale;

    if (clientX !== undefined && clientY !== undefined) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left - this.width / 2;
      const mouseY = clientY - rect.top - this.height / 2;
      this.targetTransform.x -= (mouseX - this.targetTransform.x) * (factor - 1);
      this.targetTransform.y -= (mouseY - this.targetTransform.y) * (factor - 1);
    }
  }

  fitToView() {
    if (!this.nodes || this.nodes.length === 0) {
      this.targetTransform = { x: 0, y: 0, scale: 1 };
      this.transform = { x: 0, y: 0, scale: 1 };
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.radius - 35);
      maxX = Math.max(maxX, n.x + n.radius + 35);
      minY = Math.min(minY, n.y - n.radius - 35);
      maxY = Math.max(maxY, n.y + n.radius + 35);
    });

    const graphWidth = Math.max(140, maxX - minX);
    const graphHeight = Math.max(140, maxY - minY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const availableWidth = this.width * 0.85;
    const availableHeight = this.height * 0.65; // Account for top toolbar and bottom action block
    const scaleX = availableWidth / graphWidth;
    const scaleY = availableHeight / graphHeight;
    const isMobile = window.innerWidth <= 768;
    const initialScale = Math.min(isMobile ? 1.0 : 1.25, Math.max(0.4, Math.min(scaleX, scaleY)));

    this.targetTransform = {
      x: -centerX * initialScale,
      y: -centerY * initialScale,
      scale: initialScale
    };
    this.transform = { ...this.targetTransform };
    this.wakePhysics();
  }

  resetView() {
    this.fitToView();
  }

  // Touch Handlers
  handleTouchStart(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const node = this.findNodeAt(t.clientX, t.clientY);
      if (node) {
        this.draggedNode = node;
        this.hoveredNode = node;
        this.updateTooltip(t.clientX, t.clientY, node);
        this.wakePhysics();
      } else {
        this.isPanning = true;
        this.panStart = { x: t.clientX - this.targetTransform.x, y: t.clientY - this.targetTransform.y };
        this.hideTooltip();
      }
    } else if (e.touches.length === 2) {
      this.isPinching = true;
      this.isPanning = false;
      this.pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this.pinchStartScale = this.targetTransform.scale;
    }
  }

  handleTouchMove(e) {
    if (e.touches.length === 1 && !this.isPinching) {
      const t = e.touches[0];
      if (this.draggedNode) {
        e.preventDefault();
        const world = this.toWorldCoords(t.clientX, t.clientY);
        this.draggedNode.x = world.x;
        this.draggedNode.y = world.y;
        this.wakePhysics();
      } else if (this.isPanning) {
        e.preventDefault();
        this.targetTransform.x = t.clientX - this.panStart.x;
        this.targetTransform.y = t.clientY - this.panStart.y;
      }
    } else if (e.touches.length === 2 && this.isPinching) {
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (this.pinchStartDist > 0) {
        const factor = currentDist / this.pinchStartDist;
        this.targetTransform.scale = Math.max(0.3, Math.min(3.5, this.pinchStartScale * factor));
      }
    }
  }

  handleTouchEnd(e) {
    if (!e.touches || e.touches.length === 0) {
      if (this.draggedNode && this.onNodeClick) {
        this.onNodeClick(this.draggedNode);
      }
      this.draggedNode = null;
      this.isPanning = false;
      this.isPinching = false;
    } else if (e.touches.length === 1) {
      this.isPinching = false;
      const t = e.touches[0];
      this.panStart = { x: t.clientX - this.targetTransform.x, y: t.clientY - this.targetTransform.y };
    }
  }

  // Tooltip rendering
  updateTooltip(clientX, clientY, node) {
    if (!node) {
      this.hideTooltip();
      return;
    }

    if (node.isHub) {
      const count = this.nodes.filter(n => !n.isHub && n.category === node.category).length;
      this.tooltip.innerHTML = `
        <div class="tt-header">
          <span class="tt-tag hub">Хаб</span>
          <h4>${node.label}</h4>
        </div>
        <div class="tt-body">
          <p>Слов в категории: <b>${count}</b></p>
        </div>
      `;
    } else {
      const card = node.card || {};
      const examples = card.examples && card.examples[0] ? card.examples[0] : '';
      const intervalText = card.intervalDays ? `${card.intervalDays}д интервал` : 'Новое слово';

      this.tooltip.innerHTML = `
        <div class="tt-header">
          <div class="tt-top-line">
            <span class="tt-tag ${node.isMastered ? 'mastered' : 'status'}">${node.statusLabel}</span>
            <span class="tt-level">${card.cefrLevel || 'B1'}</span>
          </div>
          <div class="tt-word-line">
            <h4>${card.word}</h4>
            <span class="tt-ipa">${card.transcription || ''}</span>
          </div>
        </div>
        <div class="tt-translation">${card.translation || ''}</div>
        ${examples ? `<div class="tt-example">"${examples}"</div>` : ''}
        <div class="tt-footer">
          <span class="tt-interval">${intervalText}</span>
        </div>
      `;
    }

    this.positionTooltip(clientX, clientY);
    this.tooltip.classList.add('active');
  }

  positionTooltip(clientX, clientY) {
    const rect = this.wrapper.getBoundingClientRect();
    let x = clientX - rect.left + 15;
    let y = clientY - rect.top + 15;

    // Boundary containment
    if (x + 280 > rect.width) x = clientX - rect.left - 290;
    if (y + 180 > rect.height) y = clientY - rect.top - 190;

    this.tooltip.style.left = `${Math.max(10, x)}px`;
    this.tooltip.style.top = `${Math.max(10, y)}px`;
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.classList.remove('active');
    }
  }
}
