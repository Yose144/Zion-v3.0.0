// Geometry for the central set: a winter oak, open shelter and manger.
// A fixed seed keeps each view consistent across WebGL and Canvas.
export function buildSet({add,mix,quad,solid,tube,globe,blockers}) {
  let seed=3827;
  const random=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  const wood=[.32,.20,.12], paleWood=[.56,.37,.21], pine=[.20,.32,.20];
  const amber=[1,.64,.23], straw=[.72,.52,.27], snow=[.65,.72,.75];
  const vary=(color,amount=.24)=>color.map(x=>x*(1-amount/2+random()*amount));
  const polar=(angle,radius,y)=>[Math.cos(angle)*radius,y,-3+Math.sin(angle)*radius];
  const branch=(points,radii,sides=8)=>{
    for(let i=1;i<points.length;i++) tube(points[i-1],points[i],radii[i-1],radii[i],vary(wood),sides);
  };

  const trunk=[[0,0,-3],[-.34,2.1,-3.2],[.24,4.2,-3.1],[-.5,6.5,-3.15],[.2,9.7,-3.5],[.85,13,-3.8]];
  branch(trunk,[2.25,1.58,1.25,1.02,.65,.15],16);
  blockers.push([0,-3,2.3]);
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4+(random()-.5)*.32;
    branch([polar(angle,.5,1.1),polar(angle,2.5,.53),polar(angle,4.3,.22),polar(angle,5.9,.07)],[.72,.51,.26,.03]);
    const start=trunk[2+i%2];
    const fork=polar(angle,3.5+random()*1.7,8.2+random()*2);
    const reach=polar(angle,8.4+random()*3,11.1+random()*2.9);
    branch([start,fork,reach],[.75,.43,.10],10);
    for(let j=-1;j<=1;j++){
      const tip=polar(angle+j*.26,8.3+random()*4.2,12+random()*3.25);
      branch([fork,mix(fork,tip,.55),tip],[.29,.15,.035],7);
      for(let k=0;k<4;k++){
        const p=add(tip,[(random()-.5)*3.4,(random()-.42)*2.4,(random()-.5)*3.7]);
        const width=1.2+random()*2.2;
        globe(p,[width,.85+random()*.76,width*.86],vary(pine,.52),5,9);
        if(k===0) globe(add(p,[.12,.71,-.16]),[width*.52,.24,width*.55],mix(pine,snow,.36),3,7);
        if(j===0 && k<3){
          const lantern=add(tip,[(k-1)*1.2,-1-k*.2,(k-1)*.6]);
          tube(add(lantern,[0,.24,0]),add(lantern,[0,1.1,0]),.012,.012,wood,4);
          solid(lantern,[.20,.37,.20],paleWood);
          globe(lantern,[.145,.15,.145],mix(amber,paleWood,.23),4,7,true);
        }
      }
    }
  }
  for(let i=0;i<50;i++){
    const theta=random()*Math.PI*2;
    const height=.2+random()*5.2;
    const radius=2.27-height*.23;
    tube(polar(theta,radius,height),polar(theta+.055,radius-.10,height+.4+random()*.7),.028,.014,vary(paleWood),4);
  }

  // Roof rafters and overlapping planks leave the front open toward the visitor.
  solid([0,.035,1.44],[5.84,.065,4.27],[.32,.33,.27]);
  for(const x of [-2.58,2.58]) for(const z of [-.12,3.42]){
    solid([x,.19,z],[.62,.34,.57],[.36,.36,.31]);
    solid([x,1.42,z],[.26,2.74,.29],vary(wood),.04);
    tube([x,1.84,z],[x*.76,2.63,z],.09,.09,paleWood,6);
    blockers.push([x,z,.31]);
  }
  for(const x of [-2.6,2.6]) solid([x,2.62,1.65],[.26,.29,4.15],wood);
  for(const z of [-.48,1.5,3.84]){
    for(const side of [-1,1]) tube([0,4.14,z],[side*3.02,2.68,z],.105,.11,vary(paleWood),6);
    tube([-2.72,2.73,z],[2.72,2.73,z],.105,.105,paleWood,6);
  }
  tube([0,4.16,-.56],[0,4.16,3.99],.13,.12,paleWood,8);
  for(const side of [-1,1]){
    for(let row=0;row<8;row++){
      const a=row*.39,b=(row+1)*.39+.04;
      for(let j=0;j<9;j++){
        const z=-.57+j*.51+(row%2)*.024;
        const y=x=>4.22-x*.49;
        const c=vary(row%3===0?paleWood:wood,.36);
        quad([side*a,y(a),z],[side*b,y(b),z],[side*b,y(b),z+.49],[side*a,y(a),z+.49],c);
        if(random()<.36) quad([side*a,y(a)+.025,z+.15],[side*b*.97,y(b*.97)+.025,z+.14],[side*b*.97,y(b*.97)+.025,z+.47],[side*a,y(a)+.025,z+.47],mix(snow,wood,.26));
      }
    }
  }
  for(let i=0;i<13;i++){
    const x=-2.5+i*.41;
    solid([x,.93,-.22],[.38,1.67,.09],vary(wood));
  }
  for(const y of [.33,1.28]) solid([0,y,-.15],[5.23,.12,.12],paleWood);

  // Rough X-shaped trestles, flared boards, straw and the symbolic light.
  const center=2.35;
  for(const x of [-.56,.56]) for(const side of [-1,1]){
    tube([x,.04,center+side*.37],[x,.57,center-side*.26],.063,.063,vary(wood),6);
  }
  solid([0,.34,center],[1.32,.12,.36],wood);
  for(const side of [-1,1]){
    const za=center+side*.18,zb=center+side*.37;
    quad([-.74,.43,za],[.74,.43,za],[.74,.75,zb],[-.74,.75,zb],wood);
    solid([0,.76,zb],[1.52,.085,.083],paleWood);
  }
  for(const x of [-.73,.73]){
    quad([x,.43,center-.18],[x,.43,center+.18],[x,.75,center+.37],[x,.75,center-.37],paleWood);
  }
  for(let i=0;i<135;i++){
    const x=(random()-.5)*1.38,z=center+(random()-.5)*.56,y=.61+random()*.14;
    tube([x,y,z],[x+(random()-.5)*.27,y+(random()-.12)*.11,z+(random()-.5)*.20],.008,.003,vary(straw,.52),4);
  }
  globe([0,.77,center],[.32,.13,.17],[1,.87,.54],5,12,true);
  for(let i=0;i<30;i++){
    const a=random()*Math.PI*2,r=.13+random()*.64;
    const p=[Math.cos(a)*r,.84+random()*.82,center+Math.sin(a)*r*.6];
    globe(p,[.012,.023,.012],mix(amber,[1,.92,.73],random()),3,4,true);
  }
  blockers.push([0,center,.75]);
}
