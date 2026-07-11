import * as CANNON from 'cannon-es'
import * as THREE from 'three'

/**
 * Physics world (Z-up, tuned contact recipe) plus the
 * proxy-pairing helper: every visual object is driven by a simple
 * primitive body, synced one-way physics -> visuals each frame.
 */

export interface ShapeSpec {
  type: 'box' | 'cylinder' | 'sphere'
  /** box: full extents; cylinder: x=radius, z=height; sphere: x=radius */
  size: THREE.Vector3
  position?: THREE.Vector3
}

export interface ObjectSpec {
  shapes: ShapeSpec[]
  position: THREE.Vector3
  rotationZ?: number
  mass: number
  sleep?: boolean
}

export interface PhysObject {
  body: CANNON.Body
  container: THREE.Object3D
  reset: () => void
}

export class PhysicsWorld {
  world: CANNON.World
  materials: { floor: CANNON.Material; dummy: CANNON.Material; wheel: CANNON.Material }
  objects: PhysObject[] = []

  constructor() {
    this.world = new CANNON.World()
    this.world.gravity.set(0, 0, -13)
    this.world.allowSleep = true
    this.world.defaultContactMaterial.friction = 0
    this.world.defaultContactMaterial.restitution = 0.2

    this.materials = {
      floor: new CANNON.Material('floor'),
      dummy: new CANNON.Material('dummy'),
      wheel: new CANNON.Material('wheel')
    }
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.materials.floor, this.materials.dummy, {
      friction: 0.05, restitution: 0.3, contactEquationStiffness: 1000
    }))
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.materials.dummy, this.materials.dummy, {
      friction: 0.5, restitution: 0.3, contactEquationStiffness: 1000
    }))
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.materials.floor, this.materials.wheel, {
      friction: 0.3, restitution: 0, contactEquationStiffness: 1000
    }))

    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: this.materials.floor })
    this.world.addBody(floorBody)
  }

  step(deltaMs: number): void {
    this.world.step(Math.min(deltaMs, 50) / 1000)
  }

  /** Pair a visual container with a compound primitive body. */
  addObject(spec: ObjectSpec, container: THREE.Object3D): PhysObject {
    const body = new CANNON.Body({
      mass: spec.mass,
      material: this.materials.dummy,
      position: new CANNON.Vec3(spec.position.x, spec.position.y, spec.position.z)
    })
    body.allowSleep = true
    body.sleepSpeedLimit = 0.01
    if (spec.rotationZ) {
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), spec.rotationZ)
    }

    for (const shape of spec.shapes) {
      let geometry: CANNON.Shape
      if (shape.type === 'box') {
        geometry = new CANNON.Box(new CANNON.Vec3(shape.size.x * 0.5, shape.size.y * 0.5, shape.size.z * 0.5))
      } else if (shape.type === 'cylinder') {
        geometry = new CANNON.Cylinder(shape.size.x, shape.size.x, shape.size.z, 8)
      } else {
        geometry = new CANNON.Sphere(shape.size.x)
      }
      const offset = shape.position
        ? new CANNON.Vec3(shape.position.x, shape.position.y, shape.position.z)
        : new CANNON.Vec3()
      let orientation: CANNON.Quaternion | undefined
      if (shape.type === 'cylinder') {
        // cannon-es cylinders are Y-axis aligned; stand them up in a Z-up world
        orientation = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)
      }
      body.addShape(geometry, offset, orientation)
    }

    this.world.addBody(body)
    // Pre-sleep everything that starts at rest — the folio performance trick:
    // otherwise every body keeps feeding the broadphase forever.
    if (spec.sleep !== false) body.sleep()

    const originPosition = body.position.clone()
    const originQuaternion = body.quaternion.clone()
    const object: PhysObject = {
      body,
      container,
      reset: () => {
        body.velocity.setZero()
        body.angularVelocity.setZero()
        body.position.copy(originPosition)
        body.quaternion.copy(originQuaternion)
        if (spec.sleep !== false) body.sleep()
      }
    }
    this.objects.push(object)
    return object
  }

  /**
   * Pair a visual container with proxies parsed from a collision GLB —
   * naming convention: cube/box -> Box, cylinder -> Cylinder,
   * sphere -> Sphere, center -> center of mass. Dimensions follow
   * the authoring convention of the source assets (box halfExtents =
   * scale * 0.5, cylinder radius = |scale.x|, height = |scale.z|).
   */
  addObjectFromCollision(
    collisionScene: THREE.Object3D,
    spec: { position: THREE.Vector3; rotationZ?: number; mass: number; sleep?: boolean },
    container: THREE.Object3D
  ): PhysObject {
    const body = new CANNON.Body({
      mass: spec.mass,
      material: this.materials.dummy,
      position: new CANNON.Vec3(spec.position.x, spec.position.y, spec.position.z)
    })
    body.allowSleep = true
    body.sleepSpeedLimit = 0.01
    if (spec.rotationZ) {
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), spec.rotationZ)
    }

    const center = new CANNON.Vec3()
    const shapes: Array<{ shape: CANNON.Shape; position: CANNON.Vec3; quaternion: CANNON.Quaternion }> = []
    const cylinderUp = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)

    for (const mesh of collisionScene.children) {
      const scale = mesh.scale
      let shape: CANNON.Shape | null = null
      let quaternion = new CANNON.Quaternion(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)

      if (mesh.name.match(/^center/i)) {
        center.set(mesh.position.x, mesh.position.y, mesh.position.z)
        continue
      } else if (mesh.name.match(/^(cube|box)/i)) {
        shape = new CANNON.Box(new CANNON.Vec3(Math.abs(scale.x) * 0.5, Math.abs(scale.y) * 0.5, Math.abs(scale.z) * 0.5))
      } else if (mesh.name.match(/^cylinder/i)) {
        // cannon-es cylinders are Y-axis aligned; stand them up first
        shape = new CANNON.Cylinder(Math.abs(scale.x), Math.abs(scale.x), Math.abs(scale.z), 8)
        quaternion = quaternion.mult(cylinderUp)
      } else if (mesh.name.match(/^sphere/i)) {
        shape = new CANNON.Sphere(Math.abs(scale.x))
      }
      if (!shape) continue
      shapes.push({ shape, position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z), quaternion })
    }

    for (const item of shapes) {
      item.position.vsub(center, item.position)
      body.addShape(item.shape, item.position, item.quaternion)
    }
    body.position.vadd(center, body.position)

    // shift visuals so they orbit the same center of mass
    for (const child of container.children) {
      child.position.x -= center.x
      child.position.y -= center.y
      child.position.z -= center.z
    }

    this.world.addBody(body)
    if (spec.sleep !== false) body.sleep()

    const originPosition = body.position.clone()
    const originQuaternion = body.quaternion.clone()
    const object: PhysObject = {
      body,
      container,
      reset: () => {
        body.velocity.setZero()
        body.angularVelocity.setZero()
        body.position.copy(originPosition)
        body.quaternion.copy(originQuaternion)
        if (spec.sleep !== false) body.sleep()
      }
    }
    this.objects.push(object)
    return object
  }

  syncVisuals(): void {
    for (const object of this.objects) {
      object.container.position.set(object.body.position.x, object.body.position.y, object.body.position.z)
      object.container.quaternion.set(
        object.body.quaternion.x, object.body.quaternion.y,
        object.body.quaternion.z, object.body.quaternion.w
      )
    }
  }

  resetAll(): void {
    for (const object of this.objects) object.reset()
  }

  awakeCount(): number {
    return this.world.bodies.filter((body) => body.type === CANNON.Body.DYNAMIC && body.sleepState !== CANNON.Body.SLEEPING).length
  }
}
