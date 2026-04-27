/* ═══════════════════════════════════════════════════════════════
   js/kanji-blob.js — WebGL Plexus Sphere + Ambient Field
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

  var N        = isMobile ? 60 : 120;
  var MAX_DIST = isMobile ? 0.52 : 0.45;
  var N_AMB    = isMobile ? 35 : 80;
  var N_ALINE  = isMobile ? 15 : 40;

  var canvas, gl;
  var progNode, progEdge, progBg, progBloom, progCopy, progAmb, progALine;
  var nodeVBO, edgeVBO, quadVBO, ambVBO, alineVBO;
  var fbScene, fbBloom, fbAmb, fbAmbBlur;
  var w, h, startTime, lastTime = 0;
  var exPhase = 0, exTimer = 0;
  var EX_BURST = 0.65, EX_REFORM = 3.2;
  var edgeCount = 0, alineCount = 0;

  /* ════════════════════════════════════════════════════════
     SPHÈRE SHADERS
  ════════════════════════════════════════════════════════ */
  var VS_NODE = [
    'attribute vec4 a;',
    'uniform float uT,uEx,uEp;uniform vec2 uR;uniform vec3 uOff;',
    'varying float vA;',
    'float h(float n){return fract(sin(n)*43758.5453);}',
    'void main(){',
    '  float th=a.x,ph=a.y,sd=a.z,fs=a.w,t=uT;',
    '  float fd=(0.010+h(fs*17.3)*0.015)*sin(t*(0.4+h(fs*31.7)*0.5)+h(fs*53.1)*6.2832);',
    '  float x=cos(ph)*cos(th)*(1.0+fd),y=sin(ph)*(1.0+fd),z=cos(ph)*sin(th)*(1.0+fd);',
    '  if(uEp>0.5){',
    '    float ex=h(sd*31.0+0.1)*2.0-1.0,ey=h(sd*47.0+0.2)*2.0-1.0,ez=h(sd*71.0+0.3)*2.0-1.0;',
    '    float el=sqrt(ex*ex+ey*ey+ez*ez)+0.001,di=1.0+h(sd*13.0)*2.5;',
    '    x+=(ex/el)*uEx*di;y+=(ey/el)*uEx*di;z+=(ez/el)*uEx*di;',
    '  }',
    '  float rot=t*0.07,cr=cos(rot),sr=sin(rot);',
    '  float rx=x*cr-z*sr,rz=x*sr+z*cr;',
    '  float ct=cos(0.20),st=sin(0.20),ry=y*ct-rz*st;rz=y*st+rz*ct;',
    '  float p=3.2/(3.2+rz+1.0),asp=uR.x/uR.y;',
    '  gl_Position=vec4((rx*p*uOff.z+uOff.x)/asp,ry*p*uOff.z+uOff.y,rz*0.1,1.0);',
    '  float bsz=6.0*p*uOff.z*(0.5+h(sd*73.0)*0.8)*uR.y/700.0;',
    '  if(uEp>0.5)bsz*=mix(1.0,1.8,uEx);',
    '  gl_PointSize=clamp(bsz,1.5,22.0);',
    '  float dep=0.4+p*0.7;dep*=mix(1.0,0.12,smoothstep(0.2,-0.8,rz));',
    '  float tw=step(0.93,h(sd*99.0))*(0.4+0.4*sin(t*1.5+sd*22.0));',
    '  vA=clamp(dep+tw*0.3,0.0,1.2);if(uEp>0.5)vA*=mix(1.0,0.4,uEx);',
    '}'
  ].join('\n');
  var FS_NODE = [
    'precision mediump float;varying float vA;',
    'void main(){',
    '  vec2 pc=gl_PointCoord-0.5;float d=length(pc)*2.0;',
    '  float g=exp(-d*d*2.5),c=smoothstep(0.55,0.02,d),a=(g*0.35+c*0.65)*vA;',
    '  gl_FragColor=vec4(mix(vec3(0.72,0.80,0.92),vec3(1.0),c)*a,a);',
    '}'
  ].join('\n');
  var VS_EDGE = [
    'attribute vec4 a;',
    'uniform float uT,uEx,uEp;uniform vec2 uR;uniform vec3 uOff;',
    'varying float vA;',
    'float h(float n){return fract(sin(n)*43758.5453);}',
    'void main(){',
    '  float th=a.x,ph=a.y,sd=a.z,fs=a.w,t=uT;',
    '  float fd=(0.010+h(fs*17.3)*0.015)*sin(t*(0.4+h(fs*31.7)*0.5)+h(fs*53.1)*6.2832);',
    '  float x=cos(ph)*cos(th)*(1.0+fd),y=sin(ph)*(1.0+fd),z=cos(ph)*sin(th)*(1.0+fd);',
    '  if(uEp>0.5){',
    '    float ex=h(sd*31.0+0.1)*2.0-1.0,ey=h(sd*47.0+0.2)*2.0-1.0,ez=h(sd*71.0+0.3)*2.0-1.0;',
    '    float el=sqrt(ex*ex+ey*ey+ez*ez)+0.001,di=1.0+h(sd*13.0)*2.5;',
    '    x+=(ex/el)*uEx*di;y+=(ey/el)*uEx*di;z+=(ez/el)*uEx*di;',
    '  }',
    '  float rot=t*0.07,cr=cos(rot),sr=sin(rot);',
    '  float rx=x*cr-z*sr,rz=x*sr+z*cr;',
    '  float ct=cos(0.20),st=sin(0.20),ry=y*ct-rz*st;rz=y*st+rz*ct;',
    '  float p=3.2/(3.2+rz+1.0),asp=uR.x/uR.y;',
    '  gl_Position=vec4((rx*p*uOff.z+uOff.x)/asp,ry*p*uOff.z+uOff.y,rz*0.1,1.0);',
    '  float dep=0.13+p*0.38;dep*=mix(1.0,0.04,smoothstep(0.2,-0.8,rz));',
    '  vA=clamp(dep,0.0,0.55);if(uEp>0.5)vA*=mix(1.0,0.12,uEx);',
    '}'
  ].join('\n');
  var FS_EDGE = [
    'precision mediump float;varying float vA;',
    'void main(){gl_FragColor=vec4(vec3(0.72,0.80,0.90)*vA,vA);}',
  ].join('\n');

  /* ════════════════════════════════════════════════════════
     AMBIANTES SHADERS — coordonnées NDC directes, plein écran
  ════════════════════════════════════════════════════════ */
  // Les particules sont placées en coordonnées -1..1 sur X et Y indépendamment
  // Le shader les anime avec un mouvement lent flottant
  var VS_AMB = [
    'attribute vec3 aXYS;', // x init, y init, seed
    'uniform float uT;',
    'varying float vA;',
    'float h(float n){return fract(sin(n)*43758.5453);}',
    'void main(){',
    '  float sd=aXYS.z;',
    '  float spd=0.008+h(sd*7.13)*0.018;',
    '  float ang=h(sd*13.3)*6.2832;',
    // Dérive lente + oscillation douce
    '  float px=aXYS.x + sin(ang+uT*spd*1.1)*0.18 + cos(uT*spd*0.7+sd*2.3)*0.09;',
    '  float py=aXYS.y + cos(ang+uT*spd*0.9)*0.14 + sin(uT*spd*0.5+sd*3.1)*0.07;',
    '  gl_Position=vec4(px,py,0.0,1.0);',
    '  float sz=2.5+h(sd*41.0)*5.0;',
    '  gl_PointSize=clamp(sz,1.0,12.0);',
    '  float baseA=0.15+h(sd*57.0)*0.30;',
    '  vA=baseA*(0.4+0.6*sin(uT*(0.5+h(sd*19.0)*1.0)+sd*5.0));',
    '}'
  ].join('\n');
  var FS_AMB = [
    'precision mediump float;varying float vA;',
    'void main(){',
    '  float d=length(gl_PointCoord-0.5)*2.0;',
    '  float a=exp(-d*d*3.5)*vA;',
    '  gl_FragColor=vec4(vec3(0.80,0.90,1.0)*a,a);',
    '}'
  ].join('\n');

  var VS_ALINE = [
    'attribute vec4 aXYST;', // x,y,seed,t(0..1 le long du segment)
    'uniform float uT;',
    'varying float vA;',
    'float h(float n){return fract(sin(n)*43758.5453);}',
    'void main(){',
    '  float sd=aXYST.z, t=aXYST.w;',
    '  float spd=0.006+h(sd*7.13)*0.014;',
    '  float ang=h(sd*13.3)*6.2832;',
    '  float px=aXYST.x + sin(ang+uT*spd*1.1)*0.15 + cos(uT*spd*0.7+sd*2.3)*0.07;',
    '  float py=aXYST.y + cos(ang+uT*spd*0.9)*0.12 + sin(uT*spd*0.5+sd*3.1)*0.06;',
    '  gl_Position=vec4(px,py,0.0,1.0);',
    '  float baseA=0.08+h(sd*31.0)*0.14;',
    '  float pulse=0.4+0.6*sin(uT*(0.4+h(sd*11.0)*0.5)+sd*4.0);',
    // Fondu sur les extrémités du segment
    '  float edgeFade=1.0-pow(abs(t*2.0-1.0),1.5);',
    '  vA=baseA*pulse*edgeFade;',
    '}'
  ].join('\n');
  var FS_ALINE = [
    'precision mediump float;varying float vA;',
    'void main(){gl_FragColor=vec4(vec3(0.65,0.80,0.96)*vA,vA);}',
  ].join('\n');

  /* ════════════════════════════════════════════════════════
     BACKGROUND
  ════════════════════════════════════════════════════════ */
  var VS_BG='attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0,1);}';
  var FS_BG=[
    'precision mediump float;varying vec2 v;',
    'void main(){',
    '  vec3 darkBase=vec3(0.018,0.036,0.046);',
    '  vec3 midTeal =vec3(0.026,0.064,0.078);',
    '  vec3 deepEdge=vec3(0.008,0.022,0.030);',
    '  float d1=length(v-vec2(0.28,0.72))*1.3;',
    '  vec3 col=mix(midTeal,deepEdge,clamp(d1,0.0,1.0));',
    '  float d2=length(v-vec2(0.5,0.5))*1.8;',
    '  col=mix(col,darkBase,clamp(d2*0.5,0.0,0.6));',
    // Éclat haut-droit principal
    '  float g1=exp(-length(v-vec2(0.82,0.08))*length(v-vec2(0.82,0.08))*4.0);',
    '  col+=vec3(0.010,0.055,0.075)*g1*2.0;',
    // Second éclat plus diffus
    '  float g2=exp(-length(v-vec2(0.65,0.03))*length(v-vec2(0.65,0.03))*9.0);',
    '  col+=vec3(0.004,0.028,0.042)*g2;',
    // Vignette
    '  col*=1.0-clamp(length(v-vec2(0.5))*length(v-vec2(0.5))*0.9,0.0,0.55);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  /* ── Bloom / Copy ──────────────────────────────────────────── */
  var VS_Q='attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0,1);}';
  var FS_BLOOM=[
    'precision mediump float;uniform sampler2D uTex;uniform vec2 uD,uTS;varying vec2 v;',
    'void main(){',
    '  vec2 t=uD/uTS;vec4 s=texture2D(uTex,v)*0.2270;',
    '  s+=texture2D(uTex,v+t*2.0)*0.1946+texture2D(uTex,v-t*2.0)*0.1946;',
    '  s+=texture2D(uTex,v+t*4.0)*0.1216+texture2D(uTex,v-t*4.0)*0.1216;',
    '  s+=texture2D(uTex,v+t*6.0)*0.0541+texture2D(uTex,v-t*6.0)*0.0541;',
    '  s+=texture2D(uTex,v+t*8.0)*0.0162+texture2D(uTex,v-t*8.0)*0.0162;',
    '  gl_FragColor=s;}',
  ].join('\n');
  // Shader copie simple (upscale sans blur)
  var FS_COPY=[
    'precision mediump float;uniform sampler2D uTex;varying vec2 v;',
    'void main(){gl_FragColor=texture2D(uTex,v);}',
  ].join('\n');

  /* ── Helpers ───────────────────────────────────────────────── */
  function rnd(s){return Math.abs(Math.sin(s*127.1)*43758.5453%1);}
  function mkS(type,src){
    var sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){window._dbg?.error(src.slice(0,80),gl.getShaderInfoLog(sh));return null;}
    return sh;
  }
  function mkP(vs,fs){
    var pr=gl.createProgram();
    gl.attachShader(pr,mkS(gl.VERTEX_SHADER,vs));
    gl.attachShader(pr,mkS(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){window._dbg?.error(gl.getProgramInfoLog(pr));return null;}
    return pr;
  }
  function mkFB(cw,ch){
    var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,cw,ch,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    var fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return{fb:fb,tex:t,w:cw,h:ch};
  }

  /* ── Sphère geo ────────────────────────────────────────────── */
  function genNodes(){
    var d=new Float32Array(N*4),g=Math.PI*(3.0-Math.sqrt(5.0));
    for(var i=0;i<N;i++){
      var y=1.0-(i/(N-1))*2.0,th=g*i,ph=Math.asin(Math.max(-1,Math.min(1,y)));
      d[i*4]=th;d[i*4+1]=ph;d[i*4+2]=i/N;d[i*4+3]=(i*0.618033988)%1.0;
    }return d;
  }
  function genEdges(nd){
    var pts=[],el=[];
    for(var i=0;i<N;i++){var th=nd[i*4],ph=nd[i*4+1];pts.push({x:Math.cos(ph)*Math.cos(th),y:Math.sin(ph),z:Math.cos(ph)*Math.sin(th)});}
    var md2=MAX_DIST*MAX_DIST*4;
    for(var a=0;a<N;a++)for(var b=a+1;b<N;b++){
      var dx=pts[a].x-pts[b].x,dy=pts[a].y-pts[b].y,dz=pts[a].z-pts[b].z;
      if(dx*dx+dy*dy+dz*dz<md2)el.push(nd[a*4],nd[a*4+1],nd[a*4+2],nd[a*4+3],nd[b*4],nd[b*4+1],nd[b*4+2],nd[b*4+3]);
    }
    edgeCount=el.length/8;return new Float32Array(el);
  }

  /* ── Ambiantes geo ─────────────────────────────────────────── */
  function genAmbient(){
    // Distribution plein écran en NDC (-1..1 sur X et Y)
    // On évite la zone bas-gauche où est la sphère (environ x<0, y<0)
    var d=new Float32Array(N_AMB*3);
    for(var i=0;i<N_AMB;i++){
      var x=(rnd(i*7.3+1.1)*2.0-1.0)*0.98;
      var y=(rnd(i*13.1+2.2)*2.0-1.0)*0.98;
      d[i*3]=x; d[i*3+1]=y; d[i*3+2]=i/N_AMB;
    }
    return d;
  }
  function genAmbLines(){
    // Chaque ligne = 2 endpoints partageant la même seed
    // Subdivisée en N_SUB segments pour le fade le long du trait
    var N_SUB=6,el=[];
    for(var i=0;i<N_ALINE;i++){
      var sd=i/N_ALINE;
      var ax=(rnd(i*5.1+0.5)*2.0-1.0)*0.95;
      var ay=(rnd(i*8.3+1.1)*2.0-1.0)*0.95;
      var ang=rnd(i*17.3)*Math.PI*2;
      var len=0.04+rnd(i*23.1)*0.22;
      var bx=ax+Math.cos(ang)*len, by=ay+Math.sin(ang)*len;
      for(var s=0;s<N_SUB;s++){
        var t0=s/N_SUB, t1=(s+1)/N_SUB;
        el.push(
          ax+(bx-ax)*t0, ay+(by-ay)*t0, sd, t0,
          ax+(bx-ax)*t1, ay+(by-ay)*t1, sd, t1
        );
      }
    }
    alineCount=el.length/4;
    return new Float32Array(el);
  }

  function getOffset(){
    if(isMobile)return{x:-0.10,y:-0.62,sc:1.02};
    if(w<1200)return{x:-0.56,y:-0.53,sc:1.14};
    return{x:-0.65,y:-0.59,sc:1.30};
  }

  /* ── Init GL ───────────────────────────────────────────────── */
  function initGL(){
    canvas=document.createElement('canvas');
    canvas.id='particle-blob';
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none;opacity:0;transition:opacity 2s;';
    document.body.insertBefore(canvas,document.body.firstChild);
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false});
    if(!gl)return false;

    progNode =mkP(VS_NODE, FS_NODE);
    progEdge =mkP(VS_EDGE, FS_EDGE);
    progBg   =mkP(VS_BG,   FS_BG);
    progBloom=mkP(VS_Q,    FS_BLOOM);
    progCopy =mkP(VS_Q,    FS_COPY);
    progAmb  =mkP(VS_AMB,  FS_AMB);
    progALine=mkP(VS_ALINE,FS_ALINE);
    if(!progNode||!progEdge||!progBg||!progBloom||!progCopy||!progAmb||!progALine)return false;

    var nd=genNodes(),ed=genEdges(nd);
    nodeVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nodeVBO);gl.bufferData(gl.ARRAY_BUFFER,nd,gl.STATIC_DRAW);
    edgeVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,edgeVBO);gl.bufferData(gl.ARRAY_BUFFER,ed,gl.STATIC_DRAW);

    var ad=genAmbient();
    ambVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,ambVBO);gl.bufferData(gl.ARRAY_BUFFER,ad,gl.STATIC_DRAW);
    var ald=genAmbLines();
    alineVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,alineVBO);gl.bufferData(gl.ARRAY_BUFFER,ald,gl.STATIC_DRAW);

    quadVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    return true;
  }

  function resize(){
    w=window.innerWidth;h=window.innerHeight;
    var dpr=Math.min(window.devicePixelRatio||1,isMobile?1.5:2);
    var cw=Math.floor(w*dpr),ch=Math.floor(h*dpr);
    canvas.width=cw;canvas.height=ch;
    gl.viewport(0,0,cw,ch);
    fbScene   =mkFB(cw,ch);
    fbBloom   =mkFB(Math.floor(cw/2),Math.floor(ch/2));
    fbAmb     =mkFB(cw,ch);                             // ambiantes pleine résolution
    fbAmbBlur =mkFB(Math.floor(cw/4),Math.floor(ch/4)); // ambiantes très blurrées
  }

  /* ── Draw helpers ──────────────────────────────────────────── */
  function drawBg(){
    gl.useProgram(progBg);
    gl.bindBuffer(gl.ARRAY_BUFFER,quadVBO);
    var ap=gl.getAttribLocation(progBg,'p');
    gl.enableVertexAttribArray(ap);gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  function drawAmbient(sec){
    // Points ambiants
    gl.useProgram(progAmb);
    gl.bindBuffer(gl.ARRAY_BUFFER,ambVBO);
    var aA=gl.getAttribLocation(progAmb,'aXYS');
    gl.enableVertexAttribArray(aA);gl.vertexAttribPointer(aA,3,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(progAmb,'uT'),sec);
    gl.drawArrays(gl.POINTS,0,N_AMB);
    // Lignes ambiantes
    gl.useProgram(progALine);
    gl.bindBuffer(gl.ARRAY_BUFFER,alineVBO);
    var aL=gl.getAttribLocation(progALine,'aXYST');
    gl.enableVertexAttribArray(aL);gl.vertexAttribPointer(aL,4,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(progALine,'uT'),sec);
    gl.drawArrays(gl.LINES,0,alineCount);
  }

  function drawSphere(sec,exS,exP){
    var off=getOffset();
    gl.useProgram(progEdge);gl.bindBuffer(gl.ARRAY_BUFFER,edgeVBO);
    var ae=gl.getAttribLocation(progEdge,'a');gl.enableVertexAttribArray(ae);gl.vertexAttribPointer(ae,4,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(progEdge,'uT'),sec);gl.uniform2f(gl.getUniformLocation(progEdge,'uR'),w,h);
    gl.uniform1f(gl.getUniformLocation(progEdge,'uEx'),exS);gl.uniform1f(gl.getUniformLocation(progEdge,'uEp'),exP);
    gl.uniform3f(gl.getUniformLocation(progEdge,'uOff'),off.x,off.y,off.sc);
    gl.drawArrays(gl.LINES,0,edgeCount*2);
    gl.useProgram(progNode);gl.bindBuffer(gl.ARRAY_BUFFER,nodeVBO);
    var an=gl.getAttribLocation(progNode,'a');gl.enableVertexAttribArray(an);gl.vertexAttribPointer(an,4,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(progNode,'uT'),sec);gl.uniform2f(gl.getUniformLocation(progNode,'uR'),w,h);
    gl.uniform1f(gl.getUniformLocation(progNode,'uEx'),exS);gl.uniform1f(gl.getUniformLocation(progNode,'uEp'),exP);
    gl.uniform3f(gl.getUniformLocation(progNode,'uOff'),off.x,off.y,off.sc);
    gl.drawArrays(gl.POINTS,0,N);
  }

  // Applique bloom (ping-pong H+V) sur une texture source vers l'écran
  function blitTex(prog,tex,dw,dh,dx,dy,tw,th){
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER,quadVBO);
    var ap=gl.getAttribLocation(prog,'p');
    gl.enableVertexAttribArray(ap);gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.uniform1i(gl.getUniformLocation(prog,'uTex'),0);
    if(dx!==undefined){
      gl.uniform2f(gl.getUniformLocation(prog,'uD'),dx,dy);
      gl.uniform2f(gl.getUniformLocation(prog,'uTS'),tw,th);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  /* ── Render ─────────────────────────────────────────────────── */
  function render(now){
    requestAnimationFrame(render);
    if(!lastTime)lastTime=now;
    var dt=Math.min((now-lastTime)*0.001,0.05);lastTime=now;
    var sec=(now-startTime)*0.001;
    var exS=0,exP=0;
    if(exPhase===1){exTimer+=dt;var p1=Math.min(exTimer/EX_BURST,1.0);exS=1.0-Math.pow(1.0-p1,3.0);exP=1.0;if(p1>=1.0){exPhase=2;exTimer=0;}}
    else if(exPhase===2){exTimer+=dt;var p2=Math.min(exTimer/EX_REFORM,1.0);exS=1.0-p2*p2*p2;exP=1.0;if(p2>=1.0){exPhase=0;exTimer=0;}}

    /* P1 — Ambiantes → fbAmb (pleine résolution) */
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbAmb.fb);
    gl.viewport(0,0,fbAmb.w,fbAmb.h);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    drawAmbient(sec);

    /* P2 — Downsample fbAmb → fbAmbBlur (blur par résolution 1/4) */
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbAmbBlur.fb);
    gl.viewport(0,0,fbAmbBlur.w,fbAmbBlur.h);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    blitTex(progCopy,fbAmb.tex);

    /* P3 — Sphère → fbScene */
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbScene.fb);
    gl.viewport(0,0,fbScene.w,fbScene.h);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    drawSphere(sec,exS,exP);

    /* P4 — Bloom sphère H → fbBloom */
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbBloom.fb);
    gl.viewport(0,0,fbBloom.w,fbBloom.h);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    blitTex(progBloom,fbScene.tex,fbBloom.w,fbBloom.h,1,0,fbBloom.w,fbBloom.h);

    /* P5 — Composite final → écran */
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,canvas.width,canvas.height);

    // 5a. BG
    gl.disable(gl.BLEND);
    drawBg();

    // 5b. Ambiantes blurrées (upscale depuis 1/4 résolution = flou)
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
    blitTex(progCopy,fbAmbBlur.tex);

    // 5c. Sphère nette
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    drawSphere(sec,exS,exP);

    // 5d. Bloom sphère V
    gl.blendFunc(gl.ONE,gl.ONE);
    blitTex(progBloom,fbBloom.tex,canvas.width,canvas.height,0,1,canvas.width,canvas.height);

    gl.disable(gl.BLEND);
  }

  /* ── Init ───────────────────────────────────────────────────── */
  function init(){
    startTime=performance.now();
    if(!initGL())return;
    resize();
    setTimeout(function(){canvas.style.opacity='1';},300);
    var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(resize,200);});
    document.addEventListener('click',function(){if(exPhase===0){exPhase=1;exTimer=0;}});
    requestAnimationFrame(render);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
