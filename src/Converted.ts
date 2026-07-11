import * as THREE from 'three'
import { Materials } from './Materials'

/**
 * Convert an imported GLB into matcap-shaded meshes by naming
 * convention: `shadeRed_*` -> red matcap, `pureYellow_*` -> flat basic
 * color, `center_*` -> recenter pivot. `overrides` remaps shade colors
 * (e.g. { red: 'blue' } repaints the car body).
 */
export function convertMesh(
  source: THREE.Object3D,
  materials: Materials,
  overrides: Record<string, string> = {}
): THREE.Group {
  const container = new THREE.Group()
  const center = new THREE.Vector3()

  for (const child of source.children) {
    if (child.name.match(/^center/i)) {
      center.set(child.position.x, child.position.y, child.position.z)
    }
    if (!(child as THREE.Mesh).isMesh) continue

    const mesh = child.clone() as THREE.Mesh
    const shadeMatch = child.name.match(/^shade([a-z]+?)[0-9_]*$/i)
    const pureMatch = child.name.match(/^pure([a-z]+?)[0-9_]*$/i)

    if (shadeMatch) {
      let name = shadeMatch[1][0].toLowerCase() + shadeMatch[1].slice(1)
      name = overrides[name] ?? name
      mesh.material = materials.matcap(name)
    } else if (pureMatch) {
      mesh.material = materials.pure(pureMatch[1].toLowerCase())
    } else {
      mesh.material = materials.matcap('white')
    }
    container.add(mesh)
  }

  if (center.length() > 0) {
    for (const child of container.children) child.position.sub(center)
    container.position.add(center)
  }
  return container
}
