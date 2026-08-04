import React, { useRef, useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { 
  PerspectiveCamera, 
  Environment, 
  Text,
  useCursor,
  RoundedBox,
  Float
} from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";

const BRAND_NAME = "NEXORA";
const MODEL_NAME = "X1";

// --- Utility: Electric Path Generation ---
const generateElectricPath = (start: THREE.Vector3, end: THREE.Vector3, segments: number = 12) => {
  const pts: THREE.Vector3[] = [];
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(start, end, t);
    if (i > 0 && i < segments) {
      // Add jaggedness
      const offset = (Math.random() - 0.5) * 0.15 * length;
      const normal = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      p.add(normal.multiplyScalar(offset));
      
      // Add occasional branching points
      if (Math.random() > 0.8) {
         // This logic is simplified for basic segment variation
      }
    }
    pts.push(p);
  }
  return pts;
};

// --- Components ---

const ElectricArc = ({ start, end, color = "#00C8FF", intensity = 1 }: { start: THREE.Vector3, end: THREE.Vector3, color?: string, intensity?: number }) => {
  const lineRef = useRef<THREE.Mesh>(null!);
  const [visible, setVisible] = useState(true);
  
  const points = useMemo(() => generateElectricPath(start, end), [start, end]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame((state) => {
    if (lineRef.current) {
      // Rapid flickering / movement
      const flicker = Math.random();
      lineRef.current.visible = flicker > 0.2;
      if (flicker > 0.9) {
        lineRef.current.scale.setScalar(0.9 + Math.random() * 0.3);
      }
    }
  });

  return (
    <group>
      {/* Core (White) */}
      <mesh ref={lineRef}>
        <tubeGeometry args={[curve, 16, 0.003, 6, false]} />
        <meshBasicMaterial color="white" />
      </mesh>
      {/* Outer Glow (Blue/Violet) */}
      <mesh>
        <tubeGeometry args={[curve, 16, 0.012, 6, false]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={intensity * 15} 
          transparent 
          opacity={0.6}
        />
      </mesh>
    </group>
  );
};

const EnergyRing = () => {
  const group = useRef<THREE.Group>(null!);
  
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.z += 0.005;
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  // Create segments for an "incomplete" ring
  const segments = [
    { start: 0, end: Math.PI * 0.6 },
    { start: Math.PI * 0.8, end: Math.PI * 1.4 },
    { start: Math.PI * 1.6, end: Math.PI * 1.9 }
  ];

  return (
    <group ref={group} position={[0, 0, -1]} rotation={[Math.PI / 4, 0, 0]}>
      {segments.map((seg, i) => (
        <mesh key={i} rotation={[0, 0, seg.start]}>
          <ringGeometry args={[1.8, 1.82, 64, 1, 0, seg.end - seg.start]} />
          <meshBasicMaterial color="#7A4DFF" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh scale={[1.1, 1.1, 1.1]}>
        <ringGeometry args={[1.85, 1.86, 64]} />
        <meshBasicMaterial color="#00C8FF" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const ElectricArcs = ({ isInteracting }: { isInteracting: boolean }) => {
  const [arcs, setArcs] = useState<{id: number, start: THREE.Vector3, end: THREE.Vector3, color: string}[]>([]);
  
  useFrame(() => {
    const threshold = isInteracting ? 0.85 : 0.94;
    if (Math.random() > threshold) {
      const id = Math.random();
      const side = Math.random() > 0.5 ? 1 : -1;
      const y = (Math.random() - 0.5) * 2.5;
      // Start from the frame (approx 0.5 wide)
      const start = new THREE.Vector3(side * 0.5, y, (Math.random() - 0.5) * 0.1);
      // Shoot outwards
      const end = new THREE.Vector3(side * 0.9, y + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4);
      
      const newArc = {
        id,
        start,
        end,
        color: Math.random() > 0.4 ? "#00C8FF" : "#7A4DFF",
      };
      
      setArcs(prev => [...prev.slice(-6), newArc]);
      setTimeout(() => {
        setArcs(prev => prev.filter(a => a.id !== id));
      }, 80 + Math.random() * 150);
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
      {/* Outer Metal Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius + 0.01, radius + 0.01, 0.02, 32]} />
        <meshStandardMaterial color="#333" metalness={1} roughness={0.1} />
      </mesh>
      {/* Inner Lens Body */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.005]}>
        <cylinderGeometry args={[radius, radius, 0.02, 32]} />
        <meshStandardMaterial color="#050505" metalness={0.8} roughness={0.5} />
      </mesh>
      {/* Glass Layer */}
      <mesh position={[0, 0, 0.008]}>
        <sphereGeometry args={[radius * 0.95, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial 
          color="#111" 
          transmission={0.95} 
          thickness={0.05} 
          roughness={0} 
          ior={1.8}
          reflectivity={1}
          clearcoat={1}
          attenuationColor="#00C8FF"
          attenuationDistance={0.1}
        />
      </mesh>
      {/* Internal Reflection / Detail */}
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[radius * 0.6, 32]} />
        <meshBasicMaterial color="#00C8FF" transparent opacity={0.1} />
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
      // Floating motion
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.6) * 0.08;
      
      // Auto-rotation when not interacting
      if (!isInteracting.current) {
        group.current.rotation.y += delta * 0.15;
      }
      
      // Interpolate to target rotation
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotation.x, 0.1);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rotation.y, 0.1);
    }
  });

  // Scale: Increased by ~65% (1 -> 1.65)
  const scale = 1.65;

  return (
    <group ref={group} scale={scale} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Main Body - Graphite/Titanium Metal */}
      <RoundedBox args={[1, 2, 0.07]} radius={0.06} smoothness={8}>
        <meshStandardMaterial 
          color="#0f0f0f" 
          metalness={0.95} 
          roughness={0.25} 
          envMapIntensity={1} 
        />
      </RoundedBox>

      {/* Glass Back (Frosted) */}
      <RoundedBox args={[0.96, 1.96, 0.072]} radius={0.06} smoothness={8} position={[0, 0, -0.001]}>
        <meshPhysicalMaterial 
          color="#0a0a0a" 
          metalness={0.1} 
          roughness={0.4} 
          transmission={0.2} 
          thickness={0.05}
        />
      </RoundedBox>

      {/* Antenna lines & side details (Visual representation) */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[1.01, 0.005, 0.075]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <mesh position={[0, -0.8, 0]}>
        <boxGeometry args={[1.01, 0.005, 0.075]} />
        <meshBasicMaterial color="#000" />
      </mesh>

      {/* Screen (Front) */}
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[0.94, 1.94]} />
        <meshStandardMaterial color="#000" roughness={0.02} metalness={1} />
      </mesh>
      
      {/* Branding */}
      <group position={[0, -0.7, -0.04]} rotation={[0, Math.PI, 0]}>
         <Text
          fontSize={0.05}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.2}
          font="https://fonts.gstatic.com/s/orbitron/v25/yWQX8slNa_qhc2yoSciGCevRpt8.woff"
        >
          {BRAND_NAME}
        </Text>
      </group>

      {/* Advanced Camera Module */}
      <group position={[0.22, 0.55, -0.04]} rotation={[0, Math.PI, 0]}>
        <RoundedBox args={[0.45, 0.65, 0.03]} radius={0.05} smoothness={8}>
          <meshStandardMaterial color="#050505" metalness={0.9} roughness={0.1} />
        </RoundedBox>
        
        {/* Lenses */}
        <CameraLens position={[0, 0.18, 0.015]} radius={0.09} depth={0.02} />
        <CameraLens position={[0, -0.05, 0.015]} radius={0.09} depth={0.02} />
        <CameraLens position={[0, -0.25, 0.015]} radius={0.06} depth={0.02} />
        
        {/* Flash & Sensors */}
        <mesh position={[-0.12, 0.18, 0.015]}>
          <circleGeometry args={[0.02, 16]} />
          <meshStandardMaterial color="#333" emissive="#333" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* Electricity near the device */}
      <ElectricArcs isInteracting={isInteracting.current} />
    </group>
  );
};

const Particles = ({ count }: { count: number }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 15;
      p[i * 3 + 1] = (Math.random() - 0.5) * 15;
      p[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return p;
  }, [count]);

  const ref = useRef<THREE.Points>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.0005;
      ref.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.2;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[points, 3]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.015} 
        color="#00C8FF" 
        transparent 
        opacity={0.3} 
        sizeAttenuation 
        blending={THREE.AdditiveBlending} 
      />
    </points>
  );
};

const Experience = () => {
  // Initial position: dramatic 3/4 view
  const [rotation, setRotation] = useState({ x: 0.1, y: Math.PI * 0.25 });
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
      x: THREE.MathUtils.clamp(prev.x + dy * 0.004, -Math.PI * 0.1, Math.PI * 0.1), // Limited vertical
      y: prev.y + dx * 0.008
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
        <PerspectiveCamera makeDefault position={[0, 0, 4.5]} fov={40} />
        
        {/* Cinematic Lighting */}
        <ambientLight intensity={0.1} />
        {/* Main Cool Blue */}
        <spotLight position={[-4, 4, 4]} angle={0.3} penumbra={1} intensity={120} color="#00C8FF" castShadow />
        {/* Rim Violet */}
        <pointLight position={[4, 2, -3]} intensity={80} color="#7A4DFF" />
        {/* Soft Front Fill */}
        <rectAreaLight position={[0, 0, 5]} width={10} height={10} intensity={0.5} color="#ffffff" />
        {/* Bottom Blue Pulse */}
        <pointLight position={[0, -4, 2]} intensity={20} color="#00C8FF" />

        <React.Suspense fallback={null}>
          <Smartphone rotation={rotation} isInteracting={isInteracting} />
          <EnergyRing />
          <Environment preset="night" />
          
          <EffectComposer disableNormalPass>
            <Bloom 
              luminanceThreshold={0.8} 
              mipmapBlur 
              intensity={2.5} 
              radius={0.5} 
            />
            <Noise opacity={0.02} />
            <Vignette offset={0.3} darkness={0.9} />
          </EffectComposer>
        </React.Suspense>

        <Particles count={150} />

        {/* Floor Reflection Representation */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#000" roughness={0.2} metalness={0.8} transparent opacity={0.3} />
        </mesh>
      </Canvas>
      
      <IntroOverlay />
    </div>
  );
};

const IntroOverlay = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.05, 1],
              opacity: [0, 1, 1],
            }}
            transition={{ duration: 2.5, times: [0, 0.7, 1], ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_80px_rgba(0,200,255,1)] mb-8" />
            <h1 className="text-white text-5xl font-light tracking-[0.3em] opacity-80">{BRAND_NAME}</h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Main Route Component ---

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
