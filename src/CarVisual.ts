import * as THREE from 'three'
import { Assets } from './Assets'
import { convertMesh } from './Converted'
import { Materials } from './Materials'
import { Vehicle } from './Vehicle'
import { blobTexture } from './textures'

/**
 * The visual car, assembled from the original low-poly GLB parts and
 * repainted blue (bluecat livery) with a pair of cat ears on the roof.
 * The antenna wobbles via the classic inverse-acceleration algorithm.
 */
export class CarVisual {
  container = new THREE.Group()
  private chassisGroup = new THREE.Group()
  private wheels: THREE.Object3D[] = []
  private antenna: THREE.Group
  private brakeLightMaterial: THREE.MeshBasicMaterial
  private reverseLightGroup: THREE.Group
  private shadow: THREE.Mesh
  private readonly wheelFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)

  // antenna wobble state
  private readonly tail = { speedStrength: 10, damping: 0.035, pullBackStrength: 0.02 }
  private tailSpeed = new THREE.Vector2()
  private tailAbsolute = new THREE.Vector2()
  private tailLocal = new THREE.Vector2()

  // movement tracking for the wobble
  private lastPosition = new THREE.Vector3()
  private movementSpeed = new THREE.Vector3()
  private acceleration = new THREE.Vector3()

  // dust
  private dustSprites: THREE.Sprite[] = []
  private dustIndex = 0
  private dustCooldown = 0

  constructor(private materials: Materials, private vehicle: Vehicle, scene: THREE.Scene, assets: Assets) {
    // chassis — repaint the red body panels blue for the bluecat livery
    const chassis = convertMesh(assets.models.carChassis, materials, { red: 'blue' })
    this.chassisGroup.add(chassis)

    // wobbly antenna (converted with its own center pivot)
    this.antenna = convertMesh(assets.models.carAntenna, materials)
    this.chassisGroup.add(this.antenna)

    // brake / reverse lights
    this.brakeLightMaterial = new THREE.MeshBasicMaterial({ color: 0x7a1d14 })
    const brakeLights = convertMesh(assets.models.carBrakeLights, materials)
    brakeLights.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = this.brakeLightMaterial
    })
    this.chassisGroup.add(brakeLights)

    const reverseMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.reverseLightGroup = convertMesh(assets.models.carReverseLights, materials)
    this.reverseLightGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = reverseMaterial
    })
    this.reverseLightGroup.visible = false
    this.chassisGroup.add(this.reverseLightGroup)

    // cat ears on the cabin roof
    const earGeometry = new THREE.ConeGeometry(0.11, 0.26, 4)
    earGeometry.rotateX(Math.PI / 2)
    for (const side of [1, -1]) {
      const ear = new THREE.Mesh(earGeometry, materials.matcap('blue'))
      ear.position.set(0.18, 0.26 * side, 1.3)
      this.chassisGroup.add(ear)
    }

    // wheels
    const wheelProto = convertMesh(assets.models.carWheel, materials)
    for (let i = 0; i < 4; i++) {
      const wheel = wheelProto.clone()
      this.wheels.push(wheel)
      this.container.add(wheel)
    }

    // fake blob shadow
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.2),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
    )
    this.shadow.position.z = 0.02
    this.container.add(this.shadow)

    // dust pool
    const dustMap = blobTexture('190,140,70')
    for (let i = 0; i < 24; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustMap, transparent: true, opacity: 0, depthWrite: false }))
      sprite.userData.life = 0
      this.dustSprites.push(sprite)
      this.container.add(sprite)
    }

    this.container.add(this.chassisGroup)
    scene.add(this.container)
  }

  get position(): THREE.Vector3 {
    return this.chassisGroup.position
  }

  update(deltaMs: number): void {
    const body = this.vehicle.chassisBody
    this.chassisGroup.position.set(body.position.x, body.position.y, body.position.z)
    this.chassisGroup.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)

    for (let i = 0; i < 4; i++) {
      const transform = this.vehicle.vehicle.wheelInfos[i].worldTransform
      this.wheels[i].position.set(transform.position.x, transform.position.y, transform.position.z)
      this.wheels[i].quaternion.set(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w)
      // mirror the right-side hubcaps
      if (i === 1 || i === 3) this.wheels[i].quaternion.multiply(this.wheelFlip)
    }

    // brake / reverse lights
    this.brakeLightMaterial.color.setHex(this.vehicle.braking ? 0xff4433 : 0x7a1d14)
    this.reverseLightGroup.visible = this.vehicle.accelerating < 0

    // fake shadow follows on the ground plane
    this.shadow.position.x = body.position.x
    this.shadow.position.y = body.position.y
    const height = Math.max(body.position.z - 0.3, 0)
    ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.9 - height * 0.35, 0)

    this.updateAntenna()
    this.updateDust(deltaMs)
  }

  /** Antenna wobble: inverse acceleration drive + pull-back to center. */
  private updateAntenna(): void {
    const position = this.chassisGroup.position
    const movementSpeed = position.clone().sub(this.lastPosition)
    this.acceleration = movementSpeed.clone().sub(this.movementSpeed)
    this.movementSpeed.copy(movementSpeed)
    this.lastPosition.copy(position)

    const max = 1
    const accelerationX = THREE.MathUtils.clamp(this.acceleration.x, -max, max)
    const accelerationY = THREE.MathUtils.clamp(this.acceleration.y, -max, max)

    this.tailSpeed.x -= accelerationX * this.tail.speedStrength
    this.tailSpeed.y -= accelerationY * this.tail.speedStrength

    const pullBack = this.tailAbsolute.clone().negate().multiplyScalar(this.tailAbsolute.length() * this.tail.pullBackStrength)
    this.tailSpeed.add(pullBack)
    this.tailSpeed.multiplyScalar(1 - this.tail.damping)
    this.tailAbsolute.add(this.tailSpeed)

    const yaw = new THREE.Euler().setFromQuaternion(this.chassisGroup.quaternion, 'ZYX').z
    this.tailLocal.copy(this.tailAbsolute).rotateAround(new THREE.Vector2(), -yaw)
    this.antenna.rotation.y = this.tailLocal.x * 0.1
    this.antenna.rotation.x = this.tailLocal.y * 0.1
  }

  private updateDust(deltaMs: number): void {
    this.dustCooldown -= deltaMs
    const drivingHard = Math.abs(this.vehicle.accelerating) > 0 && this.vehicle.speed > 0.004
    if (drivingHard && this.dustCooldown <= 0 && this.vehicle.chassisBody.position.z < 1.2) {
      this.dustCooldown = 70
      const sprite = this.dustSprites[this.dustIndex]
      this.dustIndex = (this.dustIndex + 1) % this.dustSprites.length
      const body = this.vehicle.chassisBody
      const rear = new THREE.Vector3(-1.1, (Math.random() - 0.5) * 0.9, 0.15)
        .applyQuaternion(this.chassisGroup.quaternion)
      sprite.position.set(body.position.x + rear.x, body.position.y + rear.y, 0.2)
      sprite.userData.life = 700
      sprite.scale.setScalar(0.3)
    }

    for (const sprite of this.dustSprites) {
      if (sprite.userData.life <= 0) continue
      sprite.userData.life -= deltaMs
      const progress = 1 - Math.max(sprite.userData.life, 0) / 700
      sprite.scale.setScalar(0.3 + progress * 1.1)
      sprite.position.z += deltaMs * 0.0004
      ;(sprite.material as THREE.SpriteMaterial).opacity = 0.45 * (1 - progress)
    }
  }
}
