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
  Quaternion,
  Euler,
  KeyframeTrack,
  AnimationClip,
  AxesHelper,
} from "three"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { forwardRef, useEffect, useRef, useState, memo, Suspense, act } from 'react'
import { useControls, button, buttonGroup, folder } from 'leva'
import { BVHLoader } from "three/addons"
import "./App.css"


const glbfUrl = "/pl_no_s.glb"
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
const { DEG2RAD, RAD2DEG } = MathUtils

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
    const bvhPose = useLoader(BVHLoader, "/platform_pose.bvh")
    const [stBone, setBone] = useState<Object3D | null>(null)
    const [bvhSkeleton, setBvhSkeleton] = useState<SkeletonHelper | null>(null)
    const [mixer, setMixer] = useState<AnimationMixer | null>(null)
    const meshRef = useRef<Mesh>(null)
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
        const bone = bvhPose.skeleton.bones[0]
        const skeletonHelper = new SkeletonHelper(bone)
        setBvhSkeleton(skeletonHelper)
        setBone(bone)
        console.info("bones", bvhPose)
      }
      if (!mixer) {
        const bone = bvhPose.skeleton.bones[0]
        const bvhMixer = new AnimationMixer(bone)
        const subClip = AnimationUtils.subclip(bvhPose.clip, "pose", 34, 35)
        const clip = bvhPose.clip
        clip.tracks.forEach((track) => {
          // position for each channel should never change (unless your bone could be lengthened)
          // but we need to rotate the bone to match the three.js coordinate system
          if (track.name.includes(".position")) {
            const values = track.values
            for (let i = 0; i < values.length; i += 3) {
              const vec = new Vector3(values[i], values[i + 1], values[i + 2])
              values[i] = vec.x
              values[i + 1] = vec.y
              values[i + 2] = vec.z
            }
          }
          if (track.name.includes(".quaternion")) {
            // don't need to touch rotation
            const part = track.name.split(".")[0]
            if (part === "LeftArm") {
              const t = 34
              const q = new Quaternion(t * track.values[0], t * track.values[1], t * track.values[2], t * track.values[3])
              const e = new Euler()
              e.setFromQuaternion(q, "ZXY")
              console.info(`LeftArm@${t}`, { x: e.x * RAD2DEG, y: e.y * RAD2DEG, z: e.z * RAD2DEG })
            }
          }
        })
        const quat = new Quaternion()
        quat.setFromEuler(new Euler(0, 0, 0))
        quat.normalize()
        const action = bvhMixer.clipAction(clip)
        action.play()
        console.info("clip", clip)
        setMixer(bvhMixer)
      }
      meshRef.current?.rotateX(-Math.PI / 4)
      return () => {
        if (mixer) {
          mixer.stopAllAction()
        }
      }
    }, [])
    const BvhHipBone = () => (stBone) ? <primitive object={stBone} /> : null
    const BvhSkeleton = () => (bvhSkeleton) ? <primitive object={bvhSkeleton} /> : null
    const SCALE = 1
    return (<>
      <mesh ref={meshRef} position={[0, 0.5, 0]} scale={[SCALE, SCALE, SCALE]}>
        <BvhHipBone />
        <BvhSkeleton />
      </mesh>
    </>)
    // return (<>
    //   <mesh position={[0, 0, 0]} scale={[1, 1, 1]}>
    //     <BvhHipBone />
    //     <BvhSkeleton />
    //   </mesh>
    // </>)
  }

  // bone name as key 
  // [F 3]
  type BoneChannelList = Record<string, Array<[number, number, number]>>

  // https://github.com/pmndrs/drei/blob/master/src/core/OrbitControls.tsx
  // https://github.com/pmndrs/three-stdlib/blob/main/src/controls/OrbitControls.ts
  const MainMesh = (props: MainMeshProps) => {
    type MeshRef = extractRef<NonNullable<MeshProps["ref"]>>
    const meshRef = useRef<MeshRef>(null)
    // https://r3f.docs.pmnd.rs/tutorials/loading-models
    const { nodes, scene, materials, animations } = useGLTF(glbfUrl)
    const [helper, setHelper] = useState<SkeletonHelper | null>(null)
    const [mixer, setMixer] = useState<AnimationMixer | null>(null)
    // const PLATFORM_POSE_URL = "/platform_pose.json"
    const PLATFORM_POSE_URL = "/platform_pose.json"
    // https://github.com/mrdoob/three.js/blob/master/src/helpers/SkeletonHelper.js
    // https://codesandbox.io/p/sandbox/r3f-animation-mixer-8rsdt?

    useEffect(() => {
      const p = new Promise(async (resolve, reject) => {
        const data = await fetch(PLATFORM_POSE_URL)
        const platformSkeleton = await data.json() as BoneChannelList
        const model = scene.children[0]
        if (!helper) {
          const h = new SkeletonHelper(model)
          setHelper(h)
        }
        if (!mixer) {
          const m = new AnimationMixer(scene)
          // https://threejs.org/docs/#api/en/animation/AnimationAction.stop
          const selClip = animations.filter((clip) => clip.name.includes("pose"))[0]
          const setAnimationFromPose = (originalClip: AnimationClip, platformSkeleton: BoneChannelList, frameRate: number = 30) => {
            const frameCount = platformSkeleton["Hips"].length // [F 3]
            const clip = originalClip.clone()
            // times: Float32Array [frameCount]
            // values: Float32Array [frameCount * 3]
            // for quaternion
            // times: Float32Array [frameCount]
            // values: Float32Array [frameCount * 4]
            const setPose = (track: KeyframeTrack) => {
              if (track.name.includes(".position")) {
                const oldValues = track.values
                const vec = new Vector3(oldValues[0], oldValues[1], oldValues[2])
                const values = new Float32Array(frameCount * 3)
                for (let i = 0; i < frameCount; i++) {
                  values[i * 3] = vec.x
                  values[i * 3 + 1] = vec.y
                  values[i * 3 + 2] = vec.z
                }
                const time = new Float32Array(frameCount)
                for (let i = 0; i < frameCount; i++) {
                  time[i] = i / frameRate
                }
                track.times = time
                track.values = values
              }
              if (track.name.includes(".quaternion")) {
                // it's the T-Pose, 
                // we need to rotate it relative to the T-Pose 
                // no idea why setting it to (0, 0, 0) would cause the model to be distorted 
                // (hands and legs are in the sky!)
                const oldValues = track.values
                const refQuat = new Quaternion(oldValues[0], oldValues[1], oldValues[2], oldValues[3])
                const time = new Float32Array(frameCount)
                for (let i = 0; i < frameCount; i++) {
                  time[i] = i / frameRate
                }
                const part = track.name.split(".")[0]
                const targetEuler = platformSkeleton[part] // [F 3]
                const values = new Float32Array(frameCount * 4)
                for (let i = 0; i < frameCount; i++) {
                  // the exported format is Euler in XYZ
                  let q = refQuat.clone()
                  const [x, y, z] = [targetEuler[i][0] * DEG2RAD, (targetEuler[i][1]) * DEG2RAD, targetEuler[i][2] * DEG2RAD]
                  const e = new Euler(x, y, z, "ZXY")
                  // https://github.com/mrdoob/three.js/pull/11540/files
                  // I need to put a XYZ rotation ball to see what's going on
                  // so blender actually did something interesting to convert the Euler from different coordinate system
                  // BVH claims it's Zrotation Xrotation Yrotation, but the numbers are not consistent with what blender displays
                  // Example
                  // at frame number 34, LeftArm
                  //             (X      ,   Y   ,      Z)    Euler
                  // before:     (-56.19 , 30.02 ,   3.39) (unknown, raw BVH channel, but for position it's Y up Z front)
                  // after:      (-27    , 57.23 ,   1.96) (Blender claims it's ZXY Euler)
                  // re-target:  (-28.4  , 55.93 ,  -0.87) 
                  //
                  // intuition: 
                  // blender use  right hand cartesian coordinate system (Z up, X front, Y right)
                  // three.js use right hand cartesian coordinate system (Y up, Z front, X right)
                  // I'm not sure if Euler is related to the coordinate system
                  // Channels should not reversed, unless there's a problem in my export code.
                  //
                  // On coordinate system
                  // https://docs.godotengine.org/en/stable/tutorials/3d/introduction_to_3d.html
                  // Blender import BVH addon
                  // https://github.com/blender/blender/blob/c8dd6650dba63db8b3c97335be703be265c508c6/scripts/addons_core/io_anim_bvh/__init__.py
                  // https://github.com/blender/blender/blob/c8dd6650dba63db8b3c97335be703be265c508c6/scripts/addons_core/io_anim_bvh/import_bvh.py
                  // Three.js BVH loader
                  // https://github.com/mrdoob/three.js/blob/4c36f5f3ce0c6ba2c15ffb15960332af158197f6/examples/jsm/loaders/BVHLoader.js#L177-L190
                  const blenderVecLA = new Euler(-28.4 * DEG2RAD, 55.93 * DEG2RAD, -0.87 * DEG2RAD, "ZXY")
                  const tempE = new Euler(-90 * DEG2RAD, 0, -102.69 * DEG2RAD, "ZXY")
                  const emptyVec = new Euler(0, 0, 0)
                  if (part === "RightArm") {
                    const qT = new Quaternion()
                    qT.setFromEuler(e)
                    q.multiply(qT)
                  } else if (part === "LeftArm") {
                    const qT = new Quaternion()
                    qT.setFromEuler(tempE)
                    q.multiply(qT)
                    if (i === 34) {
                      const ee = new Euler()
                      ee.setFromQuaternion(q, "ZXY")
                      console.info("LeftArm", { x: e.x * RAD2DEG, y: e.y * RAD2DEG, z: e.z * RAD2DEG })
                    }
                  } else {
                    const qT = new Quaternion()
                    qT.setFromEuler(e)
                    q.multiply(qT)
                  }
                  values[i * 4 + 0] = q.x
                  values[i * 4 + 1] = q.y
                  values[i * 4 + 2] = q.z
                  values[i * 4 + 3] = q.w
                }
                track.times = time
                track.values = values
              }
            }
            clip.tracks.forEach(setPose)
            clip.tracks = clip.tracks.filter((track) => !track.name.includes(".scale"))
            clip.duration = frameCount / frameRate
            return clip
          }
          const newClip = setAnimationFromPose(selClip, platformSkeleton)
          const subClip = AnimationUtils.subclip(newClip, "pose", 34, 35)
          // const subClip = AnimationUtils.subclip(newClip, "pose", 0, 1)
          const action = m.clipAction(subClip)
          action.play()
          setMixer(m)
        }
      })
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
        <mesh ref={meshRef} position={[0, -0.05, 0]} scale={1}>
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
  // The X axis is red. The Y axis is green. The Z axis is blue.
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight castShadow position={[3.3, 6, 4.4]} intensity={5} />
      <Suspense fallback={null}>
        {/* <MainMesh poseState={poseState} /> */}
        <BvhMesh />
      </Suspense>
      <axesHelper args={[1]} position={[-1, 0, 0]} />
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
