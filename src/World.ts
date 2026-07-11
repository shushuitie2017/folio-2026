import * as THREE from 'three'
import { Assets } from './Assets'
import { convertMesh } from './Converted'
import { Materials } from './Materials'
import { PhysicsWorld } from './PhysicsWorld'
import { boardTexture, letterTexture, markerTexture } from './textures'
import { PROJECTS, LINKS, ProjectEntry } from './projects'

/**
 * World content, organised as sections (intro / projects / playground /
 * links) — everything knockable is a matcap mesh paired to a primitive body.
 *
 * The camera looks along a fixed diagonal, so readable things (letter
 * blocks, ground markers) are tilted by SCREEN_TILT to face the screen,
 * and rows are laid out along the screen-right axis.
 */
const SCREEN_TILT = 0.665
const SCREEN_RIGHT = new THREE.Vector2(0.787, 0.616)
const SCREEN_UP = new THREE.Vector2(-0.616, 0.787)

export class World {
  container = new THREE.Group()
  clickables: Array<{ mesh: THREE.Object3D; url: string }> = []

  constructor(private materials: Materials, private physics: PhysicsWorld, private assets: Assets) {
    this.buildIntro()
    this.buildProjects()
    this.buildPlayground()
    this.buildProps()
    this.buildLinks()
    this.buildMarkers()
  }

  /** Spawn a GLB prop: base.glb visuals + collision.glb physics proxies. */
  private spawnProp(
    name: 'bowlingBall' | 'bowlingPin' | 'brick' | 'cone',
    position: THREE.Vector3,
    mass: number,
    rotationZ = 0
  ): void {
    const group = convertMesh(this.assets.models[`${name}Base`], this.materials)
    this.container.add(group)
    this.physics.addObjectFromCollision(this.assets.models[`${name}Collision`], { position, rotationZ, mass }, group)
  }

  /** Toy letter blocks spelling the title — drive through them. */
  private buildIntro(): void {
    const blockColors = ['#3f74e8', '#f05a48', '#ffb03a', '#3cb8a6', '#8f7fd4']
    this.spellRow('BLUECAT', new THREE.Vector2(-10.8, 4.6), 0.8, ['#2b3a66'])
    this.spellRow('FOLIO', new THREE.Vector2(-8.4, 1.7), 1.1, blockColors)
    this.spellRow('2026', new THREE.Vector2(-6.4, -1.2), 1.1, blockColors)
  }

  private spellRow(word: string, center: THREE.Vector2, size: number, palette: string[]): void {
    const gap = size * 1.3
    for (let i = 0; i < word.length; i++) {
      const letter = word[i]
      if (letter === ' ') continue
      const along = (i - (word.length - 1) / 2) * gap
      const position = new THREE.Vector3(
        center.x + SCREEN_RIGHT.x * along,
        center.y + SCREEN_RIGHT.y * along,
        size / 2 + 0.01
      )
      const bg = palette[i % palette.length]
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        this.materials.matcapWithMap('cream', letterTexture(letter, bg, '#fff6e2'))
      )
      const group = new THREE.Group()
      group.add(mesh)
      this.container.add(group)
      this.physics.addObject({
        shapes: [{ type: 'box', size: new THREE.Vector3(size, size, size) }],
        position,
        rotationZ: SCREEN_TILT,
        mass: 1.5
      }, group)
    }
  }

  /** Project boards along an avenue — knock them over, click to open. */
  private buildProjects(): void {
    PROJECTS.forEach((project, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const position = new THREE.Vector3(-16 - row * 7, column === 0 ? 6.5 : -6.5, 0)
      this.spawnBoard(project, position, column === 0 ? -0.25 : 0.25)
    })
  }

  /** External links section, off to the +Y side. */
  private buildLinks(): void {
    LINKS.forEach((link, index) => {
      this.spawnBoard(link, new THREE.Vector3(-1 - index * 6, 15, 0), Math.PI / 2 + 0.2)
    })
  }

  private spawnBoard(entry: ProjectEntry, position: THREE.Vector3, rotationZ: number): void {
    const width = 3.4
    const depth = 0.24
    const height = 2.2
    const legHeight = 0.5

    const label = this.materials.matcapWithMap('white', boardTexture(entry.name, entry.tag, entry.accent))
    const side = this.materials.matcap('navy')
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(width, depth, height),
      // BoxGeometry face order: +x, -x, +y, -y, +z, -z — label on both wide faces
      [side, side, label, label, side, side]
    )
    board.position.z = legHeight + height / 2

    const group = new THREE.Group()
    group.add(board)
    const legGeometry = new THREE.BoxGeometry(0.16, 0.16, legHeight + 0.1)
    for (const sideSign of [1, -1]) {
      const leg = new THREE.Mesh(legGeometry, side)
      leg.position.set(sideSign * (width / 2 - 0.3), 0, legHeight / 2)
      group.add(leg)
    }
    this.container.add(group)

    this.physics.addObject({
      shapes: [
        { type: 'box', size: new THREE.Vector3(width, depth, height), position: new THREE.Vector3(0, 0, legHeight + height / 2) },
        { type: 'box', size: new THREE.Vector3(width - 0.4, depth, legHeight), position: new THREE.Vector3(0, 0, legHeight / 2) }
      ],
      position,
      rotationZ,
      mass: 2.5
    }, group)

    this.clickables.push({ mesh: board, url: entry.url })
  }

  /** Bowling corner: ten pins and a ball (original GLB assets). */
  private buildPlayground(): void {
    const origin = new THREE.Vector3(-8, -14, 0)
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        this.spawnProp('bowlingPin', new THREE.Vector3(
          origin.x - row * 1.3,
          origin.y - row * 0.65 + i * 1.3,
          0
        ), 1)
      }
    }
    this.spawnProp('bowlingBall', new THREE.Vector3(origin.x + 5, origin.y + 0.8, 0), 2)
  }

  /** A brick wall to crash through and a slalom of traffic cones. */
  private buildProps(): void {
    // brick: box halfExtents (0.3, 0.5, 0.225) -> full 0.6 x 1.0 x 0.45
    const wall = new THREE.Vector3(2, -8, 0)
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const stagger = (row % 2) * 0.5
        this.spawnProp('brick', new THREE.Vector3(
          wall.x,
          wall.y - 2 + i * 1.02 + stagger,
          row * 0.46
        ), 0.5)
      }
    }

    for (let i = 0; i < 4; i++) {
      this.spawnProp('cone', new THREE.Vector3(-14 - i * 3.4, i % 2 === 0 ? -1.2 : 1.2, 0), 0.4)
    }
  }

  /** Flat ground labels naming each section, tilted to face the screen. */
  private buildMarkers(): void {
    const specs: Array<{ text: string; position: THREE.Vector3; scale: number }> = [
      { text: 'PROJECTS', position: new THREE.Vector3(-17, 0, 0), scale: 6 },
      { text: 'PLAYGROUND', position: new THREE.Vector3(-3.5, -10.5, 0), scale: 5 },
      { text: 'LINKS', position: new THREE.Vector3(-1.5, 11.5, 0), scale: 4 },
      { text: 'DRIVE ME', position: new THREE.Vector3(6.8, -2.6, 0), scale: 3.4 }
    ]
    for (const spec of specs) {
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.scale, spec.scale / 4),
        new THREE.MeshBasicMaterial({ map: markerTexture(spec.text), transparent: true, depthWrite: false })
      )
      marker.position.copy(spec.position)
      marker.position.z = 0.03
      marker.rotation.z = SCREEN_TILT
      this.container.add(marker)
    }
  }
}
