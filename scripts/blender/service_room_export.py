import bpy, os, tempfile
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parents[1]/'artifacts'/'blender'
tempfile.tempdir=str(OUT/'gltf-temporary')

def finish_room(scene,col):
    scene['geometry_status']='Photo-reference reconstruction, not factory CAD. Freya 2 tube cluster right 2x2. Rusich panels from owner PDF; depth provisional. A90 revision unconfirmed.'
    scene['chair_status']='Owner: Gliver DeFrance, milk Vertical velour, 900x1080x850mm. Soft form reconstructed from drawing.'
    scene['interactive_wiring']='10 audio and 8 equipment power cables. Same atlas in Blender and web. Lamp feeds and wall wiring static. REL XLR HIGH LEVEL pinout unknown.'
    hero=scene.camera;hero.location=(2.20,-4.65,1.90);hero.rotation_euler=(Vector((-.20,-.60,.73))-hero.location).to_track_quat('-Z','Y').to_euler();hero.data.lens=28
    hero.data.dof.use_dof=True;hero.data.dof.focus_distance=(Vector((-.20,-.60,.73))-hero.location).length;hero.data.dof.aperture_fstop=9
    scene.render.filepath=str(ROOT/'public/images/listening-room.jpg')
    scene.cycles.samples=160
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'audio-setup-listening-room-service.blend'))
    if os.environ.get('AUDIO_SKIP_RENDER')!='1':
        bpy.ops.render.render(write_still=True);print('SERVICE_HERO_DONE',flush=True)
        d=bpy.data.cameras.new('Equipment rear detail');cam=bpy.data.objects.new('Equipment rear detail',d);col.objects.link(cam);cam.location=(1.25,2.5,1.50)
        cam.rotation_euler=(Vector((0,.18,.70))-cam.location).to_track_quat('-Z','Y').to_euler();d.lens=43;scene.camera=cam
        hidden=[o for o in scene.objects if o.name.startswith(('Room | rear plaster wall','Room | back skirting','Wall | recessed vertical seam'))]
        for o in hidden:o.hide_render=True
        ld=bpy.data.lights.new('Rear detail bounce','AREA');ld.energy=120;ld.shape='DISK';ld.size=3;lo=bpy.data.objects.new('Rear detail bounce',ld);col.objects.link(lo);lo.location=(0,2,2.4);lo.rotation_euler=(Vector((0,0,.6))-lo.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(ROOT/'public/images/listening-room-cables.jpg');bpy.ops.render.render(write_still=True)
        for o in hidden:o.hide_render=False
        bpy.data.objects.remove(lo,do_unlink=True);scene.camera=hero
        print('SERVICE_REAR_DONE',flush=True)
    
    # Keep dynamic audio cables out of glTF: Three.js renders the persisted patch.
    export=bpy.data.scenes.new('Service room web export');bpy.context.window.scene=export;dg=scene.view_layers[0].depsgraph;groups={}
    for o in scene.objects:
        if o.type not in {'MESH','CURVE','FONT','SURFACE'} or o.hide_render or o.get('interactive_cable') or o.name.startswith('Render only |'):continue
        mesh=bpy.data.meshes.new_from_object(o.evaluated_get(dg),depsgraph=dg);copy=bpy.data.objects.new(o.name,mesh);copy.matrix_world=o.matrix_world.copy();export.collection.objects.link(copy)
        cutaway=o.name if o.name.startswith('Architecture cutaway') else ''
        if o.name.startswith(('Room | rear plaster wall','Room | back skirting','Wall | recessed vertical seam')):cutaway='Cable access | '+o.name
        key=(cutaway,tuple(m.name if m else '' for m in mesh.materials));groups.setdefault(key,[]).append(copy)
    for (cutaway,_),items in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        if len(items)>1:bpy.ops.object.join()
        items[0].name=cutaway or 'Room | '+(items[0].data.materials[0].name if items[0].data.materials else 'surface')
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/listening-room.glb'),export_format='GLB',use_active_scene=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    print('SERVICE_EXPORT_DONE',len(export.objects),flush=True)
