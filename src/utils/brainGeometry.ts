import { NodePosition } from '../types';

/**
 * Checks whether a 2D point (x, y) normalized in [-1, 1] lies inside our
 * two-hemisphere procedural Brain silhouette.
 */
export function isPointInsideBrain(nx: number, ny: number): boolean {
  // Left hemisphere centered at (-0.34, 0), radii (0.52, 0.76)
  // Right hemisphere centered at (+0.34, 0), radii (0.52, 0.76)
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
  // Branches fan out from -145 deg to -35 deg (upward fan)
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
 * Computes initial or incremental node position for an entry around its group hub.
 * Uses an organic multi-lobe Phyllotaxis + Halton volume distribution so that whether
 * there are 25 entries or 20,000 entries, nodes fill the entire cerebral hemisphere
 * and tree canopy volume naturally without ever piling up on a hard circle rim.
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
  const theta = entryIndexInGroup * goldenAngle + (seed % 100) * 0.017;

  // Organic multi-lobed modulation so clusters look like natural brain lobes / tree foliage clouds
  const organicLobe =
    1 +
    0.18 * Math.sin(theta * 3 + groupIndex * 1.3) +
    0.12 * Math.cos(theta * 5 - groupIndex * 0.7);

  let normalizedRadial: number;
  if (entryIndexInGroup < 90) {
    // Smooth outward spiral for the first 90 entries
    normalizedRadial = 0.14 + 0.86 * Math.sqrt((entryIndexInGroup + 1) / 90);
  } else {
    // Low-discrepancy golden-ratio volumetric fill for 90..20,000+ entries so the entire interior is lush
    const u = (entryIndexInGroup * 0.618033988749895 + (seed % 199) * 0.005025) % 1;
    normalizedRadial = 0.12 + 0.88 * Math.sqrt(u);
  }

  const brainRadius = normalizedRadial * 215 * organicLobe;
  const rawBrainX = hub.brainHubX + Math.cos(theta) * brainRadius;
  const rawBrainY = hub.brainHubY + Math.sin(theta) * brainRadius * 1.12;

  const clamped = clampToBrainSilhouette(rawBrainX / 520, rawBrainY / 520);

  // Canopy cluster around the group's main branch tip and sub-branches
  const subBranchCluster = entryIndexInGroup % 5;
  const subOffsetAngle = hub.branchAngle + (subBranchCluster - 2) * 0.36;
  const subOffsetDist = subBranchCluster === 0 ? 0 : 48 + (subBranchCluster % 2) * 28;
  const clusterCenterX =
    hub.treeBranchX + (subBranchCluster === 0 ? 0 : Math.cos(subOffsetAngle) * subOffsetDist);
  const clusterCenterY =
    hub.treeBranchY + (subBranchCluster === 0 ? 0 : Math.sin(subOffsetAngle) * subOffsetDist * 0.8);

  const canopyRadius = normalizedRadial * 128 * organicLobe;
  const treeX = clusterCenterX + Math.cos(theta * 1.13) * canopyRadius * 1.15;
  const treeY = clusterCenterY + Math.sin(theta * 1.13) * canopyRadius * 0.78;

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
