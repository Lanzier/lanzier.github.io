"""Build the island's little coastal plant library in Blender 4.2 or newer.

Run blender -b -P model_botany.py to regenerate the editable .blend and web data.
After editing the .blend, run blender coastal-botany.blend -b -P model_botany.py -- --export-only.
"""

import base64
import json
import math
import random
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

DIR = Path(__file__).resolve().parent
TAU = math.tau


def shade(rgb, value):
    return tuple(min(1, max(0, channel * value)) for channel in rgb)


def linear_srgb(value):
    value /= 255.0
    return value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4


class Mesh:
    """Author in the same Y-up coordinates used for placement in the island."""

    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.points = []
        self.colors = []
        self.faces = []

    def point(self, position, color):
        self.points.append(Vector(position))
        self.colors.append(color)
        return len(self.points) - 1

    def face(self, a, b, c, outward):
        pa, pb, pc = (self.points[i] for i in (a, b, c))
        if (pb - pa).cross(pc - pa).dot(Vector(outward)) < 0:
            b, c = c, b
        self.faces.append((a, b, c))

    def lobe(self, center, radii, sides, bands, palette, contour=0.08):
        origin = Vector(center)
        rx, ry, rz = radii
        bottom = self.point(origin + Vector((0, -ry, 0)), shade(palette, 0.54))
        previous = []
        for latitude in range(1, bands):
            lat = math.pi * latitude / bands - math.pi / 2
            ring = []
            for side in range(sides):
                angle = TAU * (side + 0.19 * (latitude % 2)) / sides
                wave = 1 + contour * (math.cos(3 * angle + lat) + 0.6 * math.sin(5 * angle - 2 * lat))
                radial = math.cos(lat) * wave
                altitude = math.sin(lat)
                p = origin + Vector(
                    (
                        rx * radial * math.cos(angle),
                        ry * (altitude + 0.04 * math.cos(3 * angle) * math.cos(lat)),
                        rz * radial * math.sin(angle),
                    )
                )
                lighting = (
                    0.78 + 0.19 * altitude + 0.07 * math.sin(2 * angle + lat) + self.rng.uniform(-0.035, 0.035)
                )
                ring.append(self.point(p, shade(palette, lighting)))
            for i, a in enumerate(ring):
                b = ring[(i + 1) % sides]
                if previous:
                    c, d = previous[i], previous[(i + 1) % sides]
                    self.face(a, c, b, self.points[a] - origin)
                    self.face(b, c, d, self.points[b] - origin)
                else:
                    self.face(a, bottom, b, self.points[a] - origin)
            previous = ring
        top = self.point(origin + Vector((0, ry, 0)), palette)
        for i, a in enumerate(previous):
            self.face(a, previous[(i + 1) % sides], top, self.points[a] - origin)

    def leaf(self, start, direction, normal, length, width, pigment, lobed=False):
        start = Vector(start)
        forward = Vector(direction).normalized()
        side = Vector(normal).cross(forward).normalized()
        normal = forward.cross(side).normalized()
        # A folded midrib catches the light. Coastal shrub leaves have rounded shoulders,
        # while melon leaves have five scalloped lobes and a heart-shaped base.
        outline = [
            (0.04, 0),
            (0.27, -0.83),
            (0.55, -1),
            (0.83, -0.62),
            (1, 0),
            (0.76, 0.78),
            (0.42, 1),
            (0.16, 0.55),
        ]
        if lobed:
            outline = [
                (0.12, 0),
                (0, -0.46),
                (0.15, -0.83),
                (0.27, -0.52),
                (0.37, -1),
                (0.54, -0.94),
                (0.58, -0.52),
                (0.77, -0.68),
                (0.82, -0.37),
                (1, 0),
                (0.82, 0.38),
                (0.76, 0.73),
                (0.57, 0.53),
                (0.56, 0.95),
                (0.35, 1),
                (0.29, 0.54),
                (0.13, 0.86),
                (0, 0.46),
            ]
        blade = []
        for t, across in outline:
            arch = math.sin(math.pi * t) * 0.085 - (0.075 if t > 0.95 else 0)
            p = start + forward * (length * t) + side * (across * width) + normal * (length * arch)
            blade.append(self.point(p, shade(pigment, 0.84 + 0.22 * t + 0.055 * across)))
        rib = self.point(start + forward * (length * 0.49) + normal * (length * 0.18), shade(pigment, 1.17))
        for i, corner in enumerate(blade):
            self.face(rib, corner, blade[(i + 1) % len(blade)], normal)

    def stalk(self, path, radius, color, sides=5):
        points = list(map(Vector, path))
        ring = []
        for i, p in enumerate(points):
            axis = (points[min(len(points) - 1, i + 1)] - points[max(0, i - 1)]).normalized()
            cross = axis.cross(Vector((0, 1, 0)))
            if cross.length < 0.05:
                cross = axis.cross(Vector((1, 0, 0)))
            cross.normalize()
            up = axis.cross(cross).normalized()
            new = []
            for j in range(sides):
                angle = TAU * j / sides
                n = cross * math.cos(angle) + up * math.sin(angle)
                new.append(
                    self.point(
                        p + n * radius * (1 - 0.53 * i / (len(points) - 1)),
                        shade(color, 0.88 + 0.13 * math.cos(angle)),
                    )
                )
            if ring:
                for j, a in enumerate(new):
                    k = (j + 1) % sides
                    self.face(a, ring[j], new[k], self.points[a] - p)
                    self.face(new[k], ring[j], ring[k], self.points[new[k]] - p)
            ring = new

    def finish(self, name, location):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([(p.x, -p.z, p.y) for p in self.points], [], self.faces)
        mesh.update()
        colors = mesh.color_attributes.new(name="Pigment", type="FLOAT_COLOR", domain="POINT")
        for entry, rgb in zip(colors.data, self.colors):
            entry.color = (*rgb, 1.0)
        for face in mesh.polygons:
            face.use_smooth = True
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        mesh.materials.append(bpy.data.materials["Botany paint"])
        # The game varies these same tints per specimen. This gives an artist a
        # representative colour when editing the shared, tintable mesh in Blender.
        rgb = {"Crown": (87, 128, 61), "Shrub": (108, 142, 92)}.get(name, (255, 255, 255))
        obj.color = (*map(linear_srgb, rgb), 1)
        obj.location.x = location


def canopy():
    # Preserve the original island's once-subdivided, hand-tinted icosahedron.
    # Keep separate face corners so each triangle retains its flat normal and pigment.
    model = Mesh(0)
    phi = (1 + math.sqrt(5)) / 2
    shell = [Vector(p) for p in [
        (-1,phi,0),(1,phi,0),(-1,-phi,0),(1,-phi,0),
        (0,-1,phi),(0,1,phi),(0,-1,-phi),(0,1,-phi),
        (phi,0,-1),(phi,0,1),(-phi,0,-1),(-phi,0,1),
    ]]
    faces = [(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),
             (1,5,9),(5,11,4),(11,10,2),(10,7,6),(7,1,8),
             (3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),
             (4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
    for face in faces:
        a,b,c = [shell[i] for i in face]
        ab,ac,bc = (a+b)*.5, (a+c)*.5, (b+c)*.5
        for tri in [(ab,ac,a),(ab,bc,ac),(b,bc,ab),(bc,c,ac)]:
            points = []
            for corner in tri:
                unit = corner.normalized()
                x,y,z = unit
                radius = (1 + .12*math.sin(x*3.9+y*3.1-z*3.7)*math.cos(z*7.1+y*3.9)
                          + .048*math.sin((x+z)*8.6-y*4.6))
                points.append(unit*radius)
            x,y,z = (points[0]+points[1]+points[2])/3
            light = .89+.11*y+.092*math.sin(x*16.3+y*5.7-z*9.5)
            model.faces.append(tuple(model.point(p,(light,light,light*.96)) for p in points))
    model.finish("Crown", -4)


def shrub():
    model = Mesh(6128)
    moss = (0.64, 0.86, 0.68)
    model.lobe((0, 0.34, 0), (0.66, 0.32, 0.61), 9, 4, shade(moss, 0.75), 0.13)
    for b in range(7):
        angle = b * 2.399963 + 0.12
        out = Vector((math.cos(angle), 0, math.sin(angle)))
        side = Vector((-out.z, 0, out.x))
        height = model.rng.uniform(0.57, 1.13)
        reach = model.rng.uniform(0.67, 1.05)
        tip = out * reach + Vector((0, height, 0))
        middle = out * (reach * 0.64) + Vector((0, height * 0.54, 0))
        model.stalk([(0.02, 0.09, 0), middle, tip], 0.029, (0.34, 0.43, 0.20))
        model.lobe(middle + Vector((0, 0.02, 0)), (0.32, 0.23, 0.28), 7, 4, shade(moss, 0.85), 0.1)
        for t in (0.47, 0.65, 0.81, 0.95):
            for direction in (-1, 1):
                start = tip * t + Vector((0, -0.055, 0))
                aim = (
                    out * 0.52
                    + side * direction * 0.85
                    + Vector((0, model.rng.uniform(-0.21, 0.57) + (t - 0.64) * 0.8, 0))
                )
                normal = (out * 0.55 + Vector((0, 1, 0))).normalized()
                pigment = shade((0.82, 0.96, 0.72), model.rng.uniform(0.81, 1.08))
                model.leaf(
                    start, aim, normal, model.rng.uniform(0.37, 0.57), model.rng.uniform(0.11, 0.17), pigment
                )
    model.finish("Shrub", -1)


def watermelon():
    model = Mesh(91)
    rings, sides = 13, 56
    previous = []
    bottom = model.point((0, -0.93, 0), (0.26, 0.30, 0.075))
    for i in range(1, rings):
        lat = i * math.pi / rings - math.pi / 2
        radius = math.cos(lat) ** 0.86
        h = math.sin(lat)
        ring = []
        for j in range(sides):
            angle = TAU * j / sides
            # Warp the stripe edges while keeping a clean, soft rind silhouette.
            w = math.cos(lat) * (0.031 * math.sin(8 * lat + angle * 3) + 0.027 * math.sin(17 * lat + angle * 5))
            a = angle + w
            pos = Vector((math.cos(a) * radius, 0.96 * h, math.sin(a) * radius))
            stripe = (0.01, 0.04, 0.84, 0.99, 0.83, 0.68, 0.24)[j % 7]
            blemish = 0.023 * math.sin(5 * angle + 8 * lat) + 0.011 * math.cos(7 * angle - 12 * lat)
            warm = max(0, (-0.65 - h) * 2) * (0.5 + 0.5 * math.cos(a - 1))
            rgb = (
                0.025 + 0.17 * stripe + 0.13 * warm + blemish,
                0.119 + 0.24 * stripe + 0.07 * warm + blemish,
                0.058 + 0.064 * stripe - 0.022 * warm,
            )
            ring.append(model.point(pos, rgb))
        for j, a in enumerate(ring):
            b = ring[(j + 1) % sides]
            if previous:
                c, d = previous[j], previous[(j + 1) % sides]
                model.face(a, b, c, model.points[a])
                model.face(c, b, d, model.points[b])
            else:
                model.face(a, b, bottom, model.points[a])
        previous = ring
    top = model.point((0, 0.95, 0), (0.16, 0.25, 0.095))
    for j, a in enumerate(previous):
        model.face(a, previous[(j + 1) % sides], top, model.points[a])
    model.stalk(
        [(0, 0.93, 0), (0.025, 1.04, 0), (0.12, 1.13, 0.03), (0.18, 1.14, 0.10)], 0.055, (0.22, 0.29, 0.079), 6
    )
    for j in range(5):
        a = TAU * j / 5
        model.leaf(
            (0, 0.962, 0), (math.cos(a), -0.17, math.sin(a)), (0, 1, 0), 0.23, 0.06, (0.15, 0.249, 0.057)
        )
    model.finish("Melon", 2)


def runner():
    model = Mesh(371)
    # A complete runner, with connected petioles and a blossom, repeated along each bed.
    line = []
    for i in range(11):
        z = -0.50 + 0.10 * i
        line.append(Vector((0.09 * math.sin(z * 9), 0.025 + 0.009 * math.cos(z * 10), z)))
    model.stalk(line, 0.014, (0.095, 0.19, 0.054))
    for i in range(1, 10):
        sign = 1 if i % 2 else -1
        petiole = line[i] + Vector((sign * 0.070, 0.037, 0.022))
        model.stalk([line[i], petiole], 0.009, (0.12, 0.22, 0.069), 4)
        pigment = shade((0.134, 0.287, 0.12), model.rng.uniform(0.78, 1.2))
        model.leaf(
            petiole,
            (sign, 0.17, model.rng.uniform(-0.52, 0.52)),
            (0, 1, 0),
            model.rng.uniform(0.15, 0.24),
            model.rng.uniform(0.067, 0.09),
            pigment,
            True,
        )
    tip = line[8] + Vector((0.045, 0.06, 0.03))
    for j in range(5):
        a = TAU * j / 5
        model.leaf(tip, (math.cos(a), 0.46, math.sin(a)), (0, 1, 0), 0.046, 0.026, (0.92, 0.61, 0.115))
    model.finish("Runner", 4)


NAMES = ("Crown", "Shrub", "Melon", "Runner")


def pack(fmt, values):
    return base64.b64encode(struct.pack("<" + str(len(values)) + fmt, *values)).decode("ascii")


def web_export():
    library = {}
    for name in NAMES:
        mesh = bpy.data.objects[name].data
        mesh.calc_loop_triangles()
        positions = [
            round(value * 4096) for vert in mesh.vertices for value in (vert.co.x, vert.co.z, -vert.co.y)
        ]
        color_scale = 1.10 if name == "Crown" else 1.0
        colors = [
            round(min(1, max(0, value / color_scale)) * 255)
            for entry in mesh.color_attributes["Pigment"].data
            for value in entry.color[:3]
        ]
        indices = [index for triangle in mesh.loop_triangles for index in triangle.vertices]
        library[name] = {
            "positions": pack("h", positions),
            "colors": pack("B", colors),
            "indices": pack("H", indices),
        }
        if color_scale != 1.0:
            library[name]["colorScale"] = color_scale
        print(f"{name}: {len(mesh.vertices)} vertices / {len(indices)//3} triangles")
    dest = DIR.parent / "assets" / "coastal-botany.js"
    dest.write_text(
        "// Baked from art/coastal-botany.blend by model_botany.py.\nexport default "
        + json.dumps(library, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


if "--export-only" not in sys.argv:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = bpy.data.materials.new("Botany paint")
    mat.use_nodes = True
    attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Pigment"
    surface = mat.node_tree.nodes.get("Principled BSDF")
    instance = mat.node_tree.nodes.new("ShaderNodeObjectInfo")
    multiply = mat.node_tree.nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1
    mat.node_tree.links.new(attr.outputs["Color"], multiply.inputs[1])
    mat.node_tree.links.new(instance.outputs["Color"], multiply.inputs[2])
    mat.node_tree.links.new(multiply.outputs["Color"], surface.inputs["Base Color"])
    surface.inputs["Roughness"].default_value = 0.77
    canopy()
    shrub()
    watermelon()
    runner()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(DIR / "coastal-botany.blend"), compress=True)
web_export()
