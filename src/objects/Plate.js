import * as THREE from 'three';
import { makeGrid, sampleSurface, activeTopology, noise } from '../physics/DeformationSystem.js';
export class Plate {
  constructor(id, options = {}) {
    this.id = id; this.width = options.width ?? 4.4; this.height = options.height ?? 3.8; this.thickness = options.thickness ?? .22;
    this.seed = options.seed ?? id * 13.37; this.hits = options.hits ?? []; this.sectionX = null;
    this.group = new THREE.Group(); this.group.position.fromArray(options.position ?? [0,2.65,0]);
    this.group.rotation.fromArray(options.rotation ?? [0,0,0,'XYZ']);
    this.material = new THREE.MeshStandardMaterial({vertexColors:true, metalness:.78, roughness:.36, side:THREE.DoubleSide});
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.userData.plate = this; this.group.add(this.mesh);
    this.support = new THREE.Group(); this.group.add(this.support);
    this.selection = new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x9eae8b,transparent:true,opacity:.65}));
    this.group.add(this.selection); this.remesh();
  }
  remesh() {
    this.grid = makeGrid(this.width,this.height,this.seed);
    this.rebuild(); this.buildSupport();
    this.selection.geometry.dispose();
    this.selection.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(this.width+.13,this.height+.13,this.thickness+.09));
  }
  buildSupport() {
    for (const child of [...this.support.children]) {child.geometry.dispose(); child.material.dispose(); this.support.remove(child);}
    const add = (w,h,d,x,y,z,color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.48}));
      m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; this.support.add(m);
    };
    for (const sign of [-1,1]) {
      add(.14,.9,.18,sign*(this.width/2-.16),-this.height/2-.38,-.12,0x46575a);
      add(.56,.1,.70,sign*(this.width/2-.16),-this.height/2-.80,0,0x39474b);
      for (const sy of [-1,1]) add(.22,.18,this.thickness+.12,sign*(this.width/2-.09),sy*(this.height/2-.11),0,0x627375);
    }
  }
  rebuild() {
    const grid = this.grid, n = grid.points.length, positions = [], colors = [], indices = [];
    const light = new THREE.Color(), base = new THREE.Color(0x8b9f9d), dark = new THREE.Color(0x202b30), burn = new THREE.Color(0x76665a), silver = new THREE.Color(0xc3c8ba);
    for (let side = 0; side < 2; side++) for (const v of grid.points) {
      const p = sampleSurface(v.x,v.y,this.width,this.height,this.thickness,this.hits,!!side);
      positions.push(p.x,p.y,p.z);
      light.copy(base).multiplyScalar(.88 + noise(v.x,v.y,this.seed)*.16);
      light.lerp(burn,p.strain*.44); light.lerp(dark,p.heat*.87);
      light.lerp(silver, p.fresh*.56); colors.push(light.r,light.g,light.b);
    }
    const topology = activeTopology(grid,this.hits,this.sectionX);
    for (const [a,b,c] of topology.faces) indices.push(a,b,c,c+n,b+n,a+n);
    // Duplicate boundary vertices so cut edges have distinct, hard normals.
    for (const [a,b] of topology.boundary) {
      const start = positions.length/3;
      for (const i of [a,a+n,b+n,b]) {positions.push(...positions.slice(i*3,i*3+3)); colors.push(.49,.51,.44);}
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); geo.setIndex(indices);
    geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
    this.mesh.geometry.dispose(); this.mesh.geometry = geo; this.activeFaceCount = topology.faces.length;
  }
  update(dt) {
    let changed = false;
    for (const hit of this.hits) if (hit.progress < 1) { hit.progress = Math.min(1, hit.progress + dt / .26); changed = true; }
    if (changed) this.rebuild();
  }
  addImpact(hit) {this.hits.push(hit);}
  repair() {this.hits = []; this.rebuild();}
  serialize() {return {id:this.id,width:this.width,height:this.height,thickness:this.thickness,seed:this.seed,position:this.group.position.toArray(),rotation:this.group.rotation.toArray(),hits:this.hits.map(h=>({...h,progress:1}))};}
  dispose() {this.group.traverse(o=>{o.geometry?.dispose(); if(o.material) o.material.dispose();}); this.group.removeFromParent();}
}
