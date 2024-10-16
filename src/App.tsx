import { Grid, useBVH, useGLTF, CameraControls, AccumulativeShadows, OrbitControls } from '@react-three/drei'
import { Camera, Canvas, useFrame, MeshProps, useThree, useLoader } from '@react-three/fiber'
import { PerspectiveCamera, OrthographicCamera, TextureLoader, WebGLCubeRenderTarget, Texture, SkeletonHelper, AnimationMixer, AnimationUtils, Mesh, Material, MeshStandardMaterial, MathUtils } from "three"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useEffect, useRef, useState, memo, Suspense, act } from 'react'
import { useControls, button, buttonGroup, folder } from 'leva'
import { MouseButtons, ACTION, NO_MOUSE, NO_TOUCH } from './wrapper'
import "./App.css"


const glbfUrl = "/binding.glb"
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

  interface Point2D {
    x: number
    y: number
  }

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

    useEffect(() => {
      if (!mixer) {
        const m = new AnimationMixer(scene)
        // https://threejs.org/docs/#api/en/animation/AnimationAction.stop
        for (const clip of animations) {
          const action = m.clipAction(clip)
          action.play()
        }
        setMixer(m)
      }
    }, [])

    useFrame((state, delta) => {
      if (mixer) {
        if (st === PoseStateKey.Loop) {
          mixer.update(delta)
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
      {/* <Ground /> */}
      {/* <Floor /> */}
      <OrbitControls />
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
