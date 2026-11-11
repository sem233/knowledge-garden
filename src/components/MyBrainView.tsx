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
  isToday: boolean;
  isMatched: boolean;
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
  const [timelineProgress, setTimelineProgress] = useState<number>(100); // 0..100%
  const [isReplaying, setIsReplaying] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{
    entry: KnowledgeEntry;
    groupName: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 0.92, targetX: 0, targetY: 0, targetZoom: 0.92 });
  const morphRef = useRef(0); // 0 = brain, 1 = tree
  const modeRef = useRef<'brain' | 'tree'>(mode);
  modeRef.current = mode;
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const birthAnimRef = useRef<{ id: string; startTime: number } | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const growthStage = useMemo(() => getGrowthStage(entries.length), [entries.length]);

  // Trigger birth shockwave when a new entry is added
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
    }, 85);
    return () => window.clearInterval(interval);
  }, [isReplaying]);

  // Ensure every entry has a stable persisted position; compute missing ones via Web Worker / incremental hub math
  useEffect(() => {
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

  // Filter entries by group and timeline slider
  const visibleEntries = useMemo(() => {
    let list =
      selectedGroupId === 'all'
        ? entries
        : entries.filter((e) => e.groupId === selectedGroupId);

    if (timelineProgress < 100 && list.length > 0) {
      const sortedByDate = [...list].sort((a, b) => a.createdAt - b.createdAt);
      const count = Math.max(1, Math.ceil((timelineProgress / 100) * sortedByDate.length));
      list = sortedByDate.slice(0, count);
    }
    return list;
  }, [entries, selectedGroupId, timelineProgress]);

  // Build render nodes with Brain and Tree coordinates
  const renderNodes: RenderNode[] = useMemo(() => {
    const groupIdxMap = new Map(groups.map((g, i) => [g.id, i]));
    const groupColorMap = new Map(groups.map((g) => [g.id, g.color]));
    const countPerGroup: Record<string, number> = {};

    return visibleEntries.map((e) => {
      const gIdx = groupIdxMap.get(e.groupId) ?? 0;
      const c = countPerGroup[e.groupId] || 0;
      countPerGroup[e.groupId] = c + 1;

      const defaultPos = computeNodePositionForEntry(
        e.id,
        e.groupId,
        c,
        gIdx,
        Math.max(1, groups.length),
        e.style.seed
      );
      const savedPos = positionsMap.get(e.id);

      const contentFactor = Math.min(5, Math.floor(e.contentText.length / 120));
      const highlightFactor = Math.min(4, e.highlightCount * 1.2);
      const radius = 5.5 + contentFactor + highlightFactor;

      return {
        entry: e,
        groupIndex: gIdx,
        groupColor: groupColorMap.get(e.groupId) || `hsl(${e.style.hue}, 80%, 60%)`,
        brainX: savedPos ? savedPos.brainX : defaultPos.brainX,
        brainY: savedPos ? savedPos.brainY : defaultPos.brainY,
        treeX: defaultPos.treeX,
        treeY: defaultPos.treeY,
        x: savedPos ? savedPos.brainX : defaultPos.brainX,
        y: savedPos ? savedPos.brainY : defaultPos.brainY,
        radius,
        isToday: e.date === todayStr,
        isMatched: !hasActiveSearch || searchMatchedIds.has(e.id),
      };
    });
  }, [visibleEntries, groups, positionsMap, todayStr, hasActiveSearch, searchMatchedIds]);

  // Glide camera to newly created node
  useEffect(() => {
    if (!newlyCreatedId) return;
    const targetNode = renderNodes.find((n) => n.entry.id === newlyCreatedId);
    if (targetNode) {
      const tx = mode === 'brain' ? targetNode.brainX : targetNode.treeX;
      const ty = mode === 'brain' ? targetNode.brainY : targetNode.treeY;
      cameraRef.current.targetX = -tx * 1.1;
      cameraRef.current.targetY = -ty * 1.1;
      cameraRef.current.targetZoom = 1.25;
    }
  }, [newlyCreatedId, renderNodes, mode]);

  // Pre-rendered Offscreen Glow Sprite Cache (zero per-frame shadowBlur cost)
  const glowSpritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const getGlowSprite = (color: string): HTMLCanvasElement => {
    const existing = glowSpritesRef.current.get(color);
    if (existing) return existing;
    const off = document.createElement('canvas');
    off.width = 64;
    off.height = 64;
    const octx = off.getContext('2d');
    if (octx) {
      const grad = octx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.28, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = grad;
      octx.beginPath();
      octx.arc(32, 32, 30, 0, Math.PI * 2);
      octx.fill();
    }
    glowSpritesRef.current.set(color, off);
    return off;
  };

  // Main High-FPS Canvas Render Loop with Viewport Culling & Level-Of-Detail (LOD)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const groupHubs = groups.map((g, idx) => ({
      group: g,
      ...computeGroupHub(idx, groups.length, 520),
    }));

    const renderFrame = (now: number) => {
      if (document.hidden) {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Smoothly interpolate camera & mode morph (0 = Brain, 1 = Tree)
      const cam = cameraRef.current;
      cam.x += (cam.targetX - cam.x) * 0.12;
      cam.y += (cam.targetY - cam.y) * 0.12;
      cam.zoom += (cam.targetZoom - cam.zoom) * 0.12;

      const targetMorph = modeRef.current === 'tree' ? 1 : 0;
      morphRef.current += (targetMorph - morphRef.current) * 0.14;
      const m = morphRef.current;

      const centerX = width / 2 + cam.x;
      const centerY = height / 2 + cam.y;

      ctx.translate(centerX, centerY);
      ctx.scale(cam.zoom, cam.zoom);

      const breathing =
        animationIntensity === 'low' ? 1 : 1 + Math.sin(now * 0.0018) * 0.012;
      ctx.scale(breathing, breathing);

      // 1. Draw Neural Brain Silhouette when m < 0.95
      if (m < 0.95) {
        const brainAlpha = (1 - m) * (theme === 'dark' ? 0.35 : 0.25);
        ctx.save();
        ctx.strokeStyle =
          theme === 'dark'
            ? `rgba(139, 92, 246, ${brainAlpha})`
            : `rgba(109, 40, 217, ${brainAlpha})`;
        ctx.lineWidth = 2.5;

        // Left & Right Hemisphere Outlines + Cortical Gyri Folds
        for (const side of [-1, 1]) {
          ctx.beginPath();
          const cx = side * 0.34 * 520;
          const rx = 0.5 * 520;
          const ry = 0.74 * 520;
          for (let a = 0; a <= Math.PI * 2; a += 0.08) {
            const ripple = 1 + 0.025 * Math.sin(a * 8) + 0.015 * Math.cos(a * 14);
            const px = cx + Math.cos(a) * rx * ripple;
            const py = Math.sin(a) * ry * ripple;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle =
            theme === 'dark'
              ? `rgba(30, 27, 75, ${(1 - m) * 0.22})`
              : `rgba(237, 233, 254, ${(1 - m) * 0.45})`;
          ctx.fill();
          ctx.stroke();

          // Decorative Cortical Folds (Sulci)
          ctx.beginPath();
          ctx.strokeStyle =
            theme === 'dark'
              ? `rgba(56, 189, 248, ${(1 - m) * 0.14})`
              : `rgba(79, 70, 229, ${(1 - m) * 0.14})`;
          ctx.lineWidth = 1.4;
          for (let f = -2; f <= 2; f++) {
            const fy = f * 95;
            ctx.moveTo(cx - rx * 0.65, fy);
            ctx.bezierCurveTo(
              cx - rx * 0.2,
              fy - 30 * side,
              cx + rx * 0.2,
              fy + 30 * side,
              cx + rx * 0.65,
              fy
            );
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Draw Procedural Knowledge Tree Trunk & Branches when m > 0.05
      if (m > 0.05) {
        ctx.save();
        ctx.globalAlpha = m;
        const trunkThickness = Math.min(44, 14 + Math.sqrt(entries.length + 1) * 1.8);

        // Ground Hill
        ctx.beginPath();
        ctx.ellipse(0, 385, 290, 36, 0, 0, Math.PI * 2);
        ctx.fillStyle = theme === 'dark' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.2)';
        ctx.fill();

        // Main Trunk ("أنا")
        const trunkGrad = ctx.createLinearGradient(0, 380, 0, 30);
        trunkGrad.addColorStop(0, '#92400E');
        trunkGrad.addColorStop(0.6, '#B45309');
        trunkGrad.addColorStop(1, '#10B981');

        ctx.strokeStyle = trunkGrad;
        ctx.lineCap = 'round';
        ctx.lineWidth = trunkThickness;
        ctx.beginPath();
        ctx.moveTo(0, 380);
        ctx.quadraticCurveTo(8, 200, 0, 40);
        ctx.stroke();

        // Main Group Branches & Secondary Sub-Twigs + Foliage Aura
        for (const gh of groupHubs) {
          // Soft foliage canopy aura around branch tip
          const canopyGrad = ctx.createRadialGradient(
            gh.treeBranchX,
            gh.treeBranchY,
            10,
            gh.treeBranchX,
            gh.treeBranchY,
            125
          );
          canopyGrad.addColorStop(0, `${gh.group.color}26`);
          canopyGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = canopyGrad;
          ctx.beginPath();
          ctx.arc(gh.treeBranchX, gh.treeBranchY, 125, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.strokeStyle = gh.group.color;
          ctx.lineWidth = Math.max(5, trunkThickness * 0.4);
          ctx.moveTo(0, 95);
          ctx.quadraticCurveTo(
            gh.treeBranchX * 0.45,
            gh.treeBranchY + 60,
            gh.treeBranchX,
            gh.treeBranchY
          );
          ctx.stroke();

          // Secondary twigs radiating into the canopy
          for (const twigAngleOffset of [-0.55, 0, 0.55]) {
            const ta = gh.branchAngle + twigAngleOffset;
            const tx = gh.treeBranchX + Math.cos(ta) * 58;
            const ty = gh.treeBranchY + Math.sin(ta) * 48;
            ctx.beginPath();
            ctx.lineWidth = Math.max(2.5, trunkThickness * 0.18);
            ctx.moveTo(gh.treeBranchX, gh.treeBranchY);
            ctx.lineTo(tx, ty);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Viewport bounds in world space for fast culling
      const halfW = (width / 2 + 120) / cam.zoom;
      const halfH = (height / 2 + 120) / cam.zoom;
      const minX = -cam.x / cam.zoom - halfW;
      const maxX = -cam.x / cam.zoom + halfW;
      const minY = -cam.y / cam.zoom - halfH;
      const maxY = -cam.y / cam.zoom + halfH;

      // Update interpolated node positions and collect visible nodes
      const visibleInViewport: RenderNode[] = [];
      for (let i = 0; i < renderNodes.length; i++) {
        const n = renderNodes[i];
        n.x = n.brainX * (1 - m) + n.treeX * m;
        n.y = n.brainY * (1 - m) + n.treeY * m;
        if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
          visibleInViewport.push(n);
        }
      }

      // 3. Level-Of-Detail (LOD): When > 1,500 nodes visible or zoomed far out, render Cluster Bubbles + sample
      const useClusterLOD = visibleInViewport.length > 1500 || (cam.zoom < 0.42 && visibleInViewport.length > 300);

      if (useClusterLOD) {
        // Group cluster summary bubbles with counts + lightweight stars
        for (const gh of groupHubs) {
          const hx = gh.brainHubX * (1 - m) + gh.treeBranchX * m;
          const hy = gh.brainHubY * (1 - m) + gh.treeBranchY * m;
          const groupNodes = visibleInViewport.filter((n) => n.entry.groupId === gh.group.id);
          if (groupNodes.length === 0) continue;

          const clusterRadius = Math.min(130, 32 + Math.sqrt(groupNodes.length) * 2.2);
          ctx.beginPath();
          ctx.arc(hx, hy, clusterRadius, 0, Math.PI * 2);
          ctx.fillStyle = `${gh.group.color}28`;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = gh.group.color;
          ctx.stroke();

          // Draw sampled points inside cluster
          const step = Math.max(1, Math.floor(groupNodes.length / 180));
          ctx.fillStyle = gh.group.color;
          for (let i = 0; i < groupNodes.length; i += step) {
            const pt = groupNodes[i];
            ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
          }

          // Cluster Label & Count
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px Cairo, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(gh.group.name, hx, hy - 4);
          ctx.font = 'bold 13px monospace';
          ctx.fillText(`${groupNodes.length.toLocaleString('en-US')} خلية`, hx, hy + 18);
        }
      } else {
        // 4. Full Detail Mode: Draw Synapses / Branches + Travelling Light Pulses
        const maxSynapseNodes = Math.min(visibleInViewport.length, 450);
        ctx.lineWidth = 1.1;

        for (let i = 0; i < maxSynapseNodes; i++) {
          const n = visibleInViewport[i];
          const gh = groupHubs[n.groupIndex];
          if (!gh) continue;
          const hx = gh.brainHubX * (1 - m) + gh.treeBranchX * m;
          const hy = gh.brainHubY * (1 - m) + gh.treeBranchY * m;

          const alpha = n.isMatched ? 0.24 : 0.05;
          ctx.strokeStyle = `${n.groupColor}${Math.round(alpha * 255)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();

          // Travelling light pulse along synapse
          if (animationIntensity !== 'low' && n.isMatched && i % 3 === 0) {
            const t = ((now * 0.0005 + i * 0.17) % 1);
            const px = hx + (n.x - hx) * t;
            const py = hy + (n.y - hy) * t;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 2.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Connect entries sharing tags (up to 160 pairs)
        for (let i = 0; i < Math.min(visibleInViewport.length, 120); i++) {
          const a = visibleInViewport[i];
          if (a.entry.tags.length === 0) continue;
          for (let j = i + 1; j < Math.min(visibleInViewport.length, 120); j++) {
            const b = visibleInViewport[j];
            const sharesTag = a.entry.tags.some((t) => b.entry.tags.includes(t));
            if (sharesTag) {
              ctx.strokeStyle = 'rgba(168, 85, 247, 0.16)';
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              break;
            }
          }
        }

        // 5. Draw Neurons (Brain) or Leaves/Fruits (Tree) using pre-rendered Glow Sprites
        for (let i = 0; i < visibleInViewport.length; i++) {
          const n = visibleInViewport[i];
          const sprite = getGlowSprite(n.groupColor);
          const pulse = n.isToday ? 1 + Math.sin(now * 0.006) * 0.25 : 1;
          const drawRadius = n.radius * pulse;

          ctx.globalAlpha = n.isMatched ? 1 : 0.18;
          const spriteSize = drawRadius * 4.2;
          ctx.drawImage(
            sprite,
            n.x - spriteSize / 2,
            n.y - spriteSize / 2,
            spriteSize,
            spriteSize
          );

          // Birth Shockwave Ring if this node was just added
          if (birthAnimRef.current && birthAnimRef.current.id === n.entry.id) {
            const elapsed = now - birthAnimRef.current.startTime;
            if (elapsed < 2600) {
              const p = elapsed / 2600;
              const ringR = drawRadius + p * 85;
              ctx.beginPath();
              ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(255, 255, 255, ${1 - p})`;
              ctx.lineWidth = 3 * (1 - p);
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;

        // 6. Draw Group Hubs & Crisp Backdrop Labels on top of nodes so labels are always legible
        for (const gh of groupHubs) {
          const hx = gh.brainHubX * (1 - m) + gh.treeBranchX * m;
          const hy = gh.brainHubY * (1 - m) + gh.treeBranchY * m;

          ctx.beginPath();
          ctx.arc(hx, hy, 12, 0, Math.PI * 2);
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
          const pillY = hy - 38;

          ctx.fillStyle = theme === 'dark' ? 'rgba(11, 15, 26, 0.85)' : 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, 8);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = gh.group.color;
          ctx.stroke();

          ctx.fillStyle = theme === 'dark' ? '#F8FAFC' : '#0F172A';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(gh.group.name, hx, pillY + pillH / 2);
        }
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

  // Mouse Pan, Wheel Zoom, Hover Hit-Testing & Click to open Entry
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    cameraRef.current.targetZoom = Math.min(
      3.5,
      Math.max(0.28, cameraRef.current.targetZoom * factor)
    );
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - cameraRef.current.targetX,
      y: e.clientY - cameraRef.current.targetY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      cameraRef.current.targetX = e.clientX - dragStartRef.current.x;
      cameraRef.current.targetY = e.clientY - dragStartRef.current.y;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cam = cameraRef.current;

    const worldX = (mx - rect.width / 2 - cam.x) / cam.zoom;
    const worldY = (my - rect.height / 2 - cam.y) / cam.zoom;

    let closest: RenderNode | null = null;
    let bestDistSq = 240; // hit threshold squared in world units

    for (let i = 0; i < renderNodes.length; i++) {
      const n = renderNodes[i];
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        closest = n;
      }
    }

    if (closest) {
      const grp = groups.find((g) => g.id === closest!.entry.groupId);
      setHoveredNode({
        entry: closest.entry,
        groupName: grp?.name || 'عام',
        screenX: mx,
        screenY: my,
      });
    } else if (hoveredNode) {
      setHoveredNode(null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const pinchDistRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: t.clientX - cameraRef.current.targetX,
        y: t.clientY - cameraRef.current.targetY,
      };
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
          Math.max(0.28, cameraRef.current.targetZoom * scale)
        );
      }
      pinchDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    pinchDistRef.current = null;
  };

  const handleCanvasClick = () => {
    if (hoveredNode) {
      onOpenEntry(hoveredNode.entry);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden select-none touch-none">
      {/* Interactive WebGL/Canvas Surface */}
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
      <div className="absolute top-3 md:top-5 right-3 md:right-6 left-3 md:left-6 flex flex-wrap items-center justify-between gap-2 md:gap-4 pointer-events-none">
        {/* Brain / Tree Mode Toggle */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/85 border border-slate-700/80 backdrop-blur-xl shadow-2xl">
          <button
            type="button"
            onClick={() => setMode('brain')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'brain'
                ? 'bg-gradient-to-l from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>الدماغ العصبي الحي</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('tree')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'tree'
                ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Trees className="w-4 h-4" />
            <span>شجرة المعرفة النامية</span>
          </button>
        </div>

        {/* Group Filter Pills */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/85 border border-slate-700/80 backdrop-blur-xl overflow-x-auto max-w-full md:max-w-xl">
          <button
            type="button"
            onClick={() => setSelectedGroupId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              selectedGroupId === 'all'
                ? 'bg-white/15 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            كل المجموعات ({entries.length})
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroupId(g.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
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

      {/* Floating Stats & Growth Stage Panel (Right Bottom on Desktop, compact on Mobile) */}
      <div className="hidden sm:block absolute bottom-20 lg:bottom-6 right-4 md:right-6 w-72 md:w-80 p-4 md:p-5 rounded-3xl bg-slate-900/88 border border-slate-700/80 backdrop-blur-xl shadow-2xl text-white space-y-4 pointer-events-auto">
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

        {/* Progress Bar to Next Stage */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>التقدم للمرحلة القادمة</span>
            <span className="font-mono">
              {entries.length} / {growthStage.nextMilestone}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-violet-500 via-sky-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${growthStage.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Key Metrics Grid */}
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

      {/* Bottom Left: "شاهد نموّك" Timeline Slider + Camera Zoom Controls */}
      <div className="absolute bottom-20 lg:bottom-6 left-3 md:left-6 right-3 sm:right-auto flex flex-wrap items-center justify-between sm:justify-start gap-2 md:gap-3 pointer-events-auto">
        {/* Timeline Replay Bar */}
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl bg-slate-900/88 border border-slate-700/80 backdrop-blur-xl text-white shadow-xl">
          <button
            type="button"
            onClick={() => {
              if (timelineProgress >= 100) setTimelineProgress(5);
              setIsReplaying((r) => !r);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold whitespace-nowrap"
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
            className="w-24 md:w-36 accent-violet-500 cursor-pointer"
          />
          <span className="text-xs font-mono text-slate-300 w-9 text-left">
            {timelineProgress}%
          </span>
        </div>

        {/* Zoom & Reset Controls */}
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
              cameraRef.current.targetZoom = Math.max(0.28, cameraRef.current.targetZoom * 0.8);
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
            left: `${Math.min( window.innerWidth - 320, Math.max(16, hoveredNode.screenX + 16))}px`,
            top: `${Math.max(16, hoveredNode.screenY - 20)}px`,
          }}
          className="fixed z-30 pointer-events-none w-64 p-3.5 rounded-2xl bg-slate-950/95 border border-violet-500/40 shadow-2xl text-white space-y-1"
        >
          <div className="text-[11px] text-violet-300 flex items-center justify-between">
            <span>{ENTRY_TYPE_META[hoveredNode.entry.type].label} · {hoveredNode.groupName}</span>
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
