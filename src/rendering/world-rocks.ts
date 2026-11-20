const TAU=Math.PI*2,N=9;
function rng(a: number){return()=>{a=(a+0x6D2B79F5)>>>0;
  let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
  return((t^t>>>14)>>>0)/4294967296}}
const SH=[84,99,92],MD=[138,145,148],LT=[204,209,210];
  const lerp=(a: number,b: number,t: number)=>a+(b-a)*t;
  const cl=(v: number)=>Math.max(0,Math.min(255,v))|0;
  const rgb=(c: number[],d = 0)=>{d=d||0;
  return'rgb('+cl(c[0]+d)+','+cl(c[1]+d)+','+cl(c[2]+d)+')'};
function tone(t: number,tint: number[]){const q=Math.round(Math.max(0,Math.min(1,t))*5)/5,u=q<.5?q/.5:(q-.5)/.5,A=q<.5?SH:MD,B=q<.5?MD:LT;
  return[lerp(A[0],B[0],u)+tint[0],lerp(A[1],B[1],u)+tint[1],lerp(A[2],B[2],u)+tint[2]]}

export function buildRock(seed: number,size: number){
  const r=rng(seed*7919+13);
  const rx=size*(.44+r()*.08),ry=rx*(.5+r()*.1),H=size*(.42+r()*.14);
  const rot=r()*TAU,lean=(r()-.5)*size*.14;
  const tint=[(r()-.5)*10,(r()-.5)*8,(r()-.5)*10];
  const R0: number[][]=[],R1=[],R2=[],ang=[];
  for(let i=0;i<N;i++){
    const a=rot+(i+(r()-.5)*.45)/N*TAU;ang.push(a);
  const k0=.86+r()*.26,x0=Math.cos(a)*rx*k0,y0=Math.sin(a)*ry*k0;
  const k1=.8+r()*.2,h1=H*(.48+r()*.2),k2=.4+r()*.2,h2=H*(.92+r()*.26);
    R0.push([x0,y0]);R1.push([x0*k1+lean*.4,y0*k1-h1]);R2.push([x0*k2+lean,y0*k2*.8-h2]);
  }
  const faces: {p: number[]; f: string}[]= [];
  const face=(pts: number[][],t: number)=>{const c=tone(t,tint);faces.push({p:pts.flat(),f:rgb(c)})};
  const order=[...Array(N).keys()].sort((a,b)=>(R0[a][1]+R0[(a+1)%N][1])-(R0[b][1]+R0[(b+1)%N][1]));
  for(const i of order){
    const j=(i+1)%N,am=ang[i]+((ang[j]-ang[i]+TAU)%TAU)/2,cx=Math.cos(am),sy=Math.sin(am);
  const lit=(nz: number)=>{const c=Math.sqrt(1-nz*nz);
  return -.75*cx*c-.25*sy*c+.62*nz};
  const tl=.52+lit(.18)*.55+(r()-.5)*.1,tu=.52+lit(.75)*.55+(r()-.5)*.1;
  if(r()<.35){face([R0[i],R0[j],R1[i]],tl+.1);face([R0[j],R1[j],R1[i]],tl-.1)}else face([R0[i],R0[j],R1[j],R1[i]],tl);
  if(r()<.5){face([R1[i],R1[j],R2[i]],tu+.1);face([R1[j],R2[j],R2[i]],tu-.1)}else face([R1[i],R1[j],R2[j],R2[i]],tu);
  }
  face(R2.slice(0,5),.8);
  face(R2.slice(4).concat([R2[0]]),.6); // platô facetado
  const used=new Set<number>(),scars=[],frags=[];
  for(let c=0;c<2;c++){
    let m;do{m=(r()*N)|0}while(used.has(m));
  used.add(m);
  const n=(m+1)%N;
  scars.push([R1[m][0],R1[m][1],R1[n][0],R1[n][1],(R0[m][0]+R0[n][0])*.35+(R1[m][0]+R1[n][0])*.15,(R0[m][1]+R0[n][1])*.35+(R1[m][1]+R1[n][1])*.15]);
  }
  for(let c=0;c<4;c++){
    const x=(r()-.5)*rx*3,y=ry*(.5+r()*.6),s=size*(.05+r()*.04),a=r()*TAU,col=tone(.5+r()*.3,tint);
  frags.push({p:[x+Math.cos(a)*s,y+Math.sin(a)*s*.7,x+Math.cos(a+2.3)*s,y+Math.sin(a+2.3)*s*.7,x+Math.cos(a+4.2)*s*.8,y+Math.sin(a+4.2)*s*.6],f:rgb(col)});
  }
  return { faces, scars, frags, sw: rx * 1.2, sh: ry * .95, sx: size * .07, sy: ry * .18, scarF: rgb(tone(.9, tint)) };
}
function poly(ctx: CanvasRenderingContext2D,p: number[]){ctx.beginPath();
  ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);
  ctx.closePath()}
/* stage 0..3 (dano) · hit 1→0 (impacto) · (x,y) = ponto de contato com o chão */
export function drawRock(ctx: CanvasRenderingContext2D,s: ReturnType<typeof buildRock>,x: number,y: number,stage: number,hit: number){
  ctx.save();
  ctx.translate(x,y);
  ctx.fillStyle='rgba(22,48,28,.13)';
  ctx.beginPath();
  ctx.ellipse(s.sx,s.sy,s.sw*1.12,s.sh*1.15,0,0,TAU);
  ctx.fill();
  ctx.fillStyle='rgba(22,48,28,.22)';
  ctx.beginPath();
  ctx.ellipse(s.sx,s.sy,s.sw,s.sh,0,0,TAU);
  ctx.fill();
  if (stage >= 1) {
    const count = stage >= 2 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const fragment = s.frags[i];
      poly(ctx, fragment.p);
      ctx.fillStyle = fragment.f;
      ctx.fill();
    }
  }

  if (hit > 0) {
    ctx.translate(Math.sin(hit * 34) * 1.3 * hit, 0);
    ctx.scale(1 + .035 * hit, 1 - .05 * hit);
  }

  for (const face of s.faces) {
    poly(ctx, face.p);
    ctx.fillStyle = face.f;
    ctx.fill();
  }

  if (stage >= 2) {
    const count = stage >= 3 ? 2 : 1;
    ctx.fillStyle = s.scarF;
    for (let i = 0; i < count; i++) {
      poly(ctx, s.scars[i]);
      ctx.fill();
    }
  }
  ctx.restore();
}
