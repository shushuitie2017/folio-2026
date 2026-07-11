import * as CANNON from 'cannon-es'
import { Controls } from './Controls'
import { PhysicsWorld } from './PhysicsWorld'

/**
 * RaycastVehicle with hand-tuned suspension, steering and acceleration
 * numbers (see LICENSE for provenance). Speeds are in units per
 * millisecond by design.
 */

const OPTIONS = {
  chassisWidth: 1.02,
  chassisHeight: 1.16,
  chassisDepth: 2.03,
  chassisOffset: new CANNON.Vec3(0, 0, 0.41),
  chassisMass: 40,
  wheelFrontOffsetDepth: 0.635,
  wheelBackOffsetDepth: -0.475,
  wheelOffsetWidth: 0.39,
  wheelRadius: 0.25,
  wheelSuspensionStiffness: 50,
  wheelSuspensionRestLength: 0.1,
  wheelFrictionSlip: 10,
  wheelDampingRelaxation: 1.8,
  wheelDampingCompression: 1.5,
  wheelMaxSuspensionForce: 100000,
  wheelRollInfluence: 0.01,
  wheelMaxSuspensionTravel: 0.3,
  wheelCustomSlidingRotationalSpeed: -30,
  controlsSteeringSpeed: 0.005 * 3,
  controlsSteeringMax: Math.PI * 0.17,
  controlsAcceleratingMaxSpeed: 0.055 * 3 / 17,
  controlsAcceleratingMaxSpeedBoost: 0.11 * 3 / 17,
  controlsAcceleratingSpeed: 2 * 4 * 2,
  controlsAcceleratingSpeedBoost: 3.5 * 4 * 2,
  controlsBrakeStrength: 0.45 * 3
}

const SPAWN = new CANNON.Vec3(4, 0, 3)
const SPAWN_YAW = Math.PI // face -X, into the world

export class Vehicle {
  chassisBody: CANNON.Body
  vehicle: CANNON.RaycastVehicle
  options = OPTIONS

  steering = 0
  accelerating = 0
  speed = 0
  angle = 0
  forwardSpeed = 0
  goingForward = true
  private worldForward = new CANNON.Vec3()
  private oldPosition = new CANNON.Vec3()

  private upsideDownState: 'watching' | 'pending' | 'turning' = 'watching'
  private upsideDownTimeout = 0

  constructor(private physics: PhysicsWorld, private controls: Controls) {
    this.chassisBody = new CANNON.Body({ mass: OPTIONS.chassisMass })
    this.chassisBody.allowSleep = false
    this.chassisBody.position.copy(SPAWN)
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), SPAWN_YAW)
    this.chassisBody.addShape(
      new CANNON.Box(new CANNON.Vec3(OPTIONS.chassisDepth * 0.5, OPTIONS.chassisWidth * 0.5, OPTIONS.chassisHeight * 0.5)),
      OPTIONS.chassisOffset
    )

    // cannon-es defaults to a Y-up vehicle; this world is Z-up
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 1,
      indexForwardAxis: 0,
      indexUpAxis: 2
    })

    const wheelOptions = {
      radius: OPTIONS.wheelRadius,
      suspensionStiffness: OPTIONS.wheelSuspensionStiffness,
      suspensionRestLength: OPTIONS.wheelSuspensionRestLength,
      frictionSlip: OPTIONS.wheelFrictionSlip,
      dampingRelaxation: OPTIONS.wheelDampingRelaxation,
      dampingCompression: OPTIONS.wheelDampingCompression,
      maxSuspensionForce: OPTIONS.wheelMaxSuspensionForce,
      rollInfluence: OPTIONS.wheelRollInfluence,
      maxSuspensionTravel: OPTIONS.wheelMaxSuspensionTravel,
      customSlidingRotationalSpeed: OPTIONS.wheelCustomSlidingRotationalSpeed,
      useCustomSlidingRotationalSpeed: true,
      directionLocal: new CANNON.Vec3(0, 0, -1),
      axleLocal: new CANNON.Vec3(0, 1, 0),
      chassisConnectionPointLocal: new CANNON.Vec3()
    }

    // front left / front right / back left / back right
    wheelOptions.chassisConnectionPointLocal.set(OPTIONS.wheelFrontOffsetDepth, OPTIONS.wheelOffsetWidth, 0)
    this.vehicle.addWheel(wheelOptions)
    wheelOptions.chassisConnectionPointLocal.set(OPTIONS.wheelFrontOffsetDepth, -OPTIONS.wheelOffsetWidth, 0)
    this.vehicle.addWheel(wheelOptions)
    wheelOptions.chassisConnectionPointLocal.set(OPTIONS.wheelBackOffsetDepth, OPTIONS.wheelOffsetWidth, 0)
    this.vehicle.addWheel(wheelOptions)
    wheelOptions.chassisConnectionPointLocal.set(OPTIONS.wheelBackOffsetDepth, -OPTIONS.wheelOffsetWidth, 0)
    this.vehicle.addWheel(wheelOptions)

    this.vehicle.addToWorld(this.physics.world)

    this.physics.world.addEventListener('postStep', () => this.postStep())
    this.controls.onReset(() => this.reset())
  }

  get braking(): boolean {
    return this.controls.actions.brake
  }

  reset(): void {
    this.chassisBody.position.copy(SPAWN)
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), SPAWN_YAW)
    this.chassisBody.velocity.setZero()
    this.chassisBody.angularVelocity.setZero()
    this.steering = 0
  }

  private jump(strength = 150): void {
    const at = this.chassisBody.position.vadd(new CANNON.Vec3(0.1, 0, 0))
    this.chassisBody.applyImpulse(new CANNON.Vec3(0, 0, strength), at)
  }

  /** Runs after every physics step: speed bookkeeping, auto-flip, coast drag. */
  private postStep(): void {
    const positionDelta = this.chassisBody.position.vsub(this.oldPosition)
    this.oldPosition.copy(this.chassisBody.position)
    this.speed = positionDelta.length() / Math.max(this.lastDelta, 1)

    const localForward = new CANNON.Vec3(1, 0, 0)
    this.chassisBody.vectorToWorldFrame(localForward, this.worldForward)
    this.angle = Math.atan2(this.worldForward.y, this.worldForward.x)
    this.forwardSpeed = this.worldForward.dot(positionDelta)
    this.goingForward = this.forwardSpeed > 0

    // Upside down? Wait a second, then hop back upright.
    const worldUp = new CANNON.Vec3()
    this.chassisBody.vectorToWorldFrame(new CANNON.Vec3(0, 0, 1), worldUp)
    if (worldUp.dot(new CANNON.Vec3(0, 0, 1)) < 0.5) {
      if (this.upsideDownState === 'watching') {
        this.upsideDownState = 'pending'
        this.upsideDownTimeout = window.setTimeout(() => {
          this.upsideDownState = 'turning'
          this.jump()
          this.upsideDownTimeout = window.setTimeout(() => { this.upsideDownState = 'watching' }, 1000)
        }, 1000)
      }
    } else if (this.upsideDownState === 'pending') {
      this.upsideDownState = 'watching'
      window.clearTimeout(this.upsideDownTimeout)
    }

    // Coast drag: without input, bleed speed so the car settles predictably.
    if (!this.controls.actions.up && !this.controls.actions.down) {
      let slowDownForce = this.worldForward.clone()
      if (this.goingForward) slowDownForce = slowDownForce.negate()
      // 0.1 in the original; raised for this tighter world so the car
      // settles within a couple of seconds instead of gliding forever
      slowDownForce = slowDownForce.scale(this.chassisBody.velocity.length() * 0.6)
      this.chassisBody.applyImpulse(slowDownForce, this.chassisBody.position)
    }
  }

  private lastDelta = 16

  update(deltaMs: number): void {
    this.lastDelta = deltaMs
    const { actions, joystick } = this.controls

    // Steering — joystick steers by absolute world angle, keyboard ramps.
    if (joystick.active) {
      let deltaAngle = (joystick.angle - this.angle + Math.PI) % (Math.PI * 2) - Math.PI
      deltaAngle = deltaAngle < -Math.PI ? deltaAngle + Math.PI * 2 : deltaAngle
      const goingForward = Math.abs(this.forwardSpeed) < 0.01 ? true : this.goingForward
      this.steering = deltaAngle * (goingForward ? -1 : 1)
      this.steering = clampAbs(this.steering, OPTIONS.controlsSteeringMax)
    } else {
      const steerStrength = deltaMs * OPTIONS.controlsSteeringSpeed
      if (actions.right) {
        this.steering += steerStrength
      } else if (actions.left) {
        this.steering -= steerStrength
      } else if (Math.abs(this.steering) > steerStrength) {
        this.steering -= steerStrength * Math.sign(this.steering)
      } else {
        this.steering = 0
      }
      this.steering = clampAbs(this.steering, OPTIONS.controlsSteeringMax)
    }
    this.vehicle.setSteeringValue(-this.steering, 0)
    this.vehicle.setSteeringValue(-this.steering, 1)

    // Acceleration — engine force capped by a max speed, not a max force.
    const accelerationSpeed = actions.boost ? OPTIONS.controlsAcceleratingSpeedBoost : OPTIONS.controlsAcceleratingSpeed
    const accelerateStrength = 17 * accelerationSpeed
    const maxSpeed = actions.boost ? OPTIONS.controlsAcceleratingMaxSpeedBoost : OPTIONS.controlsAcceleratingMaxSpeed

    if (actions.up) {
      this.accelerating = (this.speed < maxSpeed || !this.goingForward) ? accelerateStrength : 0
    } else if (actions.down) {
      this.accelerating = (this.speed < maxSpeed || this.goingForward) ? -accelerateStrength : 0
    } else {
      this.accelerating = 0
    }
    this.vehicle.applyEngineForce(-this.accelerating, 2)
    this.vehicle.applyEngineForce(-this.accelerating, 3)

    // Brake
    const brake = actions.brake ? OPTIONS.controlsBrakeStrength : 0
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i)

    // Wheel world transforms for the visual layer
    for (let i = 0; i < 4; i++) this.vehicle.updateWheelTransform(i)
  }
}

function clampAbs(value: number, max: number): number {
  return Math.abs(value) > max ? Math.sign(value) * max : value
}
