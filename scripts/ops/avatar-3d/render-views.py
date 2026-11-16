"""Blender headless: vyrenderuje 4 pohledy jednoho GLB (kontrolní list).

Používá se pro vizuální QA dávek avatarů — bez pohledu na snímek se „model je
hotový" tvrdit nedá (měkká tvář, zploštělé tělo i artifact pod nohama jsou
vidět jen na renderu).

Použití:
  Blender -b --factory-startup --python scripts/ops/avatar-3d/render-views.py -- \
      --input model-rigged.glb --outdir /tmp/qa/078 --size 240

Výstup: front.png, threequarter.png, side.png, back.png

Pozn.: po importu glTF míří postava v Blenderu k +X, proto je „front" natočený
o 90° — bez toho vyjde profil a QA list mate.
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--outdir", required=True)
    parser.add_argument("--size", type=int, default=420)
    parser.add_argument("--views", default="front,threequarter,side,back")
    return parser.parse_args(argv)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_world():
    world = bpy.data.worlds.new("W")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.30, 0.30, 0.32, 1.0)
    bg.inputs[1].default_value = 1.0


def add_lights(center, height):
    key = bpy.data.lights.new("key", type="AREA")
    key.energy = 900
    key.size = height
    obj = bpy.data.objects.new("key", key)
    obj.location = center + Vector((height, -height * 0.8, height * 0.9))
    obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(obj)

    fill = bpy.data.lights.new("fill", type="AREA")
    fill.energy = 350
    fill.size = height
    obj2 = bpy.data.objects.new("fill", fill)
    obj2.location = center + Vector((-height, -height * 0.6, height * 0.4))
    obj2.rotation_euler = (center - obj2.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(obj2)


def model_bounds():
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            lo = Vector((min(lo.x, world.x), min(lo.y, world.y), min(lo.z, world.z)))
            hi = Vector((max(hi.x, world.x), max(hi.y, world.y), max(hi.z, world.z)))
    return lo, hi


def main():
    args = parse_args()
    clear()
    setup_world()
    bpy.ops.import_scene.gltf(filepath=args.input)

    lo, hi = model_bounds()
    center = (lo + hi) / 2
    height = max(hi.z - lo.z, 0.5)
    add_lights(center, height)

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = height * 1.08
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    scene = bpy.context.scene
    scene.render.resolution_x = args.size
    scene.render.resolution_y = int(args.size * 1.45)
    scene.render.film_transparent = False
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue

    distance = height * 2.5
    os.makedirs(args.outdir, exist_ok=True)
    base = math.radians(90)
    angles = {
        "front": base,
        "threequarter": base + math.radians(35),
        "side": base + math.radians(90),
        "back": base + math.radians(180),
    }
    for name in args.views.split(","):
        a = angles[name]
        cam.location = center + Vector((math.sin(a) * distance, -math.cos(a) * distance, 0))
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(args.outdir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {name}")


if __name__ == "__main__":
    main()
