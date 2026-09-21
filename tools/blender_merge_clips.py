"""Merge one or more animation-only GLBs onto a skinned character GLB.

Usage:
  blender --background --python tools/blender_merge_clips.py -- <character.glb> <out.glb> <clipA.glb> [clipB.glb ...]

Uses the character as the base (mesh + skeleton + materials). For every other
file, all animation actions are appended and renamed to the file's stem, so the
game can select clips by name (idle/walk/run/jump/slash/hurt/death).
"""
import os
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
character = argv[0]
out_path = argv[1]
clips = argv[2:]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=character)
base_actions = set(bpy.data.actions.keys())
print("BASE ACTIONS", sorted(base_actions))

for clip_path in clips:
    stem = os.path.splitext(os.path.basename(clip_path))[0]
    before = set(bpy.data.actions.keys())
    bpy.ops.import_scene.gltf(filepath=clip_path, import_shading="NORMALS")
    new = [a for a in bpy.data.actions.keys() if a not in before]
    for name in new:
        action = bpy.data.actions[name]
        action.name = stem
        action.use_fake_user = True
        print(f"CLIP {stem} <- {name} frames={action.frame_range[:]}")

print("ALL ACTIONS", sorted(bpy.data.actions.keys()))

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=False,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_bake_animation=True,
    export_force_sampling=True,
    export_apply=False,
    export_yup=True,
)
print("EXPORTED", out_path)
