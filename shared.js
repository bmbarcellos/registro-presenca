/* SERP — Núcleo compartilhado do formulário de registro de presença.
 * Requer que window.PERIODO_CONFIG esteja definido antes de carregar este script.
 *
 * PERIODO_CONFIG = {
 *   periodoLabel: string,               // ex.: "7º Período"
 *   periodoValor: string,               // ex.: "7"  (enviado ao webhook no campo `periodo`)
 *   webhookRegistro: string,            // URL do webhook de registro
 *   webhookSessao: string,              // URL do webhook de sessão
 *   versao: string,                     // ex.: "1.5.001"
 *   horariosManha: string[],
 *   horariosTarde: string[],
 *   modulosPorDisciplina: { [disciplina]: string[] },
 *   turnoPorDisciplina: { [disciplina]: "manha" | "tarde" | "todos" }
 * }
 */
(function () {
  const CFG = window.PERIODO_CONFIG;
  if (!CFG) { console.error("PERIODO_CONFIG ausente"); return; }

  // --- Identificador da instalação ---
  // UUID gerado uma vez por navegador e guardado no localStorage. Diferente do
  // fingerprint abaixo, ele é único: dois alunos com o mesmo modelo de celular
  // têm device_id distintos. É o que amarra o token de sessão ao navegador que
  // o pediu.
  //
  // Some se o usuário limpar os dados do navegador, e por isso NÃO substitui o
  // fingerprint na detecção de duplicidade — só complementa. Perder o id não
  // causa prejuízo: o aluno apenas recebe uma sessão nova, que dura 5 minutos.
  const CHAVE_INSTALACAO = 'serp_device_id';

  function obterDeviceId() {
    try {
      let id = localStorage.getItem(CHAVE_INSTALACAO);
      if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || gerarUuidFallback();
        localStorage.setItem(CHAVE_INSTALACAO, id);
      }
      return id;
    } catch (e) {
      // Navegação anônima ou armazenamento bloqueado: segue sem device_id, e a
      // validação no servidor recai sobre o fingerprint.
      console.warn('localStorage indisponível; seguindo sem device_id', e);
      return '';
    }
  }

  function gerarUuidFallback() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }

  // --- Fingerprint ---
  // Hash de características do MODELO do aparelho. Não é único — aparelhos
  // iguais colidem — e é justamente por isso que resiste à limpeza de dados.
  // Continua servindo como indício de duplicidade.
  async function gerarDeviceHash() {
    const dados = [
      navigator.userAgent, navigator.language, navigator.platform,
      screen.width + 'x' + screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency || 'unknown',
      navigator.maxTouchPoints || 0,
      new Date().getTimezoneOffset()
    ].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dados));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // --- Sessão ---
  let tokenObtido = false;
  async function obterToken() {
    const statusEl = document.getElementById('tokenStatus');
    const botao = document.querySelector('button[type="submit"]');
    try {
      botao.disabled = true;
      statusEl.className = 'token-status token-loading';
      statusEl.textContent = '⏳ Iniciando sessão segura...';
      const deviceHash = await gerarDeviceHash();
      const deviceId = obterDeviceId();
      document.getElementById('device_hash').value = deviceHash;
      const campoDeviceId = document.getElementById('device_id');
      if (campoDeviceId) campoDeviceId.value = deviceId;
      const res = await fetch(CFG.webhookSessao, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_hash: deviceHash,
          device_id: deviceId,
          periodo: CFG.periodoValor
        })
      });
      if (!res.ok) throw new Error('Falha ao obter sessão');
      const data = await res.json();
      if (!data.token) throw new Error('Token não recebido');
      document.getElementById('token_sessao').value = data.token;
      tokenObtido = true;
      botao.disabled = false;
      statusEl.className = 'token-status token-ok';
      statusEl.textContent = '✅ Sessão ativa — válida por 5 minutos';
      setTimeout(() => {
        statusEl.className = 'token-status token-erro';
        statusEl.textContent = '⚠️ Sessão expirada. Recarregue a página.';
        tokenObtido = false;
        botao.disabled = true;
      }, 5 * 60 * 1000);
    } catch (err) {
      statusEl.className = 'token-status token-erro';
      statusEl.textContent = '❌ Erro ao iniciar sessão. Recarregue a página.';
      botao.disabled = true;
      console.error('Erro ao obter token:', err);
    }
  }

  // --- Email ---
  function wireEmail() {
    const emailInput = document.getElementById('email');
    const emailAviso = document.getElementById('emailAviso');
    emailInput.addEventListener('input', () => {
      const v = emailInput.value.trim();
      emailInput.classList.remove('email-ok', 'email-warn');
      emailAviso.style.display = 'none';
      if (!v) return;
      if (v.endsWith('@id.uff.br')) emailInput.classList.add('email-ok');
      else { emailInput.classList.add('email-warn'); emailAviso.style.display = 'block'; }
    });
  }

  // --- Disciplina/Módulo/Horário ---
  function wireDependencias() {
    const disciplinaSel = document.getElementById('disciplina');
    const moduloSel = document.getElementById('modulo');
    const horarioSel = document.getElementById('horario_aula');

    // Popular disciplinas
    disciplinaSel.innerHTML = '<option value="">Selecione</option>';
    Object.keys(CFG.modulosPorDisciplina).forEach(d => {
      const o = document.createElement('option'); o.value = d; o.textContent = d;
      disciplinaSel.appendChild(o);
    });

    disciplinaSel.addEventListener('change', () => {
      const d = disciplinaSel.value;
      moduloSel.innerHTML = '<option value="">Selecione</option>';
      (CFG.modulosPorDisciplina[d] || []).forEach(m => {
        const o = document.createElement('option'); o.value = m; o.textContent = m;
        moduloSel.appendChild(o);
      });
      horarioSel.innerHTML = '<option value="">Selecione</option>';
      const turno = CFG.turnoPorDisciplina[d] || 'todos';
      let lista = [];
      if (turno === 'manha') lista = CFG.horariosManha;
      else if (turno === 'tarde') lista = CFG.horariosTarde;
      else lista = CFG.horariosManha.concat(CFG.horariosTarde);
      lista.forEach(h => horarioSel.appendChild(new Option(h, h)));
    });
  }

  // --- Submit + geolocalização ---
  function wireSubmit() {
    const form = document.getElementById('presencaForm');
    const botao = form.querySelector('button[type="submit"]');
    let envioLiberado = false;

    botao.addEventListener('click', function (e) {
      e.preventDefault();
      if (!tokenObtido) { alert("Sessão inválida ou expirada. Recarregue a página."); return; }

      document.querySelectorAll('.alerta').forEach(a => a.style.display = 'none');
      document.querySelectorAll('.campo-invalido').forEach(c => c.classList.remove('campo-invalido'));

      let valido = true;
      form.querySelectorAll('input[required], select[required]').forEach(f => {
        if (!f.value) { f.classList.add('campo-invalido'); valido = false; }
      });
      if (!valido) { alert("Todos os campos obrigatórios devem ser preenchidos!"); return; }

      // Validação turno
      const disciplina = document.getElementById('disciplina').value;
      const horario = document.getElementById('horario_aula').value;
      const turno = CFG.turnoPorDisciplina[disciplina] || 'todos';
      const compat =
        turno === 'todos' ||
        (turno === 'manha' && CFG.horariosManha.includes(horario)) ||
        (turno === 'tarde' && CFG.horariosTarde.includes(horario));
      if (!compat) {
        document.getElementById('horarioAviso').style.display = 'block';
        document.getElementById('horario_aula').classList.add('campo-invalido');
        alert("Horário selecionado não é compatível com a disciplina!");
        return;
      }

      if (envioLiberado) { form.submit(); return; }
      botao.disabled = true;
      botao.innerText = "Obtendo localização...";
      if (!navigator.geolocation) { envioLiberado = true; form.submit(); return; }
      navigator.geolocation.getCurrentPosition(
        pos => {
          document.getElementById('lat').value = pos.coords.latitude;
          document.getElementById('lng').value = pos.coords.longitude;
          document.getElementById('accuracy').value = pos.coords.accuracy;
          envioLiberado = true; form.submit();
        },
        () => { envioLiberado = true; form.submit(); },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  }

  // --- Bootstrap ---
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('periodoLabel').textContent = CFG.periodoLabel;
    document.getElementById('periodoInput').value = CFG.periodoValor;
    document.getElementById('acaoForm').setAttribute('action', CFG.webhookRegistro);
    document.getElementById('versaoLabel').textContent = 'versão ' + CFG.versao;
    wireEmail();
    wireDependencias();
    wireSubmit();
    obterToken();
  });
})();
