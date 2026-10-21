import { defaultProject } from './workshop.js';
import { completeListeningRack } from './equipmentProfiles.js';
import { tvConsoleProject } from './workshopTv.js';
import { DEFAULT_ROOM_CABLES } from './roomEquipment.js';

// Share links contain a catalog plan, not the author's editable room snapshot.
export function createRoomPreview(variant = 'rack') {
  const rack = completeListeningRack(defaultProject());
  return { project: variant === 'tv' ? tvConsoleProject(rack) : rack, cables: structuredClone(DEFAULT_ROOM_CABLES) };
}
