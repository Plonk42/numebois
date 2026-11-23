# Plume the owl (#26): procedural low-poly model, rig and gentle clips, built in its own scene.
# Run in Blender (MCP): exec(open(p).read(), {"__file__": p, "__name__": "__main__"}), then
# `npm run assets` optimises assets-private/plume/export/Plume.glb into public/assets/plume.glb.
# Faces -Y (glTF +Z), stands on z = 0, about 1 unit tall. One vertex-coloured material.
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets-private", "plume")
OUT = os.path.join(ROOT, "export")
PREVIEWS = os.path.join(ROOT, "previews")
SCENE = "Plume"
FPS = 30


def srgb(r, g, b):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(r), lin(g), lin(b), 1.0)


COLOURS = {
    "body": srgb(166, 140, 118),
    "wing": srgb(146, 120, 100),
    "cream": srgb(244, 232, 204),
    "pupil": srgb(30, 27, 32),
    "shine": srgb(255, 255, 255),
    "yellow": srgb(245, 190, 40),
    "mark": srgb(118, 94, 76),
}

# Body = lathe of this profile (z, radius), squashed in depth.
PROFILE = [
    (0.015, 0.0),
    (0.025, 0.16),
    (0.06, 0.29),
    (0.14, 0.375),
    (0.28, 0.42),
    (0.46, 0.415),
    (0.64, 0.39),
    (0.78, 0.35),
    (0.88, 0.28),
    (0.94, 0.17),
    (0.96, 0.0),
]
DEPTH = 0.86
SEGMENTS = 20


def radius_at(z):
    for (z0, r0), (z1, r1) in zip(PROFILE, PROFILE[1:]):
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0)
            # Smooth the polyline a little so patches follow the shaded surface.
            return r0 + (r1 - r0) * t
    return 0.0


def front_y(x, z):
    r = radius_at(z)
    return -DEPTH * math.sqrt(max(r * r - x * x, 0.0))


def surface_normal(x, z, eps=0.004):
    p = Vector((x, front_y(x, z), z))
    dx = Vector((x + eps, front_y(x + eps, z), z)) - p
    dz = Vector((x, front_y(x, z + eps), z + eps)) - p
    n = dz.cross(dx).normalized()
    return n if n.y < 0 else -n


# ---------------------------------------------------------------- geometry helpers


def new_object(name, bm, colour, groups, smooth=True):
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
        if callable(weight):
            for v in me.vertices:
                w = weight(obj.matrix_world @ v.co)
                if w > 0:
                    g.add([v.index], w, "REPLACE")
        else:
            g.add(range(len(me.vertices)), weight, "REPLACE")
    return obj


def lathe(profile, segments, depth):
    bm = bmesh.new()
    rings = []
    for z, r in profile:
        if r == 0:
            rings.append([bm.verts.new((0, 0, z))])
            continue
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            ring.append(bm.verts.new((r * math.sin(a), -depth * r * math.cos(a), z)))
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


def place(bm, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
    return bm


def facing(normal):
    """Rotation turning local -Y towards `normal`, keeping local Z close to `up`."""
    return normal.to_track_quat("-Y", "Z").to_matrix().to_4x4()


def surface_patch(cx, cz, rx, rz, lift, rim, rings=4, segments=24, surface=None):
    """Elliptic patch draped over the body front (or another height field), raised by `lift`, with a rim skirt."""
    surface = surface or (lambda x, z: front_y(x, z))
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
    # Faces should look forward (-Y).
    if sum(f.normal.y for f in bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return bm


def ribbon(points, width, surface, lift):
    """Thin strip along a polyline draped on `surface` (for the belly chevrons)."""
    bm = bmesh.new()
    left, right = [], []
    for i, (x, z) in enumerate(points):
        a = points[max(i - 1, 0)]
        b = points[min(i + 1, len(points) - 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(tx, tz)
        nx, nz = -tz / length * width / 2, tx / length * width / 2
        for side, (px, pz) in ((left, (x + nx, z + nz)), (right, (x - nx, z - nz))):
            side.append(bm.verts.new((px, surface(px, pz) - lift, pz)))
    for i in range(len(points) - 1):
        bm.faces.new((left[i], left[i + 1], right[i + 1], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if sum(f.normal.y for f in bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return bm


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


NECK = (0.5, 0.66)


def head_weight(co):
    return smoothstep(*NECK, co.z)


def body_weight(co):
    return 1.0 - smoothstep(*NECK, co.z)


# ---------------------------------------------------------------- parts

EYE_X, EYE_Z, DISC_R = 0.185, 0.69, 0.16
PUPIL_R = 0.098
WING_ROOT = Vector((0.39, 0.02, 0.6))


def build_parts():
    parts = []
    parts.append(new_object("body", lathe(PROFILE, SEGMENTS, DEPTH), "body", {"body": body_weight, "head": head_weight}))

    parts.append(
        new_object(
            "belly",
            surface_patch(0.0, 0.27, 0.35, 0.245, lift=0.012, rim=0.02, rings=5, segments=28),
            "cream",
            {"body": body_weight, "head": head_weight},
        )
    )
    # Chevrons (4-2-1, as in the reference), draped on the belly.
    belly_front = lambda x, z: front_y(x, z) - 0.012
    for x, z in [(-0.24, 0.33), (-0.08, 0.34), (0.08, 0.34), (0.24, 0.33), (-0.16, 0.22), (0.16, 0.22), (0.0, 0.14)]:
        w, h = 0.028, 0.03
        pts = [(x - w, z + h / 2), (x, z - h / 2), (x + w, z + h / 2)]
        parts.append(new_object("mark", ribbon(pts, 0.011, belly_front, 0.004), "mark", {"body": 1.0}))

    for side in (-1, 1):
        cx = side * EYE_X
        tag = "L" if side > 0 else "R"
        parts.append(
            new_object(
                f"disc.{tag}",
                surface_patch(cx, EYE_Z, DISC_R, DISC_R * 0.95, lift=0.03, rim=0.05, rings=3, segments=20),
                "cream",
                {"head": 1.0},
            )
        )
        disc_front = lambda x, z: front_y(x, z) - 0.03
        px, pz = cx - side * 0.012, EYE_Z
        n = surface_normal(px, pz)
        centre = Vector((px, disc_front(px, pz), pz))
        rot = facing(n)
        parts.append(
            new_object(
                f"pupil.{tag}",
                place(ellipsoid((PUPIL_R, 0.045, PUPIL_R), 14, 8), Matrix.Translation(centre) @ rot),
                "pupil",
                {f"eye.{tag}": 1.0},
            )
        )
        # Highlight on the same side for both eyes (one light), upper right as seen from the front.
        shine = centre + rot @ Vector((-0.038, -0.04, 0.04))
        parts.append(
            new_object(
                f"shine.{tag}",
                place(ellipsoid((0.022, 0.012, 0.022), 8, 5), Matrix.Translation(shine) @ rot),
                "shine",
                {f"eye.{tag}": 1.0},
            )
        )

        # Ear tufts: tilted cones sunk into the head.
        cone = bmesh.new()
        bmesh.ops.create_cone(cone, cap_ends=True, segments=8, radius1=0.15, radius2=0.0, depth=0.26)
        bmesh.ops.scale(cone, vec=Vector((1.0, DEPTH * 0.8, 1.0)), verts=cone.verts)
        m = Matrix.Translation((side * 0.25, 0.0, 0.86)) @ Matrix.Rotation(side * math.radians(28), 4, "Y")
        parts.append(new_object(f"ear.{tag}", place(cone, m), "body", {"head": 1.0}))

        # Wing: a rounded paddle ending in three feather lobes, drooping outwards and slightly back.
        root = Vector((side * WING_ROOT.x, WING_ROOT.y, WING_ROOT.z - 0.1))
        m = (
            Matrix.Translation(root)
            @ Matrix.Rotation(side * math.radians(12), 4, "Z")
            @ Matrix.Rotation(side * math.radians(28), 4, "Y")
            @ Matrix.Scale(side, 4, Vector((1, 0, 0)))
        )
        lobes = [
            ((0.11, 0.0, 0.0), (0.16, 0.03, 0.11), 12, 7),
            ((0.24, 0.0, -0.035), (0.065, 0.025, 0.048), 8, 5),
            ((0.195, 0.0, -0.095), (0.06, 0.023, 0.045), 8, 5),
            ((0.125, 0.0, -0.115), (0.055, 0.021, 0.042), 8, 5),
        ]
        for k, (centre, radii, seg, rings) in enumerate(lobes):
            lobe = place(ellipsoid(radii, seg, rings), m @ Matrix.Translation(centre))
            if side < 0:
                bmesh.ops.reverse_faces(lobe, faces=lobe.faces)
            parts.append(new_object(f"wing.{tag}{k}", lobe, "wing", {f"wing.{tag}": 1.0}))

        # Feet: three round toes fanned forward.
        for k, a in enumerate((-28, 0, 28)):
            toe = ellipsoid((0.032, 0.055, 0.026), 8, 5)
            m = (
                Matrix.Translation((side * 0.14, -0.2, 0.022))
                @ Matrix.Rotation(math.radians(a), 4, "Z")
                @ Matrix.Translation((0, -0.05, 0))
            )
            parts.append(new_object(f"toe.{tag}{k}", place(toe, m), "yellow", {"root": 1.0}))

    beak = bmesh.new()
    bmesh.ops.create_cone(beak, cap_ends=True, segments=6, radius1=0.05, radius2=0.0, depth=0.12)
    bmesh.ops.scale(beak, vec=Vector((1.0, 0.7, 1.0)), verts=beak.verts)
    centre = Vector((0.0, front_y(0.0, 0.6) - 0.06, 0.6))
    m = Matrix.Translation(centre) @ Matrix.Rotation(math.radians(160), 4, "X")
    parts.append(new_object("beak", place(beak, m), "yellow", {"head": 1.0}))
    return parts


# ---------------------------------------------------------------- rig and clips


def build_rig():
    arm = bpy.data.armatures.new("Plume_rig")
    rig = bpy.data.objects.new("Plume_rig", arm)
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
    bone("head", (0, 0, NECK[0]), (0, 0, 0.95), "body")
    for side, tag in ((1, "L"), (-1, "R")):
        x = side * (EYE_X - 0.012)
        y = front_y(x, EYE_Z) - 0.03
        bone(f"eye.{tag}", (x, y, EYE_Z), (x, y, EYE_Z + 0.1), "head")
        r = Vector((side * WING_ROOT.x, WING_ROOT.y, WING_ROOT.z - 0.1))
        w = bone(f"wing.{tag}", r, r + Vector((side * 0.2, 0, -0.1)), "body")
        w.align_roll(Vector((0, 0, 1)))
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


# Wing bones are rolled so that local X is the forward axis (mirrored): a positive angle lifts either wing.
def wing_rot(angle):
    return (angle, 0, 0)


def build_clips(rig):
    # Bone Y = along the bone: root/body/head point up (Y = height, Z = backwards); wings flap about FLAP.
    breathe = []
    for f, s, tilt, flap in ((1, 1.0, 0, 0), (37, 1.035, 3, 5), (73, 1.0, 0, 0), (109, 1.035, -3, 5), (145, 1.0, 0, 0)):
        breathe.append((f, "body", {"scale": (s, s ** 0.5, s)}))
        breathe.append((f, "head", {"rot": (0, 0, tilt)}))
        for tag in ("L", "R"):
            breathe.append((f, f"wing.{tag}", {"rot": wing_rot(flap)}))
    clips = [clip(rig, "Idle", breathe)]

    blink = []
    for f, s in ((1, 1.0), (3, 0.08), (6, 0.08), (9, 1.0)):
        for tag in ("L", "R"):
            blink.append((f, f"eye.{tag}", {"scale": (1.0, s, 1.0)}))
    clips.append(clip(rig, "Blink", blink))

    # Curious head tilt when showing a hint.
    tilt = []
    for f, a, up in ((1, 0, 0), (10, 16, 0.02), (40, 16, 0.02), (52, 0, 0)):
        tilt.append((f, "head", {"rot": (0, 0, a), "loc": (0, up, 0)}))
    clips.append(clip(rig, "Tilt", tilt))

    # Happy hop with flapping wings (good answer).
    cheer = []
    hop = ((1, 0.0, 1.0), (5, 0.0, 0.9), (11, 0.16, 1.06), (17, 0.0, 0.92), (22, 0.0, 1.0), (31, 0.0, 1.0))
    for f, z, s in hop:
        cheer.append((f, "root", {"loc": (0, z, 0)}))
        cheer.append((f, "body", {"scale": (1.0 / s ** 0.5, s, 1.0 / s ** 0.5)}))
    for f, a in ((1, 0), (6, 55), (10, 10), (14, 55), (18, 10), (24, 30), (31, 0)):
        cheer.append((f, "wing.L", {"rot": wing_rot(a)}))
        cheer.append((f, "wing.R", {"rot": wing_rot(a)}))
    clips.append(clip(rig, "Cheer", cheer))
    return clips


# ---------------------------------------------------------------- assemble


def build():
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = scene
    for o in list(scene.objects):
        bpy.data.objects.remove(o)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.cameras, bpy.data.lights):
        for item in [i for i in coll if i.users == 0]:
            coll.remove(item)
    for a in [a for a in bpy.data.actions if a.name.split(".")[0] in ("Idle", "Blink", "Tilt", "Cheer")]:
        bpy.data.actions.remove(a)
    scene.render.fps = FPS

    parts = build_parts()
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts):
        bpy.ops.object.join()
    owl = parts[0]
    owl.name = owl.data.name = "Plume_body"

    mat = bpy.data.materials.get("Plume") or bpy.data.materials.new("Plume")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    col = next((n for n in nodes if n.type == "VERTEX_COLOR"), None) or nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Col"
    mat.node_tree.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    owl.data.materials.clear()
    owl.data.materials.append(mat)

    rig = build_rig()
    owl.parent = rig
    owl.modifiers.new("Armature", "ARMATURE").object = rig
    clips = build_clips(rig)
    tris = sum(len(p.vertices) - 2 for p in owl.data.polygons)
    return rig, owl, clips, tris


def export(rig, owl):
    os.makedirs(OUT, exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o in (rig, owl))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, "Plume.glb"),
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
    return os.path.getsize(os.path.join(OUT, "Plume.glb"))


def setup_stage():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x, scene.render.resolution_y = 640, 640
    scene.render.film_transparent = False
    world = scene.world or bpy.data.worlds.new("Plume")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = srgb(250, 228, 196)
    bg.inputs["Strength"].default_value = 1.0
    cam = bpy.data.objects.new("Plume_cam", bpy.data.cameras.new("Plume_cam"))
    scene.collection.objects.link(cam)
    cam.data.lens = 85
    scene.camera = cam
    sun = bpy.data.objects.new("Plume_sun", bpy.data.lights.new("Plume_sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
    scene.collection.objects.link(sun)
    floor = bmesh.new()
    bmesh.ops.create_grid(floor, x_segments=1, y_segments=1, size=4)
    me = bpy.data.meshes.new("Plume_floor")
    floor.to_mesh(me)
    floor.free()
    fm = bpy.data.materials.new("Plume_floor")
    fm.use_nodes = True
    next(n for n in fm.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = srgb(
        250, 228, 196
    )
    me.materials.append(fm)
    scene.collection.objects.link(bpy.data.objects.new("Plume_floor", me))
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
    rig, owl, clips, tris = build()
    print("Plume", tris, "tris", [c.name for c in clips])
    cam = setup_stage()
    shoot(cam, "front")
    shoot(cam, "three-quarter", yaw=-35)
    shoot(cam, "side", yaw=-90)
    by_name = {c.name: c for c in clips}
    shoot(cam, "pose-blink", action=by_name["Blink"], frame=4, rig=rig)
    shoot(cam, "pose-tilt", action=by_name["Tilt"], frame=25, rig=rig)
    shoot(cam, "pose-cheer", action=by_name["Cheer"], frame=8, rig=rig)
    print("glb", export(rig, owl), "bytes")
