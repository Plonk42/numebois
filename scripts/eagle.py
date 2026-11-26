# The mountain's eagle (#136): procedural low-poly golden eagle with its rig and clips, in the
# style of the pack's animals (flat facets, plain colours, one skinned mesh).
# Run in Blender (MCP): exec(open(p).read(), {"__file__": p, "__name__": "__main__"}), or
# headless: `blender -b --factory-startup --python scripts/eagle.py`. Writes
# assets-private/animals/export/Eagle.glb, which `npm run assets` takes into animals.glb.
# Faces -Y (glTF +Z), body centre at the origin, about 2.2 from wing tip to wing tip.
# Clips: Glide, Flap, Land (landing or taking off: legs down, big beats), and perched with the
# wings folded, feet under the origin: Perch, Look, Preen.
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets-private", "animals")
OUT = os.path.join(ROOT, "export")
NAME = "Eagle"
FPS = 30


def srgb(r, g, b):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(r), lin(g), lin(b), 1.0)


# Dull browns: the game makes the animals' colours livelier.
COLOURS = {
    "plumage": srgb(84, 58, 40),
    "under": srgb(104, 76, 54),
    "dark": srgb(46, 34, 28),
    "gold": srgb(150, 106, 58),
    "beak": srgb(232, 192, 62),
    "eye": srgb(24, 20, 18),
    "white": srgb(226, 220, 206),
}
MATERIALS = list(COLOURS)

# Body along y, tail to beak: (y, half width, half height, centre height, colour).
BODY = [
    (0.42, 0.04, 0.03, 0.0, "plumage"),
    (0.3, 0.11, 0.09, 0.0, "plumage"),
    (0.05, 0.145, 0.13, -0.01, "plumage"),
    (-0.18, 0.12, 0.11, 0.02, "plumage"),
    (-0.28, 0.085, 0.085, 0.05, "gold"),
    (-0.38, 0.08, 0.08, 0.07, "gold"),
    (-0.46, 0.045, 0.05, 0.065, "beak"),
]
SIDES = 8
# Wing stations from the shoulder to the tip: (leading y, trailing y, span, height).
WING = [(-0.13, 0.24, 0.08, 0.04), (-0.16, 0.32, 0.52, 0.12), (-0.08, 0.3, 0.86, 0.2), (0.04, 0.22, 1.05, 0.24)]
ELBOW = 1
HIP = (0.065, 0.0, -0.08)
LEG = 0.3
# The legs tuck back under the tail in flight, hang down when perched.
TUCK = math.radians(70)


class Builder:
    def __init__(self):
        self.verts = []
        self.weights = []
        self.faces = []
        self.mats = []

    def vert(self, co, weights):
        self.verts.append(Vector(co))
        self.weights.append(weights)
        return len(self.verts) - 1

    def face(self, idx, colour):
        self.faces.append(list(idx))
        self.mats.append(MATERIALS.index(colour))

    def loft(self, rings, colours, weights, cap_start=True, cap_end=True):
        """Rings of points (same count) joined in order; caps close the ends."""
        ids = [[self.vert(p, weights[k]) for p in ring] for k, ring in enumerate(rings)]
        n = len(rings[0])
        for k in range(len(ids) - 1):
            for i in range(n):
                j = (i + 1) % n
                self.face((ids[k][i], ids[k][j], ids[k + 1][j], ids[k + 1][i]), colours[k])
        if cap_start:
            self.face(list(reversed(ids[0])), colours[0])
        if cap_end:
            self.face(ids[-1], colours[-1])


def ring(centre, half_x, half_z, n=SIDES, axis="y"):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        if axis == "y":
            out.append((centre[0] + half_x * math.cos(a), centre[1], centre[2] + half_z * math.sin(a)))
        else:
            out.append((centre[0] + half_x * math.cos(a), centre[1] + half_z * math.sin(a), centre[2]))
    return out


def body(b):
    rings = [ring((0, y, zc), w, h) for y, w, h, zc, _ in BODY]

    def weights(y):
        if y > -0.2:
            return {"Body": 1.0}
        if y > -0.33:
            return {"Body": 0.4, "Neck": 0.6}
        return {"Head": 1.0}

    b.loft(rings[:-1], [c for *_, c in BODY[:-1]], [weights(r[0]) for r in BODY[:-1]], cap_end=False)
    # The beak: its own ring, then a hooked tip.
    y, w, h, zc, _ = BODY[-1]
    base = [b.vert(p, {"Head": 1.0}) for p in ring((0, y, zc), w, h)]
    last = [b.vert(p, {"Head": 1.0}) for p in ring((0, BODY[-2][0], BODY[-2][3]), BODY[-2][1], BODY[-2][2])]
    for i in range(SIDES):
        j = (i + 1) % SIDES
        b.face((last[i], last[j], base[j], base[i]), "gold")
    tip = b.vert((0, -0.56, 0.01), {"Head": 1.0})
    for i in range(SIDES):
        b.face((base[i], base[(i + 1) % SIDES], tip), "beak")
    # Eyes and the white of the cheek.
    for side in (1, -1):
        centre = Vector((side * 0.074, -0.405, 0.1))
        octa = [centre + d * 0.024 for d in (Vector(v) for v in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)))]
        ids = [b.vert(p, {"Head": 1.0}) for p in octa]
        for a, c in ((0, 2), (2, 1), (1, 3), (3, 0)):
            b.face((ids[a], ids[c], ids[4]), "eye")
            b.face((ids[c], ids[a], ids[5]), "eye")


def wing(b, side, bone1, bone2):
    rings = []
    weights = []
    colours = []
    for k, (lead, trail, span, z) in enumerate(WING):
        thick = 0.04 * (1 - k / len(WING)) + 0.008
        x = side * span
        rings.append([(x, lead, z + thick), (x, trail, z), (x, lead, z - thick)])
        if k < ELBOW:
            weights.append({bone1: 1.0})
        elif k == ELBOW:
            weights.append({bone1: 0.5, bone2: 0.5})
        else:
            weights.append({bone2: 1.0})
        colours.append("dark" if k >= len(WING) - 2 else "plumage")
    b.loft(rings, colours, weights)
    # Fingered tip: four primaries spread past the hand.
    lead, trail, span, z = WING[-1]
    for f in range(4):
        y = lead + (trail - lead) * (f + 0.5) / 4
        root = [(side * span, y - 0.03, z), (side * (span - 0.02), y + 0.03, z)]
        end = (side * (span + 0.2 - 0.035 * f), y + 0.05 * f, z + 0.03 + 0.02 * f)
        top = [b.vert((p[0], p[1], p[2] + 0.008), {bone2: 1.0}) for p in root] + [b.vert(end, {bone2: 1.0})]
        bottom = [b.vert((p[0], p[1], p[2] - 0.008), {bone2: 1.0}) for p in root] + [b.vert((end[0], end[1], end[2] - 0.004), {bone2: 1.0})]
        b.face(top, "dark")
        b.face(list(reversed(bottom)), "dark")
        for i in range(3):
            j = (i + 1) % 3
            b.face((top[i], bottom[i], bottom[j], top[j]), "dark")


def tail(b):
    rings = [
        [(-0.07, 0.34, 0.03), (0.07, 0.34, 0.03), (0.07, 0.34, 0.0), (-0.07, 0.34, 0.0)],
        [(-0.19, 0.66, 0.02), (0.19, 0.66, 0.02), (0.19, 0.66, 0.0), (-0.19, 0.66, 0.0)],
    ]
    b.loft(rings, ["plumage", "dark"], [{"Tail": 1.0}, {"Tail": 1.0}])


def leg(b, side, bone):
    """Hanging down from the hip, toes forward; then tucked back by TUCK."""
    hip = Vector((side * HIP[0], HIP[1], HIP[2]))
    tuck = Matrix.Rotation(TUCK, 3, "X")

    def at(x, y, z):
        return hip + tuck @ Vector((x, y, z))

    w = {bone: 1.0}
    # Feathered trousers, then the yellow foot.
    trousers = [[at(*p) for p in ring((0, 0, -d), r, r * 0.9, 6, axis="z")] for d, r in ((0.0, 0.05), (0.14, 0.055), (0.18, 0.03))]
    b.loft(trousers, ["plumage", "plumage"], [w, w, w])
    shank = [[at(*p) for p in ring((0, 0, -d), 0.02, 0.02, 4, axis="z")] for d in (0.17, LEG - 0.02)]
    b.loft(shank, ["beak"], [w, w])
    for dx, dy in ((0.0, -0.09), (0.04, -0.07), (-0.04, -0.07), (0.0, 0.06)):
        root = at(0, 0, -LEG + 0.02)
        toe = at(dx, dy, -LEG)
        ids = [b.vert(p, w) for p in (root + Vector((0.012, 0, 0)), root - Vector((0.012, 0, 0)), toe, root + Vector((0, 0, 0.02)))]
        b.face((ids[0], ids[1], ids[2]), "beak")
        b.face((ids[1], ids[0], ids[3]), "beak")
        b.face((ids[0], ids[2], ids[3]), "beak")
        b.face((ids[2], ids[1], ids[3]), "beak")


BONES = {
    # name: (head, tail, parent)
    # The body turns about its middle.
    "Body": ((0, 0.02, 0), (0, -0.2, 0), None),
    "Neck": ((0, -0.2, 0.02), (0, -0.32, 0.06), "Body"),
    "Head": ((0, -0.32, 0.06), (0, -0.55, 0.05), "Neck"),
    "Tail": ((0, 0.32, 0.01), (0, 0.64, 0.01), "Body"),
}
for _side, _s in (("L", 1), ("R", -1)):
    BONES[f"Wing1.{_side}"] = ((_s * 0.08, 0.0, 0.05), (_s * 0.52, 0.0, 0.12), "Body")
    BONES[f"Wing2.{_side}"] = ((_s * 0.52, 0.0, 0.12), (_s * 1.05, 0.08, 0.24), f"Wing1.{_side}")
    _hip = Vector((_s * HIP[0], HIP[1], HIP[2]))
    _foot = _hip + Matrix.Rotation(TUCK, 3, "X") @ Vector((0, 0, -LEG))
    BONES[f"Leg.{_side}"] = (tuple(_hip), tuple(_foot), "Body")


def build():
    old = bpy.data.scenes.get(NAME)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o)
        bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new(NAME)
    scene.render.fps = FPS
    bpy.context.window.scene = scene

    b = Builder()
    body(b)
    tail(b)
    for side, s in (("L", 1), ("R", -1)):
        wing(b, s, f"Wing1.{side}", f"Wing2.{side}")
        leg(b, s, f"Leg.{side}")
    me = bpy.data.meshes.new(NAME)
    me.from_pydata([tuple(v) for v in b.verts], [], b.faces)
    me.update()
    for colour in MATERIALS:
        m = bpy.data.materials.new(f"{NAME}_{colour}")
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = COLOURS[colour]
        bsdf.inputs["Roughness"].default_value = 1.0
        me.materials.append(m)
    for poly, mat in zip(me.polygons, b.mats):
        poly.material_index = mat
        poly.use_smooth = False
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(NAME, me)
    scene.collection.objects.link(obj)

    arm = bpy.data.armatures.new(f"{NAME}Armature")
    rig = bpy.data.objects.new(f"{NAME}Armature", arm)
    scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[rig]):
        bpy.ops.object.mode_set(mode="EDIT")
        for name, (head, tail_, parent) in BONES.items():
            bone = arm.edit_bones.new(name)
            bone.head, bone.tail = head, tail_
            if parent:
                bone.parent = arm.edit_bones[parent]
        bpy.ops.object.mode_set(mode="OBJECT")
    for name in BONES:
        obj.vertex_groups.new(name=name)
    for i, weights in enumerate(b.weights):
        for bone, w in weights.items():
            obj.vertex_groups[bone].add([i], w, "REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    actions = clips(rig)
    return scene, rig, obj, actions


def rotation(rig, bone, *turns):
    """Rotations about armature axes, in degrees, as the bone's own rotation."""
    rest = rig.data.bones[bone].matrix_local.to_3x3()
    q = Quaternion()
    for axis, degrees in turns:
        q = Quaternion(rest.inverted() @ Vector(axis), math.radians(degrees)) @ q
    return q


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def up(side, degrees):
    """A wing raised: about the forward axis, the other way on each side."""
    return (Y, -side * degrees)


def glide(rig, t):
    w = 2 * math.pi * t
    pose = {"Head": rotation(rig, "Head", (Z, 8 * math.sin(w))), "Tail": rotation(rig, "Tail", (Y, 4 * math.sin(w)))}
    for side, s in (("L", 1), ("R", -1)):
        pose[f"Wing1.{side}"] = rotation(rig, f"Wing1.{side}", up(s, 6 + 3 * math.sin(w)))
        pose[f"Wing2.{side}"] = rotation(rig, f"Wing2.{side}", up(s, 4 + 3 * math.sin(w + 1)))
    return pose, (0, 0, 0.02 * math.sin(w))


def flap(rig, t):
    w = 2 * math.pi * t
    pose = {"Tail": rotation(rig, "Tail", (X, 4 * math.cos(w)))}
    for side, s in (("L", 1), ("R", -1)):
        pose[f"Wing1.{side}"] = rotation(rig, f"Wing1.{side}", up(s, 8 + 38 * math.cos(w)))
        pose[f"Wing2.{side}"] = rotation(rig, f"Wing2.{side}", up(s, 6 + 24 * math.cos(w - 0.9)))
    return pose, (0, 0, -0.04 * math.cos(w))


def land(rig, t):
    """Upright, legs down, big braking beats: landing, or taking off."""
    w = 2 * math.pi * t
    pose = {
        "Body": rotation(rig, "Body", (X, -32)),
        "Neck": rotation(rig, "Neck", (X, 22)),
        "Tail": rotation(rig, "Tail", (X, 18)),
    }
    for side, s in (("L", 1), ("R", -1)):
        pose[f"Wing1.{side}"] = rotation(rig, f"Wing1.{side}", (Z, -s * 12), up(s, 12 + 48 * math.cos(w)))
        pose[f"Wing2.{side}"] = rotation(rig, f"Wing2.{side}", up(s, 8 + 30 * math.cos(w - 0.9)))
        pose[f"Leg.{side}"] = rotation(rig, f"Leg.{side}", (X, -TUCK_DEG + 32))
    return pose, (0, 0, -0.05 * math.cos(w))


TUCK_DEG = math.degrees(TUCK)
UPRIGHT = 38


def perched(rig, head=0.0, bow=0.0, breath=0.0):
    pose = {
        "Body": rotation(rig, "Body", (X, -UPRIGHT)),
        "Neck": rotation(rig, "Neck", (X, UPRIGHT - 6 + bow)),
        "Head": rotation(rig, "Head", (Z, head), (X, bow * 0.5)),
        "Tail": rotation(rig, "Tail", (X, -20)),
    }
    for side, s in (("L", 1), ("R", -1)):
        # The wing turns back along the body, on its edge against the flank, and closes.
        pose[f"Wing1.{side}"] = (rotation(rig, f"Wing1.{side}", (Z, s * 88), (Y, -s * 80), (X, -10)), (1, 0.85, 1))
        pose[f"Wing2.{side}"] = (rotation(rig, f"Wing2.{side}", (Z, s * 8)), (1, 0.6, 1))
        pose[f"Leg.{side}"] = rotation(rig, f"Leg.{side}", (X, -TUCK_DEG + UPRIGHT))
    return pose, (0, 0, 0.01 * breath)


def perch(rig, t):
    w = 2 * math.pi * t
    return perched(rig, head=6 * math.sin(w), breath=math.sin(2 * w))


def look(rig, t):
    # Left, hold, right, hold, back.
    turn = math.sin(2 * math.pi * t)
    turn = math.copysign(min(1.0, abs(turn) * 1.6), turn)
    return perched(rig, head=55 * turn, breath=math.sin(4 * math.pi * t))


def preen(rig, t):
    bow = 30 * math.sin(math.pi * t) ** 2
    return perched(rig, head=25 * math.sin(4 * math.pi * t) * (bow / 30), bow=bow)


CLIPS = {"Glide": (glide, 3.0), "Flap": (flap, 0.8), "Land": (land, 1.0), "Perch": (perch, 4.0), "Look": (look, 4.0), "Preen": (preen, 4.0)}


def clips(rig):
    rig.animation_data_create()
    actions = []
    for name, (fn, seconds) in CLIPS.items():
        old = bpy.data.actions.get(name)
        if old:
            bpy.data.actions.remove(old)
        action = bpy.data.actions.new(name)
        rig.animation_data.action = action
        frames = round(seconds * FPS)
        for f in range(frames + 1):
            pose, lift = fn(rig, f / frames)
            for pb in rig.pose.bones:
                turn = pose.get(pb.name, Quaternion())
                turn, scale = turn if isinstance(turn, tuple) else (turn, (1, 1, 1))
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = turn
                pb.scale = scale
                pb.keyframe_insert("rotation_quaternion", frame=f)
                pb.keyframe_insert("scale", frame=f)
                if pb.name == "Body":
                    pb.location = lift
                    pb.keyframe_insert("location", frame=f)
        actions.append(action)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return actions


def export(scene, rig, obj, actions):
    os.makedirs(OUT, exist_ok=True)
    # The exporter takes every action of the file: only the eagle's stay.
    for action in [a for a in bpy.data.actions if a not in actions]:
        bpy.data.actions.remove(action)
    for o in scene.objects:
        o.select_set(o in (rig, obj))
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT, NAME + ".glb")
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


def feet(rig, obj, action):
    """Height of the toes under the origin, on the first frame of a clip."""
    rig.animation_data.action = action
    bpy.context.scene.frame_set(0)
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(dg).to_mesh()
    legs = {obj.vertex_groups[f"Leg.{s}"].index for s in "LR"}
    low = min(v.co.z for v, rest in zip(mesh.vertices, obj.data.vertices) if any(g.group in legs for g in rest.groups))
    obj.evaluated_get(dg).to_mesh_clear()
    rig.animation_data.action = None
    return low


if __name__ == "__main__":
    scene, rig, obj, actions = build()
    print(NAME, len(obj.data.polygons), "faces, feet when perched", round(feet(rig, obj, actions[3]), 3))
    print(export(scene, rig, obj, actions), "bytes")
