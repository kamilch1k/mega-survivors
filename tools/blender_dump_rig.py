"""Dump an armature's bone hierarchy with world-space positions.

Usage:
  blender --background --python tools/blender_dump_rig.py -- <file.glb>
"""
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
src = argv[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

for obj in bpy.data.objects:
    if obj.type != "ARMATURE":
        continue
    print(f"ARMATURE {obj.name} bones={len(obj.data.bones)}")
    for bone in obj.data.bones:
        head = obj.matrix_world @ bone.head_local
        tail = obj.matrix_world @ bone.tail_local
        parent = bone.parent.name if bone.parent else "-"
        print(
            f"  {bone.name} parent={parent} "
            f"head=({head.x:.3f},{head.y:.3f},{head.z:.3f}) "
            f"tail=({tail.x:.3f},{tail.y:.3f},{tail.z:.3f})"
        )

for action in bpy.data.actions:
    print(f"ACTION {action.name} frames={action.frame_range[0]:.0f}..{action.frame_range[1]:.0f}")
