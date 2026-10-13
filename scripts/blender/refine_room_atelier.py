"""Refine the saved service scene; preserve it and write a separate atelier.blend.
Pinterest is a visual reference only; no photographs/textures are copied.
Packed, seeded PBR maps are shared by Cycles and glTF. Units remain metres.
"""
import bpy, math, os, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from service_room_export import finish_room

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parents[1]/'artifacts'/'blender'
scene=bpy.context.scene
scene.name='Audio Setup | Atelier daylight and evening'
col=bpy.data.collections.new('15 | Atelier finish');scene.collection.children.link(col)
rng=np.random.default_rng(141026)

def principled(m):return next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
def image(name,data):
    h,w=data.shape[:2];rgba=np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3]=data[:,:,None] if data.ndim==2 else data
    im=bpy.data.images.new(name,width=w,height=h);im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(np.clip(rgba,0,1).ravel());im.pack();return im
def link_map(m,name,data,socket):
    n=m.node_tree.nodes.new('ShaderNodeTexImage')
    if socket=='Base Color':
        data=np.where(data<=.0031308,data*12.92,1.055*np.maximum(data,0)**(1/2.4)-.055)
    n.image=image(name,data)
    if socket=='Base Color':n.image.colorspace_settings.name='sRGB'
    m.node_tree.links.new(n.outputs['Color'],principled(m).inputs[socket]);return n
def pbr(m,color,height,rough,strength):
    nt=m.node_tree;p=principled(m)
    for name in ['Base Color','Roughness','Normal']:
        for link in list(p.inputs[name].links):nt.links.remove(link)
    link_map(m,m.name+' | atelier albedo',color,'Base Color')
    link_map(m,m.name+' | atelier roughness',rough,'Roughness')
    dy,dx=np.gradient(height);normal=np.dstack((-dx,-dy,np.ones_like(dx)))
    normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    n=nt.nodes.new('ShaderNodeTexImage');n.image=image(m.name+' | atelier normal',normal*.5+.5)
    b=nt.nodes.new('ShaderNodeNormalMap');b.inputs['Strength'].default_value=strength
    nt.links.new(n.outputs['Color'],b.inputs['Color']);nt.links.new(b.outputs['Normal'],p.inputs['Normal'])
    # Drop disconnected old image nodes so obsolete maps are not exported.
    for n in list(nt.nodes):
        if n.type=='TEX_IMAGE' and not any(output.is_linked for output in n.outputs):nt.nodes.remove(n)

def filtered(n,sx,sy):
    fx,fy=np.meshgrid(np.fft.fftfreq(n),np.fft.fftfreq(n))
    a=np.fft.ifft2(np.fft.fft2(rng.normal(size=(n,n)))*np.exp(-((fx/sx)**2+(fy/sy)**2))).real
    return a/max(a.std(),1e-6)

# Irregular fine fibre structure instead of visibly periodic zebra growth rings.
n=768;u,v=np.meshgrid(np.arange(n)/n,np.arange(n)/n)
fibres=filtered(n,.014,.32);broad=filtered(n,.003,.022)
warp=v+.012*np.sin(u*math.tau)+.004*np.sin(u*math.tau*3)
rings=np.sin(warp*math.tau*19+.7*broad)
grain=np.clip(.96+.055*broad+.012*rings+.012*fibres,.72,1.16)
for name,base,rough in [('Oak - natural oil and open grain',(.44,.315,.195),.47),('Walnut - satin directional grain',(.20,.098,.041),.36)]:
    m=bpy.data.materials.get(name)
    if m:
        pbr(m,np.dstack([grain*x for x in base]),fibres*.05,np.clip(rough+.025*fibres+.025*broad,.26,.65),.18)
        p=principled(m);p.inputs['Coat Weight'].default_value=.12;p.inputs['Coat Roughness'].default_value=.28

# Anodised aluminium: fine linear machining with restrained metal reflection.
n=384;line=filtered(n,.004,.3);fine=rng.normal(0,1,(n,n))
for m in bpy.data.materials:
    if not m.use_nodes:continue
    p=next((x for x in m.node_tree.nodes if x.type=='BSDF_PRINCIPLED'),None)
    if not p:continue
    if m.name.startswith('Brushed silver'):
        base=np.clip(.55+line*.008+fine*.001,.50,.6)
        pbr(m,np.dstack([base*.99,base,base*1.01]),line*.11,np.clip(.29+line*.018,.23,.36),.25)
        p.inputs['Metallic'].default_value=.86;p.inputs['Anisotropic'].default_value=.25
    elif m.name=='Black satin aluminium':
        p.inputs['Base Color'].default_value=(.016,.019,.022,1);p.inputs['Metallic'].default_value=.64;p.inputs['Roughness'].default_value=.36
    elif m.name.startswith('AE320 | Piano'):
        p.inputs['Base Color'].default_value=(.0015,.0018,.0021,1);p.inputs['Roughness'].default_value=.105
        p.inputs['Coat Weight'].default_value=.92;p.inputs['Coat Roughness'].default_value=.055
    elif m.name.startswith('Rubber and driver'):
        p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.68
    elif m.name=='6SN7 | clear glass':
        p.inputs['Roughness'].default_value=.035;p.inputs['Transmission Weight'].default_value=1
    elif m.name=='Gliver | soft seam':
        p.inputs['Base Color'].default_value=(.46,.435,.39,1)

# Low-sheen milk velour with direction-dependent nap variation; no leather sheen.
n=512;fine=rng.normal(0,1,(n,n));nap=filtered(n,.013,.032);fibres=filtered(n,.32,.11)
m=bpy.data.materials['Gliver | milk Vertical velour'];shade=np.clip(1+.012*nap+.003*fine,.89,1.09)
pbr(m,np.dstack([shade*.71,shade*.676,shade*.598]),fibres*.035,np.clip(.84+.02*nap,.78,.90),.12)
p=principled(m);p.inputs['Sheen Weight'].default_value=.65;p.inputs['Sheen Roughness'].default_value=.7;p.inputs['Specular IOR Level'].default_value=.16
for o in scene.objects:
    if o.name.startswith('Gliver | channel stitching') and o.type=='CURVE':o.data.bevel_depth=.00065

# Fine matte wool and linen: retain the owner carpet pattern, reduce shiny ridges.
for m in bpy.data.materials:
    if m.name.startswith(('Quincey | ivory','Natural linen')):
        p=principled(m);p.inputs['Specular IOR Level'].default_value=.19;p.inputs['Sheen Weight'].default_value=.38

for o in scene.objects:
    if o.type!='LIGHT':continue
    if o.name=='Daylight | soft window key':o.data.energy=440;o.data.size=2.8
    elif o.name=='Daylight | gentle front bounce':o.data.energy=30
    elif o.name=='Daylight | late afternoon through window':o.data.energy=.38;o.data.angle=.16
    elif o.name=='Lacquer | warm vertical edge':o.data.energy=18
scene.cycles.use_denoising=True;scene.cycles.adaptive_threshold=.015
scene.cycles.max_bounces=10;scene.cycles.transmission_bounces=8
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.15
scene.render.image_settings.quality=95
scene['visual_references']='Pinterest 509188301595058556 (light/wood/soft shadows); 592364157249810784 (wood finish and metal contrast). Visual references, not acoustic evidence.'

# Render a separate evening mood using the same scene and camera as the hero.
hero=scene.camera;hero.location=(2.2,-4.65,1.9);hero.rotation_euler=(Vector((-.2,-.6,.73))-hero.location).to_track_quat('-Z','Y').to_euler();hero.data.lens=28
hero.data.dof.use_dof=True;hero.data.dof.focus_distance=(Vector((-.2,-.6,.73))-hero.location).length;hero.data.dof.aperture_fstop=9
if os.environ.get('AUDIO_SKIP_RENDER')!='1':
    saved_lights=[(o,o.data.energy,tuple(o.data.color)) for o in scene.objects if o.type=='LIGHT']
    bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg_saved=tuple(bg.inputs[0].default_value),bg.inputs[1].default_value
    backdrop=bpy.data.materials.get('Window | soft garden daylight');bp=principled(backdrop) if backdrop else None
    emission=tuple(bp.inputs['Emission Color'].default_value) if bp else None
    base=tuple(bp.inputs['Base Color'].default_value) if bp else None
    if bp:bp.inputs['Base Color'].default_value=(.015,.025,.05,1);bp.inputs['Emission Color'].default_value=(.025,.05,.10,1)
    for o,energy,color in saved_lights:
        if o.name.startswith('Daylight |'):
            o.data.energy=energy*.07;o.data.color=(.5,.66,1)
        elif o.name.startswith(('Lamp ','Pendant |')):o.data.energy=energy*2.6;o.data.color=(1,.65,.34)
        else:o.data.energy=energy*.6
    bg.inputs[0].default_value=(.1,.16,.3,1);bg.inputs[1].default_value=.015
    scene.cycles.samples=192;scene.render.filepath=str(ROOT/'public/images/listening-room-evening.jpg')
    bpy.ops.render.render(write_still=True);print('ATELIER_EVENING_DONE',flush=True)
    for o,energy,color in saved_lights:o.data.energy=energy;o.data.color=color
    bg.inputs[0].default_value=bg_saved[0];bg.inputs[1].default_value=bg_saved[1]
    if bp:bp.inputs['Emission Color'].default_value=emission;bp.inputs['Base Color'].default_value=base
finish_room(scene,col,stem='atelier',samples=192,detail=True)
