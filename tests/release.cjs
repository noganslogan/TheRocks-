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
      textContent:'',style:{},hidden:false,classList:{add(){},remove(){},toggle(){}},
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
    document:{querySelector:node},
    localStorage:{getItem:()=>snapshot,setItem(key,value){snapshot=value;writes++;}}
  };
  vm.createContext(env);
  for(const file of ['render','models','larry-data','larry-rig','yard','game']){
    let code=fs.readFileSync(path.join(root,'js',file+'.js'),'utf8');
    if(file==='game'){
      const marker='  updateUI();\n  requestAnimationFrame(frame);';
      assert.ok(code.includes(marker));
      code=code.replace(marker,`
        window.harness={surface,larry,heldKeys,openShop,equip,mount,requestAction,
          get player(){return player;},get state(){return state;},get action(){return action;},
          get clock(){return clock;},get blade(){return blade;},get tools(){return tools;},
          inside:()=>shopOpen,current,handTarget,machineTarget,nearTruck,worldBlock,migration,render,
          advance(dt){clock+=dt;motion(dt);actions();updateLarry(dt);context();surface.step(dt);}};
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
  return {game,node,event,key,steps,frame,env,snapshot:()=>snapshot,writes:()=>writes,drawing:()=>drawing,batches:()=>batches};
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
  assert.equal(s.depleted.reduce((a,b)=>a+b,0),s.removed+s.bag+Object.values(s.rubble).reduce((a,b)=>a+b,0));
  assert.ok(s.credits>=0&&s.credits<=s.removed);
  assert.ok(s.bag<=g.current().cap);
  assert.ok(s.removed+s.bag<=total);
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

test('old saves on both renderers, damaged save repair and carry-safe equip',()=>{
  const old=(key)=>({removed:440,credits:61,bag:44,tier:3,owned:[0,1,2,3],hits:{[key]:4}});
  for(const key of ['v2:4828','v2:1078']){
    const h=start({saved:JSON.stringify(old(key))}),g=h.game;
    assert.deepEqual(JSON.parse(JSON.stringify(g.state.hits)),{'stone-28':4});
    assert.equal(g.state.bag,44);
    assert.equal(g.state.credits,61);
    evidence(g);
    setPlayer(g,shed.x,shed.z);
    g.openShop(true);g.equip(1);
    assert.equal(g.state.tier,3);
    setPlayer(g,pad.x,pad.z);
    g.openShop(false);g.requestAction();h.steps(11);
    assert.equal(g.state.removed,484);assert.equal(g.state.credits,105);
  }
  const repaired=start({saved:JSON.stringify({version:3,removed:75,credits:800,bag:0,owned:[0],hits:{},depleted:[-1]})});
  assert.equal(repaired.game.state.credits,75);
  evidence(repaired.game);
});

test('full progression from a fresh save through all 16 tools and normal purchase actions',()=>{
  const h=start(),g=h.game;
  const cycleTrip=(at)=>{
    const t=g.current();
    if(t.eye){
      setPlayer(g,at.x,at.z,at.yaw);
      if(t.mode==='dozer'){
        if(!g.blade)g.requestAction();
        h.key('keydown','w');h.steps(36);h.key('keyup','w');h.steps(5);
      }else{
        for(let i=0;i<8&&g.state.bag<t.cap;i++){
          assert.ok(g.machineTarget(),t.n+' has reachable gravel');
          g.requestAction();h.steps(Math.ceil(t.cycle/.055)+2);
        }
      }
    }else{
      setPlayer(g,0,1.7,-.63,.12);
      if(t.hold){
        h.key('keydown','e');h.steps(44);h.key('keyup','e');h.steps(10);
      }else for(let i=0;i<9&&g.state.bag<t.cap;i++){
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
  const trips=[];
  for(let i=0;i<g.tools.length;i++){
    const t=g.current(),next=g.tools[i+1];
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
    do{
      cycleTrip({x:3.55,z:-1.2,yaw:-1.61});
      assert.ok(++count<=20,t.n+' reaches next upgrade within 20 full trips');
    }while(next&&g.state.credits<next.cost);
    trips.push(count);
    if(!next)break;
    if(t.eye){g.mount();assert.equal(g.state.vehicle.mounted,false);}
    setPlayer(g,shed.x,shed.z);
    g.openShop(true);assert.ok(g.inside());
    if(i===0){g.equip(2);assert.equal(g.state.tier,0,'upgrade prerequisites enforced');}
    const credits=g.state.credits;
    g.equip(i+1);
    assert.equal(g.state.credits,credits-next.cost);
    if(next.eye)assert.equal(g.state.vehicle.x,entry.x);
    evidence(g);
  }
  console.log('  Trips per tier:',trips.join(', '));
  assert.equal(g.state.owned.length,16);
  const restored=start({saved:h.snapshot()});
  assert.equal(restored.game.state.tier,15);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.game.state)),JSON.parse(JSON.stringify(g.state)));
});

test('boulder fracture creates accounted rubble, which saves and stays collectible',()=>{
  const old={removed:12000,credits:0,tier:8,owned:Array.from({length:9},(_,i)=>i)};
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
