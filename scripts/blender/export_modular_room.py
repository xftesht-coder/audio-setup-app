"""Preserve the atelier source; export independently movable detailed devices.
Room 6 x 3.3 m and beige sofa 2.1 x 1.08 m: owner dimensions, 20 Oct 2026.
Run against audio-setup-listening-room-atelier.blend. No source is overwritten.
"""
import bpy, json, math, tempfile
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parents[1]/'artifacts'/'blender'
tempfile.tempdir=str(OUT/'gltf-temporary')
source=bpy.context.scene
devices=json.loads((Path(__file__).parent/'room-layout.json').read_text(encoding='utf8'))['devices']
device_map={d['id']:d for d in devices}
export=bpy.data.scenes.new('Audio Setup | Modular room 6 x 3.3 m')
bpy.context.window.scene=export
groups={}; classified={}; omitted=[]
architecture=Matrix.Translation((0,.485,0)) @ Matrix.Diagonal((6/5.4,.55,1,1))

def classify(o):
    n=o.name.lower()
    if o.hide_render or o.get('interactive_cable') or n.startswith(('render only','interactive','cable clip','cable support','dc dressing','central pdu','main wall','graphite rack','shelf ','new shelf','planned shelf','recessed top','adjustable isolation','silver foot')): return None
    for id in ['freya','warmer','skoll','bifrost','a90','rusich','wiim','e1']:
        if n.startswith(id) or id=='a90' and n.startswith('topping a90'): return 'Device_'+id
    if n.startswith(('panel','schiit')):
        p=o.matrix_world.translation
        id=min(['freya','warmer','skoll','bifrost','a90','rusich','wiim','e1'],key=lambda id:sum(((p[i]-device_map[id]['center'][i])/max(device_map[id]['size'][i],.06))**2 for i in range(3)))
        return 'Device_'+id
    if n.startswith('ae320'):return 'Device_ae'+('0' if 'left' in n or 'ae320 l ' in n else '1')
    if n.startswith('rel'):return 'Device_rel'+('0' if ' l ' in n or n.startswith('rel l') or n.startswith('rel quake l') else '1')
    if n.startswith('brennenstuhl'):return 'Device_pdu'
    for side,i in [('l',0),('r',1)]:
        if n.startswith((side+' |','lamp '+side,'smart lamp '+side)):return 'Device_side'+str(i)
    if n.startswith('gliver'):return 'Gliver'
    if n.startswith('quincey'):return 'Rug'
    if n.startswith('pendant'):return 'Pendant'
    if n.startswith('architecture cutaway'):return 'Cutaway_'+('ceiling' if 'ceiling' in n else 'listener' if 'listener' in n else 'right')
    if n.startswith(('room | rear','room | back','wall |')):return 'RearWall'
    if n.startswith(('room','window','oak','exterior')):return 'Architecture'
    return None

dg=source.view_layers[0].depsgraph
for o in source.objects:
    if o.type not in {'MESH','CURVE','FONT','SURFACE'}:continue
    category=classify(o)
    if not category:omitted.append(o.name);continue
    mesh=bpy.data.meshes.new_from_object(o.evaluated_get(dg),depsgraph=dg)
    matrix=o.matrix_world.copy()
    if category in ['Architecture','RearWall'] or category.startswith('Cutaway'):matrix=architecture @ matrix
    elif category=='Rug':matrix=Matrix.Translation((0,.77,0)) @ matrix
    elif category=='Gliver':matrix=Matrix.Translation((2.15,2.3202,0)) @ matrix
    elif category=='Pendant':matrix=Matrix.Translation((0,.85,0)) @ matrix
    mesh.transform(matrix)
    copy=bpy.data.objects.new(o.name,mesh);export.collection.objects.link(copy)
    key=(category,tuple(m.name if m else '' for m in mesh.materials));groups.setdefault(key,[]).append(copy)
    classified[category]=classified.get(category,0)+1

# Soft slipcover, two seat cushions and two back cushions; owner footprint.
# The detailed shape and height are visual reconstruction, not factory CAD.
fabric=bpy.data.materials['Natural linen | visible weave'].copy();fabric.name='BACKABRO | beige woven slipcover'
bs=next(n for n in fabric.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Sheen Weight'].default_value=.52;bs.inputs['Sheen Roughness'].default_value=.8
bs.inputs['Roughness'].default_value=.87;bs.inputs['Specular IOR Level'].default_value=.18
for n in fabric.node_tree.nodes:
    if n.type=='NORMAL_MAP':n.inputs['Strength'].default_value=.20
seam=fabric.copy();seam.name='BACKABRO | piping and seam'
def softbox(name,pos,size,radius,rotation=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name='Sofa_'+name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=o.modifiers.new('Soft padded edges','BEVEL');bevel.width=radius;bevel.segments=6
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Small continuous cloth deformations avoid perfectly manufactured pillows.
    if 'cushion' in name:
        sub=o.modifiers.new('Upholstery surface','SUBSURF');sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name)
        for v in o.data.vertices:
            v.co.z += .0023*math.sin(v.co.x*31+v.co.y*12)*math.sin(v.co.y*22)
    o.rotation_euler.x=rotation
    for face in o.data.polygons:face.use_smooth=True
    o.modifiers.new('Upholstery normals','WEIGHTED_NORMAL')
    o.data.materials.append(fabric)
    # Stable world-scale weave, not a stretched image per cushion.
    uv=o.data.uv_layers.active
    for face in o.data.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]));a,b={0:(1,2),1:(0,2),2:(0,1)}[axis]
        for li in face.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(co[a]*5,co[b]*5)
    return o
softbox('slipcover base',(0,-1.62,.215),(2.04,1.04,.37),.055)
softbox('rear backrest',(0,-2.045,.55),(1.88,.23,.60),.07)
for s in [-1,1]:
    softbox('rolled arm '+str(s),(s*.955,-1.62,.43),(.19,1.08,.58),.087)
    softbox('seat cushion '+str(s),(s*.447,-1.49,.425),(.884,.76,.17),.065)
    softbox('back cushion '+str(s),(s*.443,-1.913,.662),(.89,.205,.42),.073,-.12)
    # Sewn hem follows the seat perimeter and gives the slipcover a readable edge.
    pts=[]
    for i in range(81):
        a=i/80*math.tau
        pts.append((s*.447+.416*math.copysign(abs(math.cos(a))**.25,math.cos(a)),-1.49+.35*math.copysign(abs(math.sin(a))**.25,math.sin(a)),.464))
    curve=bpy.data.curves.new('Sofa piping','CURVE');curve.dimensions='3D';curve.bevel_depth=.0014;curve.bevel_resolution=2
    sp=curve.splines.new('POLY');sp.points.add(len(pts)-1)
    for p,xyz in zip(sp.points,pts):p.co=(*xyz,1)
    obj=bpy.data.objects.new('Sofa_piping',curve);export.collection.objects.link(obj);curve.materials.append(seam)

# Group by semantic unit AND material: retain efficiency without welding devices.
for (category,_),items in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1:bpy.ops.object.join()
    items[0].name=category+'__'+(items[0].data.materials[0].name if items[0].data.materials else 'surface')
export.unit_settings.system='METRIC'
export['dimensions']='Owner room 6000 x 3300 mm. Height 2800 mm assumed. TV on 6m wall.'
export['sofa']='Owner footprint 2100 x 1080 mm, beige. BACKABRO version unconfirmed; soft form reconstructed.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'audio-setup-room-modular.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/listening-room-modular.glb'),export_format='GLB',use_active_scene=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
(OUT/'modular-export-audit.json').write_text(json.dumps({'groups':classified,'omitted':omitted,'exportObjects':len(export.objects)},ensure_ascii=False,indent=2),encoding='utf8')
print('MODULAR_ROOM_EXPORTED',len(export.objects),flush=True)
