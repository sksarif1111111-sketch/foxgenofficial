import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { 
  Float, 
  MeshDistortMaterial, 
  PerspectiveCamera, 
  Environment, 
  MeshTransmissionMaterial,
  Text,
  useCursor,
  RoundedBox
} from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";

const BRAND_NAME = "NEXORA";
const MODEL_NAME = "NEXORA X1";

// --- Components ---

const ElectricArc = ({ start, end, color = "#00C8FF", intensity = 1 }) => {
  const lineRef = useRef();
  
  const points = useMemo(() => {
    const pts = [];
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
      // Procedural jitter
      const time = state.clock.getElapsedTime();
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

const ElectricArcs = ({ isRotating }) => {
  const [arcs, setArcs] = useState([]);
  
  useFrame((state) => {
    if (Math.random() > 0.92) {
      const id = Math.random();
      const side = Math.random() > 0.5 ? 1 : -1;
      const start = new THREE.Vector3(side * 0.45, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.2);
      const end = new THREE.Vector3(side * 0.6, start.y + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5);
      
      const newArc = {
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

const Smartphone = ({ rotation, isInteracting }) => {
  const group = useRef();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // Auto-rotation & floating
  useFrame((state, delta) => {
    if (group.current) {
      // Floating
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.05;
      
      // Auto-rotation if not interacting
      if (!isInteracting.current) {
        group.current.rotation.y += delta * 0.2;
      }
      
      // Sync group rotation with prop (for manual control)
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotation.x, 0.1);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rotation.y, 0.1);
    }
  });

  return (
    <group ref={group} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Body - Main Chassis */}
      <RoundedBox args={[0.9, 1.8, 0.08]} radius={0.08} smoothness={4}>
        <meshStandardMaterial 
          color="#1a1a1a" 
          metalness={0.9} 
          roughness={0.2} 
          envMapIntensity={1}
        />
      </RoundedBox>

      {/* Screen (Front) */}
      <mesh position={[0, 0, 0.041]}>
        <planeGeometry args={[0.84, 1.74]} />
        <meshStandardMaterial 
          color="#050505" 
          roughness={0.05} 
          metalness={1}
        />
      </mesh>
      
      {/* Branding (Back) */}
      <group position={[0, -0.6, -0.041]} rotation={[0, Math.PI, 0]}>
         <Text
          fontSize={0.04}
          color="#ffffff"
          font="https://fonts.gstatic.com/s/orbitron/v25/yYqxRnd6CQ8G-epI9X7uEYO7gb-7uO3j.woff"
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
          <mesh key={i} position={[x, y, z]}>
            <cylinderGeometry args={[r, r, 0.01, 32]} rotation={[Math.PI/2, 0, 0]} />
            <meshStandardMaterial color="#000000" metalness={1} roughness={0} />
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
          </mesh>
        ))}
      </group>

      {/* Energy Arcs attached to phone */}
      <ElectricArcs isRotating={isInteracting.current} />
    </group>
  );
};

const Experience = () => {
  const [rotation, setRotation] = useState({ x: 0, y: Math.PI * 0.15 });
  const isInteracting = useRef(false);
  const lastInteractTime = useRef(0);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    isInteracting.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastInteractTime.current = Date.now();
  };

  const handlePointerMove = (e) => {
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

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isInteracting.current && Date.now() - lastInteractTime.current > 3500) {
        // Rotação automática handle por useFrame em Smartphone
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

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
        
        <ambientLight intensity={0.2} />
        <spotLight position={[5, 5, 5]} angle={0.15} penumbra={1} intensity={2} color="#00C8FF" />
        <pointLight position={[-5, 2, -5]} intensity={1.5} color="#7A4DFF" />
        <directionalLight position={[0, 5, 0]} intensity={0.5} />

        <React.Suspense fallback={null}>
          <Smartphone rotation={rotation} isInteracting={isInteracting} />
          <Environment preset="city" />
          
          <EffectComposer disableNormalPass>
            <Bloom 
              luminanceThreshold={1} 
              mipmapBlur 
              intensity={1.5} 
              radius={0.4} 
            />
            <Noise opacity={0.05} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </React.Suspense>

        {/* Floating Particles */}
        <Particles count={50} />
      </Canvas>
      
      <IntroOverlay />
    </div>
  );
};

const Particles = ({ count }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 10;
      p[i * 3 + 1] = (Math.random() - 0.5) * 10;
      p[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    return p;
  }, [count]);

  const ref = useRef();
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
          count={points.length / 3}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#00C8FF" transparent opacity={0.4} />
    </points>
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
      
      {/* Meta Head Tags for SEO (though it's a 3D experience) */}
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
