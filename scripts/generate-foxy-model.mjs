import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';
// An original Foxy robot-toy sculpt, not a downloaded animal or copyrighted character.
// Articulated parts are authored in local joint coordinates. No external textures/decoders.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
const scene = new THREE.Group(); scene.name='Foxy';
const mat=(name,color,roughness=.55,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness});m.name=name;return m;};
// These model material names are themed from global CSS by the runtime.
const shell=mat('shell','#eaf3fa',.64), coat=mat('coat','#d9e8f5',.86), trim=mat('trim','#6ebeea',.4), violet=mat('violet','#bba1ed',.42), ink=mat('ink','#07172e',.14), iris=mat('iris','#257eaa',.22), blush=mat('blush','#efb8c9',.62), light=mat('light','#ffffff',.18), stitch=mat('stitch','#b8d0e6',.75);
const ball=new THREE.SphereGeometry(1,32,20);
function ell(parent,name,pos,size,material){const mesh=new THREE.Mesh(ball,material);mesh.name=name;mesh.position.set(...pos);mesh.scale.set(...size);parent.add(mesh);return mesh;}
function joint(parent,name,pos){const g=new THREE.Group();g.name=name;g.position.set(...pos);parent.add(g);return g;}
function tube(parent,name,points,radius,material){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*5),radius,8,false),material);mesh.name=name;parent.add(mesh);return mesh;}
function ear(parent,name,x){const g=joint(parent,name,[x,2.05,0]);g.rotation.z=x>0?-.18:.18;
 const outline=new THREE.Shape();outline.moveTo(-.27,0);outline.bezierCurveTo(-.33,.21,-.19,.53,0,.61);outline.bezierCurveTo(.19,.53,.33,.21,.27,0);outline.quadraticCurveTo(0,-.08,-.27,0);
 const geo=new THREE.ExtrudeGeometry(outline,{depth:.13,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.065,bevelThickness:.055,curveSegments:12});geo.translate(0,0,-.11);const mesh=new THREE.Mesh(geo,shell);mesh.name=name+'Shell';g.add(mesh);
 const inner=mesh.clone();inner.material=trim;inner.scale.set(.61,.72,.3);inner.position.set(0,.075,.15);inner.name=name+'Inner';g.add(inner);return g;
}
const body=joint(scene,'Body',[0,.7,0]);ell(body,'PaddedJacket',[0,0,0],[.43,.49,.32],coat);ell(body,'Bib',[0,.015,.26],[.32,.35,.1],shell);
// Raised collar, real cuffs and a zipper seam give the clothing thickness from every angle.
tube(body,'Collar',[[-.27,.35,.17],[-.16,.41,.28],[0,.43,.31],[.16,.41,.28],[.27,.35,.17]],.055,trim);
tube(body,'Zipper',[[0,.29,.365],[0,0,.372],[0,-.26,.32]],.012,stitch);ell(body,'ZipPull',[.018,.14,.388],[.026,.045,.012],trim);
for(const side of [-1,1]){
 const leg=joint(scene,side<0?'LegLeft':'LegRight',[side*.235,.25,.02]);ell(leg,'Boot',[0,-.09,.085],[.2,.15,.255],trim);ell(leg,'BootCuff',[0,.045,.015],[.18,.08,.18],coat);ell(leg,'Sole',[0,-.18,.08],[.205,.042,.258],stitch);
 const arm=joint(body,side<0?'ArmLeft':'ArmRight',[side*.35,.23,.01]);arm.rotation.z=side*.17;ell(arm,'PuffySleeve',[side*.025,-.14,.02],[.16,.225,.17],coat);ell(arm,'RibbedCuff',[side*.035,-.27,.055],[.15,.065,.16],trim);ell(arm,'Mitten',[side*.035,-.345,.06],[.15,.155,.155],shell);
}
const tail=joint(scene,'Tail',[.31,.57,-.19]);tail.rotation.z=-.32;
const tailPoints=[new THREE.Vector3(0,0,0),new THREE.Vector3(.25,.06,-.08),new THREE.Vector3(.53,.35,-.07),new THREE.Vector3(.55,.7,.02),new THREE.Vector3(.45,.89,.075)];
const tailCurve=new THREE.CatmullRomCurve3(tailPoints);const frames=tailCurve.computeFrenetFrames(32,false);const positions=[],normals=[],colors=[],indices=[];
const c0=new THREE.Color('#eaf3fa'),c1=new THREE.Color('#6ebeea'),c2=new THREE.Color('#bba1ed');
for(let i=0;i<=32;i++){const t=i/32,p=tailCurve.getPointAt(t),radius=.045+Math.sin(Math.PI*t)*.20;for(let j=0;j<=16;j++){const a=j/16*Math.PI*2,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));const v=p.clone().addScaledVector(n,radius);positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);const c=t<.38?c0.clone().lerp(c1,t/.38):c1.clone().lerp(c2,(t-.38)/.62);colors.push(c.r,c.g,c.b);if(i<32&&j<16){let k=i*17+j;indices.push(k,k+17,k+1,k+1,k+17,k+18);}}}
const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));tg.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));tg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));tg.setIndex(indices);const tm=mat('tail','#ffffff',.75);tm.vertexColors=true;const tailMesh=new THREE.Mesh(tg,tm);tailMesh.name='FluffyTail';tail.add(tailMesh);
const head=joint(scene,'Head',[0,1.64,0]);ell(head,'RoundHead',[0,0,0],[.69,.65,.48],shell);
for(const side of [-1,1]){
 ell(head,'Muzzle',[side*.15,-.27,.406],[.25,.18,.14],shell);
 ell(head,'Cheek',[side*.44,-.19,.378],[.115,.052,.03],blush);
 const eye=joint(head,side<0?'EyeLeft':'EyeRight',[side*.273,-.065,.423]);eye.rotation.y=side*.21;
 ell(eye,'EyeRim',[0,0,0],[.198,.249,.065],light);ell(eye,'GlossyEye',[0,0,.024],[.175,.224,.072],ink);
 const pupil=joint(eye,'Pupil',[0,0,.055]);ell(pupil,'Iris',[0,-.045,0],[.127,.153,.04],iris);ell(pupil,'PupilCore',[0,.012,.017],[.105,.152,.034],ink);ell(pupil,'Catchlight',[-.049,.092,.047],[.039,.043,.015],light);ell(pupil,'SmallCatchlight',[.055,-.065,.049],[.018,.019,.01],light);
 tube(head,'Eyebrow',[[side*.43,.24,.399],[side*.29,.28,.449],[side*.16,.25,.453]],.024,trim);
 const phone=joint(head,side<0?'PhoneLeft':'PhoneRight',[side*.655,-.02,-.015]);ell(phone,'Cushion',[0,0,0],[.09,.23,.22],stitch);ell(phone,'HeadphoneCup',[side*.04,0,0],[.095,.206,.20],trim);ell(phone,'CupInset',[side*.102,0,.015],[.018,.127,.13],violet);
}
ell(head,'TinyNose',[0,-.255,.568],[.065,.045,.04],ink);
tube(head,'Mouth',[[-.12,-.328,.544],[-.09,-.361,.55],[-.048,-.35,.557],[0,-.316,.568],[.048,-.35,.557],[.09,-.361,.55],[.12,-.328,.544]],.012,ink);
tube(head,'Headband',[[-.64,.03,-.04],[-.61,.40,-.05],[-.36,.61,-.06],[0,.69,-.07],[.36,.61,-.06],[.61,.40,-.05],[.64,.03,-.04]],.055,trim);
// Ears are attached in head-local coordinates, not to a flat card.
const ears=joint(head,'Ears',[0,-1.64,0]);ear(ears,'EarLeft',-.44);ear(ears,'EarRight',.44);
const tuft=joint(head,'Tuft',[0,.53,.32]);ell(tuft,'Forelock',[0,0,0],[.15,.21,.13],trim);tuft.rotation.z=-.23;
let triangles=0,meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;}});
const exporter=new GLTFExporter();const glb=await exporter.parseAsync(scene,{binary:true,onlyVisible:true});writeFileSync('/tmp/foxy-3d/foxy-chibi.glb',Buffer.from(glb));console.log(JSON.stringify({meshes,triangles,bytes:glb.byteLength}));
