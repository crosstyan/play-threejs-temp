import { Grid, useBVH, useGLTF, CameraControls } from '@react-three/drei'
import { Camera, Canvas, useFrame, MeshProps, useThree, useLoader } from '@react-three/fiber'
import { PerspectiveCamera, OrthographicCamera, TextureLoader, WebGLCubeRenderTarget, Texture, SkeletonHelper, AnimationMixer, AnimationUtils, Mesh, Material, MeshStandardMaterial, MathUtils } from "three"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useEffect, useRef, useState, memo, Suspense, act } from 'react'
import { useControls, button, buttonGroup, folder } from 'leva'
import { MouseButtons, ACTION } from './wrapper'
import "./App.css"


const skyBoxUrl = "/skybox1.png"
const glbfUrl = "/so.glb"
const isUseSkyBox = false
const cameraInitRotY = 0
const Ground = () => {
  const gridConfig = {
    cellSize: 0.5,
    cellThickness: 0.5,
    cellColor: '#6f6f6f',
    sectionSize: 3,
    sectionThickness: 1,
    sectionColor: '#9d4b4b',
    fadeDistance: 20,
    fadeStrength: 0.5,
    followCamera: false,
    infiniteGrid: true
  }
  return <Grid position-y={-0.01} args={[10.5, 10.5]} {...gridConfig} />
}
const { DEG2RAD } = MathUtils

type extractRef<T> = T extends React.Ref<infer U> ? U : never

const Scene = () => {
  // https://codesandbox.io/p/sandbox/cameracontrols-basic-sew669
  // https://sbcode.net/react-three-fiber/camera/
  // https://discourse.threejs.org/t/rotate-gltf-model-with-mouse-move/49425/4
  // https://discourse.threejs.org/t/rotating-a-gltf-mesh-based-on-mouse-position-drops-the-fps-horribly/46990

  const { camera } = useThree()
  const cameraControlsRef = useRef<CameraControls>(null)
  useControls("Camera", {
    phiGrp: buttonGroup({
      label: 'rotate theta',
      opts: {
        "+45º": () => cameraControlsRef.current?.rotate(45 * DEG2RAD, 0, true),
        "-45º": () => cameraControlsRef.current?.rotate(-45 * DEG2RAD, 0, true)
      }
    }),
    zoomGrp: buttonGroup({
      label: 'zoom',
      opts: {
        '/2': () => cameraControlsRef.current?.zoom(camera.zoom / 2, true),
        '/-2': () => cameraControlsRef.current?.zoom(-camera.zoom / 2, true)
      }
    }),
    dollyGrp: buttonGroup({
      label: 'dolly',
      opts: {
        '1': () => cameraControlsRef.current?.dolly(1, true),
        '-1': () => cameraControlsRef.current?.dolly(-1, true)
      }
    }),
    truckGrp: buttonGroup({
      label: 'truck',
      opts: {
        "x1": () => cameraControlsRef.current?.truck(1, 0, true),
        "-x1": () => cameraControlsRef.current?.truck(-1, 0, true),
        "y1": () => cameraControlsRef.current?.truck(0, 1, true),
        "-y1": () => cameraControlsRef.current?.truck(0, -1, true),
      }
    }),
  })

  interface Point2D {
    x: number
    y: number
  }

  // https://drei.pmnd.rs/?path=/docs/controls-cameracontrols--docs
  useEffect(() => {
    // @ts-expect-error must be PerspectiveCamera
    (camera as PerspectiveCamera).setFocalLength(35)
    camera.position.z = 8
    camera.position.y = 3
    camera.position.x = 2.5
    if (cameraControlsRef.current) {
      cameraControlsRef.current.dolly(-8)
      cameraControlsRef.current.truck(2.5, -3)
      cameraControlsRef.current.minPolarAngle = 0 + Math.PI / 4
      cameraControlsRef.current.maxPolarAngle = Math.PI / 2
    }
    return () => {
      cameraControlsRef.current?.reset()
    }
  }, [])

  // https://github.com/pmndrs/drei/blob/master/src/core/OrbitControls.tsx
  // https://github.com/pmndrs/three-stdlib/blob/main/src/controls/OrbitControls.ts
  const Box = () => {
    type MeshRef = extractRef<NonNullable<MeshProps["ref"]>>
    const meshRef = useRef<MeshRef>(null)
    const [isDown, setIsDown] = useState(false)
    const [downCoords, setDownCoords] = useState<Point2D>({ x: 0, y: 0 })
    const { scene: globalScene, gl, pointer } = useThree()
    // https://r3f.docs.pmnd.rs/tutorials/loading-models
    const { nodes, scene, materials, animations } = useGLTF(glbfUrl)
    const [helper, setHelper] = useState<SkeletonHelper | null>(null)
    const [mixer, setMixer] = useState<AnimationMixer | null>(null)
    // https://github.com/mrdoob/three.js/blob/master/src/helpers/SkeletonHelper.js
    // https://codesandbox.io/p/sandbox/r3f-animation-mixer-8rsdt?
    const { camera } = useThree()

    // TODO: save the rotation as state and update it with the easing function
    useEffect(() => {
      const model = scene.children[0]
      const bodyMaterial = new MeshStandardMaterial()
      // 200 210 240
      const color = "#8EA6F0"
      const colorHold = "#fcba03"
      bodyMaterial.color.set(color)
      const colorSetter = (color: string) => {
        bodyMaterial.color.set(color)
      }
      if (model) {
        // https://discourse.threejs.org/t/gltf-scene-traverse-property-ismesh-does-not-exist-on-type-object3d/27212/2
        model.traverse((o) => {
          if (o instanceof Mesh && o.isMesh) {
            o.castShadow = true
            // _1 postfix is the joint
            if (o.name == "Newton_Headless_Mesh") {
              o.material = bodyMaterial
            }
          }
        })
        if (!helper) {
          // @ts-expect-error fiber
          const h = new SkeletonHelper(model)
          setHelper(h)
        }
      }
      if (!mixer) {
        // @ts-expect-error fiber
        const m = new AnimationMixer(scene)
        // https://threejs.org/docs/#api/en/animation/AnimationAction.stop
        for (const clip of animations) {
          const subclip = AnimationUtils.subclip(clip, clip.uuid, 3, 300, 30)
          const action = m.clipAction(subclip)
          action.timeScale = 1.25
          action.play()
        }
        setMixer(m)
      }

      if (isUseSkyBox) {
        const loader = new TextureLoader()
        const texture = loader.load(
          skyBoxUrl,
          () => {
            const rt = new WebGLCubeRenderTarget(texture.image.height)
            // @ts-expect-error different threejs version
            rt.fromEquirectangularTexture(gl, texture)
            // @ts-expect-error different threejs version
            globalScene.background = rt.texture as Texture
          })
      }
      window.addEventListener("mousedown", (_ev) => {
        setIsDown(true)
        const x = pointer.x
        const y = pointer.y
        setDownCoords({ x, y })
        colorSetter(colorHold)
      })
      window.addEventListener("mouseup", () => {
        setIsDown(false)
        colorSetter(color)
      })
      return () => {
        window.removeEventListener("mousedown", () => setIsDown(true))
        window.removeEventListener("mouseup", () => setIsDown(false))
      }
    }, [])

    useFrame((state, delta) => {
      if (mixer) {
        mixer.update(delta)
      }
      if (meshRef.current) {
        if (isDown) {
          const xDiff = state.pointer.x - downCoords.x
          const yDiff = state.pointer.y - downCoords.y
          const yDeadZone = 0.125
          // should around [-PI/2, PI/2)
          const maxCameraRotX = 0
          const minCameraRotX = -Math.PI / 12

          const boxRotY = meshRef.current.rotation.y
          const targetRotY = boxRotY + xDiff
          // @ts-expect-error dampE doesn't like Euler
          easing.dampE(meshRef.current.rotation, [0, targetRotY, 0], 0.1, delta)

          if (camera && Math.abs(yDiff) > yDeadZone) {
            // if (camera.rotation.x > maxCameraRotX) {
            //   camera.rotation.x = maxCameraRotX
            // } else if (camera.rotation.x < minCameraRotX) {
            //   camera.rotation.x = minCameraRotX
            // } else {
            //   const targetRotX = (() => {
            //     const target = yDiff
            //     // if (target > maxCameraRotX) {
            //     //   return maxCameraRotX
            //     // } else if (target < minCameraRotX) {
            //     //   return minCameraRotX
            //     // }
            //     return target
            //   })()
            // }
            cameraControlsRef.current?.rotate(0, yDiff * DEG2RAD, false)
          }
        }
      }
    })
    // https://lisyarus.github.io/blog/posts/gltf-animation.html
    const color = isDown ? "#0ac" : "#ca0"
    // https://threejs.org/docs/#api/en/helpers/SkeletonHelper
    const Payload = () => <primitive object={scene} />
    const Helper = () => helper ? <primitive object={helper} /> : null
    return (
      <>
        <mesh ref={meshRef} position={[0, -0.05, 0]} scale={2.5}>
          <Payload />
        </mesh>
        <Helper />
      </>
    )
  }

  function Floor() {
    return (
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow>
        <planeGeometry args={[1000, 15]} />
        <meshStandardMaterial />
      </mesh>
    )
  }

  const mouseButton = {
    left: ACTION.NONE,
    middle: ACTION.NONE,
    right: ACTION.NONE,
    wheel: ACTION.NONE,
  } as const

  // https://sbcode.net/react-three-fiber/shadows/
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight castShadow position={[3.3, 6, 4.4]} intensity={5} />
      <Suspense fallback={null}>
        <Box />
      </Suspense>
      <Ground />
      <Floor />
      <CameraControls ref={cameraControlsRef} mouseButtons={mouseButton} />
    </>
  )
}

// make floor background the same color as the grid
function App() {
  return (
    <Canvas shadows style={{ background: "#e9e9e9", width: "100vw", height: "100vh" }}>
      <Scene />
    </Canvas>
  )
}

export default App
