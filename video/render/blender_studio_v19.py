import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
PALETTES = [
    ('depth', (0.030, 0.052, 0.080), (0.58, 0.75, 0.91)),
    ('system', (0.037, 0.044, 0.092), (0.60, 0.67, 0.96)),
    ('compiler', (0.041, 0.073, 0.065), (0.65, 0.87, 0.79)),
    ('family', (0.074, 0.062, 0.047), (1.00, 0.86, 0.68)),
    ('precision', (0.025, 0.065, 0.077), (0.58, 0.86, 0.91)),
    ('evidence', (0.025, 0.039, 0.077), (0.65, 0.79, 0.98)),
    ('method', (0.056, 0.073, 0.045), (0.85, 0.91, 0.70)),
    ('lab', (0.044, 0.055, 0.079), (0.71, 0.80, 0.94)),
    ('adoption', (0.029, 0.079, 0.059), (0.70, 0.94, 0.81)),
    ('human', (0.026, 0.046, 0.074), (0.62, 0.77, 0.95)),
]


def material(name, color, roughness=0.48, metalness=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    principled = result.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (*color, 1)
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Metallic'].default_value = metalness
    return result


def box(name, location, dimensions, surface, radius=0.12, rotation=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    result = bpy.context.object
    result.name = name
    result.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    result.rotation_euler[2] = rotation
    result.data.materials.append(surface)
    bevel = result.modifiers.new('Precision radiused arris', 'BEVEL')
    bevel.width = min(radius, min(dimensions) * 0.45)
    bevel.segments = 8
    normals = result.modifiers.new('Broad planar normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    return result


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, position, target, power, color, size, size_y=None):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power
    light.color = color
    light.shape = 'RECTANGLE'
    light.size = size
    light.size_y = size_y or size
    result = bpy.data.objects.new(name, light)
    bpy.context.collection.objects.link(result)
    result.location = position
    aim(result, target)
    return result


def reset(samples):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.cycles.seed = 20261023
    scene.cycles.use_animated_seed = False
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'OPTIX'
    preferences.get_devices()
    for device in preferences.devices:
        device.use = device.type == 'OPTIX'
    if not any(device.use for device in preferences.devices):
        raise RuntimeError('No OptiX device is available for the quality bake')
    scene.cycles.device = 'GPU'
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (0.25, 0.32, 0.40, 1)
    background.inputs['Strength'].default_value = 0.075
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = -0.55
    scene.view_settings.gamma = 1
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '16'
    scene.render.resolution_percentage = 100
    return scene


def background_plate(index, destination, scale, samples):
    started = time.monotonic()
    name, color, light_color = PALETTES[index]
    scene = reset(samples)
    scene.render.resolution_x = round(3840 * scale)
    scene.render.resolution_y = round(2160 * scale)
    wall = material('Pigmented mineral / broad diffuse', color, 0.64)
    edge = material('Satin ceramic / rolled edge', tuple(value * 1.28 for value in color), 0.37, 0.08)
    floor = material('Honed graphite / grazing reflection', tuple(value * 0.62 for value in color), 0.40, 0.12)
    box('Unbroken rear wall', (0, 6.5, 3.8), (34, 0.8, 19), wall, 0.28)
    box('Quiet foreground plinth', (0, 1, -2.9), (34, 28, 0.6), floor, 0.25)
    if name in ['depth', 'human']:
        box('Broad return / left', (-10.8, 4.0, 2.2), (8, 2, 15), edge, 0.5, -0.15)
        box('Recess / right', (11.0, 5.3, 1.8), (7, 1, 14), wall, 0.4, 0.1)
    elif name == 'system':
        for side in [-1, 1]:
            for index in range(3):
                box(f'Quiet architectural fin {side} {index}', (side * (7.0 + index * 1.05), 2.4 + index * 1.3, 2.4),
                    (0.26, 3.4, 13), edge, 0.11, side * -0.12)
    elif name == 'compiler':
        for index in range(4):
            box(f'Information strata {index}', (-2.2 + index * 1.6, 3.8 - index * 0.45, -2.2 + index * 0.11),
                (25 - index * 2, 5.8, 0.16), edge, 0.065, -0.035)
    elif name == 'family':
        for side in [-1, 1]:
            box(f'Paired light return {side}', (side * 8.6, 4.7, 3.0), (5, 1.4, 14), edge, 0.38, side * 0.11)
        area('Second warm window', (7, 0, 5), (3, 6, 2), 490, (1, 0.89, 0.77), 4, 7)
    elif name == 'precision':
        for side in [-1, 1]:
            box(f'Observation aperture {side}', (side * 8.3, 3.7, 2.5), (4.2, 1.4, 13), edge, 0.3, side * 0.045)
        box('Aperture lintel', (0, 4.4, 8.3), (17, 1.1, 0.35), edge, 0.14)
    elif name == 'evidence':
        box('Local evidence reveal', (-8.0, 5.3, 2.6), (8.5, 1.8, 14), edge, 0.32, 0.09)
        box('Independent review reveal', (8.0, 5.0, 2.6), (8.5, 1.8, 14), edge, 0.32, -0.09)
        area('Independent soft well', (7, 1, 5), (4, 6, 1), 440, (0.63, 0.87, 0.88), 3, 8)
    elif name == 'method':
        for index in range(3):
            box(f'Folded method plane {index}', (-1.5 + index * 3.0, 4.3 - index * 0.3, -2.1 + index * 0.16),
                (27 - index * 3, 4.8, 0.20), edge, 0.08, -0.055 + index * 0.035)
    elif name == 'lab':
        for index in range(4):
            box(f'Independent validation terrace {index}', (-8.5 + index * 5.6, 4.6 + index * 0.15, -2.1 + index * 0.18),
                (5.4, 4.8, 0.22), edge, 0.085, 0.025)
    elif name == 'adoption':
        box('Open chamber / left', (-9.8, 4.2, 2.3), (6.2, 1.8, 14), edge, 0.4, -0.12)
        box('Receding return / right', (10.0, 5.8, 2.6), (5, 0.8, 14), wall, 0.3, 0.16)
    area('Key / broad silk', (-6.5, -2.0, 8.2), (-2, 5, 1.3), 1250, light_color, 8, 5)
    area('Rim / strip bounce', (8.8, 2.0, 6.4), (2, 6, 1.0), 850, tuple(min(1, value * 0.92 + 0.06) for value in light_color), 3, 8)
    area('Ceiling / negative space', (-0.8, 0.8, 10), (0, 5.5, 2), 580, (0.80, 0.88, 0.94), 10, 4)
    bpy.ops.object.camera_add(location=(0, -16.0, 3.6))
    camera = bpy.context.object
    camera.name = 'Quiet architectural plate camera'
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 24
    aim(camera, (0, 5.0, 2.25))
    scene.camera = camera
    scene.render.filepath = str(destination / f'plate-{name}-4k.png')
    bpy.ops.render.render(write_still=True)
    return {'name': name, 'file': Path(scene.render.filepath).name, 'render_seconds': round(time.monotonic() - started, 2)}


def environment_map(destination, samples):
    scene = reset(samples)
    scene.view_settings.exposure = 0
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 1024
    scene.render.image_settings.file_format = 'HDR'
    scene.render.image_settings.color_mode = 'RGB'
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.12
    shell = material('Neutral dark studio enclosure', (0.12, 0.16, 0.18), 0.64)
    box('Large studio wall', (0, 9, 1), (28, 0.5, 22), shell, 0.2)
    box('Studio floor', (0, 0, -5), (28, 28, 0.5), shell, 0.2)
    for name, location, dimensions, color, strength in [
        ('Key silk', (-5, -2, 5), (3.6, 0.04, 6.5), (0.86, 0.93, 1), 3.1),
        ('Rim silk', (5, 1.0, 2), (1.2, 0.04, 7.8), (0.69, 0.83, 0.88), 2.4),
        ('Top silk', (0.8, 0.0, 6), (5, 0.04, 3), (1, 0.96, 0.87), 1.9),
    ]:
        surface = material(name, color, 0.5)
        principled = surface.node_tree.nodes.get('Principled BSDF')
        principled.inputs['Emission Color'].default_value = (*color, 1)
        principled.inputs['Emission Strength'].default_value = strength
        panel = box(name, location, dimensions, surface, 0.015)
        panel.rotation_euler = (Vector((0, 0, 0)) - panel.location).to_track_quat('-Y', 'Z').to_euler()
    bpy.ops.object.camera_add(location=(0, 0, 0))
    camera = bpy.context.object
    camera.data.type = 'PANO'
    camera.data.panorama_type = 'EQUIRECTANGULAR'
    camera.rotation_euler = (math.pi / 2, 0, 0)
    scene.camera = camera
    scene.render.filepath = str(destination / 'studio-reflections.hdr')
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(ROOT / 'quality/v19/assets'))
    parser.add_argument('--scale', type=float, default=1)
    parser.add_argument('--samples', type=int, default=48)
    parser.add_argument('--only', default='all')
    arguments = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    destination = Path(arguments.output).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    for index, (name, color, light) in enumerate(PALETTES):
        if arguments.only != 'all' and name != arguments.only:
            continue
        records.append(background_plate(index, destination, arguments.scale, arguments.samples))
    if arguments.only in ['all', 'environment']:
        environment_map(destination, arguments.samples)
    files = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in destination.glob('*.png')}
    hdr = destination / 'studio-reflections.hdr'
    if hdr.exists():
        files[hdr.name] = hashlib.sha256(hdr.read_bytes()).hexdigest()
    report = {'blender': bpy.app.version_string, 'engine': 'Cycles', 'device': 'OPTIX', 'samples': arguments.samples,
              'native_plate_resolution': [round(3840 * arguments.scale), round(2160 * arguments.scale)],
              'palette': [entry[0] for entry in PALETTES], 'plates': records, 'asset_sha256': files,
              'purpose': 'Original physically lit architectural backplates and HDR reflection environment; no stock assets'}
    (destination / 'studio-provenance.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    bpy.ops.wm.save_as_mainfile(filepath=str(destination / 'studio-lighting.blend'))
    print('QUALITY_STUDIO_COMPLETE', json.dumps(report))


if __name__ == '__main__':
    main()
