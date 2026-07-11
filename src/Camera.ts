import * as THREE from 'three'

/**
 * Elastic follow camera — fixed isometric-ish direction, eased target,
 * mouse-wheel / pinch zoom.
 */
export class Camera {
  instance: THREE.PerspectiveCamera
  target = new THREE.Vector3()
  private targetEased = new THREE.Vector3()
  private readonly easing = 0.15
  private readonly direction = new THREE.Vector3(1.135, -1.45, 1.15).normalize()

  private zoomValue = 0.5
  private zoomTarget = 0.5
  private readonly zoomEasing = 0.1
  private readonly zoomMin = 14
  private readonly zoomAmplitude = 15

  private pinchStartDistance = 0
  private pinchStartValue = 0

  constructor(aspect: number, domElement: HTMLElement) {
    this.instance = new THREE.PerspectiveCamera(40, aspect, 1, 160)
    this.instance.up.set(0, 0, 1)
    this.instance.position.copy(this.direction).multiplyScalar(this.distance())
    this.instance.lookAt(0, 0, 0)

    window.addEventListener('wheel', (event) => {
      this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget + event.deltaY * 0.001, 0, 1)
    }, { passive: true })

    domElement.addEventListener('touchstart', (event) => {
      if (event.touches.length === 2) {
        this.pinchStartDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        )
        this.pinchStartValue = this.zoomTarget
      }
    })
    domElement.addEventListener('touchmove', (event) => {
      if (event.touches.length === 2) {
        const distance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        )
        const ratio = distance / this.pinchStartDistance
        this.zoomTarget = THREE.MathUtils.clamp(this.pinchStartValue - (ratio - 1), 0, 1)
      }
    })
  }

  private distance(): number {
    return this.zoomMin + this.zoomAmplitude * this.zoomValue
  }

  resize(aspect: number): void {
    this.instance.aspect = aspect
    this.instance.updateProjectionMatrix()
  }

  update(): void {
    this.zoomValue += (this.zoomTarget - this.zoomValue) * this.zoomEasing
    this.targetEased.lerp(this.target, this.easing)
    this.instance.position.copy(this.targetEased).addScaledVector(this.direction, this.distance())
    this.instance.lookAt(this.targetEased)
  }
}
