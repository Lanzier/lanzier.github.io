"""Build the editable island and its compact web mesh in Blender.

Run blender --background --python art/build-island.py from any directory.
To publish changes sculpted in the .blend, open it in Blender and run
blender art/island-shelf.blend --background --python art/build-island.py -- --export-existing
"""
import json
import math
import struct
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector, noise

ART = Path(__file__).resolve().parent
COTTAGE = ART.parent
BLEND = ART / "island-shelf.blend"
WEB = COTTAGE / "assets" / "coast" / "island-shelf-v1.bin"
OBJECT = "Tidal shelf and island"
ATTRIBUTE = "Habitat"


def make_island():
    profile = "import {landscapeData} from './topography.js'; process.stdout.write(JSON.stringify(landscapeData('ground', 128)))"
    data = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", profile], cwd=COTTAGE))
    points = []
    for x, h, z in zip(*[iter(data["position"])] * 3):
        # Small wave-carved depressions become visible around the break in slope.
        # Protect the intertidal seam and all walkable ground.
        band = min(1, max(0, -h - .19), max(0, (6 + h) / 2))
        furrow = noise.noise_vector(Vector((x * .31, z * .45, .71))).x
        h += band * (.055 * furrow + .034 * math.sin(z * 2.3 + x + furrow))
        points.append((x, -z, h))
    mesh = bpy.data.meshes.new("Continuous meadow, littoral and submarine shelf")
    faces = list(zip(*[iter(data["indices"])] * 3))
    mesh.from_pydata(points, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    colors = mesh.color_attributes.new(name=ATTRIBUTE, type="FLOAT_COLOR", domain="POINT")
    for item, rgb in zip(colors.data, zip(*[iter(data["color"])] * 3)):
        item.color = (*rgb, 1)

    obj = bpy.data.objects.new(OBJECT, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    material = bpy.data.materials.new("Meadow, dunes, damp sand and shale")
    material.use_nodes = True
    color = material.node_tree.nodes.new("ShaderNodeVertexColor")
    color.layer_name = ATTRIBUTE
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    material.node_tree.links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = .91
    mesh.materials.append(material)

    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.shading.color_type = "VERTEX"
                area.spaces.active.region_3d.view_distance = 47
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True)
    return obj


def export(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    colors = mesh.color_attributes[ATTRIBUTE]
    indices = [v for tri in mesh.loop_triangles for v in tri.vertices]
    if len(mesh.vertices) >= 65536:
        raise ValueError("The mobile mesh must fit a 16-bit index buffer")
    WEB.parent.mkdir(exist_ok=True, parents=True)
    with WEB.open("wb") as f:
        f.write(b"TIDE" + struct.pack("<II", len(mesh.vertices), len(indices)))
        for v in mesh.vertices:
            x, y, z = v.co
            f.write(struct.pack("<hhh", *(round(k * 512) for k in (x, z, -y))))
        for v in mesh.vertices:
            x, y, z = v.normal
            f.write(struct.pack("<bbb", *(round(k * 127) for k in (x, z, -y))))
        for item in colors.data:
            f.write(bytes(round(255 * max(0, min(1, k))) for k in item.color[:3]))
        f.write(struct.pack(f"<{len(indices)}H", *indices))
    print(f"{WEB.name}: {len(mesh.vertices)} vertices, {len(indices)//3} triangles, {WEB.stat().st_size} bytes")


if "--export-existing" in sys.argv:
    export(bpy.data.objects[OBJECT])
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    export(make_island())
