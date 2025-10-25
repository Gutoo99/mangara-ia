// ====== MANGARÁ IA — SCRIPT PRINCIPAL (fluxo guiado corrigido) ======

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
    div.textContent = text;
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
`Quero recomendações de espécies para cultivo considerando estas condições:

• Local/recipiente: ${a.local || 'não informado'}
• Categoria desejada: ${categoria}
• Cidade/Região/Clima: ${a.regiao || 'não informado'}
• Luminosidade: ${a.sol || 'não informado'}
• Tipo de solo e drenagem: ${a.solo || 'não informado'}
• Espaço/porte desejado: ${a.espaco || 'não informado'}
• Frequência de rega possível: ${a.agua || 'não informado'}

INSTRUÇÕES IMPORTANTES:
- NÃO faça perguntas de esclarecimento. Se faltar algum dado, faça suposições conservadoras típicas do Brasil Sudeste (ex.: clima subtropical/temperado ameno) e prossiga.
- Entregue recomendações mesmo com informações incompletas.
- Priorize espécies adaptadas ao cenário informado.

FORMATO DA RESPOSTA:
1) Liste 3–5 espécies adequadas, em tabela Markdown com colunas:
   | Espécie (comum/científico) | Motivo da indicação | Porte | Luz | Rega | Dificuldade | Observações |
2) Em seguida, dê 5 dicas práticas de cultivo para este cenário específico.`;

      // Aguarda a resposta da IA e só depois volta ao menu
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

    // Mostra a fala do usuário
    addMsg('user', raw);
    input.value = '';

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
