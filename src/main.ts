import { loadAssets } from './Assets'
import { Experience } from './Experience'
import { setupUi } from './ui'

const canvas = document.querySelector<HTMLCanvasElement>('canvas.webgl')!

loadAssets().then((assets) => {
  const experience = new Experience(canvas, assets)
  setupUi(experience.controls.isTouch)
})
