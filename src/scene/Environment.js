import * as THREE from 'three';
import { RoomEnvironment } from '../../vendor/RoomEnvironment.js';
export function createEnvironment(renderer) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x111d27); scene.fog = new THREE.FogExp2(0x111d27,.035);
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room,.025); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xd8edf5,0x334544,2));
  const key = new THREE.DirectionalLight(0xfff3dd,4.5); key.position.set(-4,8,5); key.castShadow = true;
  key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.normalBias=.04;
  scene.add(key); const rim = new THREE.DirectionalLight(0x9dc8e0,3);rim.position.set(4,5,-6);scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe6b18c,1.4);fill.position.set(-5,2,-2);scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x182931,roughness:.82,metalness:.22}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-.04;floor.receiveShadow=true;scene.add(floor);
  const grid = new THREE.GridHelper(28,56,0x42606a,0x253d48);grid.material.transparent=true;grid.material.opacity=.42;grid.position.y=.001;scene.add(grid);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(7.4,.13,4.1),new THREE.MeshStandardMaterial({color:0x273b44,roughness:.55,metalness:.5}));pad.position.y=.03;pad.receiveShadow=true;scene.add(pad);
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(pad.geometry),new THREE.LineBasicMaterial({color:0x577078,transparent:true,opacity:.6}));border.position.copy(pad.position);scene.add(border);
  for(let i=0;i<27;i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(.014,.005,i%5===0?.17:.07),new THREE.MeshBasicMaterial({color:0x829596}));
    mark.position.set(-3.25+i*.25,.099,1.91);scene.add(mark);
  }
  for(const x of [-3.5,3.5]) for(const z of [-1.8,1.8]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.38,.007,.06),new THREE.MeshBasicMaterial({color:0xbaa074}));stripe.position.set(x,.101,z);scene.add(stripe);
  }
  const impactLight = new THREE.PointLight(0xffc580,0,8,2);scene.add(impactLight);
  return {scene,impactLight,environment};
}
