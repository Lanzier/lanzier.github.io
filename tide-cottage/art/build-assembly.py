"""Capture the model directly from the site's authoring modules into an editable Blender scene.

Install the website's npm dependencies and Python Playwright with Chromium first.
Run python build-assembly.py --blender /path/to/blender --output Tide-Cottage.blend
Use --node-modules if the site's dependencies live in a separate build environment.
"""

import argparse
import mimetypes
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

ART = Path(__file__).resolve().parent
SITE = ART.parent


def import_assembly(glb, output):
    import bpy
    from mathutils import Vector

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    sections = [
        "Terrain and reefs", "Meadow and footpath", "Coastal trees and shrubs", "Dock and rowboat",
        "Garden and grounds", "Cottage shell", "Cottage furnishings",
    ]
    assigned = set()
    for name in reversed(sections):
        anchor = bpy.data.objects.get(name)
        if not anchor:
            raise RuntimeError(f"Missing assembly section: {name}")
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        for obj in [anchor, *anchor.children_recursive]:
            if obj.name in assigned:
                continue
            for old in list(obj.users_collection):
                old.objects.unlink(obj)
            collection.objects.link(obj)
            assigned.add(obj.name)

    # Present the same front-quarter view used on the web, with textures enabled
    # and packed into the .blend for portable editing.
    for image in bpy.data.images:
        if image.source == "FILE" and not image.packed_file:
            image.pack()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                space = area.spaces.active
                space.region_3d.view_rotation = Vector((-8, 20, -13)).to_track_quat("-Z", "Y")
                space.region_3d.view_location = (0, 0, .4)
                space.region_3d.view_distance = 45
                space.shading.type = "MATERIAL"
                space.overlay.show_floor = False
                space.overlay.show_axis_x = space.overlay.show_axis_y = False
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    bpy.context.view_layer.objects.active = None
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output.resolve()), compress=True)
    for name in sections:
        collection = bpy.data.collections[name]
        print(f"{name}: {len(collection.objects)} objects")
    print(f"Packed materials: {len(bpy.data.materials)}, images: {len(bpy.data.images)}")
    print(f"Shared meshes: {sum(mesh.users > 1 for mesh in bpy.data.meshes)}")


def capture(node_modules, glb, temporary, channel):
    from playwright.sync_api import sync_playwright

    binary = node_modules / "esbuild" / "bin" / "esbuild"
    if os.name == "nt":
        binary = node_modules / "@esbuild" / "win32-x64" / "esbuild.exe"
    output = temporary / "capture.js"
    env = dict(os.environ, NODE_PATH=str(node_modules))
    subprocess.run([str(binary), str(ART / "capture-assembly.js"), "--bundle", f"--outfile={output}"],
                   env=env, check=True)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(channel=channel)
        page = browser.new_page()

        def local_asset(route):
            url = urlsplit(route.request.url)
            if url.hostname != "tide-assembly.test":
                return route.abort()
            if url.path == "/":
                return route.fulfill(content_type="text/html", body='<script src="/capture.js"></script>')
            target = output if url.path == "/capture.js" else (SITE / url.path.lstrip("/")).resolve()
            if target != output and (not target.is_relative_to(SITE) or not target.is_file()):
                return route.abort()
            return route.fulfill(content_type=mimetypes.guess_type(target.name)[0] or "application/octet-stream",
                                 body=target.read_bytes())

        page.route("**/*", local_asset)
        page.goto("http://tide-assembly.test/")
        with page.expect_download(timeout=90000) as download:
            page.evaluate("window.saveAssembly()")
        download.value.save_as(glb)
        browser.close()


if "--import-scene" in sys.argv:
    arg_index = sys.argv.index("--import-scene") + 1
    import_assembly(Path(sys.argv[arg_index]), Path(sys.argv[arg_index+1]))
else:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blender", default="blender")
    parser.add_argument("--node-modules", type=Path, default=SITE / "node_modules")
    parser.add_argument("--channel", help="Use a locally installed Chromium build, e.g. chrome")
    parser.add_argument("--output", type=Path, default=ART / "Tide-Cottage.blend")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        glb = temporary / "assembly.glb"
        capture(args.node_modules.resolve(), glb, temporary, args.channel)
        subprocess.run([args.blender, "--background", "--python-exit-code", "1", "--python", str(Path(__file__).resolve()),
                        "--", "--import-scene", str(glb), str(args.output)], check=True)
