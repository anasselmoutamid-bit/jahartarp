/* ═══════════════════════════════════════════════════════════════
   js/music-player.js — Player audio ambiance Jaharta (v3)
   ═══════════════════════════════════════════════════════════════
   Supports per-page track configuration via window.JMP_CONFIG:
     window.JMP_CONFIG = {
       tracks: [0,1,2,3],   // indices into ALL_TRACKS
       autoTrack: 2,        // force start on this index
     };
   If not set, defaults to all 4 tracks.
   
   Exposes window.JMP API for programmatic control (used by gacha).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var ALL_TRACKS = [
    { name:'The Rebel Path', url:'https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/audio%2FThe%20Rebel%20Path.mp3?alt=media&token=3401b5b9-6c2e-47e7-a982-5fd0e8dff5bc' },
    { name:'øfdream – thelema', url:'https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/audio%2F%C3%B8fdream%20-%20thelema%20(slowed%20%26%20bass%20boosted).mp3?alt=media&token=e42405d3-bcd9-4ff5-974e-622d79215bce' },
    { name:'Black Ops 2', url:'https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/audio%2FBLACK%20OPS%202%20-%20OFFICIAL%20MULTIPLAYER%20MENU%20THEME%20SONG%20(HD).mp3?alt=media&token=a5573537-c1ec-4835-8baa-4e61d505de11' },
    { name:'SPECIALZ', url:'https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/audio%2FTV%E3%82%A2%E3%83%8B%E3%83%A1%E3%80%8E%E5%91%AA%E8%A1%93%E5%BB%BB%E6%88%A6%E3%80%8F%E7%AC%AC2%E6%9C%9F%E3%80%8C%E6%B8%8B%E8%B0%B7%E4%BA%8B%E5%A4%89%E3%80%8D%E3%83%8E%E3%83%B3%E3%82%AF%E3%83%AC%E3%82%B8%E3%83%83%E3%83%88OP%E3%83%A0%E3%83%BC%E3%83%93%E3%83%BC%EF%BC%8FOP%E3%83%86%E3%83%BC%E3%83%9E%EF%BC%9AKing%20Gnu%E3%80%8CSPECIALZ%E3%80%8D%EF%BD%9C%E6%AF%8E%E9%80%B1%E6%9C%A8%E6%9B%9C%E5%A4%9C11%E6%99%8256%E5%88%86%EF%BD%9EMBSTBS%E7%B3%BB%E5%88%97%E5%85%A8%E5%9B%BD28%E5%B1%80%E3%81%AB%E3%81%A6%E6%94%BE%E9%80%81%E4%B8%AD!!.mp3?alt=media&token=578e6bec-3183-4369-afb6-b46b543ef718' },
  ];

  /* ── Page config ── */
  var cfg = window.JMP_CONFIG || {};
  var trackIndices = cfg.tracks || [0,1,2,3];
  var TRACKS = trackIndices.map(function(i){ return ALL_TRACKS[i]; });
  var forceStart = cfg.autoTrack != null ? cfg.autoTrack : -1;

  var SK = 'jmp';
  function loadSt() { try { return JSON.parse(sessionStorage.getItem(SK)) || {}; } catch(e) { return {}; } }
  function saveSt() {
    try { sessionStorage.setItem(SK, JSON.stringify({ idx:idx, vol:vol, muted:muted, time:audio.currentTime||0, playing:playing, trackName:TRACKS[idx%TRACKS.length].name })); } catch(e) {}
  }

  var st = loadSt();
  var idx = forceStart >= 0 ? forceStart : (st.idx || 0);
  if (idx >= TRACKS.length) idx = 0;
  var vol = st.vol != null ? st.vol : 0.35;
  var muted = st.muted !== false;
  var playing = false;
  var retries = 0;

  var audio = new Audio();
  audio.preload = 'auto';
  audio.volume = muted ? 0 : vol;

  function loadTrack(i) {
    var t = TRACKS[i % TRACKS.length];
    audio.src = t.url + '&_t=' + Date.now();
    audio.load();
    updateLabel();
  }

  loadTrack(idx);

  if (st.time > 2 && forceStart < 0) {
    audio.addEventListener('loadedmetadata', function() {
      if (audio.duration > st.time) try { audio.currentTime = st.time; } catch(e) {}
    }, { once: true });
  }

  audio.addEventListener('ended', function() {
    retries = 0; idx = (idx + 1) % TRACKS.length;
    loadTrack(idx);
    audio.play().catch(function(){});
  });

  audio.addEventListener('error', function() {
    if (retries < 3) {
      retries++;
      setTimeout(function() { loadTrack(idx); if (playing) audio.play().catch(function(){}); }, 1500 * retries);
    } else {
      retries = 0; idx = (idx + 1) % TRACKS.length;
      loadTrack(idx);
      if (playing) audio.play().catch(function(){});
    }
  });

  window.addEventListener('beforeunload', saveSt);
  window.addEventListener('pagehide', saveSt);
  document.addEventListener('visibilitychange', function() { if (document.hidden) saveSt(); });

  /* CSS */
  var s = document.createElement('style');
  s.textContent = '#jmp{position:fixed;bottom:70px;right:20px;z-index:90000;display:flex;align-items:center;font-family:"Rajdhani",sans-serif;font-weight:600}#jmp:hover #jmp-panel{opacity:1;transform:translateX(0);pointer-events:all}#jmp-btn{width:42px;height:42px;background:rgba(6,6,12,.96);border:1px solid rgba(0,240,255,.5);color:#00f0ff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;transition:border-color .2s,box-shadow .2s;border-radius:4px}#jmp-btn:hover{border-color:#00f0ff;box-shadow:0 0 20px rgba(0,240,255,.3)}#jmp-btn svg{width:16px;height:16px;transition:opacity .3s}#jmp-btn.playing svg{opacity:.15}#jmp-wave{display:flex;align-items:flex-end;gap:2px;height:14px;position:absolute;bottom:6px;left:50%;transform:translateX(-50%);opacity:0;transition:opacity .3s}#jmp-btn.playing #jmp-wave{opacity:1}#jmp-wave span{display:block;width:2px;background:#00f0ff;border-radius:1px;animation:jbar 1.1s ease-in-out infinite}#jmp-wave span:nth-child(1){height:5px;animation-delay:0s}#jmp-wave span:nth-child(2){height:10px;animation-delay:.15s}#jmp-wave span:nth-child(3){height:7px;animation-delay:.3s}#jmp-wave span:nth-child(4){height:12px;animation-delay:.1s}#jmp-wave span:nth-child(5){height:5px;animation-delay:.25s}@keyframes jbar{0%,100%{transform:scaleY(1);opacity:.7}50%{transform:scaleY(.3);opacity:1}}#jmp-panel{display:flex;align-items:center;gap:10px;background:rgba(6,6,12,.92);border:1px solid rgba(0,240,255,.15);border-right:none;padding:0 14px;height:42px;opacity:0;transform:translateX(12px);pointer-events:none;transition:opacity .25s,transform .25s;white-space:nowrap;border-radius:4px 0 0 4px;backdrop-filter:blur(12px)}#jmp-label{font-size:.5rem;letter-spacing:.12em;color:rgba(0,240,255,.5);text-transform:uppercase;user-select:none;max-width:120px;overflow:hidden;text-overflow:ellipsis}#jmp-vol{-webkit-appearance:none;appearance:none;width:72px;height:2px;background:rgba(0,240,255,.2);outline:none;cursor:pointer;border-radius:1px}#jmp-vol::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;background:#00f0ff;border-radius:50%;cursor:pointer;box-shadow:0 0 6px rgba(0,240,255,.4)}#jmp-skip{font-size:.65rem;color:rgba(0,240,255,.45);cursor:pointer;background:none;border:none;padding:0;line-height:1;transition:color .2s;font-family:"Rajdhani",sans-serif;font-weight:600}#jmp-skip:hover{color:#00f0ff}#jmp-mute{font-size:.65rem;color:rgba(0,240,255,.45);cursor:pointer;background:none;border:none;padding:0;line-height:1;transition:color .2s;font-family:"Rajdhani",sans-serif;font-weight:600}#jmp-mute:hover{color:#00f0ff}@media(max-width:600px){#jmp{bottom:66px;right:14px}#jmp-panel{display:none}}';
  document.head.appendChild(s);

  /* HTML */
  var showSkip = TRACKS.length > 1;
  var wrap = document.createElement('div');
  wrap.id = 'jmp';
  wrap.innerHTML = '<div id="jmp-panel"><span id="jmp-label">AMBIANCE</span>'
    + (showSkip ? '<button id="jmp-skip" title="Piste suivante">⏭</button>' : '')
    + '<input type="range" id="jmp-vol" min="0" max="1" step="0.01" value="' + vol + '">'
    + '<button id="jmp-mute">-</button></div>'
    + '<button id="jmp-btn" title="Musique"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><div id="jmp-wave"><span></span><span></span><span></span><span></span><span></span></div></button>';
  document.body.appendChild(wrap);

  var btn = document.getElementById('jmp-btn');
  var volEl = document.getElementById('jmp-vol');
  var muteBtn = document.getElementById('jmp-mute');
  var skipBtn = document.getElementById('jmp-skip');
  var labelEl = document.getElementById('jmp-label');

  function updateLabel() {
    if (labelEl) labelEl.textContent = TRACKS[idx % TRACKS.length].name;
  }
  updateLabel();

  function setPlaying(v) { playing = v; btn.classList.toggle('playing', v); saveSt(); }
  function syncMute() {
    audio.volume = muted ? 0 : vol;
    muteBtn.textContent = muted ? 'OFF' : 'ON';
    muteBtn.style.color = muted ? 'rgba(0,240,255,.25)' : 'rgba(0,240,255,.9)';
  }
  syncMute();

  function doPlay() {
    muted = false; syncMute(); retries = 0;
    return audio.play().then(function() { setPlaying(true); }).catch(function(e) {
      if (e.name !== 'NotAllowedError') window._dbg?.warn('[JMP]', e.message);
    });
  }

  btn.addEventListener('click', function() {
    if (!playing) {
      if (audio.readyState < 2) {
        btn.style.opacity = '0.5';
        loadTrack(idx);
        audio.addEventListener('canplay', function() { btn.style.opacity = ''; doPlay(); }, { once: true });
        setTimeout(function() { btn.style.opacity = ''; }, 5000);
      } else { doPlay(); }
    } else { audio.pause(); setPlaying(false); }
  });

  if (skipBtn) {
    skipBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      retries = 0; idx = (idx + 1) % TRACKS.length;
      loadTrack(idx);
      if (playing) audio.play().catch(function(){});
      saveSt();
    });
  }

  muteBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    muted = !muted; syncMute();
    if (!muted && !playing) audio.play().then(function(){ setPlaying(true); }).catch(function(){});
    saveSt();
  });

  volEl.addEventListener('input', function(e) {
    vol = parseFloat(e.target.value);
    if (!muted) audio.volume = vol;
    saveSt();
  });

  if (st.playing) {
    audio.addEventListener('canplay', function() {
      muted = false; syncMute();
      audio.play().then(function(){ setPlaying(true); }).catch(function(){});
    }, { once: true });
  }

  /* ── Auto-start music on first user interaction ──
     Browsers block autoplay without user gesture. We listen for
     click, mousemove, touchstart — the first one triggers playback.
     Always registers, on every page. */
  var _autoTriggered = false;
  function _cleanupAutoListeners(){
    document.removeEventListener('click', _autoStart, true);
    document.removeEventListener('scroll', _autoStart, true);
    document.removeEventListener('touchstart', _autoStart, true);
    document.removeEventListener('mousemove', _autoStartMouse, true);
  }
  function _autoStart() {
    if (_autoTriggered || playing) { _cleanupAutoListeners(); return; }
    _autoTriggered = true;
    _cleanupAutoListeners();
    loadTrack(idx);
    function _tryPlay() {
      if (playing) return;
      if (audio.readyState >= 2) doPlay();
      else audio.addEventListener('canplay', function(){ if (!playing) doPlay(); }, { once: true });
    }
    _tryPlay();
    setTimeout(_tryPlay, 800);
    setTimeout(_tryPlay, 2000);
  }
  var _msx=-1,_msy=-1;
  function _autoStartMouse(ev){
    if(_autoTriggered||playing){_cleanupAutoListeners();return;}
    if(_msx<0){_msx=ev.clientX;_msy=ev.clientY;return;}
    if(Math.abs(ev.clientX-_msx)+Math.abs(ev.clientY-_msy)>50)_autoStart();
  }
  document.addEventListener('click', _autoStart, true);
  document.addEventListener('scroll', _autoStart, true);
  document.addEventListener('touchstart', _autoStart, true);
  document.addEventListener('mousemove', _autoStartMouse, true);

  /* ── Expose API for Gacha special music ── */
  window.JMP = {
    audio: audio,
    allTracks: ALL_TRACKS,
    getCurrentTrackName: function(){ return TRACKS[idx % TRACKS.length].name; },
    getCurrentTrackIndex: function(){ return idx % TRACKS.length; },
    forceTrack: function(i){
      idx = i % TRACKS.length; loadTrack(idx);
      if (!playing) doPlay(); else audio.play().catch(function(){});
    },
    isPlaying: function(){ return playing; },
    doPlay: doPlay,
  };
})();
