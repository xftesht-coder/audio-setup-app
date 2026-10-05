"""Photo-referenced panels, owner Gliver chair and patchable room.
Run against audio-setup-listening-room-natural.blend. Never overwrites source.
Generate room-layout.json with scripts/export-room-layout.mjs before running.
Panel coordinates are photograph-derived; unknown dimensions remain labelled.
"""
import bpy, math, json, os, tempfile, sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parents[1]/'artifacts'/'blender'
tempfile.tempdir=str(OUT/'gltf-temporary')
layout=json.loads((Path(__file__).parent/'room-layout.json').read_text(encoding='utf8'))
devices={d['id']:d for d in layout['devices']}
ports={p['id']:p for p in layout['ports']}
scene=bpy.context.scene
scene.name='Audio Setup | Photo panels and Gliver service room'
col=bpy.data.collections.new('13 | Photo-referenced equipment and owner chair')
scene.collection.children.link(col)

def move(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o);return o

def mat(prefix):return next(m for m in bpy.data.materials if m.name.startswith(prefix))
silver=mat('Brushed silver aluminium'); black=mat('Black satin aluminium')
rubber=mat('Soft black cable jacket');gold=mat('Gold connectors'); red=mat('Socket red')
braid=next((m for m in bpy.data.materials if 'graphite woven' in m.name.lower()),rubber)

def material(name,color,rough=.4,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m
ink=material('Equipment | silk screen graphite',(.025,.03,.031),.6)
white=material('Equipment | printed off white',(.75,.76,.69),.65)
cream=material('WARMER | warm analogue scale',(.78,.45,.16),.5)
p=next(n for n in cream.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Emission Color'].default_value=(.65,.31,.07,1);p.inputs['Emission Strength'].default_value=.22
glass=material('6SN7 | clear glass',(.95,.99,1),.07)
p=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.47
plate=material('6SN7 | graphite anode',(.085,.077,.067),.37,.6)
glow=material('6SN7 | small heater glow',(.5,.13,.015),.45)
p=next(n for n in glow.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Emission Color'].default_value=(1,.19,.012,1);p.inputs['Emission Strength'].default_value=2

def box(name,pos,size,m,bevel=.001):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=move(bpy.context.object);o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Machined edge','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def cyl(name,pos,r,depth,m,axis='Z',vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=pos)
    o=move(bpy.context.object);o.name=name;o.data.materials.append(m)
    if axis=='Y':o.rotation_euler.x=math.pi/2
    if axis=='X':o.rotation_euler.y=math.pi/2
    for poly in o.data.polygons:poly.use_smooth=True
    return o

font=bpy.data.fonts.load('C:/Windows/Fonts/arial.ttf')
def label(name,text,pos,size,m=ink,rear=False,top=False):
    d=bpy.data.curves.new(name,'FONT');d.body=text;d.size=size;d.align_x='CENTER';d.font=font;d.resolution_u=3
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.location=pos
    o.rotation_euler=(0,0,0) if top else (-math.pi/2,0,math.pi) if rear else (math.pi/2,0,0)
    d.materials.append(m);return o

def tube(name,points,r,m,patch=False):
    # Exact dense sample polyline: no spline overshoot in the exported cable.
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=2;d.resolution_u=1
    s=d.splines.new('POLY');s.points.add(len(points)-1)
    for p,xyz in zip(s.points,points):p.co=(*xyz,1)
    o=bpy.data.objects.new(name,d);col.objects.link(o);d.materials.append(m)
    if patch:o['interactive_cable']=True
    return o

def screw(pos,rear=True):
    x,y,z=pos;cyl('Panel | screw head',pos,.0017,.001,silver,'Y',16)
    box('Panel | screw recess',(x,y+(.0006 if rear else -.0006),z),(.0018,.0003,.0004),ink,.0001)

def logo(x,y,z,size=.017,top=False):
    # Engraved geometric badge, reconstructed from the official photographs.
    if top:
        for xx,yy,w,h in [(0,0,1,.13),(0,.55,1,.13),(-.435,.28,.13,.6),(.435,.28,.13,.6),(0,.28,.6,.10)]:
            box('Schiit | top mark',(x+xx*size,y+yy*size,z),(w*size,h*size,.00008),ink,0)
    else:
        for xx,zz,w,h in [(0,0,1,.13),(0,.55,1,.13),(-.435,.28,.13,.6),(.435,.28,.13,.6),(0,.28,.6,.10)]:
            box('Schiit | front mark',(x+xx*size,y,z+zz*size),(w*size,.00008,h*size),ink,0)

# Preserve the authored power drapes; remove all audio wires and their old plugs.
power_routes=[]
for o in list(scene.objects):
    if o.get('route_kind')=='power':
        power_routes.append(o);continue
    name=o.name
    remove=(o.get('route_kind') is not None or name.startswith(('Schiit Freya','Freya','FiiO','WARMER','Bifrost','Rusich','Schiit Skoll','Skoll','XLR | three pins','Listening sofa'))
        or name.startswith(('A90 | balanced rear','A90 | RCA input','WiiM | analogue','WiiM | optical'))
        or any(t in name for t in ['Balanced XLR |','RCA | connector','RCA | flexible','| banana ','| XLR metal shell','| XLR boot','| XLR latch'])
        or name.startswith(('Rusich power','Bifrost power','A90 power','Skoll power','WiiM USB-C power','E1 DC power')))
    if remove:bpy.data.objects.remove(o,do_unlink=True)

def enclosure(id):
    d=devices[id];x,y,z=d['center'];w,depth,h=d['size']
    box(id+' | dark inner chassis',(x,y,z),(w-.004,depth-.004,h-.004),black,.002)
    box(id+' | folded aluminium lid',(x,y,z+h/2-.0015),(w,depth,.003),silver,.0013)
    box(id+' | front machined fascia',(x,y-depth/2-.001,z),(w,.004,h),silver,.003)
    box(id+' | rear plate',(x,y+depth/2,z),(w-.005,.002,h-.006),black if id=='rusich' else silver,.0007)
    for sx in (-1,1):
        box(id+' | side',(x+sx*(w/2-.001),y,z),(.002,depth,h-.003),silver,.0008)
        for sy in (-1,1):
            cyl(id+' | isolation foot',(x+sx*(w/2-.022),y+sy*(depth/2-.026),z-h/2-.002),.010,.004,rubber)
        for zz in (-1,1):screw((x+sx*(w/2-.008),y+depth/2+.0015,z+zz*(h/2-.007)))
    if id in ['freya','skoll','bifrost']:
        logo(x-w*.30,y-depth*.13,z+h/2+.0001,size=w*.12,top=True)
        logo(x-w*.405,y-depth/2-.0032,z-.008,size=w*.036)
        label(id+' | front name',id.upper() if id!='bifrost' else 'BIFROST 3',(x-w*.26,y-depth/2-.0033,z-.006),.0045)
    return x,y,z,w,depth,h

for id in ['freya','warmer','skoll','bifrost','rusich']:enclosure(id)

# Detailed rear sockets share precisely the atlas positions with the browser.
for p in layout['ports']:
    if p['signal']=='power' or p['device'].startswith(('ae','rel')) or p['device']=='e1':continue
    x,y,z=p['position'];kind=p['connector'];out=p['direction']=='out'
    for i,(dx,dz) in enumerate(p['jacks']):
        xx=x+dx;zz=z+dz
        if kind in ['RCA','COAX']:
            cyl(p['id']+' | insulating ring',(xx,y,zz),.005,.0015,white if not i else red,'Y')
            cyl(p['id']+' | gold barrel',(xx,y+.003,zz),.0039,.007,gold,'Y')
            cyl(p['id']+' | dark bore',(xx,y+.0066,zz),.0027,.0006,ink,'Y')
            cyl(p['id']+' | inner contact',(xx,y+.007,zz),.0012,.0003,gold,'Y',16)
        elif kind=='XLR':
            cyl(p['id']+' | mounting flange',(xx,y-.001,zz),.0128,.002,black,'Y',32)
            cyl(p['id']+' | metal rim',(xx,y+.0005,zz),.0105,.002,silver,'Y',32)
            cyl(p['id']+' | recessed insert',(xx,y+.0016,zz),.0093,.0009,ink,'Y',32)
            for a in [math.pi/2,math.pi*7/6,math.pi*11/6]:
                cyl(p['id']+' | '+('contact pin' if out else 'contact hole'),(xx+.004*math.cos(a),y+.0024,zz+.004*math.sin(a)),.00085 if out else .0013,.003 if out else .0007,gold if out else rubber,'Y',12)
            for sign in (-1,1):screw((xx+sign*.009,y+.0005,zz+sign*.010))
            if not out:box(p['id']+' | latch',(xx,y+.003,zz+.0095),(.005,.003,.002),silver,.0004)
        elif kind in ['OPTICAL','USB_C']:
            dims=(.010,.002,.009) if kind=='OPTICAL' else (.0085,.002,.0035)
            box(p['id']+' | socket',(xx,y,zz),dims,ink,.0008)
            if kind=='USB_C':box(p['id']+' | USB insert',(xx,y+.0011,zz),(.006,.0005,.0008),silver,.0002)
            else:box(p['id']+' | dust flap',(xx,y+.0012,zz),(.006,.0005,.006),rubber,.0005)
        elif kind=='BINDING':
            cyl(p['id']+' | insulator',(xx,y,zz),.0065,.004,red if i==0 else rubber,'Y')
            cyl(p['id']+' | binding barrel',(xx,y+.006,zz),.0055,.010,gold,'Y')
            cyl(p['id']+' | banana hole',(xx,y+.0113,zz),.002,.0008,ink,'Y',16)
        else:cyl(p['id']+' | ground post',(xx,y+.005,zz),.0035,.010,gold,'Y')
    label(p['id']+' | silkscreen',p['label'].split(' ·')[0].replace('Выход','OUT'),(x,y+.001,z+.017 if p['device']!='skoll' else z-.013),.0028,white if p['device']=='rusich' else ink,True)

# Freya: paired tube rows on its RIGHT side, clear glass and internal structures.
d=devices['freya'];x,y,z=d['center'];top=z+d['size'][2]/2;front=y-d['size'][1]/2-.0035
box('Freya detail | inset tube deck',(x+.112,y,top+.0007),(.153,.185,.0014),black,.002)
for tx,ty in layout['tubes']:
    xx=x+tx;yy=y+ty
    cyl('Freya detail | ceramic tube base',(xx,yy,top+.004),.0178,.007,rubber)
    # Lathed glass bulb with rounded shoulder, rather than a cylinder with a cap.
    profile=[(0,.014),(.005,.015),(.044,.015),(.052,.0135),(.059,.007),(.061,.001)]
    verts=[(xx+r*math.cos(k*math.tau/32),yy+r*math.sin(k*math.tau/32),top+.007+h) for h,r in profile for k in range(32)]
    faces=[(i*32+k,i*32+(k+1)%32,(i+1)*32+(k+1)%32,(i+1)*32+k) for i in range(len(profile)-1) for k in range(32)]
    mesh=bpy.data.meshes.new('6SN7 glass');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Freya detail | 6SN7 glass bulb',mesh);col.objects.link(o);mesh.materials.append(glass)
    for face in mesh.polygons:face.use_smooth=True
    for side in (-1,1):
        box('Freya detail | anode',(xx+side*.006,yy,top+.032),(.005,.013,.028),plate,.001)
        cyl('Freya detail | heater',(xx+side*.004,yy,top+.019),.0008,.016,glow)
    cyl('Freya detail | mica spacer',(xx,yy,top+.016),.010,.0008,silver)
    cyl('Freya detail | getter',(xx,yy,top+.053),.008,.0015,silver)
    label('Freya detail | tube marking','6SN7',(xx,yy-.0151,top+.039),.004,white)
    for a in range(16):
        angle=a*math.tau/16
        o=box('Freya detail | radial ventilation',(xx+.024*math.cos(angle),yy+.024*math.sin(angle),top+.0016),(.010,.0018,.0004),ink,.0007);o.rotation_euler.z=angle
for yy in [-.085,-.074,.074,.085]:
    for xx in np.arange(.055,.177,.009):box('Freya detail | deck vent',(x+xx,yy,top+.0016),(.004,.0018,.0004),ink,.0006)
cyl('Freya detail | volume',(x+.11,front-.007,z),.018,.014,silver,'Y',64)
for xx in [x+.033,x+.171]:cyl('Freya detail | front control',(xx,front-.001,z),.004,.003,silver,'Y',32)
for xx,count in [(x-.020,5),(x+.062,3)]:
    box('Freya detail | recessed LED strip',(xx,front-.0003,z),(.027,.0008,.003),ink,.001)
    for i in range(count):cyl('Freya detail | indicator',(xx-.01+i*.0048,front-.001,z),.00055,.001,white if i==0 else black,'Y',12)

# Bifrost 3: front select and indicators, replace generic text-only rectangle.
d=devices['bifrost'];x,y,z=d['center'];fy=y-d['size'][1]/2-.0035;ry=y+d['size'][1]/2+.001
cyl('Bifrost detail | input select',(x-.085,fy-.001,z),.004,.003,silver,'Y',32)
for i in range(5):cyl('Bifrost detail | indicator',(x-.063+i*.013,fy-.0002,z),.0009,.0006,white if i==0 else black,'Y',12)
for xx,zz,w,h in [(x+.063,z,.082,.032),(x-.02,z+.008,.057,.020)]:
    for sx in (-1,1):
        for sz in (-1,1):screw((xx+sx*w/2,ry+.001,zz+sz*h/2))

# Skoll F: selector buttons and the row of resistance/capacitance LEDs.
d=devices['skoll'];x,y,z=d['center'];fy=y-d['size'][1]/2-.0035
for i in range(9):cyl('Skoll detail | load indicator',(x-.01+i*.006,fy,z-.001),.00075,.0006,white if i==4 else ink,'Y',12)
for xx in [x+.05,x+.074]:cyl('Skoll detail | selector',(xx,fy-.001,z),.003,.002,silver,'Y')
for xx in [x+.061,x+.084,x+.102]:cyl('Skoll detail | mode indicator',(xx,fy,z),.00075,.0006,ink,'Y',12)
cyl('Skoll detail | IR receiver',(x+.094,fy,z),.0025,.0008,ink,'Y')
for side in (-1,1):
    for row in [-.007,0,.007]:
        for yy in np.arange(-.06,.061,.007):cyl('Skoll detail | side vent',(x+side*.1145,y+yy,z+row),.0018,.0006,ink,'X',12)

# WARMER: two mechanical meters within one broad amber window, input selector.
d=devices['warmer'];x,y,z=d['center'];fy=y-d['size'][1]/2-.0035;top=z+d['size'][2]/2
box('WARMER detail | meter frame',(x-.005,fy,z+.002),(.157,.002,.038),black,.0015)
box('WARMER detail | meter glass',(x-.005,fy-.0015,z+.002),(.152,.001,.034),cream,.001)
for center in [x-.042,x+.030]:
    label('WARMER detail | scale','-20  -10   -5   0  +3',(center,fy-.0022,z+.009),.0032,ink)
    label('WARMER detail | VU','VU',(center,fy-.0022,z-.008),.0038,ink)
    for i in range(15):
        a=.4+i*.052
        tube('WARMER detail | scale tick',[(center-.025+i*.0035,fy-.0023,z+.006),(center-.025+i*.0035,fy-.0023,z+.009+(i%3==0)*.002)],.00022,ink)
    tube('WARMER detail | resting needle',[(center,fy-.0025,z-.012),(center-.018,fy-.0025,z+.010)],.0003,ink)
label('WARMER detail | FIIO','FIIO',(x-.005,fy-.0023,z+.016),.0035,ink)
label('WARMER detail | identity','R2R TUBE DAC',(x,fy,z-.024),.004,ink)
cyl('WARMER detail | input knob',(x+.09,fy-.004,z),.0105,.009,silver,'Y',48)
box('WARMER detail | knob pointer',(x+.086,fy-.009,z+.006),(.001,.0005,.009),ink,.0002)
cyl('WARMER detail | power',(x-.095,fy-.001,z),.0045,.003,silver,'Y')
for xx in [-.042,.042]:
    for yy in np.arange(-.075,.083,.004):box('WARMER detail | top ventilation',(x+xx,yy,top+.00015),(.063,.0016,.0003),ink,.0006)
for side in (-1,1):
    for yy in np.arange(-.082,.087,.005):box('WARMER detail | side ventilation',(x+side*.112,y+yy,z),(.0004,.0016,.026),ink,.0005)

# Rusich: actual front elevation from owner PDF (not a top-panel decal).
d=devices['rusich'];x,y,z=d['center'];fy=y-.153;ry=y+.153
label('Rusich detail | maker','Rusich',(x-.18,fy-.0003,z+.069),.011,ink)
label('Rusich detail | model','ALEPH PASS A2',(x-.12,fy-.0003,z+.071),.0038,ink)
label('Rusich detail | class','POWER AMPLIFIER CLASS A',(x,fy-.0003,z+.071),.0034,ink)
label('Rusich detail | dual','DUAL MONO POWER',(x+.175,fy-.0003,z+.071),.0034,ink)
cyl('Rusich detail | power button',(0,fy-.001,z-.055),.008,.003,silver,'Y',40)
label('Rusich detail | power label','POWER',(0,fy-.0003,z-.075),.0026,ink)
for xx in [-.040,.040]:
    cyl('Rusich detail | protect bezel',(xx,fy-.0005,z-.055),.002,.001,silver,'Y')
    cyl('Rusich detail | protect LED',(xx,fy-.0011,z-.055),.0012,.0004,red,'Y')
    label('Rusich detail | protect','PROTECT',(xx,fy-.0003,z-.043),.0025,ink)
cyl('Rusich detail | rear input selector',(0,ry+.004,z+.060),.014,.009,rubber,'Y',48)
label('Rusich detail | source label','RCA1  RCA2  XLR1  XLR2',(0,ry+.003,z+.078),.003,white,True)
for side in (-1,1):
    for yy in np.arange(-.125,.126,.012):box('Rusich detail | cooling fin',(side*.207,y+yy,z),(.018,.004,.15),black,.001)

# Power sockets and the existing dressed leads. External Skoll PSU is not IEC.
power=[('rusich',0,-.065,'IEC'),('bifrost',-.084,-.003,'IEC'),('a90',-.09,0,'IEC'),('skoll',-.1,0,'24/6 VAC'),('wiim',-.057,0,'USB-C 5V'),('e1',.11,0,'DC unverified'),('freya',-.175,0,'IEC'),('warmer',-.091,.009,'IEC')]
power_names=['Rusich','Bifrost','A90','Skoll','WiiM USB-C','E1 DC']
for k,(id,dx,dz,kind) in enumerate(power):
    d=devices[id];xx=d['center'][0]+dx;yy=d['center'][1]+d['size'][1]/2+.003;zz=d['center'][2]+dz
    if kind=='IEC':
        box(id+' | IEC bezel',(xx,yy,zz),(.028,.004,.022),black,.003)
        box(id+' | IEC cavity',(xx,yy+.0022,zz),(.019,.0007,.013),ink,.002)
        for a,b in [(-.005,0),(.005,0),(0,.004)]:box(id+' | IEC pin',(xx+a,yy+.003,zz+b),(.001,.002,.0025),silver,.0002)
    else:
        cyl(id+' | external power inlet',(xx,yy,zz),.006 if id=='skoll' else .0035,.002,black,'Y')
        label(id+' | supply label',kind,(xx,yy+.001,zz+.011),.0025,ink,True)
    if k<6:
        route=next((o for o in power_routes if o.name.startswith(power_names[k]+' | relaxed power')),None)
        if route and route.type=='MESH':
            verts=route.data.vertices;old=sum((v.co for v in list(verts)[:12]),Vector())/12
            target=Vector((xx,yy+.027,zz));delta=target-old
            # Reattach the start gently; all subsequent knots retain the old floor route.
            for v in verts:
                factor=max(0,1-(v.co.y-old.y)/max(.05,.25-old.y));v.co+=delta*factor
        cyl(id+' | connected power boot',(xx,yy+.018,zz),.0055,.036,rubber,'Y')
        if id=='skoll':
            outlet=.25-.635/2+.05+3*(.635-.14)/7
            box('Skoll F | external 24-6 VAC transformer envelope',(.48,outlet,.145),(.049,.055,.057),black,.004)
    else:
        label(id+' | planned power','PLANNED',(xx,yy+.003,zz-.018),.0025,ink,True)

# Render default wiring from exactly the same samples used by Three.js.
sys.path.insert(0,str(Path(__file__).parent))
from service_room_wiring import update_wiring
update_wiring(scene,col,layout)

# Owner's floor-standing lounge chair: 900 W x 1080 D x 850 H, milk velour.
velour=material('Gliver | milk Vertical velour',(.78,.745,.66),.82)
p=next(n for n in velour.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Sheen Weight'].default_value=.48;p.inputs['Sheen Roughness'].default_value=.5
nt=velour.node_tree;noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=340
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.0012;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])
# Embedded normal map for the browser; the procedural fibres remain in Cycles.
rng=np.random.default_rng(31);height=rng.normal(0,.03,(256,256));dy,dx=np.gradient(height)
n=np.dstack((-dx*3,-dy*3,np.ones_like(dx)));n/=np.linalg.norm(n,axis=2)[:,:,None]
rgba=np.ones((256,256,4),dtype=np.float32);rgba[:,:,:3]=n*.5+.5
im=bpy.data.images.new('Gliver velour fine fibres',width=256,height=256);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(rgba.ravel());im.pack()
t=nt.nodes.new('ShaderNodeTexImage');t.image=im;nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.3;nt.links.new(t.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
seam=material('Gliver | soft seam',(.55,.52,.45),.92)
# Closed profile begins under the front, then follows the seat into the tall back.
profile=[(.48,.04),(.535,.10),(.54,.28),(.49,.375),(.30,.355),(.10,.33),(-.10,.34),(-.21,.40),(-.30,.56),(-.37,.70),(-.43,.81),(-.48,.85),(-.53,.81),(-.54,.53),(-.53,.18),(-.45,.045),(.0,.025)]
def interp(points,steps=5):
    out=[];N=len(points)
    for i in range(N):
        a,b,c,d=[Vector(points[j%N]) for j in [i-1,i,i+1,i+2]]
        for k in range(steps):
            t=k/steps;out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return out
prof=interp(profile);verts=[];faces=[];rows=33;N=len(prof)
for i in range(rows):
    u=-1+2*i/(rows-1);xx=.45*u;shrink=1-.13*abs(u)**8
    for j,(yy,zz) in enumerate(prof):
        # Rounded side panels, gently raised seat shoulders and subtle wrinkles.
        zc=.40+(zz-.40)*shrink+.014*(u*u)*(0<j<N*.65)
        zc+=.0015*math.sin(xx*48+yy*25)*math.sin(j*.8)
        # Soft transverse channels compress the velour and foam into the shell.
        tangent=(prof[(j+1)%N]-prof[(j-1)%N]).normalized();normal=Vector((tangent.y,-tangent.x))
        groove=sum(.012*math.exp(-((j-k)/1.25)**2) for k in [16,22,28,34,40,46,52,57])*(1-abs(u)**6)
        verts.append((xx,-3.79+yy*shrink-normal.x*groove,zc-normal.y*groove))
for i in range(rows-1):
    for j in range(N):faces.append((i*N+j,(i+1)*N+j,(i+1)*N+(j+1)%N,i*N+(j+1)%N))
faces.extend([tuple(reversed(range(N))),tuple((rows-1)*N+j for j in range(N))])
mesh=bpy.data.meshes.new('Gliver DeFrance soft shell');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Gliver DeFrance | owner 900 x 1080 x 850',mesh);col.objects.link(o);mesh.materials.append(velour)
for poly in mesh.polygons:poly.use_smooth=True
uv=mesh.uv_layers.new(name='Velour weave')
for poly in mesh.polygons:
    for li in poly.loop_indices:
        vi=mesh.loops[li].vertex_index;uv.data[li].uv=(vi//N/(rows-1)*6,(vi%N)/N*8)
bpy.context.view_layer.update();o.dimensions=(.9,1.08,.85);o.location.z=.004-min(v[2] for v in verts)*o.scale.z
o['source']='Owner specification: 900x1080x850mm; Vertical velour; milk colour confirmed.'
bpy.context.view_layer.update()
# Upholstery channels follow the curved top, and piping follows both side edges.
for j in [16,22,28,34,40,46,52,57]:
    points=[o.matrix_world@Vector(verts[i*N+j]) for i in range(2,rows-2)]
    tube('Gliver | channel stitching',points,.0010,seam)
for i in [1,rows-2]:tube('Gliver | side piping',[o.matrix_world@Vector(verts[i*N+j]) for j in range(N)]+[o.matrix_world@Vector(verts[i*N])],.0016,velour)

from service_room_export import finish_room
finish_room(scene,col)
