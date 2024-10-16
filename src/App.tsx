import { Grid, useBVH, useGLTF, CameraControls, AccumulativeShadows, OrbitControls } from '@react-three/drei'
import { Camera, Canvas, useFrame, MeshProps, useThree, useLoader } from '@react-three/fiber'
import {
  PerspectiveCamera,
  OrthographicCamera,
  TextureLoader,
  WebGLCubeRenderTarget,
  Texture,
  SkeletonHelper,
  AnimationMixer,
  AnimationUtils,
  Mesh,
  Material,
  MeshStandardMaterial,
  MathUtils,
  Object3D,
  Box3,
  Vector3,
  Matrix4,
} from "three"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useEffect, useRef, useState, memo, Suspense, act } from 'react'
import { useControls, button, buttonGroup, folder } from 'leva'
import { BVHLoader } from "three/addons"
import { getBasisTransform } from './transform'
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

function fitCameraToObject(controls: CameraControls, object: Object3D,
  offset = 1.25, phi = Math.PI / 4, theta = Math.PI / 4) {
  const boundingBox = new Box3().setFromObject(object)
  const center = boundingBox.getCenter(new Vector3())
  const size = boundingBox.getSize(new Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  // @ts-expect-error
  const fov = controls.camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov / 2)) * offset

  controls.setLookAt(
    center.x + cameraZ * Math.sin(theta) * Math.cos(phi),
    center.y + cameraZ * Math.sin(phi),
    center.z + cameraZ * Math.cos(theta) * Math.cos(phi),
    center.x,
    center.y,
    center.z,
    true
  )
}

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

  // https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_bvh.html
  const BvhMesh = () => {
    const bvhPose = useLoader(BVHLoader, "/plpl_xzy.bvh")
    const [stBone, setBone] = useState<Object3D | null>(null)
    const [bvhSkeleton, setBvhSkeleton] = useState<SkeletonHelper | null>(null)
    const [mixer, setMixer] = useState<AnimationMixer | null>(null)
  //   const bvhToThreeMatrix = new Matrix4().set(
	// 1.0, 0.0, 0.0, 0.0,
	// 0.0, 0.0, 1.0, 0.0,
	// 0.0, -1.0, 0.0, 0.0,
	// 0.0, 0.0, 0.0, 1.0
  //   );
  // const bvhToThreeMatrix = new Matrix4()
  // const threeJsAxes = "+X+Y+Z"
  // const blenderAxes = "+X+Z+Y"
  // getBasisTransform(blenderAxes, threeJsAxes, bvhToThreeMatrix)


    useFrame((state, delta) => {
      if (mixer) {
        mixer.update(delta)
      }
    })
    useEffect(() => {
      if (!bvhSkeleton) {
        // bvhPose.skeleton.bones.forEach((bone) => {
        //   bone.applyMatrix4(bvhToThreeMatrix)
        // })
        const bone = bvhPose.skeleton.bones[0]
        const skeletonHelper = new SkeletonHelper(bone)
        setBvhSkeleton(skeletonHelper)
        setBone(bone)
        console.info("bones", bvhPose)
        // console.info("conversionMatrix", bvhToThreeMatrix)
        const rotTracks = bvhPose.clip.tracks.filter((track) => track.name.includes(".quaternion"))
        // for (const track of rotTracks) {
        //   for (let i = 0; i < track.values.length; i += 4) {
        //     const temp = track.values[i];
        //     track.values[i] = track.values[i + 1];
        //     track.values[i + 1] = track.values[i + 2];
        //     track.values[i + 2] = temp;
        //     track.values[i + 3] = -track.values[i + 3];
        //   }
        // }
      }
      if (!mixer) {
        const bone = bvhPose.skeleton.bones[0]
        const bvhMixer = new AnimationMixer(bone)
        const bvhAction = bvhMixer.clipAction(bvhPose.clip)
        bvhAction.play()
        setMixer(bvhMixer)
      }
    }, [])
    const BvhHipBone = () => (stBone) ? <primitive object={stBone} /> : null
    const BvhSkeleton = () => (bvhSkeleton) ? <primitive object={bvhSkeleton} /> : null
    return (<>
      <BvhHipBone />
      <BvhSkeleton />
    </>)
  }

  // https://github.com/pmndrs/drei/blob/master/src/core/OrbitControls.tsx
  // https://github.com/pmndrs/three-stdlib/blob/main/src/controls/OrbitControls.ts
  const MainMesh = (props: MainMeshProps) => {
    type MeshRef = extractRef<NonNullable<MeshProps["ref"]>>
    const meshRef = useRef<MeshRef>(null)
    // https://r3f.docs.pmnd.rs/tutorials/loading-models
    const { nodes, scene, materials, animations } = useGLTF(glbfUrl)
    const [helper, setHelper] = useState<SkeletonHelper | null>(null)
    const [mixer, setMixer] = useState<AnimationMixer | null>(null)
    // https://github.com/mrdoob/three.js/blob/master/src/helpers/SkeletonHelper.js
    // https://codesandbox.io/p/sandbox/r3f-animation-mixer-8rsdt?

    useEffect(() => {

      const model = scene.children[0]
      if (!helper) {
        const h = new SkeletonHelper(model)
        setHelper(h)
      }
      if (!mixer) {
        const m = new AnimationMixer(scene)
        // https://threejs.org/docs/#api/en/animation/AnimationAction.stop
        for (const clip of animations) {
          // for some reason there are still redundant motion data left 
          // only pick `pose` entries
          if (clip.name.includes("pose")) {
            const action = m.clipAction(clip)
            console.log("clip", clip)
            // action.play()
          }
        }
        setMixer(m)
      }
    }, [])

    useFrame((state, delta) => {
      if (mixer) {
        mixer.update(delta)
      }
    })

    // https://lisyarus.github.io/blog/posts/gltf-animation.html
    // https://threejs.org/docs/#api/en/helpers/SkeletonHelper
    const Payload = () => <primitive object={scene} />
    const Helper = () => (helper) ? <primitive object={helper} /> : null
    return (
      <>
        <mesh ref={meshRef} position={[0, -0.05, 0]} scale={0.015}>
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
        <BvhMesh />
      </Suspense>
      <Ground />
      <CameraControls
        ref={cameraControlsRef}
        enabled={true}
      />
      {/* <Floor /> */}
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
