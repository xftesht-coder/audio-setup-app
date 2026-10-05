"""Shared render wiring. Audio and equipment power are drawn live on the web."""
import bpy,math

def update_wiring(scene,collection,layout):
    def mat(term):return next(m for m in bpy.data.materials if term in m.name)
    braid=mat('graphite woven');rubber=mat('soft moulded rubber');silver=mat('Brushed silver aluminium')
    for o in list(scene.objects):
        name=o.name
        dynamic_power=o.get('route_kind')=='power' and ('relaxed power arc' in name or 'sub mains dressed' in name)
        remove=(o.get('interactive_cable') or dynamic_power or name.startswith('Main outlet ') or 'connected power boot' in name
            or 'adapter envelope unmeasured' in name or 'external 24-6 VAC transformer envelope' in name)
        if name.startswith(('L | Schuko','R | Schuko')) and o.location.y<.23:remove=True
        if remove:bpy.data.objects.remove(o,do_unlink=True)
    def cylinder(name,pos,r,depth,axis,material):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=r,depth=depth,location=pos)
        o=bpy.context.object;o.name=name
        for c in list(o.users_collection):c.objects.unlink(o)
        collection.objects.link(o);o.data.materials.append(material);o['interactive_cable']=True
        if axis=='Y':o.rotation_euler.x=math.pi/2
        for face in o.data.polygons:face.use_smooth=True
    for cable in layout['cables']:
        for path in cable['paths']:
            name='Interactive cable | '+cable['id'];d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=path['radius'];d.bevel_resolution=2
            s=d.splines.new('POLY');s.points.add(len(path['points'])-1)
            for p,xyz in zip(s.points,path['points']):p.co=(*xyz,1)
            o=bpy.data.objects.new(name,d);collection.objects.link(o);d.materials.append(braid if path['radius']>=.003 else rubber);o['interactive_cable']=True
            for i,point in enumerate([path['start'],path['end']]):
                if not path.get('startPlug' if i==0 else 'endPlug',True):continue
                x,y,z=point;axis=path['startAxis' if i==0 else 'endAxis']
                if axis=='Z':
                    cylinder('Interactive Schuko | '+cable['id'],(x,y,z-.022),.017,.040,'Z',rubber)
                    if path.get('adapter') and i==0:
                        bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z+.01));o=bpy.context.object;o.name='Interactive PSU | '+cable['id'];o.dimensions=(.035,.045,.038)
                        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
                        for c in list(o.users_collection):c.objects.unlink(o)
                        collection.objects.link(o);o.data.materials.append(rubber);o['interactive_cable']=True
                        b=o.modifiers.new('PSU edges','BEVEL');b.width=.003;b.segments=3
                else:
                    cylinder('Interactive plug | '+cable['id'],(x,y+.010,z),path['radius']*1.8,.020,'Y',silver)
                    cylinder('Interactive boot | '+cable['id'],(x,y+.025,z),path['radius']*1.35,.012,'Y',rubber)
