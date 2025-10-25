// ====== MANGARÁ IA — SCRIPT (fluxo guiado + Markdown + Ampliar Tabela) ======

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

// Converte Markdown de tabela para HTML <table> com botão de expansão
function mdTableToHtml(lines) {
  // Remove bordas vazias
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return '';

  const rows = lines.map(l => l.trim());

  function parseRow(raw) {
    const parts = raw.split('|');
    if (parts.length && parts[0].trim() === '') parts.shift();
    if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
    return parts.map(c => escapeHtml(c.trim()));
  }

  const header = parseRow(rows[0] || '');

  // Segunda linha de separadores? (|---|---|)
  let start = 1;
  if (rows[1] && /^\|\s*:?-{3,}.*\|?$/.test(rows[1])) start = 2;

  const bodyRows = [];
  for (let i = start; i < rows.length; i++) {
    if (/^\|\s*:?-{3,}.*\|?$/.test(rows[i])) continue; // ignora separadores
    bodyRows.push(parseRow(rows[i]));
  }

  // Monta HTML da tabela
  let tableHtml = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
  header.forEach(h => { tableHtml += `<th>${h}</th>`; });
  tableHtml += '</tr></thead><tbody>';
  bodyRows.forEach(r => {
    if (!r.length) return;
    tableHtml += '<tr>';
    r.forEach(c => { tableHtml += `<td>${c}</td>`; });
    tableHtml += '</tr>';
  });
  tableHtml += '</tbody></table></div>';

  // Botão para ampliar (abre modal)
  const encoded = encodeURIComponent(tableHtml);
  const fullHtml = `${tableHtml}
  <div class="table-actions">
    <button class="expand-table" onclick="expandTable('${encoded}')">🔍 Ampliar</button>
  </div>`;

  return fullHtml;
}

// Conversor Markdown simples (bold, listas, numeradas, tabelas)
function renderMarkdown(mdText) {
  const text = mdText.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de tabela
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

    // Linha normal
    let safe = escapeHtml(line);
    // negrito texto
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // bullets
    if (/^\s*[-•]\s+/.test(line)) {
      safe = safe.replace(/^\s*[-•]\s+/, '&bull; ');
    }
    // numeradas "1. "
    if (/^\s*\d+\.\s+/.test(line)) {
      safe = safe.replace(/^\s*(\d+)\.\s+/, '<span class="ol-idx">$1.</span> ');
    }

    out.push(safe);
    i++;
  }

  return out.join('<br>');
}

// ====== CHAT: fluxo guiado (1) e modo livre (2) ======
document.addEventListener('DOMContentLoaded', () => {
  // Botão fechar chat
  const closeBtn = document.getElementById('chatboxClose');
  closeBtn?.addEventListener('click', () => {
    document.getElementById('chatbox')?.classList.add('hidden');
  });

  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  if (!form || !input || !messages) return;

  // Helpers de UI
  function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = role === 'bot' ? renderMarkdown(text) : escapeHtml(text);
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

  // Estado da conversa
  const state = {
    firstContact: true,
    mode: 'menu',   // 'menu' | 'guided' | 'free'
    step: 0,
    answers: {}
  };

  // Passos do fluxo guiado (opção 1)
  const steps = [
    { key: 'local',    question: 'Você vai plantar em vaso, canteiro/jardim ou horta elevada?' },
    { key: 'categoria',question: 'Você quer plantar: 1) Ornamental, 2) Flor, 3) Fruta, 4) Hortaliça/legume, 5) Ervas/temperos? (responda com o número)' },
    { key: 'regiao',   question: 'Qual sua cidade/estado ou temperatura média da região?' },
    { key: 'sol',      question: 'A luminosidade do local é sol pleno, meia-sombra ou sombra?' },
    { key: 'solo',     question: 'Qual o tipo de solo? (arenoso, argiloso, argilo-arenoso, rico em matéria orgânica, drenagem boa/ruim)' },
    { key: 'espaco',   question: 'Qual o tamanho do espaço e altura máxima desejada da planta? (pequeno/médio/grande, altura em m)' },
    { key: 'agua',     question: 'Qual a frequência de rega possível? (diária, 2-3x/semana, pouca)' }
  ];

  function showMenu(greeting = '') {
    const hello = greeting ? `${greeting}! ` : 'Olá! ';
    addMsg(
      'bot',
      `${hello}Sou a Mangará IA 🌿\n` +
      `Se sua dúvida for sobre qual tipo de planta escolher para plantar, digite 1.\n` +
      `Se sua dúvida for sobre outro assunto, digite 2 e escreva sua pergunta.`
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
      // Monta prompt consolidado e consulta a IA
      const a = state.answers;
      const categoriaMap = {
        '1': 'Ornamental',
        '2': 'Flor',
        '3': 'Fruta',
        '4': 'Hortaliça/legume',
        '5': 'Ervas/temperos'
      };
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
1) Liste 3–5 espécies adequadas, em tabela Markdown com colunas:
   | Espécie (comum/científico) | Motivo | Porte | Luz | Rega | Dificuldade | Observações |
2) Depois, resuma 3–5 dicas práticas (1 linha cada).`;

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

  // Handler do formulário (async para aguardar a IA quando necessário)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = (input.value || '').trim();
    if (!raw) return;

    // Comando rápido: "menu"
    const isCmdMenu = raw.toLowerCase() === 'menu';

    // Mostra a fala do usuário
    addMsg('user', raw);
    input.value = '';

    if (isCmdMenu) {
      state.mode = 'menu';
      state.firstContact = false;
      showMenu();
      return;
    }

    // Primeiro contato: saudação + menu
    if (state.firstContact) {
      state.firstContact = false;
      if (isGreeting(raw)) showMenu('Olá');
      else showMenu();
      return;
    }

    // Menu
    if (state.mode === 'menu') {
      if (raw === '1') { startGuided(); return; }
      if (raw === '2') { state.mode = 'free'; addMsg('bot', 'Certo! Envie sua pergunta que eu respondo. 😊'); return; }
      addMsg('bot', 'Não entendi. Digite 1 para recomendações de plantio ou 2 para outro assunto.');
      return;
    }

    // Guiado (1)
    if (state.mode === 'guided') {
      await handleGuidedAnswer(raw);
      return;
    }

    // Livre (2)
    if (state.mode === 'free') {
      await askAI(raw);
      return;
    }
  });
});

// ===== Modal para ampliar tabelas =====
function expandTable(encodedHtml) {
  const html = decodeURIComponent(encodedHtml);
  const overlay = document.createElement('div');
  overlay.className = 'table-modal';
  overlay.innerHTML = `
    <div class="table-modal-content">
      <button class="close-modal" onclick="this.closest('.table-modal').remove()">✖ Fechar</button>
      ${html}
    </div>`;
  document.body.appendChild(overlay);
}

// ===== Estilo mínimo para tabelas e modal =====
(function addMdTableStyles(){
  const css = `.md-table-wrap{overflow:auto;margin:.4rem 0;position:relative}
  .md-table{border-collapse:collapse;width:100%;font-size:.92rem;background:white}
  .md-table th,.md-table td{border:1px solid #dcdcdc;padding:.45rem .55rem;text-align:left;vertical-align:top}
  .md-table thead th{background:#f3f5f3;font-weight:700;position:sticky;top:0}
  .table-actions{text-align:right;margin-top:6px}
  .expand-table{background:#f2f2f2;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:.82rem}
  .expand-table:hover{background:#e2e2e2}
  .table-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem}
  .table-modal-content{background:white;padding:1rem;max-width:95vw;max-height:85vh;overflow:auto;border-radius:10px;box-shadow:0 0 20px rgba(0,0,0,.3)}
  .close-modal{float:right;background:#1a4d2e;color:white;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;margin-bottom:.5rem}
  .close-modal:hover{opacity:.9}
  .ol-idx{font-weight:700}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();