"""Second cable/photographic pass; run on audio-setup-listening-room-cables.blend.

The previous scene is preserved. Coordinates are metres, Blender Z-up.
Routes and wooden supports are a layout proposal, not measured cable products.
XLR at the owner's RELs carries HIGH LEVEL: no line-level or pinout inference.
"""
import bpy, math, json, os, sys, tempfile
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT.parents[1] / 'artifacts' / 'blender'
# glTF packs roughness channels in temporary images. Keep them in the writable
# project output directory rather than the Windows sandbox's redirected Temp.
export_tmp=OUT/'gltf-temporary'; export_tmp.mkdir(parents=True,exist_ok=True)
tempfile.tempdir=str(export_tmp)
scene = bpy.context.scene
scene.name = 'Audio Setup | Natural cable drape and material study'
FLOOR = .004  # Upper face of the actual oak boards, not the slab below them.
removed=[]
for old in list(scene.collection.children):
    if not old.name.startswith('11 |'): continue
    for o in list(old.objects):
        removed.append(o.name); bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.collections.remove(old)
col = bpy.data.collections.new('12 | Natural drapes, soft clamps and connector details')
scene.collection.children.link(col)
routes = []
sys.path.insert(0, str(Path(__file__).parent))
from natural_room_materials import finish_room
braid, rubber, wood = finish_room(scene, col, OUT/'natural-textures')

def mat(prefix):
    return next(m for m in bpy.data.materials if m.name.startswith(prefix))

black = mat('Black satin aluminium')
red = mat('Socket red')
silver = mat('Brushed silver aluminium')

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

def drape(points):
    """Shape-preserving cubic Hermite interpolation on chord-length parameters.

    Each coordinate is monotone between authored knots: no accidental undershoot
    below boards or behind shelf corners. C1 tangents give continuous broad bends.
    Slack is authored visually, not claimed as a measured elastic-rod simulation.
    """
    p=[Vector(v) for v in points]; h=[(b-a).length for a,b in zip(p,p[1:])]
    assert min(h)>1e-6
    slopes=[(b-a)/length for a,b,length in zip(p,p[1:],h)]
    tangent=[slopes[0].copy()]+[Vector((0,0,0)) for _ in p[1:-1]]+[slopes[-1].copy()]
    for i in range(1,len(p)-1):
        w1=2*h[i]+h[i-1]; w2=h[i]+2*h[i-1]
        for axis in range(3):
            a,b=slopes[i-1][axis],slopes[i][axis]
            tangent[i][axis]=0 if a*b<=0 else (w1+w2)/(w1/a+w2/b)
    out=[p[0]]
    for i,length in enumerate(h):
        steps=max(8,math.ceil(length/.0035))
        for j in range(1,steps+1):
            t=j/steps
            out.append((2*t**3-3*t*t+1)*p[i]+(t**3-2*t*t+t)*length*tangent[i]
                       +(-2*t**3+3*t*t)*p[i+1]+(t**3-t*t)*length*tangent[i+1])
    return out

def cable(name, points, radius=.004, cut=None, material=None, kind='signal'):
    samples=drape(points)
    assert min(p.z for p in samples)-radius >= FLOOR-1e-5, name+' intersects finished floor'
    # Parallel-transported tube frames and arc-length UVs keep the woven sleeve
    # aligned with every bend. A mesh exports exactly as checked, including UVs.
    vertices=[]; faces=[]; lengths=[0]; count=12
    normal=Vector((1,0,0))
    for i,p in enumerate(samples):
        tangent=(samples[min(i+1,len(samples)-1)]-samples[max(0,i-1)]).normalized()
        normal=normal-tangent*normal.dot(tangent)
        if normal.length<.001: normal=tangent.cross(Vector((0,0,1)))
        normal.normalize(); bitangent=tangent.cross(normal).normalized()
        for k in range(count):
            angle=k/count*math.tau
            vertices.append(p+radius*(normal*math.cos(angle)+bitangent*math.sin(angle)))
        if i: lengths.append(lengths[-1]+(p-samples[i-1]).length)
    for i in range(len(samples)-1):
        for k in range(count): faces.append((i*count+k,i*count+(k+1)%count,(i+1)*count+(k+1)%count,(i+1)*count+k))
    d=bpy.data.meshes.new(name); d.from_pydata(vertices,[],faces);d.update()
    uv=d.uv_layers.new(name='Sleeve UV')
    for face in d.polygons:
        face.use_smooth=True
        start=face.index%count
        for j,li in enumerate(face.loop_indices):
            vi=d.loops[li].vertex_index
            uv.data[li].uv=(lengths[vi//count]/.035,(start+(1 if j in (1,2) else 0))/count*2)
    o=bpy.data.objects.new(name,d);col.objects.link(o);d.materials.append(material or (braid if radius>=.003 else rubber))
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

def boot(name, x, y, z, radius, length, material=rubber):
    cylinder(name+' | connector shell',(x,y+length*.36,z),radius*1.6,length*.72,material,'Y')
    for j in range(4):
        cylinder(name+' | flexible boot rib',(x,y+length*.75+j*.0025,z),radius*(1.3-j*.07),.0015,rubber,'Y')

def shelf_clip(x,z,radius):
    # Short padded lip anchored on the rear edge; no tall outrigger frame.
    top=max(h for h in (.172,.534,.7668,.9408,1.2508) if h<z-radius)
    box('Cable clip | shelf attachment',(x,.221,top-.002),(.025,.018,.008),black,.002)
    box('Cable clip | short rear bracket',(x,.237,(top+z-radius)/2),(.025,.006,z-radius-top+.006),black,.001)
    box('Cable clip | edge tab',(x,.247,z-radius-.006),(.025,.062,.010),black,.002)
    box('Cable clip | felt bed',(x,.267,z-radius-.0008),(.02,.025,.0016),rubber,.0005)
    box('Cable clip | soft keeper',(x,.268,z+radius+.001),(.019,.009,.002),rubber,.0006)
    for dx in (-.009,.009):box('Cable clip | side',(x+dx,.268,z),(.002,.009,radius*2+.003),rubber,.0005)

# Curves leave the connector straight, pass over the shelf edge, then hang in
# loose asymmetric U loops. Left/right stereo leads have individual slack.
for k in range(2):
    ax=-.195+k*.034; bx=.06+k*.025; depth=.44+k*.045; low=.397-k*.021
    cable('Bifrost to A90 | hanging balanced XLR',[(ax,-.001,.559),(ax,.09,.559),(ax,.25,.553),
        (ax-.025,depth-.08,.48),(ax+.035,depth,low+.012),(-.015+k*.03,depth+.005,low),
        (bx+.018,depth-.055,.457),(bx,.25,.55),(bx,.08,.559),(bx,.014,.559)],.0034)
    for x,yy in ((ax,0),(bx,.014)):boot('Balanced XLR',x,yy,.559,.005,.043,silver)
cable('WiiM to Bifrost | optical service drape',[(.13,-.018,.79),(.13,.08,.79),(.135,.26,.781),
    (.12,.36,.71),(.035,.405,.61),(-.04,.385,.525),(-.10,.325,.534),(-.087,.25,.552),(-.087,.06,.558),(-.087,-.003,.558)],.0022)
for k,dx in enumerate((0,.021)):
    cable('A90 to Rusich | hanging RCA',[(.16+dx,.008,.559),(.16+dx,.09,.559),(.16+dx,.25,.55),
        (.21+dx,.40+k*.022,.43),(.245+dx,.46+k*.022,.284),(.215+dx,.43+k*.022,.248),
        (.15+dx,.32,.289),(.15+dx,.23,.303),(.15+dx,.151,.303)],.003)
    cable('Skoll to A90 | hanging RCA',[(-.10+dx,-.01,.787),(-.10+dx,.09,.787),(-.10+dx,.26,.78),
        (-.15+dx,.43+k*.022,.68),(-.055+dx,.50+k*.022,.548),(.055+dx,.43+k*.022,.510),
        (.11+dx,.26,.55),(.11+dx,.09,.56),(.11+dx,.018,.56)],.003)
    for x,y,z in ((.16+dx,.008,.559),(.15+dx,.151,.303),(-.10+dx,-.01,.787),(.11+dx,.018,.56)):
        boot('RCA',x,y,z,.0038,.03,silver)
cable('E1 to Skoll | soft phono drop',[(-.04,.18,1.285),(-.04,.25,1.28),(-.08,.34,1.22),
    (-.23,.37,1.02),(-.255,.42,.81),(-.23,.41,.73),(-.18,.33,.758),(-.17,.26,.781),(-.17,.08,.788),(-.17,-.005,.788)],.0035)

# Individual descending arcs; heavy leads rest on padded shelf-edge supports.
main_y=[.25-.635/2+.05+i*(.635-.14)/7 for i in range(8)]
for k,(name,x,z,py,radius) in enumerate([
    ('Rusich',-.17,.23,.15,.0055),('Bifrost',-.04,.56,-.01,.005),
    ('A90',.215,.56,.006,.005),('Skoll',-.23,.79,-.01,.0035),
    ('WiiM USB-C',.18,.79,-.02,.002),('E1 DC',.11,1.28,.18,.0022)]):
    outlet=main_y[k]; floor_z=FLOOR+radius+.0015
    support_z=z-.009
    shelf_clip(x,support_z,radius)
    end_z=.164 if k>=4 else .12
    # Each lead has its own slack, landing point and broad floor return, rather
    # than a mechanically repeated fan. Thin DC leads follow the rear rack post.
    drops=[
        [(-.16,.46,.17),(-.10,.61,.063),(.08,.68,floor_z),(.37,.70,floor_z),(.72,.52,floor_z),(.74,.15,.019),(.62,-.065,.105)],
        [(-.035,.42,.47),(-.02,.53,.29),(.035,.59,.064),(.24,.61,floor_z),(.57,.55,floor_z),(.69,.37,.025),(.63,.085,.13)],
        [(.24,.37,.45),(.32,.43,.24),(.38,.52,.058),(.54,.59,floor_z),(.72,.49,floor_z),(.76,.30,.052),(.65,.14,.176)],
        [(-.25,.42,.65),(-.24,.57,.38),(-.14,.72,.07),(.09,.77,floor_z),(.36,.73,floor_z),(.68,.62,.013),(.82,.41,.047),(.69,.22,.183)],
        [(.277,.31,.738),(.308,.322,.61),(.30,.338,.51),(.328,.345,.32),(.385,.44,.067),(.53,.53,floor_z),(.66,.43,.033),(.61,.29,.16)],
        [(.24,.30,1.245),(.316,.326,1.17),(.324,.337,.985),(.303,.340,.815),(.324,.350,.63),(.326,.361,.38),(.36,.40,.083),(.46,.48,floor_z),(.60,.51,.028),(.64,.415,.118)]
    ]
    cable(name+' | relaxed power arc',[(x,py,z),(x,py+.045,z),(x,.24,support_z+.002),(x,.276,support_z)]
          +drops[k]+[(.515,outlet,end_z+.058),(.48,outlet,end_z+.047),(.48,outlet,end_z)],radius,kind='power')
    boot(name+' power',x,py,z,max(.004,radius),.037)
    if k>=4:
        box(name+' | adapter envelope unmeasured',(.48,outlet,.134),(.035,.047,.058),rubber,.005)
for z in (1.17,.815,.63):
    box('DC dressing | post attachment',(.31,.211,z),(.033,.02,.013),black,.002)
    box('DC dressing | short clip arm',(.319,.268,z),(.016,.108,.006),black,.0015)
    box('DC dressing | loose fabric keeper',(.319,.338,z),(.027,.024,.008),rubber,.002)
for o in list(scene.objects):
    if o.name.startswith(('Main outlet 7 |','Main outlet 8 |')):bpy.data.objects.remove(o,do_unlink=True)

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
    offset=.035 if sign>0 else 0
    speaker_points=[(amp_center,.34,.21),(amp_center+sign*.035,.44,.188),(sign*.30,.57+offset,.080),
        (sign*.51,.60+offset,.023),(sign*.67,.65+offset,.049),(sign*.88,.66+offset,.025),
        (sign*1.07,.59+offset,.052),(sign*1.30,.49+offset,.021),(sign*1.34,.34+offset,.035),
        (x+sign*.05,.28,.10),(x,.27,.13)]
    cable(side+' | AE320 heavy speaker cable',speaker_points,.0065,.13,kind='speaker')
    for sx,sy in ((.67,.65),(1.07,.59)):support_last_route(sign*sx,sy+offset,.0065)
    for tx,color,polarity in [(x+.015,red,'+'),(x-.015,rubber,'-')]:
        cable('AE320 '+side+' | separate '+polarity,[(x,.27,.13),(tx,.235,.13),(tx,.194,.13)],.0026,.015,material=color,kind='speaker')
        cylinder('AE320 '+side+' | banana '+polarity,(tx,.184,.13),.0044,.027,color,'Y')
    hi_points=[(amp_center,.34,.26),(amp_center-sign*.01,.45,.24),(sign*.25,.76+offset,.085),
        (sign*.51,.82+offset,.011),(sign*.88,.85+offset,.037),(sign*1.13,.82+offset,.0095),
        (sign*1.48,.72+offset,.010),(subx-.04,.48,.053),(subx-.04,.35,.115),(subx-.04,.283,.135)]
    cable(side+' | REL HIGH LEVEL to owner XLR',hi_points,.004,.14,kind='high-level')
    support_last_route(sign*.88,.85+offset,.004)
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
scene['cable_notes']='Authored gravity-inspired drapes with shape-preserving cubic interpolation; geometric floor and shelf checks; unmeasured lengths, bend radii and stiffness. No acoustic-performance claim.'
scene['cable_references']='Pinterest 38069559342458139 (shelf support and service loops), 321796335875329656 (loose heavy power arcs), 55802482883529658 (padded wooden risers); Nordost FAQs Length'
scene.render.filepath=str(ROOT/'public/images/listening-room.jpg')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'audio-setup-listening-room-natural.blend'))
(OUT/'natural-cable-report.json').write_text(json.dumps({'removed':removed,'finished_floor_z':FLOOR,'routes':checks,'pinout_verified':False,'layout_measured':False,'method':'Shape-preserving C1 splines with authored slack; evaluated tube vertices and shelf AABBs'},indent=2),encoding='utf8')
print('NATURAL_ROUTES_VALIDATED',len(routes),flush=True)
if os.environ.get('AUDIO_SKIP_RENDER')!='1':
    bpy.ops.render.render(write_still=True)
    print('NATURAL_HERO_RENDER_DONE',flush=True)
    # Rear inspection photograph is a cutaway, matching the web camera mode.
    hero=scene.camera; d=bpy.data.cameras.new('Cable detail'); cam=bpy.data.objects.new('Cable detail',d)
    col.objects.link(cam); cam.location=(1.80,2.95,1.58)
    cam.rotation_euler=(Vector((0,.37,.61))-cam.location).to_track_quat('-Z','Y').to_euler()
    d.lens=39;scene.camera=cam
    hidden=[o for o in scene.objects if o.name.startswith(('Room | rear plaster wall','Room | back skirting','Wall | recessed vertical seam'))]
    for o in hidden:o.hide_render=True
    light=bpy.data.lights.new('Cable inspection | broad bounce','AREA');light.energy=100;light.shape='DISK';light.size=3
    lamp=bpy.data.objects.new('Cable inspection | broad bounce',light);col.objects.link(lamp);lamp.location=(0,2,2.5)
    lamp.rotation_euler=(Vector((0,.2,.4))-lamp.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/'public/images/listening-room-cables.jpg')
    bpy.ops.render.render(write_still=True)
    for o in hidden:o.hide_render=False
    bpy.data.objects.remove(lamp,do_unlink=True)
    scene.camera=hero; scene.render.filepath=str(ROOT/'public/images/listening-room.jpg')
    print('NATURAL_REAR_RENDER_DONE',flush=True)

# Same material batching and architectural cutaways as the polished room export.
export=bpy.data.scenes.new('Natural cables web export');bpy.context.window.scene=export
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
print('NATURAL_EXPORT_DONE',len(export.objects),flush=True)
