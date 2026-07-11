import * as THREE from 'three'
import { Materials } from './Materials'
import { Vehicle } from './Vehicle'
import { blobTexture } from './textures'

/**
 * The visual blue-cat car. Pure primitives; the tail wobbles with the
 * antenna-wobble algorithm (inverse acceleration + pull-back force).
 */
export class CarVisual {
  container = new THREE.Group()
  private chassisGroup = new THREE.Group()
  private wheels: THREE.Mesh[] = []
  private tailPivot = new THREE.Group()
  private brakeLightMaterial: THREE.MeshBasicMaterial
  private reverseLights: THREE.Mesh[] = []
  private shadow: THREE.Mesh

  // tail wobble state
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

  constructor(private materials: Materials, private vehicle: Vehicle, scene: THREE.Scene) {
    const blue = materials.matcap('blue')
    const navy = materials.matcap('navy')
    const white = materials.matcap('white')
    const black = materials.matcap('black')
    const amber = materials.matcap('amber')

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 0.5), blue)
    body.position.set(0, 0, 0.45)
    this.chassisGroup.add(body)

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 0.16), navy)
    bumper.position.set(0, 0, 0.26)
    this.chassisGroup.add(bumper)

    // cabin + glass
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.9, 0.34), white)
    cabin.position.set(-0.25, 0, 0.87)
    this.chassisGroup.add(cabin)
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.82, 0.3), navy)
    glass.position.set(-0.25, 0, 1.14)
    this.chassisGroup.add(glass)

    // cat ears
    const earGeometry = new THREE.ConeGeometry(0.13, 0.3, 4)
    earGeometry.rotateX(Math.PI / 2)
    for (const side of [1, -1]) {
      const ear = new THREE.Mesh(earGeometry, blue)
      ear.position.set(-0.4, 0.27 * side, 1.42)
      this.chassisGroup.add(ear)
    }

    // headlights / tail lights
    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6d8 })
    this.brakeLightMaterial = new THREE.MeshBasicMaterial({ color: 0x7a1d14 })
    const reverseMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    for (const side of [1, -1]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.14), headlightMaterial)
      headlight.position.set(1.02, 0.3 * side, 0.5)
      this.chassisGroup.add(headlight)

      const brakeLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.14), this.brakeLightMaterial)
      brakeLight.position.set(-1.02, 0.3 * side, 0.5)
      this.chassisGroup.add(brakeLight)

      const reverseLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.1), reverseMaterial)
      reverseLight.position.set(-1.03, 0.12 * side, 0.42)
      reverseLight.visible = false
      this.chassisGroup.add(reverseLight)
      this.reverseLights.push(reverseLight)
    }

    // wobbly cat tail (the antenna)
    const tailGeometry = new THREE.CylinderGeometry(0.025, 0.045, 0.7, 6)
    tailGeometry.rotateX(Math.PI / 2)
    tailGeometry.translate(0, 0, 0.35)
    const tailMesh = new THREE.Mesh(tailGeometry, navy)
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), amber)
    tailTip.position.set(0, 0, 0.72)
    this.tailPivot.add(tailMesh, tailTip)
    this.tailPivot.position.set(-0.85, 0, 0.72)
    this.chassisGroup.add(this.tailPivot)

    // wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.24, 14)
    const hubGeometry = new THREE.CylinderGeometry(0.13, 0.13, 0.26, 10)
    for (let i = 0; i < 4; i++) {
      const wheel = new THREE.Mesh(wheelGeometry, black)
      wheel.add(new THREE.Mesh(hubGeometry, materials.matcap('gray')))
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
    }

    // brake / reverse lights
    this.brakeLightMaterial.color.setHex(this.vehicleBraking() ? 0xff4433 : 0x7a1d14)
    const reversing = this.vehicle.accelerating < 0
    for (const light of this.reverseLights) light.visible = reversing

    // fake shadow follows on the ground plane
    this.shadow.position.x = body.position.x
    this.shadow.position.y = body.position.y
    const height = Math.max(body.position.z - 0.3, 0)
    ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.9 - height * 0.35, 0)

    this.updateTail()
    this.updateDust(deltaMs)
  }

  private vehicleBraking(): boolean {
    return this.vehicle.braking
  }

  /** Antenna wobble: inverse acceleration drive + pull-back to center. */
  private updateTail(): void {
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
    this.tailPivot.rotation.y = this.tailLocal.x * 0.12
    this.tailPivot.rotation.x = this.tailLocal.y * 0.12
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
