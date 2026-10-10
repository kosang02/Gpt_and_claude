import * as THREE from 'three';
export class CollisionSystem {
  constructor() {this.ray = new THREE.Raycaster();}
  sweep(from, to, plates, ignored = new Set()) {
    const delta = to.clone().sub(from), distance = delta.length();
    if (!distance) return null;
    this.ray.set(from,delta.normalize()); this.ray.near = 0; this.ray.far = distance;
    const meshes = plates.filter(p=>!ignored.has(p.id)).map(p=>p.mesh);
    for (const mesh of meshes) mesh.updateWorldMatrix(true,false);
    const hit = this.ray.intersectObjects(meshes,false)[0];
    if (!hit) return null;
    const plate = hit.object.userData.plate;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(delta)>0) normal.negate();
    return {plate,point:hit.point,local:plate.group.worldToLocal(hit.point.clone()),normal,incidence:-normal.dot(delta)};
  }
}
