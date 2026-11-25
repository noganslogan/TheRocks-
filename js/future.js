'use strict';

Rocks.future = (() => {
  const R=Rocks.render, Y=Rocks.yard, B=Rocks.backyard;
  const {TAU,build,mesh,box,rod,cylinder,stone,transform,mix,clamp,palette}=R;
  const LASER=16, MATTER=17, ORBITAL=18;
  const rates={laser:2_600_000,matter:2_000_000,gantry:6_000_000,orbital:12_000_000};
  const beltBatch=14_000_000;
  const modes=['Biggest pile','Cleanup','Paused'];
  const upgrades=[
    {name:'Laser Excavator',cost:25_000_000,tier:LASER,detail:'2.6M rocks/sec into the hopper',desc:'Slice slabs off the pile. Includes the high-speed conveyor.'},
    {name:'Matter Disintegrator',cost:60_000_000,tier:MATTER,detail:'2M rocks/sec directly to credits',desc:'Hold the beam on gravel or boulders to vaporize them.'},
    {name:'Gravity Sweep Drones',cost:35_000_000,key:'drones',detail:'Consolidate scattered rocks',desc:'Three drones move loose pockets onto the sweep pad near the front of the pile.'},
    {name:'Autonomous Laser Gantry',cost:110_000_000,key:'gantry',detail:'6M rocks/sec and automatic cleanup',desc:'Runs in the background. Switch between Biggest pile, Cleanup, and Paused.'},
    {name:'Orbital Yard Service',cost:150_000_000,tier:ORBITAL,detail:'12M rocks/sec inside the marked section',desc:'Ask Larry to sign the permit, then mark a section from anywhere in the yard.'}
  ];
  const sweep={x:.06,z:.91}, radius=1.65, orbitalRadius=5.25, interval=.25;
  const fresh=()=>({drones:false,gantry:false,mode:0,permit:false,mark:null});
  function restore(s,raw){
    const t=raw.tech;
    if(!t||typeof t!=='object')return;
    s.tech.drones=t.drones===true;
    s.tech.gantry=t.gantry===true;
    s.tech.mode=Number.isInteger(t.mode)&&t.mode>=0&&t.mode<modes.length?t.mode:0;
    s.tech.permit=s.owned.includes(ORBITAL)&&t.permit===true;
    if(s.tech.permit&&Number.isFinite(t.mark?.x)&&Number.isFinite(t.mark?.z)&&
      Math.abs(t.mark.x-Y.pile.x)<=Y.pile.rx&&Math.abs(t.mark.z-Y.pile.z)<=Y.pile.rz){
      s.tech.mark={x:t.mark.x,z:t.mark.z};
    }
  }

  const part=fn=>mesh(build(fn));
  const tools3d={
    laser:part(()=>{
      box(.23,-.26,.63,.24,.23,.49,'354945');
      box(.23,-.331,.68,.32,.092,.55,'73827a');
      box(.226,-.227,.903,.29,.17,.18,'546c67');
      cylinder(.23,-.238,1.04,.1,.18,'323b3a','z',12);
      cylinder(.23,-.238,1.142,.074,.032,'64e2b6','z',12);
      for(let i=0;i<5;i++)box(.36,-.214,.53+i*.073,.023,.032,.039,'9ef2c6');
      box(.25,-.425,.544,.095,.135,.132,'2b3230');
      rod([.43,-.51,.28],[.259,-.397,.53],.055,'bc8469');
      rod([-.24,-.50,.34],[.063,-.30,.73],.061,'ad866c');
      box(.086,-.316,.76,.096,.072,.144,'ca9b7f');
    }),
    matter:part(()=>{
      box(.211,-.274,.58,.27,.20,.42,'31394b');
      for(const side of [-1,1]){
        rod([.21+side*.109,-.26,.68],[.21+side*.112,-.235,1.075],.043,'796c9e',8,.021);
        rod([.21+side*.136,-.224,.712],[.21+side*.137,-.222,1.02],.012,'dbc1ff',6);
      }
      cylinder(.21,-.238,.91,.061,.33,'5e4d8f','z',10);
      cylinder(.21,-.238,1.091,.077,.041,'d6bcff','z',12);
      box(.26,-.41,.54,.106,.14,.138,'4e4760');
      rod([.43,-.49,.24],[.285,-.40,.508],.055,'b6866c');
      box(.27,-.402,.566,.099,.073,.143,'c39274');
      rod([-.19,-.50,.28],[.048,-.327,.71],.058,'a68473');
      box(.069,-.311,.734,.102,.075,.136,'cca084');
    }),
    orbital:part(()=>{
      box(.187,-.319,.67,.311,.201,.125,'2b383f');
      box(.187,-.312,.595,.269,.145,.024,'b76e52');
      for(let i=0;i<4;i++)box(.108+i*.055,-.298,.579,.031,.036,.015,i===2?'fbad70':'794d43');
      rod([.301,-.283,.690],[.34,-.122,.714],.022,'58665d',7,.014);
      rod([.48,-.50,.31],[.25,-.389,.596],.056,'b78970');
      box(.318,-.336,.602,.083,.099,.131,'ca9c7f');
    })
  };
  const gantryRail=part(()=>{
    const z=-2.55, left=-12.45, right=3.82, top=6.85;
    for(const x of [left,right]){
      box(x,.14,z,1.36,.28,1.55,'777b66');
      for(const side of [-1,1]){
        rod([x,.24,z+side*.63],[x,top,z+side*.23],.156,'626a70',8);
        rod([x,.50,z+side*.60],[x,1.38,z-side*.42],.064,'a49a6f',7);
      }
      box(x,top-.13,z,.84,.37,.95,'776962');
      for(let i=1;i<6;i++){
        box(x,i*1.09,z,.27,.07,.73,'8d8f84');
      }
    }
    for(const side of [-1,1]){
      box((left+right)*.5,top,z+.29*side,right-left,.19,.11,'5d6373');
      box((left+right)*.5,top-.30,z+.28*side,right-left,.11,.08,'8f829c');
    }
    for(let i=0;i<13;i++){
      const x=mix(left,right,i/12);
      rod([x,top-.30,z-.29],[x,top+.06,z+.29],.036,'aea5a4',6);
    }
  });
  const trolley=part(()=>{
    box(0,.07,0,.84,.26,.72,'514168');
    for(const side of [-1,1]){
      cylinder(side*.26,.18,0,.11,.67,'303b42','z',9);
      box(side*.328,-.04,0,.09,.10,.52,'b59dc6');
    }
    cylinder(0,-.11,0,.224,.22,'625568','y',10);
    cylinder(0,-.246,0,.116,.072,'c999fb','y',12);
  });
  const drone=part(()=>{
    cylinder(0,0,0,.225,.113,'594f74','y',8);
    cylinder(0,-.071,0,.137,.079,'a8e4c5','y',10);
    for(const side of [-1,1]){
      rod([side*.11,0,0],[side*.44,.035,0],.036,'59616f',6);
      cylinder(side*.43,.053,0,.14,.044,'8e9c9b','y',8);
      cylinder(side*.43,.087,0,.097,.019,'4b5453','y',8);
    }
    box(0,-.015,.203,.19,.054,.046,'d7e8b0');
  });
  const sweepRing=part(()=>{
    for(let i=0;i<24;i++){
      if(i%3===2)continue;
      const a=i*TAU/24,b=(i+.74)*TAU/24;
      rod([Math.cos(a),0,Math.sin(a)],[Math.cos(b),0,Math.sin(b)],.011,'5d9680',5);
    }
  });
  const colours={laser:'8df6bd',matter:'dba8ff',gantry:'a0dcfd',orbital:'ffb27b',drone:'9ee6c6'};
  const tubes={}, flares={};
  for(const [key,colour] of Object.entries(colours)){
    tubes[key]=part(()=>cylinder(0,0,.5,1,1,colour,'z',9));
    flares[key]=part(()=>{
      cylinder(0,0,0,1,.052,colour,'y',16);
      for(let i=0;i<6;i++){
        const a=i*TAU/6;
        rod([Math.cos(a)*.42,.03,Math.sin(a)*.42],[Math.cos(a)*1.48,.31,Math.sin(a)*1.48],.047,colour,5,.008);
      }
    });
  }
  const chip=part(()=>stone({x:0,y:0,z:0,size:.12,seed:1.27,mat:palette[2]}));
  const areaBeacon=part(()=>{
    cylinder(0,0,0,.15,.028,'cd8559','y',10);
    cylinder(0,.015,0,.055,.085,'efbc82','y',8);
  });
  function beam(a,b,size,kind){
    const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z, len=Math.hypot(x,y,z);
    if(len<.01)return null;
    const nx=x/len,ny=y/len,nz=z/len, h=Math.hypot(nx,nz);
    const sx=h>.001?nz/h:1,sz=h>.001?-nx/h:0;
    // Map the unit tube's longitudinal axis onto the segment while preserving thickness.
    return {item:tubes[kind],m:[
      sx*size,ny*sz*size,x,a.x,
      0,(nz*sx-nx*sz)*size,y,a.y,
      sz*size,-ny*sx*size,z,a.z
    ]};
  }
  function viewModel(mode,walk,firing){
    return [{item:tools3d[mode],m:transform(0,Math.sin(walk)*.010+(firing?-.015:0),0,firing?-.035:0)}];
  }
  const sqDist=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
  function create({getState,surface,left,harvest,feed,deposit,refresh,say}){
    let timer=0, hand=null, handAge=10, gantryHit=null, orbitalHit=null, droneTrip=null;
    let trolleyX=Y.pile.x, elapsed=0;
    function clear(){
      timer=0; elapsed=0; handAge=10;
      hand=gantryHit=orbitalHit=droneTrip=null;
      trolleyX=Y.pile.x;
    }
    function points(){
      const s=getState(), result=[];
      for(const cell of Y.cells){
        const amount=surface.available(cell.id);
        if(amount)result.push({...cell,amount});
      }
      for(const rock of surface.geology){
        const amount=s.rubble[rock.id];
        if(amount)result.push({x:rock.x,z:rock.z,rubble:rock.id,amount});
      }
      return result;
    }
    function aim(player,range=29){
      if(!left())return null;
      const forward={x:Math.sin(player.yaw)*Math.cos(player.pitch),y:Math.sin(player.pitch),z:-Math.cos(player.yaw)*Math.cos(player.pitch)};
      const eye=1.58+surface.height(player.x,player.z);
      for(let d=.65;d<=range;d+=.24){
        const x=player.x+d*forward.x,z=player.z+d*forward.z,y=eye+d*forward.y;
        if(y<-.16)break;
        const h=surface.height(x,z);
        if(y<=h+.11&&h>.023&&surface.available(Y.index(x,z)))return {x,z};
      }
      let best=null, odds=0;
      for(const p of points()){
        const dx=p.x-player.x,dz=p.z-player.z,dy=Math.max(.12,surface.height(p.x,p.z))+.09-eye;
        const d=Math.hypot(dx,dy,dz),dot=dx*forward.x+dy*forward.y+dz*forward.z;
        if(d<.1||d>range||dot<.30)continue;
        const cosine=dot/d;
        if(cosine>.978){
          const score=cosine-(d/range)*.012;
          if(score>odds){odds=score;best=p;}
        }
      }
      return best;
    }
    function scan(mode,mark=null){
      const candidates=points();
      let best=null, score=-Infinity;
      for(const p of candidates){
        if(mark&&sqDist(p,mark)>orbitalRadius**2)continue;
        const weight=mode===1?-p.amount:mark?-sqDist(p,mark):p.amount;
        if(weight>score){score=weight;best=p;}
      }
      return best;
    }
    function harvestBeam(point,amount,radius){
      const n=harvest(point.x,point.z,amount,radius,true);
      if(n){
        const s=getState();
        for(const rock of surface.geology){
          if(sqDist(rock,point)<radius**2&&surface.exposed(rock))s.hits[rock.id]=rock.req;
        }
        surface.changed();
      }
      return n;
    }
    function automatic(kind,budget,mode,mark){
      let last=null, n=0;
      for(let attempt=0;attempt<16&&budget>0;attempt++){
        const target=scan(mode,mark);
        if(!target)break;
        if(!last)last={x:target.x,z:target.z,y:surface.height(target.x,target.z)+.13,at:elapsed};
        const removed=harvestBeam(target,budget,kind==='orbital'?2.15:1.55);
        if(!removed)break;
        deposit(removed);
        n+=removed;budget-=removed;
      }
      return {last,n};
    }
    function drones(){
      const s=getState();
      const destinations=Y.cells.filter(c=>c.capacity&&sqDist(c,sweep)<=radius**2&&s.depleted[c.id]>0)
        .sort((a,b)=>sqDist(a,sweep)-sqDist(b,sweep));
      if(!destinations.length)return false;
      const sources=points().filter(p=>sqDist(p,sweep)>(radius+.28)**2)
        .sort((a,b)=>a.amount-b.amount);
      let moved=0, destination=0, source=0;
      const limit=700000;
      while(source<sources.length&&destination<destinations.length&&moved<limit){
        const from=sources[source], to=destinations[destination];
        const n=surface.moveStock(from,to,limit-moved);
        if(n>0&&!moved)droneTrip={from,to,at:elapsed};
        moved+=n;
        if(!s.depleted[to.id])destination++;
        if(from.id===undefined?!s.rubble[from.rubble]:!surface.available(from.id))source++;
        if(!n)break;
      }
      return moved>0;
    }
    function tick(dt,player,mode,firing){
      const s=getState();
      elapsed+=dt; handAge+=dt;
      if(!firing)hand=null;
      if(s.tech.gantry&&s.tech.mode!==2&&gantryHit){
        trolleyX=mix(trolleyX,gantryHit.x,Math.min(1,dt*4.8));
      }
      if(!s.tech.gantry&&!s.tech.drones&&!s.tech.mark&&!(mode&&firing)){
        timer=0;return;
      }
      timer+=dt;
      if(timer<interval-1e-7)return;
      timer=Math.max(0,timer-interval);
      let changed=false;
      if(firing&&(mode==='laser'||mode==='matter')){
        const target=aim(player);
        if(target){
          let cap=Math.floor(rates[mode]*interval);
          if(mode==='laser')cap=Math.min(cap,B.BUFFER_MAX-s.buffer);
          const hitY=surface.height(target.x,target.z)+.10;
          const n=cap>0?harvestBeam(target,cap,mode==='laser'?2.10:1.48):0;
          if(n){
            if(mode==='laser'){
              feed(n);
              surface.puff(target.x,target.z,n,[1,-.2]);
            }else deposit(n);
            hand={x:target.x,y:hitY,z:target.z,mode};handAge=0;changed=true;
          }
        }
      }
      if(s.tech.gantry&&s.tech.mode!==2&&left()){
        const result=automatic('gantry',rates.gantry*interval,s.tech.mode,null);
        gantryHit=result.last;
        changed=changed||result.n>0;
      }else gantryHit=null;
      if(s.tech.mark){
        const result=automatic('orbital',rates.orbital*interval,0,s.tech.mark);
        orbitalHit=result.last;
        if(result.n)changed=true;
        if(!result.n||!left()){
          s.tech.mark=null;
          changed=true;
          if(left())say('Orbital pass complete. Mark another section.');
        }
      }
      if(s.tech.drones&&left())changed=drones()||changed;
      if(changed)refresh();
    }
    function emitFrom(camera){
      const {x,y,z,pitch:p,yaw}=camera;
      const a=Math.sin(yaw), b=Math.cos(yaw), c=Math.sin(p), d=Math.cos(p);
      return {x:x+.22*b+1.08*a*d+.222*a*c,y:y+1.08*c-.222*d,z:z+.22*a-1.08*b*d-.222*b*c};
    }
    function parts(camera){
      const s=getState(), out=[];
      const segment=(a,b,w,kind)=>{
        const piece=beam(a,b,w,kind);
        if(piece)out.push(piece);
      };
      const impact=(point,kind,w)=>{
        const at=Math.max(point.y,surface.height(point.x,point.z)+.035);
        out.push({item:flares[kind],m:transform(point.x,at,point.z,0,elapsed*8,0,w)});
      };
      if(hand&&handAge<.32){
        segment(emitFrom(camera),hand,hand.mode==='laser'?.040:.054,hand.mode);
        impact(hand,hand.mode,.26+Math.sin(elapsed*35)**2*.15);
        if(hand.mode==='laser')for(let i=0;i<6;i++){
          const u=(i/6+elapsed*.90)%1;
          const y=mix(hand.y,1.18,u)+Math.sin(u*Math.PI)*1.37;
          out.push({item:chip,m:transform(mix(hand.x,B.hopper.x,u),y,mix(hand.z,B.hopper.z,u),u*4,elapsed*4,0,.9+i*.05)});
        }
      }
      if(s.tech.gantry){
        out.push({item:gantryRail},{item:trolley,m:transform(trolleyX,6.54,-2.55)});
        if(gantryHit&&s.tech.mode!==2&&elapsed-gantryHit.at<.35){
          segment({x:trolleyX,y:6.29,z:-2.55},gantryHit,.065,'gantry');
          impact(gantryHit,'gantry',.37);
        }
      }
      if(orbitalHit&&elapsed-orbitalHit.at<.37){
        segment({x:orbitalHit.x-.9,y:26,z:orbitalHit.z+2.8},orbitalHit,.29,'orbital');
        impact(orbitalHit,'orbital',.82);
      }
      if(s.tech.mark){
        const {x,z}=s.tech.mark;
        out.push({item:sweepRing,m:transform(x,surface.height(x,z)+.07,z,0,elapsed*.32,0,.95)});
        for(let i=0;i<12;i++){
          const angle=i*TAU/12, X=x+Math.cos(angle)*orbitalRadius,Z=z+Math.sin(angle)*orbitalRadius;
          if(X>=-14.1&&X<=14.1&&Z>=-11.7&&Z<=7.6)out.push({item:areaBeacon,m:transform(X,surface.height(X,Z)+.035,Z)});
        }
      }
      if(s.tech.drones){
        out.push({item:sweepRing,m:transform(sweep.x,surface.height(sweep.x,sweep.z)+.08,sweep.z,0,0,0,radius)});
        for(let i=0;i<3;i++){
          const phase=(elapsed*.41+i/3)%1, a=TAU*phase;
          let x=sweep.x+Math.cos(a)*(1.29+i*.24),z=sweep.z+Math.sin(a)*(1.29+i*.24);
          const active=droneTrip&&elapsed-droneTrip.at<2.7;
          if(active){
            const t=.5+.5*Math.cos(a);
            x=mix(droneTrip.from.x,droneTrip.to.x,t)+Math.cos(a)*.52;
            z=mix(droneTrip.from.z,droneTrip.to.z,t)+Math.sin(a)*.45;
          }
          const ground=surface.height(x,z), y=ground+1.45+Math.sin(a*2)*.19;
          out.push({item:drone,m:transform(x,y,z,.10,Math.PI-a,Math.sin(a)*.13,.86)});
          if(active){
            segment({x,y:y-.08,z},{x,y:ground+.07,z},.029,'drone');
            out.push({item:chip,m:transform(x,y-.33+Math.sin(elapsed*9)*.08,z,a,0,0,.7)});
          }
        }
      }
      return out;
    }
    return {tick,aim,parts,clear};
  }
  return {upgrades,LASER,MATTER,ORBITAL,beltBatch,modes,rates,fresh,restore,create,viewModel};
})();
