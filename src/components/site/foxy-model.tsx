import { Component, Suspense, memo, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import { CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three';
import model from '@/assets/models/foxy-chibi.glb.asset.json';
import fallbackImage from '@/assets/foxy-full.webp.asset.json';
import { eyeOpenness, FOXY_3D, volumePose, type FoxyRenderState } from '@/lib/foxy-pose';

const MATERIAL_TOKENS: Record<string, string> = {
  shell: '--foxy-shell', coat: '--foxy-shell', trim: '--foxy-cyan', violet: '--foxy-violet',
  ink: '--foxy-pupil', iris: '--foxy-iris', blush: '--foxy-blush', light: '--foxy-shell-light', stitch: '--foxy-shell-shade',
};

function tokenColor(token: string) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Color();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  ctx.fillRect(0, 0, 1, 1);
  const pixels = ctx.getImageData(0, 0, 1, 1).data;
  return new Color().setRGB((pixels[0] ?? 255) / 255, (pixels[1] ?? 255) / 255, (pixels[2] ?? 255) / 255, SRGBColorSpace);
}

/** Fine woven grain, generated locally once; not a flat picture masquerading as a 3D mesh. */
function fabricTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const data = ctx.createImageData(128, 128);
    let seed = 91;
    for (let i = 0; i < data.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const shade = 235 + seed % 21;
      data.data[i] = shade; data.data[i + 1] = shade; data.data[i + 2] = shade; data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ModelRig({ stateRef, onReady }: { stateRef: RefObject<FoxyRenderState>; onReady: () => void }) {
  const { scene } = useGLTF(model.url);
  const { gl, invalidate } = useThree();
  const rig = useMemo(() => {
    const object = scene.clone(true);
    const fabric = fabricTexture();
    const materials = new Map<string, MeshStandardMaterial>();
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const source = child.material;
      if (!(source instanceof MeshStandardMaterial)) return;
      let material = materials.get(source.name);
      if (!material) {
        material = source.clone();
        if (source.name === 'coat' || source.name === 'shell') { material.map = fabric; material.roughness = source.name === 'coat' ? 0.88 : 0.62; }
        materials.set(source.name, material);
      }
      child.material = material;
    });
    const part = (name: string) => object.getObjectByName(name);
    return { object, materials, fabric, head: part('Head'), body: part('Body'), tail: part('Tail'), leftArm: part('ArmLeft'), rightArm: part('ArmRight'), leftLeg: part('LegLeft'), rightLeg: part('LegRight'), leftEye: part('EyeLeft'), rightEye: part('EyeRight'), leftEar: part('EarLeft'), rightEar: part('EarRight') };
  }, [scene]);
  const volume = useRef<Group>(null);
  const phase = useRef({ act: '', elapsed: 0, time: 0, ready: false, yaw: 0 });

  useEffect(() => {
    const applyTheme = () => {
      for (const [name, material] of rig.materials) {
        const token = MATERIAL_TOKENS[name];
        if (token) material.color.copy(tokenColor(token));
      }
      invalidate();
    };
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const debugWindow = window as Window & { __foxy3d?: { pose: (act: FoxyRenderState['act'], face: FoxyRenderState['face'], dir: 1 | -1) => void; snapshot: () => unknown } };
    if (import.meta.env.DEV) debugWindow.__foxy3d = {
      pose: (act, face, dir) => { Object.assign(stateRef.current, { act, face, dir }); invalidate(); },
      snapshot: () => ({ state: stateRef.current, yaw: phase.current.yaw, calls: gl.info.render.calls, triangles: gl.info.render.triangles, joints: { left: rig.leftLeg?.position.toArray(), right: rig.rightLeg?.position.toArray() } }),
    };
    return () => { observer.disconnect(); if (import.meta.env.DEV) delete debugWindow.__foxy3d; for (const material of rig.materials.values()) material.dispose(); rig.fabric.dispose(); };
  }, [rig, invalidate, gl, stateRef]);

  useFrame((_, delta) => {
    const state = stateRef.current; const root = volume.current;
    if (!state || !root) return;
    const dt = Math.min(delta, FOXY_3D.maxDelta);
    const p = phase.current;
    if (p.act !== state.act) { p.act = state.act; p.elapsed = 0; }
    if (!state.hidden && !state.reduced) { p.elapsed += dt; p.time += dt; }
    const t = p.time;
    const shape = volumePose(state.act, p.elapsed, state.reduced);
    root.visible = shape.visible;
    root.scale.set(shape.x, shape.y, shape.x);
    const walking = state.act === 'walk' && !state.reduced;
    const gait = state.gait;
    const breathe = !state.reduced && !state.hidden && !walking ? Math.sin(t * 2) * 0.012 : 0;
    root.position.y = shape.lift + (walking ? -gait.bob * 0.015 : breathe);
    root.rotation.z = walking ? gait.lean * Math.PI / 180 * 0.7 : state.act === 'dizzy' && !state.reduced ? Math.sin(t * 13) * 0.06 : 0;
    // A real 3/4 view from each side, never a full spin or a mirrored image plane.
    const wantedYaw = state.dir * FOXY_3D.yaw;
    p.yaw = state.reduced ? wantedYaw : p.yaw + (wantedYaw - p.yaw) * (1 - Math.exp(-FOXY_3D.damping * dt));
    root.rotation.y = p.yaw;
    if (state.press && !state.reduced) root.scale.multiplyScalar(0.96);

    if (rig.head) {
      rig.head.rotation.z = state.face === 'curious' ? 0.12 : state.face === 'sleepy' ? -0.08 : walking ? -gait.lean * 0.008 : 0;
      rig.head.rotation.x = state.nod && !state.reduced ? Math.sin(t * 8) * 0.07 : state.act === 'sniff' && !state.reduced ? Math.sin(t * 10) * 0.04 : 0;
    }
    if (rig.body) rig.body.scale.set(1 + breathe, state.act === 'sit' ? 0.92 : 1 - breathe, 1 + breathe);
    if (rig.tail) rig.tail.rotation.z = -0.32 + (!state.reduced && !state.hidden ? Math.sin(t * (walking ? 8 : 2.6)) * 0.10 : 0);
    for (const [leg, paw] of [[rig.leftLeg, gait.left], [rig.rightLeg, gait.right]] as const) {
      if (!leg) continue;
      leg.position.y = 0.25 - (walking ? paw.y * 0.022 : 0);
      leg.position.z = 0.02 + (walking ? paw.x * 0.015 : 0);
      leg.rotation.x = walking ? paw.angle * Math.PI / 180 : state.act === 'held' && !state.reduced ? Math.sin(t * 8) * 0.12 : 0;
    }
    if (rig.leftArm) rig.leftArm.rotation.x = walking ? gait.right.angle * 0.018 : 0;
    if (rig.rightArm) {
      rig.rightArm.rotation.x = walking ? gait.left.angle * 0.018 : 0;
      rig.rightArm.rotation.z = state.act === 'wave' && !state.reduced ? -0.6 + Math.sin(t * 9) * 0.18 : state.act === 'point' ? -0.65 : 0.17;
    }
    for (const eye of [rig.leftEye, rig.rightEye]) {
      if (!eye) continue;
      eye.scale.y = eyeOpenness(state.face, state.blink, state.reduced);
      eye.rotation.z = state.face === 'dizzy' && !state.reduced ? Math.sin(t * 9) * 0.08 : 0;
      const pupil = eye.getObjectByName('Pupil');
      if (pupil) { pupil.position.x = state.reduced ? 0 : state.gaze.x * 0.009; pupil.position.y = state.reduced ? 0 : -state.gaze.y * 0.007; }
    }
    if (rig.leftEar) rig.leftEar.rotation.z = 0.18 + (state.hover && !state.reduced ? Math.sin(t * 11) * 0.05 : 0);
    if (rig.rightEar) rig.rightEar.rotation.z = -0.18 - (state.hover && !state.reduced ? Math.sin(t * 11) * 0.05 : 0);
    if (!p.ready) { p.ready = true; requestAnimationFrame(onReady); }
    if (import.meta.env.DEV) {
      const host = gl.domElement.closest<HTMLElement>('.foxy-scene');
      if (host) { host.dataset['drawCalls'] = String(gl.info.render.calls); host.dataset['triangles'] = String(gl.info.render.triangles); host.dataset['yaw'] = String(p.yaw); }
    }
  });
  return <group ref={volume}><primitive object={rig.object} dispose={null} /></group>;
}

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Fallback() { return <img src={fallbackImage.url} className="foxy-model-fallback" alt="" aria-hidden="true" />; }

/** This module is only imported after hydration. The storefront's SSR and all chat logic stay unchanged. */
function FoxyModel({ stateRef, reduced, hidden, poseKey }: { stateRef: RefObject<FoxyRenderState>; reduced: boolean; hidden: boolean; poseKey: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const palette = useMemo(() => ({ white: tokenColor('--foxy-shell-light'), blue: tokenColor('--foxy-cyan'), violet: tokenColor('--foxy-violet') }), []);
  const markReady = () => { if (host.current) host.current.dataset['sceneReady'] = '1'; setReady(true); };
  return <span ref={host} className="foxy-scene" data-renderer="three" data-pose={poseKey}>
    {(!ready || lost) && <Fallback />}
    {!lost && <ModelBoundary fallback={<Fallback />}>
      <Canvas orthographic camera={{ position: [0, 1.36, 6], zoom: 34, near: 0.1, far: 30 }} dpr={1.25} frameloop={hidden ? 'never' : reduced ? 'demand' : 'always'} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} onCreated={({ gl, camera, size }) => {
        camera.zoom = size.height / 3;
        camera.updateProjectionMatrix();
        camera.lookAt(0, 1.36, 0); gl.setClearAlpha(0);
        gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true });
      }}>
        <ambientLight intensity={0.9} color={palette.white} />
        <directionalLight position={[-3, 5, 5]} intensity={2.2} color={palette.white} />
        <directionalLight position={[3, 2, 2]} intensity={0.65} color={palette.blue} />
        <Environment resolution={32} frames={1}>
          <Lightformer color={palette.white} intensity={1.4} position={[-3, 4, 4]} scale={[5, 5, 1]} />
          <Lightformer color={palette.blue} intensity={0.6} position={[3, 2, 2]} scale={[3, 3, 1]} />
          <Lightformer color={palette.violet} intensity={0.5} position={[0, 3, -3]} scale={[4, 4, 1]} />
        </Environment>
        <Suspense fallback={null}><ModelRig stateRef={stateRef} onReady={markReady} /></Suspense>
        <InvalidatePose poseKey={poseKey} />
      </Canvas>
    </ModelBoundary>}
  </span>;
}

function InvalidatePose({ poseKey }: { poseKey: string }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [poseKey, invalidate]);
  return null;
}
export default memo(FoxyModel);
