"""Dress cables in the polished room; metres, Blender Z-up.

Run on audio-setup-listening-room-polished.blend. The source is preserved.
Routes and wooden supports are a layout proposal, not measured cable products.
XLR at the owner's RELs carries HIGH LEVEL: no line-level or pinout inference.
"""
import bpy, math, json, os
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT.parents[1] / 'artifacts' / 'blender'
scene = bpy.context.scene
scene.name = 'Audio Setup | Dressed cables'
FLOOR = .004  # Upper face of the actual oak boards, not the slab below them.
col = bpy.data.collections.new('11 | Supported cable routes and owner REL connections')
scene.collection.children.link(col)
routes = []

def mat(prefix):
    return next(m for m in bpy.data.materials if m.name.startswith(prefix))

rubber = mat('Soft black cable jacket')
black = mat('Black satin aluminium')
red = mat('Socket red')
silver = mat('Brushed silver aluminium')
wood = mat('Walnut | open pore satin')

def move(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
    return o

def box(name, pos, size, material, bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o=move(bpy.context.object); o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        m=o.modifiers.new('Soft edges','BEVEL');m.width=bevel;m.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def cylinder(name, pos, radius, depth, material, axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=radius,depth=depth,location=pos)
    o=move(bpy.context.object);o.name=name;o.data.materials.append(material)
    if axis=='Y':o.rotation_euler.x=math.pi/2
    for p in o.data.polygons:p.use_smooth=True
    return o

def rounded(points, cut):
    """Quadratic corner fillets stay in the control polygon's convex hull.

    Dense POLY samples export identically: no AUTO-handle undershoot into floor.
    The cut length describes this proposed shape, not a maker's bend limit.
    """
    points=[Vector(p) for p in points];out=[points[0]]
    def line(end):
        start=out[-1].copy();steps=max(1,math.ceil((end-start).length/.008))
        out.extend(start.lerp(end,i/steps) for i in range(1,steps+1))
    for i in range(1,len(points)-1):
        a,b,c=points[i-1:i+2]
        n=min(cut,(b-a).length*.4,(c-b).length*.4)
        enter=b+(a-b).normalized()*n;leave=b+(c-b).normalized()*n
        line(enter)
        steps=max(8,math.ceil(n*2/.003))
        out.extend((1-t)**2*enter+2*(1-t)*t*b+t*t*leave for t in (j/steps for j in range(1,steps+1)))
    line(points[-1])
    return out

def cable(name, points, radius=.004, cut=.09, material=None, kind='signal'):
    samples=rounded(points,cut)
    assert min(p.z for p in samples)-radius >= FLOOR-1e-5, name+' intersects finished floor'
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=radius;d.bevel_resolution=2;d.use_fill_caps=True
    s=d.splines.new('POLY');s.points.add(len(samples)-1)
    for p,v in zip(s.points,samples):p.co=(*v,1)
    o=bpy.data.objects.new(name,d);col.objects.link(o);d.materials.append(material or rubber)
    o['route_kind']=kind;o['layout_status']='Proposed route; exact cable variant and minimum bend radius unmeasured'
    routes.append((o,samples,radius))
    return o

def cradle(x,y,center_z,radius,axis='X'):
    # Concave wooden block with a thin soft seat; cable runs through the trough.
    bottom=FLOOR+.002;seat=center_z-radius;top=seat+.016;half=.034
    profile=[(-half,bottom),(half,bottom),(half,top),(.017,top)]
    for i in range(17):
        t=i/16*math.pi
        profile.append((.017*math.cos(t),top-.016*math.sin(t)))
    profile.append((-half,top))
    verts=[]
    for a in (-.028,.028):
        for b,z in profile:verts.append((x+a,y+b,z) if axis=='X' else (x+b,y+a,z))
    n=len(profile);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    mesh=bpy.data.meshes.new('Concave cable cradle');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Cable support | walnut U cradle',mesh);col.objects.link(o);mesh.materials.append(wood)
    m=o.modifiers.new('Rounded wood','BEVEL');m.width=.001;m.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    box('Cable support | felt sole',(x,y,FLOOR+.001),(.058,.068,.002),rubber,.0005)
    box('Cable support | soft seat',(x,y,seat-.0005),(.050,.014,.001),rubber,.0004)

def support_last_route(x,y,radius):
    # Match the sampled cable, including its small sag, rather than a control point
    # which corner rounding may not pass through. The seat touches the jacket.
    p=min(routes[-1][1],key=lambda p:(p.x-x)**2+(p.y-y)**2)
    cradle(p.x,p.y,p.z,radius)

# Remove only the old electrical cables and their free-floating saddles.
removed=[]
for o in list(scene.objects):
    cable_material=o.type=='CURVE' and any(m and m.name.startswith('Soft black cable jacket') for m in o.data.materials)
    if cable_material or ' | cable saddle' in o.name:
        removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)

# Interconnects stay behind shelf edges; use the existing control route but remove
# uncontrolled Bezier handles. Explicit paths below also keep power in its own lane.
for dx in (0,.025):
    cable('Bifrost to A90 | balanced XLR',[(-.195+dx,-.001,.559),(-.195+dx,.11,.559),(-.195+dx,.34,.559),(.06+dx,.34,.559),(.06+dx,.11,.559),(.06+dx,.014,.559)],.0034)
cable('WiiM to Bifrost | optical',[(.13,-.018,.79),(.13,.10,.79),(.13,.32,.79),(-.087,.34,.68),(-.087,.34,.558),(-.087,.09,.558),(-.087,-.003,.558)],.0022)
for dx in (0,.021):
    cable('A90 to Rusich | RCA',[(.16+dx,.008,.559),(.16+dx,.12,.559),(.16+dx,.33,.559),(.15+dx,.36,.40),(.15+dx,.36,.303),(.15+dx,.151,.303)],.003)
    cable('Skoll to A90 | RCA',[(-.10+dx,-.01,.787),(-.10+dx,.12,.787),(-.10+dx,.36,.787),(.11+dx,.37,.68),(.11+dx,.37,.56),(.11+dx,.018,.56)],.003)
cable('E1 to Skoll | phono',[(-.04,.18,1.285),(-.04,.30,1.285),(-.16,.36,1.21),(-.17,.36,.87),(-.17,.29,.788),(-.17,-.005,.788)],.0035)

# Separate power support frame, attached to the back of the rack with crossarms.
box('Power dressing | vertical rail',(.35,.54,.68),(.018,.022,1.10),black)
for z in (.20,.58,.82,1.17):
    box('Power dressing | post clamp',(.326,.187,z),(.073,.045,.018),black)
    cylinder('Power dressing | clamp bolt',(.337,.187,z+.013),.004,.009,silver)
    box('Power dressing | crossarm',(.35,.3635,z),(.018,.353,.016),black)
    box('Power dressing | padded comb',(.35,.505,z),(.16,.014,.015),rubber)
main_y=[.25-.635/2+.05+i*(.635-.14)/7 for i in range(8)]
for k,(name,x,z,py,radius) in enumerate([
    ('Rusich',-.17,.23,.15,.0055),('Bifrost',-.04,.56,-.01,.005),
    ('A90',.215,.56,.006,.005),('Skoll',-.23,.79,-.01,.0035),
    ('WiiM USB-C',.18,.79,-.02,.002),('E1 DC',.11,1.28,.18,.0022)]):
    lane=.285+k*.024;depth=.47+k*.016;outlet=main_y[k]
    # Horizontal connector exit, supported vertical drop, broad return to PDU.
    cable(name+' | dressed power',[(x,py,z),(x,.28,z),(x,depth,z),(lane,depth,z),
        (lane,depth,.26),(.62+k*.013,depth,.26),(.65+k*.013,outlet,.18+k*.008),
        (.48,outlet,.18+k*.008),(.48,outlet,.12)],radius,.075,kind='power')

# A heavy speaker cable and a separate high-level lead leave each channel's
# SAME binding posts. Red/black labels apply to speaker terminals only.
for side,sign in [('L',-1),('R',1)]:
    amp_plus=-.12 if sign<0 else .09;amp_minus=-.09 if sign<0 else .12
    amp_center=(amp_plus+amp_minus)/2;x=sign*1.1;subx=sign*1.6
    for tx,color,polarity in [(amp_plus,red,'+'),(amp_minus,rubber,'-')]:
        cylinder('Rusich '+side+' | banana '+polarity,(tx,.173,.22),.005,.04,color,'Y')
        cable(side+' | speaker breakout '+polarity,[(tx,.192,.22),(tx,.24,.22),(amp_center,.34,.21)],.0028,.03,material=color)
        # Owner's shared-output connection; no assumed XLR pin assignment.
        cable(side+' | REL takeoff '+polarity,[(tx,.156,.228),(tx,.23,.245),(amp_center,.34,.26)],.0018,.025,material=color,kind='high-level')
    speaker_points=[(amp_center,.34,.21),(amp_center,.48,.21),(sign*.30,.60,.055),
        (sign*.60,.60,.047),(sign*.78,.60,.038),(sign*.98,.60,.047),
        (sign*1.26,.59,.047),(sign*1.34,.43,.049),(x,.30,.080),(x,.27,.13)]
    cable(side+' | AE320 heavy speaker cable',speaker_points,.0065,.13,kind='speaker')
    for supportx in (.60,.98):support_last_route(sign*supportx,.60,.0065)
    for tx,color,polarity in [(x+.015,red,'+'),(x-.015,rubber,'-')]:
        cable('AE320 '+side+' | separate '+polarity,[(x,.27,.13),(tx,.235,.13),(tx,.194,.13)],.0026,.015,material=color,kind='speaker')
        cylinder('AE320 '+side+' | banana '+polarity,(tx,.184,.13),.0044,.027,color,'Y')
    hi_points=[(amp_center,.34,.26),(amp_center,.56,.26),(sign*.25,.80,.052),
        (sign*.76,.80,.050),(sign*1.02,.80,.037),(sign*1.36,.80,.050),
        (subx-.04,.78,.050),(subx-.04,.50,.062),(subx-.04,.35,.135),(subx-.04,.283,.135)]
    cable(side+' | REL HIGH LEVEL to owner XLR',hi_points,.004,.14,kind='high-level')
    for supportx in (.76,1.36):support_last_route(sign*supportx,.80,.004)
    # Update the installed connector proxy; stock passport remains Speakon.
    for o in list(scene.objects):
        if o.name.startswith('REL '+side+' | Neutrik Speakon'):bpy.data.objects.remove(o,do_unlink=True)
    cylinder('REL '+side+' | owner XLR HIGH LEVEL socket',(subx-.04,.218,.135),.013,.018,black,'Y')
    cylinder('REL '+side+' | XLR metal shell',(subx-.04,.242,.135),.0098,.038,silver,'Y')
    cylinder('REL '+side+' | XLR boot',(subx-.04,.272,.135),.007,.027,rubber,'Y')
    box('REL '+side+' | XLR latch',(subx-.04,.246,.145),(.006,.017,.003),black,.001)

# Local mains lies ON the boards behind each REL, with wide flat return bends.
# The wall feeds cross the raised signal lanes underneath, at right angles.
for side,x in [('L',-1.60),('R',1.60)]:
    sign=-1 if x<0 else 1;sx=x+sign*.26;sy=.28
    ys=[sy-.125+.05+i*.055 for i in range(3)]
    cable(side+' | sub mains dressed',[(x+.036,.233,.076),(x+.036,.33,.076),(x+.036,.48,.02),
        (sx,.49,.013),(sx+sign*.14,.39,.013),(sx+sign*.14,ys[0],.06),(sx,ys[0],.17),(sx,ys[0],.12)],.0045,.09,kind='power')
    cable(side+' | lamp mains dressed',[(sx,ys[1],.12),(sx,ys[1],.17),(sx+sign*.17,ys[1],.07),
        (sx+sign*.17,.10,.009),(sx+sign*.16,-.17,.009),(sx,-.17,.009),(sx,-.147,.022)],.003,.07,kind='power')
    cable(side+' | filter wall lead dressed',[(sx,.42,.035),(sx,.52,.016),(sx,.68,.010),
        (sx,.93,.010),(sx,1.012,.08),(sx,1.04,.16),(sx,1.04,.20)],.004,.085,kind='power')
cable('Central PDU | wall feed dressed',[(.48,.568,.035),(.48,.62,.020),(.48,.90,.012),(.48,1.015,.075),(.48,1.04,.15),(.48,1.04,.20)],.0045,.08,kind='power')

# Fail before exporting when geometry intersects the actual finished floor or
# a rack shelf. Test evaluated vertices, not curve bounding boxes (which are padded).
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
checks=[];shelves=[]
for o in scene.objects:
    if (o.name.startswith('Shelf ') and ' x ' in o.name) or o.name.startswith('Planned shelf |'):
        corners=[o.matrix_world @ Vector(v) for v in o.bound_box]
        shelves.append([(min(v[i] for v in corners),max(v[i] for v in corners)) for i in range(3)])
for o,samples,radius in routes:
    e=o.evaluated_get(dg);mesh=e.to_mesh()
    low=min((o.matrix_world @ v.co).z for v in mesh.vertices);e.to_mesh_clear()
    assert low >= FLOOR-.0001,(o.name,low)
    for p in samples:
        assert not any(all(lo-radius+.0003 < p[i] < hi+radius-.0003 for i,(lo,hi) in enumerate(bounds)) for bounds in shelves),o.name+' crosses shelf'
    checks.append({'name':o.name,'kind':o['route_kind'],'floor_clearance_mm':round((low-FLOOR)*1000,2),'length_m':round(sum((b-a).length for a,b in zip(samples,samples[1:])),3)})
scene['sub_connection_status']='Owner confirmed: same Rusich speaker outputs as AE320; HIGH LEVEL into owner XLR at each REL. Pinout unmeasured. Stock Quake passport: Speakon.'
scene['cable_notes']='Rounded convex-hull paths; finished-floor and shelf clearance checked on geometry; proposed support layout, no acoustic-performance claim.'
scene['cable_references']='Pinterest Hi-Fi Cable Elevators 55802482883529658; Nordost FAQs Length; REL High Level connection guide'
scene.render.filepath=str(ROOT/'public/images/listening-room.jpg')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'audio-setup-listening-room-cables.blend'))
(OUT/'cable-routing-report.json').write_text(json.dumps({'removed':removed,'finished_floor_z':FLOOR,'routes':checks,'pinout_verified':False,'layout_measured':False},indent=2),encoding='utf8')
print('CABLE_ROUTES_VALIDATED',len(routes),flush=True)
if os.environ.get('AUDIO_SKIP_RENDER')!='1':
    bpy.ops.render.render(write_still=True)
    print('CABLE_RENDER_DONE',flush=True)

# Same material batching and architectural cutaways as the polished room export.
export=bpy.data.scenes.new('Cable dressed web export');bpy.context.window.scene=export
depsgraph=scene.view_layers[0].depsgraph;groups={}
for o in scene.objects:
    if o.type not in {'MESH','CURVE','FONT','SURFACE'} or o.hide_render or o.name.startswith('Render only |'):continue
    if o.type=='FONT' and o.dimensions.length<.016:continue
    mesh=bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph),depsgraph=depsgraph)
    copy=bpy.data.objects.new(o.name,mesh);copy.matrix_world=o.matrix_world.copy();export.collection.objects.link(copy)
    cutaway=o.name if o.name.startswith('Architecture cutaway') else ''
    if o.name.startswith(('Room | rear plaster wall','Room | back skirting','Wall | recessed vertical seam')):
        cutaway='Cable access | '+o.name
    key=(cutaway,tuple(m.name if m else '' for m in mesh.materials));groups.setdefault(key,[]).append(copy)
for (cutaway,_),items in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1:bpy.ops.object.join()
    items[0].name=cutaway or 'Room | '+(items[0].data.materials[0].name if items[0].data.materials else 'surface')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/listening-room.glb'),export_format='GLB',use_active_scene=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
print('CABLE_EXPORT_DONE',flush=True)
