import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
export function createCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(42,1,.05,160);camera.position.set(7.5,5.2,10.7);
  const controls = new OrbitControls(camera,canvas);controls.target.set(0,2.15,0);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=2;controls.maxDistance=28;controls.maxPolarAngle=Math.PI*.96;controls.update();
  return {camera,controls};
}
export function setView(camera,controls,plate,view) {
  const target = plate.group.position.clone(), distance=Math.max(plate.width,plate.height)*2.25;
  let offset;
  if(view==='front') offset=new THREE.Vector3(0,.15,distance);
  else if(view==='back') offset=new THREE.Vector3(0,.15,-distance);
  else if(view==='side') offset=new THREE.Vector3(distance,.5,.8);
  else offset=new THREE.Vector3(distance*.68,distance*.37,distance*.96);
  offset.applyQuaternion(plate.group.quaternion);controls.target.copy(target);camera.position.copy(target).add(offset);controls.update();
}
