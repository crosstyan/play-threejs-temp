import { OrbitControls, TrackballControls, Grid } from '@react-three/drei'
import { Camera, Canvas, useFrame, MeshProps } from '@react-three/fiber'
import { PerspectiveCamera, OrthographicCamera } from "three"
import "./App.css"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useEffect, useRef, useState } from 'react'

const Ground = () => {
  const gridConfig = {
    cellSize: 0.5,
    cellThickness: 0.5,
    cellColor: '#6f6f6f',
    sectionSize: 3,
    sectionThickness: 1,
    sectionColor: '#9d4b4b',
    fadeDistance: 30,
    fadeStrength: 1,
    followCamera: false,
    infiniteGrid: true
  }
  return <Grid position={[0, -0.01, 0]} args={[10.5, 10.5]} {...gridConfig} />
}

type extractRef<T> = T extends React.Ref<infer U> ? U : never

function App() {
  // https://codesandbox.io/p/sandbox/cameracontrols-basic-sew669
  // https://sbcode.net/react-three-fiber/camera/
  // https://discourse.threejs.org/t/rotate-gltf-model-with-mouse-move/49425/4
  // https://discourse.threejs.org/t/rotating-a-gltf-mesh-based-on-mouse-position-drops-the-fps-horribly/46990
  // @ts-expect-error type annotation from fiber doesn't like the PerspectiveCamera constructor
  const camera: Camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight)
  camera.position.z = 7
  camera.position.y = 2
  camera.position.x = 2

  const canvasRef = useRef<HTMLCanvasElement>(null)

  interface BoxProps {
    camera?: Camera
  }
  interface Point2D {
    x: number
    y: number
  }

  // https://github.com/pmndrs/drei/blob/master/src/core/OrbitControls.tsx
  // https://github.com/pmndrs/drei/blob/master/src/core/TrackballControls.tsx
  // https://github.com/pmndrs/three-stdlib/blob/0d281eaddc7487336793cfc866d97f6c9c824f20/src/controls/OrbitControls.ts#L29
  const Box = (props: BoxProps) => {
    type MeshRef = extractRef<NonNullable<MeshProps["ref"]>>
    let meshRef = useRef<MeshRef>(null)
    const [isDown, setIsDown] = useState(false)
    const [downCoords, setDownCoords] = useState<Point2D>({ x: 0, y: 0 })
    const [cameraRotX, setCameraRotX] = useState(0)
    const [boxRotY, setBoxRotY] = useState(0)
    // TODO: save the rotation as state and update it with the easing function
    useEffect(() => {
      // listen for the mouse up, down, and move events
      window.addEventListener("mousedown", (ev) => {
        const normalizePoint = (point: Point2D): Point2D => {
          const W = canvasRef.current!.width
          const H = canvasRef.current!.height
          // use center of the canvas as the origin
          const cX = W / 2
          const cY = H / 2
          const x = (((point.x - cX) / W) + 0.25) * 4
          const y = (((point.y - cY) / H) + 0.25) * -4
          return { x, y }
        }
        setIsDown(true)
        setDownCoords(normalizePoint({ x: ev.clientX, y: ev.clientY }))
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
          // should around [-PI/2, PI/2)
          const maxCameraRotX = Math.PI / 16
          const minCameraRotX = -Math.PI / 12

          const targetRotY = boxRotY + xDiff
          // @ts-expect-error dampE doesn't like Euler
          easing.dampE(meshRef.current.rotation, [0, targetRotY, 0], 0.1, delta)
          setBoxRotY(meshRef.current.rotation.y)

          if (props.camera) {
            if (props.camera.rotation.x > maxCameraRotX){
              props.camera.rotation.x = maxCameraRotX
            } else if (props.camera.rotation.x < minCameraRotX){
              props.camera.rotation.x = minCameraRotX
            } else {
              let targetRotX = props.camera.rotation.x + yDiff * 0.025
              if (targetRotX > maxCameraRotX){
                targetRotX = maxCameraRotX
              } else if (targetRotX < minCameraRotX){
                targetRotX = minCameraRotX
              }
              // @ts-expect-error dampE doesn't like Euler
              easing.dampE(props.camera.rotation, [targetRotX, 0, 0], 0.1, delta)
            }
            setCameraRotX(props.camera.rotation.x)
          }
        }
      }
    })
    const color = isDown ? "#0ac" : "#ca0"
    return (
      <mesh ref={meshRef} position={[0, 2.5 / 2, 0]}>
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
    )
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Canvas ref={canvasRef} style={{ background: "#eee", width: "100vw", height: "100vh" }} camera={camera}>
        <ambientLight />
        <directionalLight position={[10, 6, 5]} intensity={5} />
        <Box camera={camera} />
        <Ground />
      </Canvas>
    </div>
  )
}

export default App
