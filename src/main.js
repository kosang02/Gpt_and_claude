import * as THREE from 'three';
import { TransformControls } from '../vendor/TransformControls.js';
import { createEnvironment } from './scene/Environment.js';
import { createCamera, setView } from './scene/Camera.js';
import { Plate } from './objects/Plate.js';
import { Projectile } from './objects/Projectile.js';
import { Particles } from './effects/Particles.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { createImpact, sampleSurface, clamp } from './physics/DeformationSystem.js';
import { Controls } from './ui/Controls.js';
const $=id=>document.getElementById(id);
class ImpactLab {
  constructor() {
    this.root=$('viewport');this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;this.root.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','드래그로 회전하고 강판을 눌러 조준하는 3D 실험실');
    Object.assign(this,createEnvironment(this.renderer));Object.assign(this,createCamera(this.renderer.domElement));
    this.transform=new TransformControls(this.camera,this.renderer.domElement);this.transform.setSize(.8);this.scene.add(this.transform);
    this.transform.addEventListener('dragging-changed',e=>{this.controls.enabled=!e.value;});
    this.transform.addEventListener('objectChange',()=>{this.updateAim();this.ui?.sync();});
    this.particles=new Particles(this.scene,this.impactLight);this.collision=new CollisionSystem();
    this.plates=[];this.projectiles=[];this.nextId=1;this.ammo='ap';this.power=72;this.aimX=0;this.aimY=0;this.azimuth=0;this.elevation=0;this.speed=.25;this.paused=false;this.shots=0;this.wire=false;this.section=false;this.tool='aim';this.history=[];this.shake=0;
    this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.makeAim();this.addPlate({position:[0,2.65,0]});this.ui=new Controls(this);this.ui.sync();this.bindPointer();this.resize();
    if(window.matchMedia('(pointer: coarse)').matches)$('sceneHint').textContent='한 손가락 회전 · 두 손가락 확대 · 탭 조준';
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.root);
    this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.setPaused(true);$('loading').hidden=false;$('loading').textContent='그래픽 연결이 중단되었습니다. 장면을 저장한 뒤 새로고침해 주세요.';});
    this.lastTime=performance.now();this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
  }
  makeAim(){
    this.aim=new THREE.Group();const mat=new THREE.MeshBasicMaterial({color:0xf0a274,transparent:true,opacity:.85,depthTest:false});
    this.aim.add(new THREE.Mesh(new THREE.TorusGeometry(.13,.009,5,40),mat));
    for(let i=0;i<4;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(.10,.008,.008),mat);line.position.set(Math.cos(i*Math.PI/2)*.24,Math.sin(i*Math.PI/2)*.24,0);line.rotation.z=i*Math.PI/2;this.aim.add(line);}
    this.aim.renderOrder=10;this.aim.traverse(o=>o.renderOrder=10);this.scene.add(this.aim);
    this.trajectory=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0x8aaba9,dashSize:.10,gapSize:.11,transparent:true,opacity:.48}));this.scene.add(this.trajectory);
    this.originMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.06),new THREE.MeshBasicMaterial({color:0x91b8b5}));this.scene.add(this.originMarker);
  }
  aimData(){
    const p=this.selected,x=this.aimX/100*p.width/2,y=this.aimY/100*p.height/2;
    const surface=sampleSurface(x,y,p.width,p.height,p.thickness,p.hits);
    p.group.updateWorldMatrix(true,true);
    const target=p.group.localToWorld(new THREE.Vector3(surface.x,surface.y,surface.z+.02));
    const az=this.azimuth*Math.PI/180,el=this.elevation*Math.PI/180;
    const towardOrigin=new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
    return {target,origin:target.clone().addScaledVector(towardOrigin,6),direction:towardOrigin.negate()};
  }
  updateAim(){
    if(!this.selected)return;const a=this.aimData();this.aim.position.copy(a.target);this.aim.quaternion.copy(this.selected.group.quaternion);
    this.originMarker.position.copy(a.origin);const pos=this.trajectory.geometry.attributes.position;pos.setXYZ(0,...a.origin.toArray());pos.setXYZ(1,...a.target.toArray());pos.needsUpdate=true;this.trajectory.geometry.computeBoundingSphere();this.trajectory.computeLineDistances();
    if(this.section){this.selected.sectionX=this.aimX/100*this.selected.width/2;this.selected.rebuild();}
  }
  addPlate(options){
    if(this.plates.length>=6)return;
    // Button click supplies no event/options. New plates start behind the selected one.
    const config=options??{position:[this.selected?.group.position.x??0,2.65,(this.selected?.group.position.z??0)-1.6]};
    const plate=new Plate(config.id??this.nextId++,config);this.nextId=Math.max(this.nextId,plate.id+1);plate.material.wireframe=this.wire;
    this.scene.add(plate.group);this.plates.push(plate);this.select(plate.id);return plate;
  }
  select(id){
    if(this.section)this.setSection(false);this.selected=this.plates.find(p=>p.id===id)??this.plates[0];
    this.plates.forEach(p=>p.selection.visible=p===this.selected);this.aimX=0;this.aimY=0;
    if(this.tool!=='aim')this.transform.attach(this.selected.group);this.updateAim();this.ui?.sync();
  }
  deleteSelected(){if(this.plates.length<=1)return;const p=this.selected;this.transform.detach();this.plates=this.plates.filter(x=>x!==p);p.dispose();this.select(this.plates[0].id);}
  setTool(mode){this.tool=mode;if(mode==='aim')this.transform.detach();else{this.transform.setMode(mode);this.transform.attach(this.selected.group);}this.aim.visible=mode==='aim';this.trajectory.visible=mode==='aim';this.originMarker.visible=mode==='aim';}
  setSection(value){this.section=value;for(const p of this.plates){p.sectionX=value&&p===this.selected?this.aimX/100*p.width/2:null;p.rebuild();}this.ui?.toggle('section',value);if(value)this.ui?.toast('조준 위치에서 절단한 관찰용 단면입니다. 발사하면 전체 강판으로 돌아갑니다.');}
  view(view){setView(this.camera,this.controls,this.selected,view);this.ui?.active('[data-view]',document.querySelector(`[data-view="${view}"]`));}
  setPaused(value){this.paused=value;$('pause').textContent=value?'▶︎':'Ⅱ';$('pause').setAttribute('aria-label',value?'계속 재생':'일시정지');this.ui.toggle('pause',value);this.ui.status(value?'일시정지 · 프레임 관찰':this.projectiles.length?'실험 진행 중':'발사 준비');}
  fire(){
    if(this.projectiles.length>=8){this.ui.toast('현재 충돌체가 정리된 후 다시 발사하세요.');return;}
    if(this.section)this.setSection(false);
    const a=this.aimData(),shot=new Projectile(this.scene,this.ammo,a.origin,a.direction,this.power/100);shot.number=++this.shots;this.projectiles.push(shot);
    $('shotCount').textContent=String(this.shots).padStart(2,'0');if(this.paused)this.setPaused(false);this.ui.status('접근 중 · '+({ap:'AP 형상체',ball:'강철 구체',jet:'가상 제트'}[this.ammo]));
  }
  hit(shot,collision){
    const {plate,point,local,normal,incidence}=collision;
    const localDirection=shot.velocity.clone().normalize().applyQuaternion(plate.group.quaternion.clone().invert());
    const impact=createImpact({x:local.x,y:local.y,power:shot.power,thickness:plate.thickness,type:shot.type,incidence,seed:shot.number*1.831+plate.id,previous:plate.hits,direction:localDirection});
    plate.addImpact(impact);shot.ignored.add(plate.id);shot.hasHit=true;
    shot.group.position.copy(point);this.particles.impact(point,normal,shot.power,impact.hole,shot.type);this.shake=this.reducedMotion?0:.035;
    let label,kind;
    if(impact.ricochet){shot.velocity.reflect(normal).multiplyScalar(.48);shot.tumble=7;shot.state='spent';label='도탄 · 표면 눌림';kind='ricochet';}
    else if(impact.hole){shot.velocity.multiplyScalar(shot.type==='jet'?.69:.58);shot.power*=.67;shot.tumble=2;label=shot.type==='jet'?'제트 · 국소 파단':'관통 · 꽃잎형 파단';kind='fracture';}
    else{shot.velocity.copy(normal).multiplyScalar(.85);shot.velocity.y=.3;shot.tumble=5;shot.state='spent';shot.group.scale.y=shot.type==='ball'?.77:.57;label='소성 함몰 · 굽힘';kind='dent';}
    if(shot.type==='jet'){shot.group.visible=false;if(!impact.hole)shot.age=9;}
    shot.group.position.addScaledVector(shot.velocity.clone().normalize(),.025);
    const entry={shot:shot.number,plate:plate.id,label,kind};this.history.unshift(entry);this.history.length=Math.min(this.history.length,12);this.ui.log(entry);this.ui.status(label);
  }
  tick(dt){
    for(const shot of this.projectiles){
      const start=shot.group.position.clone(),end=start.clone().addScaledVector(shot.velocity,dt);
      const collision=this.collision.sweep(start,end,this.plates,shot.ignored);
      if(collision)this.hit(shot,collision);else shot.group.position.copy(end);
      shot.update(dt);
      const floor=Math.abs(shot.group.position.x)<3.7&&Math.abs(shot.group.position.z)<2.05?.23:.13;
      if(shot.group.position.y<floor){shot.group.position.y=floor;shot.velocity.set(0,0,0);shot.tumble=0;shot.age=Math.max(shot.age,7.5);}
    }
    this.projectiles=this.projectiles.filter(shot=>{if(shot.age<8&&shot.group.position.length()<38)return true;if(!shot.hasHit)this.ui.status('통과 · 경로에 강판이 없습니다');shot.dispose();return false;});
    let deforming=false;for(const p of this.plates){deforming ||= p.hits.some(h=>h.progress<1);p.update(dt);}this.particles.update(dt);if(deforming&&!this.section)this.updateAim();
  }
  bindPointer(){
    const canvas=this.renderer.domElement;let down=null;const pointers=new Set();
    canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);down=pointers.size===1?{x:e.clientX,y:e.clientY,time:performance.now(),id:e.pointerId}:null;});
    canvas.addEventListener('pointerup',e=>{
      pointers.delete(e.pointerId);
      if(!down||e.pointerId!==down.id||this.tool!=='aim'||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7||performance.now()-down.time>550)return;
      const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(mouse,this.camera);
      const hit=ray.intersectObjects(this.plates.map(p=>p.mesh),false)[0];if(!hit)return;
      const p=hit.object.userData.plate;if(p!==this.selected)this.select(p.id);
      const local=p.group.worldToLocal(hit.point.clone());this.aimX=clamp(local.x/(p.width/2)*100,-90,90);this.aimY=clamp(local.y/(p.height/2)*100,-90,90);this.ui.syncAim();this.updateAim();
    });
    canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;});
  }
  save(){
    const state={version:2,plates:this.plates.map(p=>p.serialize()),shots:this.shots,history:this.history};
    try{localStorage.setItem('impact-lab-scene-v2',JSON.stringify(state));this.ui.toast('강판 배치와 누적 손상을 이 브라우저에 저장했습니다.');}catch{this.ui.toast('브라우저 저장 공간에 접근할 수 없습니다.');}
  }
  validate(state){
    const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
    if(!state||state.version!==2||!Array.isArray(state.plates)||state.plates.length<1||state.plates.length>6||!finite(state.shots,0,1e6))throw Error('scene');
    const ids=new Set();
    for(const p of state.plates){
      if(!Number.isInteger(p.id)||p.id<1||ids.has(p.id)||!finite(p.width,2,6)||!finite(p.height,2,5)||!finite(p.thickness,.1,.6)||!finite(p.seed,-1e6,1e6)||!Array.isArray(p.position)||p.position.length!==3||!p.position.every(v=>finite(v,-100,100))||!Array.isArray(p.rotation)||p.rotation.length!==4||!p.rotation.slice(0,3).every(v=>finite(v,-100,100))||!['XYZ','YXZ','ZXY','ZYX','YZX','XZY'].includes(p.rotation[3])||!Array.isArray(p.hits)||p.hits.length>500)throw Error('plate');
      ids.add(p.id);for(const h of p.hits){for(const k of ['x','y','radius','holeRadius','depth','shearX','shearY','seed','progress'])if(!finite(h[k],-10000,10000))throw Error('impact');if((h.pushSign!==undefined&&h.pushSign!==1&&h.pushSign!==-1)||h.radius<=0||h.holeRadius<=0||h.progress<0||h.progress>1||!['ap','ball','jet'].includes(h.type)||typeof h.hole!=='boolean'||typeof h.ricochet!=='boolean')throw Error('impact');}
    }
  }
  load(){
    let state;try{state=JSON.parse(localStorage.getItem('impact-lab-scene-v2'));if(!state){this.ui.toast('저장된 장면이 없습니다.');return;}this.validate(state);}catch{this.ui.toast('저장된 장면을 읽을 수 없습니다. 현재 장면은 유지됩니다.');return;}
    this.clear();this.nextId=1;state.plates.forEach(p=>this.addPlate(p));this.shots=state.shots;this.history=[];
    $('history').replaceChildren();for(const e of (Array.isArray(state.history)?state.history:[]).slice(0,12).reverse()){if(typeof e.label==='string'&&['dent','fracture','ricochet'].includes(e.kind)){this.history.unshift(e);this.ui.log(e);}}
    $('shotCount').textContent=String(this.shots).padStart(2,'0');this.select(this.plates[0].id);this.ui.toast('강판 배치와 손상을 복원했습니다.');
  }
  clear(){this.transform.detach();for(const p of this.plates)p.dispose();this.plates=[];for(const s of this.projectiles)s.dispose();this.projectiles=[];this.particles.clear();this.section=false;this.ui.toggle('section',false);}
  reset(){this.clear();this.nextId=1;this.shots=0;this.history=[];this.addPlate({position:[0,2.65,0]});this.view('perspective');$('shotCount').textContent='00';$('history').innerHTML='<p class="empty-log">새로운 실험을 기다리는 중<span>강판의 한 점을 선택하고 실험을 시작하세요.</span></p>';this.ui.status('발사 준비');this.ui.toast('새 실험 장면을 준비했습니다.');}
  resize(){const w=this.root.clientWidth,h=this.root.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
  frame(now){
    requestAnimationFrame(this.frame);const dt=Math.min((now-this.lastTime)/1000,.05);this.lastTime=now;
    if(!this.paused)this.tick(dt*this.speed);this.controls.update();
    const original=this.camera.position.clone();if(this.shake>0&&!this.paused){this.camera.position.x+=(Math.random()-.5)*this.shake;this.camera.position.y+=(Math.random()-.5)*this.shake;this.shake*=.8;}
    this.renderer.render(this.scene,this.camera);this.camera.position.copy(original);
  }
}
try {
  const app=new ImpactLab();
  // Opt-in diagnostics for reproducible geometry and browser regression checks.
  if(new URLSearchParams(location.search).has('debug'))window.impactLab=app;
}catch(error){console.error(error);$('loading').hidden=false;$('loading').textContent='3D 화면을 시작하지 못했습니다. WebGL을 지원하는 브라우저에서 새로고침해 주세요.';}
