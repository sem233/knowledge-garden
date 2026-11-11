import { NodePosition } from '../types';

/**
 * Checks whether a 2D point (x, y) normalized in [-1, 1] lies inside our
 * two-hemisphere procedural Brain silhouette.
 */
export function isPointInsideBrain(nx: number, ny: number): boolean {
  // Left hemisphere centered at (-0.36, 0), radii (0.48, 0.72)
  // Right hemisphere centered at (+0.36, 0), radii (0.48, 0.72)
  const leftDist = Math.pow((nx + 0.34) / 0.52, 2) + Math.pow(ny / 0.76, 2);
  const rightDist = Math.pow((nx - 0.34) / 0.52, 2) + Math.pow(ny / 0.76, 2);

  // Exclude deep interhemispheric fissure at very top/bottom center
  const inFissure = Math.abs(nx) < 0.045 && Math.abs(ny) > 0.52;
  if (inFissure) return false;

  // Organic cortical gyri modulation on outer boundary
  const angle = Math.atan2(ny, nx);
  const ripple = 0.04 * Math.sin(angle * 12) + 0.025 * Math.cos(angle * 20);

  return leftDist <= 1 + ripple || rightDist <= 1 + ripple;
}

/**
 * Projects any normalized coordinate (nx, ny) back inside the brain silhouette
 */
export function clampToBrainSilhouette(nx: number, ny: number): { nx: number; ny: number } {
  if (isPointInsideBrain(nx, ny)) {
    return { nx, ny };
  }
  const hemisphereCenter = nx < 0 ? -0.34 : 0.34;
  const dx = nx - hemisphereCenter;
  const dy = ny;
  const norm = Math.sqrt(Math.pow(dx / 0.48, 2) + Math.pow(dy / 0.72, 2)) || 1;
  return {
    nx: hemisphereCenter + (dx / norm) * 0.92,
    ny: (dy / norm) * 0.92,
  };
}

/**
 * Deterministically computes hub positions for each group inside the Brain (world radius ~520)
 * and branch tips inside the Knowledge Tree.
 */
export function computeGroupHub(
  groupIndex: number,
  totalGroups: number,
  worldScale = 520
): {
  brainHubX: number;
  brainHubY: number;
  treeBranchX: number;
  treeBranchY: number;
  branchAngle: number;
} {
  const safeTotal = Math.max(1, totalGroups);
  // Distribute groups across left and right hemispheres
  const isLeft = groupIndex % 2 === 0;
  const sideIndex = Math.floor(groupIndex / 2);
  const sideCount = Math.max(1, Math.ceil(safeTotal / 2));

  const verticalSpread = sideCount === 1 ? 0 : ((sideIndex / (sideCount - 1)) - 0.5) * 0.85;
  const rawNx = (isLeft ? -0.36 : 0.36) + (sideIndex % 2 === 0 ? -0.06 : 0.06);
  const rawNy = verticalSpread;

  const clamped = clampToBrainSilhouette(rawNx, rawNy);

  // Tree branch geometry: trunk base at (0, 360), trunk top at (0, 40)
  // Branches fan out from -140 deg to -40 deg (upward fan)
  const fanRatio = safeTotal === 1 ? 0.5 : groupIndex / (safeTotal - 1);
  const branchAngle = (-145 + fanRatio * 110) * (Math.PI / 180);
  const branchLen = 190 + (groupIndex % 3) * 45;
  const treeBranchX = Math.cos(branchAngle) * branchLen * 1.35;
  const treeBranchY = 30 + Math.sin(branchAngle) * branchLen;

  return {
    brainHubX: Math.round(clamped.nx * worldScale),
    brainHubY: Math.round(clamped.ny * worldScale),
    treeBranchX: Math.round(treeBranchX),
    treeBranchY: Math.round(treeBranchY),
    branchAngle,
  };
}

/**
 * Computes initial or incremental node position for an entry around its group hub
 */
export function computeNodePositionForEntry(
  entryId: string,
  groupId: string,
  entryIndexInGroup: number,
  groupIndex: number,
  totalGroups: number,
  seed: number
): NodePosition {
  const hub = computeGroupHub(groupIndex, totalGroups, 520);
  const goldenAngle = 2.399963229728653; // radians
  const theta = entryIndexInGroup * goldenAngle + (seed % 100) * 0.01;
  // Spiral outward gently with sqrt(index) so density stays balanced and clears hub label
  const radius = Math.min(195, 34 + Math.sqrt(entryIndexInGroup + 1) * 11.5);

  const rawBrainX = hub.brainHubX + Math.cos(theta) * radius;
  const rawBrainY = hub.brainHubY + Math.sin(theta) * radius;

  const clamped = clampToBrainSilhouette(rawBrainX / 520, rawBrainY / 520);

  // Canopy cluster around the group's main branch tip
  const canopyRadius = Math.min(95, 22 + Math.sqrt(entryIndexInGroup + 1) * 7.5);
  const treeX = hub.treeBranchX + Math.cos(theta * 1.1) * canopyRadius;
  const treeY = hub.treeBranchY + Math.sin(theta * 1.1) * canopyRadius * 0.72;

  return {
    id: entryId,
    groupId,
    brainX: Math.round(clamped.nx * 520),
    brainY: Math.round(clamped.ny * 520),
    treeX: Math.round(treeX),
    treeY: Math.round(treeY),
    updatedAt: Date.now(),
  };
}
