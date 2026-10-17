/* =================================================================
   MARK TALKS HEALTH — "TEST DRIVE" PHONE
   A working mini version of the member app for the homepage and the
   sales pages. Five tabs (Home, Courses, Hub, Library, Account):
   tap the tab bar or swipe left/right on the screen.

   Use on a page:   <div class="mthp" data-proto="gut"></div>
   data-proto:      gut | sugar | glp1 | all   (all = homepage, can switch course)
   Edit the words in PROTOS below; every page updates.
================================================================= */
(function(){
  if(window.MTHPhone) { window.MTHPhone.scan(); return; }
  var BASE="https://marktalkshealth.github.io/mth-protocols/site/";
  var PICS=["1-fasting","2-meditation","3-keto","4-cardio","5-music","6-sleep","7-nature"];

  /* ======================= YOUR CONTENT ======================= */
  var PROTOS={
    gut:{
      name:"Gut Health Protocol", short:"Gut Health", fastGoal:16, fastNote:"Fat-burning shift · goal 16h",
      steps:["Fasting & cleanse","Meditation & journaling","Keto & healing broths","Cardio & strength","Music therapy & spirit","Sleep & clean air","Nature: forest & sun"],
      days:[
        ["Morning green juice","Ice cream cleanse meal","14-hour fasting window","Rate your bloating"],
        ["10-minute guided meditation","Journal three lines","Morning green juice","Bone broth, 1 cup"],
        ["Morning green juice","Bone broth, 1 cup","Avocado cacao ice cream","Evening walk, 20 min"],
        ["20-minute brisk walk","Bodyweight strength circuit","Bone broth, 1 cup","Rate your energy"],
        ["Music therapy session","Write one gratitude note","Morning green juice","Avocado coconut ice cream"],
        ["No screens after 9pm","Air out the bedroom, 10 min","Lights out by 10:30","Log your sleep"],
        ["20 minutes of morning sun","Walk in a park or forest","Day 7 check-in","Plan your next week"]],
      plan:{title:"Level 1 cleanse", meals:[["🥑","Breakfast","Avocado coconut ice cream"],["🥬","Lunch","Green juice · zero calorie"],["🍫","Dinner","Cacao avocado ice cream"]],
            supps:"L-glutamine · zinc carnosine · collagen", tests:"Stool panel · SIBO breath test"},
      chart:{title:"Bloating", sub:"Daily self-rating, 0–10", v:[82,74,60,48,40,32,26], third:["Digestion","Comfort after meals, tracked"]},
      posts:[["🌸","Sarah","DAY 3","Bone broth in the morning is becoming my favourite ritual.",24],
             ["🌊","James","DAY 5","First week in years without bloating after dinner. Small win!",41],
             ["🍃","Priya","CLEANSE","The cacao ice cream is unreal. Who knew a cleanse could taste like dessert?",18]]
    },
    sugar:{
      name:"Diabetes Protocol", short:"Blood Sugar", fastGoal:14, fastNote:"Overnight window · goal 14h",
      steps:["Eating window & fasting","Meditation & journaling","Low-carb food order","Movement after meals","Music therapy & spirit","Sleep & clean air","Nature: light & walking"],
      days:[
        ["14-hour overnight window","Protein-first breakfast","Log your fasting reading","Water with every meal"],
        ["10-minute guided meditation","Journal three lines","Walk after lunch","Log your reading"],
        ["Protein-first breakfast","Veg before carbs at lunch","10-minute walk after dinner","Log your bedtime reading"],
        ["Walk after every meal","15-minute strength session","Veg first at dinner","Log your reading"],
        ["Music therapy session","Write one gratitude note","Low-carb lunch","Log your reading"],
        ["No late-night snacks","Lights out by 10:30","Air out the bedroom","Log your sleep"],
        ["20 minutes of morning sun","Nature walk after a meal","Day 7 check-in","Plan your next week"]],
      plan:{title:"Low-carb day", meals:[["🥑","Breakfast","Eggs, greens & avocado"],["🥗","Lunch","Salmon salad, olive oil"],["🍗","Dinner","Chicken & roasted veg"]],
            supps:"Magnesium · fibre · ask your doctor first", tests:"HbA1c · fasting insulin · lipid panel"},
      chart:{title:"Morning glucose", sub:"Your meter readings, charted", v:[88,80,74,66,60,55,50], third:["Sleep","Hours and quality, tracked for you"]},
      posts:[["🌸","Linda","DAY 4","Walking after dinner brought my bedtime number right down.",33],
             ["🌊","James","FAST","Finished a 14-hour window. Steadiest morning reading all month.",47],
             ["☀️","Tom","DAY 2","Veg before carbs is such a simple change. Loving it.",19]]
    },
    glp1:{
      name:"GLP-1 Protocol", short:"GLP-1", fastGoal:12, fastNote:"Overnight window · goal 12h",
      steps:["Eating rhythm & fasting","Meditation & journaling","Protein-first nutrition","Strength & cardio","Music therapy & spirit","Sleep & clean air","Nature: light & walking"],
      days:[
        ["12-hour overnight window","30g protein breakfast","Water + electrolytes","Log weight & dose day"],
        ["10-minute guided meditation","Journal three lines","Protein at every meal","Short walk after lunch"],
        ["30g protein breakfast","20-minute strength session","Water + electrolytes","Log weight & dose day"],
        ["Strength test: curls & squats","Protein snack after training","20-minute walk","Log your lifts"],
        ["Music therapy session","Write one gratitude note","High-protein lunch","Water + electrolytes"],
        ["Lights out by 10:30","Air out the bedroom","No screens after 9pm","Log your sleep"],
        ["20 minutes of morning sun","Nature walk","Day 7 check-in","Plan your next week"]],
      plan:{title:"High-protein day", meals:[["🥑","Breakfast","Greek yogurt, berries & eggs"],["🥗","Lunch","Chicken salad, olive oil"],["🍗","Dinner","Salmon & roasted veg"]],
            supps:"Electrolytes · fibre · ask your doctor first", tests:"HbA1c · B12 · vitamin D · thyroid"},
      chart:{title:"Weight & muscle", sub:"Weekly weigh-ins, charted", v:[88,80,74,66,60,55,50], third:["Strength","Lifts logged, so you keep your muscle"]},
      posts:[["💪","Dana","WEEK 3","Strength index held at 100 while the scale dropped. Muscle kept!",38],
             ["🌸","Rachel","DAY 3","The protein ice cream got me through a low-appetite day.",22],
             ["🌊","Mike","DAY 6","Electrolytes fixed my afternoon slump completely.",27]]
    }
  };
  var LIVE=["🧔","Mark","LIVE","Live Q&A this Thursday at 7pm. Bring your questions!",56];
  /* ============================================================ */

  var CSS=':host{display:block;all:initial;display:block}\
.mthp{display:flex;flex-direction:column;align-items:center;font-family:Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}\
.mthp *{box-sizing:border-box;margin:0;padding:0}\
.mthp button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}\
.mthp-phone{width:min(290px,80vw);aspect-ratio:9/18.6;border-radius:42px;background:#111;padding:10px;box-shadow:0 34px 70px rgba(43,39,36,.25);position:relative}\
.mthp-scr{width:100%;height:100%;border-radius:33px;background:#fffcf7;color:#2b2724;overflow:hidden;position:relative;font-size:11px;touch-action:pan-y;-webkit-user-select:none;user-select:none}\
.mthp-notch{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:86px;height:22px;border-radius:12px;background:#111;z-index:6}\
.mthp-pane{position:absolute;inset:0;touch-action:pan-y;padding:40px 13px 66px;overflow-y:auto;scrollbar-width:none;transform:translateX(100%);transition:transform .38s cubic-bezier(.3,.7,.2,1);background:#fffcf7}\
.mthp-pane::-webkit-scrollbar{display:none}\
.mthp-pane.left{transform:translateX(-100%)}.mthp-pane.on{transform:none}\
.mthp .k{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#c0623f;font-weight:700}\
.mthp .h{font-family:"Cormorant Garamond",Georgia,serif;font-size:23px;line-height:1;margin:3px 0 10px;font-weight:500}\
.mthp .c{border:1px solid #e7dccb;border-radius:12px;padding:9px;margin-bottom:8px;background:#fff}\
.mthp .row{display:flex;gap:9px;align-items:center}\
.mthp .t{font-weight:700;font-size:11px}.mthp .s{color:#6e6259;font-size:9.5px;line-height:1.35}\
.mthp .days{display:flex;gap:4px;margin-bottom:10px}\
.mthp .days button{flex:1;aspect-ratio:1;border-radius:50%;border:1px solid #e7dccb;display:grid;place-items:center;font-size:9px;font-weight:700;color:#a8998b;transition:.2s}\
.mthp .days button.d{background:#e7ecdd;color:#7a8f6e;border-color:#d3dcc8}\
.mthp .days button.t{background:#c0623f;color:#fff;border-color:#c0623f;transform:scale(1.08)}\
.mthp .ring{width:56px;height:56px;flex:none;position:relative}\
.mthp .ring svg{width:56px;height:56px;transform:rotate(-90deg)}\
.mthp .ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;font-variant-numeric:tabular-nums}\
.mthp .chk{display:flex;gap:6px;align-items:center;padding:4px 0;font-size:10px;width:100%;text-align:left}\
.mthp .chk i{width:13px;height:13px;border-radius:4px;border:1.5px solid #dcc8ae;flex:none;transition:.2s;display:grid;place-items:center;color:#fff;font-style:normal;font-size:8px}\
.mthp .chk.on i{background:#7a8f6e;border-color:#7a8f6e}.mthp .chk.on i:after{content:"✓"}\
.mthp .chk.on span{color:#a8998b;text-decoration:line-through}\
.mthp .bar{height:5px;border-radius:5px;background:#ece0cf;overflow:hidden;margin-top:6px}.mthp .bar i{display:block;height:100%;background:#c0623f;border-radius:5px;transition:width .5s}\
.mthp .mod{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f0e8dc;width:100%;text-align:left}\
.mthp .mod:last-child{border:0}\
.mthp .mod .im{width:30px;height:30px;border-radius:8px;background:#efe5d6 center/cover no-repeat;flex:none}\
.mthp .mod .st{margin-left:auto;font-size:10px;color:#a8998b}.mthp .mod .st.d{color:#7a8f6e}.mthp .mod .st.n{color:#c0623f}\
.mthp .crs{display:flex;gap:6px;margin-bottom:9px}\
.mthp .crs button{flex:1;border:1px solid #e7dccb;border-radius:10px;padding:6px 4px;font-size:8.5px;font-weight:700;background:#fff;color:#6e6259;line-height:1.2}\
.mthp .crs button.on{background:#2b2724;border-color:#2b2724;color:#fff}\
.mthp .seg{display:flex;background:#f3ebdf;border-radius:999px;padding:2px;margin-bottom:9px}\
.mthp .seg button{flex:1;border-radius:999px;padding:5px 0;font-size:9.5px;font-weight:700;color:#8a7b6e}\
.mthp .seg button.on{background:#fff;color:#2b2724;box-shadow:0 1px 3px rgba(43,39,36,.12)}\
.mthp .compose{display:flex;align-items:center;gap:7px;border:1px solid #e7dccb;border-radius:999px;padding:5px 5px 5px 10px;margin-bottom:9px;background:#fff;width:100%;text-align:left;color:#a8998b;font-size:9.5px}\
.mthp .compose b{margin-left:auto;background:#c0623f;color:#fff;border-radius:999px;padding:4px 9px;font-size:9px}\
.mthp .post{background:#f7f1e7;border-radius:12px;padding:9px;margin-bottom:7px;font-size:9.8px;line-height:1.4;animation:mthpIn .35s}\
.mthp .post .av{width:22px;height:22px;border-radius:50%;background:#efe5d6;display:grid;place-items:center;flex:none;font-size:11px}\
.mthp .post .tg{font-size:7.5px;font-weight:700;letter-spacing:.06em;color:#7a8f6e;background:#e7ecdd;border-radius:4px;padding:1px 5px;margin-left:5px}\
.mthp .post .tg.lv{color:#fff;background:#c0623f}\
.mthp .like{margin-top:5px;font-size:9.5px;color:#8a7b6e;display:inline-flex;gap:4px;align-items:center}\
.mthp .like.on{color:#c0623f}.mthp .like.on b{animation:mthpPop .3s}\
.mthp .live{border-radius:12px;aspect-ratio:16/10;background:#2b2724 url('+BASE+'steps/2-meditation.jpg) center/cover;position:relative;margin-bottom:8px;display:flex;align-items:flex-end;padding:8px;color:#fff}\
.mthp .live:before{content:"";position:absolute;inset:0;border-radius:12px;background:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.65))}\
.mthp .live *{position:relative}.mthp .live .badge{position:absolute;top:8px;left:8px;background:#c0623f;font-size:7.5px;font-weight:700;letter-spacing:.08em;padding:2px 6px;border-radius:4px}\
.mthp .meal{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f0e8dc}.mthp .meal:last-child{border:0}\
.mthp .meal .e{width:28px;height:28px;border-radius:9px;background:#f6dccf;display:grid;place-items:center;font-size:14px;flex:none}\
.mthp .dl{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #f0e8dc;width:100%;text-align:left}.mthp .dl:last-child{border:0}\
.mthp .dl .e{width:28px;height:28px;border-radius:9px;background:#e7ecdd;color:#7a8f6e;display:grid;place-items:center;font-size:12px;flex:none;font-weight:700}\
.mthp .dl .go{margin-left:auto;color:#c0623f;font-size:12px}\
.mthp .me{display:flex;gap:10px;align-items:center;margin-bottom:10px}\
.mthp .me .av{width:42px;height:42px;border-radius:50%;background:linear-gradient(140deg,#c0623f,#b8924a);color:#fff;display:grid;place-items:center;font-family:"Cormorant Garamond",Georgia,serif;font-size:20px}\
.mthp .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}\
.mthp .stats div{background:#f7f1e7;border-radius:10px;padding:7px 4px;text-align:center}\
.mthp .stats b{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:20px;line-height:1;color:#c0623f}\
.mthp .stats span{font-size:8px;color:#8a7b6e}\
.mthp .spark{height:62px;display:flex;align-items:flex-end;gap:5px;margin-top:8px}\
.mthp .spark span{flex:1;border-radius:4px 4px 0 0;background:#ece0cf;transition:height .8s ease;height:10%}.mthp .spark span.on{background:#c0623f}\
.mthp-tabs{position:absolute;left:0;right:0;bottom:0;height:58px;padding-bottom:6px;border-top:1px solid #efe5d6;background:rgba(255,252,247,.96);display:grid;grid-template-columns:repeat(5,1fr);z-index:5}\
.mthp-tabs button{font-size:8.5px;font-weight:700;color:#a8998b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;transition:color .2s}\
.mthp-tabs svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s}\
.mthp-tabs button.on{color:#c0623f}.mthp-tabs button.on svg{transform:translateY(-1px) scale(1.08)}\
.mthp-tabs button.on:before{content:"";position:absolute;top:0;width:22px;height:2.5px;border-radius:0 0 3px 3px;background:#c0623f}\
.mthp-tabs .dot{position:absolute;top:7px;right:calc(50% - 13px);width:6px;height:6px;border-radius:50%;background:#c0623f;border:1.5px solid #fffcf7}\
.mthp-sheet{position:absolute;inset:0;z-index:7;background:rgba(43,39,36,.35);display:flex;align-items:flex-end;opacity:0;pointer-events:none;transition:opacity .25s}\
.mthp-sheet.on{opacity:1;pointer-events:auto}\
.mthp-sheet>div{background:#fffcf7;width:100%;border-radius:20px 20px 0 0;padding:12px 13px 20px;transform:translateY(100%);transition:transform .3s cubic-bezier(.3,.7,.2,1)}\
.mthp-sheet.on>div{transform:none}\
.mthp-sheet .pic{aspect-ratio:16/9;border-radius:12px;background:#efe5d6 center/cover;margin-bottom:9px;position:relative}\
.mthp-sheet .pic:after{content:"▶";position:absolute;inset:0;margin:auto;width:34px;height:34px;border-radius:50%;background:rgba(255,252,247,.9);color:#c0623f;display:grid;place-items:center;font-size:12px;padding-left:2px}\
.mthp-sheet .btn{display:block;width:100%;margin-top:10px;background:#c0623f;color:#fff;border-radius:999px;padding:8px;font-size:10.5px;font-weight:700}\
.mthp-sheet .x{position:absolute;right:10px;top:-30px;width:24px;height:24px;border-radius:50%;background:rgba(255,252,247,.9);font-size:12px}\
.mthp-toast{position:absolute;left:12px;right:12px;top:40px;z-index:8;background:#2b2724;color:#fff;border-radius:12px;padding:8px 10px;font-size:9.8px;line-height:1.35;text-align:center;opacity:0;transform:translateY(-8px);transition:.25s;pointer-events:none}\
.mthp-toast.on{opacity:1;transform:none}\
.mthp-hint{font-size:12px;color:#a8998b;margin-top:14px;display:flex;align-items:center;gap:8px}\
.mthp-hint i{display:inline-block;font-style:normal;animation:mthpSwipe 2.2s ease-in-out infinite}\
@keyframes mthpSwipe{0%,100%{transform:translateX(0)}50%{transform:translateX(-7px)}}\
@keyframes mthpIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}\
@keyframes mthpPop{50%{transform:scale(1.35)}}\
@media (prefers-reduced-motion:reduce){.mthp-pane,.mthp-sheet>div{transition:none}.mthp-hint i{animation:none}}';

  var ICON={
    home:'<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>',
    courses:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="m10 8.5 5 2.5-5 2.5z"/><path d="M8 21h8"/></svg>',
    hub:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.2 4.5 2.1 4.5 4.9"/></svg>',
    library:'<svg viewBox="0 0 24 24"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M6 21h13v-3"/><path d="M9 7h6"/></svg>',
    account:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>'
  };
  var TABS=[["home","Home"],["courses","Courses"],["hub","Hub"],["library","Library"],["account","Account"]];
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});};


  function build(root){
    if(root.__mthp) return; root.__mthp=1;
    var all=root.getAttribute("data-proto")==="all";
    var key=all?"gut":(PROTOS[root.getAttribute("data-proto")]?root.getAttribute("data-proto"):"gut");
    var tab=0, day=2, auto=true, hubMode=0, posted=false, sec=0;
    var done={}; /* "day-item" → true */
    function seed(){ done={}; for(var d=0;d<7;d++) for(var j=0;j<4;j++) if(d<2||(d===2&&j<2)) done[d+"-"+j]=true; }
    seed();

    /* shadow DOM keeps the page's styles out of the phone (and ours out of the page) */
    var sh=root.attachShadow?root.attachShadow({mode:"open"}):root;
    sh.innerHTML='<style>'+CSS+'</style><div class="mthp"><div class="mthp-phone"><div class="mthp-scr" role="region" aria-label="App preview: tap the tabs or swipe to explore"><span class="mthp-notch"></span>'+
      TABS.map(function(t,i){ return '<div class="mthp-pane'+(i===0?' on':'')+'" data-p="'+i+'" role="tabpanel" aria-label="'+t[1]+'"></div>'; }).join("")+
      '<div class="mthp-tabs" role="tablist">'+TABS.map(function(t,i){ return '<button role="tab" aria-selected="'+(i===0)+'" class="'+(i===0?'on':'')+'" data-t="'+i+'">'+ICON[t[0]]+t[1]+(t[0]==="hub"?'<span class="dot"></span>':'')+'</button>'; }).join("")+'</div>'+
      '<div class="mthp-sheet"><div style="position:relative"></div></div><div class="mthp-toast"></div></div></div>'+
      '<div class="mthp-hint"><i>👆</i>Tap the tabs or swipe to test-drive the app</div></div>';
    var scr=sh.querySelector(".mthp-scr"), panes=[].slice.call(sh.querySelectorAll(".mthp-pane")), tabs=[].slice.call(sh.querySelectorAll(".mthp-tabs button"));
    var sheet=sh.querySelector(".mthp-sheet"), toastEl=sh.querySelector(".mthp-toast");
    var P=function(){ return PROTOS[key]; };

    function toast(msg){ toastEl.textContent=msg; toastEl.classList.add("on"); clearTimeout(toastEl._t); toastEl._t=setTimeout(function(){toastEl.classList.remove("on");},2200); }
    function stop(){ auto=false; }

    /* ---------- screens ---------- */
    function rHome(){ var p=P(), items=p.days[day];
      var n=items.filter(function(x,j){return done[day+"-"+j];}).length;
      panes[0].innerHTML='<div class="k">'+esc(p.name)+'</div><div class="h">Day '+(day+1)+' of 7</div>'+
        '<div class="days">'+[0,1,2,3,4,5,6].map(function(d){ var full=[0,1,2,3].every(function(j){return done[d+"-"+j];}); return '<button aria-label="Day '+(d+1)+'" class="'+(d===day?'t':full?'d':'')+'" data-day="'+d+'">'+(d+1)+'</button>'; }).join("")+'</div>'+
        '<div class="c row"><div class="ring"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="23" fill="none" stroke="#ece0cf" stroke-width="6"/><circle class="rg" cx="28" cy="28" r="23" fill="none" stroke="#c0623f" stroke-width="6" stroke-linecap="round" stroke-dasharray="144.5" stroke-dashoffset="50"/></svg><b class="hr">14:02</b></div><div><div class="t">Fasting clock</div><div class="s">'+esc(p.fastNote)+'</div></div></div>'+
        '<div class="c"><div class="t" style="margin-bottom:3px">Today · '+esc(p.steps[day])+'</div>'+
          items.map(function(x,j){ return '<button class="chk'+(done[day+"-"+j]?' on':'')+'" data-j="'+j+'"><i></i><span>'+esc(x)+'</span></button>'; }).join("")+
          '<div class="bar"><i style="width:'+(n*25)+'%"></i></div><div class="s" style="margin-top:4px">'+n+' of 4 done today</div></div>';
      clock(); }
    function rCourses(){ var p=P(); var cur=day;
      var doneMods=[0,1,2,3,4,5,6].filter(function(d){return [0,1,2,3].every(function(j){return done[d+"-"+j];});}).length;
      panes[1].innerHTML='<div class="k">My courses</div><div class="h">'+esc(all?"Your protocols":p.name)+'</div>'+
        (all?'<div class="crs">'+["gut","sugar","glp1"].map(function(k){ return '<button class="'+(k===key?'on':'')+'" data-k="'+k+'">'+esc(PROTOS[k].short)+'</button>'; }).join("")+'</div>':'')+
        '<div class="c"><div class="row"><div><div class="t">'+esc(p.name)+'</div><div class="s">'+doneMods+' of 7 modules complete</div></div></div><div class="bar"><i style="width:'+Math.round(doneMods/7*100)+'%"></i></div></div>'+
        '<div class="c" style="padding:4px 9px">'+p.steps.map(function(s,i){ var full=[0,1,2,3].every(function(j){return done[i+"-"+j];});
          return '<button class="mod" data-m="'+i+'"><span class="im" style="background-image:url('+BASE+'steps/'+PICS[i]+'.jpg)"></span><span><span class="t" style="display:block">'+(i+1)+'. '+esc(s)+'</span><span class="s">Video · '+(5+i%3)+' min</span></span><span class="st'+(full?' d':i===cur?' n':'')+'">'+(full?'✓':i===cur?'▶':'›')+'</span></button>'; }).join("")+'</div>'; }
    function rHub(){ var p=P();
      var feed=(posted?[["😊","You","DAY "+(day+1),"Checked in: "+p.days[day][0].toLowerCase()+" done ✓",0]]:[]).concat(p.posts);
      panes[2].innerHTML='<div class="k">The Healing Hub</div><div class="h">Community</div>'+
        '<div class="seg"><button class="'+(hubMode===0?'on':'')+'" data-h="0">Feed</button><button class="'+(hubMode===1?'on':'')+'" data-h="1">Live</button></div>'+
        (hubMode===0?
          '<button class="compose">Share your check-in…<b>'+(posted?'Posted':'Post')+'</b></button>'+
          feed.map(function(x,i){ return '<div class="post"><div class="row" style="gap:7px;margin-bottom:3px"><span class="av">'+x[0]+'</span><b>'+esc(x[1])+'</b><span class="tg">'+esc(x[2])+'</span></div>'+esc(x[3])+'<br><button class="like'+(x[5]?' on':'')+'" data-l="'+x[4]+'"><b>'+(x[5]?'♥':'♡')+'</b><span>'+x[4]+'</span></button></div>'; }).join("")
        :
          '<div class="live"><span class="badge">THURSDAY · 7PM</span><div><div class="t" style="color:#fff">Live Q&amp;A with Mark</div><div class="s" style="color:#e9dfd3">Fasting, food and your questions</div></div></div>'+
          '<button class="compose remind">Remind me when it starts<b>Remind</b></button>'+
          '<div class="post"><div class="row" style="gap:7px;margin-bottom:3px"><span class="av">'+LIVE[0]+'</span><b>'+LIVE[1]+'</b><span class="tg lv">'+LIVE[2]+'</span></div>'+esc(LIVE[3])+'<br><button class="like" data-l="'+LIVE[4]+'"><b>♡</b><span>'+LIVE[4]+'</span></button></div>'+
          '<div class="c"><div class="t">Replays</div><div class="s">Every past live, saved in your Library</div></div>'); }
    function rLibrary(){ var p=P(), pl=p.plan;
      panes[3].innerHTML='<div class="k">Library</div><div class="h">'+esc(pl.title)+'</div>'+
        '<div class="c" style="padding:4px 9px">'+pl.meals.map(function(m){ return '<div class="meal"><span class="e">'+m[0]+'</span><div><div class="t">'+esc(m[1])+'</div><div class="s">'+esc(m[2])+'</div></div></div>'; }).join("")+'</div>'+
        '<div class="c"><div class="t">Supplements</div><div class="s">'+esc(pl.supps)+'</div></div>'+
        '<div class="c"><div class="t">Tests to ask about</div><div class="s">'+esc(pl.tests)+'</div></div>'+
        '<div class="c" style="padding:4px 9px">'+[["PDF",p.short+" protocol guide"],["PDF","Shopping list"],["📖","Mark’s book"]].map(function(d){ return '<button class="dl"><span class="e">'+d[0]+'</span><span class="t">'+esc(d[1])+'</span><span class="go">↓</span></button>'; }).join("")+'</div>'; }
    function rAccount(){ var p=P(), ch=p.chart;
      var checks=Object.keys(done).length;
      panes[4].innerHTML='<div class="k">Account · example</div>'+
        '<div class="me" style="margin-top:6px"><span class="av">Y</span><div><div class="h" style="margin:0;font-size:21px">Your progress</div><div class="s">'+esc(p.name)+' member</div></div></div>'+
        '<div class="stats"><div><b>'+(day+1)+'</b><span>day streak</span></div><div><b>'+checks+'</b><span>tasks done</span></div><div><b>'+(posted?4:3)+'</b><span>check-ins</span></div></div>'+
        '<div class="c"><div class="t">'+esc(ch.title)+'</div><div class="s">'+esc(ch.sub)+'</div><div class="spark">'+ch.v.map(function(){return '<span></span>';}).join("")+'</div>'+
          '<div class="s" style="display:flex;justify-content:space-between;margin-top:4px"><span>D1</span><span>D7</span></div></div>'+
        '<div class="c"><div class="t">Energy</div><div class="s">Logged daily, charted over time</div></div>'+
        '<div class="c"><div class="t">'+esc(ch.third[0])+'</div><div class="s">'+esc(ch.third[1])+'</div></div>'; }
    function spark(){ var v=P().chart.v; [].forEach.call(panes[4].querySelectorAll(".spark span"),function(s,i){ s.style.height="10%"; s.classList.remove("on"); setTimeout(function(){ s.style.height=v[i]+"%"; s.classList.toggle("on",i===6); },120+i*90); }); }
    var R=[rHome,rCourses,rHub,rLibrary,rAccount];
    function renderAll(){ R.forEach(function(f){f();}); }

    /* ---------- live fasting clock ---------- */
    function clock(){ var g=P().fastGoal*3600; if(!sec) sec=Math.round(g*.88);
      var h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), hr=panes[0].querySelector(".hr"), rg=panes[0].querySelector(".rg");
      if(hr) hr.textContent=h+":"+("0"+m).slice(-2); if(rg) rg.setAttribute("stroke-dashoffset",(144.5*(1-Math.min(sec/g,1))).toFixed(1)); }
    setInterval(function(){ sec+=1; if(sec>=P().fastGoal*3600) sec=Math.round(P().fastGoal*3600*.88); clock(); },1000);

    /* ---------- tabs ---------- */
    function go(i,user){ if(i<0||i>4) return; if(user) stop(); var old=tab; tab=i;
      panes.forEach(function(p,j){ p.style.transition=(j===i||j===old)?"":"none"; p.style.transform="";
        p.classList.toggle("on",j===i); p.classList.toggle("left",j<i); });
      tabs.forEach(function(t,j){ t.classList.toggle("on",j===i); t.setAttribute("aria-selected",j===i); });
      if(i===2){ var d=sh.querySelector(".mthp-tabs .dot"); if(d) d.remove(); }
      if(i===4) spark();
      panes[i].scrollTop=0; }
    tabs.forEach(function(t){ t.addEventListener("click",function(){ go(+t.dataset.t,true); }); });

    /* ---------- taps inside the screens ---------- */
    scr.addEventListener("click",function(e){
      if(swiped){ e.preventDefault(); e.stopPropagation(); return; }
      var b=e.target.closest("button"); if(!b||b.parentNode.classList.contains("mthp-tabs")) return; stop();
      if(b.dataset.day!=null){ day=+b.dataset.day; renderAll(); return; }
      if(b.classList.contains("chk")){ var k=day+"-"+b.dataset.j; if(done[k]) delete done[k]; else done[k]=true; rHome(); rCourses(); rAccount();
        if([0,1,2,3].every(function(j){return done[day+"-"+j];})) toast("Day "+(day+1)+" complete 🎉 Nice work."); return; }
      if(b.dataset.k){ key=b.dataset.k; sec=0; seed(); posted=false; renderAll(); toast("Switched to the "+PROTOS[key].name); return; }
      if(b.dataset.m!=null){ openLesson(+b.dataset.m); return; }
      if(b.dataset.h!=null){ hubMode=+b.dataset.h; rHub(); return; }
      if(b.classList.contains("remind")){ b.querySelector("b").textContent="Set ✓"; toast("We’ll remind you before Mark goes live."); return; }
      if(b.classList.contains("compose")){ if(!posted){ posted=true; rHub(); rAccount(); toast("Posted to the Healing Hub"); } return; }
      if(b.classList.contains("like")){ var on=!b.classList.contains("on"), n=+b.dataset.l+(on?1:0); b.classList.toggle("on",on); b.querySelector("b").textContent=on?"♥":"♡"; b.querySelector("span").textContent=n; return; }
      if(b.classList.contains("dl")){ toast("Members get every download. Unlock it when you join."); return; }
    });
    function openLesson(i){ var p=P(); var box=sheet.firstElementChild;
      box.innerHTML='<button class="x" aria-label="Close">✕</button><div class="pic" style="background-image:url('+BASE+'steps/'+PICS[i]+'.jpg)"></div><div class="k">Module '+(i+1)+'</div><div class="h" style="font-size:20px;margin-bottom:4px">'+esc(p.steps[i])+'</div><div class="s">The science behind this step, explained simply, plus exactly what to do today.</div><button class="btn">Start lesson</button>';
      sheet.classList.add("on");
      box.querySelector(".x").onclick=function(){ sheet.classList.remove("on"); };
      box.querySelector(".btn").onclick=function(){ sheet.classList.remove("on"); toast("Lessons unlock when you join."); }; }
    sheet.addEventListener("click",function(e){ if(e.target===sheet) sheet.classList.remove("on"); });

    /* ---------- swipe ---------- */
    var sx=0, sy=0, dx=0, lock="", down=false, swiped=false;
    scr.addEventListener("pointerdown",function(e){ if(e.target.closest(".mthp-tabs")||sheet.classList.contains("on")) return; down=true; lock=""; dx=0; sx=e.clientX; sy=e.clientY; swiped=false; });
    scr.addEventListener("pointermove",function(e){ if(!down) return; dx=e.clientX-sx; var dy=e.clientY-sy;
      if(!lock){ if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){ lock="x"; stop(); try{scr.setPointerCapture(e.pointerId);}catch(_){} } else if(Math.abs(dy)>10){ lock="y"; down=false; return; } else return; }
      var edge=(tab===0&&dx>0)||(tab===4&&dx<0), pull=edge?dx*.25:dx, w=scr.clientWidth;
      var cur=panes[tab], nb=panes[tab+(dx<0?1:-1)];
      cur.style.transition="none"; cur.style.transform="translateX("+pull+"px)";
      if(nb&&!edge){ nb.style.transition="none"; nb.style.transform="translateX("+((dx<0?w:-w)+pull)+"px)"; } });
    function end(){ if(!down) return; down=false; if(lock!=="x"){ return; }
      swiped=Math.abs(dx)>4; setTimeout(function(){ swiped=false; },60);
      var w=scr.clientWidth, target=tab;
      if(dx<-w*.18&&tab<4) target=tab+1; else if(dx>w*.18&&tab>0) target=tab-1;
      panes.forEach(function(p){ p.style.transition=""; });
      if(target!==tab){ var old=tab; go(target,true); panes[old].style.transform=""; }
      else { panes.forEach(function(p){ p.style.transform=""; }); } }
    scr.addEventListener("pointerup",end); scr.addEventListener("pointercancel",function(){ if(lock==="x") end(); else down=false; });
    scr.addEventListener("dragstart",function(e){ e.preventDefault(); });

    /* keyboard: arrows move between tabs */
    sh.querySelector(".mthp-tabs").addEventListener("keydown",function(e){ if(e.key==="ArrowRight"){ go(Math.min(4,tab+1),true); tabs[tab].focus(); } if(e.key==="ArrowLeft"){ go(Math.max(0,tab-1),true); tabs[tab].focus(); } });

    /* gentle auto-tour until the visitor touches it, only while on screen */
    var seen=true;
    if("IntersectionObserver" in window){ seen=false; new IntersectionObserver(function(es){ seen=es[0].isIntersecting; },{threshold:.5}).observe(root); }
    var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!reduce) setInterval(function(){ if(auto&&seen&&!down) go((tab+1)%5,false); },4200);
    root.addEventListener("pointerdown",stop);

    renderAll();
  }

  function scan(){ [].forEach.call(document.querySelectorAll(".mthp[data-proto]"),build); }
  window.MTHPhone={scan:scan,PROTOS:PROTOS};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",scan); else scan();
})();
