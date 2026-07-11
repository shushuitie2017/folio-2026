import * as THREE from 'three'

/**
 * The whole ground is a single plane textured by a 2x2 DataTexture —
 * the GPU's bilinear filter produces the four-corner gradient for free.
 */
const CORNERS = {
  bottomLeft: '#ffdc9e',
  bottomRight: '#fff0cb',
  topLeft: '#ffcf83',
  topRight: '#ffc26a'
}

export function createFloor(): THREE.Mesh {
  const colors = [CORNERS.bottomLeft, CORNERS.bottomRight, CORNERS.topLeft, CORNERS.topRight]
    .map((hex) => new THREE.Color(hex))

  const data = new Uint8Array(colors.flatMap((color) => [
    Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255
  ]))

  const texture = new THREE.DataTexture(data, 2, 2)
  texture.magFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ map: texture })
  )
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()
  return mesh
}
