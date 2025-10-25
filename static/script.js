// ====== MANGARÁ IA — SCRIPT (fluxo guiado + render Markdown) ======

// Menu mobile (se existir no layout)
function toggleMenu() {
  const m = document.getElementById('menu');
  if (m) m.classList.toggle('active');
}

// Abre/fecha a janela do chatbot
function abrirChatbot() {
  const box = document.getElementById('chatbox');
  if (!box) return;
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    document.getElementById('chatInput')?.focus();
  }
}

// ===== Helpers de renderização =====
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Converte um bloco de linhas Markdown de tabela para HTML <table>
function mdTableToHtml(lines) {
  // Remove linhas vazias nas bordas
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return '';

  const rows = lines.map(l => l.trim());

  // Parse simples por pipe
  function parseRow(raw) {
    const parts = raw.split('|');
    if (parts.length && parts[0].trim() === '') parts.shift();
    if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
    return parts.map(c => escapeHtml(c.trim()));
  }

  const header = parseRow(rows[0] || '');
  let start = 1;
  if (rows[1] && /^\|\s*:?-{3,}.*\|?$/.test(rows[1])) start = 2;

  const bodyRows = [];
  for (let i = start; i < rows.length; i++) {
    if (/^\|\s*:?-{3,}.*\|?$/.test(rows[i])) continue;
    bodyRows.push(parseRow(rows[i]));
  }

  let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
  header.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';
  bodyRows.forEach(r => {
    if (!r.length) return;
    html += '<tr>';
    r.forEach(c => { html += `<td>${c}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

// Conversor Markdown muito simples para bot (bold, quebras, listas e tabelas)
function renderMarkdown(mdText) {
  const text = mdText.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|')) {
      const tbl = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        tbl.push(lines[j]);
        j++;
      }
      out.push(mdTableToHtml(tbl));
      i = j;
      continue;
    }
    let safe = escapeHtml(line);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^\s*[-•]\s+/.test(line)) safe = safe.replace(/^\s*[-•]\s+/, '&bull; ');
    if (/^\s*\d+\.\s+/.test(line)) safe = safe.replace(/^\s*(\d+)\.\s+/, '<span class="ol-idx">$1.</span> ');
    out.push(safe);
    i++;
  }
  return out.join('<br>');
}

// ====== CHAT: fluxo guiado (1) e modo livre (2) ======
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('chatboxClose');
  closeBtn?.addEventListener('click', () => {
    document.getElementById('chatbox')?.classList.add('hidden');
  });

  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  if (!form || !input || !messages) return;

  function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    if (role === 'bot') {
      div.innerHTML = renderMarkdown(text);
    } else {
      div.textContent = text;
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  function setTyping(on = true) {
    if (on) {
      const t = document.createElement('div');
      t.className = 'msg bot';
      t.id = 'typing';
      t.textContent = 'Digitando...';
      messages.appendChild(t);
      messages.scrollTop = messages.scrollHeight;
    } else {
      document.getElementById('typing')?.remove();
    }
  }
  async function askAI(prompt) {
    setTyping(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setTyping(false);
      if (data?.answer) addMsg('bot', data.answer);
      else if (data?.error) addMsg('bot', 'Erro: ' + (data.error.message || data.error));
      else addMsg('bot', 'Sem resposta.');
    } catch (e) {
      setTyping(false);
      addMsg('bot', 'Falha ao conectar com a IA.');
      console.error(e);
    }
  }

  const state = { firstContact: true, mode: 'menu', step: 0, answers: {} };

  const steps = [
    { key: 'local',    question: 'Você vai plantar em **vaso**, **canteiro/jardim** ou **horta elevada**?' },
    { key: 'categoria',question: 'Você quer plantar: **1) Ornamental**, **2) Flor**, **3) Fruta**, **4) Hortaliça/legume**, **5) Ervas/temperos**? (responda com o número)' },
    { key: 'regiao',   question: 'Qual sua **cidade/estado** ou **temperatura média** da região?' },
    { key: 'sol',      question: 'A luminosidade do local é **sol pleno**, **meia-sombra** ou **sombra**?' },
    { key: 'solo',     question: 'Qual o **tipo de solo**? (arenoso, argiloso, argilo-arenoso, rico em matéria orgânica, drenagem boa/ruim)' },
    { key: 'espaco',   question: 'Qual o **tamanho do espaço** e **altura máxima desejada** da planta? (pequeno/médio/grande, altura em m)' },
    { key: 'agua',     question: 'Qual a **frequência de rega** possível? (**diária**, **2-3x/semana**, **pouca**)' }
  ];

  function showMenu(greeting = '') {
    const hello = greeting ? `${greeting}! ` : 'Olá! ';
    addMsg(
      'bot',
      `${hello}Sou a Mangará IA 🌿\n` +
      `Se sua dúvida for sobre **qual tipo de planta escolher para plantar**, digite **1**.\n` +
      `Se sua dúvida for sobre **outro assunto**, digite **2** e escreva sua pergunta.`
    );
  }

  function startGuided() {
    state.mode = 'guided';
    state.step = 0;
    state.answers = {};
    addMsg('bot', steps[state.step].question);
  }

  async function nextStep() {
    state.step++;
    if (state.step < steps.length) {
      addMsg('bot', steps[state.step].question);
    } else {
      const a = state.answers;
      const categoriaMap = { '1':'Ornamental','2':'Flor','3':'Fruta','4':'Hortaliça/legume','5':'Ervas/temperos' };
      const categoria = categoriaMap[(a.categoria || '').trim()] || a.categoria || 'Não especificado';

      const finalPrompt =
`Responda de forma objetiva e curta.
Quero recomendações de espécies para cultivo considerando estas condições:

• Local/recipiente: ${a.local || 'não informado'}
• Categoria desejada: ${categoria}
• Cidade/Região/Clima: ${a.regiao || 'não informado'}
• Luminosidade: ${a.sol || 'não informado'}
• Tipo de solo e drenagem: ${a.solo || 'não informado'}
• Espaço/porte desejado: ${a.espaco || 'não informado'}
• Frequência de rega possível: ${a.agua || 'não informado'}

INSTRUÇÕES:
- NÃO faça perguntas de esclarecimento. Se faltar dado, assuma valores conservadores típicos do Sudeste do Brasil.
- Entregue recomendações mesmo com informações incompletas.
- Use frases curtas.

FORMATO DA RESPOSTA:
1) Liste **3–5 espécies** adequadas, em **tabela Markdown** com colunas:
   | Espécie (comum/científico) | Motivo | Porte | Luz | Rega | Dificuldade | Observações |
2) Depois, **resuma 3–5 dicas** práticas (1 linha cada).`;

      await askAI(finalPrompt);
      state.mode = 'menu';
      state.firstContact = true;
    }
  }

  async function handleGuidedAnswer(text) {
    const current = steps[state.step];
    state.answers[current.key] = text;
    await nextStep();
  }

  function isGreeting(t) {
    const s = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /^(oi|ola|eai|bom dia|boa tarde|boa noite)\b/.test(s);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = (input.value || '').trim();
    if (!raw) return;

    const isCmdMenu = raw.toLowerCase() === 'menu';
    addMsg('user', raw);
    input.value = '';

    if (isCmdMenu) {
      state.mode = 'menu';
      state.firstContact = false;
      showMenu();
      return;
    }

    if (state.firstContact) {
      state.firstContact = false;
      if (isGreeting(raw)) showMenu('Olá');
      else showMenu();
      return;
    }

    if (state.mode === 'menu') {
      if (raw === '1') { startGuided(); return; }
      if (raw === '2') { state.mode = 'free'; addMsg('bot', 'Certo! Envie sua pergunta que eu respondo. 😊'); return; }
      addMsg('bot', 'Não entendi. Digite **1** para recomendações de plantio ou **2** para outro assunto.');
      return;
    }

    if (state.mode === 'guided') {
      await handleGuidedAnswer(raw);
      return;
    }

    if (state.mode === 'free') {
      await askAI(raw);
      return;
    }
  });
});

(function addMdTableStyles(){
  const css = `.md-table-wrap{overflow:auto;margin:.25rem 0}
  .md-table{border-collapse:collapse;width:100%;font-size:.92rem}
  .md-table th,.md-table td{border:1px solid #dcdcdc;padding:.4rem .5rem;text-align:left;vertical-align:top}
  .md-table thead th{background:#f3f5f3;font-weight:700}
  .ol-idx{font-weight:700}`;
  
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})(); 
