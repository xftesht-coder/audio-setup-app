"""Refresh cables/renders/export of the saved service scene without remodelling."""
import bpy,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from service_room_wiring import update_wiring
from service_room_export import finish_room
scene=bpy.context.scene
col=bpy.data.collections.new('14 | Refreshed interactive wiring');scene.collection.children.link(col)
layout=json.loads((Path(__file__).parent/'room-layout.json').read_text(encoding='utf8'))
update_wiring(scene,col,layout)
finish_room(scene,col)
