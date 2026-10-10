const $ = id => document.getElementById(id);
export class Controls {
  constructor(app) {
    this.app=app;this.toastTimer=null;
    const listen=(id,event,fn)=>$(id).addEventListener(event,fn);
    document.querySelectorAll('[data-ammo]').forEach(button=>button.onclick=()=>{app.ammo=button.dataset.ammo;this.active('[data-ammo]',button);});
    document.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{app.setTool(button.dataset.tool);this.active('[data-tool]',button);});
    document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{app.view(button.dataset.view);this.active('[data-view]',button);});
    for(const id of ['power','aimX','aimY','azimuth','elevation']) listen(id,'input',()=>{
      app[id]=Number($(id).value);$(id+'O').textContent=$(id).value+(['azimuth','elevation'].includes(id)?'°':'');app.updateAim();
    });
    for(const id of ['thickness','tilt']) listen(id,'input',()=>{
      const p=app.selected;if(!p)return;
      if(id==='thickness'){p.thickness=Number($(id).value);p.remesh();}else p.group.rotation.y=Number($(id).value)*Math.PI/180;
      $(id+'O').textContent=Number($(id).value).toFixed(id==='thickness'?2:0)+(id==='tilt'?'°':'');app.updateAim();
    });
    for(const id of ['width','height','posX','posY','posZ']) listen(id,'change',()=>{
      const p=app.selected;if(!p)return;const input=$(id);let value=Number(input.value);
      if(!Number.isFinite(value))value=0;value=Math.max(Number(input.min),Math.min(Number(input.max),value));input.value=value;
      if(id==='width'||id==='height'){p[id]=value;p.remesh();}else p.group.position[id.slice(-1).toLowerCase()]=value;
      app.updateAim();
    });
    listen('plateSelect','change',()=>app.select(Number($('plateSelect').value)));
    listen('addPlate','click',()=>app.addPlate());listen('deletePlate','click',()=>app.deleteSelected());
    listen('repair','click',()=>{app.selected.repair();this.toast('선택한 강판을 복원했습니다.');app.updateAim();});
    listen('fire','click',()=>app.fire());listen('pause','click',()=>app.setPaused(!app.paused));
    listen('step','click',()=>{app.setPaused(true);app.tick(1/60);});listen('speed','change',()=>app.speed=Number($('speed').value));
    listen('wire','click',()=>{app.wire=!app.wire;app.plates.forEach(p=>p.material.wireframe=app.wire);this.toggle('wire',app.wire);});
    listen('section','click',()=>{app.setSection(!app.section);});
    listen('save','click',()=>app.save());listen('load','click',()=>app.load());listen('reset','click',()=>app.reset());
    window.addEventListener('keydown',event=>{
      if(event.code!=='Space'||event.repeat||/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName))return;
      event.preventDefault();app.fire();
    });
    $('loading').hidden=true;
  }
  active(selector,button){document.querySelectorAll(selector).forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});}
  toggle(id,value){$(id).classList.toggle('active',value);$(id).setAttribute('aria-pressed',String(value));}
  sync() {
    const app=this.app,p=app.selected;
    $('plateSelect').replaceChildren(...app.plates.map(plate=>{const o=document.createElement('option');o.value=plate.id;o.textContent=`강판 ${String(plate.id).padStart(2,'0')} · STEEL`;return o;}));
    $('plateSelect').value=p.id;
    for(const id of ['width','height','thickness'])$(id).value=p[id];
    $('thicknessO').textContent=p.thickness.toFixed(2);$('tilt').value=Math.round(p.group.rotation.y*180/Math.PI);$('tiltO').textContent=$('tilt').value+'°';
    for(const axis of ['X','Y','Z'])$('pos'+axis).value=p.group.position[axis.toLowerCase()].toFixed(2);
    $('deletePlate').disabled=app.plates.length<=1;$('addPlate').disabled=app.plates.length>=6;
    this.syncAim();
  }
  syncAim(){for(const id of ['aimX','aimY']){$(id).value=this.app[id];$(id+'O').textContent=Math.round(this.app[id]);}}
  status(text){$('status').textContent=text;}
  log(entry){
    const root=$('history');root.querySelector('.empty-log')?.remove();
    const card=document.createElement('article');card.className='log-card '+entry.kind;
    const small=document.createElement('small');small.textContent=`SHOT ${String(entry.shot).padStart(2,'0')} / PLATE ${String(entry.plate).padStart(2,'0')}`;
    const text=document.createElement('span');text.textContent=entry.label;card.append(small,text);root.prepend(card);while(root.children.length>12)root.lastChild.remove();
  }
  toast(message){clearTimeout(this.toastTimer);$('toast').textContent=message;$('toast').classList.add('show');this.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2700);}
}
