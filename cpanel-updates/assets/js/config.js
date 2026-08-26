/* =========================================================
   Avaliação Digital 2.0 — Configuração
   Troque os valores abaixo depois de publicar o backend
   (Google Apps Script) — veja /backend/README-backend.md
   ========================================================= */

window.APP_CONFIG = {
  // Cole aqui a URL da função serverless na Vercel, por exemplo:
  // "https://seu-projeto.vercel.app/api/action"
  // Enquanto estiver como "REPLACE_ME", o sistema roda em modo demo,
  // com dados fictícios guardados só na memória do navegador.
  API_URL: "REPLACE_ME_APPS_SCRIPT_URL",

  // Evento padrão desta instalação. Numa instalação multi-evento,
  // isso normalmente viria da URL (?evento=xxxx) — deixado fixo aqui
  // para simplificar o primeiro deploy.
  EVENT_ID: "demo-2027",

  APP_NAME: "Avaliação Digital 2.0",
  ORG_NAME: "Conexão Junina"
};
