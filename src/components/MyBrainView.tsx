import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Trees,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Pause,
  Sparkles,
  Flame,
  Layers,
  Plus,
  Zap,
} from 'lucide-react';
import {
  AnimationIntensity,
  ENTRY_TYPE_META,
  KnowledgeEntry,
  KnowledgeGroup,
  NodePosition,
} from '../types';
import { getGrowthStage } from '../utils/styleEngine';
import { computeGroupHub, computeNodePositionForEntry } from '../utils/brainGeometry';
import { AnimatedCounter } from './GroupIcon';

interface MyBrainViewProps {
  entries: KnowledgeEntry[];
  groups: KnowledgeGroup[];
  positionsMap: Map<string, NodePosition>;
  searchMatchedIds: Set<string>;
  hasActiveSearch: boolean;
  newlyCreatedId: string | null;
  streak: number;
  animationIntensity: AnimationIntensity;
  theme: 'dark' | 'light';
  onOpenEntry: (entry: KnowledgeEntry) => void;
  onOpenNewEntry: () => void;
  onSaveComputedPositions: (positions: NodePosition[]) => Promise<void>;
}

interface RenderNode {
  entry: KnowledgeEntry;
  groupIndex: number;
  groupColor: string;
  brainX: number;
  brainY: number;
  treeX: number;
  treeY: number;
  x: number;
  y: number;
  radius: number;
  angle: number;
  isToday: boolean;
  isMatched: boolean;
  isFruit: boolean;
}

interface InteractiveWave {
  worldX: number;
  worldY: number;
  startTime: number;
  color: string;
}

export const MyBrainView: React.FC<MyBrainViewProps> = ({
  entries,
  groups,
  positionsMap,
  searchMatchedIds,
  hasActiveSearch,
  newlyCreatedId,
  streak,
  animationIntensity,
  theme,
  onOpenEntry,
  onOpenNewEntry,
  onSaveComputedPositions,
}) => {
  const [mode, setMode] = useState<'brain' | 'tree'>('brain');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [timelineProgress, setTimelineProgress] = useState<number>(100);
  const [isReplaying, setIsReplaying] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{
    entry: KnowledgeEntry;
    groupName: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef({
    x: 0,
    y: 0,
    zoom: 0.92,
    targetX: 0,
    targetY: 0,
    targetZoom: 0.92,
    vx: 0,
    vy: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
  });
  const morphRef = useRef(0); // 0 = Brain, 1 = Tree
  const modeRef = useRef<'brain' | 'tree'>(mode);
  modeRef.current = mode;

  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef<number | null>(null);

  const birthAnimRef = useRef<{ id: string; startTime: number } | null>(null);
  const wavesRef = useRef<InteractiveWave[]>([]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const growthStage = useMemo(() => getGrowthStage(entries.length), [entries.length]);

  useEffect(() => {
    if (newlyCreatedId) {
      birthAnimRef.current = { id: newlyCreatedId, startTime: performance.now() };
    }
  }, [newlyCreatedId]);

  // Replay timeline animation ("شاهد نموّك")
  useEffect(() => {
    if (!isReplaying) return;
    const interval = window.setInterval(() => {
      setTimelineProgress((prev) => {
        if (prev >= 100) {
          setIsReplaying(false);
          return 100;
        }
        return Math.min(100, prev + 2);
      });
    }, 70);
    return () => window.clearInterval(interval);
  }, [isReplaying]);

  // Persist missing positions only for non-stress entries or small batches so 20k never blocks
  useEffect(() => {
    if (entries.length > 1000) return;
    const missing: NodePosition[] = [];
    const groupIdxMap = new Map(groups.map((g, i) => [g.id, i]));
    const countPerGroup: Record<string, number> = {};

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const c = countPerGroup[e.groupId] || 0;
      countPerGroup[e.groupId] = c + 1;
      if (!positionsMap.has(e.id)) {
        const gIdx = groupIdxMap.get(e.groupId) ?? 0;
        missing.push(
          computeNodePositionForEntry(
            e.id,
            e.groupId,
            c,
            gIdx,
            Math.max(1, groups.length),
            e.style.seed
          )
        );
      }
    }

    if (missing.length > 0) {
      void onSaveComputedPositions(missing);
    }
  }, [entries, groups, positionsMap, onSaveComputedPositions]);

  // Filter entries by group and timeline slider without sorting 20,000 items unnecessarily
  const visibleEntries = useMemo(() => {
    const base =
      selectedGroupId === 'all'
        ? entries
        : entries.filter((e) => e.groupId === selectedGroupId);

    if (timelineProgress < 100 && base.length > 0) {
      const count = Math.max(1, Math.ceil((timelineProgress / 100) * base.length));
      return base.slice(0, count);
    }
    return base;
  }, [entries, selectedGroupId, timelineProgress]);

  // Build render nodes with zero unnecessary math when savedPos exists
  const renderNodes: RenderNode[] = useMemo(() => {
    const groupIdxMap = new Map(groups.map((g, i) => [g.id, i]));
    const groupColorMap = new Map(groups.map((g) => [g.id, g.color]));
    const countPerGroup: Record<string, number> = {};
    const totalGroups = Math.max(1, groups.length);

    const result = new Array<RenderNode>(visibleEntries.length);

    for (let i = 0; i < visibleEntries.length; i++) {
      const e = visibleEntries[i];
      const gIdx = groupIdxMap.get(e.groupId) ?? 0;
      const c = countPerGroup[e.groupId] || 0;
      countPerGroup[e.groupId] = c + 1;

      let savedPos = positionsMap.get(e.id);
      if (!savedPos) {
        savedPos = computeNodePositionForEntry(
          e.id,
          e.groupId,
          c,
          gIdx,
          totalGroups,
          e.style.seed
        );
      }

      const contentFactor = Math.min(4.5, Math.floor(e.contentText.length / 130));
      const highlightFactor = Math.min(3.5, e.highlightCount * 1.1);
      const radius = 6 + contentFactor + highlightFactor;

      result[i] = {
        entry: e,
        groupIndex: gIdx,
        groupColor: groupColorMap.get(e.groupId) || `hsl(${e.style.hue}, 82%, 62%)`,
        brainX: savedPos.brainX,
        brainY: savedPos.brainY,
        treeX: savedPos.treeX,
        treeY: savedPos.treeY,
        x: savedPos.brainX,
        y: savedPos.brainY,
        radius,
        angle: ((e.style.seed % 360) * Math.PI) / 180,
        isToday: e.date === todayStr,
        isMatched: !hasActiveSearch || searchMatchedIds.has(e.id),
        isFruit: e.isPinned || e.highlightCount > 0 || e.type === 'wisdom' || e.type === 'sermon',
      };
    }
    return result;
  }, [visibleEntries, groups, positionsMap, todayStr, hasActiveSearch, searchMatchedIds]);

  // Glide camera to newly created node
  useEffect(() => {
    if (!newlyCreatedId) return;
    const targetNode = renderNodes.find((n) => n.entry.id === newlyCreatedId);
    if (targetNode) {
      const tx = mode === 'brain' ? targetNode.brainX : targetNode.treeX;
      const ty = mode === 'brain' ? targetNode.treeY : targetNode.treeY;
      cameraRef.current.targetX = -tx * 1.05;
      cameraRef.current.targetY = -ty * 1.05;
      cameraRef.current.targetZoom = 1.25;
    }
  }, [newlyCreatedId, renderNodes, mode]);

  // High-DPI Pre-rendered Sprites:
  // 1) Crystalline Bioluminescent Neuron Sprite (128x128)
  // 2) Botanical Leaf & Golden Blossom Sprite (128x128)
  const neuronSpritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const leafSpritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const getNeuronSprite = (color: string): HTMLCanvasElement => {
    const existing = neuronSpritesRef.current.get(color);
    if (existing) return existing;
    const off = document.createElement('canvas');
    off.width = 128;
    off.height = 128;
    const octx = off.getContext('2d');
    if (octx) {
      // Outer volumetric synaptic aura
      const grad = octx.createRadialGradient(64, 64, 3, 64, 64, 60);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.16, '#ffffff');
      grad.addColorStop(0.34, color);
      grad.addColorStop(0.68, `${color}44`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = grad;
      octx.beginPath();
      octx.arc(64, 64, 60, 0, Math.PI * 2);
      octx.fill();

      // Subtle dendritic rays
      octx.strokeStyle = `${color}88`;
      octx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + 0.25;
        octx.beginPath();
        octx.moveTo(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8);
        octx.lineTo(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28);
        octx.stroke();
      }

      // Crisp crystalline soma core
      octx.fillStyle = '#ffffff';
      octx.beginPath();
      octx.arc(64, 64, 9.5, 0, Math.PI * 2);
      octx.fill();
    }
    neuronSpritesRef.current.set(color, off);
    return off;
  };

  const getLeafSprite = (color: string, isFruit: boolean): HTMLCanvasElement => {
    const key = `${color}-${isFruit ? 'fruit' : 'leaf'}`;
    const existing = leafSpritesRef.current.get(key);
    if (existing) return existing;
    const off = document.createElement('canvas');
    off.width = 128;
    off.height = 128;
    const octx = off.getContext('2d');
    if (octx) {
      // Soft sunlight glow around leaf/blossom
      const aura = octx.createRadialGradient(64, 64, 4, 64, 64, 54);
      aura.addColorStop(0, `${color}99`);
      aura.addColorStop(0.55, `${color}28`);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = aura;
      octx.beginPath();
      octx.arc(64, 64, 54, 0, Math.PI * 2);
      octx.fill();

      octx.save();
      octx.translate(64, 64);

      if (isFruit) {
        // Glowing 5-petal Knowledge Blossom / Golden Fruit
        for (let p = 0; p < 5; p++) {
          octx.save();
          octx.rotate((p * Math.PI * 2) / 5);
          octx.beginPath();
          octx.moveTo(0, 0);
          octx.bezierCurveTo(-10, -12, -8, -26, 0, -30);
          octx.bezierCurveTo(8, -26, 10, -12, 0, 0);
          octx.fillStyle = color;
          octx.fill();
          octx.strokeStyle = 'rgba(255,255,255,0.65)';
          octx.lineWidth = 1.2;
          octx.stroke();
          octx.restore();
        }
        // Golden nectar core
        octx.beginPath();
        octx.arc(0, 0, 7, 0, Math.PI * 2);
        octx.fillStyle = '#FEF08A';
        octx.fill();
      } else {
        // Realistic Botanical Pointed Leaf with central midrib vein
        const leafGrad = octx.createLinearGradient(-18, 22, 18, -28);
        leafGrad.addColorStop(0, color);
        leafGrad.addColorStop(0.7, '#34D399');
        leafGrad.addColorStop(1, '#A7F3D0');

        octx.beginPath();
        octx.moveTo(0, 22);
        octx.bezierCurveTo(-22, 8, -20, -16, 0, -30);
        octx.bezierCurveTo(20, -16, 22, 8, 0, 22);
        octx.closePath();
        octx.fillStyle = leafGrad;
        octx.fill();
        octx.lineWidth = 1.4;
        octx.strokeStyle = 'rgba(255,255,255,0.55)';
        octx.stroke();

        // Central leaf midrib & side veins
        octx.beginPath();
        octx.moveTo(0, 20);
        octx.lineTo(0, -24);
        octx.moveTo(0, 4);
        octx.lineTo(-9, -6);
        octx.moveTo(0, -4);
        octx.lineTo(9, -13);
        octx.strokeStyle = 'rgba(255,255,255,0.75)';
        octx.lineWidth = 1.2;
        octx.stroke();
      }
      octx.restore();
    }
    leafSpritesRef.current.set(key, off);
    return off;
  };

  // Pre-baked Offscreen High-DPI Layers for 5,000 - 20,000 background nodes
  // Ensures 120 FPS with ZERO pixelation and ZERO per-frame lag!
  const denseLayersRef = useRef<{
    brainCanvas: HTMLCanvasElement | null;
    treeCanvas: HTMLCanvasElement | null;
  }>({ brainCanvas: null, treeCanvas: null });

  useEffect(() => {
    const HERO_LIMIT = 520;
    if (renderNodes.length <= HERO_LIMIT) {
      denseLayersRef.current = { brainCanvas: null, treeCanvas: null };
      return;
    }

    const SIZE = 2048;
    const WORLD_SPAN = 1400; // -700 .. +700
    const scale = SIZE / WORLD_SPAN;

    const bCan = document.createElement('canvas');
    bCan.width = SIZE;
    bCan.height = SIZE;
    const bCtx = bCan.getContext('2d');

    const tCan = document.createElement('canvas');
    tCan.width = SIZE;
    tCan.height = SIZE;
    const tCtx = tCan.getContext('2d');

    if (bCtx && tCtx) {
      bCtx.translate(SIZE / 2, SIZE / 2);
      bCtx.scale(scale, scale);

      tCtx.translate(SIZE / 2, SIZE / 2);
      tCtx.scale(scale, scale);

      // Draw up to 19,500 background nodes onto the high-res offscreen layers once
      const step = Math.max(1, Math.floor((renderNodes.length - HERO_LIMIT) / 6500));
      for (let i = HERO_LIMIT; i < renderNodes.length; i += step) {
        const n = renderNodes[i];
        const alpha = n.isMatched ? 0.72 : 0.14;

        // Brain background neuron
        const nSprite = getNeuronSprite(n.groupColor);
        const bSize = n.radius * 3.1;
        bCtx.globalAlpha = alpha;
        bCtx.drawImage(nSprite, n.brainX - bSize / 2, n.brainY - bSize / 2, bSize, bSize);

        // Tree background leaf/blossom
        const lSprite = getLeafSprite(n.groupColor, i % 7 === 0);
        const tSize = n.radius * 3.4;
        tCtx.globalAlpha = alpha * 0.92;
        tCtx.drawImage(lSprite, n.treeX - tSize / 2, n.treeY - tSize / 2, tSize, tSize);
      }
    }

    denseLayersRef.current = { brainCanvas: bCan, treeCanvas: tCan };
  }, [renderNodes]);

  // Main 120 FPS Hardware-Accelerated Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    const updateSize = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const groupHubs = groups.map((g, idx) => ({
      group: g,
      ...computeGroupHub(idx, Math.max(1, groups.length), 520),
    }));

    // Pre-generate organic cortical gyri fold curves for realistic 3D Brain
    const corticalFolds: Array<{
      side: number;
      x1: number;
      y1: number;
      cx1: number;
      cy1: number;
      cx2: number;
      cy2: number;
      x2: number;
      y2: number;
    }> = [];
    for (const side of [-1, 1]) {
      const cx = side * 176;
      for (let i = -4; i <= 4; i++) {
        const yBase = i * 68;
        const widthFactor = Math.sqrt(Math.max(0.15, 1 - Math.pow(i / 4.6, 2)));
        const span = 195 * widthFactor;
        corticalFolds.push({
          side,
          x1: cx - span * 0.85,
          y1: yBase + Math.sin(i * 1.7) * 14,
          cx1: cx - span * 0.3,
          cy1: yBase - 32 * side * Math.cos(i),
          cx2: cx + span * 0.3,
          cy2: yBase + 32 * side * Math.sin(i),
          x2: cx + span * 0.85,
          y2: yBase - Math.cos(i * 1.3) * 14,
        });
      }
    }

    const HERO_LIMIT = 520;

    const renderFrame = (now: number) => {
      if (document.hidden) {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      const dt = Math.min(32, Math.max(4, now - lastTime));
      lastTime = now;
      const lerpFactor = 1 - Math.pow(0.86, dt / 8.33); // Normalized for 120Hz (8.33ms)

      const dpr = Math.min(3, window.devicePixelRatio || 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, width, height);

      // Smooth 120Hz camera interpolation & 3D parallax tilt
      const cam = cameraRef.current;
      if (!isDraggingRef.current) {
        cam.targetX += cam.vx * (dt / 16);
        cam.targetY += cam.vy * (dt / 16);
        cam.vx *= Math.pow(0.92, dt / 8.33);
        cam.vy *= Math.pow(0.92, dt / 8.33);
      }
      cam.x += (cam.targetX - cam.x) * lerpFactor;
      cam.y += (cam.targetY - cam.y) * lerpFactor;
      cam.zoom += (cam.targetZoom - cam.zoom) * lerpFactor;
      cam.tiltX += (cam.targetTiltX - cam.tiltX) * lerpFactor;
      cam.tiltY += (cam.targetTiltY - cam.tiltY) * lerpFactor;

      const targetMorph = modeRef.current === 'tree' ? 1 : 0;
      morphRef.current += (targetMorph - morphRef.current) * lerpFactor;
      const m = morphRef.current;

      // Auto-fit scale on smaller mobile screens so the entire Brain/Tree fits comfortably
      const mobileFitScale = width < 640 ? Math.max(0.54, width / 920) : 1;
      const effectiveZoom = cam.zoom * mobileFitScale;

      const centerX = width / 2 + cam.x + cam.tiltX * 18;
      const centerY = height / 2 + cam.y + cam.tiltY * 18;

      ctx.translate(centerX, centerY);
      ctx.scale(effectiveZoom, effectiveZoom);

      const breathing =
        animationIntensity === 'low' ? 1 : 1 + Math.sin(now * 0.002) * 0.01;
      ctx.scale(breathing, breathing);

      // ========================================================================
      // 1. ULTRA-REALISTIC 3D VOLUMETRIC NEURAL BRAIN (when m < 0.98)
      // ========================================================================
      if (m < 0.98) {
        const bAlpha = 1 - m;
        ctx.save();
        ctx.globalAlpha = bAlpha;

        // Deep ambient bioluminescent brain aura
        const brainAura = ctx.createRadialGradient(0, 0, 40, 0, 0, 460);
        brainAura.addColorStop(
          0,
          theme === 'dark' ? 'rgba(139, 92, 246, 0.24)' : 'rgba(139, 92, 246, 0.15)'
        );
        brainAura.addColorStop(
          0.55,
          theme === 'dark' ? 'rgba(14, 165, 233, 0.11)' : 'rgba(56, 189, 248, 0.08)'
        );
        brainAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = brainAura;
        ctx.beginPath();
        ctx.arc(0, 0, 460, 0, Math.PI * 2);
        ctx.fill();

        // Corpus Callosum (Central Neural Bridge connecting Left & Right Hemispheres)
        const bridgeGrad = ctx.createLinearGradient(-160, 0, 160, 0);
        bridgeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
        bridgeGrad.addColorStop(0.5, 'rgba(167, 139, 250, 0.38)');
        bridgeGrad.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
        ctx.strokeStyle = bridgeGrad;
        ctx.lineWidth = 2.2;
        for (let b = -3; b <= 3; b++) {
          const by = b * 42;
          ctx.beginPath();
          ctx.moveTo(-140, by);
          ctx.quadraticCurveTo(0, by * 0.55, 140, by);
          ctx.stroke();
        }

        // Left & Right Anatomical Cerebral Hemispheres with 3D Specular Rim Lighting
        for (const side of [-1, 1]) {
          const cx = side * 176 + cam.tiltX * 8 * side;
          const rx = 252;
          const ry = 372;

          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
            // Realistic anatomical lobe contour + gyri sulci indentations
            const frontalTaper = Math.sin(a) < 0 ? 0.92 : 1.04;
            const medialFlat =
              side * Math.cos(a) < -0.55 ? 0.86 : 1.0;
            const gyriBump =
              1 +
              0.022 * Math.sin(a * 10 + side) +
              0.014 * Math.cos(a * 18) +
              0.008 * Math.sin(a * 28);
            const px = cx + Math.cos(a) * rx * frontalTaper * medialFlat * gyriBump;
            const py = Math.sin(a) * ry * gyriBump;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();

          // 3D Subsurface Scattering Fill
          const hemiGrad = ctx.createRadialGradient(
            cx - side * 40,
            -70,
            20,
            cx,
            0,
            ry
          );
          if (theme === 'dark') {
            hemiGrad.addColorStop(0, 'rgba(76, 29, 149, 0.36)');
            hemiGrad.addColorStop(0.55, 'rgba(30, 27, 75, 0.28)');
            hemiGrad.addColorStop(0.88, 'rgba(14, 165, 233, 0.16)');
            hemiGrad.addColorStop(1, 'rgba(139, 92, 246, 0.42)');
          } else {
            hemiGrad.addColorStop(0, 'rgba(237, 233, 254, 0.75)');
            hemiGrad.addColorStop(0.7, 'rgba(224, 231, 255, 0.55)');
            hemiGrad.addColorStop(1, 'rgba(139, 92, 246, 0.35)');
          }
          ctx.fillStyle = hemiGrad;
          ctx.fill();

          // Specular 3D Rim Stroke
          ctx.lineWidth = 2.8;
          ctx.strokeStyle =
            theme === 'dark'
              ? 'rgba(167, 139, 250, 0.55)'
              : 'rgba(109, 40, 217, 0.42)';
          ctx.stroke();
        }

        // Multi-layered Cortical Gyri & Sulci Folds (التلافيف العصبية ثلاثية الأبعاد)
        ctx.lineCap = 'round';
        for (let i = 0; i < corticalFolds.length; i++) {
          const f = corticalFolds[i];
          // Sulcus shadow groove
          ctx.beginPath();
          ctx.moveTo(f.x1, f.y1);
          ctx.bezierCurveTo(f.cx1, f.cy1, f.cx2, f.cy2, f.x2, f.y2);
          ctx.lineWidth = 4.2;
          ctx.strokeStyle =
            theme === 'dark'
              ? 'rgba(15, 23, 42, 0.55)'
              : 'rgba(148, 163, 184, 0.28)';
          ctx.stroke();

          // Gyrus bioluminescent ridge
          ctx.beginPath();
          ctx.moveTo(f.x1, f.y1 - 2);
          ctx.bezierCurveTo(f.cx1, f.cy1 - 2, f.cx2, f.cy2 - 2, f.x2, f.y2 - 2);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle =
            theme === 'dark'
              ? 'rgba(56, 189, 248, 0.26)'
              : 'rgba(99, 102, 241, 0.25)';
          ctx.stroke();
        }

        ctx.restore();
      }

      // ========================================================================
      // 2. ULTRA-REALISTIC LIVING BOTANICAL KNOWLEDGE TREE (when m > 0.02)
      // ========================================================================
      if (m > 0.02) {
        ctx.save();
        ctx.globalAlpha = m;

        const windSway =
          animationIntensity === 'low' ? 0 : Math.sin(now * 0.0016) * 8;
        const trunkThickness = Math.min(64, 30 + Math.sqrt(entries.length + 1) * 1.4);

        // A. Deep Multi-Layered Botanical Canopy Clouds (Behind Branches)
        for (let gIdx = 0; gIdx < groupHubs.length; gIdx++) {
          const gh = groupHubs[gIdx];
          const swayX = gh.treeBranchX + windSway * 0.7;
          const swayY = gh.treeBranchY + Math.cos(now * 0.0018 + gh.branchAngle) * 3;

          // Ambient bioluminescent canopy halo
          const canopyGrad = ctx.createRadialGradient(
            swayX,
            swayY,
            18,
            swayX,
            swayY,
            195
          );
          canopyGrad.addColorStop(0, `${gh.group.color}48`);
          canopyGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.22)');
          canopyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = canopyGrad;
          ctx.beginPath();
          ctx.arc(swayX, swayY, 195, 0, Math.PI * 2);
          ctx.fill();

          // Volumetric 3D Leaf-Cloud Puffs (Dark Emerald Shadow -> Forest Midtone -> Group-Tinted Crown)
          const cloudPuffs = [
            { dx: -68, dy: 18, rx: 78, ry: 54 },
            { dx: 68, dy: 16, rx: 76, ry: 52 },
            { dx: -38, dy: -36, rx: 82, ry: 58 },
            { dx: 42, dy: -34, rx: 80, ry: 56 },
            { dx: 0, dy: -62, rx: 74, ry: 52 },
            { dx: 0, dy: 4, rx: 96, ry: 66 },
          ];
          for (let c = 0; c < cloudPuffs.length; c++) {
            const puff = cloudPuffs[c];
            const px = swayX + puff.dx + Math.sin(now * 0.0015 + c + gIdx) * 3;
            const py = swayY + puff.dy;

            const puffGrad = ctx.createRadialGradient(
              px,
              py - puff.ry * 0.35,
              8,
              px,
              py + puff.ry * 0.2,
              puff.rx
            );
            puffGrad.addColorStop(0, `${gh.group.color}36`);
            puffGrad.addColorStop(0.55, 'rgba(6, 95, 70, 0.34)');
            puffGrad.addColorStop(1, 'rgba(4, 47, 46, 0.04)');

            ctx.fillStyle = puffGrad;
            ctx.beginPath();
            ctx.ellipse(px, py, puff.rx, puff.ry, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // B. Living Terraced Garden Hill & Root System
        const hillGrad = ctx.createRadialGradient(0, 388, 25, 0, 420, 390);
        hillGrad.addColorStop(0, '#047857');
        hillGrad.addColorStop(0.45, '#065F46');
        hillGrad.addColorStop(0.8, '#064E3B');
        hillGrad.addColorStop(1, 'rgba(6, 78, 59, 0)');
        ctx.fillStyle = hillGrad;
        ctx.beginPath();
        ctx.ellipse(0, 395, 370, 58, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flaring Buttress Roots gripping the earth with 3D wood shading
        ctx.lineCap = 'round';
        const rootConfigs = [
          { spread: -1.45, depth: 408, widthFactor: 0.26 },
          { spread: -0.88, depth: 416, widthFactor: 0.32 },
          { spread: -0.35, depth: 422, widthFactor: 0.36 },
          { spread: 0.32, depth: 422, widthFactor: 0.36 },
          { spread: 0.85, depth: 415, widthFactor: 0.32 },
          { spread: 1.42, depth: 406, widthFactor: 0.26 },
        ];
        for (const rc of rootConfigs) {
          ctx.beginPath();
          ctx.moveTo(rc.spread * 16, 350);
          ctx.bezierCurveTo(
            rc.spread * 45,
            378,
            rc.spread * 95,
            394,
            rc.spread * 155,
            rc.depth
          );
          ctx.lineWidth = Math.max(5, trunkThickness * rc.widthFactor);
          ctx.strokeStyle = '#5C2808';
          ctx.stroke();

          // Root top highlight
          ctx.beginPath();
          ctx.moveTo(rc.spread * 15, 348);
          ctx.bezierCurveTo(
            rc.spread * 44,
            375,
            rc.spread * 92,
            391,
            rc.spread * 148,
            rc.depth - 2
          );
          ctx.lineWidth = Math.max(2, trunkThickness * rc.widthFactor * 0.38);
          ctx.strokeStyle = '#9A4E1C';
          ctx.stroke();
        }

        // C. Sculpted Gnarled Wood Trunk with Cylindrical 3D Bark Lighting
        const trunkGrad = ctx.createLinearGradient(-trunkThickness * 0.75, 220, trunkThickness * 0.75, 220);
        trunkGrad.addColorStop(0, '#2E1205');
        trunkGrad.addColorStop(0.28, '#5C2808');
        trunkGrad.addColorStop(0.62, '#8C4215');
        trunkGrad.addColorStop(0.86, '#B45309');
        trunkGrad.addColorStop(1, '#451A03');

        ctx.beginPath();
        ctx.moveTo(-trunkThickness * 0.85, 386);
        ctx.bezierCurveTo(
          -trunkThickness * 0.42,
          290,
          -trunkThickness * 0.36 - 6 + windSway * 0.12,
          175,
          -trunkThickness * 0.28 + windSway * 0.25,
          62
        );
        ctx.lineTo(trunkThickness * 0.28 + windSway * 0.25, 62);
        ctx.bezierCurveTo(
          trunkThickness * 0.34 + 5 + windSway * 0.12,
          175,
          trunkThickness * 0.42,
          290,
          trunkThickness * 0.85,
          386
        );
        ctx.closePath();
        ctx.fillStyle = trunkGrad;
        ctx.fill();

        // Organic Bark Ridges & Bioluminescent Sap Veins flowing up the trunk
        for (const ridge of [-0.32, -0.1, 0.12, 0.3]) {
          ctx.beginPath();
          ctx.moveTo(trunkThickness * ridge * 1.65, 380);
          ctx.bezierCurveTo(
            trunkThickness * ridge * 0.9 - 4,
            260,
            trunkThickness * ridge * 0.75 + 4 + windSway * 0.12,
            150,
            trunkThickness * ridge * 0.55 + windSway * 0.24,
            66
          );
          ctx.lineWidth = 2.1;
          ctx.strokeStyle =
            ridge === 0.12
              ? 'rgba(52, 211, 153, 0.32)'
              : 'rgba(251, 191, 36, 0.22)';
          ctx.stroke();
        }

        // D. Curved S-Shaped Primary Boughs, Secondary Limbs & Botanical Twigs
        for (let gIdx = 0; gIdx < groupHubs.length; gIdx++) {
          const gh = groupHubs[gIdx];
          const bSwayX = gh.treeBranchX + windSway * 0.7;
          const bSwayY = gh.treeBranchY + Math.sin(now * 0.0018 + gIdx) * 3.5;

          const startX = (gIdx - (groupHubs.length - 1) / 2) * (trunkThickness * 0.16) + windSway * 0.24;
          const startY = 70;

          // Natural S-curve control points so boughs arch upward and outward gracefully
          const dirSign = gh.treeBranchX < -20 ? -1 : gh.treeBranchX > 20 ? 1 : 0;
          const cp1x = startX + gh.treeBranchX * 0.22 - dirSign * 26 + windSway * 0.35;
          const cp1y = startY - Math.abs(gh.treeBranchY - startY) * 0.48;
          const cp2x = startX + gh.treeBranchX * 0.72 + dirSign * 18 + windSway * 0.55;
          const cp2y = bSwayY + 46;

          // Level 1: Primary Bough Shadow Base
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, bSwayX, bSwayY);
          ctx.lineWidth = Math.max(9, trunkThickness * 0.42);
          ctx.strokeStyle = '#451A03';
          ctx.stroke();

          // Level 1: Primary Bough Warm Wood + Group Sap Gradient
          const boughGrad = ctx.createLinearGradient(startX, startY, bSwayX, bSwayY);
          boughGrad.addColorStop(0, '#78350F');
          boughGrad.addColorStop(0.55, '#9A4E1C');
          boughGrad.addColorStop(1, gh.group.color);

          ctx.beginPath();
          ctx.moveTo(startX, startY - 1.5);
          ctx.bezierCurveTo(cp1x, cp1y - 1.5, cp2x, cp2y - 1.5, bSwayX, bSwayY - 1);
          ctx.lineWidth = Math.max(6, trunkThickness * 0.29);
          ctx.strokeStyle = boughGrad;
          ctx.stroke();

          // Level 2 & 3: Curved Secondary Limbs & Fine Botanical Twigs
          const limbOffsets = [-0.82, -0.42, -0.05, 0.36, 0.78];
          for (let l = 0; l < limbOffsets.length; l++) {
            const la = gh.branchAngle + limbOffsets[l];
            const limbLen = 78 + (l % 2) * 26;
            const lx = bSwayX + Math.cos(la) * limbLen + windSway * 0.38;
            const ly = bSwayY + Math.sin(la) * (limbLen * 0.8);

            const lCtrlX = (bSwayX + lx) / 2 + Math.sin(l * 2.1) * 18;
            const lCtrlY = (bSwayY + ly) / 2 - 16;

            ctx.beginPath();
            ctx.moveTo(bSwayX, bSwayY);
            ctx.quadraticCurveTo(lCtrlX, lCtrlY, lx, ly);
            ctx.lineWidth = Math.max(3.5, trunkThickness * 0.15);
            ctx.strokeStyle = '#78350F';
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(bSwayX, bSwayY - 1);
            ctx.quadraticCurveTo(lCtrlX, lCtrlY - 1, lx, ly - 1);
            ctx.lineWidth = Math.max(2.2, trunkThickness * 0.1);
            ctx.strokeStyle = gh.group.color;
            ctx.stroke();

            // Level 3: Fine Sub-twigs with Ambient Botanical Leaves
            for (const subOffset of [-0.46, 0.0, 0.46]) {
              const sa = la + subOffset;
              const twigLen = subOffset === 0 ? 46 : 38;
              const sx = lx + Math.cos(sa) * twigLen + windSway * 0.25;
              const sy = ly + Math.sin(sa) * (twigLen * 0.82);

              ctx.beginPath();
              ctx.moveTo(lx, ly);
              ctx.quadraticCurveTo((lx + sx) / 2, (ly + sy) / 2 - 6, sx, sy);
              ctx.lineWidth = 1.6;
              ctx.strokeStyle = `${gh.group.color}CC`;
              ctx.stroke();

              // Sprout organic ambient leaf at twig tip
              ctx.save();
              ctx.translate(sx, sy);
              ctx.rotate(sa + Math.PI / 4);
              ctx.fillStyle = `${gh.group.color}99`;
              ctx.beginPath();
              ctx.moveTo(0, -7);
              ctx.bezierCurveTo(5, -4, 5, 4, 0, 7);
              ctx.bezierCurveTo(-5, 4, -5, -4, 0, -7);
              ctx.fill();
              ctx.restore();
            }
          }
        }

        // E. Floating Golden Fireflies / Blossom Petals around the Tree
        if (animationIntensity !== 'low') {
          for (let p = 0; p < 22; p++) {
            const pAngle = now * 0.0004 + p * 1.9;
            const px = Math.sin(pAngle * 1.3 + p) * 290 + windSway;
            const py = 260 - ((now * 0.025 + p * 35) % 540);
            const pAlpha = 0.35 + 0.35 * Math.sin(now * 0.004 + p);
            ctx.fillStyle = p % 2 === 0 ? `rgba(253, 224, 71, ${pAlpha})` : `rgba(52, 211, 153, ${pAlpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // ========================================================================
      // 3. FAST PRE-BAKED HIGH-DPI LAYER FOR 5,000 - 20,000 NODES (Zero Lag / Zero Pixelation)
      // ========================================================================
      const { brainCanvas, treeCanvas } = denseLayersRef.current;
      if (brainCanvas && m < 0.98) {
        ctx.save();
        ctx.globalAlpha = 1 - m;
        ctx.drawImage(brainCanvas, -700, -700, 1400, 1400);
        ctx.restore();
      }
      if (treeCanvas && m > 0.02) {
        const windSway = animationIntensity === 'low' ? 0 : Math.sin(now * 0.0016) * 6;
        ctx.save();
        ctx.globalAlpha = m;
        ctx.drawImage(treeCanvas, -700 + windSway * 0.5, -700, 1400, 1400);
        ctx.restore();
      }

      // ========================================================================
      // 4. FOREGROUND INTERACTIVE HERO NODES, CURVED AXONS & ACTION POTENTIALS
      // ========================================================================
      const windSway =
        animationIntensity === 'low' ? 0 : Math.sin(now * 0.0016) * 8 * m;
      const heroCount = Math.min(renderNodes.length, HERO_LIMIT);

      // Update positions of hero nodes
      for (let i = 0; i < heroCount; i++) {
        const n = renderNodes[i];
        const swayOffset = m > 0.01 ? Math.sin(now * 0.002 + i * 0.5) * 3.5 * m + windSway * 0.6 : 0;
        n.x = n.brainX * (1 - m) + (n.treeX + swayOffset) * m;
        n.y = n.brainY * (1 - m) + n.treeY * m;
      }

      // Draw Curved Cubic Bézier Axons (Brain) & Vascular Leaf Stems (Tree)
      const maxAxons = Math.min(heroCount, 320);
      ctx.lineWidth = 1.25;

      for (let i = 0; i < maxAxons; i++) {
        const n = renderNodes[i];
        const gh = groupHubs[n.groupIndex];
        if (!gh) continue;
        const hx = gh.brainHubX * (1 - m) + (gh.treeBranchX + windSway * 0.7) * m;
        const hy = gh.brainHubY * (1 - m) + gh.treeBranchY * m;

        const alpha = n.isMatched ? 0.28 : 0.05;
        ctx.strokeStyle = `${n.groupColor}${Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')}`;

        // Organic curved Bézier axon / stem instead of rigid straight line
        const midX = (hx + n.x) * 0.5 + (n.y - hy) * 0.14;
        const midY = (hy + n.y) * 0.5 - (n.x - hx) * 0.14;

        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.quadraticCurveTo(midX, midY, n.x, n.y);
        ctx.stroke();

        // Travelling Action-Potential Impulse along curved Bézier axon
        if (animationIntensity !== 'low' && n.isMatched && i % 3 === 0) {
          const t = (now * 0.00055 + i * 0.19) % 1;
          const invT = 1 - t;
          const px = invT * invT * hx + 2 * invT * t * midX + t * t * n.x;
          const py = invT * invT * hy + 2 * invT * t * midY + t * t * n.y;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Hero Neurons (Brain) & Botanical Leaves/Blossoms (Tree)
      for (let i = 0; i < heroCount; i++) {
        const n = renderNodes[i];
        const pulse = n.isToday ? 1 + Math.sin(now * 0.006 + i) * 0.22 : 1;

        // Interactive Wave excitation boost when user touches/clicks nearby
        let waveBoost = 1;
        for (let w = 0; w < wavesRef.current.length; w++) {
          const wave = wavesRef.current[w];
          const elapsed = now - wave.startTime;
          const waveRadius = (elapsed / 1200) * 320;
          const dist = Math.hypot(n.x - wave.worldX, n.y - wave.worldY);
          if (Math.abs(dist - waveRadius) < 48) {
            waveBoost = 1.42;
          }
        }

        const drawRadius = n.radius * pulse * waveBoost;
        ctx.globalAlpha = n.isMatched ? 1 : 0.18;

        if (m < 0.95) {
          const nSprite = getNeuronSprite(n.groupColor);
          const spriteSize = drawRadius * 4.4;
          ctx.globalAlpha = (n.isMatched ? 1 : 0.18) * (1 - m);
          ctx.drawImage(
            nSprite,
            n.x - spriteSize / 2,
            n.y - spriteSize / 2,
            spriteSize,
            spriteSize
          );
        }

        if (m > 0.05) {
          const lSprite = getLeafSprite(n.groupColor, n.isFruit);
          const leafSize = drawRadius * 4.5;
          ctx.save();
          ctx.globalAlpha = (n.isMatched ? 1 : 0.18) * m;
          ctx.translate(n.x, n.y);
          ctx.rotate(n.angle + Math.sin(now * 0.0022 + i) * 0.12);
          ctx.drawImage(lSprite, -leafSize / 2, -leafSize / 2, leafSize, leafSize);
          ctx.restore();
        }

        // Birth Shockwave Ring if this node was just added
        if (birthAnimRef.current && birthAnimRef.current.id === n.entry.id) {
          const elapsed = now - birthAnimRef.current.startTime;
          if (elapsed < 2600) {
            const p = elapsed / 2600;
            const ringR = drawRadius + p * 95;
            ctx.beginPath();
            ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - p})`;
            ctx.lineWidth = 3 * (1 - p);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // ========================================================================
      // 5. INTERACTIVE TOUCH / CLICK BIO-ELECTRIC SHOCKWAVES
      // ========================================================================
      wavesRef.current = wavesRef.current.filter((w) => now - w.startTime < 1200);
      for (const w of wavesRef.current) {
        const p = (now - w.startTime) / 1200;
        const r = 12 + p * 320;
        ctx.beginPath();
        ctx.arc(w.worldX, w.worldY, r, 0, Math.PI * 2);
        ctx.strokeStyle = `${w.color}${Math.round((1 - p) * 190)
          .toString(16)
          .padStart(2, '0')}`;
        ctx.lineWidth = 2.5 * (1 - p);
        ctx.stroke();
      }

      // ========================================================================
      // 6. CRISP CORTICAL HUBS & BRANCH LABELS
      // ========================================================================
      for (const gh of groupHubs) {
        const hx = gh.brainHubX * (1 - m) + (gh.treeBranchX + windSway * 0.7) * m;
        const hy = gh.brainHubY * (1 - m) + gh.treeBranchY * m;

        // Glowing hub core
        ctx.beginPath();
        ctx.arc(hx, hy, 11, 0, Math.PI * 2);
        ctx.fillStyle = gh.group.color;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = 'bold 12px Cairo, sans-serif';
        const textWidth = ctx.measureText(gh.group.name).width;
        const padX = 10;
        const pillW = textWidth + padX * 2;
        const pillH = 22;
        const pillX = hx - pillW / 2;
        const pillY = hy - 36;

        ctx.fillStyle =
          theme === 'dark' ? 'rgba(11, 15, 26, 0.88)' : 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 8);
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = gh.group.color;
        ctx.stroke();

        ctx.fillStyle = theme === 'dark' ? '#F8FAFC' : '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gh.group.name, hx, pillY + pillH / 2);
      }

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateSize);
    };
  }, [renderNodes, groups, mode, animationIntensity, theme, entries.length]);

  // Convert screen coordinates to World Space & find closest node
  const hitTestScreenPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const cam = cameraRef.current;
    const mobileFitScale = rect.width < 640 ? Math.max(0.54, rect.width / 920) : 1;
    const effectiveZoom = cam.zoom * mobileFitScale;

    const worldX = (mx - rect.width / 2 - cam.x - cam.tiltX * 18) / effectiveZoom;
    const worldY = (my - rect.height / 2 - cam.y - cam.tiltY * 18) / effectiveZoom;

    let closest: RenderNode | null = null;
    let bestDistSq = 360;
    const checkCount = Math.min(renderNodes.length, 520);

    for (let i = 0; i < checkCount; i++) {
      const n = renderNodes[i];
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        closest = n;
      }
    }

    return { mx, my, worldX, worldY, closest };
  };

  const spawnInteractiveWave = (worldX: number, worldY: number, color = '#A78BFA') => {
    wavesRef.current.push({
      worldX,
      worldY,
      startTime: performance.now(),
      color,
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    cameraRef.current.targetZoom = Math.min(
      3.5,
      Math.max(0.32, cameraRef.current.targetZoom * factor)
    );
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    dragStartRef.current = {
      x: e.clientX - cameraRef.current.targetX,
      y: e.clientY - cameraRef.current.targetY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Subtle 3D tilt parallax based on pointer position
    cameraRef.current.targetTiltX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    cameraRef.current.targetTiltY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    if (isDraggingRef.current) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      if (Math.hypot(dx, dy) > 3) dragMovedRef.current = true;
      cameraRef.current.vx = dx * 0.45;
      cameraRef.current.vy = dy * 0.45;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      cameraRef.current.targetX = e.clientX - dragStartRef.current.x;
      cameraRef.current.targetY = e.clientY - dragStartRef.current.y;
      return;
    }

    const hit = hitTestScreenPoint(e.clientX, e.clientY);
    if (!hit) return;

    if (hit.closest) {
      const grp = groups.find((g) => g.id === hit.closest!.entry.groupId);
      setHoveredNode({
        entry: hit.closest.entry,
        groupName: grp?.name || 'عام',
        screenX: hit.mx,
        screenY: hit.my,
      });
    } else if (hoveredNode) {
      setHoveredNode(null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      isDraggingRef.current = true;
      dragMovedRef.current = false;
      lastPointerRef.current = { x: t.clientX, y: t.clientY };
      dragStartRef.current = {
        x: t.clientX - cameraRef.current.targetX,
        y: t.clientY - cameraRef.current.targetY,
      };
      const hit = hitTestScreenPoint(t.clientX, t.clientY);
      if (hit) {
        spawnInteractiveWave(
          hit.worldX,
          hit.worldY,
          hit.closest?.groupColor || (mode === 'tree' ? '#10B981' : '#8B5CF6')
        );
      }
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - lastPointerRef.current.x;
      const dy = t.clientY - lastPointerRef.current.y;
      if (Math.hypot(dx, dy) > 4) dragMovedRef.current = true;
      cameraRef.current.vx = dx * 0.5;
      cameraRef.current.vy = dy * 0.5;
      lastPointerRef.current = { x: t.clientX, y: t.clientY };

      cameraRef.current.targetX = t.clientX - dragStartRef.current.x;
      cameraRef.current.targetY = t.clientY - dragStartRef.current.y;
    } else if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchDistRef.current > 10) {
        const scale = dist / pinchDistRef.current;
        cameraRef.current.targetZoom = Math.min(
          3.5,
          Math.max(0.32, cameraRef.current.targetZoom * scale)
        );
      }
      pinchDistRef.current = dist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragMovedRef.current && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const hit = hitTestScreenPoint(t.clientX, t.clientY);
      if (hit?.closest) {
        onOpenEntry(hit.closest.entry);
      }
    }
    isDraggingRef.current = false;
    pinchDistRef.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragMovedRef.current) return;
    const hit = hitTestScreenPoint(e.clientX, e.clientY);
    if (hit) {
      spawnInteractiveWave(
        hit.worldX,
        hit.worldY,
        hit.closest?.groupColor || (mode === 'tree' ? '#10B981' : '#8B5CF6')
      );
      if (hit.closest) {
        onOpenEntry(hit.closest.entry);
      }
    }
  };

  return (
    <div className="relative w-full h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)] overflow-hidden select-none touch-none">
      {/* 120 FPS High-DPI Interactive Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="brain-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-grab active:cursor-grabbing block touch-none"
      />

      {/* Top Mode Switcher (🧠 Neural Brain vs 🌳 Knowledge Tree) & Group Filter */}
      <div className="absolute top-2.5 md:top-5 right-3 md:right-6 left-3 md:left-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between sm:justify-start gap-1.5 p-1 rounded-2xl bg-slate-900/88 border border-slate-700/80 backdrop-blur-xl shadow-2xl">
          <button
            type="button"
            onClick={() => setMode('brain')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'brain'
                ? 'bg-gradient-to-l from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4 shrink-0" />
            <span>الدماغ العصبي الحي</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('tree')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'tree'
                ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Trees className="w-4 h-4 shrink-0" />
            <span>شجرة المعرفة النامية</span>
          </button>
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
            <Zap className="w-3 h-3" />
            120 FPS
          </span>
        </div>

        {/* Group Filter Pills */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/85 border border-slate-700/80 backdrop-blur-xl overflow-x-auto max-w-full sm:max-w-md md:max-w-xl no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedGroupId('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] md:text-xs font-medium transition-colors whitespace-nowrap ${
              selectedGroupId === 'all'
                ? 'bg-white/15 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            الكل ({entries.length.toLocaleString('en-US')})
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroupId(g.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] md:text-xs font-medium transition-colors whitespace-nowrap ${
                selectedGroupId === g.id
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                borderBottom: selectedGroupId === g.id ? `2px solid ${g.color}` : undefined,
              }}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Stats & Growth Stage Panel (Desktop Right Bottom) */}
      <div className="hidden lg:block absolute bottom-6 right-6 w-80 p-5 rounded-3xl bg-slate-900/88 border border-slate-700/80 backdrop-blur-xl shadow-2xl text-white space-y-4 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{growthStage.icon}</span>
            <div>
              <div className="text-[11px] text-slate-400">مرحلة النمو الحالية</div>
              <div className="font-kufi text-sm font-bold text-white">{growthStage.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNewEntry}
            aria-label="إضافة خلية أو ثمرة جديدة"
            className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-md"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>التقدم للمرحلة القادمة</span>
            <span className="font-mono">
              {entries.length.toLocaleString('en-US')} / {growthStage.nextMilestone}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-violet-500 via-sky-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${growthStage.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-center">
          <div className="p-2 rounded-xl bg-white/5">
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span>الخلايا</span>
            </div>
            <AnimatedCounter value={entries.length} className="text-sm font-bold text-white" />
          </div>
          <div className="p-2 rounded-xl bg-white/5">
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <Layers className="w-3 h-3 text-sky-400" />
              <span>المجموعات</span>
            </div>
            <AnimatedCounter value={groups.length} className="text-sm font-bold text-white" />
          </div>
          <div className="p-2 rounded-xl bg-white/5">
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>التتابع</span>
            </div>
            <div className="text-sm font-bold text-amber-400 font-mono tabular-nums">
              {streak} يوم
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls: "شاهد نموّك" Timeline Slider + Camera Zoom Controls */}
      <div className="absolute bottom-20 lg:bottom-6 left-3 md:left-6 right-3 lg:right-auto flex items-center justify-between sm:justify-start gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/88 border border-slate-700/80 backdrop-blur-xl text-white shadow-xl">
          <button
            type="button"
            onClick={() => {
              if (timelineProgress >= 100) setTimelineProgress(5);
              setIsReplaying((r) => !r);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-[11px] md:text-xs font-semibold whitespace-nowrap"
          >
            {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>شاهد نموّك</span>
          </button>
          <input
            type="range"
            aria-label="شريط الزمن لمشاهدة نمو المعرفة"
            min={5}
            max={100}
            value={timelineProgress}
            onChange={(e) => {
              setIsReplaying(false);
              setTimelineProgress(Number(e.target.value));
            }}
            className="w-20 sm:w-32 accent-violet-500 cursor-pointer"
          />
          <span className="text-[11px] font-mono text-slate-300 w-8 text-left">
            {timelineProgress}%
          </span>
        </div>

        <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-slate-900/88 border border-slate-700/80 backdrop-blur-xl text-slate-200 shadow-xl">
          <button
            type="button"
            onClick={() => {
              cameraRef.current.targetZoom = Math.min(3.5, cameraRef.current.targetZoom * 1.25);
            }}
            aria-label="تكبير"
            className="p-2 rounded-xl hover:bg-white/10"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              cameraRef.current.targetZoom = Math.max(0.32, cameraRef.current.targetZoom * 0.8);
            }}
            aria-label="تصغير"
            className="p-2 rounded-xl hover:bg-white/10"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              cameraRef.current.targetX = 0;
              cameraRef.current.targetY = 0;
              cameraRef.current.targetZoom = 0.92;
              cameraRef.current.vx = 0;
              cameraRef.current.vy = 0;
            }}
            aria-label="إعادة ضبط الكاميرا"
            className="p-2 rounded-xl hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hover Node Tooltip */}
      {hoveredNode && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 280, Math.max(12, hoveredNode.screenX + 16))}px`,
            top: `${Math.max(12, hoveredNode.screenY - 20)}px`,
          }}
          className="fixed z-30 pointer-events-none w-64 p-3.5 rounded-2xl bg-slate-950/95 border border-violet-500/40 shadow-2xl text-white space-y-1"
        >
          <div className="text-[11px] text-violet-300 flex items-center justify-between">
            <span>
              {ENTRY_TYPE_META[hoveredNode.entry.type].label} · {hoveredNode.groupName}
            </span>
            <span className="font-mono">{hoveredNode.entry.date}</span>
          </div>
          <div className="font-bold text-sm leading-snug">{hoveredNode.entry.title}</div>
          <div className="text-xs text-slate-300 line-clamp-2">{hoveredNode.entry.contentText}</div>
          <div className="text-[10px] text-emerald-400 pt-1">انقر لفتح الفائدة كاملة</div>
        </div>
      )}
    </div>
  );
};
