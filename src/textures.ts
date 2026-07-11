import * as THREE from 'three'

/** Canvas label textures — every "asset" in this project is generated at runtime. */

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** A toy letter block face: letter centered on a colored tile. */
export function letterTexture(letter: string, bg: string, fg: string): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 14
  ctx.strokeRect(10, 10, size - 20, size - 20)

  ctx.fillStyle = fg
  ctx.font = '900 170px "Segoe UI", "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, size / 2, size / 2 + 10)
  return canvasTexture(canvas)
}

/** Project board face: name + tag + accent bar. */
export function boardTexture(name: string, tag: string, accent: string): THREE.CanvasTexture {
  const w = 512
  const h = 340
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f7f2e7'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, w, 26)
  ctx.fillRect(0, h - 26, w, 26)

  ctx.fillStyle = '#2c2c34'
  ctx.font = '800 58px "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, w / 2, h / 2 - 34)

  ctx.fillStyle = accent
  ctx.font = '600 30px "Segoe UI", sans-serif'
  ctx.fillText(tag, w / 2, h / 2 + 40)

  ctx.fillStyle = 'rgba(44,44,52,0.45)'
  ctx.font = '600 22px "Segoe UI", sans-serif'
  ctx.fillText('CLICK / TAP', w / 2, h - 62)
  return canvasTexture(canvas)
}

/** Flat ground marker text (drawn on an alpha plane). */
export function markerTexture(text: string): THREE.CanvasTexture {
  const w = 1024
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(90,55,10,0.55)'
  ctx.font = '900 130px "Segoe UI", "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2)
  return canvasTexture(canvas)
}

/** Soft radial blob (car shadow / dust particle). */
export function blobTexture(rgba = '60,40,10'): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${rgba},0.55)`)
  grad.addColorStop(0.7, `rgba(${rgba},0.25)`)
  grad.addColorStop(1, `rgba(${rgba},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return canvasTexture(canvas)
}
