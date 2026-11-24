"""Author Larry on THRIVE's Humanoid_Rigged_NotOverlapping.glb (Blender 4.3).

Run: blender -b -t 2 --python art/build_larry.py -- /path/to/THRIVE's GLB
Produces the animated source GLB and the browser renderer's compact skin data.
"""
import array
import base64
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
body = next(o for o in bpy.context.scene.objects if o.type == "MESH" and o.parent == rig)
for obj in list(bpy.context.scene.objects):
    if obj not in {rig, body}:
        bpy.data.objects.remove(obj, do_unlink=True)
rig.name = "Larry"
body.name = "Larry | weighted body"

colors = {}


def material(name, hex_color):
    rgb = tuple(bytes.fromhex(hex_color))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = tuple(v / 255 for v in rgb) + (1,)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = tuple((v / 255) ** 2.2 for v in rgb) + (1,)
    shader.inputs["Roughness"].default_value = .93
    colors[mat.name] = rgb
    return mat


skin = material("Skin", "ca9371")
skin_light = material("Nose and ears", "d1a080")
polo = material("Forest green polo", "506d46")
collar = material("Polo collar", "789068")
seam = material("Polo seams", "3f563a")
khaki = material("Brown chinos", "7d644c")
shoe = material("White sneakers", "eae8da")
sole = material("Rubber soles", "b8bcb2")
laces = material("Cotton laces", "cccfc7")
hair = material("Graying brown hair", "686054")
gray = material("Silver at the temples", "8e8471")
eyes = material("Eyes", "473b31")
lip = material("Mouth", "935f50")
black = material("Watch strap", "424543")
metal = material("Brushed metal", "aeb6ac")
watchface = material("Watch face", "455c5c")
can = material("Beer label", "d5c99e")
can_band = material("Beer label stripe", "81643c")

body.data.materials.clear()
for mat in [skin, polo, khaki, shoe]:
    body.data.materials.append(mat)
for v in body.data.vertices:
    x, y, z = body.matrix_world @ v.co
    # Stretch the original weighted waist forward and broaden the polo hem.
    if abs(x) < .25 and .94 < z < 1.38:
        belly = max(0, 1-abs(z-1.10)/.28) * max(0, 1-abs(x)/.27)
        v.co.x *= 1 + .15 * belly
        if y < .045:
            v.co.y -= .092 * belly * min(1, (.045-y)/.11)
    if z < .133:
        v.co.z += .016
for p in body.data.polygons:
    x, y, z = p.center
    p.material_index = 3 if z < .135 else 2 if z < .975 and abs(x) < .29 else 1 if .975 <= z < 1.505 and abs(x) < .33 else 0
    p.use_smooth = False
body.data.update()

vertices, faces, weights, materials = [], [], [], []


def add(pts, polygons, mat, bone):
    offset = len(vertices)
    vertices.extend(pts)
    weights.extend([bone] * len(pts))
    faces.extend([tuple(offset+i for i in p) for p in polygons])
    materials.extend([mat] * len(polygons))


def panel(pts, mat, bone):
    add(pts, [tuple(range(len(pts)))], mat, bone)


def block(center, size, mat, bone):
    x, y, z = center
    w, d, h = (n / 2 for n in size)
    coords = [(x-w,y-d,z-h),(x+w,y-d,z-h),(x+w,y+d,z-h),(x-w,y+d,z-h),
              (x-w,y-d,z+h),(x+w,y-d,z+h),(x+w,y+d,z+h),(x-w,y+d,z+h)]
    add(coords, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat, bone)


def tube(a,b,r1,r2,mat,bone,sides=10):
    a,b=Vector(a),Vector(b)
    d=(b-a).normalized()
    tangent=d.cross(Vector((0,1,0)) if abs(d.y)<.85 else Vector((0,0,1))).normalized()
    tangent_b=d.cross(tangent)
    rings=[]
    for center,r in ((a,r1),(b,r2)):
        for i in range(sides):
            angle=math.tau*i/sides
            rings.append(tuple(center+r*(tangent*math.cos(angle)+tangent_b*math.sin(angle))))
    polygons=[tuple(reversed(range(sides))),tuple(range(sides,sides*2))]
    for i in range(sides):
        j=(i+1)%sides
        polygons.append((i,j,j+sides,i+sides))
    add(rings,polygons,mat,bone)


for side,suffix in ((1,"L"),(-1,"R")):
    # Modern sneaker uppers, wide soles and flat lace bars.
    block((side*.169,-.071,.038),(.147,.264,.041),sole,"foot."+suffix)
    tube((side*.169,.042,.080),(side*.179,-.193,.070),.068,.077,shoe,"foot."+suffix,8)
    for i in range(3):
        block((side*.175,-.082-i*.025,.140-i*.005),(.094,.013,.012),laces,"foot."+suffix)
    # Stand-up collar, button placket, sleeves with hems and a breast pocket.
    panel([(side*.03,-.095,1.495),(side*.091,-.072,1.461),(side*.094,-.129,1.401),(side*.023,-.141,1.449)],collar,"chest")
    upper=rig.data.bones["upper_arm."+suffix]
    a=upper.head_local
    v=upper.tail_local-a
    tube(tuple(a+v*.05),tuple(a+v*.52),.081,.073,polo,upper.name,8)
    tube(tuple(a+v*.49),tuple(a+v*.55),.074,.074,seam,upper.name,8)
    # Brow, eye, ear. The forehead stays open above the temples.
    block((side*.031,-.128,1.702),(.037,.009,.009),gray,"head")
    block((side*.030,-.130,1.681),(.020,.010,.012),eyes,"head")
    tube((side*.069,-.018,1.637),(side*.094,-.016,1.647),.025,.017,skin_light,"head",7)
block((0,-.140,1.406),(.022,.009,.095),seam,"chest")
for z in (1.426,1.395):
    block((0,-.146,z),(.011,.006,.009),laces,"chest")
panel([(.105,-.146,1.331),(.186,-.119,1.331),(.178,-.125,1.273),(.121,-.154,1.267)],collar,"chest")
panel([(-.022,-.131,1.681),(.023,-.131,1.681),(.023,-.137,1.630),(0,-.158,1.629),(-.022,-.135,1.632)],skin_light,"head")
block((0,-.128,1.611),(.047,.012,.006),lip,"head")
# A coarse horseshoe of hair leaves the scalp and crown bare.
for i in range(12):
    a=math.radians(-31+i*20)
    b=math.radians(-31+(i+1)*20)
    def dome(theta, top):
        edge=.83+.10*abs(math.sin(theta))
        return (.087*math.cos(theta)*(edge if top else 1),-.023+.101*math.sin(theta)*(edge if top else 1),1.773 if top else 1.656+.027*max(0,math.sin(theta)))
    panel([dome(a,False),dome(b,False),dome(b,True),dome(a,True)],gray if i in (0,1,10,11) else hair,"head")
    panel([dome(a,True),dome(b,True),(.055*math.cos(b),-.023+.070*math.sin(b),1.791),(.055*math.cos(a),-.023+.070*math.sin(a),1.791)],hair,"head")
# Wristwatch on the left. The can moves with the right wrist.
lh=rig.data.bones["hand.L"]
rh=rig.data.bones["hand.R"]
L=lh.head_local+(lh.tail_local-lh.head_local)*.10
tube(L-(lh.tail_local-lh.head_local)*.05,L+(lh.tail_local-lh.head_local)*.09,.054,.054,black,lh.name)
tube(L+Vector((0,-.045,.014)),L+Vector((0,-.068,.018)),.031,.030,metal,lh.name)
tube(L+Vector((0,-.068,.018)),L+Vector((0,-.072,.019)),.023,.023,watchface,lh.name)
C=rh.head_local+(rh.tail_local-rh.head_local)*.40+Vector((0,-.056,.007))
a=C+Vector((-.019,0,-.053))
b=C+Vector((.019,0,.052))
tube(a,b,.033,.033,can,rh.name)
tube(a,a.lerp(b,.07),.034,.034,metal,rh.name)
tube(a.lerp(b,.40),a.lerp(b,.58),.0338,.0338,can_band,rh.name)
tube(a.lerp(b,.91),b,.034,.034,metal,rh.name)
block(tuple(b+Vector((0,0,.005))),(.024,.013,.008),black,rh.name)

detail=bpy.data.meshes.new("Suburban clothing and accessories")
detail.from_pydata(vertices,[],faces)
detail.update()
obj=bpy.data.objects.new("Larry | polo, shoes, face, watch and can",detail)
bpy.context.collection.objects.link(obj)
obj.parent=rig
for bone in set(weights):
    group=obj.vertex_groups.new(name=bone)
    group.add([i for i,n in enumerate(weights) if n==bone],1,"REPLACE")
slots={}
for p,mat in zip(detail.polygons,materials):
    if mat.name not in slots:
        slots[mat.name]=len(detail.materials)
        detail.materials.append(mat)
    p.material_index=slots[mat.name]
mod=obj.modifiers.new("THRIVE rig","ARMATURE")
mod.object=rig

bones=list(rig.pose.bones)


def orient(name,direction):
    bone=rig.pose.bones[name]
    origin=bone.head.copy()
    current=(bone.tail-origin).normalized()
    rotation=current.rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()
    bone.matrix=Matrix.Translation(origin)@rotation@Matrix.Translation(-origin)@bone.matrix
    bpy.context.view_layer.update()


def toward(name,pos):
    orient(name,Vector(pos)-rig.pose.bones[name].head)


def blend(a,b,amount):
    return Vector(a).lerp(Vector(b),amount)


clips={"stand":(3,True),"hips":(3.1,True),"drink":(4.3,False),"watch":(3.6,False),
       "walk":(1.08,True),"sit":(4.2,False),"inspect":(3.5,True),"talk":(2.2,True)}
fps=15
runtime={}


def pose(clip,p):
    for bone in bones:
        bone.rotation_mode="QUATERNION"
        bone.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    q=math.tau*p
    pulse=math.sin(q)
    settle=math.sin(math.pi*p)**2
    pelvis=rig.pose.bones["pelvis"]
    hip=.011*math.cos(q)
    if clip=="walk":hip=.019*math.cos(2*q)-.023
    if clip=="sit":hip=-.414*min(1,p*5)
    pelvis.matrix=Matrix.Translation((0,.025 if clip=="sit" else 0,hip))@pelvis.matrix
    bpy.context.view_layer.update()
    orient("spine",(.025*pulse,-.24 if clip=="inspect" else -.025,1))
    if clip=="inspect":orient("head",(pulse*.15,-.72,.78))
    elif clip=="watch":orient("head",(settle*.21,-settle*.57,1))
    else:orient("head",(pulse*.07,-.08,1))
    for sign,side in ((1,"L"),(-1,"R")):
        upper="upper_arm."+side
        fore="forearm."+side
        hand="hand."+side
        thigh="thigh."+side
        shin="shin."+side
        rest_arm=(sign*.14,.055,-1)
        rest_fore=(sign*-.12,-.14,-1)
        if clip=="walk":
            swing=pulse*sign
            orient(thigh,(sign*.08,-swing*.55,-1))
            orient(shin,(sign*.045,max(.04,-math.cos(q)*sign*.63),-1))
            orient(upper,(sign*.18,swing*.37,-1))
            orient(fore,(sign*-.08,swing*.25-.22,-1))
        elif clip=="sit":
            sit=min(1,p*5)
            orient(thigh,(sign*.11,-.98*sit,-1+sit*.92))
            orient(shin,(sign*.065,-.09,-1))
            orient(upper,(sign*.25,-.42,-1))
            orient(fore,(sign*.10,-.82,-.13))
        elif clip=="hips":
            orient(upper,(sign*.73,.075,-.70))
            toward(fore,(sign*.20,-.085,1.052+.008*pulse))
        elif clip=="drink" and side=="R":
            orient(upper,blend(rest_arm,(-.42,-.86,-.66),settle))
            target=blend((-.225,-.01,.96),(-.05,-.205,1.56),settle)
            toward(fore,target)
        elif clip=="watch" and side=="L":
            orient(upper,blend(rest_arm,(.31,-.77,-.56),settle))
            toward(fore,blend((.24,-.03,.99),(.031,-.322,1.31),settle))
        elif clip=="talk" and side=="L":
            orient(upper,(.26,-.23-.19*pulse,-1))
            orient(fore,(-.33,-.68-.25*math.cos(q),-.42+.22*pulse))
        elif clip=="inspect":
            orient(upper,(sign*.22,-.17,-1))
            orient(fore,(sign*-.20,.18,-1))
        else:
            orient(upper,rest_arm)
            orient(fore,rest_fore)
        arm=rig.pose.bones[fore]
        direction=(arm.tail-arm.head).normalized()
        orient(hand,direction)
        if clip in {"walk","sit"}:
            orient("foot."+side,(sign*.09,-1,-.33))

rig.animation_data_create()
axis=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
inv=axis.inverted()
rest={b.name:b.bone.matrix_local.inverted() for b in bones}
for name,(duration,loop) in clips.items():
    action=bpy.data.actions.new(name.capitalize())
    action.use_fake_user=True
    rig.animation_data.action=action
    count=round(duration*fps)+1
    matrices=array.array("h")
    for frame in range(count):
        pose(name,frame/(count-1))
        for bone in bones:
            bone.keyframe_insert(data_path="rotation_quaternion",frame=frame,group=bone.name)
            bone.keyframe_insert(data_path="location",frame=frame,group=bone.name)
            skin_matrix=axis@bone.matrix@rest[bone.name]@inv
            matrices.extend(round(skin_matrix[row][col]*10000) for row in range(3) for col in range(4))
    if sys.byteorder!="little":matrices.byteswap()
    runtime[name]={"duration":duration,"loop":loop,"count":count,"matrices":base64.b64encode(matrices.tobytes()).decode()}

rig.animation_data.action=None
for bone in bones:bone.matrix_basis=Matrix.Identity(4)
scene=bpy.context.scene
scene.render.fps=fps
scene.frame_set(0)
bpy.ops.object.select_all(action="DESELECT")
for o in (rig,body,obj):o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/"art"/"Larry.glb"),export_format="GLB",use_selection=True,
                          export_animations=True,export_animation_mode="ACTIONS",export_frame_range=False)

coords, indices, rgb, influences=[],[],[],[]
bone_ids={b.name:i for i,b in enumerate(bones)}
for o in (body,obj):
    o.data.calc_loop_triangles()
    offset=len(coords)//3
    for v in o.data.vertices:
        coords.extend(round(n,5) for n in (axis@o.matrix_world@v.co))
        groups=[(bone_ids[o.vertex_groups[g.group].name],g.weight) for g in v.groups if g.weight>0 and o.vertex_groups[g.group].name in bone_ids]
        if not groups:groups=[(0,1)]
        total=sum(w for _,w in groups)
        influences.append([n for i,w in groups for n in (i,round(w/total,6))])
    for tri in o.data.loop_triangles:
        ids=tuple(tri.vertices)
        indices.extend(offset+i for i in ids)
        mat=colors[o.data.materials[o.data.polygons[tri.polygon_index].material_index].name]
        normal=axis.to_3x3()@tri.normal
        shade=.76+.24*max(0,normal.dot(Vector((-.43,.86,.26))))
        rgb.extend(round(v*shade) for v in mat)
data={"bones":len(bones),"coords":coords,"indices":indices,"rgb":rgb,"weights":influences,"clips":runtime}
target=ROOT/"js"/"larry-data.js"
target.write_text("// Generated by art/build_larry.py from THRIVE's 22-bone humanoid.\n"
                  "Rocks.larryData = "+json.dumps(data,separators=(",",":"))+";\n")
print(f"LARRY_ART: {len(bones)} bones, {len(coords)//3} vertices, {len(indices)//3} triangles, {len(clips)} clips")
