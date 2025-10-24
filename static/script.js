document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("ai-form");
  const input = document.getElementById("prompt");
  const output = document.getElementById("response");
  const btn = document.getElementById("ask-btn");

  async function ask() {
    const prompt = input.value.trim();
    if (!prompt) { output.textContent = "Digite uma pergunta..."; return; }

    output.textContent = "⏳ Consultando IA...";
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.answer) output.textContent = data.answer;
      else if (data.error) output.textContent = "❌ " + (data.error.message || data.error);
      else output.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      output.textContent = "❌ Falha ao conectar: " + err.message;
    }
  }

  let primeiroContato = true;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const userInput = input.value.trim();
    if (!userInput) return;

    // adiciona a mensagem do usuário no chat
    addMessage(userInput, "user");
    input.value = "";

    // se for o primeiro contat, mostra a saudação fixa e não chama a IA ainda
    if (primeiroContato) {
      primeiroContato = false;
      addMessage(
        "🌱 Olá! Sou a Mangará IA 🌿\n" +
        "Estou aqui para te ajudar!\n\n" +
        "Se sua dúvida for sobre **qual tipo de planta, flor ou fruta escolher**, digite **1**.\n" +
        "Se for sobre outro assunto, digite sua dúvida normalmente.",
        "bot"
      );
      return;
    }

    // se digitar "1", entra no modo de recomendação de plantas
    if (userInput === "1") {
      addMessage(
        "Perfeito! 🌿 Me conte um pouco sobre o ambiente onde deseja plantar:\n" +
        "- É em vaso, horta, jardim ou quintal?\n" +
        "- Tem bastante sol, sombra ou meio termo?\n" +
        "- E como é o solo (arenoso, argiloso, rico em matéria orgânica...)?",
        "bot"
      );
      return;
    }

    // se não for o primeiro contato nem o modo 1, chama a IA normalmente
    ask(userInput);
  });

  btn.addEventListener("click", () => {
    form.dispatchEvent(new Event("submit"));
  });

  });



// === CHATBOT FLUTUANTE (Mangará IA) ===
function abrirChatbot() {
  const box = document.getElementById('chatbox');
  if (!box) return;
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    document.getElementById('chatInput')?.focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('chatboxClose');
  closeBtn?.addEventListener('click', () => {
    document.getElementById('chatbox')?.classList.add('hidden');
  });

  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');

  function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pergunta = (input.value || '').trim();
    if (!pergunta) return;
    addMsg('user', pergunta);
    input.value = '';

    const typing = document.createElement('div');
    typing.className = 'msg bot';
    typing.textContent = 'Digitando...';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: pergunta })
      });
      const data = await res.json();
      typing.remove();
      if (data?.answer) addMsg('bot', data.answer);
      else if (data?.error) addMsg('bot', 'Erro: ' + (data.error.message || data.error));
      else addMsg('bot', 'Sem resposta.');
    } catch (err) {
      typing.remove();
      addMsg('bot', 'Falha ao conectar com a IA (backend local está rodando?).');
      console.error(err);
    }
  });
});
