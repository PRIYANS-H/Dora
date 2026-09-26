"""
Binary glTF (GLB) Generation Service for DORI 3D Virtual Try-On.

Pure Python & NumPy implementation producing 100% compliant glTF 2.0 binary (.glb)
files containing humanoid avatar meshes, garment meshes, PBR materials, and scene nodes.
"""

from typing import Dict, Any, List, Tuple
import struct
import json
from pathlib import Path
import numpy as np


class GLBBuilder:
    """Constructs a compliant binary glTF 2.0 (.glb) container."""

    def __init__(self):
        self.bin_buffer = bytearray()
        self.buffer_views: List[Dict[str, Any]] = []
        self.accessors: List[Dict[str, Any]] = []
        self.materials: List[Dict[str, Any]] = []
        self.meshes: List[Dict[str, Any]] = []
        self.nodes: List[Dict[str, Any]] = []

    def _pad_buffer_4bytes(self):
        """Pad binary buffer to 4-byte alignment boundary."""
        remainder = len(self.bin_buffer) % 4
        if remainder != 0:
            self.bin_buffer.extend(b"\x00" * (4 - remainder))

    def add_buffer_view(self, data_bytes: bytes, target: int = 34962) -> int:
        """Adds a buffer view slice to the bin buffer and returns its index."""
        self._pad_buffer_4bytes()
        byte_offset = len(self.bin_buffer)
        byte_length = len(data_bytes)
        self.bin_buffer.extend(data_bytes)

        bv_index = len(self.buffer_views)
        self.buffer_views.append({
            "buffer": 0,
            "byteOffset": byte_offset,
            "byteLength": byte_length,
            "target": target
        })
        return bv_index

    def add_accessor(
        self,
        buffer_view_idx: int,
        component_type: int,
        count: int,
        accessor_type: str,
        min_vals: List[float] = None,
        max_vals: List[float] = None
    ) -> int:
        """Adds an accessor describing structured binary data."""
        acc_index = len(self.accessors)
        acc_dict: Dict[str, Any] = {
            "bufferView": buffer_view_idx,
            "byteOffset": 0,
            "componentType": component_type,
            "count": count,
            "type": accessor_type
        }
        if min_vals is not None:
            acc_dict["min"] = min_vals
        if max_vals is not None:
            acc_dict["max"] = max_vals
        self.accessors.append(acc_dict)
        return acc_index

    def add_material(self, name: str, base_color_rgba: List[float], roughness: float = 0.7, metallic: float = 0.1) -> int:
        """Adds a PBR Metallic-Roughness material definition."""
        mat_index = len(self.materials)
        self.materials.append({
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": [float(c) for c in base_color_rgba],
                "roughnessFactor": float(roughness),
                "metallicFactor": float(metallic)
            },
            "doubleSided": True
        })
        return mat_index

    def add_mesh_primitive(
        self,
        name: str,
        vertices: np.ndarray,
        faces: np.ndarray,
        normals: np.ndarray,
        uvs: np.ndarray,
        material_idx: int
    ) -> int:
        """
        Packs vertices, normals, uvs, and faces into binary views and creates a mesh primitive.
        """
        # Ensure correct dtypes
        v_float = np.ascontiguousarray(vertices, dtype=np.float32)
        n_float = np.ascontiguousarray(normals, dtype=np.float32)
        uv_float = np.ascontiguousarray(uvs, dtype=np.float32)

        # 1. POSITION Accessor
        pos_bytes = v_float.tobytes()
        pos_bv = self.add_buffer_view(pos_bytes, target=34962)  # ARRAY_BUFFER
        min_pos = [float(x) for x in np.min(v_float, axis=0)]
        max_pos = [float(x) for x in np.max(v_float, axis=0)]
        pos_acc = self.add_accessor(pos_bv, 5126, len(v_float), "VEC3", min_pos, max_pos)  # 5126 = FLOAT

        # 2. NORMAL Accessor
        norm_bytes = n_float.tobytes()
        norm_bv = self.add_buffer_view(norm_bytes, target=34962)
        norm_acc = self.add_accessor(norm_bv, 5126, len(n_float), "VEC3")

        # 3. TEXCOORD_0 Accessor
        uv_bytes = uv_float.tobytes()
        uv_bv = self.add_buffer_view(uv_bytes, target=34962)
        uv_acc = self.add_accessor(uv_bv, 5126, len(uv_float), "VEC2")

        # 4. INDICES Accessor
        flat_faces = faces.flatten()
        if len(v_float) < 65535:
            # 16-bit indices (UNSIGNED_SHORT = 5123)
            idx_bytes = np.ascontiguousarray(flat_faces, dtype=np.uint16).tobytes()
            idx_comp = 5123
        else:
            # 32-bit indices (UNSIGNED_INT = 5125)
            idx_bytes = np.ascontiguousarray(flat_faces, dtype=np.uint32).tobytes()
            idx_comp = 5125

        idx_bv = self.add_buffer_view(idx_bytes, target=34963)  # ELEMENT_ARRAY_BUFFER
        idx_acc = self.add_accessor(idx_bv, idx_comp, len(flat_faces), "SCALAR")

        # Construct Mesh Primitive
        mesh_idx = len(self.meshes)
        self.meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {
                    "POSITION": pos_acc,
                    "NORMAL": norm_acc,
                    "TEXCOORD_0": uv_acc
                },
                "indices": idx_acc,
                "material": material_idx,
                "mode": 4  # TRIANGLES
            }]
        })

        node_idx = len(self.nodes)
        self.nodes.append({
            "name": f"{name}Node",
            "mesh": mesh_idx
        })
        return mesh_idx

    def build_glb(self) -> bytes:
        """Serializes the container into binary GLB 2.0 format."""
        # 1. Finalize bin buffer with 4-byte padding
        self._pad_buffer_4bytes()
        bin_length = len(self.bin_buffer)

        # 2. Build glTF JSON dictionary
        node_indices = list(range(len(self.nodes)))
        gltf_dict = {
            "asset": {
                "version": "2.0",
                "generator": "DORI 3D Virtual Try-On Engine v1.0"
            },
            "scene": 0,
            "scenes": [{
                "name": "DORIVirtualTryOnScene",
                "nodes": node_indices
            }],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{
                "byteLength": bin_length
            }]
        }

        json_bytes = json.dumps(gltf_dict, separators=(',', ':')).encode('utf-8')
        # Pad JSON bytes with ASCII spaces (0x20) to 4-byte boundary
        json_remainder = len(json_bytes) % 4
        if json_remainder != 0:
            json_bytes += b" " * (4 - json_remainder)
        json_length = len(json_bytes)

        # 3. Compute total GLB file size:
        # 12 bytes header + 8 bytes chunk0 header + json_length + 8 bytes chunk1 header + bin_length
        total_length = 12 + 8 + json_length + 8 + bin_length

        # 4. Construct Binary Chunks
        header = struct.pack(
            "<4sII",
            b"glTF",         # Magic
            2,               # Version
            total_length     # Total byte length
        )

        chunk0_header = struct.pack(
            "<II",
            json_length,     # Chunk length
            0x4E4F534A       # "JSON" in ASCII
        )

        chunk1_header = struct.pack(
            "<II",
            bin_length,      # Chunk length
            0x004E4942       # "BIN\0" in ASCII
        )

        glb_bytes = header + chunk0_header + json_bytes + chunk1_header + self.bin_buffer
        return glb_bytes


def export_tryon_scene_to_glb(
    avatar_data: Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray],
    garment_data: Optional[Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[float]]] = None,
    output_path: Path | str = None
) -> bytes:
    """
    Assembles avatar and garment meshes into a valid GLB container and saves to output_path.
    """
    builder = GLBBuilder()

    # 1. Add Avatar
    av_verts, av_faces, av_norms, av_uvs = avatar_data
    skin_mat = builder.add_material("SkinMaterial", [0.84, 0.72, 0.62, 1.0], roughness=0.68, metallic=0.08)
    builder.add_mesh_primitive("AvatarMesh", av_verts, av_faces, av_norms, av_uvs, skin_mat)

    # 2. Add Garment if present
    if garment_data is not None:
        g_verts, g_faces, g_norms, g_uvs, g_color = garment_data
        garment_mat = builder.add_material("GarmentMaterial", g_color, roughness=0.88, metallic=0.04)
        builder.add_mesh_primitive("GarmentMesh", g_verts, g_faces, g_norms, g_uvs, garment_mat)

    glb_bytes = builder.build_glb()

    if output_path is not None:
        p = Path(output_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(glb_bytes)

    return glb_bytes


def validate_glb_file(filepath: Path | str) -> Dict[str, Any]:
    """
    Validates that a file on disk is an authentic, non-empty binary glTF 2.0 file.
    """
    p = Path(filepath)
    if not p.exists():
        return {"valid": False, "error": f"File does not exist: {p}"}

    file_size = p.stat().st_size
    if file_size < 20:
        return {"valid": False, "error": f"File size too small ({file_size} bytes)"}

    with open(p, "rb") as f:
        header = f.read(12)
        if len(header) < 12:
            return {"valid": False, "error": "Incomplete GLB header"}

        magic, version, length = struct.unpack("<4sII", header)
        if magic != b"glTF":
            return {"valid": False, "error": f"Invalid magic bytes: {magic} (expected b'glTF')"}
        if version != 2:
            return {"valid": False, "error": f"Unsupported version: {version} (expected 2)"}
        if length != file_size:
            return {"valid": False, "error": f"Header length {length} does not match file size {file_size}"}

        # Read JSON Chunk
        c0_hdr = f.read(8)
        if len(c0_hdr) < 8:
            return {"valid": False, "error": "Incomplete Chunk 0 header"}
        c0_len, c0_type = struct.unpack("<II", c0_hdr)
        if c0_type != 0x4E4F534A:
            return {"valid": False, "error": f"Chunk 0 is not JSON (type: {hex(c0_type)})"}

        json_bytes = f.read(c0_len)
        try:
            gltf_json = json.loads(json_bytes.decode('utf-8'))
        except Exception as e:
            return {"valid": False, "error": f"Invalid glTF JSON content: {e}"}

    mesh_count = len(gltf_json.get("meshes", []))
    node_count = len(gltf_json.get("nodes", []))

    return {
        "valid": True,
        "file_size": file_size,
        "magic": "glTF",
        "version": version,
        "mesh_count": mesh_count,
        "node_count": node_count,
        "generator": gltf_json.get("asset", {}).get("generator", "Unknown")
    }
