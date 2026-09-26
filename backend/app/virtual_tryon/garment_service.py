"""
Garment Generation Service for DORI 3D Virtual Try-On.

Generates 3D garment meshes for: tee, shirt, dress, and jeans
parameterized by chest, waist, hip, length, and sleeve measurements.
"""

from typing import Dict, Any, Tuple, Optional, List
import numpy as np


def hex_to_rgba(hex_color: str) -> List[float]:
    """Converts hex color string (#111111 or #d97706) to RGBA float list [0..1]."""
    hex_color = hex_color.strip().lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    if len(hex_color) != 6:
        return [0.15, 0.15, 0.15, 1.0]
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return [round(r, 4), round(g, 4), round(b, 4), 1.0]


def _create_garment_cylinder(
    r_top: float,
    r_mid: float,
    r_bottom: float,
    y_top: float,
    y_bottom: float,
    center_x: float = 0.0,
    center_z: float = 0.0,
    radial_segments: int = 24,
    height_segments: int = 12,
    rotation_z_deg: float = 0.0,
    pivot_x: float = 0.0,
    pivot_y: float = 0.0
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Creates a 3D garment section with variable radius profile."""
    vertices = []
    normals = []
    uvs = []
    faces = []

    rot_rad = np.radians(rotation_z_deg)
    cos_rot = np.cos(rot_rad)
    sin_rot = np.sin(rot_rad)

    height = y_top - y_bottom

    for h_idx in range(height_segments + 1):
        t = h_idx / height_segments  # 0 at bottom, 1 at top
        y_raw = y_bottom + t * height

        # Interpolate radius profile
        if t < 0.5:
            # bottom to mid
            t_sub = t * 2.0
            radius = r_bottom + (r_mid - r_bottom) * t_sub
        else:
            # mid to top
            t_sub = (t - 0.5) * 2.0
            radius = r_mid + (r_top - r_mid) * t_sub

        for r_idx in range(radial_segments):
            u = r_idx / radial_segments
            theta = u * 2.0 * np.pi
            nx = np.cos(theta)
            nz = np.sin(theta)

            x_raw = center_x + radius * nx
            z_raw = center_z + radius * nz

            # Rotate around pivot if needed
            dx = x_raw - pivot_x
            dy = y_raw - pivot_y
            x_rot = pivot_x + dx * cos_rot - dy * sin_rot
            y_rot = pivot_y + dx * sin_rot + dy * cos_rot

            norm_x = nx * cos_rot
            norm_y = nx * sin_rot
            norm_z = nz
            norm_len = np.sqrt(norm_x**2 + norm_y**2 + norm_z**2) + 1e-8

            vertices.append([x_rot, y_rot, z_raw])
            normals.append([norm_x / norm_len, norm_y / norm_len, norm_z / norm_len])
            uvs.append([u, 1.0 - t])

    # Connect faces
    for h_idx in range(height_segments):
        for r_idx in range(radial_segments):
            next_r = (r_idx + 1) % radial_segments
            i0 = h_idx * radial_segments + r_idx
            i1 = h_idx * radial_segments + next_r
            i2 = (h_idx + 1) * radial_segments + r_idx
            i3 = (h_idx + 1) * radial_segments + next_r

            faces.append([i0, i2, i1])
            faces.append([i1, i2, i3])

    return (
        np.array(vertices, dtype=np.float32),
        np.array(faces, dtype=np.uint32),
        np.array(normals, dtype=np.float32),
        np.array(uvs, dtype=np.float32)
    )


def _combine_garment_meshes(mesh_list):
    """Combines sub-meshes for garment components."""
    all_verts = []
    all_faces = []
    all_normals = []
    all_uvs = []

    vertex_offset = 0
    for verts, faces, normals, uvs in mesh_list:
        all_verts.append(verts)
        all_faces.append(faces + vertex_offset)
        all_normals.append(normals)
        all_uvs.append(uvs)
        vertex_offset += len(verts)

    return (
        np.vstack(all_verts).astype(np.float32),
        np.vstack(all_faces).astype(np.uint32),
        np.vstack(all_normals).astype(np.float32),
        np.vstack(all_uvs).astype(np.float32)
    )


def generate_garment_mesh(
    garment_type: str = "tee",
    garment_color: str = "#111111",
    measurements: Optional[Dict[str, float]] = None,
    avatar_height_cm: float = 175.0,
    avatar_pose: str = "A-pose"
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[float], Dict[str, Any]]:
    """
    Generates 3D garment geometry (tee, shirt, dress, jeans) conforming around
    the avatar body with realistic ease/clearance.
    """
    H = float(avatar_height_cm) / 100.0

    # Default measurements if none provided
    m = measurements or {}
    chest_cm = float(m.get("chest", 96.0))
    waist_cm = float(m.get("waist", 82.0))
    hip_cm = float(m.get("hip", 98.0))
    length_cm = float(m.get("length", 68.0))
    sleeve_cm = float(m.get("sleeve", 22.0))
    rise_cm = float(m.get("rise", 28.0))

    # Convert circumference to radius in meters with clearance (+1.5cm clearance)
    ease_offset = 0.018  # 1.8 cm outward clearance from avatar skin
    r_chest = (chest_cm / (2.0 * np.pi * 100.0)) + ease_offset
    r_waist = (waist_cm / (2.0 * np.pi * 100.0)) + ease_offset
    r_hip = (hip_cm / (2.0 * np.pi * 100.0)) + ease_offset

    # Reference body landmarks
    leg_height = 0.48 * H
    torso_height = 0.32 * H
    y_hips = leg_height
    y_waist = y_hips + (torso_height * 0.4)
    y_shoulders = y_hips + torso_height

    # Arm angle matching avatar pose
    if avatar_pose == "T-pose":
        arm_angle_deg = 85.0
    elif avatar_pose == "hands-down":
        arm_angle_deg = 15.0
    elif avatar_pose == "neutral":
        arm_angle_deg = 25.0
    else:  # A-pose
        arm_angle_deg = 35.0

    shoulder_width = 0.21 * H

    sub_meshes = []
    color_rgba = hex_to_rgba(garment_color)

    if garment_type in ("tee", "shirt"):
        # 1. Torso shell
        garment_len_m = min(length_cm / 100.0, torso_height + 0.12 * H)
        y_top = y_shoulders - (0.02 * H)
        y_bottom = max(y_hips - 0.05 * H, y_top - garment_len_m)

        torso_garment = _create_garment_cylinder(
            r_top=r_chest * 0.98,
            r_mid=r_waist,
            r_bottom=r_hip * 1.02,
            y_top=y_top,
            y_bottom=y_bottom,
            radial_segments=28,
            height_segments=14
        )
        sub_meshes.append(torso_garment)

        # 2. Left & Right Sleeves
        sleeve_len_m = max(0.12 * H, (sleeve_cm / 100.0))
        if garment_type == "shirt":
            sleeve_len_m = max(sleeve_len_m, 0.28 * H)  # Longer sleeves for dress shirt

        sleeve_radius = 0.055 * H

        for side in (-1.0, 1.0):
            sh_x = side * shoulder_width
            sh_y = y_shoulders - (0.02 * H)

            sleeve_mesh = _create_garment_cylinder(
                r_top=sleeve_radius * 1.08,
                r_mid=sleeve_radius,
                r_bottom=sleeve_radius * 0.92,
                y_top=sh_y,
                y_bottom=sh_y - sleeve_len_m,
                center_x=sh_x,
                radial_segments=16,
                height_segments=8,
                rotation_z_deg=side * arm_angle_deg,
                pivot_x=sh_x,
                pivot_y=sh_y
            )
            sub_meshes.append(sleeve_mesh)

    elif garment_type == "dress":
        # Bodice + Flared Skirt
        dress_len_m = max(0.70 * H, (length_cm / 100.0))
        y_top = y_shoulders - (0.02 * H)
        y_bottom = max(0.15 * H, y_top - dress_len_m)

        # Flare skirt at bottom
        r_flare = r_hip * 1.45

        dress_mesh = _create_garment_cylinder(
            r_top=r_chest * 0.96,
            r_mid=r_waist * 0.95,
            r_bottom=r_flare,
            y_top=y_top,
            y_bottom=y_bottom,
            radial_segments=32,
            height_segments=18
        )
        sub_meshes.append(dress_mesh)

        # Cap sleeves for dress
        sleeve_len_m = 0.08 * H
        sleeve_radius = 0.052 * H
        for side in (-1.0, 1.0):
            sh_x = side * shoulder_width
            sh_y = y_shoulders - (0.02 * H)
            sleeve_mesh = _create_garment_cylinder(
                r_top=sleeve_radius * 1.05,
                r_mid=sleeve_radius,
                r_bottom=sleeve_radius * 0.9,
                y_top=sh_y,
                y_bottom=sh_y - sleeve_len_m,
                center_x=sh_x,
                radial_segments=16,
                height_segments=6,
                rotation_z_deg=side * arm_angle_deg,
                pivot_x=sh_x,
                pivot_y=sh_y
            )
            sub_meshes.append(sleeve_mesh)

    elif garment_type == "jeans":
        # Waistband + 2 Pant Legs
        y_waistband = y_waist + 0.02 * H
        y_crotch = y_hips - 0.02 * H
        y_ankle = 0.06 * H

        # 1. Waistband & Pelvis shell
        pelvis_shell = _create_garment_cylinder(
            r_top=r_waist * 1.02,
            r_mid=r_hip * 1.02,
            r_bottom=r_hip * 1.04,
            y_top=y_waistband,
            y_bottom=y_crotch,
            radial_segments=28,
            height_segments=8
        )
        sub_meshes.append(pelvis_shell)

        # 2. Two pant legs
        leg_spread = 0.08 * H
        r_thigh = 0.082 * H
        r_cuff = 0.062 * H

        for side in (-1.0, 1.0):
            leg_x = side * leg_spread
            pant_leg = _create_garment_cylinder(
                r_top=r_thigh,
                r_mid=(r_thigh + r_cuff) / 2.0,
                r_bottom=r_cuff,
                y_top=y_crotch,
                y_bottom=y_ankle,
                center_x=leg_x,
                radial_segments=18,
                height_segments=14
            )
            sub_meshes.append(pant_leg)

    vertices, faces, normals, uvs = _combine_garment_meshes(sub_meshes)

    metadata = {
        "garment_type": garment_type,
        "garment_color": garment_color,
        "color_rgba": color_rgba,
        "vertex_count": int(len(vertices)),
        "face_count": int(len(faces)),
        "applied_measurements": {
            "chest_cm": chest_cm,
            "waist_cm": waist_cm,
            "hip_cm": hip_cm,
            "length_cm": length_cm,
            "sleeve_cm": sleeve_cm,
            "rise_cm": rise_cm
        }
    }

    return vertices, faces, normals, uvs, color_rgba, metadata
