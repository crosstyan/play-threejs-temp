import { Grid, useBVH, useGLTF, CameraControls, AccumulativeShadows } from '@react-three/drei'
import { Camera, Canvas, useFrame, MeshProps, useThree, useLoader } from '@react-three/fiber'
import { PerspectiveCamera, OrthographicCamera, TextureLoader, WebGLCubeRenderTarget, Texture, SkeletonHelper, AnimationMixer, AnimationUtils, Mesh, Material, MeshStandardMaterial, MathUtils } from "three"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useEffect, useRef, useState, memo, Suspense, act } from 'react'
import { useControls, button, buttonGroup, folder } from 'leva'
import { MouseButtons, ACTION, NO_MOUSE, NO_TOUCH } from './wrapper'
import "./App.css"


type Action = "platform" | "leaving"
const skyBoxUrl = "/skybox1.png"
// const glbfUrl = "/so.glb"
const actionSel = "platform" as Action
const glbfUrl = (() => {
  if (actionSel === "platform") {
    return "/plso.glb"
  } else if (actionSel === "leaving") {
    return "/so.glb"
  } else {
    throw new Error("Invalid action")
  }
})()
const isUseSkyBox = false
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
const FPS = 30

enum PoseStateKey {
  Loop,
  Focus,
}

type PoseFocusPayload = {
  frameNumber: number
  position: [number, number, number],
  target: [number, number, number],
}

type PoseState = [PoseStateKey.Loop, null] | [PoseStateKey.Focus, PoseFocusPayload]

const defaultCamera = {
  "enabled": true,
  "minDistance": 0.1,
  "maxDistance": 1000,
  "minZoom": 0.01,
  "maxZoom": 100,
  "minPolarAngle": Math.PI / 4,
  "maxPolarAngle": Math.PI / 2,
  "minAzimuthAngle": -Infinity,
  "maxAzimuthAngle": Infinity,
  "smoothTime": 0.25,
  "draggingSmoothTime": 0.125,
  "dollySpeed": 1,
  "truckSpeed": 2,
  "dollyToCursor": false,
  "verticalDragToForward": false,
  "target": [2.5, 3, 0],
  "position": [2.5, 3, 13],
  "zoom": 1,
  "focalOffset": [0, 0, 0],
  "target0": [0, 0, 0],
  "position0": [0, 0, 5],
  "zoom0": 1,
  "focalOffset0": [0, 0, 0],
} as const

const Scene = () => {
  // https://codesandbox.io/p/sandbox/cameracontrols-basic-sew669
  // https://sbcode.net/react-three-fiber/camera/
  // https://discourse.threejs.org/t/rotate-gltf-model-with-mouse-move/49425/4
  // https://discourse.threejs.org/t/rotating-a-gltf-mesh-based-on-mouse-position-drops-the-fps-horribly/46990

  // I guess this example could help set an offset to the camera
  // https://github.com/yomotsu/camera-controls/blob/dev/examples/padding-with-view-offset.html
  const [poseState, setPoseState] = useState<PoseState>([PoseStateKey.Loop, null])

  const { camera } = useThree()
  const cameraControlsRef = useRef<CameraControls>(null)

  const restrictCamera = () => {
    if (cameraControlsRef.current) {
      cameraControlsRef.current.minPolarAngle = 0 + Math.PI / 4
      cameraControlsRef.current.maxPolarAngle = Math.PI / 2
    }
  }

  const unrestrictCamera = () => {
    if (cameraControlsRef.current) {
      cameraControlsRef.current.minPolarAngle = 0
      cameraControlsRef.current.maxPolarAngle = Math.PI
    }
  }

  const initCamera = (enableTransition: boolean = false) => {
    // @ts-expect-error must be PerspectiveCamera
    (camera as PerspectiveCamera).setFocalLength(35)
    cameraControlsRef.current?.fromJSON(JSON.stringify(defaultCamera), enableTransition)
  }

  useControls("选项", {
    stateGrp: buttonGroup({
      label: "状态",
      opts: {
        "循环播放": () => {
          setPoseState([PoseStateKey.Loop, null])
          initCamera(true)
        },
        "侧面标准": () => {
          // note that each time the focus button is clicked, 
          // the mesh will be reset
          unrestrictCamera()
          const position = [9, 1.5, 0] as [number, number, number]
          const target = [0, 1.5, 0] as [number, number, number]
          const payload = {
            frameNumber: 100,
            position,
            target,
          }
          setPoseState([PoseStateKey.Focus, payload])
          cameraControlsRef.current?.setLookAt(position[0], position[1], position[2], target[0], target[1], target[2], true)
        }
      }
    })
  })

  interface Point2D {
    x: number
    y: number
  }

  // https://drei.pmnd.rs/?path=/docs/controls-cameracontrols--docs
  useEffect(() => {
    initCamera()
    return () => {
      cameraControlsRef.current?.reset()
    }
  }, [])

  interface MainMeshProps {
    poseState: PoseState
  }

  // https://github.com/pmndrs/drei/blob/master/src/core/OrbitControls.tsx
  // https://github.com/pmndrs/three-stdlib/blob/main/src/controls/OrbitControls.ts
  const MainMesh = (props: MainMeshProps) => {
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
    const [st, payload] = props.poseState

    // TODO: save the rotation as state and update it with the easing function
    useEffect(() => {
      camera.far = 1000
      camera.near = 0.01
      const model = scene.children[0]
      const bodyMaterial = new MeshStandardMaterial()
      const headMaterial = new MeshStandardMaterial()
      headMaterial.color.set("#333")
      const color = "#8EA6F0"
      const colorHold = "#fcba03"
      const colorSetter = (color: string) => {
        bodyMaterial.color.set(color)
      }
      colorSetter(color)
      if (model) {
        // https://discourse.threejs.org/t/gltf-scene-traverse-property-ismesh-does-not-exist-on-type-object3d/27212/2
        model.traverse((o) => {
          if (o instanceof Mesh && o.isMesh) {
            o.castShadow = true
            // _1 postfix is the joint
            if (o.name == "Newton_Headless_Mesh") {
              o.material = bodyMaterial
            } else {
              o.material = headMaterial
            }
          }
        })
        if (!helper) {
          // @ts-expect-error fiber
          const h = new SkeletonHelper(model)
          setHelper(h)
          console.info(h)
        }
      }
      if (!mixer) {
        // @ts-expect-error fiber
        const m = new AnimationMixer(scene)
        // https://threejs.org/docs/#api/en/animation/AnimationAction.stop
        for (const clip of animations) {
          if (actionSel === "leaving") {
            const subclip = AnimationUtils.subclip(clip, clip.name, 3, 300, FPS)
            const action = m.clipAction(subclip)
            action.timeScale = 1.25
            action.play()
          } else if (actionSel === "platform") {
            const subclip = AnimationUtils.subclip(clip, clip.name, 120, 380, FPS)
            const action = m.clipAction(subclip)
            action.timeScale = 1.25
            action.play()
          }
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
      const onDown = (_ev: MouseEvent | TouchEvent) => {
        setIsDown(true)
        const x = pointer.x
        const y = pointer.y
        setDownCoords({ x, y })
        colorSetter(colorHold)
      }
      const onUp = (_ev: MouseEvent | TouchEvent) => {
        setIsDown(false)
        colorSetter(color)
      }
      window.addEventListener("mousedown", onDown)
      window.addEventListener("touchstart", onDown)
      window.addEventListener("mouseup", onUp)
      window.addEventListener("touchend", onUp)
      return () => {
        window.removeEventListener("mousedown", onDown)
        window.removeEventListener("touchstart", onDown)
        window.removeEventListener("mouseup", onUp)
        window.removeEventListener("touchend", onUp)
      }
    }, [])

    useFrame((state, delta) => {
      if (mixer) {
        if (st === PoseStateKey.Loop) {
          mixer.update(delta)
        } else if (st === PoseStateKey.Focus) {
          const { frameNumber } = payload
          mixer.setTime(frameNumber / FPS)
        }
      }
      if (meshRef.current) {
        if (isDown && st === PoseStateKey.Loop) {
          const xDiff = state.pointer.x - downCoords.x
          const yDiff = state.pointer.y - downCoords.y
          const yDeadZone = 0.125

          const targetRotY = meshRef.current.rotation.y + xDiff * DEG2RAD * 75
          // @ts-expect-error dampE doesn't like Euler
          easing.dampE(meshRef.current.rotation, [0, targetRotY, 0], 0.1, delta)

          if (camera && Math.abs(yDiff) > yDeadZone) {
            cameraControlsRef.current?.rotate(0, yDiff * DEG2RAD, false)
          }
        }
      }
    })
    // https://lisyarus.github.io/blog/posts/gltf-animation.html
    // https://threejs.org/docs/#api/en/helpers/SkeletonHelper
    const Payload = () => <primitive object={scene} />
    const Helper = () => (helper && st === PoseStateKey.Focus) ? <primitive object={helper} /> : null
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

  // https://sbcode.net/react-three-fiber/shadows/
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight castShadow position={[3.3, 6, 4.4]} intensity={5} />
      <Suspense fallback={null}>
        <MainMesh poseState={poseState} />
      </Suspense>
      <Ground />
      <Floor />
      <CameraControls ref={cameraControlsRef} mouseButtons={NO_MOUSE} touches={NO_TOUCH} />
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
