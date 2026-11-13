/* PATCH STT LOCAL - DEBUT (v1) =============================================
 * Remplace la reconnaissance Google (webkitSpeechRecognition) par le serveur
 * STT local (stt_server.py) via WebSocket sécurisé (wss://).
 *
 * Intégration dans app.js (2 modifications, rien n'est supprimé) :
 *   1) PREMIÈRE ligne du corps de startSpeechListening() :
 *        if (window.LOCAL_STT && window.LOCAL_STT.enabled) { return window.LOCAL_STT.start(); } // PATCH STT LOCAL
 *   2) Ce bloc entier collé À LA FIN de app.js (ou juste avant la dernière
 *      accolade si tout app.js est enveloppé dans une fonction / DOMContentLoaded).
 *
 * Désactiver à chaud : LOCAL_STT.enabled = false  -> l'ancien code reprend la main.
 * Retirer : supprimer ce bloc + la ligne marquée "// PATCH STT LOCAL".
 * Écrit en ES2017 (pas de ?. ni ??) pour les vieux WebView Android.
 * ========================================================================= */
;(function () {
  'use strict';
  if (window.LOCAL_STT && window.LOCAL_STT.__patch) { return; } // idempotent

  /* ---- CONFIG : URL du serveur STT (essayées dans l'ordre) -------------- */
  var LOCAL_STT_URLS = [
    'wss://stt.bazouu-lab.fr/stt'           // via le tunnel Cloudflare (pas de port direct)
    // , 'wss://jarvis.bazouu-lab.fr/stt'   // secours via le tunnel (si règle d'ingress /stt ajoutée)
  ];

  var CFG = Object.assign({
    URLS: LOCAL_STT_URLS,
    TOKEN: '',                 // = --token du serveur (vide si pas de jeton)
    SILENCE_MS: 1200,          // silence de fin de phrase -> envoi automatique
    NO_SPEECH_MS: 7000,        // rien entendu -> abandon
    MAX_MS: 15000,             // durée max d'une phrase
    MIN_SPEECH_MS: 200,        // voix cumulée minimale avant d'accepter un silence de fin
    CONNECT_TIMEOUT_MS: 2500,
    FINAL_TIMEOUT_MS: 8000,
    VAD_FACTOR: 3.0,           // seuil voix = bruit de fond x facteur
    VAD_MIN_RMS: 0.012,        // seuil voix minimal absolu
    USE_WORKLET: true,         // AudioWorklet si dispo, sinon ScriptProcessorNode
    STOP_TTS_ON_LISTEN: true,  // met en pause les <audio> en cours avant d'écouter
    PRECONNECT: true,          // ouvre la WSS au chargement (gain ~100 ms au 1er appui)
    PARTIAL_SELECTOR: null,    // ex. '#transcript' pour afficher le texte partiel
    DEBUG: false,
    // Hooks optionnels (laisser null = comportement par défaut) :
    onTranscript: null,        // function(text, info) — ex. function (t) { sendCommand(t); }
    onState: null,             // function(state)      — défaut : applyState(state)
    onMessage: null,           // function(msg, isErr) — défaut : petit bandeau en bas d'écran
    onPartial: null,           // function(text)
    onLevel: null,             // function(rms)
    onBeforeListen: null,      // function()           — ex. stopper le TTS de l'app
    getSocket: null            // function() -> WebSocket Jarvis (si non trouvée automatiquement)
  }, window.LOCAL_STT_CONFIG || {});

  /* ---- AudioWorklet : remonte des blocs de 2048 échantillons ------------- */
  var WORKLET_SRC =
    "class LocalSttTap extends AudioWorkletProcessor{" +
    "constructor(){super();this.b=new Float32Array(2048);this.n=0;this.on=true;" +
    "this.port.onmessage=e=>{if(e.data==='stop')this.on=false;};}" +
    "process(inp){var c=inp[0]&&inp[0][0];if(c){for(var i=0;i<c.length;i++){this.b[this.n++]=c[i];" +
    "if(this.n===this.b.length){this.port.postMessage(this.b,[this.b.buffer]);this.b=new Float32Array(2048);this.n=0;}}}" +
    "return this.on;}}registerProcessor('local-stt-tap',LocalSttTap);";
  var WORKLET_URL = null;

  var sock = null, sockConnecting = null, sockIdx = 0, cur = null;

  function dbg() {
    if (CFG.DEBUG && window.console) { console.log.apply(console, ['[STT]'].concat([].slice.call(arguments))); }
  }

  /* ---- Adaptateurs vers l'app existante ---------------------------------- */
  function setState(s) {
    try {
      if (typeof CFG.onState === 'function') { CFG.onState(s); return; }
      if (typeof applyState === 'function') { applyState(s); }
    } catch (e) { dbg('applyState', e); }
  }

  var toastEl = null, toastTimer = null;
  function say(msg, isError) {
    if (isError && window.console) { console.warn('[STT] ' + msg); }
    try { if (typeof CFG.onMessage === 'function') { CFG.onMessage(msg, !!isError); return; } } catch (e) {}
    if (!document.body) { return; }
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'local-stt-toast';
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:90%;' +
        'padding:12px 18px;border-radius:12px;font:16px/1.3 sans-serif;color:#fff;z-index:2147483647;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:none;transition:opacity .3s;opacity:0';
      document.body.appendChild(toastEl);
    }
    toastEl.style.background = isError ? 'rgba(190,40,40,.92)' : 'rgba(30,30,30,.88)';
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, isError ? 5000 : 2500);
  }

  function partial(t) {
    try {
      if (typeof CFG.onPartial === 'function') { CFG.onPartial(t); return; }
      if (CFG.PARTIAL_SELECTOR) {
        var el = document.querySelector(CFG.PARTIAL_SELECTOR);
        if (el) { el.textContent = t; }
      }
    } catch (e) {}
  }

  function findJarvisSocket() {
    if (typeof CFG.getSocket === 'function') { return CFG.getSocket(); }
    var c = [];
    try { if (typeof ws !== 'undefined') { c.push(ws); } } catch (e) {}
    try { if (typeof socket !== 'undefined') { c.push(socket); } } catch (e) {}
    c.push(window.ws, window.socket, window.jarvisSocket, window.wsConnection);
    for (var i = 0; i < c.length; i++) {
      if (c[i] && c[i].readyState === 1 && typeof c[i].send === 'function') { return c[i]; }
    }
    return null;
  }

  // Même chemin que la reconnaissance réussie d'origine : mobile_command + état "thinking"
  function deliver(text, info) {
    if (typeof CFG.onTranscript === 'function') { CFG.onTranscript(text, info); return; }
    var s = findJarvisSocket();
    if (!s) { throw new Error('connexion Jarvis indisponible'); }
    s.send(JSON.stringify({ type: 'mobile_command', text: text }));
    setState('thinking');
  }

  function beforeListen() {
    if (typeof CFG.onBeforeListen === 'function') { try { CFG.onBeforeListen(); } catch (e) {} return; }
    if (!CFG.STOP_TTS_ON_LISTEN) { return; }
    try {
      var a = document.getElementsByTagName('audio');
      for (var i = 0; i < a.length; i++) { if (!a[i].paused) { a[i].pause(); } }
    } catch (e) {}
  }

  function describe(e) {
    var n = e && e.name, m = (e && e.message) || String(e);
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
      return 'Micro refusé : autorise le micro (Fully › Web Content Settings › Enable Microphone Access + permission Android)';
    }
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError') { return 'Aucun micro détecté'; }
    if (n === 'NotReadableError' || n === 'TrackStartError') { return 'Micro occupé par une autre application'; }
    return m;
  }

  /* ---- Connexion WSS au serveur STT (persistante, avec repli d'URL) ------ */
  function withToken(u) {
    return CFG.TOKEN ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'token=' + encodeURIComponent(CFG.TOKEN) : u;
  }

  function openOne(url) {
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new WebSocket(withToken(url)); } catch (e) { reject(e); return; }
      w.binaryType = 'arraybuffer';
      var t = setTimeout(function () { try { w.close(); } catch (e) {} reject(new Error('délai dépassé')); },
        CFG.CONNECT_TIMEOUT_MS);
      w.onopen = function () { clearTimeout(t); resolve(w); };
      w.onerror = function () { clearTimeout(t); reject(new Error('échec (certificat, DNS ou serveur arrêté ?)')); };
      w.onclose = function () { clearTimeout(t); reject(new Error('fermée')); };
    });
  }

  function getSocket() {
    if (sock && sock.readyState === 1) { return Promise.resolve(sock); }
    if (sockConnecting) { return sockConnecting; }
    var urls = CFG.URLS, errs = [], p = Promise.reject(new Error('aucune URL'));
    for (var k = 0; k < urls.length; k++) {
      (function (idx) {
        p = p.catch(function () {
          return openOne(urls[idx]).then(function (w) { sockIdx = idx; return w; },
            function (e) { errs.push(urls[idx] + ' : ' + e.message); throw e; });
        });
      })((sockIdx + k) % urls.length);
    }
    sockConnecting = p.then(function (w) {
      sock = w; sockConnecting = null;
      w.onmessage = onSockMessage;
      w.onerror = function () {};
      w.onclose = function () {
        if (sock === w) { sock = null; }
        if (cur && !cur.done && cur.ws === w) { fail(cur, 'Connexion au serveur STT perdue'); }
      };
      dbg('connecté à', urls[sockIdx]);
      return w;
    }, function () {
      sockConnecting = null;
      throw new Error('Serveur STT injoignable — ' + errs.join(' | '));
    });
    return sockConnecting;
  }

  function onSockMessage(ev) {
    if (typeof ev.data !== 'string') { return; }
    var m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    var s = cur;
    if (m.type === 'partial') {
      if (s && !s.done && !s.ending) {
        partial(m.text || '');
        if (m.text) { s.heard = true; s.lastVoice = Date.now(); }
      }
    } else if (m.type === 'final') {
      if (s && s.waitingFinal && !s.done) { s.onFinal(m); }
    } else if (m.type === 'error') {
      if (s && !s.done) { fail(s, 'Serveur STT : ' + (m.error || 'erreur')); }
    } else if (m.type === 'ready') {
      dbg('serveur prêt', m);
    }
  }

  /* ---- Rééchantillonnage vers 16 kHz (moyenne par fenêtre = anti-repliement simple) */
  function makeResampler(inRate) {
    var ratio = inRate / 16000, carry = null, pos = 0;
    if (Math.abs(ratio - 1) < 1e-6) { return function (x) { return x; }; }
    return function (x) {
      var buf = x;
      if (carry && carry.length) {
        buf = new Float32Array(carry.length + x.length);
        buf.set(carry); buf.set(x, carry.length);
      }
      var n = Math.floor((buf.length - pos) / ratio);
      if (n <= 0) { carry = buf; return new Float32Array(0); }
      var out = new Float32Array(n);
      for (var k = 0; k < n; k++) {
        var a = pos + k * ratio, i0 = Math.floor(a), i1 = Math.floor(a + ratio);
        if (i1 <= i0) { i1 = i0 + 1; }
        if (i1 > buf.length) { i1 = buf.length; }
        var sum = 0;
        for (var i = i0; i < i1; i++) { sum += buf[i]; }
        out[k] = sum / (i1 - i0);
      }
      var end = pos + n * ratio, used = Math.floor(end);
      pos = end - used;
      carry = buf.slice(used);
      return out;
    };
  }

  /* ---- Capture micro ------------------------------------------------------ */
  function connectMuted(s, node) {
    var g = s.ctx.createGain();
    g.gain.value = 0;              // le graphe doit atteindre destination pour être "tiré"
    node.connect(g); g.connect(s.ctx.destination);
    s.mute = g;
  }

  function useScriptProcessor(s) {
    var ctx = s.ctx;
    var make = ctx.createScriptProcessor || ctx.createJavaScriptNode;
    var n = make.call(ctx, 4096, 1, 1);
    n.onaudioprocess = function (e) { onAudio(s, new Float32Array(e.inputBuffer.getChannelData(0))); };
    s.src.connect(n); s.node = n; connectMuted(s, n);
    dbg('capture : ScriptProcessorNode');
  }

  function startCapture(s) {
    var ctx = s.ctx;
    var p = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    return p.then(function () {
      s.src = ctx.createMediaStreamSource(s.stream);
      s.rs = makeResampler(ctx.sampleRate);
      dbg('sampleRate natif', ctx.sampleRate);
      if (CFG.USE_WORKLET && ctx.audioWorklet && window.AudioWorkletNode) {
        if (!WORKLET_URL) {
          WORKLET_URL = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
        }
        return ctx.audioWorklet.addModule(WORKLET_URL).then(function () {
          var n = new AudioWorkletNode(ctx, 'local-stt-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
          n.port.onmessage = function (e) { onAudio(s, e.data); };
          s.src.connect(n); s.node = n; connectMuted(s, n);
          dbg('capture : AudioWorklet');
        }, function (e) { dbg('AudioWorklet KO, repli ScriptProcessor', e); useScriptProcessor(s); });
      }
      useScriptProcessor(s);
    }).then(function () { s.capturing = true; s.t0 = Date.now(); });
  }

  function stopStream(st) {
    try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
  }

  function stopCapture(s) {
    if (s.capStopped) { return; }
    s.capStopped = true;
    try { if (s.node && s.node.port) { s.node.port.postMessage('stop'); } } catch (e) {}
    try { if (s.node) { s.node.onaudioprocess = null; s.node.disconnect(); } } catch (e) {}
    try { if (s.src) { s.src.disconnect(); } } catch (e) {}
    try { if (s.mute) { s.mute.disconnect(); } } catch (e) {}
    if (s.stream) { stopStream(s.stream); }
    try { if (s.ctx && s.ctx.state !== 'closed') { s.ctx.close(); } } catch (e) {}
  }

  function onAudio(s, f32) {
    if (s.done || s.ending) { return; }
    var pcm = s.rs(f32);
    if (!pcm.length) { return; }
    var sum = 0, i;
    for (i = 0; i < pcm.length; i++) { sum += pcm[i] * pcm[i]; }
    var rms = Math.sqrt(sum / pcm.length), now = Date.now(), durMs = pcm.length / 16;
    if (typeof CFG.onLevel === 'function') { try { CFG.onLevel(rms); } catch (e) {} }
    // Détection de voix par énergie, avec bruit de fond adaptatif
    if (s.noise < 0) { s.noise = Math.min(rms, CFG.VAD_MIN_RMS); }
    var thr = Math.max(CFG.VAD_MIN_RMS, s.noise * CFG.VAD_FACTOR);
    if (rms > thr) {
      s.speechMs += durMs; s.lastVoice = now;
      if (s.speechMs >= CFG.MIN_SPEECH_MS) { s.heard = true; }
    } else {
      s.noise = s.noise * 0.95 + rms * 0.05;
    }
    var i16 = new Int16Array(pcm.length);
    for (i = 0; i < pcm.length; i++) {
      var v = pcm[i] < -1 ? -1 : (pcm[i] > 1 ? 1 : pcm[i]);
      i16[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }
    s.pending.push(i16); s.pendingLen += i16.length;
    if (s.pendingLen >= 1600) { flush(s); }   // ~100 ms par trame
  }

  function flush(s) {
    if (!s.ws || s.ws.readyState !== 1 || !s.pendingLen) { return; }
    var out = new Int16Array(s.pendingLen), o = 0;
    for (var i = 0; i < s.pending.length; i++) { out.set(s.pending[i], o); o += s.pending[i].length; }
    s.pending = []; s.pendingLen = 0;
    s.ws.send(out.buffer);
  }

  /* ---- Cycle de vie d'une écoute ------------------------------------------ */
  function tick(s) {
    if (s.done || s.ending || !s.capturing) { return; }
    var now = Date.now(), el = now - s.t0;
    if (s.heard && s.lastVoice && now - s.lastVoice >= CFG.SILENCE_MS) { endUtterance(s, 'silence'); return; }
    if (!s.heard && el >= CFG.NO_SPEECH_MS) { cancelSession(s); say("Je n'ai rien entendu.", false); return; }
    if (el >= CFG.MAX_MS) { endUtterance(s, 'durée max'); }
  }

  function finish(s) {
    s.done = true;
    for (var i = 0; i < s.timers.length; i++) { clearTimeout(s.timers[i]); clearInterval(s.timers[i]); }
    stopCapture(s);
    if (cur === s) { cur = null; }
  }

  function fail(s, msg) {
    if (s.done) { return; }
    finish(s);
    partial('');
    try { if (s.ws && s.ws.readyState === 1) { s.ws.send('{"type":"cancel"}'); } } catch (e) {}
    setState('idle');
    say(msg, true);
  }

  function cancelSession(s) {
    if (s.done) { return; }
    finish(s);
    partial('');
    try { if (s.ws && s.ws.readyState === 1) { s.ws.send('{"type":"cancel"}'); } } catch (e) {}
    setState('idle');
  }

  function sendEnd(s) {
    if (s.done || s.waitingFinal) { return; }
    flush(s);
    s.waitingFinal = true;
    setState('thinking');
    s.onFinal = function (m) {
      finish(s);
      partial('');
      var t = (m.text || '').replace(/\s+/g, ' ').trim();
      if (!t) { setState('idle'); say("Je n'ai pas compris, réessaie.", false); return; }
      dbg('texte final', t, m);
      try { deliver(t, { ms: m.ms, audio_s: m.audio_s }); } catch (e) {
        setState('idle'); say('Envoi à Jarvis impossible : ' + e.message, true);
      }
    };
    try { s.ws.send('{"type":"end"}'); } catch (e) { fail(s, 'Envoi au serveur STT impossible'); return; }
    s.timers.push(setTimeout(function () { if (!s.done) { fail(s, 'Le serveur STT ne répond pas'); } },
      CFG.FINAL_TIMEOUT_MS));
  }

  function endUtterance(s, why) {
    if (s.done || s.ending) { return; }
    s.ending = true;
    dbg('fin de phrase :', why);
    stopCapture(s);                       // libère le micro immédiatement
    if (s.ws && s.ws.readyState === 1) { sendEnd(s); } else { s.endPending = true; } // envoyé dès la connexion
  }

  function start() {
    // Appui sur l'orbe pendant l'écoute = "j'ai fini, envoie"
    if (cur && !cur.done) { if (!cur.ending) { endUtterance(cur, 'appui'); } return; }
    var s = cur = {
      done: false, ending: false, capturing: false, heard: false, waitingFinal: false, endPending: false,
      speechMs: 0, t0: Date.now(), lastVoice: 0, noise: -1, pending: [], pendingLen: 0, timers: [],
      ws: null, ctx: null, stream: null, src: null, node: null, mute: null, rs: null
    };
    beforeListen();
    // AudioContext créé ICI, de façon synchrone, pendant le geste utilisateur (politique autoplay)
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { fail(s, 'Web Audio indisponible dans ce navigateur'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail(s, 'Micro indisponible (page non sécurisée ?)'); return;
    }
    try { s.ctx = new AC(); } catch (e) { fail(s, 'AudioContext : ' + e.message); return; }

    setState('listening');
    partial('');
    var sockP = getSocket();
    sockP.catch(function () {});          // évite "unhandled rejection" (traité plus bas)
    navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(function (stream) {
      if (s.done) { stopStream(stream); return; }
      s.stream = stream;
      return startCapture(s);
    }).then(function () {
      return sockP;                       // l'audio est mis en tampon en attendant la connexion
    }).then(function (w) {
      if (s.done) { return; }
      s.ws = w;
      w.send('{"type":"start","sample_rate":16000}');
      flush(s);
      if (s.endPending) { sendEnd(s); }
    }).catch(function (e) { fail(s, describe(e)); });

    s.timers.push(setInterval(function () { tick(s); }, 100));
  }

  window.LOCAL_STT = {
    __patch: 1,
    enabled: true,
    config: CFG,
    start: start,
    stop: function () { if (cur && !cur.done) { endUtterance(cur, 'stop'); } },
    cancel: function () { if (cur && !cur.done) { cancelSession(cur); } },
    isActive: function () { return !!(cur && !cur.done); },
    warmup: function () { return getSocket().then(function () { return true; }); }
  };

  if (CFG.PRECONNECT) { setTimeout(function () { getSocket().catch(function (e) { dbg(e.message); }); }, 1500); }
})();
/* PATCH STT LOCAL - FIN ==================================================== */
