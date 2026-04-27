/* ── gacha-blob.js — Three.js blob animé (Gacha Nexus) ── */
/* Dépendances : Three.js r128, GSAP 3.12.5 (chargés avant ce script) */
/* ═══════════════════════════════════════════════════════════════
   GACHA NEXUS — Client Logic
   
   Auth via /link Discord command → verification code → Firestore.
   Pulls are written to Firestore → bot processes server-side.
   All gacha data (banners, navarites, pity) lives in Firestore.
   No HTTP port needed — everything goes through Firebase.
   ═══════════════════════════════════════════════════════════════ */

// ═══ THREE.JS BLOB ═══
let bScene,bCam,bRend,bMesh,bMat,bClock,bActive=false;
let bTgtScale=.65,bTgtAmp=.35,bParticles=null,bChannel=null;
let bOrbitals=[];
const C_BLUE=new THREE.Color('#0033ff'),C_MAG=new THREE.Color('#ff006e');

const VS=`uniform float uTime;uniform float uAmp;uniform float uFreq;
varying vec3 vN;varying vec3 vP;varying float vD;
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
vec3 i1=min(g,l.zxy);vec3 i2=max(g,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;
vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
void main(){float t=uTime*.3;
float d=(snoise(normal*uFreq+t)*.5+snoise(normal*uFreq*2.+t*1.3)*.25+snoise(normal*uFreq*4.+t*.7)*.125)*uAmp;
vec3 np=position+normal*d;vD=d;vN=normalize(normalMatrix*normal);vP=np;
gl_Position=projectionMatrix*modelViewMatrix*vec4(np,1.);}`;

const FS=`uniform float uTime;uniform vec3 uC1;uniform vec3 uC2;
varying vec3 vN;varying vec3 vP;varying float vD;
void main(){vec3 vd=normalize(cameraPosition-vP);float fr=pow(1.-max(dot(vd,vN),0.),2.5);
float cm=sin(uTime*.4+vD*3.)*.5+.5;vec3 bc=mix(uC1,uC2,cm);
float br=.3+vD*1.5+fr*1.2;vec3 col=bc*br;float core=1.-fr;col*=.4+core*.6;col+=bc*fr*1.5;
gl_FragColor=vec4(col,.85+fr*.15);}`;

function initBlob(){
  const c=document.getElementById('blob-canvas');
  bRend=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true});
  bRend.setPixelRatio(Math.min(window.devicePixelRatio,2));
  bRend.setSize(window.innerWidth,window.innerHeight);
  bScene=new THREE.Scene();
  bCam=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,.1,100);
  bCam.position.z=3.2;
  bMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uAmp:{value:.35},uFreq:{value:1.5},uC1:{value:C_BLUE.clone()},uC2:{value:C_MAG.clone()}},vertexShader:VS,fragmentShader:FS,transparent:true});
  bMesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.7,48),bMat);
  bScene.add(bMesh);
  bClock=new THREE.Clock(false);
  window.addEventListener('resize',()=>{bCam.aspect=window.innerWidth/window.innerHeight;bCam.updateProjectionMatrix();bRend.setSize(window.innerWidth,window.innerHeight)});
}
function animBlob(){
  if(!bActive)return;requestAnimationFrame(animBlob);
  const dt=bClock.getDelta();
  const t=bClock.getElapsedTime();
  bMat.uniforms.uTime.value=t;
  bMesh.scale.setScalar(bMesh.scale.x+(bTgtScale-bMesh.scale.x)*.04);
  bMat.uniforms.uAmp.value+=(bTgtAmp-bMat.uniforms.uAmp.value)*.04;
  bMesh.rotation.y=t*.12;bMesh.rotation.x=Math.sin(t*.08)*.15;
  bUpdateOrbitals(dt);
  // Channeling particles
  if(bChannel){
    const pa=bChannel.geometry.attributes.position,v=bChannel.userData.vel,lf=bChannel.userData.life;
    for(let i=0;i<pa.count;i++){
      pa.array[i*3]+=v[i*3];pa.array[i*3+1]+=v[i*3+1];pa.array[i*3+2]+=v[i*3+2];
      // Pull toward center
      pa.array[i*3]*=.985;pa.array[i*3+1]*=.985;pa.array[i*3+2]*=.985;
      lf[i]-=.008;
    }
    pa.needsUpdate=true;
    bChannel.material.opacity=Math.max(0,lf[0]||0);
    if(lf[0]<=0){bScene.remove(bChannel);bChannel=null;}
  }
  // Explosion particles
  if(bParticles){
    const pa=bParticles.geometry.attributes.position,v=bParticles.userData.vel,lf=bParticles.userData.life;
    let allD=true;
    for(let i=0;i<pa.count;i++){
      if(lf[i]<=0)continue;allD=false;
      pa.array[i*3]+=v[i*3];pa.array[i*3+1]+=v[i*3+1];pa.array[i*3+2]+=v[i*3+2];
      v[i*3]*=.97;v[i*3+1]*=.97;v[i*3+2]*=.97;lf[i]-=.012;
    }
    pa.needsUpdate=true;bParticles.material.opacity=Math.max(0,lf[0]||0);
    if(allD){bScene.remove(bParticles);bParticles=null;}
  }
  bRend.render(bScene,bCam);
}
function bSetCol(c1,c2){bMat.uniforms.uC1.value.copy(c1);bMat.uniforms.uC2.value.copy(c2)}
function bCompact(s,a){bTgtScale=s;bTgtAmp=a}
function bStartChannel(){
  // Particles converging toward the blob
  const cnt=200,geo=new THREE.BufferGeometry();
  const pos=new Float32Array(cnt*3),vel=new Float32Array(cnt*3),lf=new Float32Array(cnt);
  for(let i=0;i<cnt;i++){
    const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),r=1.5+Math.random()*1.5;
    pos[i*3]=r*Math.sin(ph)*Math.cos(th);pos[i*3+1]=r*Math.sin(ph)*Math.sin(th);pos[i*3+2]=r*Math.cos(ph);
    vel[i*3]=-pos[i*3]*.003;vel[i*3+1]=-pos[i*3+1]*.003;vel[i*3+2]=-pos[i*3+2]*.003;
    lf[i]=.6+Math.random()*.6;
  }
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mt=new THREE.PointsMaterial({color:bMat.uniforms.uC2.value,size:.025,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false});
  bChannel=new THREE.Points(geo,mt);bChannel.userData={vel,life:lf};bScene.add(bChannel);
}
function bExplode(){
  const cnt=250,geo=new THREE.BufferGeometry();
  const pos=new Float32Array(cnt*3),vel=new Float32Array(cnt*3),lf=new Float32Array(cnt);
  for(let i=0;i<cnt;i++){
    const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),r=bTgtScale*.6;
    pos[i*3]=r*Math.sin(ph)*Math.cos(th);pos[i*3+1]=r*Math.sin(ph)*Math.sin(th);pos[i*3+2]=r*Math.cos(ph);
    const spd=.04+Math.random()*.1;
    vel[i*3]=pos[i*3]*spd*3;vel[i*3+1]=pos[i*3+1]*spd*3;vel[i*3+2]=pos[i*3+2]*spd*3;
    lf[i]=.7+Math.random()*.5;
  }
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mt=new THREE.PointsMaterial({color:bMat.uniforms.uC2.value,size:.035,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});
  bParticles=new THREE.Points(geo,mt);bParticles.userData={vel,life:lf};bScene.add(bParticles);
  bMesh.visible=false;
  // Explode orbitals outward
  for(const o of bOrbitals){
    if(o.exploding)continue;
    o.exploding=true;o.explFade=1;
    const p=o.orbGroup.position;
    const dir=p.clone().normalize();
    const spd=3+Math.random()*2;
    o.explVel={x:dir.x*spd,y:dir.y*spd,z:dir.z*spd};
  }
}
function bReset(){
  bMesh.visible=true;bMesh.scale.setScalar(.65);bTgtScale=.65;bTgtAmp=.35;
  bSetCol(C_BLUE,C_MAG);
  if(bParticles){bScene.remove(bParticles);bParticles=null;}
  if(bChannel){bScene.remove(bChannel);bChannel=null;}
  bClearOrbitals();
}
// ── Orbital system: glowing orbs orbiting the blob with trails ──
function bAddOrbital(hexColor, tier){
  if(tier==null) tier=4; // default Epic-level
  const color=new THREE.Color(hexColor);
  const axA=Math.random()*Math.PI;
  const axis=new THREE.Vector3(Math.sin(axA),Math.cos(axA),Math.sin(axA*.7)*.5).normalize();
  const radius=.55+Math.random()*.2;
  const speed=1.2+Math.random()*1.8;
  // Scale orb size & trail by tier (0=Common..7=Artifact)
  // Common/Uncommon/Rare get smaller orbs, shorter trails, less glow
  const tierFrac=Math.max(0.15, tier/7); // 0.15 minimum for Common
  const orbSize=.022+tierFrac*.024; // .022 (Common) → .046 (Artifact)
  const orbGeo=new THREE.IcosahedronGeometry(orbSize,0);
  const orbSolid=new THREE.Mesh(orbGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5+tierFrac*.4}));
  const orbWire=new THREE.Mesh(orbGeo,new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.1+tierFrac*.2}));
  const orbGroup=new THREE.Group();
  orbGroup.add(orbSolid);orbGroup.add(orbWire);
  // Spawn closer for faster visibility
  const spawnDir=new THREE.Vector3((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2).normalize();
  const spawnDist=1.2+Math.random()*.8;
  orbGroup.position.copy(spawnDir.multiplyScalar(spawnDist));
  bScene.add(orbGroup);
  // Trail length scales with tier: Common=30, Artifact=190
  const TL=Math.round(30+160*tierFrac);
  const trailAlphaMax=.08+tierFrac*.22; // Common=.08, Artifact=.30
  const tPos=new Float32Array(TL*3);
  const tSizes=new Float32Array(TL);
  const tAlphas=new Float32Array(TL);
  for(let i=0;i<TL;i++){tSizes[i]=0;tAlphas[i]=0;}
  const tGeo=new THREE.BufferGeometry();
  tGeo.setAttribute('position',new THREE.BufferAttribute(tPos,3));
  tGeo.setAttribute('aSize',new THREE.BufferAttribute(tSizes,1));
  tGeo.setAttribute('aAlpha',new THREE.BufferAttribute(tAlphas,1));
  const trailMat=new THREE.ShaderMaterial({
    uniforms:{uColor:{value:color}},
    vertexShader:`attribute float aSize;attribute float aAlpha;varying float vAlpha;
      void main(){vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*(200./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uColor;varying float vAlpha;
      void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.4,d)*vAlpha;if(a<.01)discard;gl_FragColor=vec4(uColor*.85,a);}`,
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false
  });
  const trail=new THREE.Points(tGeo,trailMat);
  bScene.add(trail);
  bOrbitals.push({orbGroup,trail,tGeo,tPos,tSizes,tAlphas,axis,radius,speed,angle:Math.random()*Math.PI*2,TL,trailAlphaMax,histQ:[],
    approaching:true,approachT:0,
    exploding:false,explVel:null,explFade:1
  });
}
function bUpdateOrbitals(dt){
  for(const o of bOrbitals){
    // ── Explosion mode: fly outward and fade ──
    if(o.exploding){
      o.orbGroup.position.x+=o.explVel.x*dt;
      o.orbGroup.position.y+=o.explVel.y*dt;
      o.orbGroup.position.z+=o.explVel.z*dt;
      o.explFade=Math.max(0,o.explFade-.015);
      o.orbGroup.children.forEach(c=>{c.material.opacity=o.explFade*(c.material.wireframe ? 0.3 : 0.9)});
      o.trail.material.uniforms.uColor.value.multiplyScalar(.98);
      // Still update trail with current position
      o.histQ.push({x:o.orbGroup.position.x,y:o.orbGroup.position.y,z:o.orbGroup.position.z});
      if(o.histQ.length>o.TL)o.histQ.shift();
      _writeTrail(o);
      o.orbGroup.rotation.x+=dt*6;o.orbGroup.rotation.z+=dt*4;
      continue;
    }
    // ── Approach from outside: lerp toward orbit ──
    if(o.approaching){
      o.approachT=Math.min(1,o.approachT+dt*2.5); // ~0.4s to arrive (very fast)
      const targetPos=new THREE.Vector3(Math.cos(o.angle)*o.radius,0,Math.sin(o.angle)*o.radius);
      targetPos.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),o.axis));
      // Ease-out cubic for smooth deceleration
      const ease=1-Math.pow(1-o.approachT,3);
      o.orbGroup.position.lerp(targetPos,ease*.25);
      if(o.approachT>=1)o.approaching=false;
      o.orbGroup.rotation.x+=dt*3;o.orbGroup.rotation.z+=dt*2;
      o.histQ.push({x:o.orbGroup.position.x,y:o.orbGroup.position.y,z:o.orbGroup.position.z});
      if(o.histQ.length>o.TL)o.histQ.shift();
      _writeTrail(o);
      continue;
    }
    // ── Normal orbit ──
    o.angle+=o.speed*dt;
    const bp=new THREE.Vector3(Math.cos(o.angle)*o.radius,0,Math.sin(o.angle)*o.radius);
    bp.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),o.axis));
    o.orbGroup.position.copy(bp);
    o.orbGroup.rotation.x+=dt*3;o.orbGroup.rotation.z+=dt*2;
    o.histQ.push({x:bp.x,y:bp.y,z:bp.z});
    if(o.histQ.length>o.TL)o.histQ.shift();
    _writeTrail(o);
  }
}
function _writeTrail(o){
  const n=o.histQ.length;
  const aMax=o.trailAlphaMax||.3;
  for(let i=0;i<o.TL;i++){
    if(i<n){
      const p=o.histQ[n-1-i];
      o.tPos[i*3]=p.x;o.tPos[i*3+1]=p.y;o.tPos[i*3+2]=p.z;
      const fade=1-i/o.TL;
      o.tSizes[i]=.8*fade+.2;
      o.tAlphas[i]=fade*fade*aMax*(o.exploding?o.explFade:1);
    } else {o.tSizes[i]=0;o.tAlphas[i]=0;}
  }
  o.tGeo.attributes.position.needsUpdate=true;
  o.tGeo.attributes.aSize.needsUpdate=true;
  o.tGeo.attributes.aAlpha.needsUpdate=true;
}
function bClearOrbitals(){
  for(const o of bOrbitals){
    bScene.remove(o.orbGroup);
    o.orbGroup.children.forEach(c=>{c.geometry.dispose();c.material.dispose()});
    bScene.remove(o.trail);o.tGeo.dispose();o.trail.material.dispose();
  }
  bOrbitals=[];
}
initBlob();
