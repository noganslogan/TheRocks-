'use strict';

(() => {
  const $=s=>document.querySelector(s), R=Rocks.render, Y=Rocks.yard, M=Rocks.models, B=Rocks.backyard, C=Rocks.crew, F=Rocks.future, W=Rocks.wife;
  const {TOTAL,pile,truck,shed,delivery,chair,cells}=Y, {tools}=M;
  const {clamp,mix,TAU,worldPose}=R;
  const canvas=R.canvas;
  if(!R.available){
    $('#error').style.display='block';
    return;
  }
  const SAVE='the-rocks-v01', pad={x:truck.x,z:truck.z+2.75};
  const spawn={x:-.65,z:5.6,yaw:-.39,pitch:-.02};
  const fresh=()=>({version:7,...B.fresh(),phone:W.fresh(),tech:F.fresh(),crewDozer:null,handTier:0,intakeFocus:null,credits:0,removed:0,bag:0,tier:0,owned:[0],hits:{},rubble:{},depleted:Y.spread(0),vehicle:null});
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
    B.restore(s,raw);
    F.restore(s,raw);s.phone=W.restore(raw.phone);
    const t=tools[s.tier];
    const hand=raw.handTier;
    s.handTier=t.eye?(s.owned.includes(hand)&&!tools[hand]?.eye?hand:s.owned.filter(i=>!tools[i].eye).at(-1)):s.tier;
    if(s.factory>=2&&Number.isFinite(raw.intakeFocus?.x)&&Number.isFinite(raw.intakeFocus?.z)&&Math.hypot(raw.intakeFocus.x-B.intake.x,raw.intakeFocus.z-B.intake.z)<=B.intakeTether)
      s.intakeFocus={x:raw.intakeFocus.x,z:raw.intakeFocus.z};
    C.restore(s,raw);
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
    let pending=TOTAL-s.removed-s.bag-s.buffer-C.totalLoad(s);
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
  let hint='',actionText='',mountText='',shopTab='tools';
  const current=()=>tools[state.tier];
  const capacity=()=>B.capacity(state);
  const carrier=()=>B.carriers[state.carry];
  const mounted=()=>state.vehicle?.mounted===true;
  const close=(a,b,dist)=>Math.hypot(a.x-b.x,a.z-b.z)<dist;
  const facing=yaw=>[Math.sin(yaw),-Math.cos(yaw)];
  const nearShed=()=>!mounted()&&Math.abs(player.x-shed.x)<2.52&&player.z>shed.z-3.30&&player.z<shed.z+1.15;
  const nearTruck=()=>close(player,pad,mounted()?3.05:2.23);
  const nearVehicle=()=>state.vehicle&&close(player,state.vehicle,current().width*.65+1.34);
  const nearHopper=()=>state.factory>0&&close(player,B.hopper,mounted()?2.82:2.16);
  const nearCrewDozer=()=>state.crewDozer&&close(player,state.crewDozer,2.92);
  const unloadable=()=>state.bag&&(!current().eye||mounted());
  const directFeed=()=>!current().eye&&nearHopper();
  const room=()=>directFeed()?B.BUFFER_MAX-state.buffer:capacity()-state.bag;
  const yardLeft=()=>TOTAL-state.removed-state.bag-state.buffer-C.totalLoad(state);
  const phone=Rocks.phone({
    getState:()=>state,save,hired:hireBuddy,setJob:crewJob,upgrade:crewUpgrade,
    interrupt(){clearMovement();speed=0;}
  });
  const crew=C.create({getState:()=>state,surface,blocked:worldBlock,harvest:harvestAt,feed:feedBelt,deposit,pad,
    refresh(){updateUI();save();}});
  const tech=F.create({getState:()=>state,surface,left:yardLeft,harvest:harvestAt,feed:feedBelt,deposit,say,
    refresh(){updateUI();save();}});
  const firing=()=>!phone.visible()&&!shopOpen&&!nearShed()&&!(nearTruck()&&state.bag)
    &&(workPointer!==null||heldKeys.has('e')||heldKeys.has(' '));
  function save(){
    try{localStorage.setItem(SAVE,JSON.stringify(state));}catch{}
    lastSave=clock;
  }
  function say(text){
    $('#toast').textContent=text;
    $('#toast').classList.add('show');
    toastUntil=clock+1.95;
  }
  function factoryStatus(){
    if(!state.factory)return;
    const status=state.buffer>=B.BUFFER_MAX*.95?'BACKED UP':state.buffer?'RUNNING':'STARVED';
    const hud=$('#factoryStatus'), detail=status+' · '+num(state.buffer)+' in hopper';
    if(hud.textContent!==detail)hud.textContent=detail;
    hud.dataset.status=status;
  }
  function updateUI(){
    const t=current();
    $('#remaining').textContent=num(yardLeft());
    $('#credits').textContent=num(state.credits);
    $('#toolName').textContent=t.n;
    if(t.tech&&!state.bag){
      $('#bag').textContent=(F.rates[t.tech]/1_000_000)+'M / sec';
      $('#bagLabel').textContent={laser:'to the hopper',matter:'straight to credits',orbital:'within the marked section'}[t.tech];
    }else{
      $('#bag').textContent=`${num(state.bag)} / ${num(capacity())}`;
      $('#bagLabel').textContent=state.bag>=capacity()?'FULL · unload':t.mode==='dozer'?'ahead of blade':t.eye?'machine load':carrier().name;
    }
    $('#bar i').style.width=`${state.removed/TOTAL*100}%`;
    $('#factoryStatus').hidden=!state.factory;factoryStatus();
    const gantry=$('#gantryBtn'), drones=$('#droneBtn'), status=$('#techStatus');
    gantry.hidden=!state.tech.gantry;
    gantry.textContent='GANTRY · '+(state.tech.charges.gantry>0?F.modes[state.tech.mode].toUpperCase()+' · ':'')+F.label(state,'gantry');
    drones.hidden=!state.tech.drones;
    drones.textContent='DRONES · '+F.label(state,'drones');
    status.hidden=!F.hasTech(state);
    if(!status.hidden){
      const reserve=Math.floor(state.tech.reserve/100_000)/10;
      const charge=t.tech?' · '+F.label(state,t.tech):'';
      const pass=state.tech.mark&&t.tech!=='orbital'?' · ORBITAL '+F.label(state,'orbital'):'';
      const value='STREAK '+reserve+'M / 60M'+charge+pass;
      if(status.textContent!==value)status.textContent=value;
    }
    if(shopOpen)drawShop();
  }
  function shopRow(name, detail, description, label, index, disabled, buy){
    return `<div class="item"><div><b>${name}</b><small>${detail}</small><small>${description}</small></div><button type="button" data-tier="${index}" class="${buy&&!disabled?'buy':''}" ${disabled?'disabled':''}>${label}</button></div>`;
  }
  function drawShop(){
    $('#shopBalance').textContent=num(state.credits)+' rock credits';
    for(const button of $('#shopTabs').querySelectorAll?.('button')||[]){
      button.setAttribute('aria-pressed',String(button.dataset.shop===shopTab));
    }
    let rows;
    if(shopTab==='carry') {
      rows=B.carriers.map((c,i)=>{
        const own=state.carryOwned.includes(i), selected=state.carry===i;
        const disabled=selected||(!own&&(state.credits<c.cost||!state.carryOwned.includes(i-1)));
        return shopRow(c.name,num(c.cap)+' carry',c.detail,selected?'Equipped':own?'Equip':num(c.cost)+' rocks',i,disabled,!own);
      });
    }else if(shopTab==='training'){
      rows=B.training.map((u,i)=>{
        const level=state.training[i], cost=u.costs[level];
        const detail=i===1?`Level ${level} · larger grabs and scoops`:`Level ${level} · +${level*(i===0?19:15)}% speed`;
        return shopRow(u.name,detail,u.detail,cost?num(cost)+' rocks':'Maxed',i,!cost||state.credits<cost,true);
      });
    }else if(shopTab==='tech'){
      rows=F.upgrades.map((u,i)=>{
        const installed=u.tier?state.owned.includes(u.tier):state.tech[u.key];
        const selected=state.tier===u.tier;
        const disabled=selected||(installed&&!u.tier)||(!installed&&state.credits<u.cost);
        const label=selected?'Equipped':installed?(u.tier?'Equip':'Installed'):num(u.cost)+' rocks';
        const limit=F.limits[u.kind];
        const detail=u.detail+' · '+limit.seconds+'s per charge';
        const description=u.desc+' Recharge '+num(limit.recharge)+' hands-on rocks.';
        return shopRow(u.name,detail,description,label,i,disabled,!installed);
      });
    }else if(shopTab==='factory'){
      rows=B.factory.map((f,i)=>shopRow(f.name,'Outdoor equipment',f.detail,state.factory>i?'Installed':num(f.cost)+' rocks',i,
        state.factory!==i||state.credits<f.cost,true));
    }else{
      rows=B.toolIds.map(i=>{
        const t=tools[i], own=state.owned.includes(i), selected=state.tier===i;
        const delegated=i===C.DOZER&&state.crewDozer;
        const disabled=selected||delegated||(!own&&(state.credits<t.cost||!state.owned.includes(B.prevTool(i))));
        const count=B.rate(state,t), rate=t.hold||t.mode==='dozer'?num(Math.round(count/t.cycle))+'/sec':num(count)+'/action';
        const detail=t.eye?num(t.cap)+' capacity · '+rate:rate+' · carry sold separately';
        return shopRow(t.n,detail,t.desc,delegated?'With crew':selected?'Equipped':own?'Equip':num(t.cost)+' rocks',i,disabled,!own);
      });
    }
    $('#items').innerHTML=rows.join('');
  }
  function clearMovement(){
    heldKeys.clear();
    stick.pointer=null;stick.x=stick.y=0;
    workPointer=null;look=null;
    $('#knob').style.transform='';
  }
  function openShop(open){
    if(open&&(!started||phone.visible()||!nearShed())){
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
    if(!t||!B.toolIds.includes(i)||state.tier===i||!shopOpen||!nearShed()||action)return;
    if(i===C.DOZER&&state.crewDozer){
      say('Your crew has the bulldozer. Use Take over beside it.');
      return;
    }
    if(state.bag&&(current().eye||t.eye)){
      say('Unload the current equipment before switching.');
      return;
    }
    if(!own){
      if(state.credits<t.cost||!state.owned.includes(B.prevTool(i)))return;
      state.credits-=t.cost;
      state.owned.push(i);
    }
    state.tier=i;
    if(!t.eye)state.handTier=i;
    state.vehicle=t.eye?{...delivery,mounted:false}:null;
    speed=steering=wheel=0;blade=false;
    openShop(false);
    updateUI();save();
    say(t.eye?t.n+' delivered on the pad outside.':'Picked up '+t.n+' from the shed.');
  }
  function buyTech(i){
    const u=F.upgrades[i];
    if(!u)return;
    const installed=u.tier?state.owned.includes(u.tier):state.tech[u.key];
    if(installed&&(!u.tier||state.tier===u.tier))return;
    if(u.tier&&current().eye&&state.bag){say('Unload your machine before switching equipment.');return;}
    if(!installed){
      if(state.credits<u.cost)return;
      state.credits-=u.cost;
      if(u.tier)state.owned.push(u.tier);
      else state.tech[u.key]=true;
      state.tech.charges[u.kind]=-1;
    }
    if(u.tier===F.LASER&&!state.factory)state.factory=1;
    if(u.tier){
      state.tier=state.handTier=u.tier;state.vehicle=null;
      speed=steering=wheel=0;blade=false;
    }
    openShop(false);
    updateUI();save();
    const help=u.tier===F.LASER?' · high-speed belt installed':u.tier===F.ORBITAL&&!state.tech.permit?' · get Larry’s permit':'';
    say(u.name+(u.tier?' equipped':' installed')+help+'.');
  }
  function buyShop(i){
    if(shopTab==='tools'){equip(i);return;}
    if(!shopOpen||!nearShed()||action)return;
    if(shopTab==='tech'){buyTech(i);return;}
    if(shopTab==='carry'){
      const c=B.carriers[i], own=state.carryOwned.includes(i);
      if(!c||state.carry===i)return;
      if(!current().eye&&state.bag>c.cap){say('Unload before switching to a smaller carrier.');return;}
      if(!own){
        if(state.credits<c.cost||!state.carryOwned.includes(i-1))return;
        state.credits-=c.cost;state.carryOwned.push(i);
      }
      state.carry=i;openShop(false);
      say(c.name+' equipped.');
    }else if(shopTab==='training'){
      const cost=B.training[i]?.costs[state.training[i]];
      if(!cost||state.credits<cost)return;
      state.credits-=cost;state.training[i]++;
    }else if(shopTab==='factory'){
      const f=B.factory[i];
      if(!f||state.factory!==i||state.credits<f.cost)return;
      state.credits-=f.cost;state.factory++;
      openShop(false);say(f.name+' installed on the far side of the yard.');
    }
    updateUI();save();
  }
  function hireBuddy(i){
    const buddy=B.buddies[i];
    if(!buddy||i!==state.buddies.length||state.credits<buddy.cost)return false;
    state.credits-=buddy.cost;
    state.buddies.push(C.newHire(i));
    W.record(state.phone,'log',buddy.name+' is on the way.');
    save();updateUI();
    return true;
  }
  function crewUpgrade(i,key){
    const buddy=state.buddies[i];
    if(!buddy)return false;
    const price=C.price(buddy,i,key);
    if(!price||price>state.credits)return false;
    state.credits-=price;buddy[key]++;
    updateUI();save();
    return true;
  }
  function crewJob(i,job){
    const buddy=state.buddies[i], d=state.crewDozer;
    if(!buddy)return false;
    if(d?.driver===i){
      if(job==='park'&&d.phase!=='parked')d.reclaim=true;
      else if(job==='resume'&&d.phase==='parked'){d.phase='board';d.age=0;d.reclaim=false;}
      else return false;
    }else if(job==='dozer'){
      if(!state.owned.includes(C.DOZER)||buddy.training!==3||d)return false;
      for(const b of state.buddies)if(b.job==='dozer')b.job='haul';
      buddy.job=job;
    }else if(job==='rest'||job==='haul'){
      buddy.job=job;
    }else return false;
    save();
    return true;
  }
  function worldBlock(x,z,vehicle=false,tool=current()){
    const radius=vehicle?tool.width*.46:.24;
    if(x<-14.12+radius||x>14.12-radius||z<-11.64+radius||z>7.83-radius)return true;
    if(Math.abs(x-truck.x)<1.02+radius&&Math.abs(z-truck.z)<2.10+radius)return true;
    if(Math.abs(x-chair.x)<.37+radius&&Math.abs(z-chair.z)<.34+radius)return true;
    if(Math.hypot(x+12.2,z+9.4)<.22+radius)return true;
    const dx=x-shed.x,dz=z-shed.z;
    if(Math.abs(dx)<2.07+radius&&Math.abs(dz)<1.69+radius){
      if(vehicle||dz>1.0||Math.abs(dx)>.99)return true;
    }
    if(B.blocksFactory(x,z,radius,state.factory))return true;
    const height=surface.height(x,z);
    return height>(vehicle?(.80+tool.width*.14):.51);
  }
  function crewDriver(){return state.buddies.findIndex(b=>b.job==='dozer'&&b.training===3);}
  function takeOver(){
    const d=state.crewDozer;
    if(d.phase!=='parked'){
      d.reclaim=true;save();
      say(B.buddies[d.driver].name+' is parking the bulldozer.');
      return;
    }
    if(state.bag){say('Unload your current rocks before taking over.');return;}
    state.tier=C.DOZER;
    state.vehicle={x:d.x,z:d.z,yaw:d.yaw,mounted:true};
    state.bag=d.load;
    state.crewDozer=null;
    startDriving(state.vehicle);
    say('You have the bulldozer. Exit to hand it back to '+B.buddies[d.driver].name+'.');
  }
  function startDriving(v){
    v.mounted=true;
    player.x=v.x;player.z=v.z;player.yaw=v.yaw;player.pitch=-.17;
    speed=steering=wheel=0;blade=false;
  }
  function mount(){
    const v=state.vehicle;
    if(!started||shopOpen||phone.visible()||action)return;
    if(!mounted()&&nearCrewDozer()){
      takeOver();clearMovement();updateUI();save();return;
    }
    if(!v)return;
    if(v.mounted){
      const t=current(), lateral=[Math.cos(v.yaw),Math.sin(v.yaw)], front=facing(v.yaw);
      const d=t.width*.56+.72;
      const clear=[[0,1],[0,-1],[-1,0],[1,0]].find(([f,l])=>
        !worldBlock(v.x+(front[0]*f+lateral[0]*l)*d,v.z+(front[1]*f+lateral[1]*l)*d));
      if(!clear){say('Move somewhere with room to step out.');return;}
      const [f,l]=clear;
      player.x=v.x+(front[0]*f+lateral[0]*l)*d;player.z=v.z+(front[1]*f+lateral[1]*l)*d;
      v.mounted=false;
      blade=false;
      speed=0;
      const driver=state.tier===C.DOZER?crewDriver():-1;
      if(driver>=0){
        state.crewDozer={driver,x:v.x,z:v.z,yaw:v.yaw,phase:'board',load:state.bag,wait:0,age:0,reclaim:false,spin:wheel,seated:false};
        state.vehicle=null;
        state.bag=0;
        state.tier=state.handTier;
        say(B.buddies[driver].name+' is taking over. '+current().n+' ready.');
      }else say(t.n+' parked.');
    }else if(nearVehicle()){
      startDriving(v);
      say(current().mode==='dozer'?'Lower the blade and drive into the pile.':'Drive to the pile to load.');
    }else{
      say('Walk up to the delivered machine.');
      return;
    }
    clearMovement();updateUI();save();
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
      const rig=!t.eye&&(!t.tech||state.bag)&&carrier().rig, factor=rig?(state.bag>=capacity()?.87:.96):1;
      const distance=dt*4.65*factor*(1+state.training[2]*.15);
      const dx=sx*Math.cos(player.yaw)-sy*Math.sin(player.yaw),dz=sx*Math.sin(player.yaw)+sy*Math.cos(player.yaw);
      const nx=player.x+dx*distance,nz=player.z+dz*distance;
      const oldX=player.x,oldZ=player.z;
      const clearance=(x,z)=>!rig||!worldBlock(x+Math.sin(player.yaw)*.64,z-Math.cos(player.yaw)*.64);
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
    const pace=B.speed(state,t);
    action={kind:'work',start:clock,at:t.impact/pace,end:t.cycle/pace,target,done:false};
  }
  function requestAction(){
    if(!started||shopOpen||phone.visible()||action)return;
    const t=current();
    if(t.eye&&!mounted()){
      if(nearShed())openShop(true);
      else mount();
      return;
    }
    if(state.bag&&nearTruck()){
      const cycle=t.eye?.88:carrier().rig?.60:.39;
      action={kind:'dump',start:clock,end:cycle,at:cycle*.59,done:false};
      return;
    }
    if(nearShed()){openShop(true);return;}
    if(!yardLeft()){say(state.bag?'Bring the last load to the truck.':state.removed<TOTAL?'The last rocks are on their way to the truck.':'Done. Larry thinks you missed one.');return;}
    if(t.tech){useTech(t.tech);return;}
    if(t.mode==='dozer'){
      blade=!blade;
      say(blade?'Blade down. Drive forward into the gravel.':'Blade raised.');
      return;
    }
    if(!room()){say(directFeed()?'The hopper is backed up.':'Full. Bring the load to the truck.');return;}
    const target=mounted()?machineTarget():handTarget();
    if(!target){say(t.eye?'Bring the front of the machine to the gravel.':'Move closer to the rock mountain.');return;}
    if(target.rock&&!state.rubble[target.rock.id]&&(!t.power||target.rock.type===2&&!t.boulder)){
      if(t.mode==='cart'||t.mode==='vac'){
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
    const space=room();
    if(!space)return;
    let n=0;
    if(rock&&state.rubble[rock.id]){
      n=Math.min(space,B.rate(state,t),state.rubble[rock.id]);
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
        if(!directFeed()&&!t.eye&&(t.mode==='hammer'||t.mode==='jack')){
          say('Rock broken. Collect the rubble.');
          save();
          return;
        }
        n=Math.min(space,B.rate(state,t),loose);
        if(n===loose)delete state.rubble[rock.id];
        else state.rubble[rock.id]-=n;
      }
    }
    // Heavy equipment sweeps the surrounding gravel even when it catches a boulder.
    if(!n||t.eye)n+=surface.excavate(x,z,Math.min(space-n,B.rate(state,t)),t.eye?(t.mode==='dozer'?1.65:t.mode==='excavator'?1.22:.90):.70);
    if(!n){if(!t.hold&&t.mode!=='dozer')say('That patch is clear. Move along the pile.');return;}
    if(directFeed())feedBelt(n,true);
    else state.bag+=n;
    const direction=facing(mounted()?state.vehicle.yaw:player.yaw).map(v=>v*(t.mode==='dozer'?1:-1));
    surface.puff(x,z,n,direction);
    if(state.bag>=capacity())say('Full. Take the load to the truck.');
    else if(!t.hold&&t.mode!=='dozer')say('+'+num(n)+(n===1?' rock':' rocks'));
    updateUI();save();
  }
  function deposit(n,manual=0){
    const before=state.removed;
    state.credits+=n;
    state.removed+=n;
    F.earn(state,manual);
    if((before<70&&state.removed>=70)||(before<220&&state.removed>=220))surface.changed();
  }
  function feedBelt(amount,manual=false){
    if(!state.factory)return 0;
    const n=Math.min(amount,B.BUFFER_MAX-state.buffer);
    state.buffer+=n;
    if(manual)state.tech.manualQueued+=n;
    return n;
  }
  function finishDump(){
    if(!state.bag||!nearTruck())return;
    const n=state.bag;
    state.bag=0;
    deposit(n,n);
    if(current().mode==='dozer')blade=false;
    surface.puff(pad.x,pad.z,Math.min(n,32));
    say(state.removed===TOTAL?'Done. Larry thinks you missed one.':'+'+num(n)+' rock credits');
    updateUI();save();
  }
  function harvestAt(x,z,amount,radius,crush){
    let remaining=Math.min(amount,yardLeft()), collected=0;
    if(remaining<=0)return 0;
    if(crush){
      for(const rock of surface.geology){
        if(!state.rubble[rock.id]||Math.hypot(rock.x-x,rock.z-z)>radius)continue;
        const n=Math.min(remaining,state.rubble[rock.id]);
        remaining-=n;collected+=n;state.rubble[rock.id]-=n;
        if(!state.rubble[rock.id])delete state.rubble[rock.id];
        surface.changed();
        if(!remaining)break;
      }
    }
    return collected+surface.excavate(x,z,remaining,radius);
  }
  function moveIntake(){
    if(!started||state.factory<2||mounted()||shopOpen||phone.visible())return;
    const target=handTarget();
    if(!target){say('Aim at a reachable patch of gravel.');return;}
    const {x,z}=target;
    if(!close(target,B.intake,B.intakeTether)){say('The suction hose cannot reach this patch.');return;}
    state.intakeFocus={x,z};
    say('Powered collector moved to this patch.');
    save();
  }
  function useTech(mode){
    if(mode==='orbital'&&!state.tech.permit){
      if(larry.hidden||!close(player,larry,3.2)){say('Find Larry and ask him to sign the permit.');return;}
      state.tech.permit=true;
      $('#dialogue span').textContent='“Does that run off my electric?”';
      $('#dialogue').hidden=false;
      dialogueUntil=clock+4.4;
      say('Permit signed. Aim at the pile and mark a section.');
      updateUI();save();
      return;
    }
    const target=tech.aim(player,mode==='orbital'?36:29);
    if(!target){say('Aim at a patch of rock.');return;}
    if(mode==='orbital'){
      if(!armStreak('orbital'))return;
      state.tech.mark={x:target.x,z:target.z};
      say('Section marked. Orbital pass underway.');
      updateUI();save();
    }else if(state.tech.charges[mode]===0&&state.tech.reserve<F.limits[mode].recharge){
      say('Recharge needs '+num(F.limits[mode].recharge)+' hands-on rocks.');
    }
  }
  function armStreak(kind){
    if(F.activate(state,kind))return true;
    say('Recharge needs '+num(F.limits[kind].recharge)+' hands-on rocks.');
    return false;
  }
  function toggleGantry(){
    if(!started||!state.tech.gantry||shopOpen||phone.visible())return;
    if(state.tech.charges.gantry>0){
      state.tech.mode=(state.tech.mode+1)%F.modes.length;
    }else{
      if(!armStreak('gantry'))return;
      if(state.tech.mode===2)state.tech.mode=0;
    }
    say('Gantry · '+F.modes[state.tech.mode]+' · '+F.label(state,'gantry'));
    updateUI();save();
  }
  function launchDrones(){
    if(!started||!state.tech.drones||shopOpen||phone.visible()||state.tech.charges.drones>0)return;
    if(!armStreak('drones'))return;
    say('Sweep drones deployed for 40 seconds.');
    updateUI();save();
  }
  function workYard(dt){
    crew.tick(dt);
    if(!state.factory)return;
    let changed=false;
    if(nearHopper()&&unloadable()){
      const sent=feedBelt(state.bag,true);
      if(sent){
        state.bag-=sent;changed=true;
        surface.puff(B.hopper.x,B.hopper.z,Math.min(sent,12));
      }
    }
    state.factoryTick+=dt;
    if(state.factoryTick>=4){
      state.factoryTick-=4;
      const boosted=state.factory===3;
      const output=Math.min(state.buffer,state.owned.includes(F.LASER)?F.beltBatch:boosted?3_600_000:1_200_000);
      if(output){
        const manual=Math.min(output,state.tech.manualQueued);
        state.tech.manualQueued-=manual;
        state.buffer-=output;deposit(output,manual);changed=true;
      }
      if(state.factory>=2){
        const focus=state.intakeFocus||B.defaultPickup;
        const target=surface.nearest(focus.x,focus.z,B.pickupRadius)||(boosted&&
          surface.geology.find(r=>state.rubble[r.id]&&close(r,focus,B.pickupRadius)));
        if(target){
          const n=harvestAt(target.x,target.z,Math.min(B.BUFFER_MAX-state.buffer,boosted?3_300_000:700_000),1.60,boosted);
          state.buffer+=n;changed=changed||n>0;
          if(n)surface.puff(target.x,target.z,n,[1,0]);
        }
      }
    }
    if(changed){updateUI();save();}
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
    if(!action&&!phone.visible()&&!current().tech&&current().hold&&(workPointer!==null||heldKeys.has('e')||heldKeys.has(' '))&&!(nearTruck()&&state.bag)){
      if((!current().eye&&room()>0&&handTarget())||(mounted()&&state.bag<capacity()&&machineTarget()))requestAction();
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
    if(state.removed===TOTAL){h='The yard is clear.';a='DONE';}
    else if(!yardLeft()&&!state.bag&&(state.buffer||C.totalLoad(state))){h='The last loads are headed to the truck';a='WAIT';}
    else if(nearTruck()&&state.bag&&(!vehicle||riding)){h='Unload into the truck';a='UNLOAD';}
    else if(nearShed()){h='Tool shed · buy or swap equipment';a='TOOLS';}
    else if(vehicle&&!riding){h=nearVehicle()?'Enter '+t.n:'Find your machine on the delivery pad or where you parked it';a='ENTER';}
    else if(t.tech){
      if(t.tech==='orbital'){
        h=state.tech.permit?(state.tech.mark?'Orbital pass is active':'Aim at the section you want cleared'):'Find Larry for the orbital permit';
        a=state.tech.permit?'MARK AREA':'ASK LARRY';
      }else if(t.tech==='laser'){
        h=state.buffer>=B.BUFFER_MAX?'Hopper backed up · keep holding to resume':'Aim and hold · cut rock straight into the hopper';
        a='CUT';
      }else{h='Aim and hold · vaporized rocks become credits';a='VAPORIZE';}
    }
    else if(!directFeed()&&state.bag>=capacity()){h='Load full · head to the truck';a=t.mode==='dozer'?(blade?'RAISE':'LOWER BLADE'):'FULL';}
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
    if(!t.tech&&directFeed()&&handTarget()){
      h=room()?'Hopper in reach · rocks feed automatically':'Hopper backed up · keep holding to resume';
      if(t.mode==='jack')a='DRILL';
    }
    if(riding)b=state.tier===C.DOZER&&crewDriver()>=0?'HAND OFF':'EXIT';
    else if(nearCrewDozer())b=state.crewDozer.phase==='parked'?'TAKE OVER':'PARK DOZER';
    else if(vehicle&&nearVehicle()&&a!=='ENTER')b='ENTER';
    $('#intakeBtn').hidden=state.factory<2||riding||!close(player,B.intake,B.intakeTether);
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
  $('#items').onclick=e=>{const button=e.target.closest('button[data-tier]');if(button)buyShop(+button.dataset.tier);};
  $('#shopTabs').onclick=e=>{
    const button=e.target.closest('button[data-shop]');
    if(!button)return;
    shopTab=button.dataset.shop;$('#items').scrollTop=0;drawShop();
  };
  $('#mount').onclick=mount;
  $('#intakeBtn').onclick=moveIntake;
  $('#gantryBtn').onclick=toggleGantry;
  $('#droneBtn').onclick=launchDrones;
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
    started=true;$('#intro').style.display='none';phone.arm();
    if(state.phone.ring)phone.open();
    if(state.vehicle&&!mounted())say('Your machine is where you parked it or on the delivery pad.');
  };
  $('#reset').onclick=()=>{
    if(!confirm('Start over? All progress will be lost.'))return;
    state=fresh();tech.clear();player={...spawn};shopTab='tools';phone.refresh();
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
    if(stick.pointer!==null||!started||shopOpen||phone.visible())return;
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
    if(!started||shopOpen||phone.visible()||look)return;
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
    if(k==='escape'){if(phone.visible())phone.close();else openShop(false);return;}
    if(k==='p'&&!e.repeat&&!shopOpen){$('#phoneToggle').onclick();return;}
    if(phone.visible())return;
    if(k==='b'&&!e.repeat){openShop(!shopOpen);return;}
    if(shopOpen)return;
    heldKeys.add(k);
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    if(e.repeat)return;
    if(k==='e'||k===' ')requestAction();
    if(k==='f')mount();
    if(k==='c')moveIntake();
    if(k==='g')toggleGantry();
    if(k==='v')launchDrones();
  });
  window.addEventListener('keyup',e=>heldKeys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',clearMovement);
  window.addEventListener('pagehide',()=>{if(started)save();});

  function render(dt){
    const t=current(), riding=mounted(), vehicle=state.vehicle;
    const fill=state.bag/capacity(), time=action?.kind==='work'?(clock-action.start)*B.speed(state,t):10;
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
    const rig=!t.eye&&(!t.tech||state.bag)&&carrier().rig;
    if(rig){
      const [fx,fz]=facing(player.yaw);
      const offset=rig==='bin'?1:.65;
      const x=player.x+fx*offset,z=player.z+fz*offset;
      const pose=worldPose(x,surface.height(x,z)*.65, z,player.yaw);
      world.push(...(rig==='bin'?M.trashBin(pose,wheel,fill,dump):M.barrow(rig,pose,wheel,fill,dump)));
    }
    if(!larry.hidden&&Rocks.larry&&close(player,larry,R.gl?24:13)){
      const clipAge=clock-larry.at;
      world.push(Rocks.larry.part(larry.clip,clipAge,worldPose(larry.x,0,larry.z,larry.yaw)));
    }
    world.push(...B.factoryParts(state,surface,state.owned.includes(F.LASER)),...crew.parts(player),...tech.parts(camera));
    const pushing=rig&&action?.kind!=='work';
    const view=t.tech?F.viewModel(t.tech,walk,firing()):M.viewModel(pushing?(rig==='bin'?7:rig):state.tier,time,walk,fill,riding,dump,steering,blade);
    if(!t.eye&&(!t.tech||state.bag)&&state.carry===2&&action?.kind!=='work')view.push(...M.carryBucket(fill,dump,walk));
    R.draw(world,view,camera);
  }
  function advanceGame(dt){
    clock+=dt;
    if(!phone.visible())motion(dt);
    actions();updateLarry(dt);workYard(dt);tech.tick(dt,player,current().tech,firing());phone.tick(dt);
    if(clock-lastSave>=25)save();
  }
  function frame(now){
    const dt=lastFrame?Math.min(.065,(now-lastFrame)/1000):.016;
    lastFrame=now;
    if(started&&!shopOpen)advanceGame(dt);
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
