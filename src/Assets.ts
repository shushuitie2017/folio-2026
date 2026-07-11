import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

/**
 * Loads the MIT-licensed low-poly assets (draco-compressed GLBs +
 * matcap textures). Everything else in the world stays procedural.
 */

const MODEL_SOURCES = {
  carChassis: 'models/car/chassis.glb',
  carWheel: 'models/car/wheel.glb',
  carAntenna: 'models/car/antena.glb',
  carBrakeLights: 'models/car/backLightsBrake.glb',
  carReverseLights: 'models/car/backLightsReverse.glb',
  bowlingBallBase: 'models/bowlingBall/base.glb',
  bowlingBallCollision: 'models/bowlingBall/collision.glb',
  bowlingPinBase: 'models/bowlingPin/base.glb',
  bowlingPinCollision: 'models/bowlingPin/collision.glb',
  brickBase: 'models/brick/base.glb',
  brickCollision: 'models/brick/collision.glb',
  coneBase: 'models/cone/base.glb',
  coneCollision: 'models/cone/collision.glb'
} as const

const MATCAP_NAMES = [
  'beige', 'black', 'blue', 'brown', 'emeraldGreen', 'gold', 'gray',
  'green', 'metal', 'orange', 'purple', 'red', 'white', 'yellow'
] as const

export interface Assets {
  models: Record<keyof typeof MODEL_SOURCES, THREE.Group>
  matcaps: Record<string, THREE.Texture>
}

export async function loadAssets(): Promise<Assets> {
  const base = import.meta.env.BASE_URL

  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath(`${base}draco/`)
  const gltfLoader = new GLTFLoader()
  gltfLoader.setDRACOLoader(dracoLoader)
  const textureLoader = new THREE.TextureLoader()

  const models = {} as Assets['models']
  const matcaps: Record<string, THREE.Texture> = {}

  await Promise.all([
    ...Object.entries(MODEL_SOURCES).map(async ([key, url]) => {
      const gltf = await gltfLoader.loadAsync(base + url)
      models[key as keyof typeof MODEL_SOURCES] = gltf.scene
    }),
    ...MATCAP_NAMES.map(async (name) => {
      const texture = await textureLoader.loadAsync(`${base}matcaps/${name}.png`)
      texture.colorSpace = THREE.SRGBColorSpace
      matcaps[name] = texture
    })
  ])

  dracoLoader.dispose()
  return { models, matcaps }
}
