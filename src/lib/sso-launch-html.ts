import { escapeHtml, ssoSiteActionUrl } from "./sso";

const CHEESE_PATHS = [
  "M3.02,8.48C6.47,6.38,19.26-.88,32.73,2.32c1.58.37,3.28.92,5.03,1.7",
  "M3.48,6.14C6.63,3.57,10.93.93,15.08,1.77c3.59.73,4.45,3.54,8.13,4.9,2.86,1.06,7.42,1.24,14.85-2.65",
  "M3.48,1.61c10.92,6.09,19.62,6.9,24.42,6.87,2.61-.01,8.36-.05,9.23-2.19.71-1.76-2.24-4.05-3.1-4.68",
];

function launchPageCss() {
  return `
html,body{height:100%;margin:0}
body{font-family:"DM Sans",ui-sans-serif,system-ui,sans-serif;background:#f3f1ef;color:#111;letter-spacing:-.025em}
canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none}
.wrap{position:relative;z-index:1;min-height:100%;display:flex;align-items:center;justify-content:center;padding:1rem}
.card{width:100%;max-width:24rem;background:#fff;border:1px solid oklch(.92 0 0);border-radius:.5rem;box-shadow:0 1px 2px hsl(0 0% 0%/.18);padding:1.5rem 1.5rem 1.75rem;text-align:center}
.logo{height:3rem;margin:0 auto .75rem;display:block}
.lead{margin:0;font-size:.875rem;line-height:1.4;color:oklch(.44 0 0)}
.email{margin:.35rem 0 0;font-size:1.05rem;font-weight:600;line-height:1.35;word-break:break-word}
.msg{margin:0;font-size:.95rem;line-height:1.45;color:oklch(.44 0 0)}
h1{margin:0 0 .75rem;font-size:1.15rem;font-weight:650}
.continue{display:none;margin-top:1.25rem;width:100%;border:0;border-radius:.4rem;background:#66a043;color:#fff;font:inherit;font-weight:600;padding:.65rem .9rem;cursor:pointer}
body.stalled .continue{display:block}
.continue:hover{filter:brightness(.95)}
a.back{display:inline-block;margin-top:1.25rem;color:#66a043;font-size:.875rem;font-weight:600;text-decoration:none}
a.back:hover{text-decoration:underline}
noscript .continue{display:block;margin-top:1.25rem}
`.trim();
}

function cheeseScript() {
  const paths = JSON.stringify(CHEESE_PATHS);
  return `
(function(){
  var canvas=document.getElementById("cheese");
  if(!canvas||!canvas.getContext)return;
  var ctx=canvas.getContext("2d");
  var PATHS=${paths};
  var COLORS=["#e8a317","#f0b429","#d99212","#f5c84a","#c9840f"];
  var cache={};
  var particles=[];
  var w=0,h=0,last=0,frame=0;
  var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function hash(i){var x=Math.sin(i*127.1)*43758.5453;return x-Math.floor(x)}
  function bounds(d){
    var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("width","0");svg.setAttribute("height","0");
    svg.style.cssText="position:absolute;visibility:hidden";
    var el=document.createElementNS("http://www.w3.org/2000/svg","path");
    el.setAttribute("d",d);svg.appendChild(el);document.body.appendChild(svg);
    var box=el.getBBox();svg.remove();
    return {path:new Path2D(d),cx:box.x+box.width/2,cy:box.y+box.height/2,size:Math.max(box.width,box.height,1)};
  }
  PATHS.forEach(function(d){cache[d]=bounds(d)});
  function make(i){
    return {x:hash(i)*w,y:hash(i+1)*h,vx:(hash(i+2)-.5)*18,vy:28+hash(i+4)*42,rot:hash(i+5)*Math.PI*2,vr:(hash(i+6)-.5)*1.4,length:14+hash(i+7)*22,width:2.2+hash(i+8)*2.2,color:COLORS[Math.floor(hash(i+9)*COLORS.length)],path:PATHS[Math.floor(hash(i+11)*PATHS.length)]};
  }
  function resize(){
    var dpr=Math.min(window.devicePixelRatio||1,2);
    w=canvas.clientWidth;h=canvas.clientHeight;
    canvas.width=Math.max(1,Math.floor(w*dpr));
    canvas.height=Math.max(1,Math.floor(h*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    var count=Math.max(70,Math.round((w*h)/18000));
    while(particles.length<count)particles.push(make(particles.length+1));
    particles.length=count;
  }
  function draw(s){
    var c=cache[s.path];if(!c)return;
    var scale=s.length/c.size;
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);ctx.scale(scale,scale);ctx.translate(-c.cx,-c.cy);
    ctx.strokeStyle=s.color;ctx.globalAlpha=.82;ctx.lineCap="round";ctx.lineJoin="round";
    ctx.lineWidth=s.width/Math.max(scale,.001);ctx.stroke(c.path);ctx.restore();
  }
  function tick(now){
    var dt=Math.min(.05,(now-last)/1000);last=now;
    if(!reduce){
      particles.forEach(function(s){
        s.y+=s.vy*dt;s.x+=s.vx*dt+Math.sin(s.y*.02+s.rot)*8*dt;s.rot+=s.vr*dt;
        if(s.y-s.length>h){s.y=-s.length;s.x=hash(s.y+s.x+1)*w}
      });
    }
    ctx.clearRect(0,0,w,h);
    particles.forEach(draw);
    if(!reduce)frame=requestAnimationFrame(tick);
  }
  resize();
  window.addEventListener("resize",resize);
  last=performance.now();
  frame=requestAnimationFrame(tick);
})();
`.trim();
}

function launchDocument(input: { title: string; card: string; extraScript?: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(input.title)}</title>
<style>${launchPageCss()}</style>
</head>
<body>
<canvas id="cheese" aria-hidden="true"></canvas>
<div class="wrap">
  <div class="card">
    <img class="logo" src="/branding/logo-full.svg" alt="TacoWP">
    ${input.card}
  </div>
</div>
<script>${cheeseScript()}</script>
${input.extraScript ? `<script>${input.extraScript}</script>` : ""}
</body>
</html>`;
}

export function launchFormHtml(siteUrl: string, ticket: string, email: string): string {
  const action = escapeHtml(ssoSiteActionUrl(siteUrl));
  const secret = escapeHtml(ticket);
  const safeEmail = escapeHtml(email);

  return launchDocument({
    title: "Opening WordPress admin",
    card: `<form id="sso" method="post" action="${action}" accept-charset="UTF-8">
      <input type="hidden" name="wppu_action" value="sso">
      <input type="hidden" name="ticket" value="${secret}">
      <p class="lead">Logging you in as</p>
      <p class="email">${safeEmail}</p>
      <noscript><button class="continue" type="submit">Continue to WordPress admin</button></noscript>
      <button id="continue" class="continue" type="submit">Continue to WordPress admin</button>
    </form>`,
    extraScript: `
(function(){
  var form=document.getElementById("sso");
  if(!form)return;
  form.submit();
  setTimeout(function(){document.body.classList.add("stalled")},10000);
})();
`.trim(),
  });
}

export function launchErrorHtml(title: string, message: string, backHref: string): string {
  return launchDocument({
    title,
    card: `<h1>${escapeHtml(title)}</h1>
      <p class="msg">${escapeHtml(message)}</p>
      <a class="back" href="${escapeHtml(backHref)}">Back to site</a>`,
  });
}
