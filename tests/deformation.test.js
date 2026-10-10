import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, activeTopology, sampleSurface, createImpact, isRemoved } from '../src/physics/DeformationSystem.js';
const grid=makeGrid(4.4,3.8,13.37);
const impact=(extra={})=>({...createImpact({x:0,y:0,power:.8,thickness:.22,type:'ap',incidence:1,seed:4,previous:[],direction:{x:0,y:0,z:-1},...extra}),progress:1});
test('a strong impact opens a real aperture and retains boundary edges for its cut wall',()=>{
  const hit=impact();assert.equal(hit.hole,true);assert.equal(isRemoved(0,0,[hit]),true);
  const before=activeTopology(grid,[]),after=activeTopology(grid,[hit]);
  assert.ok(after.faces.length<before.faces.length);assert.ok(after.boundary.length>before.boundary.length);
  // Every retained surface edge is either paired or represented exactly once in the boundary.
  const counts=new Map();for(const face of after.faces)for(let k=0;k<3;k++){const a=face[k],b=face[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');counts.set(key,(counts.get(key)||0)+1);}
  assert.equal([...counts.values()].filter(n=>n===1).length,after.boundary.length);
  assert.ok([...counts.values()].every(n=>n===1||n===2));
});
test('low energy dents both surfaces without removing material or collapsing thickness',()=>{
  const hit=impact({power:.2,type:'ball'});assert.equal(hit.hole,false);
  const front=sampleSurface(0,0,4.4,3.8,.22,[hit]),back=sampleSurface(0,0,4.4,3.8,.22,[hit],true);
  assert.ok(front.z<-.1);assert.ok(Math.abs(front.z-back.z-.22)<1e-8);
  assert.equal(activeTopology(grid,[hit]).faces.length,grid.triangles.length);
});
test('overlapping impacts accumulate deformation while the held outer boundary stays in place',()=>{
  const a=impact({power:.3}),b={...impact({x:.3,power:.3}),hole:false};
  const one=sampleSurface(.1,0,4.4,3.8,.22,[a]),two=sampleSurface(.1,0,4.4,3.8,.22,[a,b]);assert.ok(two.z<one.z);
  assert.equal(sampleSurface(2.2,0,4.4,3.8,.22,[a,b]).z,.11);
});
test('grazing AP impact ricochets while stylized jet uses a different effect',()=>{
  const ap=impact({incidence:.2}),jet=impact({incidence:.2,type:'jet'});assert.equal(ap.ricochet,true);assert.equal(ap.hole,false);assert.equal(jet.ricochet,false);assert.ok(jet.radius<ap.radius);
});
test('damage growth and section geometry remain finite at the plate edge',()=>{
  const h=impact({x:2.12,y:1.8});
  for(const progress of [0,.2,.5,1]){
    h.progress=progress;const topology=activeTopology(grid,[h],.2);assert.ok(topology.faces.length>0);
    for(const p of grid.points){const s=sampleSurface(p.x,p.y,4.4,3.8,.22,[h]);assert.ok([s.x,s.y,s.z].every(Number.isFinite));}
  }
});
test('back-side impact bends toward the opposite side while preserving positive thickness',()=>{
  const hit=impact({power:.3,direction:{x:0,y:0,z:1}});
  const front=sampleSurface(0,0,4.4,3.8,.22,[hit]),back=sampleSurface(0,0,4.4,3.8,.22,[hit],true);
  assert.ok(front.z>.11);assert.ok(front.z>back.z);
});
