// Falar em vez de escrever, em TODOS os chats e celulares (Franklin,
// 2026-11-20). O ditado do navegador (SpeechRecognition) não existe ou falha
// em vários aparelhos (ex: navegador Samsung da Ale) e o botão VOZ não fazia
// nada. Este arquivo troca o SpeechRecognition do navegador por um gravador:
// segura o botão, fala, solta → o áudio vai pro servidor (/api/transcrever-
// audio), volta o texto e o chat envia sozinho. Os chats existentes não
// mudam: continuam usando "new SpeechRecognition()" com start/stop e os
// eventos result/end/error, que aqui são gerados a partir da gravação.
(function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return;

  function credenciais() {
    try {
      const s = JSON.parse(localStorage.getItem('mvo_session') || 'null');
      if (s && s.identifier && s.password) return s;
    } catch (e) {}
    return null;
  }

  function mimeSuportado() {
    return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
      .find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  class ReconhecimentoGravado extends EventTarget {
    constructor() {
      super();
      this.lang = 'pt-BR';
      this.interimResults = false;
      this.continuous = false;
      this._rec = null;
      this._stream = null;
      this._partes = [];
      this._pararLogo = false;
      this._ativo = false;
    }

    _emitir(tipo, extra) {
      const ev = new Event(tipo);
      Object.assign(ev, extra || {});
      this.dispatchEvent(ev);
      const h = this['on' + tipo];
      if (typeof h === 'function') { try { h.call(this, ev); } catch (e) {} }
    }

    _soltarMicrofone() {
      if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }

    start() {
      if (this._ativo) throw new Error('já gravando');
      this._ativo = true;
      this._pararLogo = false;
      this._partes = [];
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        this._stream = stream;
        const mime = mimeSuportado();
        this._rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        this._rec.ondataavailable = (e) => { if (e.data && e.data.size) this._partes.push(e.data); };
        this._rec.onstop = () => this._transcrever();
        this._rec.start();
        this._inicio = Date.now();
        this._emitir('start');
        if (this._pararLogo) this.stop();
      }).catch(() => {
        this._ativo = false;
        alert('Para falar com o chat, permita o uso do microfone para este site nas configurações do navegador.');
        this._emitir('error', { error: 'not-allowed' });
        this._emitir('end');
      });
    }

    stop() {
      if (!this._rec) { this._pararLogo = true; return; }
      if (this._rec.state !== 'inactive') this._rec.stop();
    }

    abort() {
      this._descartar = true;
      this.stop();
    }

    async _transcrever() {
      this._soltarMicrofone();
      const partes = this._partes;
      const tipo = (this._rec && this._rec.mimeType) || 'audio/webm';
      const curto = Date.now() - (this._inicio || 0) < 700;
      this._rec = null;
      const descartar = this._descartar || curto || !partes.length;
      this._descartar = false;
      if (descartar) {
        this._ativo = false;
        if (curto) this._dica('Segure o botão enquanto fala e solte no fim.');
        this._emitir('end');
        return;
      }
      const aviso = this._dica('🎙️ Transformando seu áudio em texto...', true);
      try {
        const fd = new FormData();
        const cred = credenciais();
        if (cred) { fd.append('identifier', cred.identifier); fd.append('password', cred.password); }
        const ext = /mp4/.test(tipo) ? 'm4a' : /ogg/.test(tipo) ? 'ogg' : 'webm';
        fd.append('audio', new Blob(partes, { type: tipo }), `voz.${ext}`);
        const r = await fetch('/api/transcrever-audio', { method: 'POST', body: fd });
        const j = await r.json().catch(() => ({}));
        if (aviso) aviso.remove();
        const texto = String(j.texto || '').trim();
        if (!r.ok || !texto) {
          this._dica(j.error || 'Não deu pra entender o áudio. Tente de novo, falando mais perto do celular.');
        } else {
          const resultado = [{ transcript: texto, confidence: 1 }];
          resultado.isFinal = true;
          this._emitir('result', { resultIndex: 0, results: [resultado] });
        }
      } catch (e) {
        if (aviso) aviso.remove();
        this._dica('Sem conexão para enviar o áudio. Tente de novo.');
      }
      this._ativo = false;
      this._emitir('end');
    }

    // Aviso pequeno no rodapé da tela (sem depender de cada página).
    _dica(texto, fixo) {
      const el = document.createElement('div');
      el.textContent = texto;
      el.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:99999;max-width:88vw;padding:10px 16px;border-radius:14px;background:rgba(10,12,16,.94);color:#fff;font:600 14px/1.35 system-ui,sans-serif;border:1px solid #35d07f;box-shadow:0 6px 24px rgba(0,0,0,.45);text-align:center';
      document.body.appendChild(el);
      if (!fixo) setTimeout(() => el.remove(), 3500);
      return el;
    }
  }

  window.SpeechRecognition = ReconhecimentoGravado;
  window.webkitSpeechRecognition = ReconhecimentoGravado;
})();
