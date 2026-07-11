import * as THREE from 'three'
import { Camera } from './Camera'
import { CarVisual } from './CarVisual'
import { Controls } from './Controls'
import { createFloor } from './Floor'
import { Materials } from './Materials'
import { PhysicsWorld } from './PhysicsWorld'
import { Vehicle } from './Vehicle'
import { World } from './World'

export class Experience {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: Camera
  controls: Controls
  materials: Materials
  physics: PhysicsWorld
  vehicle: Vehicle
  car: CarVisual
  world: World
  private lastTime = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor('#ffca75')

    this.scene = new THREE.Scene()
    this.camera = new Camera(window.innerWidth / window.innerHeight, this.renderer.domElement)
    this.controls = new Controls()
    this.materials = new Materials()
    this.physics = new PhysicsWorld()
    this.vehicle = new Vehicle(this.physics, this.controls)
    this.car = new CarVisual(this.materials, this.vehicle, this.scene)
    this.world = new World(this.materials, this.physics)

    this.scene.add(createFloor())
    this.scene.add(this.world.container)

    this.controls.onReset(() => this.physics.resetAll())
    this.setClickThrough()

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      this.camera.resize(window.innerWidth / window.innerHeight)
    })

    this.exposeDebug()
    this.lastTime = performance.now()
    this.renderer.setAnimationLoop(() => this.tick())
  }

  /** Click / tap a board to open its project. */
  private setClickThrough(): void {
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downX = 0
    let downY = 0

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      downX = event.clientX
      downY = event.clientY
    })
    this.renderer.domElement.addEventListener('pointerup', (event) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 8) return
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(pointer, this.camera.instance)
      const meshes = this.world.clickables.map((clickable) => clickable.mesh)
      const hits = raycaster.intersectObjects(meshes, true)
      if (!hits.length) return
      const hit = this.world.clickables.find((clickable) =>
        clickable.mesh === hits[0].object || clickable.mesh.children.includes(hits[0].object)
        || hits[0].object.parent === clickable.mesh)
      if (hit) window.open(hit.url, '_blank', 'noopener')
    })
  }

  private tick(): void {
    const now = performance.now()
    const delta = Math.min(Math.max(now - this.lastTime, 1), 50)
    this.lastTime = now

    this.vehicle.update(delta)
    this.physics.step(delta)
    this.physics.syncVisuals()
    this.car.update(delta)

    this.camera.target.set(
      this.vehicle.chassisBody.position.x,
      this.vehicle.chassisBody.position.y,
      0
    )
    this.camera.update()
    this.renderer.render(this.scene, this.camera.instance)
  }

  /** Handles for headless testing and performance audits. */
  private exposeDebug(): void {
    ;(window as any).__folio = {
      experience: this,
      speed: () => this.vehicle.speed,
      position: () => ({ ...this.vehicle.chassisBody.position }),
      awakeBodies: () => this.physics.awakeCount(),
      drawCalls: () => this.renderer.info.render.calls,
      triangles: () => this.renderer.info.render.triangles,
      drive: (up: boolean, left = false, right = false, down = false) => {
        this.controls.actions.up = up
        this.controls.actions.left = left
        this.controls.actions.right = right
        this.controls.actions.down = down
      }
    }
  }
}
