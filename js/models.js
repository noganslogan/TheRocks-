'use strict';

Rocks.models = (() => {
  const R=Rocks.render;
  const {box,quad,tri,rod,cylinder,stone,build,mesh,join,transform,compose,clamp,mix,palette,random,TAU}=R;
  const tools=[
    {n:'Bare hands', cost:0, cap:1, hit:1, mode:'hand', cycle:.33, impact:.14, desc:'Pick up one rock at a time.'},
    {n:'Plastic cup', cost:3, cap:6, hit:6, mode:'cup', cycle:.43, impact:.19, desc:'Scoop loose gravel.'},
    {n:'Children’s shovel', cost:18, cap:18, hit:18, mode:'shovel', cycle:.52, impact:.23, desc:'A full load in a single scoop.'},
    {n:'Garden shovel', cost:85, cap:55, hit:32, mode:'shovel', cycle:.58, impact:.24, power:1, desc:'Pry up large stones.'},
    {n:'Pickaxe', cost:260, cap:120, hit:40, mode:'pick', cycle:.65, impact:.30, power:1, boulder:true, desc:'Chip apart large stones and boulders.'},
    {n:'Wheelbarrow', cost:620, cap:350, hit:115, mode:'barrow', cycle:.54, impact:.29, desc:'Shovel gravel into the tray. Push it to the truck.'},
    {n:'Steel shovel', cost:1200, cap:450, hit:150, mode:'shovel', cycle:.51, impact:.22, power:2, desc:'A deep steel scoop. Pries up large stones.'},
    {n:'Reinforced wheelbarrow', cost:2500, cap:1500, hit:500, mode:'barrow', cycle:.53, impact:.26, desc:'Twin wheels and a larger loading tray.'},
    {n:'Sledgehammer', cost:5000, cap:2500, hit:750, mode:'hammer', cycle:.71, impact:.35, power:4, boulder:true, desc:'Shatter boulders into rubble, then collect it.'},
    {n:'Electric jackhammer', cost:12500, cap:6500, hit:1100, mode:'jack', cycle:.22, impact:.10, power:3, boulder:true, hold:true, desc:'Hold to drill apart hardened rock or loosen gravel.'},
    {n:'Powered gravel vacuum', cost:25000, cap:9000, hit:3000, mode:'vac', cycle:.20, impact:.08, hold:true, desc:'Hold to draw gravel and rubble into the hopper.'},
    {n:'Motorized dump cart', cost:50000, cap:10000, hit:5000, mode:'cart', cycle:.44, impact:.22, hold:true, eye:1.64, width:1.28, reach:1.43, speed:7, turn:2.32, desc:'Drive the cart. Run its front pickup and tip the load at the truck.'},
    {n:'Mini skid steer', cost:100000, cap:85000, hit:42500, mode:'skid', cycle:.63, impact:.32, power:4, boulder:true, eye:1.85, width:1.52, reach:1.73, speed:5.3, turn:2.55, desc:'Curl the bucket into the pile. Turns in place.'},
    {n:'Mini excavator', cost:250000, cap:400000, hit:200000, mode:'excavator', cycle:1.04, impact:.62, power:7, boulder:true, eye:2.02, width:1.6, reach:2.62, speed:3.6, turn:1.9, desc:'Reach into the pile and pull back a trench with the articulated arm.'},
    {n:'Industrial loader', cost:500000, cap:2200000, hit:1100000, mode:'loader', cycle:.86, impact:.45, power:9, boulder:true, eye:2.55, width:2.11, reach:2.30, speed:6.2, turn:1.55, desc:'Load a high-volume bucket and lift it toward the truck bed.'},
    {n:'Bulldozer', cost:1000000, cap:12000000, hit:1700000, mode:'dozer', cycle:.18, impact:.07, power:12, boulder:true, eye:2.15, width:2.10, reach:2.28, speed:5.2, turn:1.8, desc:'Lower the blade, drive forward into gravel, and push the load to the truck.'}
  ];
  const skin='c99573', lightSkin='d5a27e', sleeve='64715a';
  const steel='8a989b', edge='c0cbca', dark='343d3e', rubber='252c2a', gold='d3a44b';
  function hand(x,y,z,side=1,closed=true,arm=true){
    if(arm){
      rod([x+side*.17,y-.14,z-.40],[x+side*.032,y-.026,z-.075],.065,sleeve,7,.057);
      rod([x+side*.037,y-.03,z-.10],[x,y,z],.046,skin,7,.042);
    }
    box(x,y,z,.104,.071,.115,skin);
    for(let i=0;i<4;i++){
      const X=x+(i-1.5)*.025, len=.073+((i===1||i===2)? .018:0);
      rod([X,y+.003,z+.035],[X,y+.006,z+len],.013,lightSkin,5);
      rod([X,y+.006,z+len],[X,y-(closed?.044:.018),z+(closed?len-.016:len+.025)],.012,skin,5);
    }
    rod([x-side*.034,y-.005,z-.029],[x-side*.062,y+.012,z+.031],.021,lightSkin,6,.015);
  }
  function vessel(x,y,z,r,depth,wall,lip,sides=12){
    const base=[],top=[],inside=[],floor=[];
    for(let i=0;i<sides;i++){
      const a=i*TAU/sides,c=Math.cos(a),s=Math.sin(a);
      base.push([x+c*r*.65,y-depth,z+s*r*.65]);
      top.push([x+c*r,y,z+s*r]);
      inside.push([x+c*r*.88,y,z+s*r*.88]);
      floor.push([x+c*r*.55,y-depth+.016,z+s*r*.55]);
    }
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides;
      quad(base[i],top[i],top[j],base[j],wall);
      quad(top[i],inside[i],inside[j],top[j],lip);
      quad(inside[i],floor[i],floor[j],inside[j],wall);
      tri([x,y-depth+.016,z],floor[j],floor[i],wall);
      tri([x,y-depth,z],base[i],base[j],wall);
    }
  }
  function shovel(t,grips) {
    const kid=t===2, strong=t===6;
    const length=kid?.57:strong?1.29:1.17, w=kid?.105:strong?.168:.142;
    const handle=kid?'a65035':strong?'637477':'997047', face=kid?'d36a48':strong?'a6b4b4':'879492';
    rod([.40,-.35,.26],[.16,-.25,length-.17],kid?.023:.025,handle,8);
    rod([.16,-.25,length-.21],[.14,-.28,length-.04],kid?.036:.043,face,8,.033);
    const a=[.14-w*.56,-.235,length-.14],b=[.14+w*.56,-.235,length-.14];
    const c=[.14+w,-.293,length+.10],d=[.14-w,-.293,length+.10];
    const e=[.14,-.313,length+(kid?.15:.21)];
    const ab=[.14,-.29,length-.08], center=[.14,-.33,length+.06];
    tri(a,b,ab,face);tri(a,ab,center,face);tri(b,center,ab,face);
    tri(a,center,d,face);tri(b,c,center,face);tri(d,center,e,face);tri(center,c,e,face);
    quad(a,d,[d[0],d[1]-.021,d[2]],[a[0],a[1]-.021,a[2]],handle);
    quad(b,[b[0],b[1]-.021,b[2]],[c[0],c[1]-.021,c[2]],c,handle);
    rod(d,e,.009,edge,5);rod(e,c,.009,edge,5);
    if(!kid){
      rod([.43,-.36,.22],[.47,-.31,.13],.020,handle);
      rod([.37,-.36,.22],[.34,-.32,.14],.020,handle);
      rod([.34,-.32,.14],[.47,-.31,.13],.023,strong?dark:handle);
    }
    if(grips){
      hand(.38,-.326,.30,1);
      if(!kid)hand(.245,-.274,.70,-1);
    }
    return [.14,-.302,length+.045,w*.83];
  }
  function striking(t,grips){
    const pick=t===4;
    rod([.42,-.36,.27],[.13,.09,1.08],pick?.026:.032,pick?'9f774e':'725145',8,.035);
    rod([.43,-.366,.23],[.35,-.265,.49],.041,dark,8,.034);
    if(pick){
      rod([-.03,.13,1.04],[.27,.065,1.12],.059,steel,7);
      rod([-.02,.13,1.04],[-.19,.075,1.12],.046,steel,7,.029);
      rod([-.19,.075,1.12],[-.31,-.087,1.19],.029,edge,6,.007);
      rod([.27,.065,1.12],[.40,-.060,1.17],.043,steel,7,.025);
      box(.412,-.075,1.175,.066,.038,.095,edge);
    }else{
      box(.13,.091,1.075,.33,.143,.158,dark);
      for(const side of [-1,1]) cylinder(.13+side*.15,.091,1.075,.091,.063,steel,'x',8);
    }
    if(grips){hand(.36,-.26,.47,1);hand(.245,-.055,.83,-1);}
  }
  function powered(t,grips){
    if(t===9){
      box(.17,-.287,.88,.22,.27,.22,'b55d32');
      box(.17,-.215,.837,.16,.095,.27,'db8a47');
      for(const x of [-.035,.375]){
        rod([.16,-.22,.81],[x,-.18,.71],.023,dark);
        rod([x,-.18,.71],[x,-.18,.59],.043,rubber);
        if(grips)hand(x,-.162,.62,x<.17?-1:1);
      }
      rod([.17,-.39,.93],[.17,-.52,.99],.055,dark,9,.042);
      for(let i=0;i<4;i++)cylinder(.17,-.26+i*.033,.997,.074,.011,'584b44','z',8);
    }else{
      rod([.37,-.37,.41],[.23,-.27,.76],.074,rubber);
      for(let i=0;i<7;i++){
        rod([.37-i*.019,-.37+i*.014,.41+i*.047],[.368-i*.019,-.368+i*.014,.425+i*.047],.081,dark,9);
      }
      rod([.23,-.27,.76],[.10,-.43,1.18],.066,'a98b50',9,.048);
      box(.10,-.448,1.223,.23,.085,.13,dark);
      box(.10,-.476,1.244,.257,.025,.15,steel);
      rod([.30,-.29,.68],[.33,-.17,.62],.023,dark);
      rod([.33,-.17,.62],[.29,-.16,.52],.034,rubber);
      if(grips){hand(.31,-.156,.565,1);hand(.20,-.25,.79,-1);}
    }
  }

  function tray(w,length,depth,mat,trim){
    const a=[-w*.37,0,-length*.44], b=[w*.37,0,-length*.44], c=[w*.37,0,length*.42], d=[-w*.37,0,length*.42];
    const A=[-w/2,depth,-length*.5], B=[w/2,depth,-length*.5], C=[w/2,depth,length*.5], D=[-w/2,depth,length*.5];
    quad(a,d,c,b,mat);
    for(const [i,j,k,l] of [[a,b,B,A],[b,c,C,B],[c,d,D,C],[d,a,A,D]]){
      quad(i,j,k,l,mat);
      rod(k,l,.018,trim,6);
    }
  }
  function load(x,y,z,w,l,h,count=22){
    const rng=random(84+count);
    for(let i=0;i<count;i++){
      const u=rng()-.5,v=rng()-.5;
      stone({x:x+u*w,y:y+h*(1-.8*Math.max(Math.abs(u),Math.abs(v))*2),z:z+v*l,
        size:Math.min(w,l)*(.10+rng()*.08),seed:rng()*10,mat:palette[i%palette.length]},true);
    }
  }
  function tire(r, thickness){
    cylinder(0,0,0,r,thickness,rubber,'x',12);
    for(const flank of [-1,1]){
      cylinder(flank*thickness*.51,0,0,r*.57,.023,'677472','x',10);
      cylinder(flank*thickness*.59,0,0,r*.28,.032,dark,'x',8);
      for(let i=0;i<6;i++){
        const a=i*TAU/6;
        cylinder(flank*thickness*.61,Math.sin(a)*r*.40,Math.cos(a)*r*.40,r*.061,.021,edge,'x',5);
      }
    }
    for(let i=0;i<12;i++){
      const a=i*TAU/12, y=Math.cos(a)*r*.95,z=Math.sin(a)*r*.95;
      rod([-thickness*.45,y,z],[thickness*.45,y,z],r*.08,'373d37',5);
    }
  }
  const held=[], displays=new Map(), carrying=new Map(), barrows=new Map(), rigs=new Map();
  function part(draw){return mesh(build(draw));}
  for(let i=0;i<=10;i++){
    let pos;
    const body=part(()=>{
      if(i===0)hand(.27,-.39,.62,1,false);
      if(i===1){
        vessel(.215,-.173,.73,.096,.179,'bca56f','eddb9b');
        hand(.30,-.298,.655,1);
      }
      if([2,3,6].includes(i))pos=shovel(i,true);
      if(i===4||i===8)striking(i,true);
      if(i===9||i===10)powered(i,true);
    });
    if(i===1)pos=[.215,-.255,.73,.09];
    held[i]=body;
    if(pos)carrying.set(i,part(()=>load(pos[0],pos[1],pos[2],pos[3]*1.48,pos[3]*1.13,pos[3]*.18,10)));
    if([1,2,3,4,6,8,9,10].includes(i)){
      const display=build(()=>{
        if(i===1)vessel(0,.16,0,.096,.18,'bca56f','eddb9b');
        if([2,3,6].includes(i))shovel(i,false);
        if(i===4||i===8)striking(i,false);
        if(i===9||i===10)powered(i,false);
      });
      displays.set(i,display);
    }
  }
  const pickedRock=part(()=>stone({x:.27,y:-.334,z:.708,size:.059,seed:1.1,mat:'afa99a'}));
  const drillBit=part(()=>rod([.17,-.498,.99],[.17,-.697,1.06],.031,steel,6,.010));
  const wheelHands=part(()=>{hand(-.365,-.49,.665,-1);hand(.365,-.49,.665,1);});
  const steeringWheel=part(()=>{
    const r=.205;
    for(let i=0;i<12;i++){
      const a=i*TAU/12,b=(i+1)*TAU/12;
      rod([Math.cos(a)*r,Math.sin(a)*r,0],[Math.cos(b)*r,Math.sin(b)*r,0],.021,rubber,7);
    }
    for(const angle of [-.92,Math.PI/2,Math.PI+.92])rod([0,0,-.012],[Math.cos(angle)*r,Math.sin(angle)*r,0],.023,steel,7);
    cylinder(0,0,-.007,.054,.045,dark,'z',8);
    hand(-.205,.008,-.033,-1);hand(.205,.008,-.033,1);
  });
  const driveConsole=part(()=>{
    box(0,-.58,.85,.84,.25,.24,'444e47');
    box(0,-.449,.83,.29,.04,.15,'68776e');
    for(let i=0;i<4;i++)cylinder((i-1.5)*.064,-.421,.837,.014,.011,i===2?'d4ad58':'a5bdb3','y',7);
  });
  const controlLever=side=>part(()=>{
    rod([side*.33,-.54,.78],[side*.33,-.359,.82],.023,steel,7);
    rod([side*.33,-.365,.82],[side*.33,-.365,.785],.046,rubber,8);
    hand(side*.32,-.375,.729,side);
  });
  const levers=[controlLever(-1),controlLever(1)];
  const scoopHand=part(()=>shovel(3,true));

  for(const tier of [5,7]){
    const reinforced=tier===7, mat=reinforced?'577579':'758567', trim=reinforced?steel:'98a18a';
    const w=reinforced?.99:.80,l=reinforced?1.10:.86;
    const fixed=part(()=>{
      for(const s of [-1,1]){
        rod([s*.36,.78,.02],[s*.23,.37,1.26],.032,reinforced?steel:'9a7548',7);
        rod([s*.36,.78,-.11],[s*.36,.78,.10],.039,rubber);
        rod([s*.26,.53,.46],[s*.29,.092,.35],.026,steel);
        rod([s*.29,.092,.35],[s*.29,.092,.61],.021,steel);
      }
      rod([-.34,.265,1.25],[.34,.265,1.25],.026,steel);
    });
    barrows.set(tier,{
      fixed,tray:part(()=>tray(w,l,.31,mat,trim)), load:part(()=>load(0,.12,0,w*.73,l*.75,.16)),
      wheel:part(()=>tire(.255,.14)), wheels:reinforced?[-.32,.32]:[0]
    });
  }
  function barrow(tier,pose,spin,fill,dump=0){
    const m=barrows.get(tier);
    const bucket=compose(pose,transform(0,.55,.78,-dump*.85));
    const out=[{item:m.fixed,m:pose},{item:m.tray,m:bucket}];
    for(const x of m.wheels)out.push({item:m.wheel,m:compose(pose,transform(x,.265,1.23,spin))});
    if(fill>0)out.push({item:m.load,m:compose(bucket,transform(0,-.10+fill*.12,0,0,0,0,.68+fill*.32))});
    return out;
  }
  function displayParts(){
    const parts=[];
    for(const [i,data] of displays){
      const column=i===1?0:i===6?4:i===8?5:i===9?6:i===10?7:i;
      const w=i===1?1:i===4?.78:.8;
      const x=(column-3.65)*.438,y=i===1?1.37:i>=9?1.39:.56;
      parts.push({data,m:transform(x,y,.98,i===1?0:-1.53,0,i>=9?.13:0,w)});
    }
    for(const tier of [5,7]){
      const pose=transform(tier===5?-.88:.88,.14,-.03,0,Math.PI,.0,.69);
      for(const {item,m} of barrow(tier,pose,0,0)) parts.push({data:item.data,m});
    }
    return join(parts);
  }
  function makeBucket(w,length,mat,dump=false){
    if(dump){tray(w,length,.55,mat,steel);return;}
    const a=[-w/2,0,.08],b=[w/2,0,.08],c=[w/2,-.14,length],d=[-w/2,-.14,length];
    const A=[-w/2,.52,.025],B=[w/2,.52,.025];
    quad(a,d,c,b,mat);
    quad(a,b,B,A,mat);
    tri(a,A,d,mat);tri(b,c,B,mat);
    rod(d,c,.038,edge,8);
    for(let i=1;i<=6;i++)box(-w/2+w*i/7,-.15,length+.045,.082,.05,.145,steel);
  }
  function trackShell(width, half){
    const pts=[[-half-.12,.15],[-half-.30,.32],[-half-.24,.55],[-half,.68],[half,.68],[half+.24,.55],[half+.30,.32],[half+.12,.15]];
    for(let i=0;i<pts.length;i++){
      const [z,y]=pts[i],[Z,Y]=pts[(i+1)%pts.length];
      quad([-width/2,y,z],[width/2,y,z],[width/2,Y,Z],[-width/2,Y,Z],rubber);
      tri([-width/2,.42,0],[-width/2,Y,Z],[-width/2,y,z],dark);
      tri([width/2,.42,0],[width/2,y,z],[width/2,Y,Z],dark);
    }
  }
  for(let tier=11;tier<tools.length;tier++){
    const t=tools[tier], mode=t.mode, tracked=mode==='dozer'||mode==='excavator', cart=mode==='cart';
    const large=mode==='loader'||mode==='dozer', w=t.width, yellow=mode==='skid'?'bb6646':mode==='excavator'?'b28246':mode==='cart'?'688375':gold;
    const half=cart?.56:large?.88:.65, tireRadius=cart?.29:large?.47:.33;
    const wheelX=w*.48, trackWidth=w*.26;
    const base=part(()=>{
      box(0,.49,0,w*.82,.30,2*half+.42,dark);
      const end=-half-.23;
      box(0,.78,end,w*.86,.43,.52,yellow);
      box(0,.76,end-.266,w*.49,.17,.027,'414946');
      for(let i=0;i<7;i++)box((i-3)*w*.068,.77,end-.29,.022,.14,.014,steel);
      box(0,.60,half+.14,w*.88,.14,.26,'626b66');
      for(const s of [-1,1]){
        box(s*w*.38,.85,end-.25,.11,.13,.054,'b65242');
        box(s*w*.39,.71,half+.27,.16,.11,.049,'ded39c');
        box(s*w*.42,.64,.02,.23,.065,.55,dark);
        for(let i=0;i<3;i++)box(s*w*.43,.65,-.15+i*.15,.24,.018,.026,steel);
      }

    });
    const cab=part(()=>{
      const floor=large?1.15:.81, seat=floor+.27;
      box(0,floor,-.20,w*.67,.14,.90,yellow);
      box(0,seat,-.31,w*.35,.10,.30,'455351');
      box(0,seat+.19,-.46,w*.37,.39,.10,'4e5b55');
      box(0,floor+.28,.245,w*.62,.16,.18,dark);
      for(const x of [-w*.28,w*.28]){
        const top=t.eye+(cart?.05:.30);
        if(!cart){
          rod([x,floor,-.59],[x,top,-.52],.044,dark,6);
          rod([x,floor,.30],[x,top,.35],.037,dark,6);
          box(x,top,.0,.09,.065,.95,yellow);
        }
        rod([x,floor+.19,.10],[x,floor+.48,.19],.027,dark,7);
      }
      if(!cart){
        box(0,t.eye+.30,-.10,w*.65,.078,.96,yellow);
        for(const s of [-1,1])box(s*w*.26,t.eye+.26,.404,.16,.09,.062,'ede2ae');
      }
      if(mode==='loader'||cart){
        rod([0,floor+.27,.23],[0,floor+.48,.06],.029,steel);
        cylinder(0,floor+.49,.045,.137,.033,dark,'y');
      }
    });
    const wheel=part(()=>tire(tireRadius,tracked?.13:cart?.22:large?.33:.27));
    const track=tracked?part(()=>trackShell(trackWidth,half)):null;
    const tread=tracked?part(()=>box(0,0,0,trackWidth*1.05,.075,.085,'414943')):null;
    const armLen=mode==='excavator'?1.22:large?1.50:.97;
    const arm=part(()=>{
      if(mode==='excavator'){
        box(0,.025,armLen*.47,.24,.28,armLen,yellow);
        rod([0,.21,.14],[0,.21,armLen*.84],.044,dark,8);
        rod([0,.21,armLen*.46],[0,.21,armLen*.96],.031,edge,8);
        cylinder(0,0,armLen,.14,.29,dark,'x',8);
      }else for(const s of [-1,1]){
        const x=s*w*.37;
        box(x,0,armLen*.46,.15,.20,armLen,yellow);
        rod([x,.14,.12],[x,.14,armLen*.91],.043,steel);
        cylinder(x,0,armLen,.097,.19,dark,'x',8);
      }
    });
    const dipper=part(()=>{
      box(0,0,.51,.164,.17,1.02,yellow);
      rod([0,.134,.08],[0,.134,.88],.033,edge);
      cylinder(0,0,.99,.090,.22,dark,'x',8);
    });
    const bucket=part(()=>{
      if(mode==='dozer'){
        const W=w*1.27;
        quad([-W/2,-.04,.23],[W/2,-.04,.23],[W/2,.37,.03],[-W/2,.37,.03],steel);
        quad([-W/2,.37,.03],[W/2,.37,.03],[W/2,.76,.30],[-W/2,.76,.30],yellow);
        box(0,-.034,.257,W,.095,.10,edge);
        for(const s of [-1,1])box(s*W/2,.34,.25,.098,.76,.32,yellow);
      }else makeBucket(mode==='excavator'?.79:w*1.04,cart?1.2:large?.91:.62,cart?yellow:steel,cart);
    });
    const cargo=part(()=>load(0,.17,mode==='dozer'?.64:cart?0:.28,mode==='excavator'?.53:w*.82,cart?.93:.62,mode==='dozer'?.38:.22,25));
    const intake=cart?part(()=>{
      cylinder(0,.24,1.04,.19,w*.79,steel,'x',10);
      for(let i=0;i<9;i++)box((i-4)*w*.084,.19,1.17,.038,.21,.046,gold);
    }):null;
    rigs.set(tier,{base,cab,wheel,track,tread,arm,dipper,bucket,cargo,intake,half,wheelX,tracked,armLen,tireRadius});
  }
  function machinery(tier,pose,{spin=0,work=0,dump=0,fill=0,blade=false,cab=true}={}){
    const {mode,width:w}=tools[tier], r=rigs.get(tier);
    const list=[{item:r.base,m:pose}];
    const add=(item,x,y,z,rx=0,anchor=pose)=>{
      const m=compose(anchor,transform(x,y,z,rx));
      list.push({item,m});
      return m;
    };
    if(cab)list.push({item:r.cab,m:pose});
    if(r.tracked){
      for(const s of [-1,1]){
        const x=s*r.wheelX*.89;
        add(r.track,x,0,0);
        for(let i=0;i<3;i++)add(r.wheel,x+s*.13,.378,(i-1)*r.half,spin);
        for(let i=0;i<9;i++){
          const p=(i/9+spin*.078%1+1)%1;
          add(r.tread,x,.678,(p-.5)*r.half*2);
        }
      }
    }else for(const s of [-1,1])for(const z of [-r.half,r.half])add(r.wheel,s*r.wheelX,r.tireRadius,z,spin);
    let bucket;
    if(mode==='cart'){
      list.push({item:r.intake,m:pose});
      bucket=add(r.bucket,0,.86,.16,dump*.88);
    }else if(mode==='excavator'){
      const arm=add(r.arm,w*.37,1.14,.36,-.61+work*.99-dump*.34);
      const stick=add(r.dipper,0,0,r.armLen,.90-work*.82,arm);
      bucket=add(r.bucket,0,0,1.01,-.14-work*.48+dump*1.1,stick);
    }else if(mode==='dozer'){
      add(r.arm,0,.47,.52,(blade?.13:-.16)+dump*.21);
      bucket=add(r.bucket,0,blade?.15:.41,1.68,dump*.25);
    }else{
      const arm=add(r.arm,0,mode==='loader'?1.15:.78,.30,(mode==='loader'?.21:.30)+work*.38-dump*.90);
      bucket=add(r.bucket,0,0,r.armLen,work*-.56+dump*1.20,arm);
    }
    if(fill>0)list.push({item:r.cargo,m:compose(bucket,transform(0,-.12+fill*.10,0,0,0,0,.60+.40*fill))});
    return list;
  }
  function viewModel(tier,time,walk,fill,seated,dumping,steering,blade){
    const t=tools[tier];
    if(seated){
      if(t.mode==='cart'||t.mode==='loader'){
        return [{item:driveConsole},{item:steeringWheel,m:transform(0,-.403,.80,-.40,0,-steering*.68)}];
      }
      const leverMotion=t.mode==='dozer'?(blade?.21:0):Math.sin(Math.PI*clamp(time/t.cycle,0,1))*.20;
      return [{item:driveConsole},...levers.map((item,i)=>({
        item,m:transform(0,0,.015*steering*(i?1:-1),leverMotion*(i?1:.55)-dumping*.15)
      }))];
    }
    if(t.eye)return [];
    const phase=clamp(time/t.cycle,0,1);
    const stroke=Math.sin(phase*Math.PI);
    const bounce=Math.sin(walk)*.011;
    let m=transform(0,bounce,0);
    if(t.mode==='barrow'){
      if(stroke<.015)return [{item:wheelHands,m:transform(0,bounce-dumping*.11,0,dumping*.12)}];
      m=transform(-stroke*.27,bounce-stroke*.17,stroke*.15,stroke*.28,stroke*.19);
      return [{item:scoopHand,m}];
    }
    if(t.mode==='hand')m=transform(-stroke*.19,bounce+.095-stroke*.15,stroke*.13,.09+stroke*.26,stroke*-.26);
    if(t.mode==='cup')m=transform(-stroke*.08,bounce-stroke*.16,stroke*.18,Math.sin(phase*TAU)*.50-dumping*.82);
    if(t.mode==='shovel'){
      const pitch=-.38+Math.sin(phase*TAU)*.48+dumping*.74;
      m=compose(transform(.38-stroke*.12,-.326+bounce-stroke*.09,.30+stroke*.14,pitch,stroke*.13,-stroke*.16),
        transform(-.38,.326,-.30));
    }
    if(t.mode==='pick'||t.mode==='hammer'){
      const hit=t.impact/t.cycle, arc=phase<hit?mix(-.58,.82,(phase/hit)**3):mix(.82,0,(phase-hit)/(1-hit));
      const rx=stroke>0.001?arc*clamp(phase/.13,0,1):0;
      const hammer=t.mode==='hammer';
      m=transform(-stroke*(hammer?.21:.085),bounce+stroke*(hammer?.13:.07),stroke*(hammer?.03:-.054),
        rx*(hammer?1.23:1),stroke*(hammer?-.27:-.16),stroke*(hammer?.43:.20));
    }
    if(t.mode==='jack')m=transform(0,bounce-stroke*.05,stroke*.05,stroke*.23);
    if(t.mode==='vac')m=transform(stroke*.024,bounce-stroke*.075,stroke*.09,stroke*.14);
    const out=[{item:held[tier],m}];
    if(tier===9)out.push({item:drillBit,m:compose(m,transform(0,Math.sin(phase*TAU*3)*stroke*.057,0))});
    if(tier===0&&fill>0)out.push({item:pickedRock,m});
    if(fill>0&&carrying.has(tier)){
      const p=carrying.get(tier);
      out.push({item:p,m:compose(m,transform(0,-(1-fill)*.022,0))});
    }
    return out;
  }
  return {tools,displayParts,viewModel,barrow,machinery};
})();
