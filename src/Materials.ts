import * as THREE from 'three'

/**
 * Zero-light rendering kit: procedural matcap textures + a fake
 * "ground bounce" tint injected into MeshMatcapMaterial. No lights,
 * no shadow maps — the whole look costs one texture fetch per fragment.
 */

const INDIRECT = {
  color: new THREE.Color('#c65f00'),
  distanceAmplitude: 1.75,
  distanceStrength: 0.5,
  distancePower: 2.0,
  angleStrength: 1.5,
  angleOffset: 0.6,
  anglePower: 1.0
}

function makeMatcapTexture(hex: string): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const base = new THREE.Color(hex)
  const light = base.clone().offsetHSL(0, -0.04, 0.22)
  const dark = base.clone().offsetHSL(0.02, 0.05, -0.18)
  const darker = base.clone().offsetHSL(0.03, 0.08, -0.3)

  const grad = ctx.createRadialGradient(size * 0.36, size * 0.34, size * 0.05, size * 0.5, size * 0.5, size * 0.62)
  grad.addColorStop(0, light.getStyle())
  grad.addColorStop(0.4, base.getStyle())
  grad.addColorStop(0.78, dark.getStyle())
  grad.addColorStop(1, darker.getStyle())
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  // small specular highlight
  const spec = ctx.createRadialGradient(size * 0.33, size * 0.3, 0, size * 0.33, size * 0.3, size * 0.14)
  spec.addColorStop(0, 'rgba(255,255,255,0.85)')
  spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = spec
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Mix a warm ground-bounce color in from below. */
function injectIndirect(material: THREE.MeshMatcapMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uIndirectColor = { value: INDIRECT.color }
    shader.uniforms.uIndirectParams = {
      value: new THREE.Vector4(
        INDIRECT.distanceAmplitude,
        INDIRECT.distanceStrength,
        INDIRECT.distancePower,
        INDIRECT.angleStrength
      )
    }
    shader.uniforms.uIndirectAngle = { value: new THREE.Vector2(INDIRECT.angleOffset, INDIRECT.anglePower) }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFolioWorldPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvFolioWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'varying vec3 vFolioWorldPos;',
        'uniform vec3 uIndirectColor;',
        'uniform vec4 uIndirectParams;',
        'uniform vec2 uIndirectAngle;'
      ].join('\n'))
      .replace('vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;', [
        'vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;',
        'float indirectDistance = clamp(1.0 - vFolioWorldPos.z / uIndirectParams.x, 0.0, 1.0) * uIndirectParams.y;',
        'indirectDistance = clamp(pow(indirectDistance, uIndirectParams.z), 0.0, 1.0);',
        'vec3 folioWorldNormal = inverseTransformDirection(normal, viewMatrix);',
        'float indirectAngle = clamp((dot(normalize(folioWorldNormal), vec3(0.0, 0.0, -1.0)) + uIndirectAngle.x) * uIndirectParams.w, 0.0, 1.0);',
        'indirectAngle = pow(indirectAngle, uIndirectAngle.y);',
        'outgoingLight = mix(outgoingLight, uIndirectColor, indirectDistance * indirectAngle);'
      ].join('\n'))
  }
}

const PALETTE: Record<string, string> = {
  blue: '#3f74e8',
  navy: '#2b3a66',
  white: '#f2efe8',
  cream: '#ffe3b2',
  gray: '#9aa0a8',
  black: '#33343a',
  amber: '#ffb03a',
  red: '#f05a48',
  teal: '#3cb8a6',
  brown: '#a5713d',
  purple: '#8f7fd4',
  green: '#7dbf6a'
}

const PURES: Record<string, string> = {
  red: '#ff0000',
  white: '#ffffff',
  yellow: '#ffe889'
}

export type MatcapName = keyof typeof PALETTE | string

export class Materials {
  private cache = new Map<string, THREE.MeshMatcapMaterial>()
  private pureCache = new Map<string, THREE.MeshBasicMaterial>()
  private textures = new Map<string, THREE.Texture>()

  /** Loaded matcap textures win; anything else falls back to procedural. */
  constructor(private loadedMatcaps: Record<string, THREE.Texture> = {}) {}

  matcapTexture(name: MatcapName): THREE.Texture {
    const loaded = this.loadedMatcaps[name]
    if (loaded) return loaded
    let texture = this.textures.get(name)
    if (!texture) {
      texture = makeMatcapTexture(PALETTE[name] ?? name)
      this.textures.set(name, texture)
    }
    return texture
  }

  /** Flat unlit colors used by `pure*` meshes (headlights etc.). */
  pure(name: string): THREE.MeshBasicMaterial {
    let material = this.pureCache.get(name)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: PURES[name] ?? '#ffffff' })
      this.pureCache.set(name, material)
    }
    return material
  }

  /** Shared per color — sharing material instances keeps draw state cheap. */
  matcap(name: MatcapName): THREE.MeshMatcapMaterial {
    let material = this.cache.get(name)
    if (!material) {
      material = new THREE.MeshMatcapMaterial({ matcap: this.matcapTexture(name) })
      injectIndirect(material)
      this.cache.set(name, material)
    }
    return material
  }

  /** Unique material carrying a label map (boards, letter blocks). */
  matcapWithMap(name: MatcapName, map: THREE.Texture): THREE.MeshMatcapMaterial {
    const material = new THREE.MeshMatcapMaterial({ matcap: this.matcapTexture(name), map })
    injectIndirect(material)
    return material
  }
}
