# The mountain's animals (#136), kitbashed from the Quaternius pack (CC0), which has none:
# the chamois from the doe, the ibex from the stag, the marmot from the fox. Their rigs and
# clips stay; only the body changes (coat, horns, shape).
# Run in Blender (MCP): exec(open(p).read(), {"__file__": p, "__name__": "__main__"}), or
# headless: `blender -b --factory-startup --python scripts/mountain_animals.py`. Reads the
# pack's glTF extracted in assets-private/animals/quaternius, writes
# assets-private/animals/export/<Name>.glb, which `npm run assets` takes into animals.glb.
import math
import os

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets-private", "animals")
PACK = os.path.join(ROOT, "quaternius", "Ultimate Animated Animals - July 2021", "glTF")
OUT = os.path.join(ROOT, "export")


def srgb(r, g, b):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(r), lin(g), lin(b), 1.0)


def load(source, name):
    """The pack's animal in a scene of its own, with plain materials of its glTF colours."""
    old = bpy.data.scenes.get(name)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o)
        bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new(name)
    # The pack's clips are keyed at 30 frames per second: no rounding of their keys.
    scene.render.fps = 30
    bpy.context.window.scene = scene
    before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(PACK, source + ".gltf"))
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    # The pack's bone shape is not part of the animal.
    for o in [o for o in scene.objects if o.type == "MESH" and o.parent is None]:
        bpy.data.objects.remove(o)
    body = next(o for o in scene.objects if o.type == "MESH" and o.modifiers)
    # Rigid parts on a bone (the stag's antlers) are left to the caller.
    for m in body.data.materials:
        plain(m)
    rig.name = f"{name}Armature"
    body.name = name
    actions = [a for a in bpy.data.actions if a not in before]
    return scene, rig, body, actions


def plain(material, colour=None):
    """A principled material of one colour: the importer multiplies a colour attribute by it."""
    nt = material.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    if colour is None:
        mix = next((n for n in nt.nodes if n.type == "MIX"), None)
        colour = tuple(mix.inputs["B"].default_value) if mix else tuple(bsdf.inputs["Base Color"].default_value)
    for n in [n for n in nt.nodes if n.type in ("MIX", "VERTEX_COLOR")]:
        nt.nodes.remove(n)
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = 1.0
    return material


def material(body, name, colour):
    """The body's material of that name, made if missing, in that colour."""
    me = body.data
    for i, m in enumerate(me.materials):
        if m.name.split(".")[0] == name:
            plain(m, colour)
            return i
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    plain(m, colour)
    me.materials.append(m)
    return len(me.materials) - 1


def index_of(body, name):
    return next(i for i, m in enumerate(body.data.materials) if m.name.split(".")[0] == name)


def weight(vertex, group):
    return next((e.weight for e in vertex.groups if e.group == group), 0.0)


def bone_weight(body, vertex, bone):
    return weight(vertex, body.vertex_groups[bone].index)


def paint(body, test, index):
    """Faces for which test(polygon) holds take that material."""
    me = body.data
    for p in me.polygons:
        if test(p):
            p.material_index = index


def tube(body, points, radii, index, bone, sides=6, ridges=0.0):
    """A tapered tube through the points, skinned fully to one bone, joined into the body."""
    bm = bmesh.new()
    rings = []
    for i, (p, r) in enumerate(zip(points, radii)):
        a = Vector(points[max(0, i - 1)])
        b = Vector(points[min(len(points) - 1, i + 1)])
        axis = (b - a).normalized()
        side = axis.cross(Vector((1, 0, 0)))
        if side.length < 1e-3:
            side = axis.cross(Vector((0, 1, 0)))
        side.normalize()
        up = axis.cross(side).normalized()
        # Ridges: every other ring a little wider, like the rings of a horn.
        r *= 1 + (ridges if i % 2 else 0)
        rings.append(
            [
                bm.verts.new(Vector(p) + r * (math.cos(t) * side + math.sin(t) * up))
                for t in (2 * math.pi * k / sides for k in range(sides))
            ]
        )
    for ring, nxt in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((ring[k], ring[(k + 1) % sides], nxt[(k + 1) % sides], nxt[k]))
    bm.faces.new(list(reversed(rings[0])))
    tip = bm.verts.new(Vector(points[-1]) + (Vector(points[-1]) - Vector(points[-2])).normalized() * radii[-1])
    for k in range(sides):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % sides], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("part")
    bm.to_mesh(me)
    bm.free()
    part = bpy.data.objects.new("part", me)
    bpy.context.scene.collection.objects.link(part)
    for p in me.polygons:
        p.use_smooth = False
    group = part.vertex_groups.new(name=bone)
    group.add(list(range(len(me.vertices))), 1.0, "REPLACE")
    join(body, part, index)


def join(body, part, index):
    """Join a part into the body, all its faces in that material."""
    me = part.data
    me.materials.clear()
    for m in body.data.materials:
        me.materials.append(m)
    for p in me.polygons:
        p.material_index = index
    with bpy.context.temp_override(active_object=body, selected_editable_objects=[body, part]):
        bpy.ops.object.join()


def mirrored(points, side):
    return [(side * x, y, z) for x, y, z in points]


def squeeze(body, bones, origin, factor):
    """Vertices of these bones move towards a point, as much as they follow those bones."""
    groups = [body.vertex_groups[b].index for b in bones]
    o = Vector(origin)
    for v in body.data.vertices:
        w = min(1.0, sum(weight(v, g) for g in groups))
        if w > 0:
            v.co = v.co.lerp(o + (v.co - o) * factor, w)


def chamois():
    """The doe made a chamois: tawny coat with a dark back stripe and dark legs, white face
    with a black band through each eye, short black horns hooked backwards."""
    scene, rig, body, actions = load("Deer", "Chamois")
    me = body.data
    material(body, "Main", srgb(118, 86, 62))
    material(body, "Main_Light", srgb(236, 226, 204))
    dark = material(body, "Main_Dark", srgb(52, 40, 34))
    material(body, "Hooves", srgb(36, 30, 28))
    light = index_of(body, "Main_Light")
    main = index_of(body, "Main")
    eye = {index_of(body, n) for n in ("Eye_Black", "Eye_White", "Eye_Lighter")}
    head = body.vertex_groups["Head"].index

    def on_head(p):
        return sum(weight(me.vertices[i], head) for i in p.vertices) / len(p.vertices) > 0.5

    # A white face, a black band from the horns through the eye down to the muzzle.
    def band(p):
        c = p.center
        if abs(c.x) < 0.1:
            return False
        # Along the band, from the horn (y -1.98, z 4.04) through the eye to the mouth.
        a, b = Vector((-1.98, 4.06)), Vector((-2.62, 3.6))
        q = Vector((c.y, c.z))
        t = max(0.0, min(1.0, (q - a).dot(b - a) / (b - a).length_squared))
        return (q - (a + (b - a) * t)).length < 0.075

    for p in me.polygons:
        if p.material_index in eye or not on_head(p):
            continue
        p.material_index = dark if band(p) else light
    # Dark legs below the knees.
    paint(body, lambda p: p.material_index in (main, light) and p.center.z < 1.35, dark)
    # Shorter ears.
    for side in ("L", "R"):
        base = rig.data.bones[f"Ear1.{side}"].head_local
        squeeze(body, [f"Ear{k}.{side}" for k in range(1, 5)], base, 0.72)
    horn = material(body, "Horn", srgb(30, 26, 26))
    for side in (1, -1):
        points = mirrored(
            [(0.11, -1.99, 3.98), (0.12, -2.0, 4.18), (0.13, -1.98, 4.36), (0.135, -1.92, 4.48), (0.14, -1.83, 4.5), (0.14, -1.77, 4.43)],
            side,
        )
        tube(body, points, [0.055, 0.05, 0.042, 0.033, 0.024, 0.014], horn, "Head")
    return scene, rig, body, actions


def ibex():
    """The stag made an ibex: grey-brown coat, pale belly, dark legs and beard, and in place of
    the antlers two long ridged horns sweeping back over the neck."""
    scene, rig, body, actions = load("Stag", "Ibex")
    for o in [o for o in scene.objects if o.type == "MESH" and o is not body]:
        bpy.data.objects.remove(o)
    me = body.data
    # The stag's materials: coat, hooves, mane and belly, muzzle, eyes.
    coat, hooves, light, muzzle, _ = range(5)
    plain(me.materials[coat], srgb(140, 118, 92))
    plain(me.materials[hooves], srgb(40, 34, 30))
    plain(me.materials[light], srgb(222, 210, 186))
    plain(me.materials[muzzle], srgb(66, 52, 42))
    dark = material(body, "Ibex_Dark", srgb(88, 70, 54))
    # No pale mane: the neck takes the coat, the belly and the rump stay pale.
    paint(body, lambda p: p.material_index == light and p.center.y < -0.9 and p.center.z > 2.3, coat)
    paint(body, lambda p: p.material_index in (coat, light) and p.center.z < 1.25, dark)
    horn = material(body, "Horn", srgb(118, 98, 76))
    for side in (1, -1):
        points = []
        for k in range(11):
            a = math.radians(168 - 13 * k)
            points.append((side * (0.12 + 0.016 * k), -1.62 + 0.68 * math.cos(a), 3.94 + 0.68 * math.sin(a)))
        radii = [0.135 - 0.0095 * k for k in range(11)]
        tube(body, points, radii, horn, "Head", sides=6, ridges=0.14)
    beard = [(0.0, -2.86, 3.4), (0.0, -2.84, 3.26), (0.0, -2.8, 3.12)]
    tube(body, beard, [0.07, 0.05, 0.02], dark, "Head", sides=5)
    return scene, rig, body, actions


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def reshape(rig, body, actions, shape, reach):
    """Move the bones and the skin together in the rest pose: the clips still fit. The feet
    follow free IK bones, which the clips move about: their moves shrink with the legs."""
    before = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[rig]):
        bpy.ops.object.mode_set(mode="EDIT")
        for bone in rig.data.edit_bones:
            bone.head, bone.tail = shape(bone.head.copy(), bone.name), shape(bone.tail.copy(), bone.name)
        bpy.ops.object.mode_set(mode="OBJECT")
    ears = {body.vertex_groups[f"Ear{k}.{s}"].index for k in range(1, 5) for s in "LR"}
    for v in body.data.vertices:
        ear = sum(e.weight for e in v.groups if e.group in ears)
        v.co = shape(v.co.copy(), "Ear1.L" if ear > 0.3 else "")
    after = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    free = [b.name for b in rig.data.bones if b.parent is None and b.name != "Body"]
    for action in actions:
        bag = action.layers[0].strips[0].channelbag(action.slots[0])
        for name in free:
            curves = [bag.fcurves.find(f'pose.bones["{name}"].location', index=i) for i in range(3)]
            if None in curves:
                continue
            times = sorted({k.co[0] for c in curves for k in c.keyframe_points})
            moves = []
            for t in times:
                rest = before[name].translation
                where = before[name] @ Vector([c.evaluate(t) for c in curves])
                moves.append(after[name].inverted() @ (shape(rest.copy(), name) + (where - rest) * reach))
            for i, c in enumerate(curves):
                c.keyframe_points.clear()
                for t, move in zip(times, moves):
                    c.keyframe_points.insert(t, move[i], options={"FAST"}).interpolation = "LINEAR"
                c.update()


def marmot():
    """The fox made a marmot: low on short legs, a round body, a broad head with a short
    muzzle and small ears, a short dark tail; brown with a beige belly."""
    scene, rig, body, actions = load("Fox", "Marmot")
    ears = {s: rig.data.bones[f"Ear1.{s}"].head_local.copy() for s in "LR"}
    HEAD = Vector((0.0, -2.2, 1.95))

    def shape(p, bone):
        x, y, z = p
        # Small round ears.
        if bone.startswith("Ear"):
            base = ears["L" if x > 0 else "R"]
            x, y, z = base + (Vector((x, y, z)) - base) * 0.3
        # A bigger head with a short muzzle.
        h = smoothstep(-1.75, -2.0, y)
        x, y, z = HEAD + (Vector((x, y, z)) - HEAD) * (1 + 0.25 * h)
        if y < -2.15:
            y = -2.15 + (y + 2.15) * 0.42
        # A shorter body and a short tail.
        if y > 0.9:
            y = 0.9 + (y - 0.9) * 0.4
        y = 0.82 * y if y > -1.9 else 0.82 * -1.9 + (y + 1.9)
        # A round body without a neck, a broad head.
        m = smoothstep(-2.0, -1.3, y) * (1 - smoothstep(0.6, 1.1, y)) * smoothstep(0.8, 1.4, z)
        x *= 1 + 0.55 * m + 0.35 * smoothstep(-1.7, -2.0, y)
        z = 1.6 + (z - 1.6) * (1 + 0.4 * m)
        # Short legs.
        z = 0.42 * z if z < 1.2 else 0.504 + 0.9 * (z - 1.2)
        return Vector((x, y, z))

    reshape(rig, body, actions, shape, reach=0.45)
    me = body.data
    coat, black, eyes, light, grey = range(5)
    plain(me.materials[coat], srgb(126, 100, 76))
    plain(me.materials[light], srgb(212, 184, 140))
    plain(me.materials[grey], srgb(86, 64, 48))
    # The fox's pale tail tip and cheeks: dark tail, pale muzzle only.
    paint(body, lambda p: p.material_index == light and p.center.y > 0.9, grey)
    return scene, rig, body, actions


def export(scene, rig, body, actions, name):
    os.makedirs(OUT, exist_ok=True)
    # The exporter takes every action of the file: only this animal's stay.
    for action in [a for a in bpy.data.actions if a not in actions]:
        bpy.data.actions.remove(action)
    # The clips keep the pack's names, without the suffix of a second import.
    for action in actions:
        action.name = action.name.split(".")[0]
    rig.data.pose_position = "POSE"
    for o in scene.objects:
        o.select_set(o in (rig, body))
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=True,
        use_active_scene=True,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_morph=False,
        export_vertex_color="NONE",
        export_yup=True,
    )
    return os.path.getsize(path)


BUILDERS = {"Chamois": chamois, "Ibex": ibex, "Marmot": marmot}

if __name__ == "__main__":
    for name, build in BUILDERS.items():
        scene, rig, body, actions = build()
        print(name, len(body.data.polygons), "faces", export(scene, rig, body, actions, name), "bytes")
