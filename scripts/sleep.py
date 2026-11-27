# The animals asleep at night (#119): a Sleep clip for each animal of the game, the pack
# having none. Lying down, legs folded, the head curled round to the flank, breathing slowly;
# the eagle perched, its head turned back onto its back. Only the wolf never uses it.
# Run in Blender (MCP): exec(open(p).read(), {"__file__": p, "__name__": "__main__"}), or
# headless: `blender -b --factory-startup --python scripts/sleep.py`. Reads each animal as the
# game gets it (the pack's glTF extracted in assets-private/animals/quaternius, or our export),
# writes assets-private/animals/export/sleep/<file>.glb: its skeleton and the Sleep clip only,
# which `npm run assets` adds to the animal's clips.
import math
import os

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets-private", "animals")
PACK = os.path.join(ROOT, "quaternius", "Ultimate Animated Animals - July 2021", "glTF")
MADE = os.path.join(ROOT, "export")
OUT = os.path.join(MADE, "sleep")
FPS = 30
# One slow breath.
BREATH = 4.0


def load(path, name):
    """The animal in a scene of its own, at rest, without its clips."""
    old = bpy.data.scenes.get(name)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o)
        bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new(name)
    scene.render.fps = FPS
    bpy.context.window.scene = scene
    before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    clips = {a.name.split(".")[0]: a for a in bpy.data.actions if a not in before}
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()
    return scene, rig, clips


def pose_of(rig, action, frame=0):
    """Take the pose of a clip at a frame, then let go of the clip."""
    rig.animation_data.action = action
    bpy.context.scene.frame_set(frame)
    bases = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis = bases[pb.name]
    bpy.context.view_layer.update()


def turn(rig, bone, axis, degrees):
    """Turn a bone (and what hangs from it) about an axis of the armature through its head."""
    pb = rig.pose.bones[bone]
    p = pb.head.copy()
    r = Matrix.Rotation(math.radians(degrees), 4, Vector(axis).normalized())
    pb.matrix = Matrix.Translation(p) @ r @ Matrix.Translation(-p) @ pb.matrix
    bpy.context.view_layer.update()


def nod(rig, bone, degrees):
    """Tip a bone down (up when negative) about the level axis across it."""
    pb = rig.pose.bones[bone]
    way = pb.tail - pb.head
    way.z = 0
    # Upright, it bows forward.
    if way.length < 0.3 * pb.length:
        way = Vector((0, -1, 0))
    turn(rig, bone, Vector((0, 0, 1)).cross(way), degrees)


def shift(rig, bone, offset):
    pb = rig.pose.bones[bone]
    pb.matrix = Matrix.Translation(Vector(offset)) @ pb.matrix
    bpy.context.view_layer.update()


def follow(rig, child, parent):
    """A root bone (a foot) carried along by another as if it hung from it."""
    pc, pp = rig.pose.bones[child], rig.pose.bones[parent]
    pc.matrix = pp.matrix @ pp.bone.matrix_local.inverted() @ pc.bone.matrix_local
    bpy.context.view_layer.update()


def lowest(scene, rig):
    """Lowest point of the posed meshes, in the armature's space."""
    deps = bpy.context.evaluated_depsgraph_get()
    low = math.inf
    for o in scene.objects:
        if o.type != "MESH":
            continue
        ev = o.evaluated_get(deps)
        m = rig.matrix_world.inverted() @ ev.matrix_world
        low = min(low, min((m @ v.co).z for v in ev.data.vertices))
    return low


HOOFED = {
    "front": (-75, 170, 8),
    "back": (-60, 45, -75, 15),
    # Bone, turn round to the left, bow: the neck curls back along the flank.
    "neck": (("Neck1", 60, 30), ("Neck2", 50, 15), ("Neck3", 40, 10), ("Head", 30, 30)),
    "tail": -25,
    # The chest rises with each breath.
    "breath": ("Torso", 1.5),
}
# Curled up in a ball, the tail wrapped round to the nose.
CANINE = dict(
    HOOFED,
    neck=(("Neck1", 50, 20), ("Neck2", 45, 10), ("Neck3", 40, 10), ("Head", 30, 25)),
    bend=(("Torso", 20), ("Torso2", 20)),
    tail=-15,
    wrap=-28,
)


def lie_down(scene, rig, p, clips):
    """Legs folded under the body, lowered to the ground, the head curled round to the left."""
    bones = rig.pose.bones
    feet = [("IKFrontLeg", "FrontLowerLeg"), ("IKBackLeg", "BackLowerLeg")]
    for s, sign in (("L", 1), ("R", -1)):
        # Front legs: the forearm forward, the cannon folded back under the chest.
        forearm, cannon, splay = p["front"]
        turn(rig, f"FrontUpperLeg.{s}", (1, 0, 0), forearm)
        turn(rig, f"FrontLowerLeg.{s}", (1, 0, 0), cannon)
        turn(rig, f"FrontUpperLeg.{s}", (0, 1, 0), sign * splay)
        # Back legs: the knee forward, the hock back, the foot forward along the belly.
        thigh, shank, foot, splay = p["back"]
        turn(rig, f"BackLeg.{s}", (1, 0, 0), thigh)
        turn(rig, f"BackUpperLeg.{s}", (1, 0, 0), shank)
        turn(rig, f"BackLowerLeg.{s}", (1, 0, 0), foot)
        turn(rig, f"BackLeg.{s}", (0, 1, 0), sign * splay)
        for ik, leg in feet:
            follow(rig, f"{ik}.{s}", f"{leg}.{s}")
    # Down to the ground, the belly on it.
    drop = lowest(scene, rig)
    shift(rig, "Body", (0, 0, -drop))
    for s in "LR":
        for ik, leg in feet:
            follow(rig, f"{ik}.{s}", f"{leg}.{s}")
    for bone, yaw in p.get("bend", ()):
        turn(rig, bone, (0, 0, 1), yaw)
    for bone, yaw, down in p["neck"]:
        turn(rig, bone, (0, 0, 1), yaw)
        nod(rig, bone, down)
    if "Tail1" in bones:
        turn(rig, "Tail1", (1, 0, 0), p["tail"])
    tail = [b.name for b in bones if b.name.startswith("Tail")]
    for bone in tail if "wrap" in p else ():
        turn(rig, bone, (0, 0, 1), p["wrap"])


def tuck(scene, rig, p, clips):
    """The eagle perched, its head turned back onto its back, the beak in its feathers."""
    pose_of(rig, clips["Perch"])
    turn(rig, "Neck", (0, 0, 1), 150)
    nod(rig, "Neck", 25)
    turn(rig, "Head", (0, 0, 1), 15)
    nod(rig, "Head", 35)


BIRD = {"pose": tuck, "breath": ("Body", 3)}


def key(rig, frame):
    for pb in rig.pose.bones:
        for path in ("location", "rotation_quaternion", "scale"):
            pb.keyframe_insert(path, frame=frame)


def breathe(rig, p):
    """The pose as a clip, one slow breath long: the chest rises and falls."""
    end = round(BREATH * FPS)
    still = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}
    bone, degrees = p["breath"]
    nod(rig, bone, -degrees)
    held = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}
    # Keyed without updating the scene, which would play the clip over the pose.
    rig.animation_data.action = bpy.data.actions.new("Sleep")
    for frame, pose in ((0, still), (end // 2, held), (end, still)):
        for pb in rig.pose.bones:
            pb.matrix_basis = pose[pb.name]
        key(rig, frame)
    return rig.animation_data.action


def build(path, name, p):
    scene, rig, clips = load(path, name)
    p.get("pose", lie_down)(scene, rig, p, clips)
    sleep = breathe(rig, p)
    # The pack's clips stay out of the file: only Sleep is exported.
    for action in clips.values():
        bpy.data.actions.remove(action)
    return scene, rig, sleep


def export(scene, rig, file):
    os.makedirs(OUT, exist_ok=True)
    for o in scene.objects:
        o.select_set(o is rig)
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT, file + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=True,
        use_active_scene=True,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=False,
        export_morph=False,
        export_yup=True,
    )
    return os.path.getsize(path)


# File of the game's catalog (`src/scene/animal-catalog.ts`): where it comes from, how it sleeps.
ANIMALS = {
    "Deer": (PACK, HOOFED),
    "Stag": (PACK, HOOFED),
    "Fox": (PACK, CANINE),
    "Wolf": (PACK, CANINE),
    "Donkey": (PACK, HOOFED),
    "Alpaca": (PACK, HOOFED),
    "Horse_White": (PACK, HOOFED),
    "Cow": (PACK, HOOFED),
    "Chamois": (MADE, HOOFED),
    "Ibex": (MADE, HOOFED),
    "Marmot": (MADE, CANINE),
    "Eagle": (MADE, BIRD),
}

if __name__ == "__main__":
    for file, (folder, how) in ANIMALS.items():
        path = os.path.join(folder, file + (".gltf" if folder == PACK else ".glb"))
        scene, rig, sleep = build(path, "Sleep" + file, how)
        print(file, export(scene, rig, file), "bytes")
        # The exporter takes every action of the file: the next animal has its own.
        bpy.data.actions.remove(sleep)
