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
const body=joint(scene,'Body',[0,.64,0]);ell(body,'PlushBody',[0,0,0],[.48,.49,.37],shell);ell(body,'SoftBelly',[0,-.035,.29],[.355,.36,.105],coat);
// The reference is a cuddly baby animal: plush volume instead of hard jacket seams.
ell(body,'ChestFluff',[0,.28,.305],[.235,.215,.12],coat);
for(const side of [-1,1]){
 const leg=joint(scene,side<0?'LegLeft':'LegRight',[side*.235,.25,.02]);ell(leg,'BabyFoot',[0,-.095,.11],[.19,.14,.225],trim);
 const arm=joint(body,side<0?'ArmLeft':'ArmRight',[side*.35,.23,.12]);arm.rotation.z=side*.17;ell(arm,'SoftArm',[side*.015,-.14,.07],[.19,.22,.2],shell);ell(arm,'BabyPaw',[side*.025,-.265,.17],[.16,.145,.145],trim);
}
const tail=joint(scene,'Tail',[.34,.48,-.21]);tail.rotation.z=-.32;
const tailPoints=[new THREE.Vector3(0,0,0),new THREE.Vector3(.28,.09,-.08),new THREE.Vector3(.61,.40,-.065),new THREE.Vector3(.71,.81,.01),new THREE.Vector3(.72,1.1,.075)];
const tailCurve=new THREE.CatmullRomCurve3(tailPoints);const frames=tailCurve.computeFrenetFrames(32,false);const positions=[],normals=[],colors=[],indices=[];
const c0=new THREE.Color('#eaf3fa'),c1=new THREE.Color('#6ebeea'),c2=new THREE.Color('#bba1ed');
for(let i=0;i<=32;i++){const t=i/32,p=tailCurve.getPointAt(t),radius=.012+Math.pow(Math.sin(Math.PI*t),.8)*.31;for(let j=0;j<=16;j++){const a=j/16*Math.PI*2,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));const v=p.clone().addScaledVector(n,radius);positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);const c=t<.38?c0.clone().lerp(c1,t/.38):c1.clone().lerp(c2,(t-.38)/.62);colors.push(c.r,c.g,c.b);if(i<32&&j<16){let k=i*17+j;indices.push(k,k+17,k+1,k+1,k+17,k+18);}}}
const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));tg.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));tg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));tg.setIndex(indices);const tm=mat('tail','#ffffff',.75);tm.vertexColors=true;const tailMesh=new THREE.Mesh(tg,tm);tailMesh.name='FluffyTail';tail.add(tailMesh);
const head=joint(scene,'Head',[0,1.64,0]);head.scale.set(1.2,1.07,1.12);ell(head,'RoundHead',[0,0,0],[.72,.65,.49],shell);
for(const side of [-1,1]){
 ell(head,'Muzzle',[side*.14,-.30,.413],[.245,.175,.105],shell);
 ell(head,'Cheek',[side*.45,-.24,.407],[.155,.072,.022],blush);
 const eye=joint(head,side<0?'EyeLeft':'EyeRight',[side*.29,-.09,.438]);eye.rotation.y=side*.18;
 ell(eye,'EyeRim',[0,0,0],[.21,.267,.048],light);ell(eye,'GlossyEye',[0,0,.021],[.193,.25,.065],ink);
 const pupil=joint(eye,'Pupil',[0,0,.055]);ell(pupil,'Iris',[0,-.046,0],[.149,.185,.032],iris);ell(pupil,'PupilCore',[0,.019,.022],[.125,.174,.027],ink);ell(pupil,'Catchlight',[-.063,.125,.051],[.043,.046,.012],light);ell(pupil,'SmallCatchlight',[.064,-.10,.049],[.019,.021,.01],light);
 ell(head,'BabyBrow',[side*.29,.265,.452],[.046,.025,.016],trim);
 // Low cheek scallops make a fluffy silhouette without adding hair shaders.
 ell(head,'CheekFluff',[side*.60,-.25,.13],[.14,.15,.22],shell);
 const phone=joint(head,side<0?'PhoneLeft':'PhoneRight',[side*.69,-.005,-.015]);ell(phone,'Cushion',[0,0,0],[.075,.23,.22],stitch);ell(phone,'HeadphoneCup',[side*.035,0,0],[.085,.206,.20],trim);ell(phone,'CupInset',[side*.09,0,.015],[.015,.127,.13],trim);
}
ell(head,'TinyNose',[0,-.255,.568],[.065,.045,.04],ink);
tube(head,'Mouth',[[-.12,-.328,.544],[-.09,-.361,.55],[-.048,-.35,.557],[0,-.316,.568],[.048,-.35,.557],[.09,-.361,.55],[.12,-.328,.544]],.012,ink);
tube(head,'Headband',[[-.64,.03,-.04],[-.61,.40,-.05],[-.36,.61,-.06],[0,.69,-.07],[.36,.61,-.06],[.61,.40,-.05],[.64,.03,-.04]],.055,trim);
// Ears are attached in head-local coordinates, not to a flat card.
const ears=joint(head,'Ears',[0,-1.64,0]);ear(ears,'EarLeft',-.44);ear(ears,'EarRight',.44);
const tuft=joint(head,'Tuft',[0,.50,.32]);ell(tuft,'Forelock',[0,0,0],[.14,.19,.10],trim);tuft.rotation.z=-.23;
ell(tuft,'ForelockSoftLeft',[-.075,.09,-.01],[.075,.13,.085],coat);ell(tuft,'ForelockSoftRight',[.075,.055,-.01],[.07,.115,.085],coat);
let triangles=0,meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;}});
const exporter=new GLTFExporter();const glb=await exporter.parseAsync(scene,{binary:true,onlyVisible:true});writeFileSync('/tmp/foxy-3d/foxy-chibi.glb',Buffer.from(glb));console.log(JSON.stringify({meshes,triangles,bytes:glb.byteLength}));
