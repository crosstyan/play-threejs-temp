import { OrbitControls, TrackballControls, Grid, AccumulativeShadows, RandomizedLight, useBVH, useGLTF } from '@react-three/drei'
import { Camera, Canvas, useFrame, MeshProps, useThree, useLoader } from '@react-three/fiber'
import { PerspectiveCamera, OrthographicCamera, TextureLoader, WebGLCubeRenderTarget, Texture, SkeletonHelper } from "three"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useEffect, useRef, useState, memo } from 'react'
import "./App.css"

const skyBoxUrl = "/skybox1.png"
const glbfUrl = "/so.glb"
const isUseSkyBox = false
const Ground = () => {
  const gridConfig = {
    cellSize: 0.5,
    cellThickness: 0.5,
    cellColor: '#6f6f6f',
    sectionSize: 3,
    sectionThickness: 1,
    sectionColor: '#9d4b4b',
    fadeDistance: 12,
    fadeStrength: 0.5,
    followCamera: false,
    infiniteGrid: true
  }
  return <Grid position={[0, 0, 0]} args={[10.5, 10.5]} {...gridConfig} />
}

type extractRef<T> = T extends React.Ref<infer U> ? U : never

function App() {
  // https://codesandbox.io/p/sandbox/cameracontrols-basic-sew669
  // https://sbcode.net/react-three-fiber/camera/
  // https://discourse.threejs.org/t/rotate-gltf-model-with-mouse-move/49425/4
  // https://discourse.threejs.org/t/rotating-a-gltf-mesh-based-on-mouse-position-drops-the-fps-horribly/46990
  // @ts-expect-error type annotation from fiber doesn't like the PerspectiveCamera constructor
  const camera: Camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.z = 8
  camera.position.y = 3
  camera.position.x = 2.5
  const cameraInitRotY = 0
  camera.rotation.y = cameraInitRotY

  const canvasRef = useRef<HTMLCanvasElement>(null)

  interface BoxProps {
    camera?: Camera
  }
  interface Point2D {
    x: number
    y: number
  }

  // https://github.com/pmndrs/drei/blob/master/src/core/OrbitControls.tsx
  // https://github.com/pmndrs/three-stdlib/blob/main/src/controls/OrbitControls.ts
  const Box = (props: BoxProps) => {
    type MeshRef = extractRef<NonNullable<MeshProps["ref"]>>
    let meshRef = useRef<MeshRef>(null)
    const [isDown, setIsDown] = useState(false)
    const [downCoords, setDownCoords] = useState<Point2D>({ x: 0, y: 0 })
    const { scene: globalScene, gl, pointer } = useThree()
    // https://r3f.docs.pmnd.rs/tutorials/loading-models
    const { nodes, scene, materials } = useGLTF(glbfUrl)
    const [helper, setHelper] = useState<SkeletonHelper | null>(null)
    // https://github.com/mrdoob/three.js/blob/master/src/helpers/SkeletonHelper.js

    // TODO: save the rotation as state and update it with the easing function
    useEffect(() => {
      const model = scene.children[0]
      if (model && !helper) {
        // @ts-expect-error fiber
        const h = new SkeletonHelper(model)
        setHelper(h)
      }
      console.log(nodes)
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
      })
      window.addEventListener("mouseup", () => setIsDown(false))
      return () => {
        window.removeEventListener("mousedown", () => setIsDown(true))
        window.removeEventListener("mouseup", () => setIsDown(false))
      }
    }, [])

    useFrame((state, delta) => {
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

          if (props.camera && Math.abs(yDiff) > yDeadZone) {
            if (props.camera.rotation.x > maxCameraRotX) {
              props.camera.rotation.x = maxCameraRotX
            } else if (props.camera.rotation.x < minCameraRotX) {
              props.camera.rotation.x = minCameraRotX
            } else {
              const targetRotX = (() => {
                const target = props.camera.rotation.x + yDiff * 0.025
                if (target > maxCameraRotX) {
                  return maxCameraRotX
                } else if (target < minCameraRotX) {
                  return minCameraRotX
                }
                return target
              })()
              // @ts-expect-error different threejs version
              easing.dampE(props.camera.rotation, [targetRotX, cameraInitRotY, 0], 0.1, delta)
            }
          }
        }
      }
    })
    // https://lisyarus.github.io/blog/posts/gltf-animation.html
    const color = isDown ? "#0ac" : "#ca0"
    // https://threejs.org/docs/#api/en/helpers/SkeletonHelper
    const Payload = () => <primitive object={scene} children-0-castShadow />
    const Helper = () => helper ? <primitive object={helper} /> : null
    return (
      <>
        <mesh ref={meshRef} castShadow position={[0, 0, 0]} scale={2.5}>
          <Payload />
        </mesh>
        <Helper />
      </>
    )
  }

  function Floor() {
    return (
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[1000, 10]} />
        <meshStandardMaterial />
      </mesh>
    )
  }

  // https://sbcode.net/react-three-fiber/shadows/
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Canvas shadows ref={canvasRef} style={{ background: "#eee", width: "100vw", height: "100vh" }} camera={camera}>
        <ambientLight intensity={0.5} />
        <directionalLight castShadow position={[3.3, 6, 4.4]} intensity={5} />
        <Box camera={camera} />
        <Ground />
        <Floor />
      </Canvas>
    </div>
  )
}

export default App
