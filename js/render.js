'use strict';

const Rocks = {};
Rocks.render = (() => {
  const canvas = document.querySelector('#game');
  const forceSoftware = new URLSearchParams(location.search).has('software');
  let gl;
  try {
    if (!forceSoftware) gl = canvas.getContext('webgl', {alpha:false, antialias:false, depth:true});
  } catch {}
  const ctx = gl ? null : canvas.getContext('2d');
  const instances = gl?.getExtension('ANGLE_instanced_arrays');
  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const mix = (a, b, t) => a + (b-a)*t;
  const color = h => [0, 2, 4].map(i => parseInt(h.slice(i, i+2), 16)/255);
  const palette = ['a9a69c','b9ae94','777c7b','958477','c6c0a9','656b69','a39285','c5b8a0','7d8179','8d8379','b2a59a'];
  function random(seed) {
    return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  }

  let verts;
  function build(draw) {
    const previous = verts;
    verts = [];
    draw();
    const data = new Float32Array(verts);
    verts = previous;
    return data;
  }

  function tri(a, b, c, mat) {
    const x = b[0]-a[0], y = b[1]-a[1], z = b[2]-a[2];
    const X = c[0]-a[0], Y = c[1]-a[1], Z = c[2]-a[2];
    const nx = y*Z-z*Y, ny = z*X-x*Z, nz = x*Y-y*X;
    const length = Math.hypot(nx,ny,nz) || 1;
    const shade = .73 + .27 * Math.max(0, (nx*-.43 + ny*.86 + nz*.26)/length);
    const rgb = typeof mat === 'string' ? color(mat) : mat;
    for (const v of [a,b,c]) verts.push(v[0],v[1],v[2],rgb[0]*shade,rgb[1]*shade,rgb[2]*shade);
  }
  function quad(a,b,c,d,mat) {
    tri(a,b,c,mat);
    tri(a,c,d,mat);
  }
  function box(x,y,z,w,h,d,mat) {
    const a=x-w/2, b=x+w/2, j=y-h/2, k=y+h/2, e=z-d/2, f=z+d/2;
    const q=[[a,j,e],[b,j,e],[b,j,f],[a,j,f],[a,k,e],[b,k,e],[b,k,f],[a,k,f]];
    for (const [i,o,p,r] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]) {
      quad(q[i],q[o],q[p],q[r],mat);
    }
  }
  function rod(a,b,r,mat,sides=8,endRadius=r) {
    let d=b.map((v,i)=>v-a[i]);
    const length=Math.hypot(...d);
    if(length<.0001)return;
    d=d.map(v=>v/length);
    let u=Math.abs(d[1])<.9?[-d[2],0,d[0]]:[0,d[2],-d[1]];
    const ul=Math.hypot(...u);
    u=u.map(v=>v/ul);
    const v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];
    const A=[],B=[];
    for(let i=0;i<sides;i++){
      const t=i*TAU/sides,o=u.map((q,j)=>q*Math.cos(t)+v[j]*Math.sin(t));
      A.push(a.map((q,j)=>q+o[j]*r));
      B.push(b.map((q,j)=>q+o[j]*endRadius));
    }
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides;
      quad(A[i],A[j],B[j],B[i],mat);
      tri(a,A[j],A[i],mat);
      tri(b,B[i],B[j],mat);
    }
  }
  function cylinder(x,y,z,r,d,mat,axis='x',sides=12) {
    const a=[x,y,z], b=[x,y,z], i='xyz'.indexOf(axis);
    a[i]-=d/2;
    b[i]+=d/2;
    rod(a,b,r,mat,sides);
  }
  function stone({x,y,z,size:s,seed:t,mat}, small=false) {
    const a=[], b=[], sides=small?5:6;
    for(let i=0;i<sides;i++){
      const q=i*TAU/sides+t, rr=s*(.81+.17*Math.sin(i*2.8+t));
      a.push([x+Math.cos(q)*rr,y-s*.37,z+Math.sin(q)*rr]);
      if(!small) b.push([x+Math.cos(q+.24)*rr*.83,y+s*(.15+.15*Math.sin(i+t)),z+Math.sin(q+.24)*rr*.83]);
    }
    const top=[x+s*.18*Math.sin(t),y+s*.64,z+s*.18*Math.cos(t)];
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides;
      if(small) tri(a[j],a[i],top,mat);
      else {
        quad(a[j],a[i],b[i],b[j],mat);
        tri(b[j],b[i],top,mat);
      }
    }
  }

  // Matrices store three affine rows. Models face local +Z.
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0];
  function transform(x=0,y=0,z=0,rx=0,ry=0,rz=0,s=1) {
    const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz);
    return [
      (c*e+d*b*f)*s,(-c*f+d*b*e)*s,d*a*s,x,
      a*f*s,a*e*s,-b*s,y,
      (-d*e+c*b*f)*s,(d*f+c*b*e)*s,c*a*s,z
    ];
  }
  function worldPose(x,y,z,yaw) {
    const c=Math.cos(yaw),s=Math.sin(yaw);
    return [c,0,s,x, 0,1,0,y, s,0,-c,z];
  }
  function compose(a,b) {
    const out = new Array(12);
    for(let row=0;row<12;row+=4){
      for(let i=0;i<4;i++) out[row+i]=a[row]*b[i]+a[row+1]*b[i+4]+a[row+2]*b[i+8];
      out[row+3]+=a[row+3];
    }
    return out;
  }
  function point(m,x,y,z) {
    return [m[0]*x+m[1]*y+m[2]*z+m[3],m[4]*x+m[5]*y+m[6]*z+m[7],m[8]*x+m[9]*y+m[10]*z+m[11]];
  }
  function join(parts) {
    const out = new Float32Array(parts.reduce((n,p)=>n+p.data.length,0));
    let offset=0;
    for(const {data,m=identity} of parts){
      for(let i=0;i<data.length;i+=6){
        out.set(point(m,data[i],data[i+1],data[i+2]),offset);
        out[offset+3]=data[i+3];out[offset+4]=data[i+4];out[offset+5]=data[i+5];
        offset+=6;
      }
    }
    return out;
  }

  let program, attr, uniform;
  if(gl){
    const vertex=`
      attribute vec3 p,c;
      attribute vec4 instance;
      attribute vec3 tint;
      uniform vec4 m0,m1,m2;
      uniform vec3 eye,right,up,forward;
      uniform vec2 scale;
      uniform float instanced;
      varying vec3 rgb;
      varying float dist;
      void main(){
        vec3 q = mix(p,p*instance.w+instance.xyz,instanced);
        vec4 v=vec4(q,1.);
        vec3 d=vec3(dot(m0,v),dot(m1,v),dot(m2,v))-eye;
        float z=dot(d,forward);
        gl_Position=vec4(dot(d,right)*scale.x,dot(d,up)*scale.y,1.001*z-.16,z);
        rgb=c*mix(vec3(1.),tint,instanced);
        dist=z;
      }
    `;
    const fragment=`
      precision mediump float;
      varying vec3 rgb;
      varying float dist;
      void main(){gl_FragColor=vec4(mix(rgb,vec3(.65,.76,.80),smoothstep(22.,60.,dist)),1.);}
    `;
    function shader(type,source){
      const item=gl.createShader(type);
      gl.shaderSource(item,source);
      gl.compileShader(item);
      if(!gl.getShaderParameter(item,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(item));
      return item;
    }
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    attr=Object.fromEntries(['p','c','instance','tint'].map(k=>[k,gl.getAttribLocation(program,k)]));
    uniform=Object.fromEntries(['eye','right','up','forward','scale','m0','m1','m2','instanced'].map(k=>[k,gl.getUniformLocation(program,k)]));
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(.57,.72,.80,1);
  }

  function setMesh(mesh,data,dynamic=false) {
    mesh.data=data;
    if(gl){
      mesh.buffer ||= gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,data,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
    }
    return mesh;
  }
  const mesh = data => setMesh({},data);
  function setScatter(group,template,items) {
    if(!instances){
      const data=new Float32Array(items.length/7*template.data.length);
      let o=0;
      for(let i=0;i<items.length;i+=7) for(let k=0;k<template.data.length;k+=6) {
        const d=template.data, s=items[i+3];
        data[o++]=d[k]*s+items[i];data[o++]=d[k+1]*s+items[i+1];data[o++]=d[k+2]*s+items[i+2];
        data[o++]=d[k+3]*items[i+4];data[o++]=d[k+4]*items[i+5];data[o++]=d[k+5]*items[i+6];
      }
      return setMesh(group,data.slice(0,o));
    }
    group.template=template;
    group.count=items.length/7;
    group.scatter ||= gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,group.scatter);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(items),gl.STATIC_DRAW);
    return group;
  }
  function bind(item) {
    gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);
    gl.vertexAttribPointer(attr.p,3,gl.FLOAT,false,24,0);
    gl.vertexAttribPointer(attr.c,3,gl.FLOAT,false,24,12);
    gl.enableVertexAttribArray(attr.p);
    gl.enableVertexAttribArray(attr.c);
  }
  function drawGL(parts) {
    let previous;
    for(const {item,m=identity} of parts){
      if(m!==previous){
        gl.uniform4f(uniform.m0,...m.slice(0,4));
        gl.uniform4f(uniform.m1,...m.slice(4,8));
        gl.uniform4f(uniform.m2,...m.slice(8,12));
        previous=m;
      }
      if(item.template){
        if(!item.count) continue;
        bind(item.template);
        gl.uniform1f(uniform.instanced,1);
        gl.bindBuffer(gl.ARRAY_BUFFER,item.scatter);
        gl.vertexAttribPointer(attr.instance,4,gl.FLOAT,false,28,0);
        gl.vertexAttribPointer(attr.tint,3,gl.FLOAT,false,28,16);
        for(const id of [attr.instance,attr.tint]){
          gl.enableVertexAttribArray(id);
          instances.vertexAttribDivisorANGLE(id,1);
        }
        instances.drawArraysInstancedANGLE(gl.TRIANGLES,0,item.template.data.length/6,item.count);
        for(const id of [attr.instance,attr.tint]){
          instances.vertexAttribDivisorANGLE(id,0);
          gl.disableVertexAttribArray(id);
        }
        gl.uniform1f(uniform.instanced,0);
      } else if(item.data?.length) {
        bind(item);
        gl.drawArrays(gl.TRIANGLES,0,item.data.length/6);
      }
    }
  }
  function axes({x,y,z,yaw,pitch,local=false}){
    if(local)return {eye:[0,0,0],right:[1,0,0],up:[0,1,0],forward:[0,0,1]};
    const c=Math.cos(yaw), s=Math.sin(yaw), p=Math.cos(pitch), q=Math.sin(pitch);
    return {eye:[x,y,z],right:[c,0,s],up:[-s*q,p,c*q],forward:[s*p,q,-c*p]};
  }
  const f=1/Math.tan(65*Math.PI/360);
  function drawCanvas(parts,camera){
    const {eye,right,up,forward}=axes(camera);
    const w=canvas.width,h=canvas.height,half=h/2*f, list=[];
    const dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
    for(const {item,m=identity} of parts){
      const data=item.data || [];
      for(let k=0;k<data.length;k+=18){
        const a=[];
        for(let j=0;j<3;j++){
          const i=k+j*6,v=point(m,data[i],data[i+1],data[i+2]);
          for(let l=0;l<3;l++)v[l]-=eye[l];
          a.push([dot(v,right),dot(v,up),dot(v,forward)]);
        }
        const near=.10, clip=[];
        if(a.every(v=>v[2]<near))continue;
        for(let i=0;i<3;i++){
          const v=a[i],n=a[(i+1)%3],inside=v[2]>=near;
          if(inside)clip.push(v);
          if(inside!==(n[2]>=near)){
            const t=(near-v[2])/(n[2]-v[2]);
            clip.push([mix(v[0],n[0],t),mix(v[1],n[1],t),near]);
          }
        }
        const pts=clip.map(v=>[w/2+v[0]*half/v[2],h/2-v[1]*half/v[2]]);
        if(pts.every(v=>v[0]<0)||pts.every(v=>v[0]>w)||pts.every(v=>v[1]<0)||pts.every(v=>v[1]>h))continue;
        const area=(pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-(pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0]);
        if(Math.abs(area)<.12)continue;
        list.push({pts,d:clip.reduce((sum,v)=>sum+v[2],0)/clip.length,c:k,data});
      }
    }
    list.sort((a,b)=>b.d-a.d);
    for(const {pts,c,data} of list){
      ctx.fillStyle=ctx.strokeStyle='rgb('+[3,4,5].map(i=>Math.round(data[c+i]*255)).join(',')+')';
      ctx.lineWidth=.55;
      ctx.beginPath();
      pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  function draw(scene,viewModel,camera) {
    if(!gl&&!ctx)return;
    const density=Math.min(devicePixelRatio||1,gl?1.5:1);
    const w=Math.max(1,Math.round(canvas.clientWidth*density)),h=Math.max(1,Math.round(canvas.clientHeight*density));
    if(canvas.width!==w||canvas.height!==h){
      canvas.width=w;canvas.height=h;
      gl?.viewport(0,0,w,h);
    }
    if(!gl){
      ctx.fillStyle='#92b8cc';
      ctx.fillRect(0,0,w,h);
      drawCanvas(scene,camera);
      drawCanvas(viewModel,{local:true});
      return;
    }
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(uniform.scale,f*h/w,f);
    for(const [key,v] of Object.entries(axes(camera)))gl.uniform3f(uniform[key],...v);
    drawGL(scene);
    if(viewModel.length){
      gl.clear(gl.DEPTH_BUFFER_BIT);
      for(const [key,v] of Object.entries(axes({local:true})))gl.uniform3f(uniform[key],...v);
      drawGL(viewModel);
    }
  }
  return {canvas,gl,available:!!(gl||ctx),TAU,clamp,mix,color,palette,random,build,tri,quad,box,rod,cylinder,stone,identity,transform,worldPose,compose,point,join,mesh,setMesh,setScatter,draw};
})();
