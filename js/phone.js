'use strict';

Rocks.phone = function({getState,save,interrupt,hired}){
  const B=Rocks.backyard;
  const $=selector=>document.querySelector(selector), button=$('#phoneToggle'), panel=$('#phoneOverlay');
  const thread=$('#phoneThread'), title=$('#phoneTitle'), meta=$('#phoneMeta'), footer=$('#phoneActions');
  let visible=false, tab='texts', audio=null, serial=-1;

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
  const replyLines=['On it.','Still here. Still rocks.','I’ll grab it on the way home.'];
  function controls(actions){
    footer.replaceChildren();
    for(const [label,className,fn,disabled=false] of actions){
      const control=document.createElement('button');
      control.type='button';control.textContent=label;control.className=className;control.disabled=disabled;
      if(fn)control.onclick=fn;
      footer.append(control);
    }
  }
  function respond(text){
    const p=getState().phone;
    B.record(p,'me',text);
    p.unread=false;p.notify=0;p.nextNag=p.ring?p.time+18:0;
    save();render();
  }
  function answer(){
    const p=getState().phone;
    p.ring=false;p.active=true;p.callAge=0;p.notify=0;
    B.record(p,'log','Answered call');
    p.callIndex++;
    save();render();
  }
  function hangup(){
    const p=getState().phone;
    p.active=false;p.ring=false;p.nextNag=p.unread?p.time+32:0;
    B.record(p,'log','Call ended');
    save();render();
  }
  function timeLabel(n){
    return Math.floor(n/60)+':'+String(Math.floor(n)%60).padStart(2,'0');
  }
  function render(){
    shortcuts();
    if(!visible)return;
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
      thread.append(textNode('call-card',p.active?B.calls[(p.callIndex-1)%B.calls.length]:'Your wife is calling.'));
      controls(p.active?[['End call','decline',hangup]]:[['Answer','answer',answer],['Put away','quiet',close]]);
    }else if(tab==='buddies'){
      const next=state.buddies.length;
      B.buddies.forEach((b,i)=>{
        const row=textNode('contact','');
        row.append(textNode('contact-name',b.name));
        row.append(textNode('contact-status',i<next?'On the job':i===next?b.cost.toLocaleString('en-US')+' rocks':'Locked'));
        thread.append(row);
      });
      const buddy=B.buddies[next];
      controls(buddy?[[`Call ${buddy.name}`,'answer',()=>{if(hired(next))render();},state.credits<buddy.cost]]:
        [['Crew is on the job','quiet',null,true]]);
    }else{
      for(const [who,text] of p.chat)thread.append(textNode('bubble '+who,text));
      if(!p.chat.length)thread.append(textNode('call-card','No messages yet.'));
      thread.scrollTop=thread.scrollHeight;
      controls(p.unread?replyLines.map(text=>[text,'reply',()=>respond(text)]):[['Put away','quiet',close]]);
    }
  }
  function tick(dt){
    const p=getState().phone, event=B.timetable(p,dt);
    if(event==='ended'){
      render();save();
    }else if(event){
      open('texts');
      ring(event==='call');
      save();
    }else if(visible&&p.active&&serial!==Math.floor(p.callAge)){
      serial=Math.floor(p.callAge);
      meta.textContent='Connected · '+timeLabel(p.callAge);
    }
  }
  button.onclick=()=>{arm();if(visible)close();else open();};
  $('#phoneClose').onclick=close;
  $('#phoneTexts').onclick=()=>{tab='texts';render();};
  $('#phoneBuddies').onclick=()=>{tab='buddies';render();};
  shortcuts();
  return {open,close,tick,arm,visible:()=>visible,refresh:render};
};
