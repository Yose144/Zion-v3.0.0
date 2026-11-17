import { MODEL_IDS, createAvatarRenderer } from "./avatar-models.js";

const canvas = document.querySelector("canvas");
const status = document.querySelector("#status");
const selector = document.querySelector("#avatar");
const gl = canvas.getContext("webgl", { antialias: true });
const ctx = gl ? null : canvas.getContext("2d", { alpha: false });
const TAU = Math.PI * 2;

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map(v => v * k);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = ([x, y, z], [u, v, w]) => [y*w-z*v, z*u-x*w, x*v-y*u];
const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
const mix = (a, b, t) => add(mul(a, 1-t), mul(b,t));
const colors = { wood:[.29,.17,.10], leaf:[.19,.32,.22], snow:[.64,.68,.69], gold:[.99,.66,.26], stone:[.37,.40,.37] };
const verts = [];
let groundVertexEnd = 0;
let pathVertexEnd = 0;
const placements = new Map();
const blockers = [];
const palette = [[.28,.40,.42],[.50,.29,.24],[.36,.47,.33],[.52,.43,.28],[.45,.33,.45],[.66,.56,.39]];
const light = unit([-.5, 1, .6]);

function triangle(a,b,c,color,emissive=false) {
  const n=unit(cross(sub(b,a),sub(c,a)));
  const factor=emissive ? 1 : .55+.45*Math.abs(dot(n,light));
  for (const p of [a,b,c]) {
    const glow = emissive ? 0 : .18 * Math.exp(-Math.hypot(p[0],p[1]-1,p[2]-9)/7);
    verts.push(...p, ...color.map((v,i)=>Math.min(1,v*factor+glow*[1,.6,.2][i])));
  }
}

function quad(a,b,c,d,color) { triangle(a,b,c,color); triangle(a,c,d,color); }

function solid(center,size,color,rotation=0) {
  const [sx,sy,sz]=size.map(v=>v/2);
  const points=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]]
    .map(([x,y,z])=>add(center,[x*Math.cos(rotation)-z*Math.sin(rotation),y,x*Math.sin(rotation)+z*Math.cos(rotation)]));
  for (const face of [[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[3,2,6,7],[0,1,5,4]]) quad(...face.map(i=>points[i]),color);
}

function tube(a,b,ra,rb,color,sides=8,emissive=false) {
  const axis=unit(sub(b,a));
  const u=unit(cross(axis,Math.abs(axis[1])>.9 ? [1,0,0] : [0,1,0]));
  const v=cross(axis,u);
  for(let i=0;i<sides;i++){
    const point=(p,r,k)=>add(p,mul(add(mul(u,Math.cos(k*TAU/sides)),mul(v,Math.sin(k*TAU/sides))),r));
    const aa=point(a,ra,i), ab=point(a,ra,i+1), ba=point(b,rb,i), bb=point(b,rb,i+1);
    triangle(aa,ab,bb,color,emissive);triangle(aa,bb,ba,color,emissive);
    triangle(a,ab,aa,color,emissive);triangle(b,ba,bb,color,emissive);
  }
}

function globe(p, scale, color, levels=5, segments=10, emissive=false) {
  const point=(i,j)=>{
    const lat=Math.PI*(i/levels-.5), lon=TAU*j/segments;
    return add(p,[scale[0]*Math.cos(lat)*Math.cos(lon),scale[1]*Math.sin(lat),scale[2]*Math.cos(lat)*Math.sin(lon)]);
  };
  for(let i=0;i<levels;i++) for(let j=0;j<segments;j++){
    triangle(point(i,j),point(i+1,j),point(i+1,j+1),color,emissive);
    triangle(point(i,j),point(i+1,j+1),point(i,j+1),color,emissive);
  }
}

function person(id,name,x,z,garment,height=1.65,hair=[.22,.14,.11],form="character") {
  placements.set(id,{name,x,z,height});
  blockers.push([x,z,.39]);
  if (form==="symbolic_environment") {
    solid([x,.10,z],[.65,.20,.65],colors.stone);
    globe([x,.6,z],[.30,.45,.30],garment,4,8);
    return;
  }
  const first=verts.length/6;
  const skin=[[.74,.53,.36],[.52,.34,.23],[.84,.66,.48]][(name.codePointAt(0)||0)%3];
  for(const sign of [-1,1]){
    tube([x+sign*.13,.08,z],[x+sign*.12,height*.36,z],.085,.09,colors.wood,5);
    tube([x+sign*.20,height*.69,z],[x+sign*.29,height*.42,z+.035],.09,.067,garment,5);
  }
  tube([x,height*.22,z],[x,height*.71,z],.23,.21,garment,7);
  globe([x,height*.83,z],[height*.091,height*.11,height*.085],skin,4,7);
  globe([x,height*.905,z-.016],[height*.094,height*.05,height*.087],hair,4,7);
  Object.assign(placements.get(id),{first,end:verts.length/6});
}

const fixed = {
  "OASIS-001":[-6,7,[.27,.40,.60]], "OASIS-002":[-2.8,6,[.21,.35,.61]], "OASIS-003":[-2.0,5.9,[.72,.44,.43],1.68,true],
  "OASIS-004":[7.8,7,[.65,.34,.23]], "OASIS-005":[-5,3,[.61,.50,.34],1.55,true], "OASIS-016":[-6.9,6.45,[.56,.24,.40]],
  "OASIS-019":[3.05,6,[.63,.52,.38],1.79],
  "OASIS-045":[8.7,2.6,[.70,.54,.39]], "OASIS-046":[1,8,[.35,.47,.28],1.18,true],
  "OASIS-047":[0,2.25,colors.gold,.8], "OASIS-048":[-12,-3.4,[.73,.68,.55]], "OASIS-049":[-1.2,8,[.67,.39,.44],1.12,true]
};
const sceneOnly = [
  ["Sarah Issobela",-4.3,3.4,[.47,.30,.45],1.48,true],
  ["Marie Magdaléna",2.2,6,[.57,.28,.25]],
  ["Josef",-1.87,1.55,[.49,.36,.25],1.71], ["Marie",1.87,1.55,[.25,.39,.56],1.60],
  ["Kovář",-8.7,5.95,[.40,.33,.27]], ["Čaitanja",-7.9,6.3,[.88,.54,.23]],
  ["Noe",7.25,5.7,[.50,.42,.33]], ["Sedlák",8.5,4.8,[.37,.45,.34]], ["Poutník z Genesis",-9.5,3.5,[.39,.43,.37]]
];

function circle(r, angle, y=.04){return [r*Math.sin(angle),y,r*Math.cos(angle)];}

function buildEnvironment(){
  solid([0,-.2,0],[180,.4,160],[.22,.32,.27]);
  groundVertexEnd = verts.length;
  for(let i=0;i<64;i++){
    const a=TAU*i/64,b=TAU*(i+1)/64;
    for(const r of [13.4,17,21,25]) quad(circle(r-.43,a),circle(r+.43,a),circle(r+.43,b),circle(r-.43,b),colors.stone);
    quad(circle(26,a,.03),circle(36,a,.03),circle(36,b,.03),circle(26,b,.03),colors.snow);
  }
  for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
    const [x,,z]=circle(23,a);
    solid([x,.048,z],[3.4,.09,25],colors.stone,a);
  }
  solid([0,.055,12],[3.7,.1,17],colors.stone);
  pathVertexEnd = verts.length;
  tube([0,0,-3],[0,9,-3],2, .85,colors.wood,12);
  for(let i=0;i<12;i++){
    const a=TAU*i/12;
    const crown=add(circle(10.6,a,8.4+(i%3)*1.1),[0,0,-3]);
    tube([0,4.9,-3],crown,.59,.13,colors.wood,7);
    globe(crown,[5.9,2.75,5.6],mix(colors.leaf,[.35,.42,.24],(i%4)/6),5,9);
    const root=add(circle(5.5,a,.12),[0,0,-3]);
    tube([0,1.25,-3],root,.82,.12,colors.wood,5);
  }
  globe([0,10.4,-3],[7,3.7,7],colors.leaf);
  blockers.push([0,-3,2.1]);
  for(const x of [-2.55,2.55]) for(const z of [0,3.3]){
    solid([x,1.31,z],[.23,2.62,.23],colors.wood);blockers.push([x,z,.28]);
  }
  quad([-2.85,2.56,-.27],[0,3.93,-.27],[0,3.93,3.57],[-2.85,2.56,3.57],colors.wood);
  quad([0,3.93,-.27],[2.85,2.56,-.27],[2.85,2.56,3.57],[0,3.93,3.57],colors.wood);
  solid([0,.36,2.25],[1.42,.31,.75],colors.wood);
  globe([0,.63,2.25],[.48,.19,.25],colors.gold,5,10,true);
  blockers.push([0,2.25,.65]);
  solid([0,.07,8.8],[.52,.14,.52],colors.wood);
  globe([0,.48,8.8],[.20,.37,.20],colors.gold,5,8,true);
  solid([0,.88,8.8],[.50,.12,.50],colors.wood);
  blockers.push([0,8.8,.31]);
  tube([.47,.22,8.55],[1.62,.22,8.55],.19,.08,colors.wood,6);
  solid([1.01,.53,8.55],[.06,.67,.06],colors.wood);
  triangle([1,.80,8.55],[1,.31,8.55],[1.46,.34,8.55],[.83,.74,.58]);

  tube([-30,-1,-38],[-31,25,-45],22,0,[.31,.39,.47],7);
  tube([-31,13,-42],[-31,25,-45],9.5,0,colors.snow,7);
  for(let i=0;i<5;i++) tube([27+i*12,-1,-58],[29+i*12,10+(i*5)%12,-62],14,0,[.27,.36,.44],6);
  const temple=[31,.24,-24];
  solid([31,.04,-24],[13,.21,13],colors.stone);
  globe(temple,[3.6,3.7,3.6],[.60,.56,.38],7,14);
  for(let i=0;i<6;i++) globe(add(temple,circle(4.7,i*TAU/6,0)),[1.38,1.55,1.38],[.64,.60,.47],5,10);
  const station=[-27,20,-33];
  for(let i=0;i<36;i++){
    const stationPoint=k=>add(station,[5.2*Math.cos(k*TAU/36),1.5*Math.sin(k*TAU/36),3.1*Math.sin(k*TAU/36)]);
    tube(stationPoint(i),stationPoint(i+1),.15,.15,[.59,.63,.65],5,true);
  }
  tube(add(station,[-5.2,0,0]),add(station,[5.2,0,0]),.09,.09,[.50,.54,.57],5,true);
  for(let i=0;i<7;i++){
    const x=22+i*.57;
    tube([x,.2,-26],[x-.2,1.6,-25.3],.08,.08,colors.wood);
    tube([x,.2,-26],[x-.2,1.6,-26.7],.08,.08,colors.wood);
  }
  tube([21.7,.22,-26],[26,.22,-26],.11,.11,colors.wood);
}

function placeRoster(roster){
  const free=[];
  for(const [ring,capacity] of [[12,32],[16,44],[20,56],[24,72]]){
    for(let quadrant=0;quadrant<4;quadrant++){
      const count=capacity/4, margin=Math.asin(2.25/ring);
      for(let i=0;i<count;i++){
        const angle=quadrant*Math.PI/2+margin+(i+.5)/count*(Math.PI/2-2*margin);
        const [x,,z]=circle(ring,angle);
        free.push([x,z]);
      }
    }
  }
  let index=0;
  for(const [id,name,,form] of roster){
    let [x,z,color,height,blond]=fixed[id]??[];
    if(x===undefined){[x,z]=free[index];color=palette[index%palette.length];height=1.49+.09*(index%4);index++;}
    if(id==="OASIS-047"){placements.set(id,{name:"Hiran · záře v jeslích",x,z,height:.85});continue;}
    person(id,id==="OASIS-049"?"Lumi / Elizabet":id==="OASIS-046"?"Malý princ":id==="OASIS-019"?"Ježíš z Nazareta":name,x,z,color,height,blond?[.82,.67,.40]:undefined,form);
  }
  for(const [name,x,z,color,height,blond] of sceneOnly) person("scene:"+name,name,x,z,color,height,blond?[.82,.67,.40]:undefined);
}

function shader(type,code){
  const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);
  if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function gpuRenderer(avatarRenderer, models){
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`
    attribute vec3 point, color; uniform vec3 eye, right, up, forward;
    uniform vec2 scale; varying vec3 paint; varying float depth;
    void main(){vec3 p=point-eye; depth=dot(p,forward); paint=color;
      gl_Position=vec4(dot(p,right)*scale.x,dot(p,up)*scale.y,depth*1.002-0.20,depth);}
  `));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
    precision mediump float; varying vec3 paint; varying float depth;
    void main(){float haze=smoothstep(19.,155.,depth);
      gl_FragColor=vec4(mix(paint,vec3(.105,.159,.226),haze*.8),1.);}
  `));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const environmentBuffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,environmentBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
  const attributes=[["point",0],["color",12]].map(([name,offset])=>[gl.getAttribLocation(program,name),offset]);
  gl.enable(gl.DEPTH_TEST);gl.clearColor(.067,.109,.167,1);
  const u=Object.fromEntries(["eye","right","up","forward","scale"].map(k=>[k,gl.getUniformLocation(program,k)]));
  return (w,h,eye,right,up,forward,focal)=>{
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,environmentBuffer);
    for(const [location,offset] of attributes){
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset);
    }
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(u.eye,eye);gl.uniform3fv(u.right,right);gl.uniform3fv(u.up,up);gl.uniform3fv(u.forward,forward);
    gl.uniform2f(u.scale,focal*h/w,focal);
    let start=0;
    const replacements=[...models.keys()].map(id=>placements.get(id)).sort((a,b)=>a.first-b.first);
    for(const {first,end} of replacements){
      gl.drawArrays(gl.TRIANGLES,start,first-start);
      start=end;
    }
    gl.drawArrays(gl.TRIANGLES,start,verts.length/6-start);
    for(const [location] of attributes) gl.disableVertexAttribArray(location);
    if(models.size) avatarRenderer.draw(models,eye,right,up,forward,[focal*h/w,focal]);

  };
}

function canvasRenderer(){
  const paint=[];
  const sky=[.105,.159,.226];
  for(let i=groundVertexEnd;i<verts.length;i+=18) paint.push({v:verts.slice(i,i+18),floor:i<pathVertexEnd});
  return (w,h,eye,right,up,forward,focal)=>{
    ctx.fillStyle="#152538";ctx.fillRect(0,0,w,h);
    const basis=focal*h/2;
    const horizon=h/2+dot(forward,[0,1,0])*basis/Math.max(.1,up[1]);
    ctx.fillStyle="#354d43";ctx.fillRect(0,Math.max(0,horizon),w,h);
    const faces=[];
    for(const {v,floor} of paint){
      const view=[];
      for(const i of [0,6,12]){
        const p=[v[i]-eye[0],v[i+1]-eye[1],v[i+2]-eye[2]];
        view.push([dot(p,right),dot(p,up),dot(p,forward)]);
      }
      const visible=[];
      for(let i=0;i<3;i++){
        const a=view[i],b=view[(i+1)%3];
        if(a[2]>=.2) visible.push(a);
        if((a[2]>=.2)!==(b[2]>=.2)) visible.push(mix(a,b,(.2-a[2])/(b[2]-a[2])));
      }
      if(visible.length<3) continue;
      const screen=visible.map(([x,y,z])=>[w/2+basis*x/z,h/2-basis*y/z]);
      const xs=screen.map(p=>p[0]),ys=screen.map(p=>p[1]);
      const left=Math.min(...xs),rightEdge=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      if(left>w||rightEdge<0||top>h||bottom<0||(rightEdge-left)*(bottom-top)<.3) continue;
      const depth=visible.reduce((sum,p)=>sum+p[2],0)/visible.length;
      const haze=Math.min(.8,Math.max(0,(depth-19)/136));
      const color=mix(v.slice(3,6),sky,haze).map(x=>Math.round(x*255));
      faces.push({screen,depth,color,floor});
    }
    faces.sort((a,b)=>Number(b.floor)-Number(a.floor)||b.depth-a.depth);
    for(const {screen,color} of faces){
      ctx.fillStyle="rgb("+color.join(",")+")";
      ctx.beginPath();ctx.moveTo(...screen[0]);
      for(const p of screen.slice(1))ctx.lineTo(...p);
      ctx.closePath();ctx.fill();
    }
  };
}

function renderScene(roster){
  if(roster.length!==200 || new Set(roster.map(([id])=>id)).size!==200) throw new Error("Roster OASIS nesouhlasí.");
  buildEnvironment();placeRoster(roster);
  let avatarRenderer;
  try {
    if(gl && typeof createImageBitmap==="function") avatarRenderer=createAvatarRenderer(gl,shader);
  } catch(error) {
    console.warn("GLB vykreslení není dostupné.",error);
  }
  const models=new Map();
  const pending=new Set();
  const failed=new Set();
  const requests=[];
  let active=0;
  const modelStatus=document.querySelector("#model-status");
  function updateModelStatus(){
    if(!avatarRenderer) modelStatus.textContent="V tomto prohlížeči se zobrazují pracovní figury.";
    else if(pending.size) modelStatus.textContent="Načítám modely OASIS · "+models.size+" ze 6 připraveno.";
    else if(models.size===6) modelStatus.textContent="Všech šest modelů OASIS je načteno.";
    else if(failed.size) modelStatus.textContent=models.size+" ze 6 modelů OASIS načteno. "+failed.size+" se nepodařilo načíst. Opakuj výběr pohledu U jeslí.";
    else if(models.size) modelStatus.textContent=models.size+" ze 6 modelů OASIS načteno. Ostatní lze načíst z pohledu U jeslí.";
    else modelStatus.textContent="Modely OASIS načte pohled U jeslí nebo výběr některé ze šesti hlavních postav.";
  }
  function startRequests(){
    while(active<2 && requests.length){
      const id=requests.shift();
      active++;
      avatarRenderer.load(MODEL_IDS[id],placements.get(id)).then(model=>models.set(id,model))
        .catch(error=>{failed.add(id);console.warn("Model "+id+" zůstává jako pracovní figura.",error);})
        .finally(()=>{active--;pending.delete(id);updateModelStatus();startRequests();});
    }
  }
  function requestModels(ids){
    if(!avatarRenderer) return;
    for(const id of ids){
      if(!Object.hasOwn(MODEL_IDS,id)||!placements.has(id)||models.has(id)||pending.has(id)) continue;
      failed.delete(id);
      pending.add(id);
      requests.push(id);
    }
    updateModelStatus();
    startRequests();
  }
  updateModelStatus();
  const draw=gl?gpuRenderer(avatarRenderer,models):canvasRenderer();
  const pad=document.querySelector(".pad");
  const presets={overview:[-.20,.50,56,[0,2.4,0]],entrance:[0,-.012,0,[0,1.65,32]],center:[0,.025,0,[0,1.65,12.2]],east:[1.33,0,0,[23,1.65,0]]};
  let yaw,pitch,distance,anchor,walking,pointer;
  const keys=new Set();
  function setView(name){
    [yaw,pitch,distance,anchor]=presets[name];
    if(name==="center") requestModels(Object.keys(MODEL_IDS));
    anchor=anchor.slice();walking=distance===0;keys.clear();pad.hidden=!walking;
    document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===name)));
    canvas.focus({preventScroll:true});
  }
  function locate(id){
    const p=placements.get(id);
    if (!p){status.textContent=roster.length+" avatarů OASIS · prostorová studie";return;}
    requestModels([id]);
    setView("overview");anchor=[p.x,p.height*.6,p.z];distance=7;pitch=.29;
    status.textContent=p.name+" · "+(id.startsWith("scene:")?"postava betléma":id);
  }
  for(const [id,p] of placements) selector.add(new Option(p.name+" · "+(id.startsWith("scene:")?"betlém":id),id));
  selector.addEventListener("change",()=>locate(selector.value));
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{
    selector.value="";locate("");setView(b.dataset.view);
  }));
  canvas.addEventListener("pointerdown",e=>{pointer=[e.pointerId,e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{
    if(pointer?.[0]!==e.pointerId)return;
    yaw+=(walking?-1:1)*(pointer[1]-e.clientX)*.006;
    pitch=Math.max(walking?-1.1:.08,Math.min(walking?1.1:1.42,pitch+(e.clientY-pointer[2])*.005));
    pointer=[e.pointerId,e.clientX,e.clientY];
  });
  const endPointer=()=>{pointer=null;};
  canvas.addEventListener("pointerup",endPointer);canvas.addEventListener("lostpointercapture",endPointer);
  canvas.addEventListener("wheel",e=>{if(walking)return;e.preventDefault();distance=Math.max(4,Math.min(86,distance*Math.exp(e.deltaY*.001)));},{passive:false});
  const moves={w:"forward",arrowup:"forward",s:"back",arrowdown:"back",a:"left",arrowleft:"left",d:"right",arrowright:"right"};
  canvas.addEventListener("keydown",e=>{const k=moves[e.key.toLowerCase()];if(k&&walking){e.preventDefault();keys.add(k);}});
  window.addEventListener("keyup",e=>keys.delete(moves[e.key.toLowerCase()]));
  window.addEventListener("blur",()=>keys.clear());canvas.addEventListener("blur",()=>keys.clear());
  pad.querySelectorAll("button").forEach(b=>{
    b.addEventListener("pointerdown",e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);});
    for(const event of ["pointerup","pointercancel","lostpointercapture"]) b.addEventListener(event,()=>keys.delete(b.dataset.move));
  });
  const clear=(x,z)=>x*x+z*z<37*37 && blockers.every(([a,b,r])=>(x-a)**2+(z-b)**2>(r+.28)**2);
  setView("overview");locate("");
  let previous=0, lastFrame="";
  function frame(now){
    requestAnimationFrame(frame);
    if(!gl&&now-previous<65)return;
    const dt=Math.min(.05,(now-previous)/1000);previous=now;
    const forward=[Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
    const right=unit(cross(forward,[0,1,0])),up=cross(right,forward);
    if(walking&&keys.size){
      const flat=unit([forward[0],0,forward[2]]);
      const shift=mul(unit(add(mul(flat,Number(keys.has("forward"))-Number(keys.has("back"))),mul(right,Number(keys.has("right"))-Number(keys.has("left"))))),dt*4.4);
      if(clear(anchor[0]+shift[0],anchor[2]))anchor[0]+=shift[0];
      if(clear(anchor[0],anchor[2]+shift[2]))anchor[2]+=shift[2];
    }
    const dpr=Math.min(devicePixelRatio,1.7);
    const w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const eye=walking?anchor:sub(anchor,mul(forward,distance));
    const focal=Math.min(1.65,1.25*w/h);
    const key=[w,h,...eye,yaw,pitch,models.size].join(",");
    if(key!==lastFrame){draw(w,h,eye,right,up,forward,focal);lastFrame=key;}
  }
  requestAnimationFrame(frame);
}

try {
  if(!gl&&!ctx) throw new Error("Prohlížeč nepodporuje vykreslení 3D scény.");
  const response=await fetch("/betlem/roster.json");
  if(!response.ok) throw new Error("Roster OASIS se nepodařilo načíst.");
  renderScene(await response.json());
} catch(error) {status.textContent=error.message;console.error(error);}
