import { OrbitControls, TrackballControls, Grid } from '@react-three/drei'
import { Camera, Canvas, useFrame, MeshProps } from '@react-three/fiber'
import { PerspectiveCamera, OrthographicCamera } from "three"
import "./App.css"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useRef } from 'react'

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
  const camera: Camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000)
  camera.position.z = 8
  camera.position.y = 2
  camera.position.x = 2

  const Box = ()=>{
    type MeshRef = extractRef<NonNullable<MeshProps["ref"]>>
    let meshRef = useRef<MeshRef>(null)
    useFrame((state, delta) => {
      if (meshRef.current) {
        // @ts-expect-error dampE doesn't like Euler
        easing.dampE(meshRef.current.rotation, [0, -Math.PI * state.pointer.x, 0], 0.1, delta)
      }
    })
    return (
        <mesh ref={meshRef} position={[0, 2.5 / 2, 0]}>
          <boxGeometry args={[2.5, 2.5, 2.5]} />
          <meshStandardMaterial color="#ca0" />
        </mesh>
    )
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Canvas style={{ background: "#eee", width: "95vw", height: "95vh" }} camera={camera}>
        <ambientLight />
        <directionalLight position={[10, 6, 5]} intensity={5} />
        <Box/>
        <Ground />
      </Canvas>
    </div>
  )
}

export default App
