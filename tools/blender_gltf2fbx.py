"""Convert a GLB/GLTF character to FBX for Mixamo upload / round-trip.

Usage (headless):
  blender --background --python tools/blender_gltf2fbx.py -- <in.glb> <out.fbx> [--strip-rig]

--strip-rig removes armatures and applies modifiers, producing a clean static
mesh suitable for Mixamo's "Upload Character" auto-rigger.
"""
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
src = argv[0]
dst = argv[1]
strip_rig = "--strip-rig" in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

if strip_rig:
    for obj in list(bpy.data.objects):
        if obj.type == "ARMATURE":
            bpy.data.objects.remove(obj, do_unlink=True)

    for obj in list(bpy.data.objects):
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception as exc:  # noqa: BLE001
                print("modifier skip:", mod.name, exc)
        obj.parent = None

mesh_count = len([o for o in bpy.data.objects if o.type == "MESH"])
tri_count = 0
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.data.calc_loop_triangles()
        tri_count += len(obj.data.loop_triangles)

bpy.ops.export_scene.fbx(
    filepath=dst,
    use_selection=False,
    global_scale=1.0,
    apply_unit_scale=True,
    apply_scale_options="FBX_SCALE_ALL",
    bake_space_transform=False,
    object_types={"MESH", "ARMATURE"},
    mesh_smooth_type="FACE",
    use_mesh_modifiers=False,
    path_mode="COPY",
    embed_textures=True,
    axis_forward="-Z",
    axis_up="Y",
)

print(f"EXPORTED {dst}")
print(f"MESHES {mesh_count} TRIANGLES {tri_count}")
