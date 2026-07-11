/**
 * Keyboard (WASD / arrows / shift boost / space brake / R reset)
 * plus a touch joystick that steers by absolute angle.
 */

export interface JoystickState {
  active: boolean
  angle: number
}

export class Controls {
  actions = { up: false, down: false, left: false, right: false, brake: false, boost: false }
  joystick: JoystickState = { active: false, angle: 0 }
  isTouch = false
  private resetHandlers: Array<() => void> = []

  constructor() {
    this.setKeyboard()
    this.setTouch()
  }

  onReset(handler: () => void): void {
    this.resetHandlers.push(handler)
  }

  private fireReset(): void {
    for (const handler of this.resetHandlers) handler()
  }

  private setKeyboard(): void {
    const map: Record<string, keyof typeof this.actions> = {
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      Space: 'brake',
      ShiftLeft: 'boost', ShiftRight: 'boost'
    }

    window.addEventListener('keydown', (event) => {
      const action = map[event.code]
      if (action) {
        this.actions[action] = true
        event.preventDefault()
      }
      if (event.code === 'KeyR') this.fireReset()
    })

    window.addEventListener('keyup', (event) => {
      const action = map[event.code]
      if (action) this.actions[action] = false
    })
  }

  private setTouch(): void {
    if (!('ontouchstart' in window)) return
    this.isTouch = true
    document.body.classList.add('touch')

    const zone = document.getElementById('joystick')!
    const base = document.getElementById('joy-base')!
    const stick = document.getElementById('joy-stick')!
    let touchId: number | null = null
    let originX = 0
    let originY = 0

    zone.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0]
      touchId = touch.identifier
      originX = touch.clientX
      originY = touch.clientY
      base.style.display = 'block'
      base.style.left = `${originX}px`
      base.style.top = `${originY}px`
      this.joystick.active = true
      event.preventDefault()
    }, { passive: false })

    zone.addEventListener('touchmove', (event) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== touchId) continue
        const deltaX = touch.clientX - originX
        const deltaY = touch.clientY - originY
        // Screen Y grows downward; world angle uses math convention.
        this.joystick.angle = Math.atan2(-deltaY, deltaX)
        const magnitude = Math.min(Math.hypot(deltaX, deltaY), 40)
        const clampedX = Math.cos(this.joystick.angle) * magnitude
        const clampedY = -Math.sin(this.joystick.angle) * magnitude
        stick.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`
      }
      event.preventDefault()
    }, { passive: false })

    const end = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== touchId) continue
        touchId = null
        this.joystick.active = false
        base.style.display = 'none'
        stick.style.transform = 'translate(-50%,-50%)'
      }
    }
    zone.addEventListener('touchend', end)
    zone.addEventListener('touchcancel', end)

    const bindPedal = (id: string, action: 'up' | 'down') => {
      const pedal = document.getElementById(id)!
      pedal.addEventListener('touchstart', (event) => {
        this.actions[action] = true
        event.preventDefault()
      }, { passive: false })
      const release = () => { this.actions[action] = false }
      pedal.addEventListener('touchend', release)
      pedal.addEventListener('touchcancel', release)
    }
    bindPedal('pedal-up', 'up')
    bindPedal('pedal-down', 'down')
  }
}
