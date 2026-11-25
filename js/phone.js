'use strict';

Rocks.phone = function({getState,save,interrupt,hired,setJob,upgrade}){
  const B=Rocks.backyard, C=Rocks.crew, W=Rocks.wife;
  const $=selector=>document.querySelector(selector), button=$('#phoneToggle'), panel=$('#phoneOverlay');
  const thread=$('#phoneThread'), title=$('#phoneTitle'), meta=$('#phoneMeta'), footer=$('#phoneActions');
  let visible=false, tab='texts', audio=null, serial=-1, selected=null;
  let crewStatus=[], wasParked=false;

  function arm(){
    try{
      const Engine=window.AudioContext||window.webkitAudioContext;
      if(!audio&&Engine)audio=new Engine();
      if(audio?.state==='suspended')audio.resume()?.catch(()=>{});
    }catch{}
  }
  function ring(call){
    if(!audio||audio.state!=='running')return;
    const now=audio.currentTime;
    const melody=call?[530,660,530,660]:[610,820];
    melody.forEach((hz,index)=>{
      const t=now+index*.16, wave=audio.createOscillator(), level=audio.createGain();
      wave.type='sine';wave.frequency.value=hz;
      level.gain.setValueAtTime(.001,t);
      level.gain.exponentialRampToValueAtTime(.085,t+.028);
      level.gain.exponentialRampToValueAtTime(.001,t+.13);
      wave.connect(level);level.connect(audio.destination);
      wave.start(t);wave.stop(t+.14);
    });
  }
  function shortcuts(){
    const p=getState().phone;
    button.textContent=p.ring?'CALL':p.unread?'PHONE •':'PHONE';
    button.classList.toggle('urgent',p.unread||p.ring);
  }
  function open(next='texts'){
    visible=true;tab=next;
    panel.hidden=false;panel.classList.add('raised');
    interrupt();render();
  }
  function close(){
    if(!visible)return;
    visible=false;
    panel.hidden=true;panel.classList.remove('raised');
    interrupt();save();
  }
  function textNode(className,text){
    const node=document.createElement('div');
    node.className=className;
    node.textContent=text;
    return node;
  }
  function controls(actions){
    footer.replaceChildren();
    for(const [label,className,fn,disabled=false] of actions){
      const control=document.createElement('button');
      control.type='button';control.textContent=label;control.className=className;control.disabled=disabled;
      if(fn)control.onclick=fn;
      footer.append(control);
    }
  }
  function respond(call,index){
    if(W.respond(getState(),call,index)){save();render();}
  }
  function answer(){
    W.answer(getState());save();render();
  }
  function hangup(){
    W.hangup(getState().phone);save();render();
  }
  function replyOptions(p,call){
    return W.choices(p,call).map((choice,i)=>[choice.text,'reply',()=>respond(call,i)]);
  }
  function timeLabel(n){
    return Math.floor(n/60)+':'+String(Math.floor(n)%60).padStart(2,'0');
  }
  function crewButton(label,fn,disabled=false){
    const button=document.createElement('button');
    button.type='button';button.textContent=label;button.disabled=disabled;
    if(fn)button.onclick=fn;
    return button;
  }
  function drawCrew(state){
    crewStatus=[];
    if(selected!==null&&!state.buddies[selected])selected=null;
    if(selected!==null){
      const i=selected,b=state.buddies[i], person=B.buddies[i], d=state.crewDozer;
      wasParked=d?.driver===i&&d.phase==='parked';
      title.textContent=person.name;
      const summary=textNode('crew-summary',C.status(state,b,i));
      crewStatus.push([i,summary]);
      thread.append(crewButton('‹ All buddies',()=>{selected=null;render();}),summary);
      const jobs=textNode('crew-jobs','');
      const assign=(label,job,disabled=false)=>jobs.append(crewButton(label,()=>{if(setJob(i,job))render();},disabled));
      if(d?.driver===i){
        if(d.phase==='parked')assign('Resume bulldozer','resume');
        else assign(d.reclaim?'Parking…':'Park bulldozer','park',d.reclaim);
      }else{
        assign('Haul','haul',b.job==='haul');
        assign('Rest','rest',b.job==='rest');
        assign('Assign bulldozer','dozer',!state.owned.includes(C.DOZER)||b.training<3||b.job==='dozer'||!!d);
      }
      thread.append(jobs);
      for(const u of C.training){
        const row=textNode('crew-upgrade',''), price=C.price(b,i,u.key);
        row.append(textNode('contact-name',u.name+' · '+(u.key==='training'?C.rankNames[b.training]:'Lv '+b[u.key])));
        row.append(crewButton(price?price.toLocaleString('en-US')+' rocks':'Maxed',()=>{if(upgrade(i,u.key))render();},
          !price||state.credits<price));
        thread.append(row);
      }
      controls([['Put away','quiet',close]]);
      return;
    }
    const next=state.buddies.length;
    B.buddies.forEach((b,i)=>{
      const row=textNode('contact','');
      const status=textNode('contact-status',i<next?C.status(state,state.buddies[i],i):i===next?b.cost.toLocaleString('en-US')+' rocks':'Locked');
      row.append(i<next?crewButton(b.name,()=>{selected=i;render();}):textNode('contact-name',b.name),status);
      if(i<next)crewStatus.push([i,status]);
      thread.append(row);
    });
    const buddy=B.buddies[next];
    controls(buddy?[[`Call ${buddy.name}`,'answer',()=>{if(hired(next))render();},state.credits<buddy.cost]]:
      [['Manage a buddy above','quiet',null,true]]);
  }
  function render(){
    shortcuts();
    if(!visible)return;
    crewStatus=[];
    const state=getState(), p=state.phone;
    const isCall=p.ring||p.active;
    title.textContent=tab==='buddies'&&!isCall?'Call a buddy':'Wife';
    meta.textContent=isCall?(p.active?'Connected · '+timeLabel(p.callAge):'Incoming call'):tab==='buddies'?'Your contacts':'Messages';
    panel.classList.toggle('call',isCall);
    $('#phoneTabs').hidden=isCall;
    $('#phonePortrait').hidden=tab==='buddies'&&!isCall;
    $('#phoneTexts').setAttribute('aria-pressed',String(tab==='texts'));
    $('#phoneBuddies').setAttribute('aria-pressed',String(tab==='buddies'));
    thread.replaceChildren();
    if(isCall){
      serial=Math.floor(p.callAge);
      if(p.active){
        for(const [who,line] of p.callChat)thread.append(textNode('bubble '+who,line));
        thread.scrollTop=thread.scrollHeight;
        controls([...replyOptions(p,true),['End call','decline',hangup]]);
      }else{
        thread.append(textNode('call-card','Your wife is calling.'));
        controls([['Answer','answer',answer],['Put away','quiet',close]]);
      }
    }else if(tab==='buddies'){
      drawCrew(state);
    }else{
      for(const [who,text] of p.chat)thread.append(textNode('bubble '+who,text));
      if(!p.chat.length)thread.append(textNode('call-card','No messages yet.'));
      thread.scrollTop=thread.scrollHeight;
      controls(p.unread?replyOptions(p,false):[['Put away','quiet',close]]);
    }
  }
  function tick(dt){
    const state=getState(),p=state.phone,event=W.tick(state,dt);
    if(event==='ended'){
      render();save();
    }else if(event){
      open('texts');
      ring(event==='call');
      save();
    }else if(visible&&p.active&&serial!==Math.floor(p.callAge)){
      serial=Math.floor(p.callAge);
      meta.textContent='Connected · '+timeLabel(p.callAge);
    }else if(visible&&tab==='buddies'){
      const s=getState(),d=s.crewDozer;
      if(selected!==null&&d?.driver===selected&&wasParked!==(d.phase==='parked')){render();return;}
      for(const [i,node] of crewStatus){
        const label=C.status(s,s.buddies[i],i);
        if(node.textContent!==label)node.textContent=label;
      }
    }
  }
  button.onclick=()=>{arm();if(visible)close();else open();};
  $('#phoneClose').onclick=close;
  $('#phoneTexts').onclick=()=>{tab='texts';render();};
  $('#phoneBuddies').onclick=()=>{tab='buddies';render();};
  shortcuts();
  return {open,close,tick,arm,visible:()=>visible,refresh:render};
};
