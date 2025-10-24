from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import requests

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Config OpenAI (USO LOCAL)

# ATENÇÃO: chave embutida para TESTES LOCAIS
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

SYS_PROMPT = (
    "Você pode responder saudações"
    "Você é um consultor especializado em herbologia e agroecologia. "
    "Responda apenas perguntas relacionadas a plantas, herbologia, agroecologia e botânica. "
    "Se a pergunta não estiver relacionada, diga: "
    "'Desculpe, só posso responder perguntas sobre herbologia e agroecologia.' "
    "Responda sempre em pt-BR, de forma clara e responsável."
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

# API de Chat IA
@app.post("/api/ai")
def api_ai():

    # bloqueio simples para uso LOCAL
    # 
    # host = request.host.split(":")[0]
    # if host not in ("127.0.0.1", "localhost"):
        # return jsonify({"error": "API habilitada apenas em localhost para testes."}), 403

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
                    {"role": "user", "content": prompt}
                ]
            },
            timeout=30
        )
        j = r.json()
        if r.status_code >= 400:
            return jsonify({"error": f"OpenAI {r.status_code}: {j}"}), 500

        text = (j.get("choices") or [{}])[0].get("message",{}).get("content","Sem resposta.")
        return jsonify({"answer": text})
    except Exception as e:
        return jsonify({"error": f"Falha ao consultar IA: {e}"}), 500


app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)

