import * as THREE from 'three';
export class Particles {
  constructor(scene,light) {
    this.scene=scene;this.light=light;this.items=[];this.flashTime=0;
    this.shardGeometry=new THREE.TetrahedronGeometry(1,0);
    this.sparkGeometry=new THREE.SphereGeometry(1,5,3);
    this.shardMaterial=new THREE.MeshStandardMaterial({color:0x9ca6a1,metalness:.82,roughness:.35});
    this.sparkMaterial=new THREE.MeshBasicMaterial({color:0xffbf72});
    this.dustGeometry=new THREE.IcosahedronGeometry(1,0);
  }
  impact(point,normal,power,hole,type) {
    this.flashTime=.16;this.light.position.copy(point).addScaledVector(normal,.25);this.light.color.set(type==='jet'?0x93deff:0xffbe77);
    const forward=normal.clone().negate();
    const count=hole?24:10;
    for(let i=0;i<count;i++) {
      const obj=new THREE.Mesh(this.shardGeometry,this.shardMaterial);const size=.04+Math.random()*.1;
      obj.scale.set(size*(.7+Math.random()),size*(.8+Math.random()),size*.3);obj.position.copy(point).addScaledVector(normal,Math.random()*.12);
      const vel=new THREE.Vector3((Math.random()-.5)*3,(Math.random()-.5)*3,(Math.random()-.5)*3).addScaledVector(hole?forward:normal,1+Math.random()*3*power);vel.y+=1.5;
      this.add({obj,vel,spin:new THREE.Vector3(Math.random()*9,Math.random()*10,Math.random()*8),life:35,kind:'shard',radius:size*.35});
    }
    for(let i=0;i<35;i++) {
      const obj=new THREE.Mesh(this.sparkGeometry,this.sparkMaterial);obj.scale.setScalar(.012+Math.random()*.015);obj.position.copy(point);
      const vel=new THREE.Vector3((Math.random()-.5)*6,Math.random()*5,(Math.random()-.5)*6).addScaledVector(normal,2);
      this.add({obj,vel,life:.22+Math.random()*.5,kind:'spark',radius:.01});
    }
    for(let i=0;i<9;i++) {
      const mat=new THREE.MeshBasicMaterial({color:type==='jet'?0x7795a1:0x818077,transparent:true,opacity:.19,depthWrite:false});
      const obj=new THREE.Mesh(this.dustGeometry,mat);obj.scale.setScalar(.13+Math.random()*.14);obj.position.copy(point).addScaledVector(normal,.2);
      this.add({obj,vel:new THREE.Vector3((Math.random()-.5)*.9,.3+Math.random()*.5,(Math.random()-.5)*.9).addScaledVector(normal,.7),life:1.7,kind:'dust',radius:0});
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.1,.008,4,40),new THREE.MeshBasicMaterial({color:type==='jet'?0x94e6f7:0xffd4a3,transparent:true,opacity:.65,depthWrite:false}));
    ring.position.copy(point).addScaledVector(normal,.07);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    this.add({obj:ring,vel:new THREE.Vector3(),life:.25,kind:'ring',radius:0});
    if(type==='jet') {
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.016,.035,2.4,8),new THREE.MeshBasicMaterial({color:0xc4f4ff,transparent:true,opacity:.95,depthWrite:false}));
      beam.position.copy(point).addScaledVector(forward,.8);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),forward);
      this.add({obj:beam,vel:new THREE.Vector3(),life:.32,kind:'beam',radius:0});
    }
  }
  add(item) {this.scene.add(item.obj);this.items.push(item);if(this.items.length>300)this.remove(this.items.shift());}
  remove(p) {p.obj.removeFromParent();if(['dust','ring','beam'].includes(p.kind))p.obj.material.dispose();if(['ring','beam'].includes(p.kind))p.obj.geometry.dispose();}
  update(dt) {
    this.flashTime=Math.max(0,this.flashTime-dt);this.light.intensity=this.flashTime*130;
    for(const p of this.items) {
      p.life-=dt;if(p.sleep)continue;
      if(p.kind==='shard'||p.kind==='spark')p.vel.y-=dt*6;
      p.obj.position.addScaledVector(p.vel,dt);
      if(p.spin){p.obj.rotation.x+=p.spin.x*dt;p.obj.rotation.y+=p.spin.y*dt;p.obj.rotation.z+=p.spin.z*dt;}
      const floorY = Math.abs(p.obj.position.x)<3.7&&Math.abs(p.obj.position.z)<2.05?.11:.01;
      if(p.kind==='shard'&&p.obj.position.y<floorY+p.radius){p.obj.position.y=floorY+p.radius;p.vel.y=Math.abs(p.vel.y)*.26;p.vel.x*=.65;p.vel.z*=.65;p.spin.multiplyScalar(.45);if(p.vel.length()<.22){p.sleep=true;p.life=60;}}
      if(p.kind==='dust'){p.obj.scale.multiplyScalar(1+dt*.8);p.obj.material.opacity=Math.max(0,p.life/1.7*.16);}
      if(p.kind==='ring'){p.obj.scale.addScalar(dt*17);p.obj.material.opacity=Math.max(0,p.life*2.3);}
      if(p.kind==='beam')p.obj.material.opacity=Math.max(0,p.life*3);
    }
    this.items=this.items.filter(p=>{if(p.life>0)return true;this.remove(p);return false;});
  }
  clear(){for(const p of this.items)this.remove(p);this.items=[];this.light.intensity=0;this.flashTime=0;}
}
