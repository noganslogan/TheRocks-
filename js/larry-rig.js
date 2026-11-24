'use strict';

Rocks.skin = (data,{colors={},width=1,height=1,head=1}={}) => {
  const {coords,indices,rgb,weights,clips,bones,materials,materialIds}=data;
  const {setMesh,clamp}=Rocks.render;
  for(const clip of Object.values(clips)){
    if(clip.frames)continue;
    const binary=atob(clip.matrices), bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    clip.frames=new DataView(bytes.buffer);
    delete clip.matrices;
  }
  const stride=bones*12, matrices=new Float32Array(stride);
  const positions=new Float32Array(coords.length), vertices=new Float32Array(indices.length*6);
  const item={};
  for(let i=0;i<indices.length;i++){
    const c=i-i%3, j=i*6;
    const color=materialIds&&colors[materials[materialIds[c/3]]];
    const light=color?Math.max(rgb[c],rgb[c+1],rgb[c+2])/255*.26+.75:1;
    vertices[j+3]=color?color[0]*light:rgb[c]/255;
    vertices[j+4]=color?color[1]*light:rgb[c+1]/255;
    vertices[j+5]=color?color[2]*light:rgb[c+2]/255;
  }
  let clipBefore=null, phaseBefore=-1;
  function part(name,time,m){
    const clip=clips[name]||clips.stand;
    const phase=Math.min(clip.count-1,Math.floor((clip.loop?time%clip.duration:Math.min(clip.duration,time))*15*2)/2);
    if(clip!==clipBefore||phase!==phaseBefore){
      clipBefore=clip;
      phaseBefore=phase;
      const floor=Math.floor(phase), ceil=Math.min(floor+1,clip.count-1);
      const blend=clamp(phase-floor,0,1), a=floor*stride,b=ceil*stride;
      for(let i=0;i<stride;i++){
        const l=clip.frames.getInt16((a+i)*2,true), r=clip.frames.getInt16((b+i)*2,true);
        matrices[i]=(l+(r-l)*blend)*.0001;
      }
      for(let v=0;v<weights.length;v++){
        const i=v*3, x=coords[i],y=coords[i+1],z=coords[i+2], influence=weights[v];
        for(let row=0;row<3;row++){
          let n=0;
          for(let j=0;j<influence.length;j+=2){
            const k=influence[j]*12+row*4;
            n+=(matrices[k]*x+matrices[k+1]*y+matrices[k+2]*z+matrices[k+3])*influence[j+1];
          }
          positions[i+row]=n;
        }
      }
      for(let i=0;i<indices.length;i++){
        const p=indices[i]*3, v=i*6;
        const shape=coords[p+1]>1.485?head:width;
      vertices[v]=positions[p]*shape;
      vertices[v+1]=positions[p+1]*height;
      vertices[v+2]=positions[p+2];
      }
      setMesh(item,vertices,true);
    }
    return {item,m};
  }
  return {part};
};

Rocks.larry = Rocks.skin(Rocks.larryData);
