"""Build the listening-room edition from the preserved user Blender scene.
Run Blender --background audio-setup-before-room.blend --python this_file.
All units are metres. Room, lamps and side PDUs are design proposals.
Product envelopes: AE320 datasheet; REL Q-Series manual p23; project passports.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT.parents[1] / 'artifacts' / 'blender'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(42)
source = bpy.data.scenes['Anton | Hi-Fi - soft cables v3']
scene = bpy.data.scenes.new('Audio Setup | Listening room 2026-10-05')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene['room_status'] = 'Scenography: not a measured copy of the owner room'
scene['rug_dimensions_mm'] = '3000 x 2000; tassels outside the nominal textile body'
scene['sub_connection_status'] = 'Owner says XLR Hi; stock Quake has Speakon HIGH LEVEL. Actual wiring pending confirmation.'
scene['geometry_status'] = 'Verified product envelopes; detailed connector positions are illustrative, not manufacturing drawings.'

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

active = collection('01 | Preserved rack and equipment')
def move_to(o, col=None):
    for c in list(o.users_collection): c.objects.unlink(o)
    (col or active).objects.link(o)
    return o

def material(name, rgb, rough=.45, metal=0, coat=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    n = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value = (*rgb, 1)
    n.inputs['Roughness'].default_value = rough
    n.inputs['Metallic'].default_value = metal
    n.inputs['Coat Weight'].default_value = coat
    n.inputs['Coat Roughness'].default_value = .065
    if emission:
        n.inputs['Emission Color'].default_value = (*rgb, 1)
        n.inputs['Emission Strength'].default_value = emission
    return m

lacquer = material('AE320 | Piano Gloss Black', (.001,.0015,.002), .11, 0, .4)
next(n for n in lacquer.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Specular IOR Level'].default_value=.32
sub_finish = material('REL | owner specified grey satin', (.25,.265,.28), .38, 0, .1)
black = material('Black satin aluminium', (.025,.027,.03), .3, .6)
rubber = material('Soft black cable jacket', (.011,.013,.015), .67)
silver = material('Brushed silver aluminium', (.55,.58,.60), .29, .86)
gold = material('Gold connectors', (.5,.30,.08), .27, .8)
red = material('Socket red', (.38,.026,.018), .38)
ivory = material('Quincey | warm white wool', (.81,.79,.72), .94)
ivory_edge = material('Quincey | woven binding', (.62,.60,.54), .96)
wall = material('Warm mineral plaster', (.65,.625,.575), .94)
trim = material('Painted skirting', (.72,.70,.65), .67)
floor_mats = [material('Oak plank %02d'%i, (.34+i*.009,.24+i*.007,.15+i*.005),.58) for i in range(7)]
linen = material('Linen lampshade', (.80,.73,.57), .9)
warm = material('Smart lamp | warm diffuser', (1,.67,.31), .65, emission=2.2)

def bump(m, scale, strength, distance):
    nt=m.node_tree; p=next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    noise=nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=scale
    b=nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=strength; b.inputs['Distance'].default_value=distance
    nt.links.new(noise.outputs['Fac'],b.inputs['Height']); nt.links.new(b.outputs['Normal'],p.inputs['Normal'])
bump(ivory,220,.5,.003)
bump(linen,160,.35,.002)
bump(wall,65,.12,.007)

def box(name, xyz, dims, mat, bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz)
    o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Machined edges','BEVEL'); mod.width=bevel; mod.segments=3
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return move_to(o)

def cylinder(name,xyz,radius,depth,mat,rotation=(0,0,0),vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=xyz,rotation=rotation)
    o=bpy.context.object; o.name=name; o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    mod=o.modifiers.new('Soft edge','BEVEL');mod.width=min(.001,depth/4);mod.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return move_to(o)

def tube(name,points,radius,mat,smooth=True):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=8;d.bevel_depth=radius;d.bevel_resolution=2
    s=d.splines.new('BEZIER' if smooth else 'POLY')
    if smooth:
        s.bezier_points.add(len(points)-1)
        for p,xyz in zip(s.bezier_points,points):p.co=xyz;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    else:
        s.points.add(len(points)-1)
        for p,xyz in zip(s.points,points):p.co=(*xyz,1)
    o=bpy.data.objects.new(name,d);active.objects.link(o);d.materials.append(mat);return o

def label(name,text,xyz,size,mat,rotation=(math.pi/2,0,0)):
    d=bpy.data.curves.new(name,'FONT');d.body=text;d.size=size;d.align_x='CENTER';d.extrude=.00002;d.resolution_u=3
    o=bpy.data.objects.new(name,d);active.objects.link(o);o.location=xyz;o.rotation_euler=rotation;d.materials.append(mat);return o

# Copy only relevant objects. Original unsaved scene remains intact in backup.
keep = ('01 | Walnut','Left speaker','Right speaker','Pro-Ject','Schiit Skoll','Topping A90','WiiM')
for src in source.objects:
    cn=next((c.name for c in src.users_collection if c.name.startswith(keep)),None)
    if not cn:continue
    o=src.copy()
    if src.data:o.data=src.data.copy()
    active.objects.link(o)
    if 'speaker' in cn:
        sign=-1 if cn.startswith('Left') else 1
        # Whole cabinet and drivers translate together, including world-space curves.
        o.location.x+=sign*.32
        if 'walnut cabinet' in src.name:
            o.data.materials.clear();o.data.materials.append(lacquer)
            o.name='AE320 %s | piano black enclosure'%('L' if sign<0 else 'R')
            # Original envelope was 975mm; official enclosure height is 1000mm (ex spikes).
            o.dimensions.z=1.0;o.location.z=.525
            o['verified_envelope_mm']='175 x 1000 x 320 excluding spikes'
    elif cn.startswith('Pro-Ject'):o.location.z+=.4268
    elif cn.startswith(('Schiit Skoll','WiiM')):o.location.z+=.1168
    elif cn.startswith('Topping'):o.location.z+=.133
    elif cn.startswith('01 |'):
        if 'Graphite rack post' in src.name:o.dimensions.z+=.4268;o.location.z+=.2134
        elif o.location.z>.70:o.location.z+=.4268
        elif o.location.z>.50:o.location.z+=.1168
        elif o.location.z>.30:o.location.z+=.133
    elif cn.startswith('11 |'):
        if o.location.z>.70:o.location.z+=.1168
        elif o.location.z>.50:o.location.z+=.1168
        elif o.location.z>.30:o.location.z+=.133

active=collection('02 | Electronics and planned DAC alternatives')
# Rusich front height and width verified from owner's drawing; depth is an explicit proxy.
box('Rusich ALEPH PASS A2 | depth provisional 300mm',(0,-.015,.269),(.43,.30,.164),silver,.005)
box('Rusich | front plate',(0,-.169,.269),(.43,.01,.164),black,.003)
label('Rusich identity','RUSICH  /  ALEPH PASS A2',(0,-.175,.253),.010,silver)
for x in (-.182,.182):
    for y in (-.125,.095):cylinder('Rusich | isolation foot',(x,y,.1795),.016,.015,rubber)
for x in (-.204,.204):
    for y in [i*.012-.13 for i in range(21)]:box('Rusich | heat sink fin',(x,y,.273),(.018,.004,.142),black,.001)
for x in (-.12,-.09,.09,.12):cylinder('Rusich | rear speaker terminal',(x,.144,.22),.005,.018,red if x in (-.12,.09) else black,(math.pi/2,0,0))
for x in (.15,.17):cylinder('Rusich | RCA 1 input',(x,.143,.303),.004,.012,gold,(math.pi/2,0,0))
box('Rusich | IEC inlet',(-.17,.137,.23),(.029,.015,.022),rubber)
label('Rusich depth note','DEPTH UNVERIFIED',(0,.142,.315),.006,silver,(-math.pi/2,0,math.pi))

box('Bifrost 3 | folded aluminium enclosure',(-.135,-.0888,.5614),(.2286,.1524,.0468),silver,.004)
for x in (-.219,-.05):
    for y in (-.14,-.035):cylinder('Bifrost | foot',(x,y,.536),.009,.004,rubber)
label('Bifrost 3 badge','BIFROST 3',(-.135,-.1665,.551),.0065,black)
for x in (-.196,-.18,-.164):cylinder('Bifrost | input indicator',(x,-.166,.568),.0016,.001,warm,(math.pi/2,0,0),16)
cylinder('Bifrost | input select',(-.223,-.168,.563),.006,.004,silver,(math.pi/2,0,0))
for x in (-.195,-.161):
    cylinder('Bifrost | balanced XLR out',(x,-.009,.559),.011,.012,black,(math.pi/2,0,0))
    for a in (0,2.094,4.189):cylinder('XLR | three pins',(x+.004*math.cos(a),-.001,.559+.004*math.sin(a)),.0008,.007,gold,(math.pi/2,0,0),8)
box('Bifrost | optical port',(-.087,-.009,.558),(.010,.008,.009),rubber,.001)
cylinder('Bifrost | coaxial',(-.064,-.006,.558),.004,.014,gold,(math.pi/2,0,0))

# A separate shelf keeps both DACs and both preamps present. Envelopes follow
# manufacturer dimensions; controls and tubes are illustrative, not a CAD scan.
wood=next(m for m in bpy.data.materials if m.name.startswith('Walnut | horizontal'))
box('Planned shelf | Freya + WARMER | 780 x 450 x 32 mm',(0,0,.9248),(.780,.450,.032),wood,.005)
for x in (-.302,.302):
    for y in (-.187,.187):
        cylinder('New shelf | support collar',(x,y,.9018),.025,.012,black)
        cylinder('New shelf | top fixing',(x,y,.9412),.008,.001,black)
glass=material('Freya | tube glass illustration',(.19,.21,.22),.16,.22)
tube_glow=material('Freya | warm tube core',(.22,.08,.025),.6,emission=.5)
fy=.9408
box('Schiit Freya 2 | planned envelope',(-.14,0,fy+.0254),(.4064,.2032,.0508),silver,.004)
label('Freya 2 identity','SCHIIT   /   FREYA 2',(-.23,-.103,fy+.023),.007,black)
cylinder('Freya 2 | volume',(.012,-.108,fy+.026),.015,.013,silver,(math.pi/2,0,0))
for x in (-.245,-.175,-.105,-.035):
    cylinder('Freya 2 | tube socket',(x,.025,fy+.053),.019,.006,black)
    cylinder('Freya 2 | tube envelope',(x,.025,fy+.083),.015,.0626,glass)
    cylinder('Freya 2 | tube top',(x,.025,fy+.111),.012,.006,tube_glow)
box('FiiO WARMER R2R | planned enclosure',(.207,0,fy+.0374),(.2235,.213,.0588),silver,.004)
for x in (.128,.286):
    for y in (-.075,.075):cylinder('WARMER | foot',(x,y,fy+.004),.010,.008,rubber)
box('WARMER | illuminated VU window',(.207,-.108,fy+.038),(.080,.003,.031),warm,.002)
label('WARMER | VU scale','VU',(.207,-.110,fy+.035),.007,black)
tube('WARMER | VU needle',[(.21,-.111,fy+.023),(.192,-.111,fy+.047)],.00065,black,False)
label('WARMER R2R identity','FIIO  /  WARMER R2R',(.207,-.108,fy+.014),.004,black)
cylinder('WARMER | input selector',(.289,-.113,fy+.037),.012,.010,silver,(math.pi/2,0,0))
scene['rack_inventory']='8: Pro-Ject E1, Skoll F, WiiM Pro Plus, A90, Rusich, Bifrost 3 (preorder), Freya 2 (planned), WARMER R2R (candidate)'
scene['new_cables']='Unmeasured connector coordinates: no invented point-to-point wiring for planned devices'

active=collection('03 | REL Quake stereo pair')
for side,x in [('L',-1.60),('R',1.60)]:
    # Overall 253W x294H x272D incl feet/controls. Driver faces the floor.
    y=.08
    o=box('REL Quake '+side+' | cabinet',(x,y,.1695),(.253,.25,.249),sub_finish,.007)
    o['product']='REL Quake';o['verified_envelope_mm']='253 x 294 x 272';o['mass_kg']=7.4
    for dx in (-.096,.096):
        for dy in (-.095,.095):cylinder('REL '+side+' | foot',(x+dx,y+dy,.0225),.015,.045,rubber)
    cylinder('REL '+side+' | down-firing 200mm driver',(x,y,.042),.10,.006,black,vertices=64)
    cylinder('REL '+side+' | recessed cone',(x,y,.039),.083,.008,rubber,vertices=64)
    box('REL '+side+' | rear control panel',(x,y+.127,.165),(.186,.004,.20),black,.002)
    for dx in (-.05,.05):cylinder('REL '+side+' | level / crossover knob',(x+dx,y+.136,.215),.012,.014,rubber,(math.pi/2,0,0))
    cylinder('REL '+side+' | Neutrik Speakon HIGH LEVEL',(x-.04,y+.139,.135),.014,.014,black,(math.pi/2,0,0))
    cylinder('REL '+side+' | low-level RCA',(x+.037,y+.139,.135),.004,.014,gold,(math.pi/2,0,0))
    box('REL '+side+' | IEC mains',(x+.036,y+.134,.076),(.028,.015,.021),rubber,.002)
    label('REL '+side+' | front badge','REL',(x,y-.127,.238),.015,silver)
    label('REL '+side+' | rear labels','HI LEVEL    LOW LEVEL',(x,y+.131,.163),.007,silver,(-math.pi/2,0,math.pi))

active=collection('04 | Power: central 8-way and two independent 3-way')
def strip(name,x,y,count,length):
    box(name+' | housing',(x,y,.035),(.10,length,.06),black,.008)
    centres=[]
    for i in range(count):
        sy=y-length/2+.050+i*(length-.14)/max(1,count-1);centres.append(sy)
        cylinder(name+' | recessed socket %d'%(i+1),(x,sy,.066),.022,.004,rubber)
        for dx in (-.0095,.0095):cylinder(name+' | socket contact',(x+dx,sy,.0685),.0026,.001,gold,vertices=12)
    box(name+' | switch',(x,y+length/2-.03,.066),(.019,.030,.004),red,.003)
    return centres

main_y=strip('Brennenstuhl Premium-Protect-Line 8-way',.48,.25,8,.635)
def plug(name,x,y):
    cylinder(name,(x,y,.086),.018,.038,rubber)
    cylinder(name+' | strain relief',(x,y,.113),.005,.018,rubber)
for i in range(8):plug('Main outlet '+str(i+1)+' | reserved in plan',.48,main_y[i])
for side,x in [('L',-1.60),('R',1.60)]:
    sx=x+(-.26 if x<0 else .26);sy=.28
    ys=strip(side+' | proposed 3-way filter',sx,sy,3,.25)
    for yy in ys[:2]:plug(side+' | Schuko',sx,yy)
    # Supported drop, generous service loop, then floor run behind the sub.
    tube(side+' | sub mains',[(x+.036,.233,.076),(x+.036,.32,.073),(x+.04,.40,.016),(sx,.39,.009),(sx,ys[0]+.08,.025),(sx,ys[0],.12)],.0045,rubber)
    tube(side+' | lamp mains',[(sx,ys[1],.12),(sx-.045,ys[1]-.03,.05),(sx-.06,.15,.008),(sx,.04,.008),(sx,-.05,.025)],.003,rubber)
    # Local wall socket per side. No daisy chain through central PDU.
    box(side+' | wall outlet',(sx,1.077,.20),(.08,.016,.08),trim,.004)
    cylinder(side+' | wall plug',(sx,1.06,.20),.020,.035,rubber,(math.pi/2,0,0))
    tube(side+' | filter wall lead',[(sx,sy+.14,.035),(sx,.55,.009),(sx,1.02,.009),(sx,1.035,.11),(sx,1.04,.20)],.004,rubber)
box('Main wall outlet',(.48,1.077,.20),(.08,.016,.08),trim,.004)
cylinder('Main wall plug',(.48,1.06,.20),.020,.035,rubber,(math.pi/2,0,0))
tube('Central PDU | wall feed',[(.48,.59,.035),(.53,.66,.01),(.57,.98,.01),(.50,1.03,.08),(.48,1.04,.20)],.0045,rubber)

active=collection('05 | Signal loom and rack power: supported routes')
# Continuous curves travel behind shelf depth225mm. Service bends are illustrative;
# no manufacturer bend-radius compliance claimed without exact cable variants.
for label_name,x,z,port_y in [('Rusich',-.17,.23,.15),('Bifrost',-.04,.56,-.01),('A90',.215,.56,.006),('Skoll',-.23,.79,-.01),('WiiM',.18,.79,-.02),('E1',.11,1.28,.18)]:
    k=['Rusich','Bifrost','A90','Skoll','WiiM','E1'].index(label_name)
    tube(label_name+' | supported power',[(x,port_y,z),(x,.285,z),(x,.335,z-.03),(.29,.34,z-.08),(.29,.35,.07),(.43,.36,.015),(.48,main_y[k],.12)],.0035,rubber)
    box(label_name+' | cable saddle',(.29,.345,z-.08),(.027,.025,.012),black,.003)
# Bifrost balanced into A90, WiiM optical into Bifrost; vinyl path remains separate.
for dx in (0,.025):tube('Bifrost to A90 | XLR',[(-.195+dx,-.001,.559),(-.195+dx,.11,.559),(-.18+dx,.285,.57),(.05+dx,.285,.57),(.06+dx,.014,.559)],.0034,rubber)
tube('WiiM to Bifrost | optical',[(.13,-.018,.79),(.13,.29,.79),(-.087,.30,.67),(-.087,.08,.56),(-.087,-.003,.558)],.0022,rubber)
for dx in (0,.021):
    tube('A90 to Rusich | RCA',[(.16+dx,.008,.559),(.16+dx,.285,.55),(.17+dx,.30,.39),(.15+dx,.29,.303),(.15+dx,.151,.303)],.003,rubber)
    tube('Skoll to A90 | RCA',[(-.10+dx,-.01,.787),(-.10+dx,.285,.787),(.11+dx,.29,.63),(.11+dx,.018,.56)],.003,rubber)
tube('E1 to Skoll | phono',[(-.04,.18,1.285),(-.04,.285,1.285),(-.16,.30,.86),(-.17,-.005,.788)],.0035,rubber)
for side,x in [('L',-1.1),('R',1.1)]:
    sx=-.12 if x<0 else .09
    tube(side+' | amplifier to AE320',[(sx,.16,.22),(sx,.30,.21),(sx,.42,.04),(x*.6,.43,.012),(x,.29,.012),(x,.21,.06),(x,.18,.13)],.004,rubber)
# Quake signal plugs remain unpatched until owner clarifies XLR vs Speakon.
# This avoids baking a false or electrically unsafe output assignment into the twin.

active=collection('06 | Smart lamps: proposed furniture')
for side,x in [('L',-1.86),('R',1.86)]:
    y=-.05
    cylinder('Lamp '+side+' | base',(x,y,.022),.115,.044,black)
    cylinder('Lamp '+side+' | stem',(x,y,.62),.012,1.20,black)
    bpy.ops.mesh.primitive_cone_add(vertices=64,radius1=.20,radius2=.145,depth=.25,location=(x,y,1.26))
    o=bpy.context.object;o.name='Smart lamp '+side+' | linen shade';o.data.materials.append(linen);move_to(o)
    cylinder('Lamp '+side+' | diffuser',(x,y,1.131),.183,.006,warm,vertices=64)
    ld=bpy.data.lights.new('Lamp '+side+' warm pool','AREA');ld.energy=18;ld.color=(1,.69,.40);ld.shape='DISK';ld.size=.30
    lo=bpy.data.objects.new(ld.name,ld);active.objects.link(lo);lo.location=(x,y,1.12)

active=collection('07 | LAXMI Quincey white 200 x 300cm')
box('Quincey | 3000 x 2000mm body',(0,-1.77,.009),(3,2,.018),ivory,.012)
# 6 x 4 sculpted quarter-circle tiles. All ridges are real geometry inside the body.
for ix in range(6):
    for iy in range(4):
        x0=-1.48+ix*.4933;y0=-2.75+iy*.49
        flip=(ix+iy)%2
        for k in range(1,18):
            r=k*.027
            pts=[]
            for j in range(19):
                a=j/18*math.pi/2
                xx=r*math.cos(a);yy=r*math.sin(a)
                pts.append((x0+(.483-xx if flip else xx),y0+yy,.019))
            tube('Quincey | sculpted pile',pts,.0048,ivory,False)
for x in (-1.488,1.488):tube('Quincey | bound long edge',[(x,-2.756,.012),(x,-.784,.012)],.007,ivory_edge,False)
for y in (-2.756,-.784):
    tube('Quincey | woven end',[(-1.48,y,.012),(1.48,y,.012)],.007,ivory_edge,False)
    direction=-1 if y<-2 else 1
    for i in range(43):
        x=-1.44+i*2.88/42
        tube('Quincey | twisted tassel',[(x,y,.01),(x+.008,y+direction*.026,.011),(x-.003,y+direction*.057,.008),(x,y+direction*.085,.006)],.0045,ivory)
        for j in range(4):tube('Quincey | tassel fringe',[(x,y+direction*.077,.008),(x+(j-1.5)*.007,y+direction*(.104+random.random()*.012),.005)],.0018,ivory,False)

active=collection('08 | Room concept: warm plaster and oak')
box('Room | floor slab',(0,-1.90,-.055),(5.4,6,.10),floor_mats[2],.005)
for i in range(27):
    for j in range(6):
        x=-2.6+i*.2
        a=max(-4.9,-5.5+j*1.2+(i%2)*.6)
        b=min(1.1,-5.5+(j+1)*1.2+(i%2)*.6)
        if b<=a:continue
        box('Oak | individual plank',(x,(a+b)/2,-.001),(.199,b-a-.001,.010),floor_mats[random.randrange(7)],.0004)
box('Room | rear plaster wall',(0,1.16,1.40),(5.4,.14,2.8),wall,.006)
box('Room | left plaster wall',(-2.77,-1.85,1.40),(.14,6.1,2.8),wall,.006)
box('Room | back skirting',(0,1.075,.05),(5.4,.018,.10),trim,.002)
box('Room | left skirting',(-2.69,-1.85,.05),(.018,6.0,.10),trim,.002)
# Architectural panel detail gives scale without invented acoustic treatment claims.
for x in (-2.25,-.72,.72,2.25):
    box('Wall | recessed vertical seam',(x,1.083,1.50),(.003,.006,2.35),ivory_edge,0)

active=collection('09 | Lighting and cameras')
def area(name,pos,target,power,size,color=(1,1,1),size_y=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='RECTANGLE';d.size=size;d.size_y=size_y or size
    o=bpy.data.objects.new(name,d);active.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
area('Window | broad left daylight',(-2.3,-2.2,2.5),(0,0,.4),240,3.0,(1,.88,.73),2.5)
area('Window | frontal soft fill',(1,-3,2.7),(0,0,.5),180,3,(.80,.88,1),2)
area('Lacquer | vertical reflection card',(2.35,-.2,2.0),(0,0,.5),90,.6,(1,.95,.88),2.8)
world=bpy.data.worlds.new('Room daylight');world.use_nodes=True;next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value=(.56,.61,.7,1);next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND').inputs[1].default_value=.28;scene.world=world
d=bpy.data.cameras.new('Room hero');cam=bpy.data.objects.new('Room hero',d);active.objects.link(cam)
cam.location=(3.25,-5.3,2.45);target=Vector((0,-.55,.48));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();d.lens=43;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=91
scene.render.filepath=str(ROOT/'public/images/listening-room.jpg')
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='CONSOLE':a.type='VIEW_3D'
        if a.type=='VIEW_3D':
            sp=next((s for s in a.spaces if s.type=='VIEW_3D'),None)
            if sp:
                sp.region_3d.view_perspective='CAMERA'
                sp.shading.type='MATERIAL'
                sp.overlay.show_overlays=False
scene['source_urls']='https://www.acoustic-energy.co.uk/wp-content/uploads/Acoustic-Energy-AE320-Info-Sheet.pdf | https://relsupport.zendesk.com/hc/en-us/article_attachments/115015632747'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'audio-setup-listening-room.blend'))
print('ROOM_SAVED',len(scene.objects),flush=True)
bpy.ops.render.render(write_still=True)
print('ROOM_RENDERED',flush=True)

# Export evaluated meshes, grouped by material, for modest mobile draw-call count.
# The editable .blend above keeps every named component and curve.
export_scene=bpy.data.scenes.new('Web export');bpy.context.window.scene=export_scene
depsgraph=scene.view_layers[0].depsgraph
groups={}
for o in scene.objects:
    if o.type not in {'MESH','CURVE','FONT','SURFACE'} or o.hide_render:continue
    if o.type=='FONT' and o.dimensions.length<.016:continue
    evaluated=o.evaluated_get(depsgraph)
    mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=depsgraph)
    copy=bpy.data.objects.new(o.name,mesh);copy.matrix_world=o.matrix_world.copy();export_scene.collection.objects.link(copy)
    key=tuple(m.name if m else '' for m in mesh.materials)
    groups.setdefault(key,[]).append(copy)
for group in groups.values():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    group[0].name='Room | '+(group[0].data.materials[0].name if group[0].data.materials else 'surface')
# glTF cannot carry Blender procedural node trees. Give walnut a packed image
# texture on the existing UVs instead of silently exporting a white material.
import numpy as np
rng=np.random.default_rng(17)
ww,hh=512,128
xx,yy=np.meshgrid(np.linspace(0,6,ww),np.linspace(0,35,hh))
grain=.86+.09*np.sin(yy*5+np.sin(xx)*.9)+.06*np.sin(yy*16+xx*.3)+rng.normal(0,.016,(hh,ww))
pixels=np.ones((hh,ww,4),dtype=np.float32)
for i,base in enumerate((.47,.30,.17)):pixels[:,:,i]=np.clip(base*grain,0,1)
tex=bpy.data.images.new('Walnut grain | web',width=ww,height=hh)
tex.pixels.foreach_set(pixels.ravel());tex.filepath_raw=str(OUT/'walnut-web.png');tex.file_format='PNG';tex.save();tex.pack()
webwood=material('Walnut | textured web PBR',(.25,.12,.05),.38)
nodes=webwood.node_tree.nodes;links=webwood.node_tree.links
node=nodes.new('ShaderNodeTexImage');node.image=tex
links.new(node.outputs['Color'],next(n for n in nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])
for o in export_scene.objects:
    for slot in o.material_slots:
        if slot.material and 'Walnut' in slot.material.name:slot.material=webwood
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/listening-room.glb'),export_format='GLB',use_active_scene=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
(OUT/'build-report.json').write_text(json.dumps({'scene':scene.name,'objects':len(scene.objects),'web_meshes':len(export_scene.objects),'rug_mm':[3000,2000],'subs':2,'side_power_strips':2,'side_outlets_each':3,'sub_wiring':'unconfirmed XLR Hi / stock Speakon','room_measured':False},indent=2),encoding='utf8')
print('ROOM_EXPORT_COMPLETE',flush=True)

