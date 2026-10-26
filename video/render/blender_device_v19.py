"""Build and validate the v19 phone shells with Blender's native bevel modifier.

/usr/bin/blender --background --factory-startup --python-exit-code 1 \
    --python video/render/blender_device_v19.py
"""

import argparse
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


OUTLINE_SEGMENTS = 48
BEVEL_SEGMENTS = 12
SHELLS = (
    ("chassis", (0.70, 1.52, 0.078, 0.098)),
    ("cover-glass", (0.697, 1.517, 0.002, 0.0965)),
    ("back-panel", (0.691, 1.511, 0.004, 0.0935)),
    ("camera-island", (0.184, 0.132, 0.012, 0.033)),
)


def rounded_outline(width, height, radius):
    points = []
    for center_x, center_y, start in (
        (width / 2 - radius, -height / 2 + radius, -math.pi / 2),
        (width / 2 - radius, height / 2 - radius, 0),
        (-width / 2 + radius, height / 2 - radius, math.pi / 2),
        (-width / 2 + radius, -height / 2 + radius, math.pi),
    ):
        for step in range(OUTLINE_SEGMENTS + 1):
            angle = start + step / OUTLINE_SEGMENTS * math.pi / 2
            points.append((center_x + math.cos(angle) * radius, center_y + math.sin(angle) * radius))
    return points


def surface_normal(position, dimensions, bevel_width):
    width, height, depth, radius = dimensions
    if abs(abs(position.z) - depth / 2) < 1e-8:
        return Vector((0, 0, math.copysign(1, position.z)))
    outward = Vector((
        math.copysign(max(abs(position.x) - width / 2 + radius, 0), position.x),
        math.copysign(max(abs(position.y) - height / 2 + radius, 0), position.y),
        0,
    ))
    inset = radius - outward.length
    outward.normalize()
    if abs(position.z) <= depth / 2 - bevel_width + 1e-8:
        return outward
    normal = outward * max(0, bevel_width - inset)
    normal.z = math.copysign(abs(position.z) - depth / 2 + bevel_width, position.z)
    return normal.normalized()


def build_shell(name, dimensions):
    width, height, depth, radius = dimensions
    outline = rounded_outline(width, height, radius)
    count = len(outline)
    vertices = [(point_x, point_y, level) for level in (-depth / 2, depth / 2) for point_x, point_y in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, following + count, index + count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    shell = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(shell)
    bpy.context.view_layer.objects.active = shell
    shell.select_set(True)
    bevel = shell.modifiers.new("Continuous machined edge", "BEVEL")
    bevel.width = min(0.0052, depth * 0.24)
    bevel.segments = BEVEL_SEGMENTS
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = 0.5
    bevel.affect = "EDGES"
    bevel.profile = 0.5
    bevel.harden_normals = True
    bevel.use_clamp_overlap = True
    bevel_width = bevel.width
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    shell.select_set(False)
    mesh = shell.data
    normals = [surface_normal(vertex.co, dimensions, bevel_width) for vertex in mesh.vertices]
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh.normals_split_custom_set_from_vertices(normals)
    mesh.update()
    mesh.calc_loop_triangles()
    return mesh, bevel_width, normals


def validate_mesh(mesh, dimensions):
    bounds = [[min(vertex.co[axis] for vertex in mesh.vertices), max(vertex.co[axis] for vertex in mesh.vertices)] for axis in range(3)]
    measured = [maximum - minimum for minimum, maximum in bounds]
    assert all(abs(actual - expected) < 2e-7 for actual, expected in zip(measured, dimensions[:3])), (mesh.name, measured)
    assert all(abs(minimum + maximum) < 2e-7 for minimum, maximum in bounds), mesh.name
    topology = bmesh.new()
    topology.from_mesh(mesh)
    boundary_edges = sum(edge.is_boundary for edge in topology.edges)
    nonmanifold_edges = sum(not edge.is_manifold for edge in topology.edges)
    volume = topology.calc_volume(signed=True)
    topology.free()
    assert boundary_edges == nonmanifold_edges == 0, mesh.name
    assert volume > 0, mesh.name
    maximum_unit_error = 0.0
    maximum_cap_error = 0.0
    maximum_seam_error = 0.0
    minimum_alignment = 1.0
    vertex_normals = {}
    for triangle in mesh.loop_triangles:
        corners = [mesh.vertices[index].co for index in triangle.vertices]
        cross = (corners[1] - corners[0]).cross(corners[2] - corners[0])
        assert cross.length > 1e-12, (mesh.name, "degenerate triangle")
        face_normal = cross.normalized()
        for loop_index in triangle.loops:
            normal = mesh.corner_normals[loop_index].vector
            assert all(math.isfinite(component) for component in normal), mesh.name
            maximum_unit_error = max(maximum_unit_error, abs(normal.length - 1))
            minimum_alignment = min(minimum_alignment, face_normal.dot(normal))
            vertex_index = mesh.loops[loop_index].vertex_index
            if vertex_index in vertex_normals:
                maximum_seam_error = max(maximum_seam_error, (normal - vertex_normals[vertex_index]).length)
            else:
                vertex_normals[vertex_index] = normal.copy()
            position = mesh.vertices[vertex_index].co
            if abs(abs(position.z) - dimensions[2] / 2) < 1e-8:
                expected = Vector((0, 0, math.copysign(1, position.z)))
                maximum_cap_error = max(maximum_cap_error, (normal - expected).length)
    assert maximum_unit_error < 2e-6, (mesh.name, maximum_unit_error)
    assert maximum_cap_error < 0.002, (mesh.name, maximum_cap_error)
    assert maximum_seam_error < 0.00025, (mesh.name, maximum_seam_error)
    assert minimum_alignment > 0.98, (mesh.name, minimum_alignment)
    return {
        "bounds": bounds,
        "measuredDimensions": measured,
        "boundaryEdges": boundary_edges,
        "nonmanifoldEdges": nonmanifold_edges,
        "degenerateTriangles": 0,
        "signedVolume": volume,
        "maxUnitNormalError": maximum_unit_error,
        "maxCapNormalError": maximum_cap_error,
        "maxSeamNormalError": maximum_seam_error,
        "minTriangleNormalDot": minimum_alignment,
    }


def export_geometry(name, dimensions):
    mesh, bevel_width, authored_normals = build_shell(name, dimensions)
    validation = validate_mesh(mesh, dimensions)
    positions = []
    normals = []
    indices = []
    lookup = {}
    for triangle in mesh.loop_triangles:
        for loop_index in triangle.loops:
            vertex_index = mesh.loops[loop_index].vertex_index
            position = mesh.vertices[vertex_index].co
            normal = authored_normals[vertex_index]
            key = tuple(round(component, 9) for component in position) + tuple(round(component, 8) for component in normal)
            if key not in lookup:
                lookup[key] = len(positions) // 3
                positions.extend(key[:3])
                normals.extend(key[3:])
            indices.append(lookup[key])
    validation["vertexCount"] = len(positions) // 3
    validation["triangleCount"] = len(indices) // 3
    print(f"DEVICE_VALIDATED {name} {json.dumps(validation, separators=(',', ':'))}")
    return {
        "name": name,
        "dimensions": list(dimensions),
        "bevelWidth": bevel_width,
        "bevelSegments": BEVEL_SEGMENTS,
        "outlineSegmentsPerCorner": OUTLINE_SEGMENTS,
        "normalMethod": "Custom rounded-rectangle bevel tangents; planar caps",
        "positions": positions,
        "normals": normals,
        "indices": indices,
        "validation": validation,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "quality/v19/assets/device-geometry-v19.json")
    arguments = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    document = {
        "version": 19,
        "generator": f"Blender {bpy.app.version_string}",
        "coordinateSystem": "X-right,Y-up,Z-front",
        "geometries": [export_geometry(name, dimensions) for name, dimensions in SHELLS],
    }
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(document, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(f"DEVICE_ASSET {arguments.output} {arguments.output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
