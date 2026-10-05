"""Shared image-based finishes for Cycles and glTF; no external texture assets."""
import bpy, math, random
import numpy as np
from mathutils import Vector


def finish_room(scene, collection, texture_dir):
    texture_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(205)

    def image(name, data, color=False):
        h, w = data.shape[:2]
        rgba = np.ones((h, w, 4), dtype=np.float32)
        rgba[:, :, :3] = data[:, :, None] if data.ndim == 2 else data
        im = bpy.data.images.new(name, width=w, height=h)
        if not color: im.colorspace_settings.name = 'Non-Color'
        im.pixels.foreach_set(np.clip(rgba, 0, 1).ravel())
        im.filepath_raw = str(texture_dir / (name + '.png'))
        im.file_format = 'PNG'; im.save(); im.pack()
        return im

    def textured(name, color, height, rough, strength=.25, metal=0):
        m = bpy.data.materials.new(name); m.use_nodes = True
        nt = m.node_tree; p = next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
        p.inputs['Metallic'].default_value = metal
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = image(name+' albedo', color, True)
        nt.links.new(n.outputs['Color'], p.inputs['Base Color'])
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = image(name+' roughness', rough)
        nt.links.new(n.outputs['Color'], p.inputs['Roughness'])
        dy, dx = np.gradient(height)
        normal = np.dstack((-dx*10, -dy*10, np.ones_like(dx)))
        normal /= np.linalg.norm(normal, axis=2)[:, :, None]
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = image(name+' normal', normal*.5+.5)
        b = nt.nodes.new('ShaderNodeNormalMap'); b.inputs['Strength'].default_value = strength
        nt.links.new(n.outputs['Color'], b.inputs['Color']); nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
        return m

    n = 512; u, v = np.meshgrid(np.arange(n)/n, np.arange(n)/n)
    # Interlaced diagonal sleeves: height, roughness and subtle fibre colour.
    a = np.sin(math.tau*8*(u+v)); b = np.sin(math.tau*8*(u-v))
    over = np.sin(math.tau*4*(u+v))*np.sin(math.tau*4*(u-v)) > 0
    weave = np.where(over, a, b)*.08 + rng.normal(0, .008, (n,n))
    shade = .11 + weave*.32
    braid = textured('Cable - graphite woven sleeve', np.dstack([shade*.94, shade*.97, shade]),
                     weave, np.clip(.47+weave*.5, .35, .58), .7)
    p = next(n for n in braid.node_tree.nodes if n.type=='BSDF_PRINCIPLED'); p.inputs['Sheen Weight'].default_value = .12
    rubber = bpy.data.materials.new('Cable - soft moulded rubber'); rubber.use_nodes = True
    p = next(n for n in rubber.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (.009, .010, .012, 1)
    p.inputs['Roughness'].default_value = .51

    # Wood grain has long fibres, nonuniform growth rings and fine open pores.
    n = 768; u, v = np.meshgrid(np.arange(n)/n, np.arange(n)/n)
    fx, fy = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n))
    fibres = np.fft.ifft2(np.fft.fft2(rng.normal(0,1,(n,n))) * np.exp(-((fx/.012)**2+(fy/.30)**2))).real
    fibres /= fibres.std()
    rings = np.sin((v+.018*np.sin(u*7)+.005*np.sin(u*19))*150)
    pores = np.maximum(0, fibres-1.1)
    grain = .92 + .04*rings + .025*fibres - .035*pores
    oak = textured('Oak - natural oil and open grain', np.dstack([grain*.53, grain*.421, grain*.32]),
                   .015*fibres+.007*rings, np.clip(.37+.045*fibres, .25, .55), .16)
    walnut = textured('Walnut - satin directional grain', np.dstack([grain*.35, grain*.22, grain*.13]),
                      .02*fibres+.013*rings, np.clip(.38+.035*fibres, .29, .5), .15)
    tone = random.Random(84)
    for o in scene.objects:
        if o.type != 'MESH': continue
        names = ' '.join(m.name for m in o.data.materials if m)
        is_floor = o.name.startswith('Oak |')
        is_walnut = 'Walnut |' in names
        if not (is_floor or is_walnut): continue
        o.data.materials.clear(); o.data.materials.append(oak if is_floor else walnut)
        uv = o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
        offset = (tone.random()*5, tone.random()*5)
        for face in o.data.polygons:
            axis = max(range(3), key=lambda i:abs(face.normal[i]))
            a,b = {0:(1,2),1:(0,2),2:(1,0)}[axis]
            scales = (1.8,.6,2) if is_floor else (2,1.8,3)
            for li in face.loop_indices:
                p = o.matrix_world @ o.data.vertices[o.data.loops[li].vertex_index].co
                uv.data[li].uv = (p[a]*scales[a]+offset[0], p[b]*scales[b]+offset[1])

    # Layered lacquer and glass remain physically distinct from metal and rubber.
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        p = next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'), None)
        if not p: continue
        if m.name.startswith('AE320 | Piano'):
            p.inputs['Base Color'].default_value = (.0012,.0016,.002,1)
            p.inputs['Roughness'].default_value = .12
            p.inputs['Coat Weight'].default_value = .8
            p.inputs['Coat Roughness'].default_value = .045
        elif m.name.startswith('REL | owner'):
            p.inputs['Base Color'].default_value = (.18,.19,.205,1)
            p.inputs['Roughness'].default_value = .48
        elif m.name.startswith('Freya | tube glass'):
            p.inputs['Base Color'].default_value = (.82,.88,.93,1)
            p.inputs['Metallic'].default_value = 0
            p.inputs['Transmission Weight'].default_value = .96
            p.inputs['Roughness'].default_value = .10
            p.inputs['IOR'].default_value = 1.47
        elif m.name.startswith('Brushed silver'):
            p.inputs['Roughness'].default_value = .33

    # Sofa feet make contact with the finished boards instead of floating.
    for x in (-.87,.87):
        for y in (-4.48,-3.84):
            bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.023,depth=.11,location=(x,y,.059))
            o=bpy.context.object; o.name='Listening sofa | recessed oak foot'
            for c in list(o.users_collection): c.objects.unlink(o)
            collection.objects.link(o); o.data.materials.append(walnut)
            for face in o.data.polygons: face.use_smooth=True

    # Wool geometry: shallow irregularity breaks the perfect plastic rib appearance.
    wool_rng = random.Random(23)
    for o in scene.objects:
        if not o.name.startswith('Quincey | sculpted pile') or o.type!='CURVE': continue
        o.data.bevel_depth = .0052 + wool_rng.uniform(-.00035,.00035)
        for spline in o.data.splines:
            for point in spline.points:
                point.co.z += wool_rng.uniform(-.00065,.00065)

    lights = {'Daylight | soft window key':(510,(.86,.92,1)),
              'Daylight | gentle front bounce':(38,(1,.91,.80)),
              'Lacquer | warm vertical edge':(26,(1,.87,.70))}
    for name,(power,color) in lights.items():
        o=scene.objects.get(name)
        if o: o.data.energy=power; o.data.color=color
    bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
    bg.inputs[1].default_value=.045
    sunlight=bpy.data.lights.new('Daylight | late afternoon through window','SUN')
    sunlight.energy=.65; sunlight.angle=.12; sunlight.color=(1,.94,.84)
    o=bpy.data.objects.new('Daylight | late afternoon through window',sunlight);collection.objects.link(o)
    o.location=(-2.8,-2.7,2.5)
    o.rotation_euler=(Vector((.4,-.2,.2))-o.location).to_track_quat('-Z','Y').to_euler()
    scene.cycles.samples=192; scene.cycles.adaptive_threshold=.012
    scene.cycles.max_bounces=10; scene.cycles.transmission_bounces=6
    scene.cycles.use_denoising=True
    scene.view_settings.exposure=.15
    scene.camera.data.dof.aperture_fstop=7.1
    scene.camera.location=(2.15,-4.35,1.67)
    scene.camera.rotation_euler=(Vector((-.1,-.25,.90))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.lens=33
    scene.render.image_settings.quality=95
    return braid, rubber, walnut
