import { OrbitControls } from '@react-three/drei'
import { Camera, Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from "three"
import "./App.css"

function App() {
  // https://sbcode.net/react-three-fiber/camera/
  // https://discourse.threejs.org/t/rotate-gltf-model-with-mouse-move/49425/4
  // @ts-expect-error type annotation from fiber doesn't like the PerspectiveCamera constructor
  const camera: Camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
  camera.position.z = 5
  camera.position.y = 2
  camera.position.x = 2

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Canvas style={{ background: "#ccc", width: "95vw", height: "95vh" }} camera={camera}>
        <ambientLight />
        <directionalLight position={[10, 6, 5]} intensity={5} />
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 5, 1]} />
          <meshStandardMaterial color="blue" />
        </mesh>
        <OrbitControls camera={camera} />
      </Canvas>
    </div>
  )
}

export default App
