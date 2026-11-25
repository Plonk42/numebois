# The squirrel of the challenges (#43, #45): procedural low-poly model in Plume's style, rig and clips.
# Run in Blender (MCP): exec(open(p).read(), {"__file__": p, "__name__": "__main__"}),
# or headless: `blender -b --factory-startup --python scripts/squirrel.py`. Writes
# assets-private/squirrel/export/Squirrel.glb and previews. Same clips as Plume (Idle, Blink, Tilt, Cheer).
# Faces -Y (glTF +Z), sits on z = 0, about 1 unit tall. One vertex-coloured material.
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets-private", "squirrel")
OUT = os.path.join(ROOT, "export")
PREVIEWS = os.path.join(ROOT, "previews")
SCENE = "Squirrel"
CLIPS = ("Idle", "Blink", "Tilt", "Cheer")
FPS = 30


def srgb(r, g, b):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(r), lin(g), lin(b), 1.0)


COLOURS = {
    "fur": srgb(204, 122, 70),
    "tail": srgb(216, 138, 80),
    "dark": srgb(168, 92, 52),
    "cream": srgb(244, 232, 204),
    "pupil": srgb(30, 27, 32),
    "shine": srgb(255, 255, 255),
    "nose": srgb(84, 50, 40),
    "nut": srgb(222, 168, 84),
    "cap": srgb(128, 88, 56),
}

# Lathe profiles (z, radius), squashed in depth like Plume.
BODY = [
    (0.0, 0.0),
    (0.012, 0.13),
    (0.05, 0.215),
    (0.13, 0.265),
    (0.24, 0.27),
    (0.35, 0.24),
    (0.45, 0.19),
    (0.53, 0.13),
    (0.57, 0.0),
]
BODY_DEPTH = 0.85
HEAD = [
    (0.43, 0.0),
    (0.45, 0.13),
    (0.51, 0.225),
    (0.6, 0.28),
    (0.71, 0.295),
    (0.82, 0.265),
    (0.91, 0.19),
    (0.96, 0.1),
    (0.975, 0.0),
]
HEAD_DEPTH = 0.86
HEAD_Y = -0.03
SEGMENTS = 20


def radius_at(profile, z):
    for (z0, r0), (z1, r1) in zip(profile, profile[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return 0.0


def body_front(x, z):
    r = radius_at(BODY, z)
    return -BODY_DEPTH * math.sqrt(max(r * r - x * x, 0.0))


def head_front(x, z):
    r = radius_at(HEAD, z)
    return HEAD_Y - HEAD_DEPTH * math.sqrt(max(r * r - x * x, 0.0))


def surface_normal(surface, x, z, eps=0.004):
    p = Vector((x, surface(x, z), z))
    dx = Vector((x + eps, surface(x + eps, z), z)) - p
    dz = Vector((x, surface(x, z + eps), z + eps)) - p
    n = dz.cross(dx).normalized()
    return n if n.y < 0 else -n


# ---------------------------------------------------------------- geometry helpers


def new_object(name, bm, colour, groups, smooth=True):
    """`groups`: bone name -> constant weight, function of the world position, or list per vertex."""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for d in attr.data:
        d.color = COLOURS[colour]
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for gname, weight in groups.items():
        g = obj.vertex_groups.new(name=gname)
        if callable(weight) or isinstance(weight, list):
            for v in me.vertices:
                w = weight(v.co) if callable(weight) else weight[v.index]
                if w > 0:
                    g.add([v.index], w, "REPLACE")
        else:
            g.add(range(len(me.vertices)), weight, "REPLACE")
    return obj


def lathe(profile, segments, depth, y=0.0):
    bm = bmesh.new()
    rings = []
    for z, r in profile:
        if r == 0:
            rings.append([bm.verts.new((0, y, z))])
            continue
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            ring.append(bm.verts.new((r * math.sin(a), y - depth * r * math.cos(a), z)))
        rings.append(ring)
    for lo, hi in zip(rings, rings[1:]):
        if len(lo) == 1:
            for i in range(segments):
                bm.faces.new((lo[0], hi[(i + 1) % segments], hi[i]))
        elif len(hi) == 1:
            for i in range(segments):
                bm.faces.new((lo[i], lo[(i + 1) % segments], hi[0]))
        else:
            for i in range(segments):
                j = (i + 1) % segments
                bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def ellipsoid(radii, segments=10, rings=6):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
    return bm


def cone(radius, depth, segments=8):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=0.0, depth=depth)
    return bm


def place(bm, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
    return bm


def facing(normal):
    """Rotation turning local -Y towards `normal`, keeping local Z close to up."""
    return normal.to_track_quat("-Y", "Z").to_matrix().to_4x4()


def along(a, b):
    """Rotation turning local Z towards b - a."""
    return (Vector(b) - Vector(a)).to_track_quat("Z", "Y").to_matrix().to_4x4()


def surface_patch(cx, cz, rx, rz, lift, rim, surface, rings=4, segments=24):
    """Elliptic patch draped over a front height field, raised by `lift`, with a rim skirt."""
    bm = bmesh.new()
    centre = bm.verts.new((cx, surface(cx, cz) - lift, cz))
    loops = []
    for k in range(1, rings + 1):
        f = k / rings
        loop = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            x = cx + rx * f * math.cos(a)
            z = cz + rz * f * math.sin(a)
            loop.append(bm.verts.new((x, surface(x, z) - lift, z)))
        loops.append(loop)
    first = loops[0]
    for i in range(segments):
        bm.faces.new((centre, first[(i + 1) % segments], first[i]))
    for lo, hi in zip(loops, loops[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    if rim:
        edge = loops[-1]
        back = [bm.verts.new((v.co.x, v.co.y + rim, v.co.z)) for v in edge]
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((edge[i], edge[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if sum(f.normal.y for f in bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return bm


def catmull_rom(points, steps):
    out = []
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(steps):
            t = s / steps
            out.append(
                0.5
                * (
                    2 * p1
                    + (p2 - p0) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                    + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t
                )
            )
    out.append(points[-1])
    return out


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- tail

# Big bushy S rising behind the back, leaning to his right: turned towards the question, it shows beside him.
TAIL_PATH = [
    Vector(p)
    for p in (
        (0.0, 0.16, 0.07),
        (-0.05, 0.36, 0.13),
        (-0.12, 0.49, 0.32),
        (-0.2, 0.52, 0.56),
        (-0.27, 0.46, 0.78),
        (-0.31, 0.33, 0.94),
        (-0.32, 0.18, 0.99),
        (-0.3, 0.08, 0.92),
    )
]
TAIL_RADIUS = [0.06, 0.12, 0.165, 0.19, 0.19, 0.165, 0.125, 0.07]
TAIL_STEPS = 4
TAIL_SEGMENTS = 12
TAIL_BONES = (0.0, 0.34, 0.66, 1.0)


def tail_weights(t):
    a = smoothstep(0.24, 0.44, t)
    b = smoothstep(0.56, 0.76, t)
    return {"tail.0": 1 - a, "tail.1": a - b, "tail.2": b}


def tail():
    path = catmull_rom(TAIL_PATH, TAIL_STEPS)
    radii = catmull_rom([Vector((r, 0, 0)) for r in TAIL_RADIUS], TAIL_STEPS)
    n = len(path)
    bm = bmesh.new()
    params = []
    rings = []
    for k, p in enumerate(path):
        t = k / (n - 1)
        tangent = (path[min(k + 1, n - 1)] - path[max(k - 1, 0)]).normalized()
        side = Vector((1, 0, 0))
        side = (side - tangent * side.dot(tangent)).normalized()
        up = tangent.cross(side)
        # Scalloped silhouette: a fluffy cartoon tail.
        r = radii[k].x * (1 + 0.07 * math.cos(t * 2 * math.pi * 5))
        ring = []
        for i in range(TAIL_SEGMENTS):
            a = 2 * math.pi * i / TAIL_SEGMENTS
            ring.append(bm.verts.new(p + side * math.cos(a) * r * 1.1 + up * math.sin(a) * r))
            params.append(t)
        rings.append(ring)
    start = bm.verts.new(path[0] - (path[1] - path[0]).normalized() * 0.03)
    params.append(0.0)
    end = bm.verts.new(path[-1] + (path[-1] - path[-2]).normalized() * 0.05)
    params.append(1.0)
    for lo, hi in zip(rings, rings[1:]):
        for i in range(TAIL_SEGMENTS):
            j = (i + 1) % TAIL_SEGMENTS
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    for i in range(TAIL_SEGMENTS):
        j = (i + 1) % TAIL_SEGMENTS
        bm.faces.new((start, rings[0][j], rings[0][i]))
        bm.faces.new((rings[-1][i], rings[-1][j], end))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    weights = {name: [tail_weights(t)[name] for t in params] for name in ("tail.0", "tail.1", "tail.2")}
    return bm, weights, path


def tail_point(path, t):
    return path[round(t * (len(path) - 1))]


# ---------------------------------------------------------------- parts

NECK = (0.47, 0.56)
EYE_X, EYE_Z = 0.135, 0.735
PUPIL = (0.07, 0.04, 0.082)
RING_R = 0.098
MUZZLE_Z = 0.6
SHOULDER_Z = 0.43
PAW = Vector((0.0, -0.33, 0.3))


def head_weight(co):
    return smoothstep(*NECK, co.z)


def body_weight(co):
    return 1.0 - smoothstep(*NECK, co.z)


def build_parts():
    trunk = {"body": body_weight, "head": head_weight}
    parts = [new_object("body", lathe(BODY, SEGMENTS, BODY_DEPTH), "fur", trunk)]
    parts.append(new_object("head", lathe(HEAD, SEGMENTS, HEAD_DEPTH, HEAD_Y), "fur", {"head": 1.0}))
    parts.append(
        new_object(
            "belly",
            surface_patch(0.0, 0.24, 0.165, 0.2, lift=0.012, rim=0.02, surface=body_front, rings=4, segments=24),
            "cream",
            trunk,
        )
    )

    # Cream muzzle, nose and two buck teeth.
    muzzle_y = head_front(0.0, MUZZLE_Z)
    parts.append(
        new_object(
            "muzzle",
            place(ellipsoid((0.15, 0.1, 0.095), 14, 8), Matrix.Translation((0, muzzle_y + 0.035, MUZZLE_Z))),
            "cream",
            {"head": 1.0},
        )
    )
    parts.append(
        new_object(
            "nose",
            place(ellipsoid((0.042, 0.03, 0.03), 10, 6), Matrix.Translation((0, muzzle_y - 0.06, MUZZLE_Z + 0.045))),
            "nose",
            {"head": 1.0},
        )
    )
    for side in (-1, 1):
        tooth = place(
            ellipsoid((0.016, 0.01, 0.026), 6, 4),
            Matrix.Translation((side * 0.017, muzzle_y - 0.045, MUZZLE_Z - 0.065)),
        )
        parts.append(new_object("tooth", tooth, "shine", {"head": 1.0}))

    for side in (-1, 1):
        tag = "L" if side > 0 else "R"
        cx = side * EYE_X
        ring = surface_patch(
            cx, EYE_Z, RING_R, RING_R * 1.08, lift=0.008, rim=0.02, surface=head_front, rings=2, segments=18
        )
        parts.append(new_object(f"ring.{tag}", ring, "cream", {"head": 1.0}))
        n = surface_normal(head_front, cx, EYE_Z)
        centre = Vector((cx, head_front(cx, EYE_Z) - 0.012, EYE_Z))
        rot = facing(n)
        parts.append(
            new_object(
                f"pupil.{tag}",
                place(ellipsoid(PUPIL, 14, 8), Matrix.Translation(centre) @ rot),
                "pupil",
                {f"eye.{tag}": 1.0},
            )
        )
        # Highlight on the same side for both eyes (one light), upper right as seen from the front.
        shine = centre + rot @ Vector((-0.026, -0.04, 0.036))
        parts.append(
            new_object(
                f"shine.{tag}",
                place(ellipsoid((0.02, 0.012, 0.022), 8, 5), Matrix.Translation(shine) @ rot),
                "shine",
                {f"eye.{tag}": 1.0},
            )
        )

        # Ears: flattened cones with a cream inside and a dark tuft at the tip.
        tilt = Matrix.Translation((side * 0.17, HEAD_Y + 0.02, 0.9)) @ Matrix.Rotation(side * math.radians(20), 4, "Y")
        ear = place(cone(0.085, 0.24), Matrix.Scale(0.55, 4, Vector((0, 1, 0))) @ Matrix.Translation((0, 0, 0.1)))
        parts.append(new_object(f"ear.{tag}", place(ear, tilt), "fur", {"head": 1.0}))
        inner = place(cone(0.05, 0.15), Matrix.Translation((0, -0.03, 0.08)) @ Matrix.Scale(0.4, 4, Vector((0, 1, 0))))
        parts.append(new_object(f"inner.{tag}", place(inner, tilt), "cream", {"head": 1.0}))
        tuft = place(cone(0.048, 0.18), Matrix.Translation((0, 0, 0.2)) @ Matrix.Scale(0.7, 4, Vector((0, 1, 0))))
        parts.append(new_object(f"tuft.{tag}", place(tuft, tilt), "dark", {"head": 1.0}))

        # Arms reach forward from the shoulders; both paws hold the acorn.
        shoulder = Vector((side * 0.15, body_front(side * 0.15, SHOULDER_Z) + 0.06, SHOULDER_Z))
        hand = PAW + Vector((side * 0.075, 0.02, 0.0))
        mid = (shoulder + hand) / 2
        size = (0.052, 0.052, (hand - shoulder).length / 2 + 0.03)
        arm = place(ellipsoid(size, 10, 6), Matrix.Translation(mid) @ along(shoulder, hand))
        parts.append(new_object(f"arm.{tag}", arm, "fur", {"paws": 1.0}))
        paw = place(ellipsoid((0.045, 0.04, 0.05), 8, 5), Matrix.Translation(hand))
        parts.append(new_object(f"paw.{tag}", paw, "dark", {"paws": 1.0}))

        # Hind legs: a round thigh and a long foot pointing forward.
        thigh = place(ellipsoid((0.1, 0.14, 0.105), 12, 7), Matrix.Translation((side * 0.19, -0.03, 0.11)))
        parts.append(new_object(f"thigh.{tag}", thigh, "fur", {"root": 1.0}))
        foot = place(
            ellipsoid((0.058, 0.12, 0.034), 10, 6),
            Matrix.Translation((side * 0.15, -0.2, 0.032)) @ Matrix.Rotation(side * math.radians(-12), 4, "Z"),
        )
        parts.append(new_object(f"foot.{tag}", foot, "dark", {"root": 1.0}))

    # The acorn of the challenge basket.
    nut = place(ellipsoid((0.068, 0.064, 0.08), 12, 7), Matrix.Translation(PAW + Vector((0, -0.02, -0.01))))
    parts.append(new_object("nut", nut, "nut", {"paws": 1.0}))
    cap = place(ellipsoid((0.078, 0.074, 0.042), 12, 5), Matrix.Translation(PAW + Vector((0, -0.02, 0.05))))
    parts.append(new_object("cap", cap, "cap", {"paws": 1.0}))
    stem = place(cone(0.015, 0.06, 5), Matrix.Translation(PAW + Vector((0, -0.02, 0.1))))
    parts.append(new_object("stem", stem, "cap", {"paws": 1.0}))

    bm, weights, path = tail()
    parts.append(new_object("tail", bm, "tail", weights))
    return parts, path


# ---------------------------------------------------------------- rig and clips


def build_rig(path):
    arm = bpy.data.armatures.new("Squirrel_rig")
    rig = bpy.data.objects.new("Squirrel_rig", arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = eb[parent]
        return b

    bone("root", (0, 0, 0), (0, 0, 0.08))
    bone("body", (0, 0, 0.08), (0, 0, NECK[0]), "root")
    bone("head", (0, 0, NECK[0]), (0, 0, 0.98), "body")
    for side, tag in ((1, "L"), (-1, "R")):
        x = side * EYE_X
        y = head_front(x, EYE_Z) - 0.012
        bone(f"eye.{tag}", (x, y, EYE_Z), (x, y, EYE_Z + 0.1), "head")
    paws = bone("paws", (0, body_front(0, SHOULDER_Z) + 0.06, SHOULDER_Z), PAW, "body")
    paws.align_roll(Vector((0, 0, 1)))
    parent = "body"
    for k in range(3):
        b = bone(f"tail.{k}", tail_point(path, TAIL_BONES[k]), tail_point(path, TAIL_BONES[k + 1]), parent)
        b.align_roll(Vector((1, 0, 0)))
        parent = f"tail.{k}"
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def key(rig, frame, name, loc=None, rot=None, scale=None):
    pb = rig.pose.bones[name]
    pb.rotation_mode = "XYZ"
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert("location", frame=frame)
    if rot is not None:
        pb.rotation_euler = [math.radians(a) for a in rot]
        pb.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        pb.scale = scale
        pb.keyframe_insert("scale", frame=frame)


def clip(rig, name, keys):
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, bone, channels in keys:
        key(rig, frame, bone, **channels)
    rig.animation_data.action = None
    return action


def sway(f, angle, curl=0.0):
    """Tail keys: `angle` swings sideways (bone X), `curl` rolls the S tighter (bone Z), growing to the tip."""
    return [(f, f"tail.{k}", {"rot": (angle * (k + 1) / 3, 0, curl * (k + 1) / 3)}) for k in range(3)]


def build_clips(rig):
    # Bone Y = along the bone: root/body/head point up; the paws bone points forward and down.
    idle = []
    breaths = ((1, 1.0, 0, 0), (37, 1.035, 3, 6), (73, 1.0, 0, 0), (109, 1.035, -3, -6), (145, 1.0, 0, 0))
    for f, s, tilt, angle in breaths:
        idle.append((f, "body", {"scale": (s, s ** 0.5, s)}))
        idle.append((f, "head", {"rot": (0, 0, tilt)}))
        idle += sway(f, angle)
    clips = [clip(rig, "Idle", idle)]

    blink = []
    for f, s in ((1, 1.0), (3, 0.08), (6, 0.08), (9, 1.0)):
        for tag in ("L", "R"):
            blink.append((f, f"eye.{tag}", {"scale": (1.0, s, 1.0)}))
    clips.append(clip(rig, "Blink", blink))

    # Curious head tilt, holding the acorn out (the squirrel's offer).
    tilt = []
    for f, a, up, offer in ((1, 0, 0, 0), (10, 14, 0.02, 22), (40, 14, 0.02, 22), (52, 0, 0, 0)):
        tilt.append((f, "head", {"rot": (0, 0, a), "loc": (0, up, 0)}))
        tilt.append((f, "paws", {"rot": (offer, 0, 0)}))
    clips.append(clip(rig, "Tilt", tilt))

    # Happy hop, acorn raised, tail wagging.
    cheer = []
    hop = ((1, 0.0, 1.0), (5, 0.0, 0.9), (11, 0.16, 1.06), (17, 0.0, 0.92), (22, 0.0, 1.0), (31, 0.0, 1.0))
    for f, z, s in hop:
        cheer.append((f, "root", {"loc": (0, z, 0)}))
        cheer.append((f, "body", {"scale": (1.0 / s ** 0.5, s, 1.0 / s ** 0.5)}))
    for f, a in ((1, 0), (6, 45), (14, 45), (24, 18), (31, 0)):
        cheer.append((f, "paws", {"rot": (a, 0, 0)}))
    for f, a in ((1, 0), (6, 14), (11, -14), (16, 14), (21, -10), (26, 4), (31, 0)):
        cheer += sway(f, a)
    clips.append(clip(rig, "Cheer", cheer))
    return clips


# ---------------------------------------------------------------- assemble


def build():
    # Headless (blender -b --python): the scene of the file.
    window = bpy.context.window
    scene = (bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)) if window else bpy.context.scene
    if window:
        window.scene = scene
    for o in list(scene.objects):
        bpy.data.objects.remove(o)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.cameras, bpy.data.lights):
        for item in [i for i in coll if i.users == 0]:
            coll.remove(item)
    for a in [a for a in bpy.data.actions if a.name.split(".")[0] in CLIPS]:
        bpy.data.actions.remove(a)
    scene.render.fps = FPS

    parts, path = build_parts()
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts):
        bpy.ops.object.join()
    body = parts[0]
    body.name = body.data.name = "Squirrel_body"

    mat = bpy.data.materials.get("Squirrel") or bpy.data.materials.new("Squirrel")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    col = next((n for n in nodes if n.type == "VERTEX_COLOR"), None) or nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Col"
    mat.node_tree.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    body.data.materials.clear()
    body.data.materials.append(mat)

    rig = build_rig(path)
    body.parent = rig
    body.modifiers.new("Armature", "ARMATURE").object = rig
    clips = build_clips(rig)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    return rig, body, clips, tris


def export(rig, body):
    os.makedirs(OUT, exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o in (rig, body))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, "Squirrel.glb"),
        use_selection=True,
        use_active_scene=True,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_def_bones=True,
        export_optimize_animation_size=True,
        export_vertex_color="ACTIVE",
        export_skins=True,
    )
    return os.path.getsize(os.path.join(OUT, "Squirrel.glb"))


def setup_stage():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x, scene.render.resolution_y = 640, 640
    scene.render.film_transparent = False
    world = scene.world or bpy.data.worlds.new("Squirrel")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = srgb(250, 228, 196)
    bg.inputs["Strength"].default_value = 1.0
    cam = bpy.data.objects.new("Squirrel_cam", bpy.data.cameras.new("Squirrel_cam"))
    scene.collection.objects.link(cam)
    cam.data.lens = 85
    scene.camera = cam
    sun = bpy.data.objects.new("Squirrel_sun", bpy.data.lights.new("Squirrel_sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
    scene.collection.objects.link(sun)
    floor = bmesh.new()
    bmesh.ops.create_grid(floor, x_segments=1, y_segments=1, size=4)
    me = bpy.data.meshes.new("Squirrel_floor")
    floor.to_mesh(me)
    floor.free()
    fm = bpy.data.materials.get("Squirrel_floor") or bpy.data.materials.new("Squirrel_floor")
    fm.use_nodes = True
    next(n for n in fm.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = srgb(
        250, 228, 196
    )
    me.materials.append(fm)
    scene.collection.objects.link(bpy.data.objects.new("Squirrel_floor", me))
    return cam


def shoot(cam, name, yaw=0.0, action=None, frame=1, rig=None):
    distance, target = 4.2, Vector((0, 0, 0.5))
    a = math.radians(yaw)
    cam.location = target + Vector((math.sin(a) * distance, -math.cos(a) * distance, 0.9))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    if rig is not None:
        for pb in rig.pose.bones:
            pb.location, pb.rotation_euler, pb.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
        rig.animation_data.action = action
        bpy.context.scene.frame_set(frame)
    os.makedirs(PREVIEWS, exist_ok=True)
    bpy.context.scene.render.filepath = os.path.join(PREVIEWS, name + ".png")
    bpy.ops.render.render(write_still=True)
    if rig is not None:
        rig.animation_data.action = None


if __name__ == "__main__":
    rig, body, clips, tris = build()
    print("Squirrel", tris, "tris", [c.name for c in clips])
    cam = setup_stage()
    shoot(cam, "front")
    shoot(cam, "three-quarter", yaw=-35)
    shoot(cam, "side", yaw=-90)
    by_name = {c.name: c for c in clips}
    shoot(cam, "pose-blink", action=by_name["Blink"], frame=4, rig=rig)
    shoot(cam, "pose-tilt", action=by_name["Tilt"], frame=25, rig=rig)
    shoot(cam, "pose-cheer", action=by_name["Cheer"], frame=11, rig=rig)
    print("glb", export(rig, body), "bytes")
