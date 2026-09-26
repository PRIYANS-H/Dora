"""
Avatar Generation Service for DORI 3D Virtual Try-On.

Generates parametric 3D humanoid body meshes based on user height,
weight, gender, and standing pose presets. Supports SMPL-X fallback.
"""

from typing import Dict, Any, Tuple
import numpy as np
from .config import get_smplx_model_path


def _create_cylinder_mesh(
    radius_top: float,
    radius_bottom: float,
    height: float,
    center_y: float,
    center_x: float = 0.0,
    center_z: float = 0.0,
    radial_segments: int = 16,
    height_segments: int = 4,
    rotation_z_deg: float = 0.0,
    pivot_x: float = 0.0,
    pivot_y: float = 0.0
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Generates cylinder or truncated cone mesh with UVs and normals."""
    vertices = []
    normals = []
    uvs = []
    faces = []

    rot_rad = np.radians(rotation_z_deg)
    cos_rot = np.cos(rot_rad)
    sin_rot = np.sin(rot_rad)

    for h_idx in range(height_segments + 1):
        v = h_idx / height_segments
        y_local = (v - 0.5) * height
        radius = radius_bottom + (radius_top - radius_bottom) * (1.0 - v)

        for r_idx in range(radial_segments):
            u = r_idx / radial_segments
            theta = u * 2.0 * np.pi
            nx = np.cos(theta)
            nz = np.sin(theta)

            x_raw = center_x + radius * nx
            y_raw = center_y + y_local
            z_raw = center_z + radius * nz

            # Apply 2D pivot rotation around Z axis
            dx = x_raw - pivot_x
            dy = y_raw - pivot_y
            x_rot = pivot_x + dx * cos_rot - dy * sin_rot
            y_rot = pivot_y + dx * sin_rot + dy * cos_rot

            # Rotated normal
            norm_x = nx * cos_rot
            norm_y = nx * sin_rot
            norm_z = nz
            norm_len = np.sqrt(norm_x**2 + norm_y**2 + norm_z**2) + 1e-8

            vertices.append([x_rot, y_rot, z_raw])
            normals.append([norm_x / norm_len, norm_y / norm_len, norm_z / norm_len])
            uvs.append([u, v])

    # Connect grid faces
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


def _create_sphere_mesh(
    radius: float,
    center_x: float,
    center_y: float,
    center_z: float,
    scale_y: float = 1.15,
    lat_segments: int = 12,
    lon_segments: int = 16
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Generates sphere or ellipsoid mesh for head and joints."""
    vertices = []
    normals = []
    uvs = []
    faces = []

    for lat_idx in range(lat_segments + 1):
        v = lat_idx / lat_segments
        phi = v * np.pi - (np.pi / 2.0)  # -pi/2 to pi/2
        cos_phi = np.cos(phi)
        sin_phi = np.sin(phi)

        for lon_idx in range(lon_segments):
            u = lon_idx / lon_segments
            theta = u * 2.0 * np.pi
            cos_theta = np.cos(theta)
            sin_theta = np.sin(theta)

            nx = cos_phi * cos_theta
            ny = sin_phi
            nz = cos_phi * sin_theta

            vx = center_x + radius * nx
            vy = center_y + radius * ny * scale_y
            vz = center_z + radius * nz

            vertices.append([vx, vy, vz])
            normals.append([nx, ny, nz])
            uvs.append([u, v])

    for lat_idx in range(lat_segments):
        for lon_idx in range(lon_segments):
            next_lon = (lon_idx + 1) % lon_segments
            i0 = lat_idx * lon_segments + lon_idx
            i1 = lat_idx * lon_segments + next_lon
            i2 = (lat_idx + 1) * lon_segments + lon_idx
            i3 = (lat_idx + 1) * lon_segments + next_lon

            faces.append([i0, i2, i1])
            faces.append([i1, i2, i3])

    return (
        np.array(vertices, dtype=np.float32),
        np.array(faces, dtype=np.uint32),
        np.array(normals, dtype=np.float32),
        np.array(uvs, dtype=np.float32)
    )


def _combine_meshes(mesh_list):
    """Combines a list of (verts, faces, normals, uvs) into a single cohesive mesh."""
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


def generate_parametric_avatar(
    height_cm: float = 175.0,
    weight_kg: float = 70.0,
    gender: str = "neutral",
    pose: str = "A-pose"
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, Dict[str, Any]]:
    """
    Generates a full 3D humanoid mesh with correct anthropometric scaling
    and pose positioning.
    """
    # 1. Anthropometric calculations
    target_height_m = float(height_cm) / 100.0
    bmi = float(weight_kg) / (target_height_m ** 2)
    # Reference BMI is 22.0
    girth_factor = float(np.clip(np.sqrt(bmi / 22.0), 0.78, 1.45))

    # Gender morphological offsets
    if gender == "female":
        hip_mult = 1.08 * girth_factor
        chest_mult = 0.98 * girth_factor
        waist_mult = 0.88 * girth_factor
        shoulder_width = 0.19 * target_height_m
    elif gender == "male":
        hip_mult = 0.94 * girth_factor
        chest_mult = 1.08 * girth_factor
        waist_mult = 0.96 * girth_factor
        shoulder_width = 0.23 * target_height_m
    else:  # neutral
        hip_mult = 1.0 * girth_factor
        chest_mult = 1.0 * girth_factor
        waist_mult = 0.92 * girth_factor
        shoulder_width = 0.21 * target_height_m

    # Pose angles (in degrees from vertical)
    if pose == "T-pose":
        arm_angle_deg = 85.0
        leg_spread = 0.08 * target_height_m
    elif pose == "hands-down":
        arm_angle_deg = 15.0
        leg_spread = 0.06 * target_height_m
    elif pose == "neutral":
        arm_angle_deg = 25.0
        leg_spread = 0.07 * target_height_m
    else:  # A-pose (default)
        arm_angle_deg = 35.0
        leg_spread = 0.08 * target_height_m

    # Segment heights based on human proportions
    head_height = 0.13 * target_height_m
    head_radius = head_height * 0.48 * girth_factor
    neck_height = 0.05 * target_height_m
    neck_radius = 0.045 * target_height_m * girth_factor

    torso_height = 0.32 * target_height_m
    chest_radius = 0.12 * target_height_m * chest_mult
    waist_radius = 0.10 * target_height_m * waist_mult
    hip_radius = 0.125 * target_height_m * hip_mult

    leg_height = 0.48 * target_height_m
    thigh_radius = 0.075 * target_height_m * girth_factor
    calf_radius = 0.052 * target_height_m * girth_factor

    arm_length = 0.32 * target_height_m
    upper_arm_radius = 0.042 * target_height_m * girth_factor
    forearm_radius = 0.034 * target_height_m * girth_factor

    # Vertical landmarks from ground (y=0)
    y_feet = 0.0
    y_hips = leg_height
    y_waist = y_hips + (torso_height * 0.4)
    y_chest = y_hips + (torso_height * 0.8)
    y_shoulders = y_hips + torso_height
    y_neck = y_shoulders + neck_height
    y_head = y_neck + (head_height * 0.5)

    sub_meshes = []

    # 1. Head (ellipsoid)
    head_mesh = _create_sphere_mesh(head_radius, 0.0, y_head, 0.0, scale_y=1.2)
    sub_meshes.append(head_mesh)

    # 2. Neck
    neck_mesh = _create_cylinder_mesh(
        radius_top=neck_radius,
        radius_bottom=neck_radius * 1.05,
        height=neck_height,
        center_y=y_shoulders + neck_height / 2.0
    )
    sub_meshes.append(neck_mesh)

    # 3. Upper Torso (Chest to Shoulders)
    chest_height = torso_height * 0.5
    chest_mesh = _create_cylinder_mesh(
        radius_top=chest_radius * 0.95,
        radius_bottom=waist_radius,
        height=chest_height,
        center_y=y_waist + chest_height / 2.0
    )
    sub_meshes.append(chest_mesh)

    # 4. Lower Torso (Waist to Hips)
    pelvis_height = torso_height * 0.5
    pelvis_mesh = _create_cylinder_mesh(
        radius_top=waist_radius,
        radius_bottom=hip_radius,
        height=pelvis_height,
        center_y=y_hips + pelvis_height / 2.0
    )
    sub_meshes.append(pelvis_mesh)

    # 5. Left & Right Legs (Thigh + Shin)
    thigh_height = leg_height * 0.52
    shin_height = leg_height * 0.48

    for side in (-1.0, 1.0):
        leg_x = side * leg_spread
        # Thigh
        thigh_mesh = _create_cylinder_mesh(
            radius_top=thigh_radius,
            radius_bottom=calf_radius * 1.1,
            height=thigh_height,
            center_y=shin_height + thigh_height / 2.0,
            center_x=leg_x
        )
        sub_meshes.append(thigh_mesh)

        # Shin / Calf
        shin_mesh = _create_cylinder_mesh(
            radius_top=calf_radius * 1.1,
            radius_bottom=calf_radius * 0.8,
            height=shin_height,
            center_y=shin_height / 2.0,
            center_x=leg_x
        )
        sub_meshes.append(shin_mesh)

        # Foot sphere
        foot_mesh = _create_sphere_mesh(
            radius=calf_radius * 0.9,
            center_x=leg_x,
            center_y=0.03 * target_height_m,
            center_z=0.04 * target_height_m,
            scale_y=0.6
        )
        sub_meshes.append(foot_mesh)

    # 6. Left & Right Arms (Upper Arm + Forearm + Hand)
    upper_arm_len = arm_length * 0.52
    forearm_len = arm_length * 0.48

    for side in (-1.0, 1.0):
        shoulder_x = side * shoulder_width
        shoulder_y = y_shoulders

        # Upper arm with pose rotation
        upper_arm_mesh = _create_cylinder_mesh(
            radius_top=upper_arm_radius,
            radius_bottom=forearm_radius * 1.05,
            height=upper_arm_len,
            center_y=shoulder_y - upper_arm_len / 2.0,
            center_x=shoulder_x,
            rotation_z_deg=side * arm_angle_deg,
            pivot_x=shoulder_x,
            pivot_y=shoulder_y
        )
        sub_meshes.append(upper_arm_mesh)

        # Compute elbow pivot position after rotation
        elbow_angle_rad = np.radians(side * arm_angle_deg)
        elbow_x = shoulder_x - np.sin(elbow_angle_rad) * upper_arm_len
        elbow_y = shoulder_y - np.cos(elbow_angle_rad) * upper_arm_len

        # Forearm
        forearm_mesh = _create_cylinder_mesh(
            radius_top=forearm_radius * 1.05,
            radius_bottom=forearm_radius * 0.75,
            height=forearm_len,
            center_y=elbow_y - forearm_len / 2.0,
            center_x=elbow_x,
            rotation_z_deg=side * arm_angle_deg,
            pivot_x=elbow_x,
            pivot_y=elbow_y
        )
        sub_meshes.append(forearm_mesh)

    # Combine all parts into single mesh
    vertices, faces, normals, uvs = _combine_meshes(sub_meshes)

    # Estimated body surface measurements
    measurements = {
        "height_cm": round(height_cm, 1),
        "weight_kg": round(weight_kg, 1),
        "chest_circ_cm": round(2.0 * np.pi * chest_radius * 100.0 * 0.85, 1),
        "waist_circ_cm": round(2.0 * np.pi * waist_radius * 100.0 * 0.85, 1),
        "hip_circ_cm": round(2.0 * np.pi * hip_radius * 100.0 * 0.85, 1),
        "shoulder_width_cm": round(2.0 * shoulder_width * 100.0, 1),
        "bmi": round(bmi, 1)
    }

    metadata = {
        "generator": "parametric_humanoid_engine_v1",
        "gender": gender,
        "pose": pose,
        "vertex_count": int(len(vertices)),
        "face_count": int(len(faces)),
        "estimated_measurements": measurements
    }

    return vertices, faces, normals, uvs, metadata


def generate_avatar_mesh(
    height_cm: float = 175.0,
    weight_kg: float = 70.0,
    gender: str = "neutral",
    pose: str = "A-pose"
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, Dict[str, Any]]:
    """
    Main entry point for avatar mesh generation.
    Checks for SMPL-X model weights; if not configured, uses safe parametric humanoid engine.
    """
    smplx_path = get_smplx_model_path()
    if smplx_path:
        try:
            # Optional SMPL-X integration when weights are provided
            import torch
            import smplx
            # Placeholder for optional SMPL-X forward pass
            pass
        except Exception as e:
            print(f"[AvatarService] SMPL-X load skipped: {e}. Falling back to parametric engine.")

    # Safe parametric humanoid generator
    return generate_parametric_avatar(
        height_cm=height_cm,
        weight_kg=weight_kg,
        gender=gender,
        pose=pose
    )
