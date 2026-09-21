import { MAIN_RACK, EQUIPMENT_PHYSICAL } from './cabinetSpecs.js';

const MM_TO_M = 0.001;
const DROP_HEIGHT = 0.01;
const EXPLODED_TIER_GAP = 0.12;
const EXPLODED_DEVICE_LIFT = 0.06;

// One geometry calculation for rendering and shelf validation. Exploded view is
// an illustration: lift each tier and its equipment without stretching cables.
export function computeCabinetLayout(exploded = false) {
  let y = (MAIN_RACK.legHeight + MAIN_RACK.plinthHeight) * MM_TO_M;
  const shelves = [];
  const drops = [];
  const expectedYByUnit = {};
  let totalHeight = 0;

  MAIN_RACK.tiers.forEach((tier, index) => {
    const offset = exploded ? index * EXPLODED_TIER_GAP : 0;
    const shelfTopY = y + MAIN_RACK.shelfThickness * MM_TO_M;
    shelves.push({ tierId: tier.id, y: y + offset });

    tier.items.forEach(({ equipmentId, x }) => {
      const phys = EQUIPMENT_PHYSICAL[equipmentId];
      const restY = shelfTopY + phys.dims.h * MM_TO_M / 2;
      expectedYByUnit[equipmentId] = restY;
      const position = [
        (x - MAIN_RACK.innerWidth / 2) * MM_TO_M,
        restY + offset + (exploded ? EXPLODED_DEVICE_LIFT : DROP_HEIGHT),
        0,
      ];
      drops.push({
        equipmentId,
        position,
      });
      totalHeight = Math.max(totalHeight, restY + offset + phys.dims.h * MM_TO_M / 2 + (exploded ? EXPLODED_DEVICE_LIFT : 0));
    });

    const tierHeight = Math.max(...tier.items.map(({ equipmentId }) => EQUIPMENT_PHYSICAL[equipmentId].dims.h), 0);
    y = shelfTopY + (tierHeight + tier.clearanceAbove) * MM_TO_M;
  });

  return { shelves, drops, expectedYByUnit, totalHeight, rackHeight: shelves.at(-1).y + MAIN_RACK.shelfThickness * MM_TO_M };
}
