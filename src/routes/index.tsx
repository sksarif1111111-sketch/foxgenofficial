import React, { useRef, useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  PerspectiveCamera, 
  Environment, 
  Text,
  useCursor,
  RoundedBox,
  MeshTransmissionMaterial
} from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";

const BRAND_NAME = "NEXORA";
const MODEL_NAME = "X1";

// --- Utility: Electric Path Generation ---
const generateElectricPath = (start: THREE.Vector3, end: THREE.Vector3, segments: number = 16) => {
  const pts: THREE.Vector3[] = [];
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(start, end, t);
    if (i > 0 && i < segments) {
      const offset = (Math.random() - 0.5) * 0.2 * length;
      const normal = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      p.add(normal.multiplyScalar(offset));
    }
    pts.push(p);
  }
  return pts;
};

// --- Components ---

const ElectricArc = ({ start, end, color = "#00C8FF", intensity = 1 }: { start: THREE.Vector3, end: THREE.Vector3, color?: string, intensity?: number }) => {
  const lineRef = useRef<THREE.Group>(null!);
  const [points, setPoints] = useState(() => generateElectricPath(start, end));
  
  useFrame((state) => {
    if (lineRef.current) {
      if (Math.random() > 0.85) {
        setPoints(generateElectricPath(start, end));
      }
      lineRef.current.visible = Math.random() > 0.15;
    }
  });

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  return (
    <group ref={lineRef}>
      <mesh>
        <tubeGeometry args={[curve, 20, 0.004, 8, false]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 20, 0.018, 8, false]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={intensity * 20} 
          transparent 
          opacity={0.4}
        />
      </mesh>
    </group>
  );
};

const EnergyRing = () => {
  const group = useRef<THREE.Group>(null!);
  
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.z += 0.003;
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  const segments = [
    { start: 0, end: Math.PI * 0.5 },
    { start: Math.PI * 0.7, end: Math.PI * 1.3 },
    { start: Math.PI * 1.5, end: Math.PI * 1.8 }
  ];

  return (
    <group ref={group} position={[0, 0, -1.5]} rotation={[0.2, 0, 0]}>
      {segments.map((seg, i) => (
        <mesh key={i} rotation={[0, 0, seg.start]}>
          <ringGeometry args={[2.0, 2.03, 64, 1, 0, seg.end - seg.start]} />
          <meshBasicMaterial color="#7A4DFF" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh scale={[1.05, 1.05, 1.05]}>
        <ringGeometry args={[2.05, 2.06, 64]} />
        <meshBasicMaterial color="#00C8FF" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const ElectricArcs = ({ isInteracting }: { isInteracting: boolean }) => {
  const [arcs, setArcs] = useState<{id: number, start: THREE.Vector3, end: THREE.Vector3, color: string}[]>([]);
  
  useFrame(() => {
    const chance = isInteracting ? 0.88 : 0.95;
    if (Math.random() > chance) {
      const id = Math.random();
      const side = Math.random() > 0.5 ? 1 : -1;
      const start = new THREE.Vector3(side * 0.55, (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 0.1);
      const end = new THREE.Vector3(side * 1.2, start.y + (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 0.6);
      
      const newArc = {
        id,
        start,
        end,
        color: Math.random() > 0.4 ? "#00C8FF" : "#7A4DFF",
      };
      
      setArcs(prev => [...prev.slice(-8), newArc]);
      setTimeout(() => {
        setArcs(prev => prev.filter(a => a.id !== id));
      }, 70 + Math.random() * 180);
    }
  });

  return (
    <group>
      {arcs.map(arc => (
        <ElectricArc key={arc.id} start={arc.start} end={arc.end} color={arc.color} />
      ))}
    </group>
  );
};

const CameraLens = ({ position, radius, depth }: { position: [number, number, number], radius: number, depth: number }) => {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius + 0.015, radius + 0.015, 0.02, 48]} />
        <meshStandardMaterial color="#222" metalness={1} roughness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.01]}>
        <cylinderGeometry args={[radius, radius, 0.02, 48]} />
        <meshStandardMaterial color="#050505" metalness={0.9} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <sphereGeometry args={[radius * 0.95, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <MeshTransmissionMaterial 
          backside 
          samples={4} 
          thickness={0.05} 
          chromaticAberration={0.05} 
          anisotropy={0.1} 
          distortion={0.1} 
          distortionScale={0.1} 
          temporalDistortion={0.1} 
          color="#111"
        />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <circleGeometry args={[radius * 0.65, 32]} />
        <meshBasicMaterial color="#00C8FF" transparent opacity={0.15} />
      </mesh>
    </group>
  );
};

const Smartphone = ({ rotation, isInteracting }: { rotation: { x: number, y: number }, isInteracting: React.MutableRefObject<boolean> }) => {
  const group = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.06;
      if (!isInteracting.current) {
        group.current.rotation.y += delta * 0.12;
      }
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotation.x, 0.08);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rotation.y, 0.08);
    }
  });

  const scale = 1.75;

  return (
    <group ref={group} scale={scale} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <RoundedBox args={[1, 2.05, 0.08]} radius={0.07} smoothness={10}>
        <meshStandardMaterial color="#0a0a0a" metalness={0.98} roughness={0.2} />
      </RoundedBox>
      
      <RoundedBox args={[0.96, 2.01, 0.082]} radius={0.07} smoothness={10} position={[0, 0, -0.001]}>
        <meshPhysicalMaterial color="#050505" metalness={0.1} roughness={0.45} transmission={0.1} thickness={0.02} />
      </RoundedBox>

      {/* Side Details */}
      <mesh position={[0.505, 0.4, 0]}>
        <boxGeometry args={[0.01, 0.15, 0.02]} />
        <meshStandardMaterial color="#111" metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[0.505, 0.2, 0]}>
        <boxGeometry args={[0.01, 0.08, 0.02]} />
        <meshStandardMaterial color="#111" metalness={1} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0, 0.041]}>
        <planeGeometry args={[0.94, 1.99]} />
        <meshStandardMaterial color="#000" roughness={0.01} metalness={1} />
      </mesh>
      
      <group position={[0, -0.75, -0.042]} rotation={[0, Math.PI, 0]}>
         <Text
          fontSize={0.06}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.15}
          font="https://fonts.gstatic.com/s/orbitron/v25/yWQX8slNa_qhc2yoSciGCevRpt8.woff"
        >
          {BRAND_NAME}
        </Text>
      </group>

      <group position={[0.22, 0.58, -0.042]} rotation={[0, Math.PI, 0]}>
        <RoundedBox args={[0.48, 0.7, 0.03]} radius={0.06} smoothness={10}>
          <meshStandardMaterial color="#030303" metalness={0.9} roughness={0.1} />
        </RoundedBox>
        <CameraLens position={[0, 0.2, 0.015]} radius={0.1} depth={0.02} />
        <CameraLens position={[0, -0.06, 0.015]} radius={0.1} depth={0.02} />
        <CameraLens position={[0, -0.28, 0.015]} radius={0.07} depth={0.02} />
        <mesh position={[-0.14, 0.2, 0.015]}>
          <circleGeometry args={[0.025, 24]} />
          <meshStandardMaterial color="#222" emissive="#444" emissiveIntensity={1.5} />
        </mesh>
      </group>

      <ElectricArcs isInteracting={isInteracting.current} />
    </group>
  );
};

const Particles = ({ count }: { count: number }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 20;
      p[i * 3 + 1] = (Math.random() - 0.5) * 20;
      p[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return p;
  }, [count]);

  const ref = useRef<THREE.Points>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.0004;
      ref.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.08) * 0.25;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02} 
        color="#00C8FF" 
        transparent 
        opacity={0.25} 
        sizeAttenuation 
        blending={THREE.AdditiveBlending} 
      />
    </points>
  );
};

const Experience = () => {
  const [rotation, setRotation] = useState({ x: 0.12, y: Math.PI * 0.28 });
  const isInteracting = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isInteracting.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isInteracting.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setRotation(prev => ({
      x: THREE.MathUtils.clamp(prev.x + dy * 0.0035, -Math.PI * 0.08, Math.PI * 0.08),
      y: prev.y + dx * 0.007
    }));
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isInteracting.current = false;
  };

  return (
    <div 
      className="w-full h-[100dvh] bg-black cursor-grab active:cursor-grabbing overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={38} />
        <ambientLight intensity={0.08} />
        <spotLight position={[-5, 5, 5]} angle={0.25} penumbra={1} intensity={150} color="#00C8FF" castShadow />
        <pointLight position={[5, 3, -4]} intensity={100} color="#7A4DFF" />
        <rectAreaLight position={[0, 0, 6]} width={12} height={12} intensity={0.6} color="#ffffff" />
        <pointLight position={[0, -5, 3]} intensity={30} color="#00C8FF" />

        <React.Suspense fallback={null}>
          <Smartphone rotation={rotation} isInteracting={isInteracting} />
          <EnergyRing />
          <Environment preset="night" />
          
          <EffectComposer>
            <Bloom luminanceThreshold={0.75} mipmapBlur intensity={3.0} radius={0.6} />
            <Noise opacity={0.02} />
            <Vignette offset={0.35} darkness={0.95} />
          </EffectComposer>
        </React.Suspense>

        <Particles count={200} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]}>
          <planeGeometry args={[25, 25]} />
          <meshStandardMaterial color="#000" roughness={0.15} metalness={0.9} transparent opacity={0.35} />
        </mesh>
      </Canvas>
      
      <IntroOverlay />
    </div>
  );
};

const IntroOverlay = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: [0.75, 1.05, 1], opacity: [0, 1, 1] }}
            transition={{ duration: 2.8, times: [0, 0.75, 1], ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_100px_rgba(0,200,255,1)] mb-10" />
            <h1 className="text-white text-6xl font-extralight tracking-[0.4em] opacity-90">{BRAND_NAME}</h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export function Index() {
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
      <Experience />
      <style>{`
        body { margin: 0; overflow: hidden; background: #000; }
        * { cursor: inherit; }
      `}</style>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    title: "NEXORA X1 | The Future of Mobile Energy",
    meta: [
      { name: "description", content: "A cinematic 3D experience for the revolutionary Nexora X1 smartphone." },
      { property: "og:title", content: "NEXORA X1" },
      { property: "og:description", content: "Discover the future of mobile technology." },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  })
});
