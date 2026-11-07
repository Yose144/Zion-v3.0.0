"""Blender headless: rig a skin jedné postavy pro Nirvanu.

Proč analytické váhy a ne `ARMATURE_AUTO` (bone heat): síť z image-to-3D je
často neuzavřená a bone heat na ní selže („failed to find solution"). Vzdálenostní
váhy k úsečkám kostí fungují vždy a u stylizované postavy vypadají dobře.

Skript se pouští **uvnitř Blenderu**:
    Blender -b --factory-startup --python scripts/ops/avatar-3d/rig.py -- \
        --input <in.glb> --output <out.glb> [--height 1.75] [--no-anim]

Postup:
1. import GLB, srovnání do metrů (chodidla na y=0, střed v ose X/Z),
2. kostra humanoida odvozená z proporcí modelu (ne z pevných čísel),
3. vzdálenostní skin weights (2 nejbližší kosti, pád 1/d^3),
4. jedna idle animace (dýchání v kyčlích + hrudník),
5. export GLB se skinem a animací.

Pozn.: osa Y v glTF = výška; Blender má Z-up, import/export to řeší sám.
"""

from __future__ import annotations

import argparse
import math
import sys

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--height", type=float, default=1.75)
    parser.add_argument("--no-anim", action="store_true")
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path: str) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise SystemExit("v GLB není žádná síť")
    # Největší síť = tělo; drobné ostrůvky připojíme později, pokud budou.
    meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
    return meshes[0]


def normalize(obj: bpy.types.Object, target_height: float) -> float:
    """Srovná model: chodidla na Z=0, střed v X/Y, výška v metrech."""
    bpy.context.view_layer.update()
    world = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(v.x for v in world), min(v.y for v in world), min(v.z for v in world)))
    high = Vector((max(v.x for v in world), max(v.y for v in world), max(v.z for v in world)))
    size = high - low
    if size.z <= 0:
        raise SystemExit("model nemá výšku")

    scale = target_height / size.z
    obj.scale = (obj.scale[0] * scale, obj.scale[1] * scale, obj.scale[2] * scale)
    bpy.context.view_layer.update()

    world = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(v.x for v in world), min(v.y for v in world), min(v.z for v in world)))
    high = Vector((max(v.x for v in world), max(v.y for v in world), max(v.z for v in world)))
    center = (low + high) / 2
    obj.location.x -= center.x
    obj.location.y -= center.y
    obj.location.z -= low.z
    bpy.context.view_layer.update()
    return target_height


def build_armature(height: float) -> bpy.types.Object:
    """Kostra z proporcí: 0 = chodidla, 1 = temeno."""
    h = height
    arm_data = bpy.data.armatures.new("AvatarRig")
    arm = bpy.data.objects.new("AvatarRig", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")

    # (jméno, hlava, ocas, rodič)
    bones = [
        ("hips", (0, 0, 0.52 * h), (0, 0, 0.60 * h), None),
        ("spine", (0, 0, 0.60 * h), (0, 0, 0.70 * h), "hips"),
        ("chest", (0, 0, 0.70 * h), (0, 0, 0.80 * h), "spine"),
        ("neck", (0, 0, 0.80 * h), (0, 0, 0.85 * h), "chest"),
        ("head", (0, 0, 0.85 * h), (0, 0, 0.99 * h), "neck"),
        ("upperarm.L", (0.10 * h, 0, 0.78 * h), (0.20 * h, 0, 0.63 * h), "chest"),
        ("forearm.L", (0.20 * h, 0, 0.63 * h), (0.24 * h, 0, 0.50 * h), "upperarm.L"),
        ("hand.L", (0.24 * h, 0, 0.50 * h), (0.26 * h, 0, 0.44 * h), "forearm.L"),
        ("upperarm.R", (-0.10 * h, 0, 0.78 * h), (-0.20 * h, 0, 0.63 * h), "chest"),
        ("forearm.R", (-0.20 * h, 0, 0.63 * h), (-0.24 * h, 0, 0.50 * h), "upperarm.R"),
        ("hand.R", (-0.24 * h, 0, 0.50 * h), (-0.26 * h, 0, 0.44 * h), "forearm.R"),
        ("thigh.L", (0.06 * h, 0, 0.52 * h), (0.07 * h, 0, 0.28 * h), "hips"),
        ("shin.L", (0.07 * h, 0, 0.28 * h), (0.07 * h, 0, 0.05 * h), "thigh.L"),
        ("foot.L", (0.07 * h, 0, 0.05 * h), (0.07 * h, -0.10 * h, 0.01 * h), "shin.L"),
        ("thigh.R", (-0.06 * h, 0, 0.52 * h), (-0.07 * h, 0, 0.28 * h), "hips"),
        ("shin.R", (-0.07 * h, 0, 0.28 * h), (-0.07 * h, 0, 0.05 * h), "thigh.R"),
        ("foot.R", (-0.07 * h, 0, 0.05 * h), (-0.07 * h, -0.10 * h, 0.01 * h), "shin.R"),
    ]

    created = {}
    for name, head, tail, parent in bones:
        bone = arm_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = created[parent]
            bone.use_connect = False
        created[name] = bone

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def distance_to_segment(point: Vector, head: Vector, tail: Vector) -> float:
    segment = tail - head
    length_sq = segment.length_squared
    if length_sq == 0:
        return (point - head).length
    t = max(0.0, min(1.0, (point - head).dot(segment) / length_sq))
    return (point - (head + segment * t)).length


def skin(mesh: bpy.types.Object, arm: bpy.types.Object, height: float) -> None:
    """Váhy podle vzdálenosti k úsečkám kostí (2 nejbližší, pád 1/d^3)."""
    segments = []
    for bone in arm.data.bones:
        segments.append((bone.name, bone.head_local.copy(), bone.tail_local.copy()))

    groups = {name: mesh.vertex_groups.new(name=name) for name, _, _ in segments}

    for vertex in mesh.data.vertices:
        point = mesh.matrix_world @ vertex.co
        scored = []
        for name, head, tail in segments:
            distance = distance_to_segment(point, head, tail)
            scored.append((distance, name))
        scored.sort()
        nearest = scored[:2]
        weights = [(name, 1.0 / max(distance, 1e-4) ** 3) for distance, name in nearest]
        total = sum(w for _, w in weights) or 1.0
        for name, weight in weights:
            groups[name].add([vertex.index], weight / total, "REPLACE")

    modifier = mesh.modifiers.new(name="Armature", type="ARMATURE")
    modifier.object = arm
    mesh.parent = arm


def add_idle(arm: bpy.types.Object, height: float) -> None:
    """Nepatrné dýchání, aby export obsahoval animaci a šel ověřit skin."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    arm.animation_data_create()
    action = bpy.data.actions.new("idle")
    arm.animation_data.action = action

    frames = [(1, 0.0), (30, 0.012 * height), (60, 0.0)]
    hips = arm.pose.bones["hips"]
    chest = arm.pose.bones["chest"]
    for frame, lift in frames:
        bpy.context.scene.frame_set(frame)
        hips.location = (0.0, 0.0, lift)
        hips.keyframe_insert("location", frame=frame)
        chest.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        chest.rotation_mode = "QUATERNION"
        chest.rotation_quaternion = (
            math.cos(0.02 * (1 if frame == 30 else 0)),
            0.0,
            0.0,
            math.sin(0.02 * (1 if frame == 30 else 0)),
        )
        chest.keyframe_insert("rotation_quaternion", frame=frame)

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.scene.frame_set(1)


def main() -> int:
    args = parse_args()
    clear_scene()
    mesh = import_glb(args.input)
    height = normalize(mesh, args.height)
    arm = build_armature(height)
    skin(mesh, arm, height)
    if not args.no_anim:
        add_idle(arm, height)

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm

    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_animations=not args.no_anim,
        export_apply=False,
        export_yup=True,
    )
    print(f"RIGGED {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
