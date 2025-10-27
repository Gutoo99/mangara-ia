# app.py
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import os
import requests

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)  # se quiser limitar origens: CORS(app, resources={r"/api/*": {"origins": "*"}})

# ===== OpenAI por variável de ambiente (Render/local .env) =====
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

SYS_PROMPT = (
    "Você é a Mangará IA 🌿, uma consultora especializada em herbologia e agroecologia. "
    "Você pode responder a saudações e cumprimentos simples (como 'oi', 'olá', 'bom dia'). "
    "Responda apenas perguntas relacionadas a plantas, herbologia, agroecologia e botânica. "
    "Se a pergunta não estiver relacionada a esses temas, responda de forma educada: "
    "'Desculpe, só posso responder perguntas sobre plantas, herbologia, agroecologia e botânica.' "
    "Responda sempre em português do Brasil, com linguagem clara, amigável e responsável."
    "Evite respostas longas; use listas, tabelas e frases resumidas."
)


# =========================
# Rotas de Páginas
# =========================
@app.get("/")
def home():
    return render_template("index.html")

@app.get("/herbario")
def herbario():
    return render_template("herbario.html")

@app.get("/login")
def login():
    return render_template("login.html")

@app.get("/login-adm")
def login_adm():
    return render_template("login-adm.html")

@app.get("/paineladm")
def painel_adm():
    return render_template("paineladm.html")

# =========================
# API de Chat IA
# =========================
@app.post("/api/ai")
def api_ai():
    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY não configurada no ambiente"}), 500

    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt vazio"}), 400

    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": SYS_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=30,
        )
        j = r.json()
        if r.status_code >= 400:
            return jsonify({"error": f"OpenAI {r.status_code}: {j}"}), 500

        text = (j.get("choices") or [{}])[0].get("message", {}).get("content", "Sem resposta.")
        return jsonify({"answer": text})

    except Exception as e:
        return jsonify({"error": f"Falha ao consultar IA: {e}"}), 500


# Render / produção: o Gunicorn usa "app:app"
# Local: python app.py
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
