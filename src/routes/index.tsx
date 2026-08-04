import React, { useRef, useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { 
  PerspectiveCamera, 
  Environment, 
  Text,
  useCursor,
  RoundedBox
} from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";

const BRAND_NAME = "NEXORA";

// --- Types ---

interface ArcData {
  id: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  intensity: number;
}

// --- Components ---

const ElectricArc = ({ start, end, color = "#00C8FF", intensity = 1 }: { start: THREE.Vector3, end: THREE.Vector3, color?: string, intensity?: number }) => {
  const lineRef = useRef<THREE.Mesh>(null!);
  
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 8;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = new THREE.Vector3().lerpVectors(start, end, t);
      if (i > 0 && i < segments) {
        p.add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ));
      }
      pts.push(p);
    }
    return pts;
  }, [start, end]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame((state) => {
    if (lineRef.current) {
      lineRef.current.visible = Math.random() > 0.3;
      if (Math.random() > 0.8) {
        lineRef.current.scale.setScalar(0.8 + Math.random() * 0.4);
      }
    }
  });

  return (
    <mesh ref={lineRef}>
      <tubeGeometry args={[curve, 8, 0.005, 8, false]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={intensity * 10} 
        transparent 
        opacity={0.8}
      />
    </mesh>
  );
};

const ElectricArcs = ({ isRotating }: { isRotating: boolean }) => {
  const [arcs, setArcs] = useState<ArcData[]>([]);
  
  useFrame(() => {
    if (Math.random() > 0.92) {
      const id = Math.random();
      const side = Math.random() > 0.5 ? 1 : -1;
      const start = new THREE.Vector3(side * 0.45, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.2);
      const end = new THREE.Vector3(side * 0.6, start.y + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5);
      
      const newArc: ArcData = {
        id,
        start,
        end,
        color: Math.random() > 0.3 ? "#00C8FF" : "#7A4DFF",
        intensity: isRotating ? 2 : 1
      };
      
      setArcs(prev => [...prev.slice(-8), newArc]);
      setTimeout(() => {
        setArcs(prev => prev.filter(a => a.id !== id));
      }, 100 + Math.random() * 200);
    }
  });

  return (
    <group>
      {arcs.map(arc => (
        <ElectricArc key={arc.id} {...arc} />
      ))}
    </group>
  );
};

const Smartphone = ({ rotation, isInteracting }: { rotation: { x: number, y: number }, isInteracting: React.MutableRefObject<boolean> }) => {
  const group = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.05;
      
      if (!isInteracting.current) {
        group.current.rotation.y += delta * 0.2;
      }
      
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotation.x, 0.1);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rotation.y, 0.1);
    }
  });

  return (
    <group ref={group} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Body */}
      <RoundedBox args={[0.9, 1.8, 0.08]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </RoundedBox>

      {/* Screen */}
      <mesh position={[0, 0, 0.041]}>
        <planeGeometry args={[0.84, 1.74]} />
        <meshStandardMaterial color="#050505" roughness={0.05} metalness={1} />
      </mesh>
      
      {/* Branding (Back) */}
      <group position={[0, -0.6, -0.041]} rotation={[0, Math.PI, 0]}>
         <Text
          fontSize={0.04}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.3}
        >
          {BRAND_NAME}
        </Text>
      </group>

      {/* Camera Module (Back) */}
      <group position={[0.2, 0.5, -0.045]} rotation={[0, Math.PI, 0]}>
        <RoundedBox args={[0.4, 0.6, 0.02]} radius={0.04} smoothness={4}>
          <meshStandardMaterial color="#0a0a0a" metalness={0.8} roughness={0.1} />
        </RoundedBox>
        
        {/* Lenses */}
        {[
          [0, 0.15, 0.015, 0.08],
          [0, -0.05, 0.015, 0.08],
          [0, -0.22, 0.015, 0.06]
        ].map(([x, y, z, r], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[r, r, 0.01, 32]} />
              <meshStandardMaterial color="#000000" metalness={1} roughness={0} />
            </mesh>
            <mesh position={[0, 0, 0.006]}>
              <sphereGeometry args={[r * 0.9, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial 
                color="#222" 
                transmission={0.9} 
                thickness={0.1} 
                roughness={0} 
                ior={1.5}
              />
            </mesh>
          </group>
        ))}
      </group>

      <ElectricArcs isRotating={isInteracting.current} />
    </group>
  );
};

const Particles = ({ count }: { count: number }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 10;
      p[i * 3 + 1] = (Math.random() - 0.5) * 10;
      p[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    return p;
  }, [count]);

  const ref = useRef<THREE.Points>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.001;
      ref.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.1;
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
      <pointsMaterial size={0.02} color="#00C8FF" transparent opacity={0.4} />
    </points>
  );
};

const Experience = () => {
  const [rotation, setRotation] = useState({ x: 0, y: Math.PI * 0.15 });
  const isInteracting = useRef(false);
  const lastInteractTime = useRef(Date.now());
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isInteracting.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastInteractTime.current = Date.now();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isInteracting.current) return;
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    setRotation(prev => ({
      x: THREE.MathUtils.clamp(prev.x + dy * 0.005, -Math.PI * 0.2, Math.PI * 0.2),
      y: prev.y + dx * 0.01
    }));
    
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastInteractTime.current = Date.now();
  };

  const handlePointerUp = () => {
    isInteracting.current = false;
  };

  return (
    <div 
      className="w-full h-[100dvh] bg-[#010204] cursor-grab active:cursor-grabbing overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#010204"]} />
        <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={45} />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[5, 5, 5]} angle={0.15} penumbra={1} intensity={50} color="#00C8FF" />
        <pointLight position={[-5, 2, -5]} intensity={30} color="#7A4DFF" />

        <React.Suspense fallback={null}>
          <Smartphone rotation={rotation} isInteracting={isInteracting} />
          <Environment preset="city" />
          
          <EffectComposer>
            <Bloom 
              luminanceThreshold={1} 
              mipmapBlur 
              intensity={1.5} 
              radius={0.4} 
            />
            <Noise opacity={0.05} />
            <Vignette offset={0.1} darkness={1.1} />
          </EffectComposer>
        </React.Suspense>

        <Particles count={50} />
      </Canvas>
      
      <IntroOverlay />
    </div>
  );
};

const IntroOverlay = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-[#010204] pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [0, 1.2, 1],
              opacity: [0, 1, 1],
            }}
            transition={{ duration: 2, times: [0, 0.6, 1], ease: "easeOut" }}
            className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.8)]"
          />
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
        body { margin: 0; overflow: hidden; background: #010204; }
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
