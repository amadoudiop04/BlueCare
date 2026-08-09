import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Papillon rendu en art ASCII, porte depuis `ASCIIText.jsx` de la maquette.
 *
 * Le principe : un papillon est dessine sur un canvas 2D, applique comme
 * texture sur un plan Three.js legerement ondule, puis le rendu WebGL est
 * relu pixel par pixel et remplace par des caracteres selon la luminosite.
 *
 * Ecart avec la version maquette : celle-ci s'appuyait sur `window.THREE`
 * charge par un <script> et sur des globales React. Ici tout est importe,
 * l'animation s'arrete quand le composant disparait ou quand l onglet passe
 * en arriere-plan, et l'effet est desactive si l utilisateur a demande a
 * reduire les animations.
 */

const VERTEX_SHADER = `
varying vec2 vUv;
uniform float uTime;
uniform float uEnableWaves;
void main() {
  vUv = uv;
  float time = uTime * 5.0;
  vec3 transformed = position;
  transformed.x += sin(time + position.y) * 0.5 * uEnableWaves;
  transformed.y += cos(time + position.z) * 0.15 * uEnableWaves;
  transformed.z += sin(time + position.x) * uEnableWaves;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`

const FRAGMENT_SHADER = `
varying vec2 vUv;
uniform float uTime;
uniform sampler2D uTexture;
void main() {
  vec2 pos = vUv;
  float r = texture2D(uTexture, pos + cos(uTime * 2.0 - uTime + pos.x) * 0.01).r;
  float g = texture2D(uTexture, pos + tan(uTime * 0.5 + pos.x - uTime) * 0.01).g;
  float b = texture2D(uTexture, pos - cos(uTime * 2.0 + uTime + pos.y) * 0.01).b;
  float a = texture2D(uTexture, pos).a;
  gl_FragColor = vec4(r, g, b, a);
}
`

const CHARSET = ' .\'`^",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
const FONT = "'IBM Plex Mono', monospace"

/** Dessine le papillon sur un canvas : c est la source de la texture. */
function drawButterfly(canvas, color) {
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const cx = w / 2
  const cy = h / 2
  const s = h / 2

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = color

  const wing = (dir) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.12)
    ctx.bezierCurveTo(cx + dir * s * 0.3, cy - s * 1.05, cx + dir * s * 1.18, cy - s * 0.95, cx + dir * s * 1.02, cy - s * 0.22)
    ctx.bezierCurveTo(cx + dir * s * 0.95, cy + s * 0.06, cx + dir * s * 0.4, cy + s * 0.04, cx + dir * s * 0.16, cy + s * 0.02)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx, cy + s * 0.02)
    ctx.bezierCurveTo(cx + dir * s * 0.3, cy + s * 0.1, cx + dir * s * 0.86, cy + s * 0.34, cx + dir * s * 0.66, cy + s * 0.86)
    ctx.bezierCurveTo(cx + dir * s * 0.44, cy + s * 1.02, cx + dir * s * 0.12, cy + s * 0.62, cx + dir * s * 0.06, cy + s * 0.22)
    ctx.closePath()
    ctx.fill()
  }

  wing(1)
  wing(-1)

  // Corps et tete.
  ctx.beginPath()
  ctx.ellipse(cx, cy + s * 0.16, s * 0.055, s * 0.62, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx, cy - s * 0.36, s * 0.085, s * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()

  // Antennes.
  ctx.lineWidth = Math.max(2, s * 0.035)
  ctx.strokeStyle = color
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + dir * s * 0.03, cy - s * 0.48)
    ctx.quadraticCurveTo(cx + dir * s * 0.3, cy - s * 0.92, cx + dir * s * 0.52, cy - s * 0.8)
    ctx.stroke()
  }
}

function AsciiButterfly({
  fontSize = 7,
  planeHeight = 15,
  color = '#ffffff',
  gradient = 'linear-gradient(95deg, #FFFFFF 0%, #C9E2FF 42%, #8FC0FF 72%, #FFFFFF 100%)',
  className,
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    // Respect de `prefers-reduced-motion` : l'effet est purement decoratif.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined

    let renderer
    let frameId = null
    let disposed = false

    const source = document.createElement('canvas')
    source.width = 460
    source.height = Math.round(460 * 0.78)
    drawButterfly(source, color)

    const texture = new THREE.CanvasTexture(source)
    texture.minFilter = THREE.NearestFilter

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.z = 30

    const aspect = source.width / source.height
    const geometry = new THREE.PlaneGeometry(planeHeight * aspect, planeHeight, 36, 36)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: texture },
        uEnableWaves: { value: 1 },
      },
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    } catch {
      return undefined // pas de WebGL : le bloc reste simplement vide
    }
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)

    // Le rendu WebGL est reduit a une grille de caracteres.
    const pre = document.createElement('pre')
    Object.assign(pre.style, {
      margin: '0',
      padding: '0',
      position: 'absolute',
      inset: '0',
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      lineHeight: '1em',
      backgroundImage: gradient,
      backgroundSize: '100% 100%',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      userSelect: 'none',
      pointerEvents: 'none',
    })
    container.appendChild(pre)

    const sampler = document.createElement('canvas')
    const samplerCtx = sampler.getContext('2d', { willReadFrequently: true })
    samplerCtx.imageSmoothingEnabled = false

    const pointer = { x: 0.5, y: 0.5 }

    const setSize = (width, height) => {
      if (width <= 0 || height <= 0) return

      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()

      samplerCtx.font = `${fontSize}px ${FONT}`
      const charWidth = samplerCtx.measureText('A').width || fontSize * 0.6
      sampler.width = Math.max(1, Math.floor(width / charWidth))
      sampler.height = Math.max(1, Math.floor(height / fontSize))
      samplerCtx.imageSmoothingEnabled = false
    }

    const asciify = () => {
      const { width: w, height: h } = sampler
      if (!w || !h) return

      samplerCtx.clearRect(0, 0, w, h)
      samplerCtx.drawImage(renderer.domElement, 0, 0, w, h)

      const { data } = samplerCtx.getImageData(0, 0, w, h)
      const rows = []

      for (let y = 0; y < h; y += 1) {
        let row = ''
        for (let x = 0; x < w; x += 1) {
          const i = (x + y * w) * 4
          if (data[i + 3] === 0) {
            row += ' '
            continue
          }
          const gray = (0.3 * data[i] + 0.6 * data[i + 1] + 0.1 * data[i + 2]) / 255
          // `invert` de la maquette : les zones claires prennent les glyphes denses.
          row += CHARSET[CHARSET.length - 1 - Math.floor((1 - gray) * (CHARSET.length - 1))]
        }
        rows.push(row)
      }

      pre.textContent = rows.join('\n')
    }

    const renderFrame = () => {
      const time = Math.sin(Date.now() * 0.001)
      material.uniforms.uTime.value = time

      // Legere inclinaison qui suit le curseur.
      mesh.rotation.x += ((pointer.y - 0.5) * -1 - mesh.rotation.x) * 0.05
      mesh.rotation.y += ((pointer.x - 0.5) * 1 - mesh.rotation.y) * 0.05

      renderer.render(scene, camera)
      asciify()
    }

    const loop = () => {
      if (disposed) return
      frameId = requestAnimationFrame(loop)
      renderFrame()
    }

    const onPointerMove = (event) => {
      const bounds = container.getBoundingClientRect()
      pointer.x = (event.clientX - bounds.left) / bounds.width
      pointer.y = (event.clientY - bounds.top) / bounds.height
    }

    // Onglet en arriere-plan : inutile de continuer a calculer des frames.
    const onVisibility = () => {
      if (document.hidden) {
        if (frameId) cancelAnimationFrame(frameId)
        frameId = null
      } else if (!frameId && !disposed) {
        loop()
      }
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize(width, height)
    })
    observer.observe(container)

    const bounds = container.getBoundingClientRect()
    setSize(bounds.width, bounds.height)

    container.addEventListener('pointermove', onPointerMove)
    document.addEventListener('visibilitychange', onVisibility)
    loop()

    return () => {
      disposed = true
      if (frameId) cancelAnimationFrame(frameId)
      observer.disconnect()
      container.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibility)
      pre.remove()
      geometry.dispose()
      material.dispose()
      texture.dispose()
      renderer.dispose()
    }
  }, [fontSize, planeHeight, color, gradient])

  return <div ref={containerRef} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />
}

export default AsciiButterfly
