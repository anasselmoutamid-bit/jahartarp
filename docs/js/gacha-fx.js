/* ── gacha-fx.js — FX Particle Engine + Card Reveal Cinematic ── */
/* Dépendances : GSAP 3.12.5 + CustomEase, chargé avant gacha-logic.js */
const FX = (() => {
  let canvas, ctx, raf, particles = [], running = false;

  function init() {
    canvas = document.getElementById('fx-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // ── Particle factory ──────────────────────────────────────────
  function mkStar(col) {
    const a = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 3.5;
    return {
      type: 'star',
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: Math.cos(a) * spd * .3,
      vy: Math.sin(a) * spd * .3,
      r: .5 + Math.random() * 2,
      col,
      alpha: .8 + Math.random() * .2,
      life: 1, decay: .008 + Math.random() * .012,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpd: .05 + Math.random() * .08
    };
  }

  function mkComet(col) {
    const fromTop = Math.random() < .5;
    const x = fromTop ? Math.random() * canvas.width : (Math.random() < .5 ? -10 : canvas.width + 10);
    const y = fromTop ? -10 : Math.random() * canvas.height * .6;
    const angle = fromTop
      ? (Math.PI * .3 + Math.random() * Math.PI * .4)
      : (x < 0 ? -(Math.PI * .15) + Math.random() * (Math.PI * .3) : Math.PI + Math.PI * .15 - Math.random() * (Math.PI * .3));
    const spd = 6 + Math.random() * 10;
    return {
      type: 'comet',
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      len: 40 + Math.random() * 80,
      r: 1.5 + Math.random() * 2,
      col,
      alpha: 1,
      life: 1, decay: .018 + Math.random() * .018,
      trail: []
    };
  }

  function mkBurst(x, y, col, tier) {
    const count = 18 + tier * 6;
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * .3;
      const spd = (3 + Math.random() * (4 + tier * 2));
      out.push({
        type: 'burst',
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: 1 + Math.random() * (2 + tier * .5),
        col,
        alpha: 1,
        life: 1, decay: .016 + Math.random() * .02,
        gravity: .08
      });
    }
    return out;
  }

  function mkRing(x, y, col) {
    return [{
      type: 'ring',
      x, y, r: 10, maxR: 220 + Math.random() * 80,
      col, alpha: .8, life: 1, decay: .022,
      growSpd: 14
    }];
  }

  function mkSparkle(col, tier) {
    const count = 30 + tier * 10;
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = .5 + Math.random() * 2.5;
      out.push({
        type: 'sparkle',
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: .5 + Math.random() * 1.5,
        col,
        alpha: .9,
        life: 1, decay: .01 + Math.random() * .015,
        rot: Math.random() * Math.PI * 2,
        rotSpd: (.05 + Math.random() * .1) * (Math.random() < .5 ? 1 : -1)
      });
    }
    return out;
  }

  // ── Draw helpers ──────────────────────────────────────────────
  function drawStar(p) {
    const twinkle = .6 + .4 * Math.sin(p.twinkle);
    ctx.save();
    ctx.globalAlpha = p.alpha * p.life * twinkle;
    ctx.fillStyle = p.col;
    ctx.shadowColor = p.col;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    p.twinkle += p.twinkleSpd;
  }

  function drawComet(p) {
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 18) p.trail.shift();
    ctx.save();
    ctx.globalAlpha = p.alpha * p.life;
    const grad = ctx.createLinearGradient(
      p.trail[0]?.x ?? p.x, p.trail[0]?.y ?? p.y, p.x, p.y
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, p.col);
    ctx.strokeStyle = grad;
    ctx.lineWidth = p.r;
    ctx.shadowColor = p.col;
    ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < p.trail.length; i++) {
      const t = p.trail[i];
      i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y);
    }
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    // Head glow
    ctx.globalAlpha = p.life;
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBurst(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha * p.life;
    ctx.fillStyle = p.col;
    ctx.shadowColor = p.col;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRing(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha * p.life * p.life;
    ctx.strokeStyle = p.col;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = p.col;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    p.r += p.growSpd;
    p.growSpd *= .93;
  }

  function drawSparkle(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha * p.life;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.col;
    ctx.shadowColor = p.col;
    ctx.shadowBlur = 10;
    // 4-point star shape
    const r = p.r, r2 = r * .35;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r2;
      i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
               : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    p.rot += p.rotSpd;
  }

  // ── Main loop ─────────────────────────────────────────────────
  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles = particles.filter(p => p.life > 0);

    for (const p of particles) {
      p.life -= p.decay;
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === 'burst') p.vy += p.gravity;
      if (p.type === 'sparkle') { p.vx *= .98; p.vy *= .98; }
      if (p.type === 'comet') { p.vx *= .995; p.vy *= .995; }

      if (p.type === 'star') drawStar(p);
      else if (p.type === 'comet') drawComet(p);
      else if (p.type === 'burst') drawBurst(p);
      else if (p.type === 'ring') drawRing(p);
      else if (p.type === 'sparkle') drawSparkle(p);
    }

    raf = requestAnimationFrame(tick);
  }

  // ── Public API ────────────────────────────────────────────────
  function start(col, tier) {
    if (!canvas) init();
    particles = [];
    running = true;
    canvas.classList.add('active');

    // Ambient stars
    for (let i = 0; i < 40 + tier * 10; i++) {
      const p = mkStar(col);
      p.life = Math.random(); // stagger
      particles.push(p);
    }

    // Sparkles dès le départ
    particles.push(...mkSparkle(col, tier));

    // Comètes progressives
    const cometCount = 3 + tier * 2;
    for (let i = 0; i < cometCount; i++) {
      setTimeout(() => { if (running) particles.push(mkComet(col)); }, i * 180);
    }

    // Burst + ring au centre au moment de l'explosion (appelé depuis bExplode)
    tick();
  }

  function burst(col, tier) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    particles.push(...mkBurst(cx, cy, col, tier));
    particles.push(...mkRing(cx, cy, col));
    // Extra comètes à l'explosion
    for (let i = 0; i < 4 + tier; i++) {
      setTimeout(() => { if (running) particles.push(mkComet(col)); }, i * 120);
    }
    // Deuxième ring légèrement décalé pour Legendary+
    if (tier >= 4) {
      setTimeout(() => {
        particles.push(...mkRing(cx, cy, col));
        particles.push(...mkBurst(cx, cy, '#ffffff', 1));
      }, 200);
    }
  }

  function stop() {
    running = false;
    canvas.classList.remove('active');
    if (raf) cancelAnimationFrame(raf);
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = [];
  }

  return { init, start, burst, stop };
})();

async function showPullResults(res,count){
  const ov=document.getElementById('po'),ra=document.getElementById('ra'),bui=document.querySelector('.blob-ui');

  // Determine highest rarity for effects
  let hi=0;res.forEach(r=>{const i=RARITY_ORDER.indexOf(r.rarity);if(i>hi)hi=i});
  const tr=RARITY_ORDER[hi],isLeg=['Legendary','Mythic','Unique','Artifact'].includes(tr);

  // Add orbitals for ALL items — every rarity gets orbs now
  const hiTier=RARITY_ORDER.indexOf(tr);
  for(const it of res){
    const ri=RARITY_ORDER.indexOf(it.rarity);
    bAddOrbital(RCOL[it.rarity]||'#8a8fa8', ri);
  }
  const hasOrbitals=res.length>0;

  // Start FX particle field
  FX.start(RCOL[tr]||'#4DA3FF', hiTier);

  // Let orbitals approach and orbit visibly before exploding
  if(hasOrbitals){
    const hiCol=new THREE.Color(RCOL[tr]||'#ffd60a');
    bSetCol(hiCol,C_MAG);
    bCompact(.35,.22);
    const st=document.getElementById('pst');
    st.textContent=isLeg?'⚡ RARE ENERGY DETECTED ⚡':'CRYSTALLIZING';
    st.style.color=RCOL[tr]||'var(--blue)';
    await sleep(2400);
    st.style.color='';
  }

  // Explosion blob + burst FX
  bExplode();
  FX.burst(RCOL[tr]||'#ffd60a', hiTier);
  if(isLeg){const f=document.createElement('div');f.className='leg-flash';f.style.background=`radial-gradient(circle,${RCOL[tr]||'#ffd60a'}50,transparent 70%)`;document.body.appendChild(f);setTimeout(()=>f.remove(),1000)}
  await sleep(700);

  bui.style.display='none';ra.classList.add('active');

  // ── Easings custom GSAP ─────────────────────────────────────
  CustomEase.create('cardFlip','M0,0 C0.2,0 0.1,1.4 0.4,1.05 0.6,0.8 0.8,1 1,1');
  CustomEase.create('cardSettle','M0,0 C0,0 0.05,1.2 0.3,1.06 0.55,0.92 0.75,1.01 1,1');

  if(count===1){
    // ── REVEAL x1 : entrée cinématique GSAP ──────────────────
    const it=res[0],css=RCSS[it.rarity]||'r-c',col=RCOL[it.rarity]||'#8a8fa8';
    ra.innerHTML=`<div class="result-card ${css}" style="color:${col};opacity:0;transform-style:preserve-3d"><div class="res-rar" style="color:${col}">${it.rarity.toUpperCase()}</div><div class="res-icon">${it.icon}</div><div class="res-name">${it.name}${it.qty>1?' ×'+it.qty:''}</div></div><button class="result-dismiss" onclick="dismiss()" style="opacity:0">CONTINUER</button>`;
    const card=ra.querySelector('.result-card');
    const btn=ra.querySelector('.result-dismiss');
    if(prefersReducedMotion){
      card.style.opacity='1';
      btn.style.opacity='1';
    }else{
      const tl=gsap.timeline();
      tl.fromTo(card,
        {opacity:0,scale:.3,rotateY:180,y:60},
        {opacity:1,scale:1,rotateY:0,y:0,duration:.9,ease:'cardFlip'}
      );
      tl.fromTo(card,
        {boxShadow:`0 0 80px ${col}, 0 0 160px ${col}44`},
        {boxShadow:`0 0 20px ${col}44, 0 0 0px transparent`,duration:1.4,ease:'power2.out'},
        '-=.5'
      );
      const icon=card.querySelector('.res-icon');
      if(icon) tl.fromTo(icon,{scale:0,rotation:-20},{scale:1,rotation:0,duration:.5,ease:'back.out(2.5)'},'-=.7');
      const rar=card.querySelector('.res-rar');
      if(rar) tl.fromTo(rar,{opacity:0,y:-12},{opacity:1,y:0,duration:.35,ease:'power2.out'},'-=.4');
      tl.to(btn,{opacity:1,duration:.4,ease:'power1.out'},'-=.1');
      if(['Legendary','Mythic','Unique','Artifact'].includes(it.rarity)){
        tl.fromTo(ov,{x:0},{x:[-5,4,-3,2,0],duration:.35,ease:'none'},'-=.8');
        tl.fromTo(card,
          {boxShadow:`0 0 120px ${col}, 0 0 240px ${col}`},
          {boxShadow:`0 0 24px ${col}66`,duration:1.2,ease:'power3.out'},
          '-=1.2'
        );
      }
    }
  }else{
    // ── REVEAL multi (x5/x10) : stagger GSAP ─────────────────
    let h='<div class="multi-results">';
    res.forEach((it,i)=>{const css=RCSS[it.rarity]||'r-c';h+=`<div class="mini-res ${css} revealed" data-reveal="${i}" style="color:${RCOL[it.rarity]||'#8a8fa8'};opacity:0"><div class="mr-icon">${it.icon}</div><div class="mr-name">${it.name}${it.qty>1?' ×'+it.qty:''}</div><div class="mr-rar">${it.rarity.toUpperCase()}</div></div>`;});
    h+='</div>';
    const cn={};res.forEach(r=>{cn[r.rarity]=(cn[r.rarity]||0)+1});
    let sm='<div class="pull-summary" style="opacity:0">';
    for(const[r,c]of Object.entries(cn).sort((a,b)=>RARITY_ORDER.indexOf(b[0])-RARITY_ORDER.indexOf(a[0])))
      sm+=`<span style="color:${RCOL[r]||'#8a8fa8'};margin-right:12px;font-family:var(--font-m);font-size:.45rem;letter-spacing:.08em">${r}: ×${c}</span>`;
    h+=`${sm}</div><button class="result-dismiss" onclick="dismiss()" style="opacity:0">CONTINUER</button>`;
    ra.innerHTML=h;

    const cards=[...ra.querySelectorAll('.mini-res')];
    const HIGH_RARITY=['Epic','Legendary','Mythic','Unique','Artifact'];
    const ULTRA=['Legendary','Mythic','Unique','Artifact'];
    const summary=ra.querySelector('.pull-summary');
    const btn=ra.querySelector('.result-dismiss');

    if(prefersReducedMotion){
      cards.forEach(c=>{c.style.opacity='1';});
      if(summary) summary.style.opacity='1';
      btn.style.opacity='1';
    }else{
      gsap.set(cards,{rotateY:90,scale:.3,y:30,opacity:0});

      let cursor=0;
      const masterTl=gsap.timeline();

      for(let i=0;i<cards.length;i++){
        const card=cards[i];
        const rarity=res[i].rarity;
        const isHigh=HIGH_RARITY.includes(rarity);
        const isUltra=ULTRA.includes(rarity);
        const col=RCOL[rarity]||'#8a8fa8';
        const gap=isUltra?.38:isHigh?.25:.14;
        cursor+=gap;
        const dur=isUltra?.65:isHigh?.55:.42;
        masterTl.to(card,{
          opacity:1,rotateY:0,scale:1,y:0,
          duration:dur,
          ease:isUltra?'cardFlip':'cardSettle'
        },cursor);
        if(isHigh){
          masterTl.fromTo(card,
            {boxShadow:`0 0 50px ${col}`},
            {boxShadow:`0 0 ${isUltra?'20':'10'}px ${col}44`,duration:isUltra?.9:.6,ease:'power2.out'},
            cursor+'.05'
          );
        }
        if(isUltra){
          masterTl.fromTo(ov,{x:0},{x:[-4,3,-2,1,0],duration:.28,ease:'none'},cursor+'.1');
          masterTl.call(()=>FX.burst(col,RARITY_ORDER.indexOf(rarity)),null,cursor+'.15');
        }
        cursor+=dur;
      }

      masterTl.to([summary,btn],{opacity:1,duration:.5,stagger:.15,ease:'power2.out'},cursor+'.2');
    }
  }
}

function dismiss(){document.getElementById('po').classList.remove('active');bActive=false;bReset();FX.stop();}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
