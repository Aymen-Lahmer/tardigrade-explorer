/**
 * Lecture des données 3D.
 *
 * Deux fichiers sont nécessaires :
 *   - tardigrade-atlas.json : le catalogue (10 pièces, tailles et offsets) ;
 *   - tardigrade-chunk-0.bin : positions, normales et indices, concaténés.
 *
 * Chaque pièce du catalogue contient trois offsets absolus dans le binaire :
 *   positions : float32, 3 valeurs par sommet   (4 octets)
 *   normales  : int16 normalisés, 3 par sommet  (2 octets)
 *   indices   : uint32, 3 indices par triangle  (4 octets)
 */

import * as THREE from 'three';

// Le JSON est à côté de ce module : ../models/ depuis /static/js/.
const ATLAS_URL = new URL('../models/tardigrade-atlas.json', import.meta.url);

/** Charge le catalogue JSON (liste des pièces et métadonnées). */
export async function loadAtlas() {
  const response = await fetch(ATLAS_URL);
  if (!response.ok) {
    throw new Error(`Le catalogue 3D est introuvable (HTTP ${response.status}).`);
  }
  return response.json();
}

/**
 * Télécharge le binaire puis construit une BufferGeometry par pièce.
 * Retourne [{part, geometry}] dans l'ordre du catalogue.
 */
export async function loadGeometries(atlas) {
  const chunk = atlas.chunks[0];
  const response = await fetch(chunk.url);
  if (!response.ok) {
    throw new Error(`Le fichier de géométrie est introuvable (HTTP ${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  if (chunk.bytes && buffer.byteLength !== chunk.bytes) {
    throw new Error('Le fichier de géométrie est incomplet. Rechargez la page.');
  }

  return atlas.parts.map((part) => {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3),
    );
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Int16Array(buffer, part.normals, part.vertexCount * 3), 3, true),
    );
    geometry.setIndex(
      new THREE.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1),
    );

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return { part, geometry };
  });
}
