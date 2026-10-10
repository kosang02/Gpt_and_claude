import * as THREE from 'three';
export class Projectile {
  constructor(scene,type,origin,direction,power) {
    this.scene=scene;this.type=type;this.power=power;this.group=new THREE.Group();this.group.position.copy(origin);this.velocity=direction.clone().multiplyScalar(13);this.ignored=new Set();this.age=0;this.tumble=0;this.state='flight';
    const metal=new THREE.MeshStandardMaterial({color:type==='jet'?0xcda86b:0xb9c1b9,metalness:.85,roughness:.24});
    if(type==='ball') this.group.add(new THREE.Mesh(new THREE.SphereGeometry(.16,20,16),metal));
    else {
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.38,16),metal);this.group.add(body);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.095,.25,16),metal);tip.position.y=.315;this.group.add(tip);
      const band=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.07,16),new THREE.MeshStandardMaterial({color:0xb7a075,metalness:.8,roughness:.35}));band.position.y=-.11;this.group.add(band);
    }
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);this.group.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(this.group);
    this.trailPositions=new Float32Array(22*3);this.trailCount=0;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3));geo.setDrawRange(0,0);
    this.trail=new THREE.Line(geo,new THREE.LineBasicMaterial({color:type==='jet'?0x9bcfdf:0xa8b2a3,transparent:true,opacity:.30}));this.trail.frustumCulled=false;scene.add(this.trail);
  }
  update(dt) {
    this.age+=dt;
    if(this.state==='spent')this.velocity.y-=dt*6;
    if(this.tumble){this.group.rotateX(dt*this.tumble);this.group.rotateZ(dt*this.tumble*.6);}
    const p=this.group.position;
    this.trailPositions.copyWithin(3,0,this.trailPositions.length-3);this.trailPositions.set([p.x,p.y,p.z],0);this.trailCount=Math.min(22,this.trailCount+1);this.trail.geometry.setDrawRange(0,this.trailCount);this.trail.geometry.attributes.position.needsUpdate=true;
  }
  dispose(){this.group.removeFromParent();const mats=new Set();this.group.traverse(o=>{o.geometry?.dispose();if(o.material)mats.add(o.material);});mats.forEach(m=>m.dispose());this.trail.removeFromParent();this.trail.geometry.dispose();this.trail.material.dispose();}
}
