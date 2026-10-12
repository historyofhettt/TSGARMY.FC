import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

function ParticleField({ count = 900 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.03;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.08;
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#3aa0ff"
        size={0.035}
        sizeAttenuation
        depthWrite={false}
        opacity={0.7}
      />
    </Points>
  );
}

function Emblem() {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (outer.current) {
      outer.current.rotation.z += delta * 0.12;
      outer.current.rotation.x = Math.sin(t * 0.3) * 0.25;
    }
    if (inner.current) {
      inner.current.rotation.z -= delta * 0.2;
      inner.current.rotation.y = Math.cos(t * 0.25) * 0.3;
    }
    if (core.current) {
      core.current.rotation.y += delta * 0.4;
      core.current.rotation.x += delta * 0.15;
      const s = 1 + Math.sin(t * 1.4) * 0.05;
      core.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      <mesh ref={outer}>
        <torusGeometry args={[2.2, 0.02, 12, 120]} />
        <meshBasicMaterial color="#3aa0ff" transparent opacity={0.55} />
      </mesh>
      <mesh ref={inner} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.7, 0.015, 12, 100]} />
        <meshBasicMaterial color="#ff3b57" transparent opacity={0.5} />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial
          color="#0a1428"
          emissive="#1b4f8a"
          emissiveIntensity={0.9}
          wireframe
        />
      </mesh>
    </group>
  );
}

function CameraRig() {
  useFrame((state) => {
    const { pointer, camera } = state;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.7, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pointer.y * 0.45, 0.04);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Cinematic hero backdrop: particles + rotating emblem, red/blue lighting. */
export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 55 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 2, 4]} color="#3aa0ff" intensity={22} />
      <pointLight position={[-4, -2, 3]} color="#ff3b57" intensity={18} />
      <ParticleField />
      <Emblem />
      <CameraRig />
    </Canvas>
  );
}
