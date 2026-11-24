'use strict';

(() => {
  const $=s=>document.querySelector(s), R=Rocks.render, Y=Rocks.yard, M=Rocks.models;
  const {TOTAL,pile,truck,shed,delivery,chair,cells}=Y, {tools}=M;
  const {clamp,mix,TAU,worldPose}=R;
  const canvas=R.canvas;
  if(!R.available){
    $('#error').style.display='block';
    return;
  }
  const SAVE='the-rocks-v01', pad={x:truck.x,z:truck.z+2.75};
  const spawn={x:-.65,z:5.6,yaw:-.39,pitch:-.02};
  const fresh=()=>({version:3,credits:0,removed:0,bag:0,tier:0,owned:[0],hits:{},rubble:{},depleted:Y.spread(0),vehicle:null});
  const num=n=>n.toLocaleString('en-US');
  const int=(n,max=TOTAL)=>Number.isFinite(n)?clamp(Math.trunc(n),0,max):0;
  const finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
  function migration(raw){
    if(!raw||!Array.isArray(raw.owned))return fresh();
    const s=fresh();
    s.removed=int(raw.removed);
    s.credits=int(raw.credits,s.removed);
    s.owned=[...new Set([0,...raw.owned.filter(i=>Number.isInteger(i)&&i>0&&i<tools.length)])].sort((a,b)=>a-b);
    s.tier=s.owned.includes(raw.tier)?raw.tier:0;
    const t=tools[s.tier];
    s.bag=int(raw.bag,Math.min(TOTAL-s.removed,t.cap));
    for(const [key,n] of Object.entries(raw.hits||{})){
      let id=key;
      if(key.startsWith('v2:')){
        const legacy=Number(key.slice(3));
        id='stone-'+(legacy-(legacy>=4800?4800:1050));
      }
      const match=/^stone-(\d+)$/.exec(id);
      if(!match||+match[1]>=38)continue;
      s.hits[id]=int(n,+match[1]<26?2:4);
    }
    let pending=TOTAL-s.removed-s.bag;
    for(const [id,n] of Object.entries(raw.rubble||{})){
      if(!Object.prototype.hasOwnProperty.call(s.hits,id))continue;
      const amount=int(n,Math.min(1800,pending));
      if(amount){
        s.rubble[id]=amount;
        pending-=amount;
      }
    }
    const ledger=TOTAL-pending;
    const valid=Array.isArray(raw.depleted)&&raw.depleted.length===cells.length &&
      raw.depleted.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=cells[i].capacity) &&
      raw.depleted.reduce((sum,n)=>sum+n,0)===ledger;
    s.depleted=valid?raw.depleted.slice():Y.spread(ledger);
    if(t.eye){
      const v=raw.vehicle;
      s.vehicle={
        x:clamp(finite(v?.x,delivery.x),-12.9,12.9),
        z:clamp(finite(v?.z,delivery.z),-10.6,6.5),
        yaw:finite(v?.yaw,delivery.yaw),
        mounted:!!v?.mounted
      };
    }
    return s;
  }
  let state;
  try{state=migration(JSON.parse(localStorage.getItem(SAVE)));}
  catch{state=fresh();}
  let player={...spawn};
  if(state.vehicle?.mounted){
    player.x=state.vehicle.x;
    player.z=state.vehicle.z;
    player.yaw=state.vehicle.yaw;
  }else if(state.vehicle&&state.bag){
    player.x=state.vehicle.x;player.z=state.vehicle.z;
  }
  const surface=Y.createSurface(()=>state);
  const heldKeys=new Set();
  const stick={pointer:null,x:0,y:0};
  let look=null, workPointer=null, started=false, shopOpen=false;
  let clock=0,lastFrame=0,lastDraw=-1,toastUntil=0,dialogueUntil=0,lastSave=0;
  let action=null,walk=0,wheel=0,speed=0,steering=0,blade=false,viewHeight=0;
  let hint='',actionText='',mountText='';
  const current=()=>tools[state.tier];
  const mounted=()=>state.vehicle?.mounted===true;
  const close=(a,b,dist)=>Math.hypot(a.x-b.x,a.z-b.z)<dist;
  const facing=yaw=>[Math.sin(yaw),-Math.cos(yaw)];
  const nearShed=()=>!mounted()&&Math.abs(player.x-shed.x)<2.52&&player.z>shed.z-3.30&&player.z<shed.z+1.15;
  const nearTruck=()=>close(player,pad,mounted()?3.05:2.23);
  const nearVehicle=()=>state.vehicle&&close(player,state.vehicle,current().width*.65+1.34);
  const yardLeft=()=>TOTAL-state.removed-state.bag;
  function save(){
    try{localStorage.setItem(SAVE,JSON.stringify(state));}catch{}
    lastSave=clock;
  }
  function say(text){
    $('#toast').textContent=text;
    $('#toast').classList.add('show');
    toastUntil=clock+1.95;
  }
  function updateUI(){
    const t=current();
    $('#remaining').textContent=num(yardLeft());
    $('#credits').textContent=num(state.credits);
    $('#toolName').textContent=t.n;
    $('#bag').textContent=`${num(state.bag)} / ${num(t.cap)}`;
    $('#bagLabel').textContent=state.bag>=t.cap?'FULL · unload':t.mode==='dozer'?'ahead of blade':t.eye?'machine load':'carried';
    $('#bar i').style.width=`${state.removed/TOTAL*100}%`;
    if(shopOpen)drawShop();
  }
  function drawShop(){
    $('#shopBalance').textContent=num(state.credits)+' rock credits';
    $('#items').innerHTML=tools.map((t,i)=>{
      const own=state.owned.includes(i), selected=state.tier===i;
      const blocked=selected||(!own&&(state.credits<t.cost||!state.owned.includes(i-1)));
      const rate=t.mode==='dozer'?num(Math.round(t.hit/t.cycle))+'/sec at full push':t.hold?num(Math.round(t.hit/t.cycle))+'/sec':num(t.hit)+'/load';
      return `<div class="item"><div><b>${t.n}</b><small>${num(t.cap)} capacity · ${rate}</small><small>${t.desc}</small></div><button type="button" data-tier="${i}" class="${!own&&!blocked?'buy':''}" ${blocked?'disabled':''}>${selected?'Equipped':own?'Equip':num(t.cost)+' rocks'}</button></div>`;
    }).join('');
    $('#items').scrollTop=Math.min($('#items').scrollHeight,$('#items').scrollTop);
  }
  function clearMovement(){
    heldKeys.clear();
    stick.pointer=null;stick.x=stick.y=0;
    workPointer=null;look=null;
    $('#knob').style.transform='';
  }
  function openShop(open){
    if(open&&(!started||!nearShed())){
      if(started)say(mounted()?'Exit the machine before visiting the shed.':'Visit the shed in the far right corner.');
      return;
    }
    if(open&&action)return;
    shopOpen=open;
    $('#shop').classList.toggle('open',open);
    clearMovement();
    if(open){
      drawShop();
      const list=$('#items'), next=list.querySelector('button.buy')||list.querySelector('button[disabled]:not([data-tier="'+state.tier+'"])');
      if(next)list.scrollTop=Math.max(0,next.closest('.item').offsetTop-list.offsetTop-list.clientHeight*.42);
    }
  }
  function equip(i){
    const t=tools[i], own=state.owned.includes(i);
    if(!t||state.tier===i||!shopOpen||!nearShed()||action)return;
    if(state.bag&&(state.bag>t.cap||current().eye||t.eye)){
      say('Unload the current equipment before switching.');
      return;
    }
    if(!own){
      if(state.credits<t.cost||!state.owned.includes(i-1))return;
      state.credits-=t.cost;
      state.owned.push(i);
    }
    state.tier=i;
    state.vehicle=t.eye?{...delivery,mounted:false}:null;
    speed=steering=wheel=0;blade=false;
    openShop(false);
    updateUI();save();
    say(t.eye?t.n+' delivered on the pad outside.':'Picked up '+t.n+' from the shed.');
  }
  function worldBlock(x,z,vehicle=false){
    const radius=vehicle?current().width*.46:.24;
    if(x<-14.12+radius||x>14.12-radius||z<-11.64+radius||z>7.83-radius)return true;
    if(Math.abs(x-truck.x)<1.02+radius&&Math.abs(z-truck.z)<2.10+radius)return true;
    if(Math.abs(x-chair.x)<.37+radius&&Math.abs(z-chair.z)<.34+radius)return true;
    if(Math.hypot(x+12.2,z+9.4)<.22+radius)return true;
    const dx=x-shed.x,dz=z-shed.z;
    if(Math.abs(dx)<2.07+radius&&Math.abs(dz)<1.69+radius){
      if(vehicle||dz>1.0||Math.abs(dx)>.99)return true;
    }
    const height=surface.height(x,z);
    return height>(vehicle?(.80+current().width*.14):.51);
  }
  function mount(){
    const v=state.vehicle;
    if(!started||shopOpen||!v||action)return;
    if(v.mounted){
      const t=current(), lateral=[Math.cos(v.yaw),Math.sin(v.yaw)], front=facing(v.yaw);
      const clear=[[0,1],[0,-1],[-1,0],[1,0]].find(([f,l])=>
        !worldBlock(v.x+(front[0]*f+lateral[0]*l)*(t.width*.56+.72),v.z+(front[1]*f+lateral[1]*l)*(t.width*.56+.72)));
      if(!clear){say('Move somewhere with room to step out.');return;}
      const [f,l]=clear, d=t.width*.56+.72;
      player.x=v.x+(front[0]*f+lateral[0]*l)*d;player.z=v.z+(front[1]*f+lateral[1]*l)*d;
      v.mounted=false;
      blade=false;
      speed=0;
      say(t.n+' parked.');
    }else if(nearVehicle()){
      v.mounted=true;
      player.x=v.x;player.z=v.z;player.yaw=v.yaw;player.pitch=-.17;
      say(current().mode==='dozer'?'Lower the blade and drive into the pile.':'Drive to the pile to load.');
    }else{
      say('Walk up to the delivered machine.');
      return;
    }
    clearMovement();save();
  }
  function motion(dt){
    let sx=stick.x+Number(heldKeys.has('d'))-Number(heldKeys.has('a'));
    let sy=stick.y+Number(heldKeys.has('s'))-Number(heldKeys.has('w'));
    player.yaw+=(Number(heldKeys.has('arrowright'))-Number(heldKeys.has('arrowleft')))*dt*1.85;
    player.pitch=clamp(player.pitch+(Number(heldKeys.has('arrowup'))-Number(heldKeys.has('arrowdown')))*dt*1.28,-1.18,1);
    const magnitude=Math.hypot(sx,sy);
    if(magnitude>1){sx/=magnitude;sy/=magnitude;}
    const t=current();
    if(mounted()){
      const v=state.vehicle, locked=action?.kind==='dump';
      const throttle=locked?0:-sy;
      const turning=locked?0:sx*t.turn*dt;
      const tracks=t.mode==='excavator'||t.mode==='dozer'||t.mode==='skid';
      steering=mix(steering,sx,Math.min(1,dt*6));
      const turn=turning*(tracks?1:(.42+.58*Math.min(1,Math.abs(speed)/2)))*(throttle<-.05&&!tracks?-1:1);
      v.yaw+=turn;player.yaw+=turn;
      if(Math.abs(player.yaw)>TAU*2)player.yaw%=TAU;
      if(Math.abs(v.yaw)>TAU*2)v.yaw%=TAU;
      const reverse=throttle<0?.58:1;
      const travel=t.mode==='dozer'&&blade&&state.bag>0?.78:1;
      speed=mix(speed,throttle*t.speed*reverse*travel,Math.min(1,dt*(locked?12:4.6)));
      if(locked)speed=0;
      const [dx,dz]=facing(v.yaw);
      const nx=v.x+dx*speed*dt,nz=v.z+dz*speed*dt;
      const beforeX=v.x,beforeZ=v.z;
      if(!worldBlock(nx,v.z,true))v.x=nx;
      if(!worldBlock(v.x,nz,true))v.z=nz;
      const moved=Math.hypot(v.x-beforeX,v.z-beforeZ);
      wheel+=Math.sign(speed)*moved/(t.mode==='loader'?.47:.32)+turn*.48;
      player.x=v.x;player.z=v.z;
      if(t.mode==='dozer'&&blade&&throttle>.25&&speed>.35&&!action&&state.bag<t.cap&&yardLeft()){
        const target=machineTarget();
        if(target)startWork(target);
      }
      if((moved>.01||Math.abs(turn)>.004)&&clock-lastSave>1.3)save();
      return;
    }
    speed=steering=0;
    if(magnitude>.045){
      const barrow=t.mode==='barrow', factor=barrow?(state.bag>=t.cap?.89:.97):1;
      const distance=dt*4.65*factor;
      const dx=sx*Math.cos(player.yaw)-sy*Math.sin(player.yaw),dz=sx*Math.sin(player.yaw)+sy*Math.cos(player.yaw);
      const nx=player.x+dx*distance,nz=player.z+dz*distance;
      const oldX=player.x,oldZ=player.z;
      const clearance=(x,z)=>!barrow||!worldBlock(x+Math.sin(player.yaw)*.64,z-Math.cos(player.yaw)*.64);
      if(!worldBlock(nx,player.z)&&clearance(nx,player.z))player.x=nx;
      if(!worldBlock(player.x,nz)&&clearance(player.x,nz))player.z=nz;
      const moved=Math.hypot(player.x-oldX,player.z-oldZ);
      if(moved>.0001){
        walk+=moved*3.05;
        wheel+=Math.sign(-sy||1)*moved/.255;
      }
    }
  }

  function rocky(x,z,radius){
    let best=null,distance=Infinity;
    for(const rock of surface.geology){
      if(!surface.exposed(rock)&&!state.rubble[rock.id])continue;
      const d=Math.hypot(rock.x-x,rock.z-z);
      if(d<distance&&d<radius){best=rock;distance=d;}
    }
    return best;
  }
  function handTarget(){
    if(!yardLeft())return null;
    const {x,z,yaw,pitch}=player, [fx,fz]=facing(yaw);
    if(Math.hypot((x-pile.x)/pile.rx,(z-pile.z)/pile.rz)>1.51)return null;
    let aimed=null,score=.94;
    for(const rock of surface.geology){
      const rubble=state.rubble[rock.id]>0;
      if(!rubble&&!surface.exposed(rock))continue;
      const dx=rock.x-x,dz=rock.z-z,dy=surface.height(rock.x,rock.z)+(rubble?.14:rock.size*.58)-1.58;
      const d=Math.hypot(dx,dy,dz);
      if(d>3.25||d<.01)continue;
      const dot=(dx*fx+dz*fz)*Math.cos(pitch)/d+dy*Math.sin(pitch)/d;
      if(dot>score){aimed=rock;score=dot;}
    }
    if(aimed)return {x:aimed.x,z:aimed.z,rock:aimed};
    for(let d=.60;d<=2.85;d+=.32){
      const X=x+fx*d,Z=z+fz*d;
      if(surface.available(Y.index(X,Z))&&surface.height(X,Z)>.018)return {x:X,z:Z};
    }
    const fallback=surface.nearest(x,z,2.0);
    if(fallback)return {x:fallback.x,z:fallback.z};
    const last=rocky(x,z,2);
    return last&&state.rubble[last.id]?{x:last.x,z:last.z,rock:last}:null;
  }
  function machineTarget(){
    if(!yardLeft())return null;
    const v=state.vehicle,t=current(),[fx,fz]=facing(v.yaw), lx=-fz,lz=fx;
    const margin=t.mode==='excavator'?1.17:t.mode==='dozer'?.96:.68;
    let target=null,score=Infinity;
    for(let d=t.reach-.58;d<=t.reach+margin+.01;d+=.29){
      for(const side of [0,-.38,.38,-.76,.76]){
        const X=v.x+fx*d+lx*side*t.width,Z=v.z+fz*d+lz*side*t.width;
        const cell=Y.index(X,Z);
        if(!surface.available(cell)&&!surface.geology.some(g=>state.rubble[g.id]&&Math.hypot(g.x-X,g.z-Z)<.67))continue;
        const depth=Math.abs(d-t.reach)+Math.abs(side)*.47;
        if(depth<score){score=depth;target={x:X,z:Z};}
      }
    }
    if(target)target.rock=rocky(target.x,target.z,t.mode==='cart'?.48:.77);
    return target;
  }
  function startWork(target){
    const t=current();
    action={kind:'work',start:clock,at:t.impact,end:t.cycle,target,done:false};
  }
  function requestAction(){
    if(!started||shopOpen||action)return;
    const t=current();
    if(t.eye&&!mounted()){
      if(nearShed())openShop(true);
      else mount();
      return;
    }
    if(nearTruck()&&state.bag){
      const cycle=t.eye?.88:t.mode==='barrow'?.60:.39;
      action={kind:'dump',start:clock,end:cycle,at:cycle*.59,done:false};
      return;
    }
    if(nearShed()){openShop(true);return;}
    if(!yardLeft()){say(state.bag?'Bring the last load to the truck.':'Done. Larry thinks you missed one.');return;}
    if(t.mode==='dozer'){
      blade=!blade;
      say(blade?'Blade down. Drive forward into the gravel.':'Blade raised.');
      return;
    }
    if(state.bag>=t.cap){say('Full. Bring the load to the truck.');return;}
    const target=mounted()?machineTarget():handTarget();
    if(!target){say(t.eye?'Bring the front of the machine to the gravel.':'Move closer to the rock mountain.');return;}
    if(target.rock&&!state.rubble[target.rock.id]&&(!t.power||target.rock.type===2&&!t.boulder)){
      if(t.mode==='cart'||t.mode==='vac'||t.mode==='barrow'){
        startWork({...target,rock:null});
        return;
      }
      say(target.rock.type===2?'Too big. Use a pickaxe or a powered breaker.':'Use a garden shovel or pickaxe for large stones.');
      return;
    }
    startWork(target);
  }
  function performWork(target){
    const t=current(), {x,z,rock}=target;
    if(mounted()?Math.hypot(x-player.x,z-player.z)>t.reach+1.62:Math.hypot(x-player.x,z-player.z)>3.24)return;
    const space=t.cap-state.bag;
    if(!space)return;
    let n=0;
    if(rock&&state.rubble[rock.id]){
      n=Math.min(space,state.rubble[rock.id]);
      state.rubble[rock.id]-=n;
      if(!state.rubble[rock.id])delete state.rubble[rock.id];
      surface.changed();
    }else if(rock&&t.power&&surface.exposed(rock)&&(rock.type===1||t.boulder)){
      const hits=Math.min(rock.req,(state.hits[rock.id]||0)+t.power);
      state.hits[rock.id]=hits;
      surface.changed();
      if(hits<rock.req){
        if(!t.hold)say('Breaking rock · '+hits+'/'+rock.req);
        surface.puff(x,z,7);
        save();
        return;
      }
      const loose=surface.excavate(x,z,rock.type===2?(t.mode==='hammer'?1500:450):40,.82);
      if(loose){
        state.rubble[rock.id]=loose;
        surface.puff(x,z,loose);
        if(!t.eye&&(t.mode==='hammer'||t.mode==='jack')){
          say('Rock broken. Collect the rubble.');
          save();
          return;
        }
        n=Math.min(space,loose);
        if(n===loose)delete state.rubble[rock.id];
        else state.rubble[rock.id]-=n;
      }
    }
    // Heavy equipment sweeps the surrounding gravel even when it catches a boulder.
    if(!n||t.eye)n+=surface.excavate(x,z,Math.min(space-n,t.hit),t.eye?(t.mode==='dozer'?1.65:t.mode==='excavator'?1.22:.90):.70);
    if(!n){if(!t.hold&&t.mode!=='dozer')say('That patch is clear. Move along the pile.');return;}
    state.bag+=n;
    const direction=facing(mounted()?state.vehicle.yaw:player.yaw).map(v=>v*(t.mode==='dozer'?1:-1));
    surface.puff(x,z,n,direction);
    if(state.bag>=t.cap)say('Full. Take the load to the truck.');
    else if(!t.hold&&t.mode!=='dozer')say('+'+num(n)+(n===1?' rock':' rocks'));
    updateUI();save();
  }
  function finishDump(){
    if(!nearTruck()||!state.bag)return;
    const n=state.bag, before=state.removed;
    state.bag=0;
    state.credits+=n;
    state.removed+=n;
    if((before<70&&state.removed>=70)||(before<220&&state.removed>=220))surface.changed();
    if(current().mode==='dozer')blade=false;
    surface.puff(pad.x,pad.z,Math.min(n,32));
    say(state.removed===TOTAL?'Done. Larry thinks you missed one.':'+'+num(n)+' rock credits');
    updateUI();save();
  }
  function actions(){
    if(action){
      const age=clock-action.start;
      if(!action.done&&age>=action.at){
        action.done=true;
        if(action.kind==='dump')finishDump();
        else performWork(action.target);
      }
      if(age>=action.end)action=null;
    }
    if(!action&&current().hold&&(workPointer!==null||heldKeys.has('e')||heldKeys.has(' '))&&!(nearTruck()&&state.bag)){
      if((!current().eye&&state.bag<current().cap&&handTarget())||(mounted()&&state.bag<current().cap&&machineTarget()))requestAction();
    }
  }

  const larry={x:-2.35,z:6.36,yaw:-.93,clip:'stand',at:0,until:2.4,hidden:false,path:null,route:0,lines:new Set(),lastLine:-12};
  const points={
    door:{x:-.8,z:7.50,yaw:0},patio:{x:-2.35,z:6.36,yaw:-.93},edge:{x:-4.1,z:4.14,yaw:-.15},
    lawn:{x:-8.3,z:4.85,yaw:.40},chair:{...chair},east:{x:1.9,z:4.83,yaw:-.9}
  };
  const visits=[
    ['edge','inspect',5.2],['chair','sit',9.5],['lawn','hips',4.5],['patio','watch',4.0],
    ['east','drink',5.0],['door','inside',6.7],['patio','stand',4.5]
  ];
  const lines=[
    ['finish',()=>state.removed===TOTAL,'Think you missed one.'],
    ['dozer',()=>state.owned.includes(15),'Try not to tear up the grass.'],
    ['digger',()=>state.owned.includes(13),'Where’d you get an excavator?'],
    ['electric',()=>state.owned.includes(9),'You running that off my electric?'],
    ['progress',()=>state.removed>=1200,'You’re making pretty good progress.'],
    ['back',()=>state.removed>=18,'I would’ve done it myself, but my back’s been acting up.'],
    ['hello',()=>true,'Appreciate you coming over, bud.']
  ];
  function setLarry(clip,duration){
    larry.clip=clip;larry.at=clock;larry.until=clock+duration;
    larry.hidden=clip==='inside';
  }
  function turnTo(from,to,dt){
    let delta=(to-from)%TAU;
    if(delta>Math.PI)delta-=TAU;
    if(delta< -Math.PI)delta+=TAU;
    return from+clamp(delta,-dt*3.4,dt*3.4);
  }
  function updateLarry(dt){
    if(larry.path){
      const [goal,clip,seconds]=larry.path, p=points[goal];
      const dx=p.x-larry.x,dz=p.z-larry.z,d=Math.hypot(dx,dz);
      if(d<.037){
        larry.x=p.x;larry.z=p.z;larry.yaw=p.yaw;
        larry.path=null;setLarry(clip,seconds);
      }else{
        larry.yaw=turnTo(larry.yaw,Math.atan2(dx,-dz),dt);
        const step=Math.min(d,dt*1.30)/d;
        larry.x+=dx*step;larry.z+=dz*step;
      }
    }else if(clock>=larry.until){
      if(larry.hidden){larry.x=points.door.x;larry.z=points.door.z;}
      larry.path=visits[larry.route++%visits.length];
      setLarry('walk',0);
    }
    if(!larry.hidden&&!larry.path&&larry.clip!=='sit'&&larry.clip!=='inspect'&&close(player,larry,5)){
      larry.yaw=turnTo(larry.yaw,Math.atan2(player.x-larry.x,larry.z-player.z),dt);
    }
    if(!larry.hidden&&!larry.path&&clock-larry.lastLine>10&&close(player,larry,5.5)){
      const line=lines.find(([id,when])=>!larry.lines.has(id)&&when());
      if(line){
        const [id,,text]=line;
        larry.lines.add(id);larry.lastLine=clock;
        $('#dialogue span').textContent='“'+text+'”';
        $('#dialogue').hidden=false;
        dialogueUntil=clock+4.4;
        if(larry.clip!=='sit')setLarry('talk',4.4);
      }
    }
    if(clock>dialogueUntil)$('#dialogue').hidden=true;
  }
  function lastRocksHint(){
    if(yardLeft()>12_000_000)return '';
    let closest=surface.nearest(player.x,player.z,Infinity);
    for(const rock of surface.geology){
      if(state.rubble[rock.id]&&(!closest||close(rock,player,Math.hypot(closest.x-player.x,closest.z-player.z))))closest=rock;
    }
    if(!closest)return '';
    const dx=closest.x-player.x,dz=closest.z-player.z;
    const d=Math.hypot(dx,dz);
    if(d<1.1)return 'Last gravel underfoot · aim around this patch';
    const bearings=['north','northeast','east','southeast','south','southwest','west','northwest'];
    const bearing=bearings[(Math.round(Math.atan2(dx,-dz)*4/Math.PI)+8)%8];
    return 'Nearest remaining gravel · '+Math.round(d)+' m '+bearing;
  }
  function context(){
    const t=current(), riding=mounted(), vehicle=t.eye;
    let h,a,b='';
    if(!yardLeft()&&!state.bag){h='The yard is clear.';a='DONE';}
    else if(nearTruck()&&state.bag&&(!vehicle||riding)){h='Unload into the truck';a='UNLOAD';}
    else if(nearShed()){h='Tool shed · buy or swap equipment';a='TOOLS';}
    else if(vehicle&&!riding){h=nearVehicle()?'Enter '+t.n:'Find your machine on the delivery pad or where you parked it';a='ENTER';}
    else if(state.bag>=t.cap){h='Load full · head to the truck';a=t.mode==='dozer'?(blade?'RAISE':'LOWER BLADE'):'FULL';}
    else if(riding){
      if(t.mode==='dozer'){
        h=blade?(machineTarget()?'Drive forward into the rocks':lastRocksHint()||'Drive forward into the rocks'):'Lower the blade to push gravel';
        a=blade?'RAISE':'LOWER BLADE';
      }else{
        h=machineTarget()?'Work the gravel in front of you':lastRocksHint()||'Bring the front of the machine to the pile';
        a={cart:'PICK UP',skid:'SCOOP',excavator:'DIG',loader:'LOAD'}[t.mode];
      }
    }else{
      const target=handTarget();
      if(!target){h=lastRocksHint()||(state.bag?'Find the truck or collect more gravel':'Walk toward the rock mountain');a='COLLECT';}
      else if(target.rock&&state.rubble[target.rock.id]){h='Loose rubble · collect it';a='COLLECT';}
      else if(target.rock){
        h=target.rock.type===2?'Boulder · aim here to break it':'Large stone · aim here to break it';
        a=t.mode==='jack'?'DRILL':t.mode==='vac'?'VACUUM':'BREAK';
      }else{h=t.hold?'Hold to collect gravel':'Collect the gravel';a=t.mode==='jack'?'DRILL':t.mode==='vac'?'VACUUM':t.mode==='shovel'?'SCOOP':'COLLECT';}
    }
    if(riding)b='EXIT';
    else if(vehicle&&nearVehicle()&&a!=='ENTER')b='ENTER';
    if(h!==hint){$('#hint').textContent=h;hint=h;}
    if(a!==actionText){$('#act').textContent=a;actionText=a;}
    if(b!==mountText){
      $('#mount').textContent=b;$('#mount').hidden=!b;mountText=b;
      $('#shopBtn').hidden=riding;
    }
    $('#shopBtn').style.opacity=nearShed()?'1':'.65';
    if(clock>=toastUntil)$('#toast').classList.remove('show');
  }

  $('#shopBtn').onclick=()=>openShop(true);
  $('#close').onclick=()=>openShop(false);
  $('#items').onclick=e=>{const button=e.target.closest('button[data-tier]');if(button)equip(+button.dataset.tier);};
  $('#mount').onclick=mount;
  $('#act').onclick=e=>{
    if(!current().hold||e.detail===0)requestAction();
  };
  $('#act').addEventListener('pointerdown',e=>{
    if(!current().hold)return;
    workPointer=e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    requestAction();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
    $('#act').addEventListener(event,e=>{if(e.pointerId===workPointer)workPointer=null;});
  }
  $('#start').onclick=()=>{
    started=true;$('#intro').style.display='none';
    if(state.vehicle&&!mounted())say('Your machine is where you parked it or on the delivery pad.');
  };
  $('#reset').onclick=()=>{
    if(!confirm('Start over? All progress will be lost.'))return;
    state=fresh();player={...spawn};
    speed=wheel=walk=0;blade=false;action=null;
    Object.assign(larry,{x:points.patio.x,z:points.patio.z,yaw:points.patio.yaw,path:null,route:0,lastLine:clock-12});
    larry.lines.clear();setLarry('stand',2.4);
    surface.invalidate();openShop(false);updateUI();save();
  };
  function moveStick(e){
    const r=$('#stick').getBoundingClientRect();
    let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
    const d=Math.hypot(dx,dy),max=r.width*.33;
    if(d>max){dx*=max/d;dy*=max/d;}
    stick.x=dx/max;stick.y=dy/max;
    $('#knob').style.transform=`translate(${dx}px,${dy}px)`;
  }
  $('#stick').addEventListener('pointerdown',e=>{
    if(stick.pointer!==null||!started||shopOpen)return;
    e.preventDefault();stick.pointer=e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  $('#stick').addEventListener('pointermove',e=>{if(e.pointerId===stick.pointer)moveStick(e);});
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
    $('#stick').addEventListener(event,e=>{
      if(e.pointerId!==stick.pointer)return;
      stick.pointer=null;stick.x=stick.y=0;$('#knob').style.transform='';
    });
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!started||shopOpen||look)return;
    look={id:e.pointerId,x:e.clientX,y:e.clientY};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(look?.id!==e.pointerId)return;
    player.yaw+=(e.clientX-look.x)*.005;
    player.pitch=clamp(player.pitch-(e.clientY-look.y)*.005,-1.18,1);
    look.x=e.clientX;look.y=e.clientY;
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
    canvas.addEventListener(event,e=>{if(look?.id===e.pointerId)look=null;});
  }
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(!started)return;
    if(k==='escape'){openShop(false);return;}
    if(k==='b'&&!e.repeat){openShop(!shopOpen);return;}
    if(shopOpen)return;
    heldKeys.add(k);
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    if(e.repeat)return;
    if(k==='e'||k===' ')requestAction();
    if(k==='f')mount();
  });
  window.addEventListener('keyup',e=>heldKeys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',clearMovement);
  window.addEventListener('pagehide',()=>{if(started)save();});

  function render(dt){
    const t=current(), riding=mounted(), vehicle=state.vehicle;
    const fill=state.bag/t.cap, time=action?.kind==='work'?clock-action.start:10;
    const dump=action?.kind==='dump'?Math.sin(Math.PI*clamp((clock-action.start)/action.end,0,1)):0;
    const work=action?.kind==='work'?Math.sin(Math.PI*clamp(time/action.end,0,1)):0;
    const height=surface.height(player.x,player.z);
    viewHeight=mix(viewHeight,height,Math.min(1,dt*8));
    const camera={...player,y:(riding?t.eye:1.58)+viewHeight+(riding?Math.sin(wheel)*.009:Math.sin(walk)*.018)};
    const world=surface.parts(player.x,player.z);
    if(vehicle){
      const ground=surface.height(vehicle.x,vehicle.z);
      const pose=worldPose(vehicle.x,ground,vehicle.z,vehicle.yaw);
      world.push(...M.machinery(state.tier,pose,{spin:wheel,work,dump,fill,blade,cab:!riding}));
    }
    if(t.mode==='barrow'){
      const [fx,fz]=facing(player.yaw);
      const x=player.x+fx*.65,z=player.z+fz*.65;
      const pose=worldPose(x,surface.height(x,z)*.65, z,player.yaw);
      world.push(...M.barrow(state.tier,pose,wheel,fill,dump));
    }
    if(!larry.hidden&&Rocks.larry&&close(player,larry,R.gl?24:13)){
      const clipAge=clock-larry.at;
      world.push(Rocks.larry.part(larry.clip,clipAge,worldPose(larry.x,0,larry.z,larry.yaw)));
    }
    const view=M.viewModel(state.tier,time,walk,fill,riding,dump,steering,blade);
    R.draw(world,view,camera);
  }
  function frame(now){
    const dt=lastFrame?Math.min(.065,(now-lastFrame)/1000):.016;
    lastFrame=now;
    if(started&&!shopOpen){
      clock+=dt;
      motion(dt);actions();updateLarry(dt);
    }
    surface.step(dt);
    if(started&&!shopOpen)context();
    if(R.gl||now-lastDraw>=45){
      render(dt);
      lastDraw=now;
    }
    requestAnimationFrame(frame);
  }
  updateUI();
  requestAnimationFrame(frame);
})();
