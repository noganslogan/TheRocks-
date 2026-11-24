'use strict';

Rocks.yard = (() => {
  const R=Rocks.render;
  const {TAU,box,rod,tri,quad,cylinder,stone,build,mesh,join,transform,random,clamp,mix,palette,color,setMesh,setScatter}=R;
  const TOTAL=1_000_000_000;
  const pile={x:-4.4,z:-2.4,rx:7.25,rz:6.05,h:5.4};
  const truck={x:10.8,z:-5.3}, shed={x:10.3,z:4.8};
  const delivery={x:6.2,z:4.2,yaw:-1.14};
  const chair={x:-6.8,z:5.1,yaw:0};
  const COLS=16, ROWS=16, CHUNK=4, STEPS=R.gl?4:3;
  const {x:PX,z:PZ,rx,rz}=pile;
  const colorTable=palette.map(color);
  function shape(u,v){
    const r=Math.hypot(u,v);
    if(r>=1)return 0;
    const angle=Math.atan2(v,u);
    const slopes=.19*Math.sin(angle*3+.6)*r+.09*Math.cos(angle*5-.4)*r;
    const ridges=.09*Math.sin(u*11+v*7)*Math.sin(v*8-u*3)*r;
    return pile.h*Math.pow(1-r,.87)*(1+slopes+ridges);
  }
  const cells=Array.from({length:COLS*ROWS},(_,id)=>{
    const col=id%COLS,row=Math.floor(id/COLS);
    const u=(col+.5)*2/COLS-1,v=(row+.5)*2/ROWS-1;
    let volume=0;
    for(let dx=-.375;dx<=.375;dx+=.25)for(let dz=-.375;dz<=.375;dz+=.25){
      volume+=shape(u+dx*2/COLS,v+dz*2/ROWS);
    }
    return {id,col,row,x:PX+u*rx,z:PZ+v*rz,volume};
  });
  const volume=cells.reduce((n,c)=>n+c.volume,0);
  let allocated=0, weight=0;
  for(const cell of cells){
    weight+=cell.volume;
    const next=Math.round(TOTAL*weight/volume);
    cell.capacity=next-allocated;
    allocated=next;
  }
  function spread(amount){
    let previous=0,before=0;
    return cells.map(({capacity})=>{
      previous+=capacity;
      const next=Math.round(amount*previous/TOTAL), delta=next-before;
      before=next;
      return delta;
    });
  }
  function index(x,z){
    const col=Math.floor((x-PX+rx)/(2*rx)*COLS),row=Math.floor((z-PZ+rz)/(2*rz)*ROWS);
    return row>=0&&row<ROWS&&col>=0&&col<COLS ? row*COLS+col : -1;
  }
  function artStatic(){
    return build(()=>{
      const rand=random(778),T=truck,D=shed;
      box(0,-.15,-1.6,30,.3,22,'85925d');for(let i=0;i<125;i++){let X=(rand()-.5)*28,Z=-1.5+(rand()-.5)*20;if(Math.hypot((X-PX)/rx,(Z-PZ)/rz)<1.05)continue;box(X,.006,Z,.25+rand()*.8,.012,.18+rand()*.35,['8f9a64','788b56','8a9861'][i%3])} // fence and back of house
      for(let k=-14.5;k<=14.5;k+=.43){box(k,.86,-12,.38,1.72,.12,'aa9068');tri([k-.19,1.72,-11.94],[k,1.87,-11.94],[k+.19,1.72,-11.94],'c4a87a')}for(let k=-11.8;k<8.5;k+=.43)for(let side of [-1,1]){box(side*14.5,.86,k,.12,1.72,.38,'aa9068')}for(let h of [.45,1.23]){box(0,h,-11.85,29,.12,.12,'806a4e');for(let s of [-1,1])box(s*14.35,h,-1.7,.12,.12,20.5,'806a4e')}for(let k=-12;k<=12;k+=3)box(k,.95,-11.8,.19,1.9,.24,'806b50');
      box(-1,2.1,8.6,14,4.2,.65,'c9c1ad');for(let h=.2;h<4.1;h+=.28)box(-1,h,8.23,14,.025,.025,'a8a28d');box(-1,4.2,8.15,14.6,.18,1.2,'514e47');box(-1,.21,7.75,14,.35,1.0,'a9a49a');box(-.8,1.2,8.22,1.18,2.4,.09,'5a584f');box(-.8,1.45,8.15,.84,1.0,.04,'8aafba');box(-.36,1.15,8.11,.06,.09,.06,'d2bb76');for(let a of [-5,3.5]){box(a,2.25,8.17,1.75,1.2,.12,'e4dfcd');box(a,2.25,8.08,1.47,.94,.06,'6c919e');box(a,2.25,8.03,.06,.96,.05,'e4dfcd');box(a,2.25,8.03,1.5,.06,.05,'e4dfcd')}box(-1,.075,6.85,4,.15,2.05,'b7b0a2');
      let tx=T.x,tz=T.z;box(tx,.51,tz,1.87,.3,4.15,'454c48');box(tx,.86,tz,1.96,.44,4.18,'8a5041');box(tx,1.29,tz-1.04,1.86,1.00,1.67,'a25d48');box(tx,1.89,tz-1.04,1.88,.18,1.70,'a7624c');box(tx,1.53,tz-1.91,1.46,.52,.035,'7298a6');box(tx,1.56,tz-.19,1.46,.5,.04,'71949c');for(let s of [-1,1]){box(tx+s*.945,1.55,tz-1.00,.035,.54,1.18,'7b9aa1');box(tx+s*.98,.95,tz+.98,.15,.72,2.04,'a8614c');box(tx+s*.88,1.34,tz+1.0,.25,.1,2.09,'ba7356');box(tx+s*.65,.79,tz+2.08,.29,.21,.06,'b94e3e');box(tx+s*.89,.64,tz-2.13,.28,.2,.06,'e9dfb4');for(let a of [-1.35,1.32]){cylinder(tx+s*.99,.48,tz+a,.47,.32,'303632');cylinder(tx+s*1.17,.48,tz+a,.23,.05,'a3a5a1')}}box(tx,.73,tz+1.0,1.72,.13,2.12,'565a53');for(let a=-.65;a<=.7;a+=.22)box(tx+a,.81,tz+1.0,.045,.045,1.95,'777d73');box(tx,.99,tz+2.08,1.92,.42,.13,'a35f4b');box(tx,.54,tz+2.22,1.98,.15,.24,'b8b7aa');box(tx,.64,tz+2.36,.44,.18,.04,'ded7b8');
      box(-12.2,.75,-9.4,.38,1.5,.38,'745c43');for(let i=0;i<7;i++){let a=i*TAU/7;stone({x:-12.2+Math.cos(a)*.65,z:-9.4+Math.sin(a)*.65,y:2.25+(i%3)*.25,size:.95,type:0,mat:['657d48','728951','7d9557'][i%3],seed:i})}
      let X=D.x,Z=D.z,W=4.0,L=3.25,H=2.65;box(X,.075,Z,W+.25,.15,L+.35,'b3a48b');box(X,1.37,Z+L/2,W,2.6,.16,'97764e');for(let side of [-1,1]){box(X+side*W/2,1.37,Z,.16,2.6,L,'99784e');box(X+side*1.58,1.37,Z-L/2,.84,2.6,.16,'9c7a50');box(X+side*1.12,1.37,Z-L/2-.06,.16,2.6,.20,'644d36');for(let yy=.29;yy<2.6;yy+=.29){box(X+side*(W/2+.085),yy,Z,.035,.035,L,'755939');box(X+side*1.58,yy,Z-L/2-.09,.84,.035,.025,'755939')}}box(X,2.49,Z-L/2,2.2,.37,.21,'755b3c');let left=X-2.18,right=X+2.18,front=Z-1.84,back=Z+1.84,ridge=3.35;quad([left,H,front],[X,ridge,front],[X,ridge,back],[left,H,back],'514c40');quad([X,ridge,front],[right,H,front],[right,H,back],[X,ridge,back],'605748');tri([left,H,front],[right,H,front],[X,ridge,front],'9e7e54');tri([right,H,back],[left,H,back],[X,ridge,back],'96754b');box(X,2.89,front-.035,1.75,.30,.07,'3e493e');let letters=['111101101101111','111101101101111','111101101101111','100100100100111','111100111001111'];letters[0]='111010010010010';let word=letters,unit=.073;for(let i=0;i<word.length;i++)for(let k=0;k<15;k++)if(word[i][k]==='1')box(X+(i-2)*.29+(k%3-1)*unit,2.89+(2-Math.floor(k/3))*unit,front-.08,.059,.059,.02,'f0dab0');for(let y of [.65,1.28])box(X,y,Z+1.12,3.45,.12,.66,'6e583e');for(let side of [-1,1])box(X+side*1.61,.70,Z+1.12,.12,1.35,.57,'6b5439');
      // Larry's folding lawn chair, facing the pile.
      const cx=chair.x,cz=chair.z;
      for(const side of [-1,1]){
        const x=cx+side*.31;
        rod([x,.05,cz-.25],[x,.74,cz+.28],.021,'b5bab2');
        rod([x,.04,cz+.29],[x,.53,cz-.23],.021,'b5bab2');
        rod([x,.69,cz-.20],[x,.69,cz+.30],.029,'7d837a');
        rod([x,.44,cz+.19],[x,1.02,cz+.40],.024,'c7c9bf');
      }
      for(let i=0;i<7;i++){
        const z=cz-.26+i*.073,y=.48+i*.073;
        box(cx,.488,z,.60,.026,.057,i%2?'5f7b6e':'a6aa87');
        box(cx,y,cz+.21+(y-.48)*.33,.60,.065,.024,i%2?'5f7b6e':'a6aa87');
      }
      // The machine delivery pad and the area behind the truck.
      box(delivery.x,.02,delivery.z,3.70,.04,2.75,'a39f8a');
      box(delivery.x,.044,delivery.z,3.42,.008,2.48,'b5af99');
      for(const side of [-1,1]){
        box(delivery.x+side*1.65,.05,delivery.z,.045,.01,2.32,'e6dac0');
        for(let i=0;i<4;i++)box(truck.x+side*(1.39-i*.12),.014,truck.z+2.85+i*.12,.14,.012,.17,'c7b58a');
      }
    });
  }
  const staticYard=mesh(join([
    {data:artStatic()},
    {data:Rocks.models.displayParts(),m:transform(shed.x,0,shed.z)}
  ]));

  function createSurface(getState){
    const chunks=[], dirty=new Set();
    const chunkCols=COLS/CHUNK,chunkRows=ROWS/CHUNK;
    const templates=Array.from({length:6},(_,i)=>mesh(build(()=>stone({x:0,y:0,z:0,size:1,seed:.8+i*2.29,mat:[1,1,1]},true))));
    for(let row=0;row<chunkRows;row++)for(let col=0;col<chunkCols;col++){
      chunks.push({id:row*chunkCols+col,col,row,
        x:PX+rx*((col+.5)*2/chunkCols-1),z:PZ+rz*((row+.5)*2/chunkRows-1),core:{},scatter:{},dots:[],template:templates[(col+row*3)%templates.length]});
    }
    const rng=random(1337);
    const scatterCount=R.gl?4800:840;
    for(let i=0;i<scatterCount;i++){
      const a=rng()*TAU,r=Math.sqrt(rng())*.995,u=Math.cos(a)*r,v=Math.sin(a)*r;
      const id=index(PX+u*rx,PZ+v*rz),cell=cells[id];
      const chunk=chunks[Math.floor(cell.row/CHUNK)*chunkCols+Math.floor(cell.col/CHUNK)];
      const dot={id,x:PX+u*rx,z:PZ+v*rz,size:.043+rng()*.105,tint:colorTable[Math.floor(rng()*palette.length)]};
      dot.order=chunk.dots.length;
      chunk.dots.push(dot);
    }
    const geology=[], geologyRng=random(92573);
    for(const type of [1,2]){
      const n=type===1?26:12;
      for(let i=0;i<n;i++){
        const angle=i*TAU/n+(type===1?.09:.24),r=(type===1?.88:.84)+geologyRng()*(type===1?.095:.075);
        const x=PX+Math.cos(angle)*r*rx,z=PZ+Math.sin(angle)*r*rz;
        const id=index(x,z);
        geology.push({id:`stone-${geology.length}`,cell:id,x,z,type,req:type===1?2:4,
          size:type===1?.21+geologyRng()*.17:.51+geologyRng()*.37,seed:geologyRng()*100,mat:palette[(i+type)%palette.length]});
      }
    }
    const flecks=R.gl?120:42, pool=Array.from({length:flecks},()=>({age:10}));
    const fx={}, outcrop={};
    let cursor=0, geologyDirty=true;
    const disturbed=new Map();
    const effectRng=random(9727);
    function invalidate(){
      for(const chunk of chunks)dirty.add(chunk.id);
      disturbed.clear();geologyDirty=true;
      for(const p of pool)p.age=10;
    }
    function ratio(col,row){
      const cell=cells[clamp(row,0,ROWS-1)*COLS+clamp(col,0,COLS-1)];
      return cell.capacity ? 1-getState().depleted[cell.id]/cell.capacity : 1;
    }
    function height(x,z){
      const u=(x-PX)/rx,v=(z-PZ)/rz,base=shape(u,v);
      if(base===0)return 0;
      const col=(u+1)*COLS*.5-.5,row=(v+1)*ROWS*.5-.5;
      const c=Math.floor(col),r=Math.floor(row);
      return base*mix(mix(ratio(c,r),ratio(c+1,r),col-c),mix(ratio(c,r+1),ratio(c+1,r+1),col-c),row-r);
    }
    function mark(id){
      const {col,row}=cells[id];
      for(let r=Math.max(0,row-1);r<=Math.min(ROWS-1,row+1);r++){
        for(let c=Math.max(0,col-1);c<=Math.min(COLS-1,col+1);c++){
          dirty.add(Math.floor(r/CHUNK)*chunkCols+Math.floor(c/CHUNK));
        }
      }
      geologyDirty=true;
    }
    function rebuild(chunk){
      const size=CHUNK*STEPS, grid=[];
      const rand=random(123+chunk.id);
      for(let j=0;j<=size;j++){
        const z=PZ+rz*((chunk.row*CHUNK+j/STEPS)*2/ROWS-1);
        for(let i=0;i<=size;i++){
          const x=PX+rx*((chunk.col*CHUNK+i/STEPS)*2/COLS-1),y=height(x,z);
          const ripple=.026*Math.sin(x*12+z*5)*Math.cos(x*5-z*7);
          grid.push([x,y>.008?Math.max(.012,y+.017+ripple*Math.min(1,y*6)):0,z]);
        }
      }
      setMesh(chunk.core,build(()=>{
        for(let j=0;j<size;j++)for(let i=0;i<size;i++){
          const k=j*(size+1)+i;
          const a=grid[k],b=grid[k+1],c=grid[k+size+2],d=grid[k+size+1];
          const wobble=rand()*.063 + Math.sin(a[0]*1.9+a[2]*2.1)*.038 + Math.cos(a[2]*4.4-a[0])*.041;
          const h=Math.max(a[1],b[1],c[1],d[1]);
          if(h<.014)continue;
          const exposed=shape((a[0]-PX)/rx,(a[2]-PZ)/rz)-a[1]>.35;
          const base=exposed?[.46,.42,.36]:[.56,.52,.46];
          if((i+j)%2===0){
            tri(a,d,c,base.map(v=>v+wobble));
            tri(a,c,b,base.map(v=>v+wobble*.91-.024));
          }else{
            tri(a,d,b,base.map(v=>v+wobble));
            tri(d,c,b,base.map(v=>v+wobble*.91-.024));
          }
        }
      }));
      const items=[];
      for(const dot of chunk.dots){
        const y=height(dot.x,dot.z);
        if(y<.028 || disturbed.get(dot.id)?.has(dot.order))continue;
        items.push(dot.x,y+dot.size*.32,dot.z,dot.size,...dot.tint);
      }
      setScatter(chunk.scatter,chunk.template,items);
    }
    function exposed(g){
      const state=getState(),cell=cells[g.cell];
      return state.removed>=(g.type===1?70:220) && (state.hits[g.id]||0)<g.req
        && state.depleted[g.cell]<cell.capacity && height(g.x,g.z)>.025;
    }
    function geologyMesh(){
      const state=getState();
      setMesh(outcrop,build(()=>{
        for(const g of geology){
          if(exposed(g))stone({...g,y:height(g.x,g.z)+g.size*.39});
          const amount=state.rubble[g.id]||0;
          if(!amount)continue;
          const rand=random(g.cell*301+15);
          for(let i=0;i<Math.min(16,4+Math.ceil(amount/12));i++){
            const x=g.x+(rand()-.5)*g.size*1.60,z=g.z+(rand()-.5)*g.size*1.60,size=.056+rand()*.112;
            stone({x,z,y:height(x,z)+size*.45,size,seed:i*3.1,mat:g.mat});
          }
        }
      }));
      geologyDirty=false;
    }
    function available(id){
      return id>=0?cells[id].capacity-getState().depleted[id]:0;
    }
    function nearest(x,z,radius,forward=null){
      const state=getState();
      let best=null,score=Infinity;
      for(const cell of cells){
        if(!cell.capacity || state.depleted[cell.id]>=cell.capacity)continue;
        const dx=cell.x-x,dz=cell.z-z,d=Math.hypot(dx,dz);
        if(d>radius||forward&&dx*forward[0]+dz*forward[1]<-.16)continue;
        if(d<score){best=cell;score=d;}
      }
      return best;
    }
    function excavate(x,z,amount,radius){
      const candidates=[];
      for(const cell of cells){
        if(!available(cell.id))continue;
        const d=(cell.x-x)**2+(cell.z-z)**2;
        if(d<=radius**2)candidates.push({cell,d});
      }
      candidates.sort((a,b)=>a.d-b.d);
      let taken=0;
      for(const {cell} of candidates){
        const n=Math.min(available(cell.id),amount-taken);
        getState().depleted[cell.id]+=n;
        taken+=n;
        mark(cell.id);
        if(taken===amount)break;
      }
      return taken;
    }
    function puff(x,z,n,direction=[0,0]){
      const amount=Math.min(R.gl?24:8,Math.max(3,Math.ceil(Math.sqrt(n)*1.7)));
      for(let i=0;i<amount;i++){
        const p=pool[cursor++%pool.length], r=effectRng;
        p.x=x+(r()-.5)*.75;p.z=z+(r()-.5)*.75;p.size=.035+r()*.075;
        p.y=height(p.x,p.z)+p.size+.08;
        p.vx=direction[0]*1.4+(r()-.5)*1.6;p.vz=direction[1]*1.4+(r()-.5)*1.6;p.vy=.9+r()*1.8;
        p.mat=palette[Math.floor(r()*palette.length)];p.seed=r()*65;p.spin=(r()-.5)*8;p.age=0;
      }
      const id=index(x,z);
      if(id>=0){
        const cell=cells[id],c=chunks[Math.floor(cell.row/CHUNK)*chunkCols+Math.floor(cell.col/CHUNK)];
        if(!disturbed.has(id))disturbed.set(id,new Set());
        const holes=disturbed.get(id);
        const dots=c.dots.filter(p=>p.id===id&&!holes.has(p.order)).sort((a,b)=>
          (a.x-x)**2+(a.z-z)**2-(b.x-x)**2-(b.z-z)**2);
        for(const p of dots.slice(0,Math.min(4+Math.floor(n/500),Math.max(0,8-holes.size))))holes.add(p.order);
        dirty.add(c.id);
      }
    }
    function step(dt){
      if(dt<=0)return;
      for(const p of pool){
        if(p.age>=3.8)continue;
        p.age+=dt;
        const before=height(p.x,p.z);
        p.vy-=9.81*dt;
        p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
        const floor=height(p.x,p.z)+p.size*.38;
        if(p.y<floor){
          p.y=floor;p.vy=p.vy<-.45?p.vy*-.33:0;
          const slope=Math.max(0,before-floor+p.size*.38),drag=Math.pow(.17,dt);
          p.vx=p.vx*drag+Math.sign(p.vx)*slope*.85;
          p.vz=p.vz*drag+Math.sign(p.vz)*slope*.85;
        }
        p.seed+=p.spin*dt;
      }
    }
    function parts(x,z){
      for(const id of dirty)rebuild(chunks[id]);
      dirty.clear();
      if(geologyDirty)geologyMesh();
      const list=[{item:staticYard},{item:outcrop}];
      for(const chunk of chunks){
        list.push({item:chunk.core});
        if(Math.hypot(x-chunk.x,z-chunk.z)<(R.gl?23:13))list.push({item:chunk.scatter});
      }
      if(pool.some(p=>p.age<3.8)){
        setMesh(fx,build(()=>{for(const p of pool)if(p.age<3.8)stone(p,true);}),true);
        list.push({item:fx});
      }
      return list;
    }
    invalidate();
    return {height,nearest,available,excavate,puff,step,parts,exposed,mark,invalidate,geology,changed:()=>{geologyDirty=true;}};
  }
  return {TOTAL,pile,truck,shed,delivery,chair,cells,index,spread,createSurface};
})();
