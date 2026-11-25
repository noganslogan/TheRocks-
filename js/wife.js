'use strict';

Rocks.wife = (() => {
  const {clamp}=Rocks.render;
  const reply=(text,answer,next=null,plan=null,tone=0)=>({text,answer,next,plan,tone});
  const nodes={
    eta:{line:'Are you almost done? How long is this going to take?',choices:[
      reply('Give me ten minutes.','Okay.','etaTen',{eta:'soon'},1),
      reply('There are a billion rocks.','A BILLION? That man told me “a few rocks.”','etaLarry',{eta:'long'}),
      reply('Could you come help?','I can bring water.','water',{eta:'long'},1)
    ]},
    etaTen:{line:'Ten actual minutes or ten Larry minutes?',choices:[
      reply('Actual minutes. I’ll text when I’m done.','All right. I’ll check back if I don’t hear from you.',null,{eta:'soon'},1),
      reply('Larry minutes. I have no idea.','That sounds more believable. I’ll leave dinner in the oven.',null,{eta:'long'}),
      reply('I retract my estimate.','Good. I’m making plans that involve a clock.',null,{eta:'long'},-1)
    ]},
    etaLarry:{line:'What is Larry doing while you move the billion rocks?',choices:[
      reply('He’s sitting in a lawn chair.','Of course he is. I bet he calls that supervising.',null,{larry:'chair'}),
      reply('He was very helpful at pointing.','Ask him to point at the cold drinks next.',null,{larry:'pointing'}),
      reply('He hired me by talking to you.','I’m going to remember exactly how you phrased that.',null,{larry:'volunteered'},-1)
    ]},
    water:{line:'Did Larry at least offer you a water?',choices:[
      reply('He offered me a plastic cup.','For water or for rocks? Actually, I know the answer.',null,{water:'cup'}),
      reply('I’m good, but thanks for asking.','Okay. Drink something before your only skill is stubbornness.',null,{water:'fine'},1),
      reply('Bring the big bottle, please.','I’ll bring it when I come by. Don’t fill it with rocks.',null,{water:'bring'},1)
    ]},
    groceries:{line:'Can you please remember to bring eggs, milk, bread, celery, and a collagen night wrapping mask on your way home?',choices:[
      reply('Yep, I’ll get the whole list.','Thank you. Do you remember which eggs?', 'eggs',{groceries:'you'},1),
      reply('Which collagen mask?', 'The pink box.', 'mask'),
      reply('Can you get groceries? I’m going to be a while.',null,'groceryShare',{eta:'long'})
    ]},
    eggs:{line:'Get the eggs with the blue label. The other blue label.',choices:[
      reply('I’ll send a picture before buying them.','Perfect. This is the most organized either of us has been all day.',null,{eggs:'photo'},1),
      reply('I’ll get the ones we always buy.','You’re thinking of the old blue label. Please send a picture.',null,{eggs:'usual'})
    ]},
    mask:{line:'Can you send a photo if there are three pink boxes?',choices:[
      reply('Send me the brand and I’ll match it.','Biodance. The pink one. Thank you for asking before going rogue.',null,{groceries:'you',mask:'brand'},1),
      reply('I’ll bring the groceries. You pick the mask.','Deal. I’ve seen you buy the wrong aluminum foil.',null,{groceries:'split',mask:'wife'})
    ]},
    groceryShare:{line:'I’ll do the grocery run. Can you grab the bread on your way home?',choices:[
      reply('I can grab bread.','Deal. The loaf with the green twist tie.',null,{groceries:'bread'},1),
      reply('Can we skip the store tonight?','Okay. We can work with what we have for one dinner.',null,{groceries:'skip'})
    ]},
    kitchen:{line:'When you get home you’re cleaning the kitchen. I’m not your maid.',choices:[
      reply('I’ll do the dishes and counters.','Thank you.','sink',{kitchen:'you'},1),
      reply('Can we split it after dinner?',null,'kitchenSplit'),
      reply('I can bring one of the guys over.','I will absolutely not have a rock crew in my kitchen.',null,{kitchen:'unsettled'},-1)
    ]},
    sink:{line:'Can you do the sink too, while you’re at it?',choices:[
      reply('Yep. Whole kitchen.','I appreciate it. Please remember the sponge lives under the sink.',null,{kitchen:'you'},1),
      reply('I can do the sink tomorrow morning.','Okay. I’m counting that as a real plan.',null,{kitchen:'tomorrow'})
    ]},
    kitchenSplit:{line:'I can do the counters. You do dishes and the sink?',choices:[
      reply('Deal.','Great. We both know what we’re doing now.',null,{kitchen:'split'},1),
      reply('Actually, I’ll take all of it.','Okay. I’ll make dinner while you finish up.',null,{kitchen:'you'},1)
    ]},
    equipment:{line:'Larry sent me a picture of the yard. Please tell me that equipment is borrowed.',choices:[
      reply('It was paid for with rocks.','Okay, define “paid for.” Do I have an invoice to worry about?', 'invoice'),
      reply('It makes the job go faster.','So does asking Larry to help. Did you try that?', 'etaLarry'),
      reply('Would it help if I said there’s a permit?', 'The fact that you need a permit means I have new questions. Are we still talking about a backyard?', 'invoice',{equipment:'permit'})
    ]},
    invoice:{line:'Am I going to see any of this on the electric bill?',choices:[
      reply('That’s Larry’s electric bill.','I knew it. He asked me the same thing ten minutes ago.',null,{equipment:'larry'}),
      reply('I promise to put everything back.','Including the lawn. Don’t forget the lawn.',null,{equipment:'promised'},1),
      reply('I think this is a separate conversation.','I think so too. You can tell me the whole story when you get home.',null,{equipment:'unsettled'},-1)
    ]},
    progress:{line:s=>'Larry says you’re doing great. You’ve moved '+s.removed.toLocaleString('en-US')+' rocks. How much longer, honestly?',choices:[
      reply('I’m getting into a rhythm.','Good. Let me know if “a rhythm” turns into dinner by yourself.',null,{eta:'long'}),
      reply('I’m close enough to start thinking about dinner.','Good. Text me when you leave and I’ll start warming it up.',null,{eta:'soon'},1),
      reply('I need a break more than an estimate.','Take one. I volunteered you for a favor, not a double shift.',null,{water:'break'},1)
    ]},
    callback:{line:'It’s been ten minutes. Are these actual minutes or did Larry change the clocks?',choices:[
      reply('I underestimated it. Eat without me.','Okay. I’ll save you a plate.',null,{eta:'long'}),
      reply('I really am wrapping up.','All right. Text me on your way out instead of giving me another number.',null,{eta:'leaving'},1)
    ]},
    checkin:{line:s=>s.phone.tone<0?'Can we have one conversation without making it about Larry? How are you doing?':'Real question. How are you doing out there?',choices:[
      reply('Tired, but I’m doing alright.','Okay. Thanks for checking in. I mean it.',null,{water:'fine'},1),
      reply('I could use a break.','Take a few minutes. The yard will still be there.',null,{water:'break'},1),
      reply('I have become the rocks.','Well, tell the rocks they’re still invited to dinner.',null,{water:'joke'})
    ]},
    finish:{line:s=>s.phone.plan.groceries==='you'?'You actually finished? Okay. And the list still stands on the way home.':'You actually finished? I’m proud of you. What are you doing first?',choices:[
      reply('Coming home.','Good. Leave your shoes outside. I’m glad you’re done.',null,{eta:'leaving'},1),
      reply('Taking a photo. Nobody will believe this.','Send me one before Larry puts down the patio furniture.',null,{eta:'leaving'},1),
      reply('I’m never looking at a rock again.','Fair. I’ll take the decorative bowl off the coffee table.',null,{eta:'leaving'})
    ]},
    callEta:{line:'Hey. I thought this was going to take like an hour.',choices:[
      reply('You said it was a few rocks.','That was Larry’s description.','etaLarry'),
      reply('I’m making progress. How’s it going at home?','Better now. The kitchen still has to get done, though.', 'kitchenSplit'),
      reply('Can we talk while I take a break?','Of course.','checkin',null,1)
    ]},
    callPlans:{line:s=>s.phone.plan.groceries==='bread'?'I’m at the store. Are you still grabbing the bread?':
      s.phone.plan.groceries==='split'?'I found the mask. How’s your half of the grocery run looking?':
      'I’m looking at the grocery list. Are you still getting it on your way home?',choices:[
      reply('Yep. I’ve still got it.','Thanks. I appreciate you remembering.',null,null,1),
      reply('Can we change the plan? I’m still in the yard.','Sure. I can grab it. How much longer will you be?', 'progress',{groceries:'wife'})
    ]},
    callSoon:{line:'I know you said ten minutes. Should I keep dinner warm?',choices:[
      reply('Eat without me. Save me a plate?','Yep. I’ll put it in the fridge for you.',null,{eta:'long'},1),
      reply('I’m almost out of the yard.','Okay. I’ll warm yours up when I hear the door.',null,{eta:'leaving'},1)
    ]},
    callEquipment:{line:'Is that a machine I can hear? Please tell me you borrowed it.',choices:[
      reply('It’s difficult to explain.','Then start with the electric bill.', 'invoice'),
      reply('It’s helping. I’m nearly done.','I’ll take nearly done. Please tell Larry to stop sending videos.',null,{eta:'soon'})
    ]}
  };
  const texts=['eta','groceries','kitchen','progress','water','checkin'];
  const nags=['Hello…?','??','I know you have your phone.','Can you at least say you saw this?','Never mind. Call me.'];
  const hasNode=id=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(nodes,id);
  const int=(n,max)=>Number.isFinite(n)?clamp(Math.floor(n),0,max):0;
  const elapsed=(n,max)=>Number.isFinite(n)?clamp(n,0,max):0;
  const isOwner=(s)=>s.tech.gantry||s.tech.drones||s.owned.some(i=>i>=13);
  function fresh(){
    return {time:0,nextText:300,nextCall:1800,nextNag:0,textIndex:0,callIndex:0,notify:0,ring:false,active:false,
      callAge:0,callIdle:0,unread:false,chat:[],callChat:[],textNode:null,callNode:null,plan:{},tone:0,followAt:0,finished:false};
  }
  function history(raw,max){
    return Array.isArray(raw)?raw.slice(-max).filter(m=>Array.isArray(m)&&m.length===2&&
      ['wife','me','log'].includes(m[0])&&typeof m[1]==='string').map(([a,b])=>[a,b.slice(0,350)]):[];
  }
  function restore(raw){
    const p=fresh();
    if(!raw||!Number.isFinite(raw.time))return p;
    p.time=elapsed(raw.time,1e9);
    p.nextText=elapsed(raw.nextText,1e9)||300;p.nextCall=elapsed(raw.nextCall,1e9)||1800;
    p.nextNag=elapsed(raw.nextNag,1e9);p.textIndex=int(raw.textIndex,1e9);
    p.callIndex=int(raw.callIndex,1e9);p.notify=int(raw.notify,1e9);
    p.ring=!!(raw.ring||raw.active);
    p.chat=history(raw.chat,40);p.callChat=history(raw.callChat,16);
    p.callNode=p.ring&&hasNode(raw.callNode)?raw.callNode:null;
    p.textNode=hasNode(raw.textNode)?raw.textNode:null;
    if(raw.unread&&!p.textNode){
      const last=p.chat.findLast?.(([who])=>who==='wife')?.[1]||'';
      p.textNode=texts.find(k=>nodes[k].line===last)||(p.textIndex>0?texts[(p.textIndex-1)%texts.length]:'eta');
    }
    p.unread=!!p.textNode;
    p.tone=Number.isFinite(raw.tone)?clamp(Math.trunc(raw.tone),-4,4):0;
    p.followAt=elapsed(raw.followAt,1e9);p.finished=raw.finished===true;
    for(const key of ['eta','larry','water','groceries','eggs','mask','kitchen','equipment']){
      if(typeof raw.plan?.[key]==='string'&&raw.plan[key].length<40)p.plan[key]=raw.plan[key];
    }
    return p;
  }
  function record(p,who,message,call=false){
    const list=call?p.callChat:p.chat;
    list.push([who,message]);
    if(list.length>(call?16:40))list.shift();
  }
  function line(s,id){
    const value=nodes[id].line;
    return typeof value==='function'?value(s):value;
  }
  function prompt(s,id,call){
    const p=s.phone;
    if(call)p.callNode=id;
    else{p.textNode=id;p.unread=true;p.nextNag=p.time+32;}
    record(p,'wife',line(s,id),call);
  }
  function choices(p,call){
    const key=call?p.callNode:p.textNode;
    return hasNode(key)?nodes[key].choices:[];
  }
  function respond(s,call,index){
    const p=s.phone, choice=choices(p,call)[index];
    if(!choice||(call?!p.active:!p.unread))return false;
    record(p,'me',choice.text,call);
    if(choice.answer)record(p,'wife',choice.answer,call);
    if(choice.plan){
      Object.assign(p.plan,choice.plan);
      if(choice.plan.eta){
        if(choice.plan.eta==='soon'&&p.followAt===0)p.followAt=p.time+600;
        else if(choice.plan.eta!=='soon')p.followAt=0;
      }
    }
    p.tone=clamp(p.tone+choice.tone,-4,4);
    p.notify=0;
    if(call){
      p.callNode=null;p.callIdle=0;
    }else{
      p.textNode=null;p.unread=false;p.nextNag=p.ring?p.time+18:0;
    }
    if(choice.next)prompt(s,choice.next,call);
    return true;
  }
  function answer(s){
    const p=s.phone;
    if(!p.ring)return;
    p.ring=false;p.active=true;p.callAge=0;p.callIdle=0;p.notify=0;
    record(p,'log','Answered call');
    if(p.callNode&&p.callChat.length)return;
    p.callChat=[];
    const plansToConfirm=['you','bread','split'].includes(p.plan.groceries);
    const id=plansToConfirm&&p.callIndex%3!==2?'callPlans':
      p.plan.eta==='soon'?'callSoon':isOwner(s)&&p.callIndex>0?'callEquipment':'callEta';
    p.callIndex++;
    prompt(s,id,true);
  }
  function hangup(p){
    p.active=false;p.ring=false;p.callNode=null;
    p.nextNag=p.unread?p.time+32:0;
    record(p,'log','Call ended');
  }
  function tick(s,dt){
    const p=s.phone;
    p.time+=dt;
    let event=null;
    if(p.time>=p.nextText){
      p.nextText=p.time+300;
      if(!p.unread&&!p.finished&&!p.active&&!p.ring){
        const slot=p.textIndex++;
        prompt(s,slot%texts.length===3&&isOwner(s)?'equipment':texts[slot%texts.length],false);
        event='text';
      }
    }
    if(!p.unread&&!p.active&&!p.ring){
      if(s.removed>=Rocks.yard.TOTAL&&!p.finished){
        p.finished=true;prompt(s,'finish',false);event='text';
      }else if(!p.finished&&p.followAt>0&&p.time>=p.followAt){
        p.followAt=0;prompt(s,'callback',false);event='text';
      }
    }
    if(p.time>=p.nextCall){
      p.nextCall=p.time+1800;
      if(!p.active&&!p.ring&&!p.finished){
        p.ring=true;p.nextNag=p.time+18;
        event='call';
      }
    }
    if(p.active){
      p.callAge+=dt;p.callIdle+=dt;
      if(p.callIdle>=(p.callNode?35:7)){
        hangup(p);event=event||'ended';
      }
    }
    if(!p.active&&(p.unread||p.ring)&&p.nextNag>0&&p.time>=p.nextNag){
      record(p,'wife',p.ring?'Why didn’t you answer?':nags[p.notify%nags.length]);
      p.notify++;
      p.nextNag=p.time+Math.max(11,32-p.notify*4);
      return p.ring?'call':'text';
    }
    return event;
  }
  return {fresh,restore,record,choices,respond,answer,hangup,tick};
})();
