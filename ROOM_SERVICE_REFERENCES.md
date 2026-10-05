# Room service edition · 2026-10-06

The room is a design proposal, not a surveyed interior. Device panels are reconstructed from photographs and the owner's drawing; they are not factory CAD. The source scene is saved separately as `audio-setup-listening-room-service.blend` in the local artifacts directory.

## Equipment references

- [Freya 2](https://www.schiit.com/products/freya_2): [front](https://www.schiit.com/public/upload/images/freya%202%20front%20silver%201920.jpg), [rear](https://www.schiit.com/public/upload/images/freya%202%20rear%201920.jpg). Four 6SN7 tubes in a 2 × 2 cluster on the right when viewed from the front. Two balanced input pairs, three RCA input pairs, one balanced output pair and two RCA output pairs. Switches, indicator strips, tube deck and rear connectors reconstructed from photographs.
- [Bifrost 3](https://www.schiit.com/products/bifrost-3): [rear](https://www.schiit.com/public/upload/images/bifrost%203%20rr%201920.jpg). Modular rear plates, USB-C, optical/coaxial inputs, RCA/XLR outputs. Remains marked as planned / preorder in the owner's inventory.
- [Skoll F](https://www.schiit.com/products/skoll-f): [front](https://www.schiit.com/public/upload/images/skoll%20silver%20front%201920.jpg), [rear](https://www.schiit.com/public/upload/images/skoll%20f%20rr%201920.jpg). Selector buttons, loading indicators, ventilation, RCA/XLR input and output pairs. Power uses an external 24/6 VAC transformer; it must not be confused with a direct mains IEC input.
- [FiiO WARMER R2R gallery](https://www.fiio.com/WARMERR2R_picture), [specification](https://fiio.com/WARMERR2R_parameters): two mechanical VU meters in one broad window, input selector, ventilation, USB-C/optical/coaxial inputs and RCA/XLR outputs. The selector is not a volume control. Tube stage is inside the enclosure.
- Rusich ALEPH PASS A2: the owner's one-page panel drawing, supplied in the conversation. Front 430 × 180 mm with power/protection controls; rear selector, two RCA input pairs, two XLR pairs, left/right speaker terminals and central power inlet. Depth 300 mm remains a provisional envelope. No unknown electrical characteristics are invented.
- A90: the repository's existing manufacturer photograph shows an A90 Discrete. The owner's exact revision remains unconfirmed. Retained as a separate physical component; not silently placed in series with Freya in the comparison presets.
- REL: owner-confirmed shared Rusich speaker outputs with the AE320 pair. At each REL, the owner reports XLR HIGH LEVEL. Pin assignment is unknown; this is not interchangeable with line-level XLR. Stock Quake documentation remains recorded separately.

## Owner chair

Gliver ДеФранс, single seat, 900 W × 1080 D × 850 H mm. Seat depth 650 mm; indicated seat height 350–400 mm. Fabric “Вертикаль велюр”; milk colour confirmed by the owner. Armless floor-standing form, channel seams and velour shading reconstructed from the supplied drawing. No legs or sofa arms were invented. Upholstery microgeometry is an artistic approximation.

## Interactive wiring

`src/data/roomEquipment.js` is the shared device/port atlas. `roomWiring.js` creates the same sampled cable routes for the browser and Blender. Run `node scripts/export-room-layout.mjs` to regenerate `scripts/blender/room-layout.json`, then the Blender builder or refresh script.

Audio and equipment power cables can be disconnected at either end, reconnected, removed, undone or restored. The connector at the free end is preserved; a cable cannot silently acquire a different plug. Line, phono, digital, speaker and power signals remain separate. Occupancy, channel mismatch, stereo-to-mono misuse and signal loops are rejected. PDU connections to WiiM, Skoll and E1 include the specified external supply; E1 voltage remains unconfirmed. Lamp feeds and wall-to-strip runs are static.

Local storage is versioned and restored defensively. JSON export is a record of the patch, not a manufacturing drawing or an electrical safety certificate. Port placement, cable length, flexibility and bend radii are not measured. Scene wiring remains independent of the separate system-planning and cabinet editors, and the UI states this limitation.

Validation includes preset topology, persistent disconnect/reconnect history, connector retention, invalid saved state, finished-floor and shelf clearance, and a traversable rear walking route. Photos show the default patch; edited patches appear in interactive 3D.
