// Run with Node from any directory. Exercise the shipped scripts with a controlled clock and stub DOM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function start({saved=null,software=true,instanced=false}={}){
  let writes=0, snapshot=saved, nextFrame, ms=0, drawing=0;
  const nodes=new Map(), listeners=new Map(), controls=new Map();
  let batches=0;
  const context={
    fillRect(){drawing++;},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){drawing++;},stroke(){}
  };
  const extension={vertexAttribDivisorANGLE(){},drawArraysInstancedANGLE(mode,first,count,instances){
    assert.ok(count>0&&instances>0);batches++;
  }};
  const graphics=new Proxy({getExtension:()=>instanced?extension:null, getShaderParameter:()=>true,getProgramParameter:()=>true}, {
    get:(obj,key)=>obj[key]||(()=>{if(key==='drawArrays')drawing++;return key;})
  });
  function node(selector){
    if(nodes.has(selector))return nodes.get(selector);
    const n={
      textContent:'',style:{},dataset:{},hidden:false,children:[],classList:{add(){},remove(){},toggle(){}},
      setAttribute(){},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},
      clientWidth:844,clientHeight:390,scrollHeight:500,scrollTop:0,
      getBoundingClientRect:()=>({left:14,top:290,width:80,height:80}),
      getContext:(kind)=>kind==='2d'?context:software?null:graphics,
      querySelector:()=>null,
      setPointerCapture(){},
      addEventListener(event,fn){controls.set(selector+' '+event,fn);}
    };
    nodes.set(selector,n);
    return n;
  }
  const env={URLSearchParams,devicePixelRatio:3,location:{search:''},atob,console,performance,
    requestAnimationFrame(fn){nextFrame=fn;},
    window:{addEventListener(event,fn){listeners.set(event,fn);}},
    confirm:()=>true,
    document:{querySelector:node,createElement(){return {...node('element'),children:[]};}},
    localStorage:{getItem:()=>snapshot,setItem(key,value){snapshot=value;writes++;}}
  };
  vm.createContext(env);
  for(const file of ['render','models','larry-data','crew-data','larry-rig','yard','backyard','crew','wife','phone','future','game']){
    let code=fs.readFileSync(path.join(root,'js',file+'.js'),'utf8');
    if(file==='game'){
      const marker='  updateUI();\n  requestAnimationFrame(frame);';
      assert.ok(code.includes(marker));
      code=code.replace(marker,`
        window.harness={surface,larry,heldKeys,openShop,equip,mount,requestAction,capacity,phone,crew,tech,crewJob,crewUpgrade,
          get player(){return player;},get state(){return state;},get action(){return action;},
          get clock(){return clock;},get blade(){return blade;},get tools(){return tools;},
          inside:()=>shopOpen,current,handTarget,machineTarget,nearTruck,worldBlock,migration,render,
          advance(dt){advanceGame(dt);context();surface.step(dt);}};
      `+marker);
    }
    vm.runInContext(code,env,{filename:file+'.js'});
  }
  const game=env.window.harness;
  assert.ok(game);
  function event(selector,name,properties={}){
    const handler=controls.get(selector+' '+name)||node(selector)['on'+name];
    assert.equal(typeof handler,'function',selector+' '+name);
    handler({detail:0,pointerId:1,clientX:54,clientY:330,preventDefault(){},currentTarget:node(selector),...properties});
  }
  function key(type,k){listeners.get(type)({key:k,repeat:false,preventDefault(){}});}
  const steps=(n,dt=.055)=>{for(let i=0;i<n;i++)game.advance(dt);};
  const frame=()=>nextFrame(ms+=50);
  event('#start','click');
  return {game,node,event,key,steps,frame,env,snapshot:()=>snapshot,writes:()=>writes,drawing:()=>drawing,batches:()=>batches,pagehide:()=>listeners.get('pagehide')()};
}

const test = (name,fn) => {fn();console.log('PASS',name);};
const total=1_000_000_000;
const pad={x:10.8,z:-2.55};
const shed={x:10.3,z:2.6};
const entry={x:6.2,z:4.2};
function setPlayer(g,x,z,yaw=0,pitch=-.18){
  Object.assign(g.player,{x,z,yaw,pitch});
  if(g.state.vehicle?.mounted)Object.assign(g.state.vehicle,{x,z,yaw});
}
function evidence(g){
  const s=g.state;
  assert.equal(s.depleted.reduce((a,b)=>a+b,0),s.removed+s.bag+s.buffer+s.buddies.reduce((a,b)=>a+b.load,0)+(s.crewDozer?.load||0)+Object.values(s.rubble).reduce((a,b)=>a+b,0));
  assert.ok(s.credits>=0&&s.credits<=s.removed);
  assert.ok(s.tech.manualQueued>=0&&s.tech.manualQueued<=s.buffer);
  assert.ok(s.tech.reserve>=0&&s.tech.reserve<=60_000_000);
  assert.ok(s.bag<=g.capacity());
  assert.ok(s.removed+s.bag+s.buffer<=total);
}

test('first three rocks, purchase and touch interaction',()=>{
  const h=start(),g=h.game;
  h.frame();
  assert.ok(h.drawing()>3000);
  assert.equal(h.node('#remaining').textContent,'1,000,000,000');
  const before=g.player.z;
  h.event('#stick','pointerdown',{clientY:301});
  h.event('#game','pointerdown',{pointerId:2,clientX:440,clientY:160});
  h.event('#game','pointermove',{pointerId:2,clientX:460,clientY:170});
  assert.ok(g.player.yaw>-.39&&g.player.pitch<-.02);
  h.steps(9);
  h.event('#stick','pointercancel');
  h.event('#game','lostpointercapture',{pointerId:2});
  assert.ok(g.player.z<before-1);
  const stopped=g.player.z;
  h.steps(3);
  assert.equal(g.player.z,stopped);
  for(let i=1;i<=3;i++){
    setPlayer(g,-1,3.6);
    h.event('#act','click');
    h.steps(9);
    assert.equal(g.state.bag,1);
    setPlayer(g,pad.x,pad.z);
    h.key('keydown','e');h.key('keyup','e');
    h.steps(10);
    assert.equal(g.state.credits,i);
    evidence(g);
  }
  setPlayer(g,shed.x,shed.z);
  h.event('#shopBtn','click');
  assert.ok(g.inside());
  h.event('#items','click',{target:{closest:()=>({dataset:{tier:'1'}})}});
  assert.equal(g.state.tier,1);
  assert.equal(g.state.credits,0);
  assert.equal(g.state.owned.join(','),'0,1');
  assert.ok(h.writes()>=7);
  const again=start({saved:h.snapshot()});
  assert.equal(again.game.state.removed,3);
  assert.equal(again.game.state.tier,1);
});

test('old saves on both renderers, damaged save repair and carry-safe swap',()=>{
  const old=(key)=>({removed:440,credits:61,bag:44,tier:3,owned:[0,1,2,3],hits:{[key]:4}});
  for(const key of ['v2:4828','v2:1078']){
    const h=start({saved:JSON.stringify(old(key))}),g=h.game;
    assert.deepEqual(JSON.parse(JSON.stringify(g.state.hits)),{'stone-28':4});
    assert.equal(g.state.bag,44);
    assert.equal(g.state.credits,61);
    evidence(g);
    setPlayer(g,shed.x,shed.z);
    g.openShop(true);
    h.event('#shopTabs','click',{target:{closest:()=>({dataset:{shop:'carry'}})}});
    h.event('#items','click',{target:{closest:()=>({dataset:{tier:'1'}})}});
    assert.equal(g.state.carry,3);
    g.equip(1);
    assert.equal(g.state.tier,1,'tools can swap under a loaded backpack');
    setPlayer(g,pad.x,pad.z);
    g.openShop(false);g.requestAction();h.steps(11);
    assert.equal(g.state.removed,484);assert.equal(g.state.credits,105);
  }
  const repaired=start({saved:JSON.stringify({version:3,removed:75,credits:800,bag:0,owned:[0],hits:{},depleted:[-1]})});
  assert.equal(repaired.game.state.credits,75);
  evidence(repaired.game);
});

test('full progression from a fresh save through all tools and carriers by purchasing',()=>{
  const h=start(),g=h.game;
  g.state.phone.nextText=g.state.phone.nextCall=1e9;
  const B=vm.runInContext('Rocks.backyard',h.env);
  const shop=(tab,i)=>{
    setPlayer(g,shed.x,shed.z);
    g.openShop(true);assert.ok(g.inside());
    h.event('#shopTabs','click',{target:{closest:()=>({dataset:{shop:tab}})}});
    h.event('#items','click',{target:{closest:()=>({dataset:{tier:String(i)}})}});
  };
  const cycleTrip=(at)=>{
    const t=g.current();
    if(t.eye){
      setPlayer(g,at.x,at.z,at.yaw);
      if(t.mode==='dozer'){
        if(!g.blade)g.requestAction();
        h.key('keydown','w');h.steps(36);h.key('keyup','w');h.steps(5);
      }else{
        for(let i=0;i<8&&g.state.bag<g.capacity();i++){
          assert.ok(g.machineTarget(),t.n+' has reachable gravel');
          g.requestAction();h.steps(Math.ceil(t.cycle/.055)+2);
        }
      }
    }else{
      setPlayer(g,0,1.7,-.63,.12);
      if(t.hold){
        h.key('keydown','e');h.steps(44);h.key('keyup','e');h.steps(10);
      }else for(let i=0;i<9&&g.state.bag<g.capacity();i++){
        g.requestAction();h.steps(Math.ceil(t.cycle/.055)+2);
      }
    }
    assert.ok(g.state.bag,t.n+' collected');
    evidence(g);
    const moves=g.state.bag, delivered=g.state.removed, credit=g.state.credits;
    setPlayer(g,pad.x,pad.z);
    g.requestAction();h.steps(19);
    assert.equal(g.state.bag,0,t.n+' unloaded');
    assert.equal(g.state.removed,delivered+moves);
    assert.equal(g.state.credits,credit+moves);
    g.requestAction();h.steps(23);
    assert.equal(g.state.credits,credit+moves,t.n+' prevented double deposit');
    return moves;
  };
  const trips=[], point={x:3.55,z:-1.2,yaw:-1.61};
  const carrierAt={0:1,1:2,2:3,4:4,6:5,9:6};
  for(const [step,i] of B.toolIds.entries()){
    const t=g.current(), nextId=B.toolIds[step+1], next=g.tools[nextId];
    assert.equal(g.state.tier,i);
    if(t.eye){
      setPlayer(g,entry.x+.65,entry.z+.70);
      g.mount();assert.equal(g.state.vehicle.mounted,true);
      const start=g.player.x;
      h.key('keydown','w');h.steps(5);h.key('keyup','w');
      assert.notEqual(g.player.x,start,t.n+' drives');
      const yaw=g.state.vehicle.yaw;
      h.key('keydown','d');h.steps(6);h.key('keyup','d');
      assert.notEqual(g.state.vehicle.yaw,yaw,t.n+' steers');
    }
    let count=0;
    const earn=(cost)=>{
      do{
        cycleTrip(point);
        assert.ok(++count<=25,t.n+' reaches next upgrade within 25 trips');
      }while(g.state.credits<cost);
    };
    if(carrierAt[i]){
      const id=carrierAt[i];
      earn(B.carriers[id].cost);
      shop('carry',id);
      assert.equal(g.state.carry,id);
    }
    earn(next?.cost||1);
    trips.push(count);
    if(!next)break;
    if(t.eye){g.mount();assert.equal(g.state.vehicle.mounted,false);}
    if(i===0){shop('tools',2);assert.equal(g.state.tier,0,'upgrade prerequisites enforced');}
    const credits=g.state.credits;
    shop('tools',nextId);
    assert.equal(g.state.credits,credits-next.cost);
    if(next.eye)assert.equal(g.state.vehicle.x,entry.x);
    evidence(g);
  }
  console.log('  Trips per tool with carries:',trips.join(', '));
  assert.equal(g.state.owned.length,14);
  assert.equal(g.state.carryOwned.length,7);
  h.pagehide();
  const restored=start({saved:h.snapshot()});
  assert.equal(restored.game.state.tier,15);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.game.state)),JSON.parse(JSON.stringify(g.state)));
});

test('boulder fracture creates accounted rubble, which saves and stays collectible',()=>{
  const old={removed:12000,credits:0,tier:8,owned:Array.from({length:9},(_,i)=>i),carry:5,carryOwned:[0,1,2,3,4,5]};
  let h=start({saved:JSON.stringify(old)}),g=h.game;
  const r=g.surface.geology[27];
  const v=Math.atan2((r.x+4.4)/7.25,(r.z+2.4)/6.05), outward=[Math.sin(v),Math.cos(v)];
  const player={x:r.x+outward[0]*1.35,z:r.z+outward[1]*1.35};
  const y=g.surface.height(r.x,r.z)+r.size*.58-1.58;
  setPlayer(g,player.x,player.z,Math.atan2(-outward[0],outward[1]),Math.atan2(y,1.35));
  assert.equal(g.handTarget().rock.id,r.id);
  g.requestAction();h.steps(15);evidence(g);
  assert.equal(g.state.hits[r.id],4);
  assert.equal(g.state.bag,0);
  assert.ok(g.state.rubble[r.id]>0);
  const rubble=g.state.rubble[r.id];
  h=start({saved:h.snapshot()});g=h.game;
  setPlayer(g,player.x,player.z,Math.atan2(-outward[0],outward[1]),Math.atan2(g.surface.height(r.x,r.z)+.14-1.58,1.35));
  assert.equal(g.handTarget().rock.id,r.id);
  g.requestAction();h.steps(15);
  assert.equal(g.state.bag,Math.min(rubble,750));
  if(g.state.bag<rubble){g.requestAction();h.steps(15);}
  assert.equal(g.state.bag,rubble);
  assert.equal(g.state.rubble[r.id],undefined);
  evidence(g);
});

test('local excavation changes the worked height while the remote slope is intact',()=>{
  const h=start({software:false,instanced:true}),g=h.game;
  h.frame();
  assert.ok(h.batches()>4,'instanced WebGL draw calls received surface rock batches');
  const Y=vm.runInContext('Rocks.yard',h.env);
  const A=Y.cells.find(c=>c.capacity>7_000_000);
  const B=Y.cells.find(c=>c.capacity>100000&&Math.hypot(c.x-A.x,c.z-A.z)>3);
  const before=g.surface.height(A.x,A.z), remote=g.surface.height(B.x,B.z);
  assert.equal(g.surface.excavate(A.x,A.z,A.capacity,.2),A.capacity);
  assert.ok(g.surface.height(A.x,A.z)<before*.15);
  assert.equal(g.surface.height(B.x,B.z),remote);
  h.frame();
  assert.ok(h.batches()>8);
});

test('local excavation leaves remote terrain intact and last loads cannot exceed the billion',()=>{
  const h=start({saved:JSON.stringify({removed:999_999_976,credits:0,tier:15,owned:Array.from({length:16},(_,i)=>i)})}),g=h.game;
  const ledger=g.state.depleted;
  const Y=vm.runInContext('Rocks.yard',h.env);
  const cells=Y.cells.filter(c=>c.capacity).sort((a,b)=>b.capacity-a.capacity);
  const A=cells[0],B=cells.find(c=>Math.hypot(c.x-A.x,c.z-A.z)>2.2&&c.capacity>50000);
  for(const c of cells)ledger[c.id]=c.capacity;
  ledger[A.id]-=24;
  evidence(g);
  const before=g.surface.height(B.x,B.z);
  setPlayer(g,entry.x,entry.z);
  g.mount();
  setPlayer(g,A.x+2.40,A.z,-Math.PI/2);
  g.requestAction();h.key('keydown','w');h.steps(24);h.key('keyup','w');
  assert.equal(g.state.bag,24);
  assert.equal(g.surface.height(B.x,B.z),before);
  setPlayer(g,pad.x,pad.z);g.requestAction();h.steps(20);
  assert.equal(g.state.removed,total);
  assert.equal(g.state.credits,24);
  assert.equal(g.state.bag,0);
  assert.equal(h.node('#remaining').textContent,'0');
  evidence(g);
});

test('Larry has eight animated 3D poses and cycles through his yard route',()=>{
  const h=start({software:false}),g=h.game;
  h.frame();assert.ok(h.drawing()>10);
  assert.equal(h.node('#dialogue').hidden,false);
  const stopped=g.state.removed;
  const observed=new Set();
  for(let i=0;i<1420;i++){
    h.steps(1);
    observed.add(g.larry.clip);
  }
  for(const n of ['stand','walk','sit','inspect','hips','watch','drink','talk','inside'])assert.ok(observed.has(n),n);
  const art=vm.runInContext('Rocks.larry',h.env);
  for(const name of ['stand','walk','sit','inspect','hips','watch','drink','talk']){
    const a=art.part(name,.05,[]).item.data.slice(),b=art.part(name,.47,[]).item.data;
    assert.ok(a.every(Number.isFinite));
    assert.ok(b.some((v,i)=>Math.abs(a[i]-v)>.002),name+' animation moves rigged geometry');
  }
  assert.equal(g.state.removed,stopped);
});

test('mobile driving, parked cargo, reload and unload at the truck',()=>{
  const old={removed:55_000,credits:55_000,tier:11,owned:Array.from({length:12},(_,i)=>i)};
  let h=start({saved:JSON.stringify(old)}),g=h.game;
  setPlayer(g,entry.x+.8,entry.z+.5);
  h.event('#act','pointerdown');h.event('#act','pointerup');
  assert.ok(g.state.vehicle.mounted);
  const move=(selector,props,steps)=>{
    h.event(selector,'pointerdown',props);
    h.steps(steps);
    h.event(selector,'pointerup',props);
  };
  move('#stick',{clientX:51,clientY:302},16);
  assert.ok(g.state.vehicle.x<entry.x-3);
  assert.ok(g.machineTarget(),'reachable straight from the delivery pad');
  move('#act',{},24);
  assert.equal(g.state.bag,10000);
  h.event('#mount','click');
  assert.ok(!g.state.vehicle.mounted);
  const parked={...g.state.vehicle};
  h=start({saved:h.snapshot()});g=h.game;
  assert.equal(g.state.bag,10000);
  assert.equal(g.state.vehicle.x,parked.x);
  h.event('#act','pointerdown');h.event('#act','pointerup');
  assert.ok(g.state.vehicle.mounted);
  h.key('keydown','s');h.steps(11);h.key('keyup','s');
  const v=g.state.vehicle;
  assert.ok(v.x>parked.x,'reverse frees the cart from the slope');
  const heading=()=>Math.atan2(pad.x-v.x,v.z-pad.z);
  const difference=()=>Math.atan2(Math.sin(heading()-v.yaw),Math.cos(heading()-v.yaw));
  for(let i=0;i<70&&Math.abs(difference())>.075;i++){
    const key=difference()>0?'d':'a';
    h.key('keydown',key);h.steps(1);h.key('keyup',key);
  }
  assert.ok(Math.abs(difference())<.10,'can turn the cart toward the unload pad');
  for(let i=0;i<60&&!g.nearTruck();i++){h.key('keydown','w');h.steps(1);}
  h.key('keyup','w');
  assert.ok(g.nearTruck(),'truck reachable using the driving controls');
  h.event('#act','pointerdown');h.event('#act','pointerup');h.steps(19);
  assert.equal(g.state.bag,0);
  assert.equal(g.state.removed,65000);
  evidence(g);
});

function shopClick(h,tab,i){
  setPlayer(h.game,shed.x,shed.z);
  h.game.openShop(true);
  h.event('#shopTabs','click',{target:{closest:()=>({dataset:{shop:tab}})}});
  h.event('#items','click',{target:{closest:()=>({dataset:{tier:String(i)}})}});
}
function phoneChoice(h,label){
  const b=h.node('#phoneActions').children.find(node=>node.textContent===label);
  assert.ok(b&&!b.disabled,label+' is available');
  b.onclick();
}

test('pockets, gather training, and foot speed apply independently',()=>{
  const setup={version:4,removed:1000,credits:1000,bag:0,tier:0,owned:[0],carry:1,carryOwned:[0,1]};
  const h=start({saved:JSON.stringify(setup)}),g=h.game;
  shopClick(h,'training',0);shopClick(h,'training',1);shopClick(h,'training',2);
  g.openShop(false);
  assert.equal(g.state.credits,785);
  assert.deepEqual(Array.from(g.state.training),[1,1,1]);
  assert.equal(g.capacity(),5);
  setPlayer(g,0,1.7,-.63,.12);
  g.requestAction();
  assert.ok(g.action.end<g.current().cycle);
  h.steps(8);
  assert.equal(g.state.bag,2);
  const h0=start({saved:JSON.stringify(setup)});
  const distances=[h0,h].map(test=>{
    setPlayer(test.game,5,4);
    test.key('keydown','w');test.steps(6);test.key('keyup','w');
    return 4-test.game.player.z;
  });
  assert.ok(distances[1]>distances[0]*1.14);
  evidence(g);
});

test('wife texts, escalates after dismissal, and stops when answered',()=>{
  const h=start(),g=h.game,p=g.state.phone;
  g.advance(.1);
  assert.ok(!g.phone.visible());
  p.time=299.97;h.steps(1);
  assert.ok(g.phone.visible());
  assert.equal(p.chat[0][1],'Are you almost done? How long is this going to take?');
  assert.ok(p.unread);
  h.event('#phoneClose','click');
  assert.ok(!g.phone.visible()&&p.unread);
  h.steps(583);
  assert.ok(g.phone.visible());
  assert.equal(p.chat.at(-1)[1],'Hello…?');
  phoneChoice(h,'There are a billion rocks.');
  assert.ok(p.chat.some(([who,text])=>who==='wife'&&text.includes('A BILLION?')));
  assert.ok(p.unread,'replying opened a follow-up question');
  phoneChoice(h,'He’s sitting in a lawn chair.');
  assert.match(p.chat.at(-1)[1],/supervising/);
  assert.ok(!p.unread);
  const after=p.chat.length;
  h.steps(650);
  assert.equal(p.chat.length,after);
  h.event('#phoneClose','click');
  p.time=1799.97;p.nextText=1800;
  h.steps(1);
  assert.ok(p.ring&&g.phone.visible());
  phoneChoice(h,'Put away');
  h.steps(330);
  assert.ok(p.ring&&g.phone.visible());
  assert.equal(p.chat.at(-1)[1],'Why didn’t you answer?');
  h.pagehide();
  const saved=start({saved:h.snapshot()});
  assert.ok(saved.game.state.phone.ring&&saved.game.phone.visible());
  phoneChoice(saved,'Answer');
  assert.ok(saved.game.state.phone.active&&!saved.game.state.phone.ring);
  assert.match(saved.node('#phoneThread').children[0].textContent,/going to take like an hour/);
  phoneChoice(saved,'Can we talk while I take a break?');
  assert.match(saved.game.state.phone.callChat.at(-1)[1],/How are you doing/);
  phoneChoice(saved,'I could use a break.');
  assert.match(saved.game.state.phone.callChat.at(-1)[1],/yard will still be there/);
  saved.steps(133);
  assert.ok(!saved.game.state.phone.active);
  assert.equal(saved.game.state.phone.chat.at(-1)[1],'Call ended');
  assert.ok(saved.game.state.phone.unread,'there is still a text to reply to');
  phoneChoice(saved,'Which collagen mask?');
  phoneChoice(saved,'Send me the brand and I’ll match it.');
  assert.equal(saved.game.state.phone.plan.groceries,'you');
  assert.ok(!saved.game.state.phone.unread);
});

test('all four buddies charge once and bring real rocks to the truck',()=>{
  const h=start({saved:JSON.stringify({version:4,removed:555_000_000,credits:555_000_000,owned:[0]})}),g=h.game;
  h.event('#phoneToggle','click');
  h.event('#phoneBuddies','click');
  for(const name of ['Eddie','Marcus','Joey','Dispatch'])phoneChoice(h,'Call '+name);
  assert.equal(g.state.buddies.length,4);
  assert.equal(g.state.credits,4_989_900);
  assert.equal(h.node('#phoneActions').children[0].disabled,true);
  h.event('#phoneClose','click');
  h.steps(1030);
  const earned=g.state.removed-555_000_000;
  assert.ok(earned>0);
  assert.equal(g.state.credits,4_989_900+earned);
  evidence(g);
});

test('conveyor holds queued rocks across reload and the collector and crusher produce',()=>{
  const fixture={version:4,removed:50_000_000,credits:50_000_000,bag:100,tier:3,owned:[0,1,2,3],carry:3,carryOwned:[0,1,2,3]};
  let h=start({saved:JSON.stringify(fixture)}),g=h.game;
  const B=vm.runInContext('Rocks.backyard',h.env);
  shopClick(h,'factory',0);
  assert.equal(g.state.factory,1);
  setPlayer(g,B.hopper.x,B.hopper.z);
  h.steps(11);
  assert.equal(g.state.bag,0);
  assert.equal(g.state.buffer,100);
  assert.equal(g.state.removed,50_000_000);
  evidence(g);
  h=start({saved:h.snapshot()});g=h.game;
  assert.equal(g.state.buffer,100);
  const before=g.state.credits;
  h.steps(85);
  assert.equal(g.state.buffer,0);
  assert.equal(g.state.credits,before+100);
  shopClick(h,'factory',1);
  h.steps(80);
  assert.ok(g.state.buffer>0);
  const beforeFactory=g.state.removed;
  h.steps(90);
  assert.ok(g.state.removed>beforeFactory);
  shopClick(h,'factory',2);assert.equal(g.state.factory,3);
  h.steps(80);
  assert.equal(g.state.buffer,3_300_000);
  evidence(g);
  h.frame();
});

test('legacy equipment stays useful and wheelbarrow cargo migrates',()=>{
  const save={version:3,removed:2000,credits:200,tier:7,bag:1205,owned:[0,1,2,3,4,5,6,7]};
  const h=start({saved:JSON.stringify(save)}),g=h.game;
  assert.equal(g.state.tier,6);
  assert.equal(g.state.carry,5);
  assert.equal(g.state.bag,1205);
  assert.equal(g.capacity(),1500);
  assert.ok(!g.state.owned.includes(7));
  evidence(g);
  h.frame();
});

test('hold jackhammer beside the hopper to feed automatically, even after a backlog',()=>{
  const h=start({saved:JSON.stringify({version:4,removed:50_000_000,credits:9000,owned:[0,9],tier:9,
    carry:1,carryOwned:[0,1],factory:1,buffer:24_000_000,factoryTick:0})});
  const g=h.game,B=vm.runInContext('Rocks.backyard',h.env);
  setPlayer(g,B.hopper.x-1.74,B.hopper.z+.43,-Math.PI/2,-.18);
  assert.ok(g.handTarget(),'the drill can reach the pile from the hopper');
  const before=g.state.removed;
  h.event('#act','pointerdown');
  h.steps(39);
  assert.equal(g.state.buffer,B.BUFFER_MAX);
  assert.equal(g.state.bag,0);
  assert.equal(h.node('#factoryStatus').dataset.status,'BACKED UP');
  h.steps(110);
  h.event('#act','pointerup');h.steps(7);
  assert.ok(g.state.removed>before);
  assert.equal(g.state.bag,0);
  assert.ok(g.state.buffer>B.BUFFER_MAX-2_400_000,'drill resumed feeding after the belt drained');
  evidence(g);
});

test('a THRIVE-rigged buddy boards, moves and excavates the dozer while a second hauls',()=>{
  const fixture={version:4,removed:8_000_000,credits:8_000_000,tier:15,handTier:9,
    owned:Array.from({length:16},(_,i)=>i),buddies:[0,0],factory:1,
    vehicle:{x:4.5,z:1.2,yaw:-1.35,mounted:true}};
  const h=start({saved:JSON.stringify(fixture),software:false,instanced:true}),g=h.game;
  h.event('#phoneToggle','click');h.event('#phoneBuddies','click');
  h.node('#phoneThread').children[0].children[0].onclick();
  const thread=h.node('#phoneThread');
  const training=()=>thread.children.at(-1).children[1];
  assert.equal(thread.children[2].children.at(-1).disabled,true);
  for(let i=0;i<3;i++)training().onclick();
  thread.children[3].children[1].onclick();
  thread.children[4].children[1].onclick();
  assert.equal(g.state.buddies[0].training,3);
  assert.equal(g.state.buddies[0].pace,1);
  assert.equal(g.state.buddies[0].handling,1);
  assert.equal(g.state.credits,8_000_000-450-3800-22000-180-250);
  thread.children[2].children.at(-1).onclick();
  assert.equal(g.state.buddies[0].job,'dozer');
  h.event('#phoneClose','click');
  h.event('#mount','click');
  const machine=g.state.crewDozer;
  assert.ok(machine);
  assert.equal(g.state.vehicle,null);
  assert.equal(g.state.tier,9);
  assert.equal(machine.phase,'board');
  const initial={x:machine.x,z:machine.z};
  const observed=new Set();
  let sawHauler=false, sawDozerLoad=false, sawHopper=false, sawMovement=false;
  for(let i=0;i<2350;i++){
    h.steps(1);
    observed.add(machine.phase);
    if(g.state.buddies[1].load)sawHauler=true;
    if(machine.load>=100000)sawDozerLoad=true;
    if(g.state.buffer>100000)sawHopper=true;
    if(Math.hypot(machine.x-initial.x,machine.z-initial.z)>3)sawMovement=true;
    if(i%120===0)evidence(g);
    if(sawHauler&&sawDozerLoad&&sawHopper&&sawMovement&&g.state.removed>fixture.removed+100000)break;
  }
  for(const phase of ['board','climb','drive','cut','unload','tipped'])assert.ok(observed.has(phase),phase);
  assert.ok(sawHauler&&sawDozerLoad&&sawHopper&&sawMovement);
  assert.ok(g.state.removed>8_100_000);
  const crewData=vm.runInContext('Rocks.crewData',h.env);
  assert.equal(crewData.bones,22);
  assert.ok(['walk','push','scoop','climb','drive'].every(clip=>crewData.clips[clip]));
  const parts=g.crew.parts(g.player);
  assert.ok(parts.filter(p=>p.item.data.length===crewData.indices.length*6).length>=2);
  evidence(g);
});

test('handoff and takeover preserve cargo across a save and block a duplicate dozer',()=>{
  const fixture={version:4,removed:6_000_000,credits:6_000_000,tier:15,handTier:9,bag:8405,
    owned:Array.from({length:16},(_,i)=>i),buddies:[0,0,0,0],factory:1,
    vehicle:{x:4.5,z:1.2,yaw:-1.35,mounted:true}};
  let h=start({saved:JSON.stringify(fixture)}),g=h.game;
  assert.ok(g.crewJob(3,'dozer'));
  g.mount();
  assert.equal(g.state.crewDozer.load,8405);
  assert.equal(g.state.bag,0);
  evidence(g);
  const parked=g.state.crewDozer;
  h=start({saved:h.snapshot()});g=h.game;
  assert.equal(g.state.crewDozer.load,8405);
  shopClick(h,'tools',15);
  assert.equal(g.state.tier,9);
  g.openShop(false);
  setPlayer(g,parked.x+1.2,parked.z);
  h.key('keydown','f');h.key('keyup','f');
  h.steps(2);
  assert.equal(g.state.crewDozer.phase,'parked');
  assert.equal(g.state.crewDozer.load,8405);
  h.key('keydown','f');h.key('keyup','f');
  assert.equal(g.state.crewDozer,null);
  assert.ok(g.state.vehicle.mounted);
  assert.equal(g.state.bag,8405);
  evidence(g);
});

test('the powered intake can be moved to a reachable cut',()=>{
  const h=start({saved:JSON.stringify({version:4,removed:1_000_000,owned:[0],factory:2})}),g=h.game;
  setPlayer(g,1.35,-1.76,-Math.PI/2,-.23);
  const target=g.handTarget();
  assert.ok(target);
  h.event('#intakeBtn','click');
  assert.equal(g.state.intakeFocus.x,target.x);
  assert.equal(g.state.intakeFocus.z,target.z);
  h.steps(78);
  assert.ok(g.state.buffer>0);
  evidence(g);
});

function aimAt(g,x,z){
  const p=g.player;
  const dy=g.surface.height(x,z)-g.surface.height(p.x,p.z)-1.52;
  p.yaw=Math.atan2(x-p.x,p.z-z);
  p.pitch=Math.atan2(dy,Math.hypot(x-p.x,z-p.z));
  assert.ok(g.tech.aim(p),'camera can acquire a rock target');
}

test('all five future purchases charge once and persist on an existing save',()=>{
  const h=start({saved:JSON.stringify({version:5,removed:450_000_000,credits:400_000_000,owned:[0,9],tier:9,factory:0})}),g=h.game;
  const F=vm.runInContext('Rocks.future',h.env);
  for(let i=0;i<F.upgrades.length;i++)shopClick(h,'tech',i);
  assert.equal(g.state.credits,20_000_000);
  assert.equal(g.state.factory,1,'laser included a high-speed conveyor');
  assert.equal(g.state.tier,F.ORBITAL);
  assert.equal(g.state.tech.permit,false);
  assert.ok(g.state.tech.drones&&g.state.tech.gantry);
  shopClick(h,'tech',0);
  shopClick(h,'tech',1);
  assert.equal(g.state.credits,20_000_000);
  assert.equal(g.state.tier,F.MATTER);
  assert.ok(g.state.owned.includes(F.LASER)&&g.state.owned.includes(F.ORBITAL));
  const saved=start({saved:h.snapshot()});
  assert.deepEqual(JSON.parse(JSON.stringify(saved.game.state)),JSON.parse(JSON.stringify(g.state)));
  evidence(saved.game);
});

test('landscape touch laser cuts directly into the hopper and the high-speed belt drains it',()=>{
  const h=start({saved:JSON.stringify({version:6,removed:400_000_000,credits:100_000_000,owned:[0,16],tier:16,factory:1})}),g=h.game;
  setPlayer(g,-.65,4.8);
  aimAt(g,-3.9,-1.6);
  h.event('#act','pointerdown');
  h.steps(30,.05);
  h.event('#act','pointerup');
  assert.equal(g.state.bag,0);
  assert.equal(g.state.buffer,3_900_000);
  assert.equal(g.state.removed,400_000_000);
  evidence(g);
  h.steps(51,.05);
  assert.equal(g.state.buffer,0);
  assert.equal(g.state.removed,403_900_000,'the installed conveyor processes more than the base belt per tick');
  assert.equal(g.state.credits,103_900_000);
  assert.equal(g.state.tech.reserve,0,'laser output never earns recharge when the belt pays out');
  evidence(g);
});

test('disintegrator pays at impact with a full carrier and stops on release',()=>{
  const h=start({saved:JSON.stringify({version:6,removed:420_000_000,credits:80_000_000,owned:[0,17],tier:17,bag:1})}),g=h.game;
  setPlayer(g,-.8,4.6);
  aimAt(g,-4.1,-1.7);
  h.key('keydown','e');h.steps(40,.05);h.key('keyup','e');
  assert.equal(g.state.removed,430_000_000);
  assert.equal(g.state.credits,90_000_000);
  assert.equal(g.state.bag,1,'old cargo stays in the carrier');
  assert.equal(g.state.buffer,0);
  h.steps(40,.05);
  assert.equal(g.state.removed,430_000_000);
  evidence(g);
});

test('gravity drones consolidate actual field stock and do not mint credits',()=>{
  const h=start({saved:JSON.stringify({version:6,removed:640_000_000,credits:80_000_000,owned:[0],tech:{drones:true}})}),g=h.game;
  const Y=vm.runInContext('Rocks.yard',h.env);
  const area=Y.cells.filter(c=>Math.hypot(c.x-.06,c.z-.91)<=1.65);
  const before=area.reduce((n,c)=>n+g.surface.available(c.id),0);
  h.event('#droneBtn','click');
  h.steps(20,.05);
  const after=area.reduce((n,c)=>n+g.surface.available(c.id),0);
  assert.ok(after>before);
  assert.equal(g.state.removed,640_000_000);
  assert.equal(g.state.credits,80_000_000);
  evidence(g);
  h.frame();
});

test('gantry can pause or switch modes and cleans up the last isolated cells and rubble',()=>{
  const h=start({saved:JSON.stringify({version:6,removed:total-1000,credits:100_000_000,owned:[0],
    tech:{gantry:true,mode:0}})}),g=h.game;
  const Y=vm.runInContext('Rocks.yard',h.env);
  const first=Y.cells.find(c=>c.capacity>100_000), last=Y.cells.findLast(c=>c.capacity>100_000);
  const rock=g.surface.geology[26];
  g.state.depleted=Y.cells.map(c=>c.capacity);
  g.state.depleted[first.id]-=234;
  g.state.depleted[last.id]-=666;
  g.state.hits[rock.id]=rock.req;
  g.state.rubble[rock.id]=100;
  evidence(g);
  h.steps(20,.05);
  assert.equal(g.state.removed,total-1000,'legacy installations wait for deliberate activation');
  h.event('#gantryBtn','click');
  h.event('#gantryBtn','click');
  assert.equal(g.state.tech.mode,1);
  h.event('#gantryBtn','click');
  assert.equal(g.state.tech.mode,2);
  h.steps(20,.05);
  assert.equal(g.state.removed,total-1000);
  h.event('#gantryBtn','click');
  h.event('#gantryBtn','click'); // Cleanup
  h.steps(20,.05);
  assert.equal(g.state.removed,total);
  assert.equal(g.state.rubble[rock.id],undefined);
  assert.equal(g.state.credits,100_001_000);
  evidence(g);
});

test('Larry authorizes the orbital pass, which resumes from a save at 12 million rocks per second',()=>{
  const h=start({saved:JSON.stringify({version:6,removed:500_000_000,credits:100_000_000,owned:[0,18],tier:18})}),g=h.game;
  setPlayer(g,4,5.0);
  g.requestAction();
  assert.equal(g.state.tech.permit,false);
  setPlayer(g,g.larry.x, g.larry.z-.5);
  g.requestAction();
  assert.ok(g.state.tech.permit);
  assert.match(h.node('#dialogue span').textContent,/electric/);
  setPlayer(g,-.8,4.5);
  aimAt(g,-4.4,-1.9);
  g.requestAction();
  assert.ok(g.state.tech.mark);
  const h2=start({saved:h.snapshot()}),g2=h2.game;
  assert.ok(g2.state.tech.permit&&g2.state.tech.mark);
  h2.steps(40,.05);
  assert.equal(g2.state.removed,524_000_000);
  assert.equal(g2.state.credits,124_000_000);
  evidence(g2);
});

test('one orbital pass and one gantry streak are bounded with plenty of rock left',()=>{
  const h=start({saved:JSON.stringify({version:6,removed:500_000_000,credits:50_000_000,
    owned:[0,18],tier:18,tech:{gantry:true,permit:true,mark:{x:-4.4,z:-2.4}}})}),g=h.game;
  h.event('#gantryBtn','click');
  h.steps(1400,.05);
  assert.equal(g.state.removed,626_000_000);
  assert.equal(g.state.credits,176_000_000);
  assert.equal(g.state.tech.charges.gantry,0);
  assert.equal(g.state.tech.charges.orbital,0);
  assert.equal(g.state.tech.mark,null);
  assert.equal(g.state.tech.reserve,0,'automation cannot recharge itself');
  h.event('#gantryBtn','click');
  assert.equal(g.state.tech.charges.gantry,0);
  evidence(g);
});

test('a spent trigger cannot automatically buy another disintegrator burst',()=>{
  const h=start({saved:JSON.stringify({version:7,removed:420_000_000,credits:80_000_000,owned:[0,17],tier:17,
    tech:{reserve:60_000_000,charges:{matter:.25}}})}),g=h.game;
  setPlayer(g,-.8,4.6);aimAt(g,-4.1,-1.7);
  h.key('keydown','e');h.steps(40,.05);
  assert.equal(g.state.removed,421_250_000);
  assert.equal(g.state.tech.charges.matter,0);
  assert.equal(g.state.tech.reserve,60_000_000);
  h.key('keyup','e');h.steps(1,.05);
  h.key('keydown','e');h.steps(10,.05);h.key('keyup','e');
  assert.equal(g.state.tech.reserve,24_000_000);
  assert.equal(g.state.tech.charges.matter,29.5);
  assert.equal(g.state.removed,423_750_000);
  const h2=start({saved:h.snapshot()});
  assert.equal(h2.game.state.tech.charges.matter,29.5);
  h2.steps(600,.05);
  assert.equal(h2.game.state.tech.charges.matter,0,'the active charge expires with the trigger released');
  assert.equal(h2.game.state.removed,423_750_000);
  evidence(h2.game);
});

test('your direct loads and conveyor feed refill the shared reserve, while passive stock does not',()=>{
  const fixture={version:7,removed:400_000_000,credits:40_000_000,bag:12_000_000,
    owned:[0,15,16,17],tier:15,factory:1,buffer:2_000_000,
    vehicle:{x:10.8,z:-2.6,yaw:0,mounted:true},tech:{charges:{matter:0,laser:-1}}};
  const h=start({saved:JSON.stringify(fixture)}),g=h.game;
  g.requestAction();h.steps(30,.05);
  assert.equal(g.state.tech.reserve,12_000_000);
  assert.equal(g.state.bag,0);
  const B=vm.runInContext('Rocks.backyard',h.env),Y=vm.runInContext('Rocks.yard',h.env);
  g.state.bag=12_000_000;
  g.state.depleted=Y.spread(g.state.removed+g.state.bag+g.state.buffer);
  setPlayer(g,B.hopper.x,B.hopper.z+2);
  h.steps(1,.05);
  assert.equal(g.state.tech.manualQueued,12_000_000);
  assert.equal(g.state.tech.reserve,12_000_000,'the belt must deliver before the charge earns');
  h.steps(90,.05);
  assert.equal(g.state.buffer,0);
  assert.equal(g.state.tech.manualQueued,0);
  assert.equal(g.state.tech.reserve,24_000_000,'only the 12M delivered hands-on counted');
  evidence(g);
});

test('a grocery choice survives reload and changes the next call',()=>{
  let h=start(),g=h.game,p=g.state.phone;
  p.time=299.97;h.steps(1);
  phoneChoice(h,'Could you come help?');
  phoneChoice(h,'Bring the big bottle, please.');
  h.event('#phoneClose','click');
  p.time=p.nextText-.025;h.steps(1);
  phoneChoice(h,'Can you get groceries? I’m going to be a while.');
  h.pagehide();
  h=start({saved:h.snapshot()});g=h.game;p=g.state.phone;
  h.event('#phoneToggle','click');
  phoneChoice(h,'I can grab bread.');
  assert.equal(p.plan.groceries,'bread');
  assert.equal(p.plan.water,'bring');
  h.event('#phoneClose','click');
  p.time=p.nextCall-.025;h.steps(1);
  phoneChoice(h,'Answer');
  assert.match(p.callChat[0][1],/still grabbing the bread/);
  phoneChoice(h,'Can we change the plan? I’m still in the yard.');
  assert.equal(p.plan.groceries,'wife');
  assert.match(p.callChat.at(-1)[1],/rocks/);
  h.pagehide();
  const reloaded=start({saved:h.snapshot()});
  phoneChoice(reloaded,'Answer');
  assert.equal(reloaded.game.state.phone.callNode,'progress');
  phoneChoice(reloaded,'I need a break more than an estimate.');
  assert.match(reloaded.game.state.phone.callChat.at(-1)[1],/Take one/);
});

test('a ten-minute promise gets a callback and the final text remembers grocery plans',()=>{
  const h=start(),g=h.game,p=g.state.phone;
  p.time=299.97;h.steps(1);
  phoneChoice(h,'Give me ten minutes.');
  phoneChoice(h,'Actual minutes. I’ll text when I’m done.');
  h.event('#phoneClose','click');
  const when=p.followAt;
  p.time=when-.02;p.nextText=when+50;
  h.steps(1);
  assert.equal(p.textNode,'callback');
  phoneChoice(h,'I underestimated it. Eat without me.');
  assert.match(p.chat.at(-1)[1],/save you a plate/);
  p.plan.groceries='you';g.state.removed=total;
  h.steps(1);
  assert.equal(p.textNode,'finish');
  assert.match(p.chat.at(-1)[1],/list still stands/);
  phoneChoice(h,'Coming home.');
  assert.equal(p.finished,true);
});

test('a full Disintegrator charge runs at 5M per second for 30 seconds and caps at 150M',()=>{
  const h=start({saved:JSON.stringify({version:7,removed:400_000_000,credits:30_000_000,
    owned:[0,17],tier:17,tech:{charges:{matter:-1}}})}),g=h.game;
  const Y=vm.runInContext('Rocks.yard',h.env);
  setPlayer(g,-.8,4.6);aimAt(g,-4.1,-1.7);
  h.key('keydown','e');
  for(let pulse=0;pulse<129;pulse++){
    const cell=Y.cells.reduce((big,c)=>g.surface.available(c.id)>g.surface.available(big.id)?c:big);
    aimAt(g,cell.x,cell.z);
    h.steps(5,.05);
  }
  h.key('keyup','e');
  assert.equal(g.state.removed,550_000_000);
  assert.equal(g.state.tech.charges.matter,0);
  assert.equal(g.state.tech.reserve,0);
  evidence(g);
});
