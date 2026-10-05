"""Polish the saved listening room, preserving its equipment and source .blend.
Blender --background audio-setup-listening-room.blend --python this_file.
Image-based PBR materials are shared by Cycles and the glTF export.
The architecture and furniture are a design proposal, not measured owner property.
"""
import bpy, math, json, random, os
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT.parents[1] / 'artifacts' / 'blender'
TEX = OUT / 'polished-textures'
TEX.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.name = 'Audio Setup | Polished listening room'
random.seed(61)
rng = np.random.default_rng(61)
col = bpy.data.collections.new('10 | Interior finishing and practical lighting')
scene.collection.children.link(col)

def move(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
    return o

def material(name, rgb, rough=.5, metal=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*rgb, 1)
    return m

def image(name, data, color=True):
    h, w = data.shape[:2]
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = data[:, :, None] if data.ndim == 2 else data
    im = bpy.data.images.new(name, width=w, height=h)
    if not color: im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(np.clip(rgba, 0, 1).ravel())
    im.filepath_raw = str(TEX / (name.replace('|', '-') + '.png')); im.file_format = 'PNG'; im.save(); im.pack()
    return im

def textured(name, color, height, rough=.6, normal_strength=.25, sheen=0):
    m = material(name, (.5, .5, .5), rough)
    nt = m.node_tree; p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = image(name+' color', color)
    nt.links.new(n.outputs['Color'], p.inputs['Base Color'])
    dy, dx = np.gradient(height)
    normals = np.dstack((-dx*12, -dy*12, np.ones_like(dx)))
    normals /= np.linalg.norm(normals, axis=2)[:, :, None]
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = image(name+' normal', normals*.5+.5, False)
    normal = nt.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = normal_strength
    nt.links.new(n.outputs['Color'], normal.inputs['Color']); nt.links.new(normal.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Sheen Weight'].default_value = sheen
    return m

def box(name, xyz, dims, mat, bevel=.005):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    o = bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=4
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return move(o)

def cylinder(name, xyz, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=xyz)
    o=bpy.context.object; o.name=name; o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth=True
    return move(o)

def area(name, pos, target, power, size, color, size_y=None):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color
    d.shape='RECTANGLE'; d.size=size; d.size_y=size_y or size
    o=bpy.data.objects.new(name,d); col.objects.link(o); o.location=pos
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o

def replace(o, mat):
    o.data.materials.clear(); o.data.materials.append(mat)

def world_uv(o, scales=(1,1,1)):
    if o.type!='MESH': return
    uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
    for poly in o.data.polygons:
        axis=max(range(3), key=lambda i:abs(poly.normal[i]))
        a,b={0:(1,2),1:(0,2),2:(1,0)}[axis]
        for li in poly.loop_indices:
            v=o.matrix_world @ o.data.vertices[o.data.loops[li].vertex_index].co
            uv.data[li].uv=(v[a]*scales[a],v[b]*scales[b])

# Fine wood fibres, broad growth rings and pores. Embedded textures survive glTF.
n=256
u,v=np.meshgrid(np.linspace(0,1,n),np.linspace(0,1,n))
warp=v+.016*np.sin(u*5)+.005*np.sin(u*15+v*9)
growth=np.sin(warp*80+1.1*np.sin(u*7))
fx,fy=np.meshgrid(np.fft.fftfreq(n),np.fft.fftfreq(n))
fibres=np.fft.ifft2(np.fft.fft2(rng.normal(0,1,(n,n)))*np.exp(-((fx/.024)**2+(fy/.35)**2))).real
fibres/=max(.01,fibres.std())
wood_height=.5+.025*growth+.018*fibres
grain=np.clip(.90+.025*growth+.025*fibres,.72,1.04)
oak=textured('Oak | oiled growth rings',np.dstack([grain*.55,grain*.405,grain*.27]),wood_height,.48,.09)
walnut=textured('Walnut | open pore satin',np.dstack([grain*.31,grain*.175,grain*.083]),wood_height,.36,.08)
weave=(np.sin(u*math.tau*80)*np.sin(v*math.tau*80))*.11+rng.normal(0,.075,(n,n))
wool_color=np.clip(.82+weave*.11,0,1)
wool=textured('Quincey | ivory woven wool PBR',np.dstack([wool_color,wool_color*.985,wool_color*.95]),weave,.92,.75,.35)
linen_color=np.clip(.73+weave*.17,0,1)
linen=textured('Natural linen | visible weave',np.dstack([linen_color,linen_color*.92,linen_color*.8]),weave,.82,.5,.22)
plaster_noise=rng.normal(0,.05,(n,n))
plaster=textured('Limewash | mineral microtexture',np.dstack([.64+plaster_noise*.08,.61+plaster_noise*.08,.55+plaster_noise*.08]),plaster_noise,.91,.035)
fabric=textured('Sofa | oatmeal boucle',np.dstack([linen_color*.87,linen_color*.84,linen_color*.76]),weave,.96,.7,.3)
bronze=material('Lighting | brushed bronze',(.20,.125,.058),.29,.78)
frame=material('Window | charcoal powdercoat',(.025,.029,.026),.39,.35)
paint=material('Ceiling | chalk white',(.79,.775,.74),.86)
diffuser=material('Pendant | warm opal',(.93,.78,.55),.36)
p=next(n for n in diffuser.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); p.inputs['Emission Color'].default_value=(1,.75,.43,1);p.inputs['Emission Strength'].default_value=3
glass=material('Window | clear glass',(.83,.90,.96),.035)
p=next(n for n in glass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED');p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.45

for o in list(scene.objects):
    if o.type not in {'MESH','CURVE','FONT'}: continue
    names=' '.join(m.name for m in o.data.materials if m)
    if o.name.startswith('Oak |'):
        replace(o,oak); world_uv(o,(1,.55,1))
    elif 'Walnut |' in names:
        replace(o,walnut); world_uv(o,(1.5,6,8))
    elif o.name.startswith('Quincey |'):
        replace(o,wool);world_uv(o,(4,4,4))
    elif 'Linen lampshade' in names:
        replace(o,linen);world_uv(o,(3,3,3))
    elif 'Warm mineral plaster' in names:
        replace(o,plaster);world_uv(o,(2,2,2))
    if o.name.startswith('AE320') and 'piano black enclosure' in o.name:
        p=next(n for n in o.data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        p.inputs['Base Color'].default_value=(.002,.0024,.003,1)
        p.inputs['Roughness'].default_value=.075;p.inputs['Coat Weight'].default_value=.48
        p.inputs['Coat Roughness'].default_value=.055

# Delicate fibre geometry is kept in the editable scene and rendered in Cycles.
# The web model uses woven normal maps and the existing sculpted pile instead.
d=bpy.data.curves.new('Quincey | fine wool flyaway fibres','CURVE'); d.dimensions='3D';d.bevel_depth=.00017;d.bevel_resolution=0
for _ in range(11000):
    x=random.uniform(-1.47,1.47);y=random.uniform(-2.75,-.79);z=.0185
    s=d.splines.new('POLY');s.points.add(2)
    for p,xyz in zip(s.points,[(x,y,z),(x+.0007,y+.0005,z+.004),(x+.0013,y-.0006,z+random.uniform(.004,.008))]):p.co=(*xyz,1)
o=bpy.data.objects.new('Render only | fine wool fibres',d);col.objects.link(o);d.materials.append(wool)

# Complete the enclosure for first-person viewing. Window opening is actual geometry.
# These three surfaces can be hidden in the web overview, while remaining in walk mode.
box('Architecture cutaway | ceiling',(0,-1.9,2.86),(5.4,6,.12),paint)
box('Architecture cutaway | listener wall',(0,-4.97,1.4),(5.4,.14,2.8),plaster)
box('Architecture cutaway | right wall',(2.77,-1.9,1.4),(.14,6,2.8),plaster)
old=scene.objects.get('Room | left plaster wall')
if old: bpy.data.objects.remove(old,do_unlink=True)
# Window on the left: y=-3.65..-1.05, z=.55..2.55.
for name,pos,dims in [
    ('lower',(-2.77,-2.35,.275),(.14,2.6,.55)),('upper',(-2.77,-2.35,2.675),(.14,2.6,.25)),
    ('front',(-2.77,.025,1.4),(.14,2.15,2.8)),('back',(-2.77,-4.275,1.4),(.14,1.25,2.8))]:
    box('Window wall | '+name,pos,dims,plaster)
for yy in (-3.65,-2.35,-1.05):box('Window | vertical mullion',(-2.735,yy,1.55),(.065,.034,2.04),frame,.001)
for zz in (.55,2.55):box('Window | horizontal frame',(-2.735,-2.35,zz),(.065,2.66,.04),frame,.001)
box('Window | sill',(-2.64,-2.35,.53),(.28,2.75,.055),paint,.005)
box('Window | glass',(-2.79,-2.35,1.55),(.009,2.56,1.96),glass,.001)
sky=material('Window | soft garden daylight',(.65,.76,.80),1)
p=next(n for n in sky.node_tree.nodes if n.type == 'BSDF_PRINCIPLED');p.inputs['Emission Color'].default_value=(.72,.85,1,1);p.inputs['Emission Strength'].default_value=.45
box('Exterior | daylight backdrop',(-3.18,-2.35,1.6),(.03,3.2,2.6),sky,0)
# Curtain folds are a continuous drape, rather than a stack of cylinders.
for yy in (-3.65,-1.05):
    verts=[];faces=[];nx,nz=70,12
    for j in range(nz+1):
        for i in range(nx+1):
            q=i/nx;verts.append((-2.59+.035*math.cos(q*math.tau*8),yy+(q-.5)*.48,.14+j/nz*2.52+.009*math.cos(q*math.tau*8)))
    for j in range(nz):
        for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    mesh=bpy.data.meshes.new('Linen pleats');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Window | linen curtain',mesh);col.objects.link(o);mesh.materials.append(linen)
    for p in mesh.polygons:p.use_smooth=True
    world_uv(o,(3,3,3))
for x in (-2.685,2.685):box('Room | perimeter skirting',(x,-1.9,.045),(.025,6,.09),paint,.003)
box('Room | listener skirting',(0,-4.89,.045),(5.4,.025,.09),paint,.003)

# A listening sofa gives a useful destination when turning around.
box('Listening sofa | low base',(0,-4.17,.23),(2.15,.87,.25),fabric,.09)
box('Listening sofa | backrest',(0,-4.53,.66),(2.17,.18,.73),fabric,.085)
for x in (-1.035,1.035):box('Listening sofa | arm',(x,-4.14,.52),(.19,.92,.47),fabric,.08)
for x in (-.47,.47):
    box('Listening sofa | seat cushion',(x,-4.12,.445),(.92,.74,.18),fabric,.065)
    o=box('Listening sofa | back cushion',(x,-4.40,.74),(.92,.18,.48),linen,.075);o.rotation_euler.x=math.radians(-8)
for o in col.objects:
    if o.name.startswith('Listening sofa'):world_uv(o,(5,5,5))

# Suspended double-ring luminaire: unbranded proposed fixture, not a Govee passport.
for radius,z,xx in [(.56,2.36,-.20),(.34,2.18,.27)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.012,major_segments=96,minor_segments=10,location=(xx,-1.65,z))
    o=move(bpy.context.object);o.name='Pendant | bronze ring';o.data.materials.append(bronze)
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.006,major_segments=96,minor_segments=8,location=(xx,-1.65,z-.011))
    o=move(bpy.context.object);o.name='Pendant | luminous underside';o.data.materials.append(diffuser)
    for angle in (0,math.tau/3,2*math.tau/3):
        cylinder('Pendant | suspension',(xx+math.cos(angle)*radius,-1.65+math.sin(angle)*radius,(2.8+z)/2),.0009,2.8-z,frame)
    area('Pendant | warm downlight',(xx,-1.65,z-.035),(xx,-1.65,0),32,radius*1.5,(1,.75,.47))
cylinder('Pendant | ceiling rose',(0,-1.65,2.792),.115,.016,bronze)

# Replace the old flat studio fill with daylight entering the architectural opening.
for o in list(scene.objects):
    if o.type=='LIGHT' and o.name.startswith(('Window |','Lacquer |')):bpy.data.objects.remove(o,do_unlink=True)
area('Daylight | soft window key',(-2.61,-2.35,1.78),(.5,-.3,.7),380,2.35,(.91,.95,1),1.8)
area('Daylight | gentle front bounce',(1.3,-3.5,2.5),(0,0,.8),70,2.4,(1,.88,.71),1.7)
area('Lacquer | warm vertical edge',(2.42,-.7,1.65),(0,0,.65),35,.35,(1,.86,.66),1.8)
bg=next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND');bg.inputs[0].default_value=(.56,.66,.78,1);bg.inputs[1].default_value=.12
scene.camera.location=(2.36,-4.24,1.72)
scene.camera.rotation_euler=(Vector((0,-.20,1.03))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.lens=30
scene.camera.data.dof.use_dof=True;scene.camera.data.dof.focus_distance=4.1;scene.camera.data.dof.aperture_fstop=8
for o in col.objects:
    if o.type=='MESH' and any(m==plaster for m in o.data.materials):world_uv(o,(3,3,3))
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True
scene.cycles.adaptive_threshold=.025;scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=4
scene.render.resolution_x=1800;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=93
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.3
scene.render.filepath=str(ROOT/'public/images/listening-room.jpg')
scene['polish_notes']='Image-based wood and cloth PBR, sculpted wool, complete room, curtains, suspended lamp and listening sofa. Interior concept, no new verified Govee model.'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'audio-setup-listening-room-polished.blend'))
print('POLISHED_SCENE_SAVED',flush=True)
if os.environ.get('AUDIO_SKIP_RENDER')!='1':
    bpy.ops.render.render(write_still=True)
    print('POLISHED_RENDER_DONE',flush=True)

# Web export keeps architecture groups separate so overview cutaway does not remove
# walls, floor or obstacles from walking mode. Smaller objects are merged by material.
export=bpy.data.scenes.new('Polished web export');bpy.context.window.scene=export
depsgraph=scene.view_layers[0].depsgraph;groups={}
for o in scene.objects:
    if o.type not in {'MESH','CURVE','FONT','SURFACE'} or o.hide_render or o.name.startswith('Render only |'):continue
    if o.type=='FONT' and o.dimensions.length<.016:continue
    mesh=bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph),depsgraph=depsgraph)
    copy=bpy.data.objects.new(o.name,mesh);copy.matrix_world=o.matrix_world.copy();export.collection.objects.link(copy)
    cutaway=o.name if o.name.startswith('Architecture cutaway') else ''
    key=(cutaway,tuple(m.name if m else '' for m in mesh.materials));groups.setdefault(key,[]).append(copy)
for (cutaway,_),items in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1:bpy.ops.object.join()
    items[0].name=cutaway or 'Room | '+(items[0].data.materials[0].name if items[0].data.materials else 'surface')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/listening-room.glb'),export_format='GLB',use_active_scene=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
report={'source_scene':scene.name,'objects':len(scene.objects),'web_meshes':len(export.objects),'textures':len(list(TEX.glob('*.png'))),'rug_mm':[3000,2000],'room_measured':False,'room_blender_bounds':[-2.7,2.7,-4.9,1.1],'walk_eye_height_m':1.63,'web_axes':'x=Blender x; y=Blender z; z=-Blender y'}
(OUT/'polish-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('POLISHED_EXPORT_DONE',flush=True)
