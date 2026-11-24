'use strict';

Rocks.crew = (() => {
  const B=Rocks.backyard, Y=Rocks.yard, M=Rocks.models, R=Rocks.render;
  const DOZER=15, dozer=M.tools[DOZER];
  const rankNames=['Hand tools','Wheelbarrow','Reinforced haul','Bulldozer'];
  const training=[
    {key:'pace',name:'Pace',costs:[180,1350,9500]},
    {key:'handling',name:'Handling',costs:[250,1850,12500]},
    {key:'training',name:'Machine training',costs:[450,3800,22000]}
  ];
  const statuses={
    seek:'Heading to the pile',scoop:'Loading rocks',deliver:'Hauling a load',blocked:'Looking for a route',
    idle:'Waiting for a job',rest:'Taking a break',board:'Walking to the bulldozer',climb:'Climbing into the cab',
    drive:'Driving to the pile',cut:'Pushing gravel',unload:'Hauling to the drop-off',tipped:'Unloading',
    full:'Waiting for hopper space',park:'Parking the bulldozer',parked:'Parked for takeover'
  };
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const turn=(from,to,amount)=>{
    const d=Math.atan2(Math.sin(to-from),Math.cos(to-from));
    return from+R.clamp(d,-amount,amount);
  };
  const facing=(from,to)=>Math.atan2(to.x-from.x,from.z-to.z);
  const num=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
  const int=(n,max)=>R.clamp(Math.floor(num(n)),0,max);
  const newHire=i=>({job:'haul',phase:'seek',x:5.2+i*.4,z:2.8+i*.50,yaw:-1.1,age:0,wait:0,load:0,
    pace:0,handling:0,training:B.buddies[i].training});
  const buddyCapacity=(b,i)=>Math.floor(B.buddies[i].load*(1+b.handling*.30+b.training*.21));
  const totalLoad=s=>s.buddies.reduce((sum,b)=>sum+b.load,0)+(s.crewDozer?.load||0);
  function restore(s,raw){
    let budget=Y.TOTAL-s.removed-s.bag-s.buffer;
    const old=Array.isArray(raw.buddies)?raw.buddies.slice(0,B.buddies.length):[];
    s.buddies=old.map((saved,i)=>{
      const b=newHire(i);
      if(!saved||typeof saved!=='object')return b;
      b.job=['haul','rest','dozer'].includes(saved.job)?saved.job:'haul';
      b.phase=Object.prototype.hasOwnProperty.call(statuses,saved.phase)?saved.phase:'seek';
      b.x=R.clamp(num(saved.x,b.x),-13.8,13.8);b.z=R.clamp(num(saved.z,b.z),-11.3,7.55);
      b.yaw=num(saved.yaw,b.yaw);b.age=R.clamp(num(saved.age),0,300);b.wait=R.clamp(num(saved.wait),0,3);
      for(const t of training)b[t.key]=int(saved[t.key],3);
      b.load=int(saved.load,Math.min(budget,buddyCapacity(b,i)));
      budget-=b.load;
      return b;
    });
    const d=raw.crewDozer;
    if(d&&s.tier!==DOZER&&s.owned.includes(DOZER)&&Number.isInteger(d.driver)&&s.buddies[d.driver]?.training===3){
      s.crewDozer={
        driver:d.driver,x:R.clamp(num(d.x,Y.delivery.x),-13,13),z:R.clamp(num(d.z,Y.delivery.z),-10.7,6.7),
        yaw:num(d.yaw,Y.delivery.yaw),phase:['board','climb','drive','cut','unload','tipped','full','park','parked'].includes(d.phase)?d.phase:'drive',
        load:int(d.load,Math.min(budget,dozer.cap)),wait:R.clamp(num(d.wait),0,3),age:R.clamp(num(d.age),0,10),
        reclaim:!!d.reclaim,spin:num(d.spin)%R.TAU,seated:!!d.seated
      };
      s.buddies[d.driver].job='dozer';
    }
  }
  function price(b,i,key){
    const track=training.find(t=>t.key===key), n=track?.costs[b[key]];
    return n===undefined?null:n*(i+1);
  }
  const status=(s,b,i)=>s.crewDozer?.driver===i?statuses[s.crewDozer.phase]:b.job==='dozer'&&!b.load?
    'Ready for the bulldozer':statuses[b.phase]||'Ready';

  // Plan on the same walkable terrain used by the player. Routes are rebuilt after a cut or obstruction.
  const spacing=.72, cols=39, rows=27, left=-13.68, back=-11.28;
  const px=i=>left+(i%cols)*spacing, pz=i=>back+Math.floor(i/cols)*spacing;
  const index=(x,z)=>R.clamp(Math.round((x-left)/spacing),0,cols-1)+
    R.clamp(Math.round((z-back)/spacing),0,rows-1)*cols;
  const neighbors=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  function route(from,blocked,goal){
    const start=index(from.x,from.z), seen=new Int16Array(cols*rows).fill(-1);
    const queue=new Int16Array(seen.length);
    let first=0,last=1;
    queue[0]=start;seen[start]=start;
    while(first<last){
      const id=queue[first++], x=id===start?from.x:px(id),z=id===start?from.z:pz(id);
      const value=goal(x,z);
      if(value){
        const points=[];
        for(let k=id;k!==start;k=seen[k])points.push({x:px(k),z:pz(k)});
        return {points:points.reverse(),value,cursor:0};
      }
      const cx=id%cols,cz=Math.floor(id/cols);
      for(const [dx,dz] of neighbors){
        const nx=cx+dx,nz=cz+dz;
        if(nx<0||nz<0||nx>=cols||nz>=rows)continue;
        const k=nz*cols+nx, X=px(k),Z=pz(k);
        if(seen[k]!==-1||blocked(X,Z)||blocked((X+x)*.5,(Z+z)*.5))continue;
        if(dx&&dz&&blocked(X,z)&&blocked(x,Z))continue;
        seen[k]=id;queue[last++]=k;
      }
    }
    return null;
  }
  const bucket=R.mesh(R.build(()=>{
    const x=.29,y=.68,z=.20;
    R.cylinder(x,y-.19,z,.125,.036,'5f6760','y',10);
    for(let i=0;i<10;i++){
      const a=i*R.TAU/10,b=(i+1)*R.TAU/10;
      const corner=(angle,r,h)=>[x+Math.cos(angle)*r,h,z+Math.sin(angle)*r];
      R.quad(corner(a,.123,y-.177),corner(b,.123,y-.177),corner(b,.159,y),corner(a,.159,y),'7b8c8a');
      R.rod(corner(a,.158,y),corner(b,.158,y),.012,'acb5a7',5);
    }
    for(let i=0;i<8;i++){
      const bow=t=>[x+Math.cos(t)*.16,y+Math.sin(t)*.132,z];
      R.rod(bow(i*Math.PI/8),bow((i+1)*Math.PI/8),.008,'929c92',5);
    }
  }));
  const bucketRocks=R.mesh(R.build(()=>{
    for(let i=0;i<6;i++)R.stone({x:.29+Math.cos(i*2.4)*.079,y:.66,z:.20+Math.sin(i*2.4)*.073,size:.054,seed:i,mat:R.palette[i]});
  }));
  const shovel=R.mesh(R.build(()=>{
    R.rod([0,0,-.23],[0,0,.58],.023,'a78352',7);
    R.quad([-.09,.018,.54],[.09,.018,.54],[.122,-.018,.73],[-.122,-.018,.73],'7f8b8a');
    R.tri([-.122,-.018,.73],[.122,-.018,.73],[0,-.047,.855],'909e9d');
  }));
  function create({getState,surface,blocked,harvest,feed,deposit,refresh,pad}){
    const routes=new WeakMap(), cutPoints=new WeakMap();
    const blockedFoot=(x,z)=>blocked(x,z,false);
    const blockedDozer=(x,z)=>blocked(x,z,true,dozer);
    const actors=B.buddies.map(b=>{
      const [width,height,head]=b.build;
      const tint=R.color(b.shirt), skin=R.color(b.skin), hair=R.color(b.hair);
      return Rocks.skin(Rocks.crewData,{width,height,head,colors:{
        'Forest green polo':tint,'Polo collar':tint.map(n=>Math.min(1,n*1.22)),
        'Polo seams':tint.map(n=>n*.72),Skin:skin,'Nose and ears':skin.map(n=>Math.min(1,n*1.13)),
        'Graying brown hair':hair,'Silver at the temples':hair.map(n=>n*1.13),'Brown chinos':R.color('5f6357')
      }});
    });
    function findCut(x,z,reach){
      const s=getState();
      let candidate=surface.nearest(x,z,reach);
      let best=candidate?distance({x,z},candidate):reach;
      for(const rock of surface.geology){
        if(s.rubble[rock.id]&&distance({x,z},rock)<best){
          candidate=rock;best=distance({x,z},rock);
        }
      }
      return candidate;
    }
    function plan(actor,key,avoid,goal){
      const cached=routes.get(actor);
      if(cached?.key===key)return cached;
      const path=route(actor,avoid,goal);
      if(path){path.key=key;routes.set(actor,path);}
      return path;
    }
    function findRoute(actor,avoid,reach){
      const s=getState();
      if(s.removed+s.bag+s.buffer+totalLoad(s)>=Y.TOTAL)return null;
      return plan(actor,'cut',avoid,(x,z)=>{
        if(Math.abs(x-Y.pile.x)>Y.pile.rx+reach||Math.abs(z-Y.pile.z)>Y.pile.rz+reach)return null;
        return findCut(x,z,reach);
      });
    }
    function change(a,phase){
      a.phase=phase;a.age=0;a.wait=0;routes.delete(a);
    }
    function walk(actor,path,speed,dt,avoid,isDozer=false){
      const waypoint=path.points[path.cursor];
      if(!waypoint)return true;
      const d=distance(actor,waypoint);
      if(d<.065){path.cursor++;return path.cursor>=path.points.length;}
      const heading=facing(actor,waypoint);
      actor.yaw=turn(actor.yaw,heading,(isDozer?2.55:8)*dt);
      if(isDozer&&Math.cos(actor.yaw-heading)<.95){actor.spin+=dt*.55;return false;}
      const ratio=Math.min(1,speed*dt/d);
      const x=R.mix(actor.x,waypoint.x,ratio),z=R.mix(actor.z,waypoint.z,ratio);
      if(avoid(x,z)){routes.delete(actor);return false;}
      actor.x=x;actor.z=z;
      if(isDozer)actor.spin=(actor.spin+Math.min(d,speed*dt)/.32)%R.TAU;
      return false;
    }
    const destination=s=>s.factory?B.hopper:pad;
    function drop(a,s){
      if(!a.load)return 0;
      const n=s.factory?feed(a.load):(deposit(a.load),a.load);
      a.load-=n;
      return n;
    }
    function hauler(b,i,dt,s){
      const pace=1+b.pace*.14;
      b.age+=dt;
      if(b.wait>0){b.wait-=dt;return false;}
      if(!b.load&&b.job==='rest'){
        if(b.phase!=='rest')change(b,'rest');
        return false;
      }
      if(!b.load&&b.job==='dozer'&&!s.crewDozer){
        if(b.phase!=='idle')change(b,'idle');
        return false;
      }
      if(b.load&&b.phase!=='deliver'&&b.phase!=='full')change(b,'deliver');
      if(b.phase==='full'||b.phase==='deliver'){
        const dest=destination(s), key=s.factory?'hopper':'truck';
        const path=plan(b,key,blockedFoot,(x,z)=>distance({x,z},dest)<(s.factory?1.75:2.1));
        if(!path){b.wait=1.6;return false;}
        if(!walk(b,path,(1.55+i*.16)*pace,dt,blockedFoot))return false;
        b.yaw=turn(b.yaw,facing(b,dest),dt*8);
        const sent=drop(b,s);
        change(b,b.load?'full':'seek');
        if(b.load)b.wait=.42;
        return !!sent;
      }
      if(b.phase==='scoop'){
        const target=cutPoints.get(b)||findCut(b.x,b.z,1.73);
        if(!target){change(b,'seek');return false;}
        b.yaw=turn(b.yaw,facing(b,target),dt*8);
        if(b.age<1.05/pace)return false;
        b.load=harvest(target.x,target.z,buddyCapacity(b,i),i>=2?1.34:.80,true);
        cutPoints.delete(b);
        change(b,b.load?'deliver':'seek');
        return b.load>0;
      }
      if(b.phase!=='seek'&&b.phase!=='blocked')change(b,'seek');
      const path=findRoute(b,blockedFoot,1.64);
      if(!path){change(b,'blocked');b.wait=1.6;return false;}
      if(b.phase==='blocked')b.phase='seek';
      if(walk(b,path,(1.65+i*.17)*pace,dt,blockedFoot)){
        cutPoints.set(b,path.value);change(b,'scoop');
      }
      return false;
    }
    function driver(d,s,dt){
      const b=s.buddies[d.driver], pace=1+b.pace*.14, goal=destination(s);
      d.age+=dt;b.age+=dt;
      if(d.phase==='parked')return false;
      if(d.phase==='park'){
        if(d.age<.82)return false;
        d.seated=false;d.reclaim=false;
        change(d,'parked');
        return true;
      }
      if(d.reclaim){
        if(!d.seated){
          d.reclaim=false;
          change(d,'parked');
          return true;
        }
        const dx=Math.cos(d.yaw),dz=Math.sin(d.yaw);
        const exits=[[dx,dz],[-dx,-dz],[-dz,dx],[dz,-dx]]
          .map(([x,z])=>({x:d.x+x*1.47,z:d.z+z*1.47}));
        const exit=exits.find(p=>!blockedFoot(p.x,p.z))||exits[0];
        Object.assign(b,exit,{yaw:facing(exit,d),age:0});
        change(d,'park');
        return true;
      }
      if(d.wait>0){d.wait-=dt;return false;}
      if(!d.seated){
        if(b.load)return hauler(b,d.driver,dt,s);
        if(d.phase==='climb'){
          if(d.age>=1.05){d.seated=true;b.x=d.x;b.z=d.z;change(d,d.load?'unload':'drive');return true;}
          return false;
        }
        const route=plan(b,'cab',blockedFoot,(x,z)=>distance({x,z},d)<1.42);
        if(!route){d.wait=1.25;return false;}
        if(walk(b,route,1.85*pace,dt,blockedFoot)){
          b.yaw=facing(b,d);change(d,'climb');
        }
        return false;
      }
      if(d.phase==='tipped'){
        if(d.age<.52)return false;
        const sent=drop(d,s);
        change(d,d.load?'full':'drive');
        if(d.load)d.wait=.45;
        return !!sent;
      }
      if(d.phase==='unload'||d.phase==='full'){
        const path=plan(d,s.factory?'hopper':'truck',blockedDozer,(x,z)=>distance({x,z},goal)<(s.factory?2.72:2.9));
        if(!path){d.wait=1.5;return false;}
        if(walk(d,path,dozer.speed*.75*pace,dt,blockedDozer)){
          const heading=facing(d,goal);
          d.yaw=turn(d.yaw,heading,dt*2.55);
          if(Math.cos(d.yaw-heading)>.92)change(d,'tipped');
        }
        return false;
      }
      const limit=Math.min(dozer.cap,3_100_000+b.handling*1_950_000);
      const reach=3.07;
      if(d.phase==='cut'){
        const target=cutPoints.get(d)||findCut(d.x,d.z,reach);
        if(!target){change(d,d.load?'unload':'drive');return false;}
        const heading=facing(d,target);
        d.yaw=turn(d.yaw,heading,dt*2.55);
        if(Math.cos(d.yaw-heading)<.95)return false;
        const distanceToRock=distance(d,target);
        if(distanceToRock>1.55){
          const step=.8*dt,x=d.x+Math.sin(d.yaw)*step,z=d.z-Math.cos(d.yaw)*step;
          if(!blockedDozer(x,z)){d.x=x;d.z=z;d.spin=(d.spin+step/.32)%R.TAU;}
        }
        if(d.age<.46/pace)return false;
        const n=harvest(target.x,target.z,Math.min(limit-d.load,850000+b.handling*260000),1.34,true);
        d.load+=n;
        cutPoints.delete(d);
        change(d,d.load>=limit||!n&&d.load?'unload':'drive');
        return n>0;
      }
      const path=findRoute(d,blockedDozer,reach);
      if(!path){
        if(d.load){change(d,'unload');return false;}
        d.wait=1.4;return false;
      }
      if(walk(d,path,dozer.speed*.70*pace,dt,blockedDozer,true)){
        cutPoints.set(d,path.value);change(d,'cut');
      }
      return false;
    }
    function tick(dt){
      const s=getState(),d=s.crewDozer;
      let changed=false;
      for(const [i,b] of s.buddies.entries()){
        if(d?.driver===i)continue;
        const moved=hauler(b,i,dt,s);
        changed=changed||moved;
      }
      if(d)changed=driver(d,s,dt)||changed;
      if(changed)refresh();
    }
    function parts(viewer){
      const s=getState(),out=[],d=s.crewDozer;
      if(d){
        out.push(...M.machinery(DOZER,R.worldPose(d.x,surface.height(d.x,d.z),d.z,d.yaw),{
          spin:d.spin,fill:d.load/dozer.cap,blade:d.phase==='cut'||d.phase==='unload',
          dump:d.phase==='tipped'?Math.sin(Math.PI*R.clamp(d.age/.52,0,1)):0
        }));
      }
      for(const [i,b] of s.buddies.entries()){
        const isDriver=d?.driver===i;
        let x=b.x,z=b.z,y=surface.height(x,z),yaw=b.yaw,time=b.age;
        let clip=b.phase==='scoop'?'scoop':b.phase==='seek'||b.phase==='deliver'?(b.training||b.phase==='deliver'?'push':'walk'):'stand';
        if(isDriver){
          clip=d.phase==='board'?(b.load?'push':'walk'):'stand';
          const [dx,dz]=[Math.sin(d.yaw),-Math.cos(d.yaw)];
          const seat={x:d.x-dx*.32,z:d.z-dz*.32,y:surface.height(d.x,d.z)+.84};
          if(d.phase==='climb'||d.phase==='park'){
            clip='climb';
            const u=d.phase==='climb'?R.clamp(d.age/1.05,0,1):1-R.clamp(d.age/.82,0,1);
            time=u*1.05;
            x=R.mix(b.x,seat.x,u);z=R.mix(b.z,seat.z,u);
            y=R.mix(y,seat.y,u);
            const angle=Math.atan2(Math.sin(d.yaw-b.yaw),Math.cos(d.yaw-b.yaw));
            yaw=b.yaw+angle*R.clamp((u-.44)*2,0,1);
          }else if(d.seated){
            clip='drive';({x,y,z}=seat);yaw=d.yaw;
          }
        }
        if(distance({x,z},viewer)>22)continue;
        const pose=R.worldPose(x,y,z,yaw);
        if(!isDriver||d.phase==='board'&&b.load){
          if(b.training){
            const [dx,dz]=[Math.sin(yaw),-Math.cos(yaw)];
            const parked=clip==='scoop';
            const bx=x+dx*(parked?.82:.40),bz=z+dz*(parked?.82:.40);
            const barrow=R.worldPose(bx,surface.height(bx,bz),bz,yaw);
            out.push(...M.barrow(b.training>=2?7:5,barrow,b.age*2.8,b.load/buddyCapacity(b,i)));
          }else{
            out.push({item:bucket,m:pose});
            if(b.load)out.push({item:bucketRocks,m:pose});
          }
          if(clip==='scoop'){
            const dip=Math.sin(Math.PI*(b.age%.96)/.96)**2;
            out.push({item:shovel,m:R.compose(pose,R.transform(.12,.92-dip*.40,.40+dip*.10,.40+dip*.36,0,.07))});
          }
        }
        out.push(actors[i].part(clip,time,pose));
      }
      return out;
    }
    return {tick,parts};
  }
  return {DOZER,training,rankNames,price,newHire,restore,totalLoad,status,create};
})();
