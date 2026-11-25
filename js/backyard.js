'use strict';

Rocks.backyard = (() => {
  const {build,mesh,box,rod,cylinder,stone,transform,mix,clamp,palette}=Rocks.render;
  const carriers=[
    {name:'In your hand',cap:1,cost:0,detail:'Deliver one rock at a time.'},
    {name:'Pockets',cap:5,cost:1,detail:'Make use of cargo shorts.'},
    {name:'Bucket',cap:25,cost:20,detail:'A five-gallon bucket with a wire handle.'},
    {name:'Backpack',cap:110,cost:100,detail:'The zipper can probably take it.'},
    {name:'Wheelbarrow',cap:350,cost:620,rig:5,detail:'Push a full tray to the truck.'},
    {name:'Reinforced wheelbarrow',cap:1500,cost:2500,rig:7,detail:'A bigger tray and two wheels.'},
    {name:'Trash bin on wheels',cap:9500,cost:12500,rig:'bin',detail:'Tip it into the truck. The lid is optional.'}
  ];
  const toolIds=Rocks.models.tools.map((_,i)=>i).filter(i=>i!==5&&i!==7&&!Rocks.models.tools[i].tech);
  const training=[
    {name:'Gather speed',costs:[65,350,1800,9500,45000],detail:'Finish each hand-tool action sooner.'},
    {name:'Gather amount',costs:[110,620,3200,15000,75000],detail:'Fit more rocks into each grab, scoop or cycle.'},
    {name:'Run speed',costs:[40,280,1300,7500,30000],detail:'Move faster on foot, even when hauling a carrier.'}
  ];
  const buddies=[
    {name:'Eddie',cost:100,load:36,training:0,shirt:'647f9a',skin:'cc9473',hair:'493629',build:[.94,.99,1.04]},
    {name:'Marcus',cost:10000,load:950,training:1,shirt:'ae7254',skin:'996446',hair:'2e2520',build:[1.13,1.07,1]},
    {name:'Joey',cost:50_000_000,load:170000,training:2,shirt:'996b95',skin:'dab18f',hair:'925f32',build:[1.02,.95,1.03]},
    {name:'Dispatch',cost:500_000_000,load:2_500_000,training:3,shirt:'a58c46',skin:'a87458',hair:'433930',build:[1.18,1.04,.96]}
  ];
  const factory=[
    {name:'Conveyor line',cost:2_000_000,detail:'An outdoor hopper and powered belt route your loads into the truck.'},
    {name:'Powered collector',cost:10_000_000,detail:'Draws gravel from the pile into the conveyor.'},
    {name:'Industrial crusher',cost:35_000_000,detail:'Processes rough stone and triples conveyor throughput.'}
  ];
  const hopper={x:2.89,z:-6.25};
  const beltEnd={x:9.6,z:-5.23};
  const intake={x:1.58,z:-6.12};
  const output={x:10.8,z:-5.0};
  const defaultPickup={x:.55,z:-5.48}, pickupRadius=3.55, intakeTether=11;
  const BUFFER_MAX=24_000_000;
  const fresh=()=>({
    carry:0,carryOwned:[0],training:[0,0,0],buddies:[],
    factory:0,buffer:0,factoryTick:0,
    phone:{time:0,nextText:300,nextCall:1800,nextNag:0,textIndex:0,callIndex:0,notify:0,ring:false,active:false,callAge:0,unread:false,chat:[]}
  });
  const int=(n,max)=>Number.isFinite(n)?clamp(Math.floor(n),0,max):0;
  const elapsed=(n,max)=>Number.isFinite(n)?clamp(n,0,max):0;
  function restore(s,raw){
    const initial=fresh(), p=raw.phone;
    s.carryOwned=[...new Set([0,...(Array.isArray(raw.carryOwned)?raw.carryOwned.filter(i=>Number.isInteger(i)&&i>0&&i<carriers.length):[])])].sort((a,b)=>a-b);
    for(const [tier,carry] of [[5,4],[7,5]]){
      if(s.owned.includes(tier))for(let i=1;i<=carry;i++)if(!s.carryOwned.includes(i))s.carryOwned.push(i);
      if(s.tier===tier){s.tier=tier===5?4:6;s.carry=carry;}
    }
    s.owned=s.owned.filter(i=>toolIds.includes(i)||Rocks.models.tools[i]?.tech);
    if(!s.owned.includes(s.tier))s.owned.push(s.tier);
    if(s.carryOwned.includes(raw.carry))s.carry=raw.carry;
    s.training=training.map((v,i)=>int(raw.training?.[i],v.costs.length));
    s.factory=int(raw.factory,factory.length);
    s.buffer=s.factory?int(raw.buffer,Math.min(BUFFER_MAX,Rocks.yard.TOTAL-s.removed)):0;
    s.factoryTick=elapsed(raw.factoryTick,4);
    if(p&&Number.isFinite(p.time)){
      s.phone={...initial.phone,
        time:elapsed(p.time,1e9),nextText:int(p.nextText,1e9)||300,nextCall:int(p.nextCall,1e9)||1800,
        nextNag:elapsed(p.nextNag,1e9),textIndex:int(p.textIndex,1e9),callIndex:int(p.callIndex,1e9),notify:int(p.notify,1e9),
        unread:!!p.unread,ring:!!(p.ring||p.active),active:false,callAge:0,
        chat:Array.isArray(p.chat)?p.chat.slice(-24).filter(m=>Array.isArray(m)&&m.length===2&&
          ['wife','me','log'].includes(m[0])&&typeof m[1]==='string').map(([a,b])=>[a,b.slice(0,300)]):[]
      };
    }
    const t=Rocks.models.tools[s.tier];
    const oldBag=int(raw.bag,Rocks.yard.TOTAL-s.removed-s.buffer);
    if(!(raw.version>=4)&&!t.eye && carriers[s.carry].cap<oldBag){
      const suitable=carriers.findIndex(c=>c.cap>=oldBag);
      s.carry=suitable===-1?carriers.length-1:suitable;
      for(let i=0;i<=s.carry;i++)if(!s.carryOwned.includes(i))s.carryOwned.push(i);
    }
    s.bag=Math.min(oldBag,t.eye?t.cap:carriers[s.carry].cap);
  }
  function capacity(s){
    const t=Rocks.models.tools[s.tier];
    return t.eye?t.cap:carriers[s.carry].cap;
  }
  function rate(s,t){return t.eye?t.hit:t.hit+Math.max(1,Math.round(t.hit*.32))*s.training[1];}
  function speed(s,t){return t.eye?1:1+s.training[0]*.19;}
  function prevTool(i){return toolIds[toolIds.indexOf(i)-1];}

  const texts=[
    'Are you almost done? How long is this going to take?',
    'Can you please remember to bring eggs, milk, bread, celery, and a collagen night wrapping mask on your way home?',
    'When you get home you’re cleaning the kitchen. I’m not your maid.',
    'Larry says you’re doing great. How many rocks is “great,” exactly?',
    'Don’t bring your shoes inside when you get home.',
    'Can you get the eggs with the blue label? The other blue label.',
    'Did Larry at least offer you a water?',
    'Since you’re already out, can you stop for one more thing?',
    'Do we have plans tonight? I told my mom we had plans tonight.',
    'If you buy that man an excavator I’m putting it on Facebook Marketplace.'
  ];
  const nags=['Hello…?','??','I know you have your phone.','Can you at least say you saw this?','Never mind. Call me.'];
  const calls=[
    'Hey. I thought this was going to take like an hour.',
    'The grocery list changed. I’ll text it to you. Please actually read it this time.',
    'Is that a machine I can hear? Please tell me you borrowed it.',
    'Can you hear me? Hang on, I’m looking for my keys.',
    'You sound busy. Anyway, my mom says hi.'
  ];
  function record(p,who,message){
    p.chat.push([who,message]);
    if(p.chat.length>24)p.chat.shift();
  }
  function timetable(p,dt){
    p.time+=dt;
    let activity=null;
    if(p.time>=p.nextText){
      p.nextText+=300;
      record(p,'wife',texts[p.textIndex++%texts.length]);
      p.unread=true;
      p.nextNag=p.nextNag>p.time?Math.min(p.nextNag,p.time+32):p.time+32;
      activity='text';
    }
    if(p.time>=p.nextCall){
      p.nextCall+=1800;
      p.ring=true;
      p.active=false;
      p.callAge=0;
      p.nextNag=p.time+18;
      activity='call';
    }
    if(p.active){
      p.callAge+=dt;
      if(p.callAge>=21){
        p.active=false;
        p.nextNag=p.unread?p.time+32:0;
        record(p,'log','Call ended');
        activity=activity||'ended';
      }
    }
    if(!p.active&&(p.unread||p.ring)&&p.nextNag>0&&p.time>=p.nextNag){
      record(p,'wife',p.ring?'Why didn’t you answer?':nags[p.notify%nags.length]);
      p.notify++;
      p.unread=true;
      p.nextNag=p.time+Math.max(11,32-p.notify*4);
      return p.ring?'call':'text';
    }
    return activity;
  }
  const part=draw=>mesh(build(draw));
  function blocksFactory(x,z,radius,level){
    if(!level)return false;
    const u=clamp((x-hopper.x)/(beltEnd.x-hopper.x),0,1);
    const centreZ=mix(hopper.z,beltEnd.z,u);
    if(x>hopper.x-.44-radius&&x<beltEnd.x+.47+radius&&Math.abs(z-centreZ)<.39+radius)return true;
    return level>=2&&Math.abs(x-intake.x)<.70+radius&&Math.abs(z-intake.z)<.59+radius;
  }
  const belt=part(()=>{
    for(let i=0;i<9;i++){
      const x=mix(hopper.x,beltEnd.x,(i+.5)/9),z=mix(hopper.z,beltEnd.z,(i+.5)/9),h=.66+i*.066;
      box(x,h,z,.82,.105,.68,'313936');
      for(const side of [-1,1]){
        box(x,h+.114,z+side*.354,.83,.145,.076,'826747');
        box(x,h*.47,z+side*.26,.066,h*.94,.065,'545950');
      }
      cylinder(x-.41,h,z,.062,.68,'a6aca0','z',8);
    }
    box(hopper.x,.84,hopper.z,.89,.30,1.02,'a27b47');
    for(const side of [-1,1])box(hopper.x,.99,hopper.z+side*.57,1.21,.38,.125,'bb9a60');
    box(beltEnd.x+.51,1.45,beltEnd.z,1.03,.12,.69,'9a865a');
  });
  const speedDrive=part(()=>{
    const x=hopper.x+.85,z=hopper.z+.39;
    box(x,.62,z,.80,.43,.40,'435752');
    box(x,.85,z,.68,.22,.37,'698777');
    for(let i=0;i<4;i++)box(x-.23+i*.15,.89,z+.192,.070,.062,.014,'88e6b1');
    rod([x+.37,.60,z],[x+.68,.74,z-.36],.043,'849285',7);
  });
  const collector=part(()=>{
    box(intake.x,.37,intake.z,1.50,.61,1.29,'5e7465');
    box(intake.x,.74,intake.z,.92,.58,1.14,'969763');
    for(let i=0;i<6;i++)box(intake.x-.39,.72,intake.z-.40+i*.16,.04,.23,.061,'383f34');
    rod([intake.x-.14,.84,intake.z],[intake.x-1.02,.37,intake.z-.29],.23,'606956',10,.33);
    rod([intake.x+.43,.84,intake.z],[hopper.x,.98,hopper.z],.14,'9aa397',9);
    box(intake.x,.47,intake.z+.66,1.29,.12,.12,'d3b37b');
  });
  const crusher=part(()=>{
    const x=4.05,z=-6.09;
    for(const side of [-1,1]){
      rod([x-.66,.07,z+side*.51],[x+.47,1.67,z+side*.48],.059,'636254',7);
      rod([x+.66,.07,z+side*.51],[x-.47,1.67,z+side*.48],.059,'636254',7);
    }
    box(x,1.58,z,1.12,1.01,1.16,'a76a44');
    for(let i=0;i<5;i++)box(x-.45+i*.225,1.55,z+.59,.08,.78,.039,'794e3b');
    for(const side of [-1,1])box(x,2.12,z+side*.44,1.46,.40,.16,'be8a57');
    cylinder(x-.58,1.63,z,.20,.17,'777c72','x');
  });
  const travelling=part(()=>stone({x:0,y:0,z:0,size:.14,seed:2.63,mat:palette[1]}));
  const nozzle=part(()=>{
    box(0,.15,0,.56,.26,.40,'515d55');
    box(0,.092,.16,.52,.09,.15,'a7a47c');
    cylinder(0,.238,-.14,.094,.15,'667167','z',8);
  });
  const hose={};let hoseKey='';
  function factoryParts(s,surface,fast=false){
    if(!s.factory)return [];
    const out=[{item:belt}];
    if(fast)out.push({item:speedDrive});
    if(s.factory>=2){
      const point=s.intakeFocus||defaultPickup;
      const y=surface.height(point.x,point.z), key=[point.x,point.z,Math.round(y*10)].join('/');
      if(key!==hoseKey){
        hoseKey=key;
        Rocks.render.setMesh(hose,build(()=>{
          const middle=[mix(intake.x,point.x,.57),.38+y*.48,mix(intake.z,point.z,.57)];
          rod([intake.x-.45,.57,intake.z],middle,.094,'48544c',8);
          rod(middle,[point.x,y+.16,point.z],.094,'48544c',8);
        }));
      }
      out.push({item:collector},{item:hose},{item:nozzle,m:transform(point.x,y,point.z,0,Math.atan2(intake.x-point.x,intake.z-point.z))});
    }
    if(s.factory>=3)out.push({item:crusher});
    if(s.buffer) for(let i=0;i<12;i++){
      const p=(i/12+s.phone.time*(fast?.89:.43))%1;
      out.push({item:travelling,m:transform(mix(hopper.x,output.x,p),mix(.87,1.54,p),
        mix(hopper.z,output.z,p)+(i%3-1)*.16,0,p*3,0,.73+i%4*.13)});
    }
    return out;
  }
  return {carriers,toolIds,training,buddies,factory,hopper,intake,defaultPickup,pickupRadius,intakeTether,BUFFER_MAX,fresh,restore,capacity,rate,speed,prevTool,
    timetable,record,calls,factoryParts,blocksFactory};
})();
