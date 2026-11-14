/* PATCH STT LOCAL - DEBUT (v2) =============================================
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
 *
 * v2 — diagnostic de capture (Echo Show 8 / réseau de micros) :
 *   - getUserMedia SANS traitement par défaut (RAW_AUDIO) ;
 *   - dé-entrelacement côté client (DESINTERLEAVE 2/4, voie DESINTERLEAVE_CHANNEL) ;
 *   - choix de voie / mixage des canaux d'entrée (INPUT_CHANNEL, INPUT_MIX) ;
 *   - DIAG : fréquence du contexte, réglages réels de la piste, canaux reçus,
 *     taille des blocs, RMS, pic, autocorrélation lags 1..4 (brut et sortie) ;
 *   - toutes les options réglables via window.LOCAL_STT_CONFIG, LOCAL_STT.configure({...})
 *     ou l'URL de la page : ?stt_DESINTERLEAVE=4&stt_USE_WORKLET=0&stt_DIAG=1
 *   Protocole serveur inchangé : frames binaires PCM s16le 16 kHz mono + start/end/cancel.
 * ========================================================================= */
;(function () {
  'use strict';
  if (window.LOCAL_STT && window.LOCAL_STT.__patch) { return; } // idempotent

  /* ---- CONFIG : URL du serveur STT (essayées dans l'ordre) -------------- */
  var LOCAL_STT_URLS = [
    'wss://stt.bazouu-lab.fr/stt'           // via le tunnel Cloudflare (pas de port direct)
  ];

  var DEFAULTS = {
    URLS: LOCAL_STT_URLS,
    TOKEN: '',                 // = --token du serveur (vide si pas de jeton)
    SILENCE_MS: 1200,          // silence de fin de phrase -> envoi automatique
    NO_SPEECH_MS: 7000,        // rien entendu -> abandon
    MAX_MS: 15000,             // durée max d'une phrase
    MIN_SPEECH_MS: 200,        // voix cumulée minimale avant d'accepter un silence de fin
    CONNECT_TIMEOUT_MS: 2500,
    FINAL_TIMEOUT_MS: 8000,
    VAD_FACTOR: 3.0,           // seuil voix = bruit de fond x facteur
    VAD_MIN_RMS: 0.008,        // seuil voix minimal absolu (plus bas qu'en v1 : sans AGC le signal est plus faible)

    /* -- Capture -- */
    RAW_AUDIO: true,           // echoCancellation / noiseSuppression / autoGainControl = false
    CHANNEL_COUNT: 1,          // contrainte channelCount (null = ne pas la demander)
    REQ_SAMPLE_RATE: 16000,    // contrainte sampleRate (souvent ignorée ; null = ne pas la demander)
    DEVICE_ID: null,           // deviceId précis (voir la liste affichée par DIAG)
    AUDIO_CONSTRAINTS: null,   // objet complet qui remplace tout ce qui précède si fourni
    CONTEXT_SAMPLE_RATE: null, // null = fréquence native du contexte ; 16000 = forcer new AudioContext({sampleRate:16000})
    USE_WORKLET: true,         // AudioWorklet si dispo, sinon ScriptProcessorNode
    SP_INPUT_CHANNELS: 1,      // canaux demandés au ScriptProcessor (repli)
    INPUT_CHANNEL: 0,          // voie lue si le nœud reçoit plusieurs canaux
    INPUT_MIX: false,          // true = moyenne de tous les canaux reçus
    DESINTERLEAVE: 1,          // 1 = rien ; 2 ou 4 = garder 1 échantillon sur N
    DESINTERLEAVE_CHANNEL: 0,  // quelle voie garder (0..N-1)
    DESINTERLEAVE_STAGE: 'raw',// 'raw' = sur le flux natif, avant rééchantillonnage ; 'post' = après passage à 16 kHz
    INPUT_RATE: null,          // fréquence réelle supposée APRÈS dé-entrelacement (null = auto : fréquence / N)
    RESAMPLE: true,            // false = envoie le flux tel quel (pour analyser le brut dans last_session.wav)

    /* -- Diagnostic -- */
    DIAG: null,                // null = suit DEBUG ; true = messages de diag via onMessage
    DIAG_INTERVAL_MS: 1000,

    STOP_TTS_ON_LISTEN: true,  // met en pause les <audio> en cours avant d'écouter
    PRECONNECT: true,          // ouvre la WSS au chargement (gain ~100 ms au 1er appui)
    PARTIAL_SELECTOR: null,    // ex. '#transcript' pour afficher le texte partiel
    URL_OVERRIDES: true,       // autorise ?stt_CLE=valeur dans l'URL de la page
    DEBUG: false,
    // Hooks optionnels (laisser null = comportement par défaut) :
    onTranscript: null,        // function(text, info) — ex. function (t) { sendCommand(t); }
    onState: null,             // function(state)      — défaut : applyState(state)
    onMessage: null,           // function(msg, isErr) — défaut : petit bandeau en bas d'écran
    onPartial: null,           // function(text)
    onLevel: null,             // function(rms)
    onBeforeListen: null,      // function()           — ex. stopper le TTS de l'app
    getSocket: null            // function() -> WebSocket Jarvis (si non trouvée automatiquement)
  };
  var CFG = Object.assign({}, DEFAULTS, window.LOCAL_STT_CONFIG || {});

  // Surcharges par l'URL : ?stt_DESINTERLEAVE=4&stt_RAW_AUDIO=0 ...
  function applyUrlOverrides() {
    if (!CFG.URL_OVERRIDES || !window.location || !location.search) { return; }
    var q = location.search.replace(/^\?/, '').split('&');
    for (var i = 0; i < q.length; i++) {
      var kv = q[i].split('='), k = decodeURIComponent(kv[0] || '');
      if (k.indexOf('stt_') !== 0) { continue; }
      k = k.slice(4);
      if (!Object.prototype.hasOwnProperty.call(DEFAULTS, k) || typeof DEFAULTS[k] === 'function') { continue; }
      var v = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')), d = DEFAULTS[k];
      if (typeof d === 'boolean') { CFG[k] = (v === '1' || v === 'true'); }
      else if (v === 'null' || v === '') { CFG[k] = null; }
      else if (typeof d === 'number' || (d === null && /^-?\d+(\.\d+)?$/.test(v))) { CFG[k] = parseFloat(v); }
      else if (k === 'URLS') { CFG[k] = v.split(','); }
      else { CFG[k] = v; }
    }
  }
  applyUrlOverrides();
  function diagOn() { return CFG.DIAG === null || CFG.DIAG === undefined ? !!CFG.DEBUG : !!CFG.DIAG; }

  /* ---- AudioWorklet : remonte des blocs de 2048 échantillons + nb de canaux */
  var WORKLET_SRC =
    "class LocalSttTap extends AudioWorkletProcessor{" +
    "constructor(o){super();var p=(o&&o.processorOptions)||{};this.sel=p.channel|0;this.mix=!!p.mix;" +
    "this.b=new Float32Array(2048);this.n=0;this.on=true;this.port.onmessage=e=>{if(e.data==='stop')this.on=false;};}" +
    "process(inp){var x=inp[0];if(x&&x.length){var nc=x.length,c=x[Math.min(this.sel,nc-1)],L=c.length;" +
    "for(var i=0;i<L;i++){var v;if(this.mix){v=0;for(var j=0;j<nc;j++)v+=x[j][i];v/=nc;}else{v=c[i];}" +
    "this.b[this.n++]=v;if(this.n===this.b.length){this.port.postMessage({d:this.b,ch:nc},[this.b.buffer]);" +
    "this.b=new Float32Array(2048);this.n=0;}}}return this.on;}}registerProcessor('local-stt-tap-v2',LocalSttTap);";
  var WORKLET_URL = null;

  var sock = null, sockConnecting = null, sockIdx = 0, cur = null, lastDiag = null;

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
        'box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:none;transition:opacity .3s;opacity:0;white-space:pre-wrap';
      document.body.appendChild(toastEl);
    }
    toastEl.style.background = isError ? 'rgba(190,40,40,.92)' : 'rgba(30,30,30,.88)';
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, isError ? 5000 : 2500);
  }
  function diag(msg) { if (diagOn()) { say('[diag] ' + msg, false); } dbg(msg); }

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
    if (n === 'OverconstrainedError') { return 'Contrainte micro refusée : ' + (e.constraint || m); }
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

  /* ---- Traitement du signal ----------------------------------------------- */
  // Rééchantillonneur vers 16 kHz, avec état entre les blocs.
  // Descente : moyenne par fenêtre (anti-repliement simple). Montée : interpolation linéaire.
  function makeResampler(inRate) {
    var ratio = inRate / 16000, carry = null, pos = 0, EPS = 1e-7; // EPS : arrondis flottants aux frontières entières
    if (!(ratio > 0) || Math.abs(ratio - 1) < 1e-6) { return function (x) { return x; }; }
    return function (x) {
      var buf = x, n, k, out;
      if (carry && carry.length) {
        buf = new Float32Array(carry.length + x.length);
        buf.set(carry); buf.set(x, carry.length);
      }
      if (ratio >= 1) {
        n = Math.floor((buf.length - pos) / ratio);
        if (n <= 0) { carry = buf; return new Float32Array(0); }
        out = new Float32Array(n);
        for (k = 0; k < n; k++) {
          var a = pos + k * ratio + EPS, i0 = Math.floor(a), i1 = Math.floor(a + ratio);
          if (i1 <= i0) { i1 = i0 + 1; }
          if (i1 > buf.length) { i1 = buf.length; }
          var sum = 0;
          for (var i = i0; i < i1; i++) { sum += buf[i]; }
          out[k] = sum / (i1 - i0);
        }
      } else {
        n = Math.ceil((buf.length - 1 - pos) / ratio);
        if (n <= 0) { carry = buf; return new Float32Array(0); }
        out = new Float32Array(n);
        for (k = 0; k < n; k++) {
          var b = pos + k * ratio, j = Math.floor(b), f = b - j;
          out[k] = buf[j] + (buf[j + 1] - buf[j]) * f;
        }
      }
      var end = pos + n * ratio, used = Math.floor(end + EPS);
      pos = end - used; if (pos < 0) { pos = 0; }
      carry = buf.slice(used);
      return out;
    };
  }

  // Garde 1 échantillon sur N (voie ch), phase conservée d'un bloc à l'autre.
  function makeDeinterleaver(nWay, ch) {
    var phase = 0;
    nWay = Math.max(1, Math.floor(nWay || 1));
    ch = ((Math.floor(ch || 0) % nWay) + nWay) % nWay;
    if (nWay === 1) { return function (x) { return x; }; }
    return function (x) {
      var start = (ch - phase + nWay) % nWay;
      var len = start < x.length ? Math.floor((x.length - 1 - start) / nWay) + 1 : 0;
      var out = new Float32Array(len);
      for (var k = 0, i = start; i < x.length; i += nWay, k++) { out[k] = x[i]; }
      phase = (phase + x.length) % nWay;
      return out;
    };
  }

  // Chaîne : [dé-entrelacement] -> [rééchantillonnage] -> 16 kHz, selon la config
  function makePipeline(ctxRate) {
    var N = Math.max(1, Math.floor(CFG.DESINTERLEAVE || 1));
    var stage = CFG.DESINTERLEAVE_STAGE === 'post' ? 'post' : 'raw';
    var de = makeDeinterleaver(N, CFG.DESINTERLEAVE_CHANNEL);
    var desc;
    if (!CFG.RESAMPLE) {
      desc = 'SANS rééchantillonnage (flux envoyé à ' + (ctxRate / N) + ' Hz déclaré 16000)' +
        (N > 1 ? ', 1/' + N + ' voie ' + CFG.DESINTERLEAVE_CHANNEL : '');
      return { run: function (x) { return de(x); }, desc: desc };
    }
    if (stage === 'raw') {
      var r1 = CFG.INPUT_RATE || ctxRate / N, rs = makeResampler(r1);
      desc = (N > 1 ? 'dé-entrelacement 1/' + N + ' voie ' + CFG.DESINTERLEAVE_CHANNEL + ' sur le brut, ' : '') +
        'rééch. ' + r1 + ' → 16000 Hz';
      return { run: function (x) { return rs(de(x)); }, desc: desc };
    }
    var rsA = makeResampler(ctxRate), r2 = CFG.INPUT_RATE || 16000 / N, rsB = makeResampler(r2);
    desc = 'rééch. ' + ctxRate + ' → 16000, puis dé-entrelacement 1/' + N + ' voie ' + CFG.DESINTERLEAVE_CHANNEL +
      ', puis ' + r2 + ' → 16000 Hz';
    return { run: function (x) { return rsB(de(rsA(x))); }, desc: desc };
  }

  /* ---- Statistiques de diagnostic ----------------------------------------- */
  function newStats() { return { n: 0, e: 0, pk: 0, ac: [0, 0, 0, 0], blocks: 0, blkMin: 1e9, blkMax: 0, ch: 0 }; }
  function accStats(st, x) {
    var L = x.length, i, k, v;
    st.n += L;
    for (i = 0; i < L; i++) { v = x[i]; st.e += v * v; if (v < 0) { v = -v; } if (v > st.pk) { st.pk = v; } }
    for (k = 1; k <= 4; k++) {
      var sum = 0;
      for (i = k; i < L; i++) { sum += x[i] * x[i - k]; }
      st.ac[k - 1] += sum;
    }
  }
  function fmtStats(st) {
    if (!st.n) { return 'aucun échantillon'; }
    var rms = Math.sqrt(st.e / st.n), ac = [];
    for (var k = 0; k < 4; k++) { ac.push(st.e > 0 ? (st.ac[k] / st.e).toFixed(2) : '-'); }
    return 'rms ' + rms.toFixed(4) + ' pic ' + st.pk.toFixed(3) + ' ac1..4 ' + ac.join(' ');
  }
  function flushDiag(s, now) {
    if (!diagOn() || !s.statRaw) { return; }
    var dt = (now - s.statT0) / 1000 || 1, r = s.statRaw, o = s.statOut;
    var line = Math.round(r.blocks / dt) + ' blocs/s × ' + (r.blkMin === r.blkMax ? r.blkMin : r.blkMin + '-' + r.blkMax) +
      ' éch. (' + r.ch + ' can. reçus) @' + s.ctx.sampleRate + ' Hz | brut : ' + fmtStats(r) +
      ' | sortie 16k (' + Math.round(o.n / dt) + ' éch./s) : ' + fmtStats(o);
    lastDiag = { t: now, ctxRate: s.ctx.sampleRate, raw: r, out: o, line: line };
    diag(line);
    s.statRaw = newStats(); s.statOut = newStats(); s.statT0 = now;
  }

  /* ---- Capture micro ------------------------------------------------------ */
  function buildConstraints() {
    if (CFG.AUDIO_CONSTRAINTS) { return { audio: CFG.AUDIO_CONSTRAINTS }; }
    var a = {};
    if (CFG.RAW_AUDIO) { a.echoCancellation = false; a.noiseSuppression = false; a.autoGainControl = false; }
    else { a.echoCancellation = true; a.noiseSuppression = true; a.autoGainControl = true; }
    if (CFG.CHANNEL_COUNT) { a.channelCount = CFG.CHANNEL_COUNT; }
    if (CFG.REQ_SAMPLE_RATE) { a.sampleRate = CFG.REQ_SAMPLE_RATE; }
    if (CFG.DEVICE_ID) { a.deviceId = { exact: CFG.DEVICE_ID }; }
    return { audio: a };
  }

  function reportTrack(s, constraints) {
    if (!diagOn()) { return; }
    try {
      var t = s.stream.getAudioTracks()[0];
      var st = t && t.getSettings ? t.getSettings() : {};
      diag('contraintes demandées ' + JSON.stringify(constraints.audio));
      diag('piste "' + (t && t.label) + '" réglages réels ' + JSON.stringify(st));
    } catch (e) { diag('getSettings KO : ' + e.message); }
    try {
      navigator.mediaDevices.enumerateDevices().then(function (list) {
        var a = [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].kind === 'audioinput') { a.push((list[i].label || '?') + ' [' + list[i].deviceId.slice(0, 12) + ']'); }
        }
        diag('entrées audio : ' + (a.join(' ; ') || 'aucune'));
      }, function () {});
    } catch (e) {}
  }

  function connectMuted(s, node) {
    var g = s.ctx.createGain();
    g.gain.value = 0;              // le graphe doit atteindre destination pour être "tiré"
    node.connect(g); g.connect(s.ctx.destination);
    s.mute = g;
  }

  function useScriptProcessor(s) {
    var ctx = s.ctx;
    var make = ctx.createScriptProcessor || ctx.createJavaScriptNode;
    var nIn = Math.max(1, Math.floor(CFG.SP_INPUT_CHANNELS || 1));
    var n = make.call(ctx, 4096, nIn, 1);
    n.onaudioprocess = function (e) {
      var ib = e.inputBuffer, nc = ib.numberOfChannels, x;
      if (CFG.INPUT_MIX && nc > 1) {
        x = new Float32Array(ib.length);
        for (var c = 0; c < nc; c++) { var d = ib.getChannelData(c); for (var i = 0; i < d.length; i++) { x[i] += d[i] / nc; } }
      } else {
        x = new Float32Array(ib.getChannelData(Math.min(CFG.INPUT_CHANNEL | 0, nc - 1)));
      }
      onAudio(s, x, nc);
    };
    s.src.connect(n); s.node = n; connectMuted(s, n);
    s.capMode = 'ScriptProcessorNode (' + nIn + ' can. demandés)';
  }

  function startCapture(s) {
    var ctx = s.ctx;
    var p = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    return p.then(function () {
      s.src = ctx.createMediaStreamSource(s.stream);
      s.pipe = makePipeline(ctx.sampleRate);
      if (CFG.USE_WORKLET && ctx.audioWorklet && window.AudioWorkletNode) {
        if (!WORKLET_URL) {
          WORKLET_URL = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
        }
        return ctx.audioWorklet.addModule(WORKLET_URL).then(function () {
          var n = new AudioWorkletNode(ctx, 'local-stt-tap-v2', {
            numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCountMode: 'max',
            processorOptions: { channel: CFG.INPUT_CHANNEL | 0, mix: !!CFG.INPUT_MIX }
          });
          n.port.onmessage = function (e) { onAudio(s, e.data.d, e.data.ch); };
          s.src.connect(n); s.node = n; connectMuted(s, n);
          s.capMode = 'AudioWorklet';
        }, function (e) { dbg('AudioWorklet KO, repli ScriptProcessor', e); useScriptProcessor(s); s.capMode += ' (repli : worklet KO)'; });
      }
      useScriptProcessor(s);
      if (CFG.USE_WORKLET) { s.capMode += ' (repli : worklet indisponible)'; }
    }).then(function () {
      s.capturing = true; s.t0 = Date.now(); s.statT0 = s.t0;
      diag('contexte ' + ctx.sampleRate + ' Hz' + (ctx.baseLatency ? ', latence ' + Math.round(ctx.baseLatency * 1000) + ' ms' : '') +
        ' | capture : ' + s.capMode + ' | ' + s.pipe.desc +
        (CFG.INPUT_MIX ? ' | mixage des canaux' : ' | voie d\'entrée ' + (CFG.INPUT_CHANNEL | 0)));
    });
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

  function onAudio(s, raw, nCh) {
    if (s.done || s.ending) { return; }
    var dg = diagOn(), now = Date.now();
    if (dg) {
      if (!s.statRaw) { s.statRaw = newStats(); s.statOut = newStats(); }
      var r = s.statRaw;
      r.blocks++; r.ch = nCh || 1;
      if (raw.length < r.blkMin) { r.blkMin = raw.length; }
      if (raw.length > r.blkMax) { r.blkMax = raw.length; }
      accStats(r, raw);
    }
    var pcm = s.pipe.run(raw);
    if (dg) {
      if (pcm.length) { accStats(s.statOut, pcm); }
      if (now - s.statT0 >= CFG.DIAG_INTERVAL_MS) { flushDiag(s, now); }
    }
    if (!pcm.length) { return; }
    var sum = 0, i;
    for (i = 0; i < pcm.length; i++) { sum += pcm[i] * pcm[i]; }
    var rms = Math.sqrt(sum / pcm.length), durMs = pcm.length / 16;
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
    if (!s.heard && el >= CFG.NO_SPEECH_MS) { flushDiag(s, now); cancelSession(s); say("Je n'ai rien entendu.", false); return; }
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
      if (diagOn()) { diag('serveur : ' + m.audio_s + ' s d\'audio reçus, décodé en ' + m.ms + ' ms → « ' + (m.text || '') + ' »'); }
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
    if (s.capturing) { flushDiag(s, Date.now()); }
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
      ws: null, ctx: null, stream: null, src: null, node: null, mute: null, pipe: null, capMode: '',
      statRaw: null, statOut: null, statT0: 0
    };
    beforeListen();
    // AudioContext créé ICI, de façon synchrone, pendant le geste utilisateur (politique autoplay)
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { fail(s, 'Web Audio indisponible dans ce navigateur'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail(s, 'Micro indisponible (page non sécurisée ?)'); return;
    }
    try {
      s.ctx = CFG.CONTEXT_SAMPLE_RATE ? new AC({ sampleRate: CFG.CONTEXT_SAMPLE_RATE }) : new AC();
    } catch (e) {
      try { s.ctx = new AC(); diag('AudioContext à ' + CFG.CONTEXT_SAMPLE_RATE + ' Hz refusé, fréquence native utilisée'); }
      catch (e2) { fail(s, 'AudioContext : ' + e2.message); return; }
    }

    setState('listening');
    partial('');
    var sockP = getSocket();
    sockP.catch(function () {});          // évite "unhandled rejection" (traité plus bas)
    var constraints = buildConstraints();
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      if (s.done) { stopStream(stream); return; }
      s.stream = stream;
      reportTrack(s, constraints);
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
    __patch: 2,
    enabled: true,
    config: CFG,
    start: start,
    stop: function () { if (cur && !cur.done) { endUtterance(cur, 'stop'); } },
    cancel: function () { if (cur && !cur.done) { cancelSession(cur); } },
    isActive: function () { return !!(cur && !cur.done); },
    warmup: function () { return getSocket().then(function () { return true; }); },
    // Change des options à chaud (prises en compte à la prochaine écoute)
    configure: function (o) { Object.assign(CFG, o || {}); return CFG; },
    lastDiag: function () { return lastDiag; },
    _dsp: { makeResampler: makeResampler, makeDeinterleaver: makeDeinterleaver } // pour tests
  };

  if (diagOn()) {
    var diff = [];
    for (var key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key) && typeof CFG[key] !== 'function' &&
          key !== 'URLS' && key !== 'TOKEN' && CFG[key] !== DEFAULTS[key]) { diff.push(key + '=' + CFG[key]); }
    }
    setTimeout(function () { diag('patch v2 chargé | options modifiées : ' + (diff.join(', ') || 'aucune')); }, 0);
  }
  if (CFG.PRECONNECT) { setTimeout(function () { getSocket().catch(function (e) { dbg(e.message); }); }, 1500); }
})();
/* PATCH STT LOCAL - FIN ==================================================== */
