import { writeFileSync } from 'node:fs';
import { ROOM_DEVICES, ROOM_PORTS, FREYA_TUBES, GLIVER_CHAIR, DEFAULT_ROOM_CABLES } from '../src/data/roomEquipment.js';
import { cablePaths } from '../src/data/roomWiring.js';
writeFileSync(new URL('./blender/room-layout.json',import.meta.url),JSON.stringify({devices:ROOM_DEVICES,ports:ROOM_PORTS,tubes:FREYA_TUBES,chair:GLIVER_CHAIR,cables:DEFAULT_ROOM_CABLES.map(c=>({...c,paths:cablePaths(c)}))}));
console.log('Shared room layout exported.');
