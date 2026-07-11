import { Experience } from './Experience'
import { setupUi } from './ui'

const canvas = document.querySelector<HTMLCanvasElement>('canvas.webgl')!
const experience = new Experience(canvas)
setupUi(experience.controls.isTouch)
