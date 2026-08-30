/**
 * =============================================================
 *  AVALIAÇÃO DIGITAL 2.0 — Backend (Google Apps Script)
 *  Conexão Junina
 * =============================================================
 *
 *  Como implantar:
 *  1. Crie uma planilha "master" (registro de eventos e usuários)
 *     com as abas: Usuarios, Eventos  (ver estrutura abaixo).
 *  2. Extensões > Apps Script nessa planilha master, cole este
 *     arquivo como Code.gs.
 *  3. Troque MASTER_SHEET_ID pelo ID da própria planilha master
 *     (Arquivo > Detalhes, ou pela URL).
 *  4. Para cada evento, duplique a planilha-template de evento
 *     (Config / Config_Quesitos / Candidatas / Votos /
 *     Correcoes_ADM / Logs / Encerramento_Concurso) e registre o
 *     ID dela na aba "Eventos" da planilha master.
 *  5. Implantar > Nova implantação > Aplicativo da Web > Executar
 *     como "Eu", acesso "Qualquer pessoa". Copie a URL gerada e
 *     cole em assets/js/config.js (API_URL) no front-end.
 *
 *  Aba "Usuarios" (na planilha MASTER):
 *    Codigo | Nome | Perfil | EventosPermitidos (IDs separados por vírgula) | Ativo (TRUE/FALSE)
 *
 *  Aba "Eventos" (na planilha MASTER):
 *    EventoID | Nome | SpreadsheetID | StatusConcurso | DataInicio (ISO) | DataFim (ISO)
 *
 *  Aba "QuesitosGlobais" (na planilha MASTER) — catálogo geral de quesitos:
 *    ID | Nome | Peso | Ordem | ValidoParaTodos (TRUE/FALSE) | EventosAplicaveis (IDs separados por vírgula)
 *
 *  Aba "GruposCandidatas" (na planilha MASTER) — catálogo geral de grupos/quadrilhas:
 *    ID | Nome | Cidade | Estado
 *
 *  Planilha de CADA EVENTO (abas):
 *    Config            -> A2:idAtiva B2:statusSistema C2:idPreparada D2:revealIndex E2:regrasJSON
 *    Candidatas        -> ID | Nome | Cidade | Estado | Disponibilidade | StatusAvaliacao | Ordem | FlagEspecial | StatusAuditoria
 *    Votos             -> Timestamp | Login | AvaliadorNome | Perfil | ID_Candidata | ID_Quesito | Nota | Justificativa | Assinatura
 *    Correcoes_ADM     -> ID | ID_Candidata | LoginAvaliador | NomeAvaliador | ID_Quesito | NotaAntes | JustAntes | NotaDepois | JustDepois | Motivo | Status | QuestionadaPor
 *    Logs              -> DataHora | Acao | Usuario | Perfil | Detalhe
 *    Encerramento_Concurso -> Tipo | ConteudoJSON
 *
 *  (Quesitos deixaram de ter aba própria por evento — agora vêm do catálogo
 *  geral "QuesitosGlobais" da planilha master, filtrado por aplicabilidade.)
 * =============================================================
 */

var MASTER_SHEET_ID = "COLE_AQUI_O_ID_DA_PLANILHA_MASTER";

/* =============================================================
   ROTEAMENTO
   ============================================================= */

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return response({ success: false, message: "Payload inválido" });
  }

  var action = body.action;

  try {
    switch (action) {
      case "login": return login(body);

      case "get_quesitos": return getQuesitos(body);
      case "get_evento_regras": return getEventoRegras(body);
      case "get_quesitos_globais": return getQuesitosGlobais(body);
      case "get_grupos_globais": return getGruposGlobais(body);
      case "list_accessible_eventos": return listAccessibleEventos(body);
      case "get_status_concurso": return getStatusConcurso(body);
      case "get_active": return getActiveCandidate(body);
      case "get_candidates_panel": return getCandidatesPanel(body);

      case "prepare_evaluation": return prepareEvaluation(body);
      case "start_evaluation": return startEvaluation(body);
      case "interrupt_evaluation": return interruptEvaluation(body);
      case "resume_evaluation": return resumeEvaluation(body);
      case "return_to_queue": return returnToQueue(body);
      case "end_evaluation": return endEvaluation(body);
      case "set_candidate_flag": return setCandidateFlag(body);

      case "get_my_vote": return getMyVote(body);
      case "submit_vote": return submitVote(body);
      case "get_monitor": return getMonitorData(body);

      case "get_received_notes": return getReceivedNotes(body);
      case "get_auditoria_candidates": return getAuditoriaCandidates(body);
      case "get_candidate_audit": return getCandidateAudit(body);
      case "finalize_audit": return finalizeAudit(body);
      case "get_validated_table": return getValidatedTable(body);
      case "get_official_ranking": return getOfficialRanking(body);
      case "get_scoreboard":
      case "get_apuracao_live": return getScoreboard(body);

      case "request_correction": return requestCorrection(body);
      case "get_my_pending_corrections": return getMyPendingCorrections(body);
      case "submit_correction": return submitCorrection(body);
      case "validate_correction": return validateCorrection(body);
      case "cancel_correction": return cancelCorrection(body);
      case "get_all_corrections": return getAllCorrections(body);

      case "get_logs": return getLogs(body);
      case "finalizar_concurso": return finalizarConcurso(body);

      case "get_telao_notes": return getTelaoNotes(body);
      case "get_telao_reveal_state": return getTelaoRevealState(body);
      case "set_telao_reveal_index": return setTelaoRevealIndex(body);

      case "admin_list_eventos": return adminListEventos(body);
      case "admin_list_usuarios": return adminListUsuarios(body);
      case "admin_save_usuario": return adminSaveUsuario(body);
      case "admin_remove_usuario": return adminRemoveUsuario(body);
      case "admin_save_quesitos": return adminSaveQuesitos(body);
      case "admin_save_candidatas": return adminSaveCandidatas(body);
      case "admin_set_status_concurso": return adminSetStatusConcurso(body);
      case "admin_get_evento_config": return adminGetEventoConfig(body);
      case "admin_save_evento_config": return adminSaveEventoConfig(body);

      default:
        return response({ success: false, message: "Ação não reconhecida: " + action });
    }
  } catch (err) {
    return response({ success: false, message: "Erro interno: " + err.message });
  }
}

function response(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =============================================================
   PLANILHA MASTER (usuários / registro de eventos)
   ============================================================= */

function getMasterSs() {
  return SpreadsheetApp.openById(MASTER_SHEET_ID);
}

function getUsuariosSheet() { return getMasterSs().getSheetByName("Usuarios"); }
function getEventosSheet() { return getMasterSs().getSheetByName("Eventos"); }
function getQuesitosGlobaisSheet() { return getMasterSs().getSheetByName("QuesitosGlobais"); }
function getGruposSheet() { return getMasterSs().getSheetByName("GruposCandidatas"); }

function getQuesitosGlobaisArray() {
  var rows = getQuesitosGlobaisSheet().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      id: String(rows[i][0]), nome: String(rows[i][1]), peso: Number(rows[i][2]) || 1, ordem: Number(rows[i][3]) || i,
      validoParaTodos: String(rows[i][4]).toUpperCase() !== "FALSE",
      eventos: String(rows[i][5] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      _row: i + 1
    });
  }
  return out.sort(function (a, b) { return a.ordem - b.ordem; });
}

function getGruposArray() {
  var rows = getGruposSheet().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({ id: String(rows[i][0]), nome: String(rows[i][1]), cidade: String(rows[i][2] || ""), estado: String(rows[i][3] || "") });
  }
  return out;
}

function getUsuariosArray() {
  var rows = getUsuariosSheet().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      codigo: String(rows[i][0]).trim(),
      nome: String(rows[i][1] || "").trim(),
      perfil: String(rows[i][2] || "").trim().toLowerCase(),
      eventos: String(rows[i][3] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      ativo: String(rows[i][4]).toUpperCase() !== "FALSE"
    });
  }
  return out;
}

function getEventosArray() {
  var rows = getEventosSheet().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      id: String(rows[i][0]).trim(),
      nome: String(rows[i][1] || "").trim(),
      spreadsheetId: String(rows[i][2] || "").trim(),
      statusConcurso: String(rows[i][3] || "A_INICIAR").trim(),
      dataInicio: String(rows[i][4] || "").trim(),
      dataFim: String(rows[i][5] || "").trim(),
      _row: i + 1
    });
  }
  return out;
}

function getEventoRegistro(eventId) {
  return getEventosArray().find(function (e) { return e.id === eventId; });
}

// Cache leve de spreadsheets de evento já abertas nesta execução.
var _eventoSsCache = {};

function getEventoSs(eventId) {
  if (_eventoSsCache[eventId]) return _eventoSsCache[eventId];
  var registro = getEventoRegistro(eventId);
  if (!registro) throw new Error("Evento não encontrado: " + eventId);
  var ss = SpreadsheetApp.openById(registro.spreadsheetId);
  _eventoSsCache[eventId] = ss;
  return ss;
}

function sheet(eventId, name) {
  return getEventoSs(eventId).getSheetByName(name);
}

/* =============================================================
   UTILITÁRIOS
   ============================================================= */

function normalizarTexto(txt) {
  return String(txt || "").trim().toUpperCase();
}

function gerarValoresNota(min, max, tipo) {
  min = Number(min); max = Number(max);
  var valores = [];
  if (tipo === "quebrada") {
    var start10 = Math.round(min * 10);
    var end10 = Math.round(max * 10);
    for (var v = start10; v <= end10; v++) valores.push(Math.round(v) / 10);
  } else {
    var start = Math.floor(min) + 0.5;
    if (start < min) start += 1;
    for (var v2 = start; v2 <= max + 1e-9; v2 += 1) valores.push(Math.round(v2 * 10) / 10);
  }
  return valores;
}

function normalizarNota(nota, regras) {
  var n = Number(String(nota).replace(",", "."));
  if (isNaN(n)) return "";
  var r = regras || REGRAS_PADRAO;
  var validos = gerarValoresNota(r.notaMin, r.notaMax, r.notaTipo);
  return validos.indexOf(n) !== -1 ? n : "";
}

var REGRAS_PADRAO = {
  notaMin: 8, notaMax: 10, notaTipo: "fracionada",
  regraDescarte: "maior_e_menor",
  minCaracteresJustificativa: 10, assinaturaObrigatoria: true
};

function getEventoRegrasObj(eventId) {
  var raw = String(sheet(eventId, "Config").getRange("E2").getValue() || "").trim();
  if (!raw) return REGRAS_PADRAO;
  try {
    var parsed = JSON.parse(raw);
    for (var k in REGRAS_PADRAO) if (!(k in parsed)) parsed[k] = REGRAS_PADRAO[k];
    return parsed;
  } catch (e) {
    return REGRAS_PADRAO;
  }
}

function setEventoRegrasObj(eventId, regras) {
  sheet(eventId, "Config").getRange("E2").setValue(JSON.stringify(regras));
}

function getEventoRegras(body) {
  return response({ success: true, regras: getEventoRegrasObj(body.event_id) });
}

function registrarLog(eventId, acao, usuario, perfil, detalhe) {
  var sh = sheet(eventId, "Logs");
  sh.appendRow([new Date(), acao, usuario || "", perfil || "", detalhe || ""]);
}

/* =============================================================
   AUTENTICAÇÃO
   ============================================================= */

function login(body) {
  var codigo = String(body.codigo || "").trim().toUpperCase();
  var usuario = getUsuariosArray().find(function (u) { return u.codigo.toUpperCase() === codigo; });

  if (!usuario) {
    return response({ success: false, message: "Código não reconhecido. Verifique com a organização do seu evento." });
  }

  if (usuario.ativo === false) {
    return response({ success: false, message: "Este usuário está desativado. Fale com o administrador do seu evento." });
  }

  var eventoId = usuario.eventos[0] || "";

  if (eventoId) {
    registrarLog(eventoId, "LOGIN", usuario.nome, usuario.perfil.toUpperCase(), "Login efetuado com sucesso");
  }

  return response({
    success: true,
    usuario: { codigo: usuario.codigo, nome: usuario.nome, perfil: usuario.perfil, eventoId: eventoId, eventos: usuario.eventos }
  });
}

/* =============================================================
   QUESITOS / STATUS / CANDIDATA ATIVA
   ============================================================= */

function getQuesitosObj(eventId) {
  return getQuesitosGlobaisArray().filter(function (q) {
    return q.validoParaTodos || q.eventos.indexOf(eventId) !== -1;
  }).sort(function (a, b) { return a.ordem - b.ordem; });
}

function getQuesitos(body) {
  return response({ success: true, quesitos: getQuesitosObj(body.event_id) });
}

function getQuesitosGlobais(body) {
  return response({ success: true, quesitos: getQuesitosGlobaisArray() });
}

function getGruposGlobais(body) {
  return response({ success: true, grupos: getGruposArray() });
}

function listAccessibleEventos(body) {
  var perfil = String(body.perfil || "").toLowerCase();
  var eventos;

  if (perfil === "admin") {
    eventos = getEventosArray();
  } else {
    var usuario = getUsuariosArray().find(function (u) { return u.codigo.toUpperCase() === String(body.codigo || "").toUpperCase(); });
    var idsPermitidos = usuario ? usuario.eventos : [];
    eventos = getEventosArray().filter(function (e) { return idsPermitidos.indexOf(e.id) !== -1; });
  }

  return response({
    success: true,
    eventos: eventos.map(function (e) {
      var candidatas = 0;
      try { candidatas = getCandidatesArray(e.id).length; } catch (err) {}
      return { id: e.id, nome: e.nome, statusConcurso: e.statusConcurso, dataInicio: e.dataInicio, dataFim: e.dataFim, candidatas: candidatas };
    })
  });
}

function getStatusConcurso(body) {
  var registro = getEventoRegistro(body.event_id);
  var cfg = sheet(body.event_id, "Config").getRange("A2:D2").getValues()[0];
  return response({
    success: true,
    statusConcurso: registro ? registro.statusConcurso : "A_INICIAR",
    statusSistema: String(cfg[1] || "AGUARDANDO"),
    nomeConcurso: registro ? registro.nome : "",
    dataInicio: registro ? registro.dataInicio : "",
    dataFim: registro ? registro.dataFim : ""
  });
}

function getCandidatesArray(eventId) {
  var rows = sheet(eventId, "Candidatas").getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      id: String(rows[i][0]),
      nome: String(rows[i][1]),
      cidade: String(rows[i][2] || ""),
      estado: String(rows[i][3] || ""),
      disponibilidade: String(rows[i][4] || "DISPONIVEL"),
      statusAvaliacao: String(rows[i][5] || "PENDENTE"),
      ordem: Number(rows[i][6]) || 0,
      flagEspecial: String(rows[i][7] || ""),
      statusAuditoria: String(rows[i][8] || "PENDENTE"),
      _row: i + 1
    });
  }
  return out;
}

function getCandidateById(eventId, id) {
  return getCandidatesArray(eventId).find(function (c) { return String(c.id) === String(id); });
}

function updateCandidateRow(eventId, cand) {
  var sh = sheet(eventId, "Candidatas");
  sh.getRange(cand._row, 1, 1, 9).setValues([[
    cand.id, cand.nome, cand.cidade, cand.estado, cand.disponibilidade, cand.statusAvaliacao, cand.ordem, cand.flagEspecial, cand.statusAuditoria
  ]]);
}

function getCandidatesPanel(body) {
  return response({ success: true, candidatas: getCandidatesArray(body.event_id) });
}

function getActiveCandidate(body) {
  var cfg = sheet(body.event_id, "Config").getRange("A2:D2").getValues()[0];
  var idAtiva = String(cfg[0] || "").trim();
  var statusSistema = String(cfg[1] || "AGUARDANDO");
  var cand = idAtiva ? getCandidateById(body.event_id, idAtiva) : null;
  return response({ success: true, candidata: cand || null, statusSistema: statusSistema });
}

/* =============================================================
   CICLO DE AVALIAÇÃO
   ============================================================= */

function setConfigCell(eventId, cell, value) {
  sheet(eventId, "Config").getRange(cell).setValue(value);
}

function prepareEvaluation(body) {
  var perfil = normalizarTexto(body.perfil);
  if (perfil !== "PRESIDENTE DE MESA" && perfil !== "ADMIN") return response({ success: false, message: "Acesso negado" });
  setConfigCell(body.event_id, "C2", body.id_candidata);
  return response({ success: true, message: "Candidata preparada" });
}

function startEvaluation(body) {
  var cand = getCandidateById(body.event_id, body.id_candidata);
  if (!cand) return response({ success: false, message: "Candidata não encontrada" });

  cand.statusAvaliacao = "EM_AVALIACAO";
  updateCandidateRow(body.event_id, cand);
  setConfigCell(body.event_id, "A2", cand.id);
  setConfigCell(body.event_id, "B2", "EM_AVALIACAO");
  setConfigCell(body.event_id, "C2", "");

  registrarLog(body.event_id, "START_EVALUATION", body.usuario, body.perfil, cand.nome);
  return response({ success: true, message: "Avaliação iniciada" });
}

function interruptEvaluation(body) {
  setConfigCell(body.event_id, "B2", "INTERROMPIDO");
  registrarLog(body.event_id, "INTERRUPT_EVALUATION", body.usuario, body.perfil, "Avaliação interrompida");
  return response({ success: true, message: "Avaliação interrompida" });
}

function resumeEvaluation(body) {
  setConfigCell(body.event_id, "B2", "EM_AVALIACAO");
  registrarLog(body.event_id, "RESUME_EVALUATION", body.usuario, body.perfil, "Avaliação retomada");
  return response({ success: true, message: "Avaliação retomada" });
}

function returnToQueue(body) {
  var cand = getCandidateById(body.event_id, body.id_candidata);
  if (cand) { cand.statusAvaliacao = "PENDENTE"; updateCandidateRow(body.event_id, cand); }

  var idAtiva = String(sheet(body.event_id, "Config").getRange("A2").getValue() || "").trim();
  if (idAtiva === String(body.id_candidata)) {
    setConfigCell(body.event_id, "A2", "");
    setConfigCell(body.event_id, "B2", "AGUARDANDO");
  }
  return response({ success: true, message: "Candidata devolvida à fila" });
}

function endEvaluation(body) {
  var cand = getCandidateById(body.event_id, body.id_candidata);
  if (!cand) return response({ success: false, message: "Candidata não encontrada" });

  cand.statusAvaliacao = "FINALIZADA";
  updateCandidateRow(body.event_id, cand);

  var idAtiva = String(sheet(body.event_id, "Config").getRange("A2").getValue() || "").trim();
  if (idAtiva === String(body.id_candidata)) {
    setConfigCell(body.event_id, "A2", "");
    setConfigCell(body.event_id, "B2", "AGUARDANDO");
  }

  registrarLog(body.event_id, "END_EVALUATION", body.usuario, body.perfil, cand.nome);
  return response({ success: true, message: "Avaliação encerrada" });
}

function setCandidateFlag(body) {
  var perfil = normalizarTexto(body.perfil);
  if (["PRESIDENTE DE MESA", "ADMIN", "CONSULTOR"].indexOf(perfil) === -1) return response({ success: false, message: "Acesso negado" });

  var cand = getCandidateById(body.event_id, body.id_candidata);
  if (!cand) return response({ success: false, message: "Candidata não encontrada" });

  var novoFlag = normalizarTexto(body.flag || "");
  cand.flagEspecial = novoFlag;

  if (novoFlag === "DESISTENTE" || novoFlag === "DESCLASSIFICADA") {
    cand.disponibilidade = "NAO_DISPONIVEL";
    cand.statusAvaliacao = novoFlag;
  } else {
    cand.flagEspecial = "";
    cand.disponibilidade = "DISPONIVEL";
    if (cand.statusAvaliacao !== "FINALIZADA") cand.statusAvaliacao = "PENDENTE";
  }

  updateCandidateRow(body.event_id, cand);
  registrarLog(body.event_id, "SET_CANDIDATE_FLAG", body.usuario, body.perfil, cand.nome + " -> " + (novoFlag || "SEM_FLAG"));
  return response({ success: true, message: "Flag atualizada com sucesso" });
}

/* =============================================================
   VOTOS  (schema normalizado: 1 linha por voto x quesito)
   ============================================================= */

function getVotosArray(eventId) {
  var rows = sheet(eventId, "Votos").getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][1]) continue;
    out.push({
      timestamp: rows[i][0], login: String(rows[i][1]).trim(), avaliadorNome: String(rows[i][2] || "").trim(),
      perfil: String(rows[i][3] || ""), idCandidata: String(rows[i][4]).trim(), idQuesito: String(rows[i][5]).trim(),
      nota: Number(rows[i][6]), justificativa: String(rows[i][7] || ""), assinatura: String(rows[i][8] || ""),
      _row: i + 1
    });
  }
  return out;
}

function getMyVote(body) {
  var votos = getVotosArray(body.event_id).filter(function (v) {
    return v.idCandidata === String(body.id_candidata) && v.login.toUpperCase() === String(body.login).toUpperCase();
  });
  return response({ success: true, votos: votos.map(function (v) { return { quesitoId: v.idQuesito, nota: v.nota, justificativa: v.justificativa }; }) });
}

function submitVote(body) {
  var perfil = normalizarTexto(body.perfil);
  if (perfil !== "AVALIADOR") return response({ success: false, message: "Acesso negado" });

  var cand = getCandidateById(body.event_id, body.id_candidata);
  if (!cand) return response({ success: false, message: "Candidata não encontrada" });

  var cfg = sheet(body.event_id, "Config").getRange("A2:B2").getValues()[0];
  var idAtiva = String(cfg[0] || "").trim();
  var statusSistema = String(cfg[1] || "").trim();

  if (idAtiva !== String(body.id_candidata)) return response({ success: false, message: "Esta candidata não está ativa para votação" });
  if (statusSistema !== "EM_AVALIACAO") return response({ success: false, message: "A avaliação está interrompida. Aguarde o presidente retomar a avaliação." });

  var quesitos = getQuesitosObj(body.event_id);
  var regras = getEventoRegrasObj(body.event_id);
  var sh = sheet(body.event_id, "Votos");
  var existentes = getVotosArray(body.event_id);

  if (regras.assinaturaObrigatoria !== false && !body.assinatura) {
    return response({ success: false, message: "Assinatura obrigatória" });
  }

  for (var i = 0; i < quesitos.length; i++) {
    var q = quesitos[i];
    var nota = normalizarNota(body.notas[q.id], regras);
    var just = String((body.just || {})[q.id] || "").trim();

    if (nota === "") return response({ success: false, message: "Nota inválida. Use um valor entre " + regras.notaMin + " e " + regras.notaMax + " no formato " + (regras.notaTipo === "quebrada" ? "0,1 em 0,1" : "fracionado (,5)") });
    if (just.length < (regras.minCaracteresJustificativa || 0)) return response({ success: false, message: "Todas as justificativas devem ter no mínimo " + regras.minCaracteresJustificativa + " caracteres" });

    var linhaExistente = existentes.find(function (v) {
      return v.idCandidata === String(body.id_candidata) && v.login.toUpperCase() === String(body.login).toUpperCase() && v.idQuesito === q.id;
    });

    var novaLinha = [new Date(), body.login, body.avaliador, body.perfil, body.id_candidata, q.id, nota, just, body.assinatura || ""];

    if (linhaExistente) {
      sh.getRange(linhaExistente._row, 1, 1, novaLinha.length).setValues([novaLinha]);
    } else {
      sh.appendRow(novaLinha);
    }
  }

  registrarLog(body.event_id, "SUBMIT_VOTE", body.login, body.perfil, "Voto registrado/atualizado para candidata: " + cand.nome);
  return response({ success: true, message: "Voto registrado com sucesso" });
}

function getMonitorData(body) {
  var votos = getVotosArray(body.event_id).filter(function (v) { return v.idCandidata === String(body.id_candidata); });
  var votaram = {};
  votos.forEach(function (v) { votaram[v.login.toUpperCase()] = v.avaliadorNome; });

  var avaliadores = getUsuariosArray().filter(function (u) { return u.perfil === "avaliador" && u.eventos.indexOf(body.event_id) !== -1; });

  return response({
    success: true,
    avaliadores: avaliadores.map(function (u) { return { login: u.codigo, nome: u.nome, votou: !!votaram[u.codigo.toUpperCase()] }; })
  });
}

/* =============================================================
   APURAÇÃO (descarte de maior/menor nota + desempate)
   ============================================================= */

function somaComDescarte(notas, regras) {
  var r = regras || REGRAS_PADRAO;
  var arr = notas.slice().sort(function (a, b) { return a - b; });

  if (!r.regraDescarte || r.regraDescarte === "sem_descarte" || arr.length < 3) {
    return arr.reduce(function (acc, n) { return acc + n; }, 0);
  }
  if (r.regraDescarte === "maior") {
    return arr.slice(0, -1).reduce(function (acc, n) { return acc + n; }, 0);
  }
  // maior_e_menor
  return arr.slice(1, -1).reduce(function (acc, n) { return acc + n; }, 0);
}

function gerarRankingInterno(eventId, somenteAuditadas) {
  var quesitos = getQuesitosObj(eventId);
  var votos = getVotosArray(eventId);
  var regras = getEventoRegrasObj(eventId);
  var candidatas = getCandidatesArray(eventId).filter(function (c) {
    return somenteAuditadas ? c.statusAuditoria === "AUDITADA" : true;
  });

  var resultado = candidatas.map(function (c) {
    var detalhamento = {};
    var total = 0;

    if (c.flagEspecial === "DESCLASSIFICADA" || c.flagEspecial === "DESISTENTE") {
      quesitos.forEach(function (q) { detalhamento[q.id] = 0; });
      return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, total: 0, detalhamento: detalhamento, observacao: c.flagEspecial };
    }

    quesitos.forEach(function (q) {
      var notasQuesito = votos
        .filter(function (v) { return v.idCandidata === c.id && v.idQuesito === q.id; })
        .map(function (v) { return v.nota; });
      var soma = somaComDescarte(notasQuesito, regras);
      detalhamento[q.id] = soma;
      total += soma;
    });

    return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, total: total, detalhamento: detalhamento, observacao: "" };
  });

  resultado.sort(function (a, b) {
    var aEsp = a.observacao === "DESCLASSIFICADA" || a.observacao === "DESISTENTE";
    var bEsp = b.observacao === "DESCLASSIFICADA" || b.observacao === "DESISTENTE";
    if (aEsp && !bEsp) return 1;
    if (!aEsp && bEsp) return -1;
    if (aEsp && bEsp) return 0;
    if (b.total !== a.total) return b.total - a.total;
    for (var i = 0; i < quesitos.length; i++) {
      var q = quesitos[i];
      var av = a.detalhamento[q.id] || 0, bv = b.detalhamento[q.id] || 0;
      if (bv !== av) return bv - av;
    }
    return 0;
  });

  for (var i = 0; i < resultado.length - 1; i++) {
    var atual = resultado[i], prox = resultado[i + 1];
    var atualEsp = atual.observacao === "DESCLASSIFICADA" || atual.observacao === "DESISTENTE";
    var proxEsp = prox.observacao === "DESCLASSIFICADA" || prox.observacao === "DESISTENTE";
    if (atualEsp || proxEsp) continue;

    if (Number(atual.total) === Number(prox.total)) {
      var obs = "Empate total após todos os critérios.";
      for (var j = 0; j < quesitos.length; j++) {
        var q2 = quesitos[j];
        var aVal = atual.detalhamento[q2.id] || 0, bVal = prox.detalhamento[q2.id] || 0;
        if (aVal !== bVal) { obs = "Desempate aplicado por " + q2.nome + " (" + aVal + " x " + bVal + ")"; break; }
      }
      atual.observacao = obs;
      prox.observacao = obs;
    }
  }

  return resultado;
}

function getOfficialRanking(body) {
  return response({ success: true, ranking: gerarRankingInterno(body.event_id, true) });
}

function getScoreboard(body) {
  return response({ success: true, ranking: gerarRankingInterno(body.event_id, false) });
}

/* =============================================================
   AUDITORIA / NOTAS RECEBIDAS / NOTAS VALIDADAS
   ============================================================= */

function getReceivedNotes(body) {
  var votos = getVotosArray(body.event_id);
  var candidatas = getCandidatesArray(body.event_id);
  return response({
    success: true,
    candidatas: candidatas.map(function (c) {
      return {
        id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado,
        votos: votos.filter(function (v) { return v.idCandidata === c.id; })
          .map(function (v) { return { avaliador: v.login, avaliadorNome: v.avaliadorNome, quesitoId: v.idQuesito, nota: v.nota, justificativa: v.justificativa }; })
      };
    })
  });
}

function getAuditoriaCandidates(body) {
  var candidatas = getCandidatesArray(body.event_id).filter(function (c) { return c.statusAvaliacao === "FINALIZADA"; });
  return response({ success: true, candidatas: candidatas });
}

function computeDiscardInfo(eventId, candidataId) {
  var quesitos = getQuesitosObj(eventId);
  var regras = getEventoRegrasObj(eventId);
  var votos = getVotosArray(eventId).filter(function (v) { return v.idCandidata === String(candidataId); });

  return quesitos.map(function (q) {
    var doQuesito = votos.filter(function (v) { return v.idQuesito === q.id; });
    var marcados = doQuesito.map(function (v) { return { avaliador: v.avaliadorNome, nota: v.nota, justificativa: v.justificativa, descartada: false }; });

    if (marcados.length >= 3 && regras.regraDescarte && regras.regraDescarte !== "sem_descarte") {
      var ordenados = marcados.slice().sort(function (a, b) { return a.nota - b.nota; });
      ordenados[ordenados.length - 1].descartada = true; // uma ocorrência da maior
      if (regras.regraDescarte === "maior_e_menor") {
        ordenados[0].descartada = true; // uma ocorrência da menor
      }
    }
    return { quesito: q.nome, quesitoId: q.id, votos: marcados };
  });
}

function getCandidateAudit(body) {
  return response({ success: true, detalhamento: computeDiscardInfo(body.event_id, body.id_candidata) });
}

function finalizeAudit(body) {
  var cand = getCandidateById(body.event_id, body.id_candidata);
  if (!cand) return response({ success: false, message: "Candidata não encontrada" });
  cand.statusAuditoria = "AUDITADA";
  updateCandidateRow(body.event_id, cand);
  registrarLog(body.event_id, "FINALIZE_AUDIT", body.usuario, body.perfil, cand.nome);
  return response({ success: true, message: "Candidata auditada" });
}

function getValidatedTable(body) {
  var candidatas = getCandidatesArray(body.event_id).filter(function (c) { return c.statusAuditoria === "AUDITADA"; });
  return response({
    success: true,
    quesitos: getQuesitosObj(body.event_id),
    candidatas: candidatas.map(function (c) {
      return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, detalhamento: computeDiscardInfo(body.event_id, c.id) };
    })
  });
}

/* =============================================================
   CORREÇÕES / QUESTIONAMENTOS
   ============================================================= */

function getCorrecoesArray(eventId) {
  var rows = sheet(eventId, "Correcoes_ADM").getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      id: String(rows[i][0]), idCandidata: String(rows[i][1]), loginAvaliador: String(rows[i][2]).toLowerCase(),
      nomeAvaliador: String(rows[i][3]), idQuesito: String(rows[i][4]), notaAntes: rows[i][5], justAntes: String(rows[i][6] || ""),
      notaDepois: rows[i][7], justDepois: String(rows[i][8] || ""), motivo: String(rows[i][9] || ""),
      status: String(rows[i][10] || ""), questionadaPor: String(rows[i][11] || ""), _row: i + 1
    });
  }
  return out;
}

function requestCorrection(body) {
  var perfil = normalizarTexto(body.perfil);
  if (["PRESIDENTE DE MESA", "ADMIN", "CONSULTOR"].indexOf(perfil) === -1) return response({ success: false, message: "Acesso negado" });

  var loginAvaliador = String(body.login_avaliador || "").trim().toLowerCase();
  var correcoes = getCorrecoesArray(body.event_id);

  var jaExiste = correcoes.find(function (c) {
    return c.idCandidata === String(body.id_candidata) && c.loginAvaliador === loginAvaliador &&
      c.idQuesito === String(body.id_quesito) && c.status === "PENDENTE_CORRECAO";
  });
  if (jaExiste) return response({ success: false, message: "Já existe correção pendente para este quesito" });

  var votos = getVotosArray(body.event_id);
  var votoOriginal = votos.find(function (v) {
    return v.idCandidata === String(body.id_candidata) && v.login.toLowerCase() === loginAvaliador && v.idQuesito === String(body.id_quesito);
  });
  if (!votoOriginal) return response({ success: false, message: "Voto do avaliador não encontrado" });

  var id = "COR-" + Date.now();
  sheet(body.event_id, "Correcoes_ADM").appendRow([
    id, body.id_candidata, loginAvaliador, votoOriginal.avaliadorNome, body.id_quesito,
    votoOriginal.nota, votoOriginal.justificativa, "", "", body.motivo, "PENDENTE_CORRECAO", body.usuario || perfil
  ]);

  registrarLog(body.event_id, "REQUEST_CORRECTION", body.usuario, body.perfil, "Correção solicitada / quesito " + body.id_quesito);
  return response({ success: true, message: "Correção solicitada com sucesso" });
}

function getMyPendingCorrections(body) {
  var login = String(body.login || "").toLowerCase();
  var correcoes = getCorrecoesArray(body.event_id).filter(function (c) { return c.loginAvaliador === login && c.status === "PENDENTE_CORRECAO"; });
  return response({ success: true, correcoes: correcoes });
}

function submitCorrection(body) {
  var correcoes = getCorrecoesArray(body.event_id);
  var corr = correcoes.find(function (c) { return c.id === body.id_correcao; });
  if (!corr) return response({ success: false, message: "Correção não encontrada" });

  var sh = sheet(body.event_id, "Correcoes_ADM");
  sh.getRange(corr._row, 8).setValue(body.nota);
  sh.getRange(corr._row, 9).setValue(body.justificativa);
  sh.getRange(corr._row, 11).setValue("CORRIGIDA");

  return response({ success: true, message: "Correção enviada para validação" });
}

function validateCorrection(body) {
  var correcoes = getCorrecoesArray(body.event_id);
  var corr = correcoes.find(function (c) { return c.id === body.id_correcao; });
  if (!corr) return response({ success: false, message: "Correção não encontrada" });

  sheet(body.event_id, "Correcoes_ADM").getRange(corr._row, 11).setValue("VALIDADA");

  // sobrepõe o voto original nos cálculos (o voto bruto continua intacto na aba Votos)
  var votos = getVotosArray(body.event_id);
  var votoAlvo = votos.find(function (v) { return v.idCandidata === corr.idCandidata && v.login.toLowerCase() === corr.loginAvaliador && v.idQuesito === corr.idQuesito; });
  if (votoAlvo) {
    var shVotos = sheet(body.event_id, "Votos");
    shVotos.getRange(votoAlvo._row, 7).setValue(corr.notaDepois);
    shVotos.getRange(votoAlvo._row, 8).setValue(corr.justDepois);
  }

  registrarLog(body.event_id, "VALIDATE_CORRECTION", body.usuario, body.perfil, "Correção validada");
  return response({ success: true, message: "Correção validada" });
}

function cancelCorrection(body) {
  var correcoes = getCorrecoesArray(body.event_id);
  var corr = correcoes.find(function (c) { return c.id === body.id_correcao; });
  if (!corr) return response({ success: false, message: "Correção não encontrada" });
  sheet(body.event_id, "Correcoes_ADM").deleteRow(corr._row);
  return response({ success: true, message: "Correção cancelada" });
}

function getAllCorrections(body) {
  return response({ success: true, correcoes: getCorrecoesArray(body.event_id) });
}

/* =============================================================
   LOGS
   ============================================================= */

function getLogs(body) {
  var rows = sheet(body.event_id, "Logs").getDataRange().getValues();
  var out = [];
  for (var i = Math.max(1, rows.length - 200); i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({ data: rows[i][0], acao: rows[i][1], usuario: rows[i][2], perfil: rows[i][3], detalhe: rows[i][4] });
  }
  return response({ success: true, logs: out.reverse() });
}

/* =============================================================
   ENCERRAMENTO DO CONCURSO
   ============================================================= */

function finalizarConcurso(body) {
  var ranking = gerarRankingInterno(body.event_id, true);
  var recebidas = getReceivedNotes(body).getContent();
  var validadas = getValidatedTable(body).getContent();
  var correcoes = getCorrecoesArray(body.event_id);

  var sh = sheet(body.event_id, "Encerramento_Concurso");
  sh.appendRow(["RANKING_FINAL_JSON", JSON.stringify(ranking)]);
  sh.appendRow(["NOTAS_RECEBIDAS_JSON", recebidas]);
  sh.appendRow(["NOTAS_VALIDADAS_JSON", validadas]);
  sh.appendRow(["CORRECOES_JSON", JSON.stringify(correcoes)]);
  sh.appendRow(["ENCERRADO_EM", new Date().toISOString()]);
  sh.appendRow(["ENCERRADO_POR", body.usuario || ""]);

  // marca o status do concurso na planilha MASTER
  var eventosSheet = getEventosSheet();
  var rows = eventosSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === body.event_id) {
      eventosSheet.getRange(i + 1, 4).setValue("FINALIZADO");
      break;
    }
  }

  registrarLog(body.event_id, "FINALIZAR_CONCURSO", body.usuario, body.perfil, "Concurso encerrado");
  return response({ success: true, message: "Concurso encerrado com sucesso" });
}

/* =============================================================
   TELÃO
   ============================================================= */

function getTelaoNotes(body) {
  var ranking = gerarRankingInterno(body.event_id, true);
  var revealIndex = Number(sheet(body.event_id, "Config").getRange("D2").getValue()) || 0;
  return response({ success: true, ranking: ranking, revealIndex: revealIndex });
}

function getTelaoRevealState(body) {
  var revealIndex = Number(sheet(body.event_id, "Config").getRange("D2").getValue()) || 0;
  return response({ success: true, revealIndex: revealIndex });
}

function setTelaoRevealIndex(body) {
  setConfigCell(body.event_id, "D2", body.index);
  return response({ success: true });
}

/* =============================================================
   ADMIN — MULTI-EVENTO
   ============================================================= */

function adminListEventos(body) {
  var eventos = getEventosArray();
  return response({
    success: true,
    eventos: eventos.map(function (e) {
      var candidatas = 0, quesitos = 0;
      try { candidatas = getCandidatesArray(e.id).length; quesitos = getQuesitosObj(e.id).length; } catch (err) {}
      return { id: e.id, nome: e.nome, statusConcurso: e.statusConcurso, dataInicio: e.dataInicio, dataFim: e.dataFim, candidatas: candidatas, quesitos: quesitos };
    })
  });
}

function adminListUsuarios(body) {
  return response({ success: true, usuarios: getUsuariosArray() });
}

function adminSaveUsuario(body) {
  var sh = getUsuariosSheet();
  var rows = sh.getDataRange().getValues();
  var codigo = String(body.codigo).trim().toUpperCase();
  var ativoTexto = body.ativo === false ? "FALSE" : "TRUE";

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === codigo) {
      sh.getRange(i + 1, 1, 1, 5).setValues([[codigo, body.nome, body.perfil, (body.eventos || []).join(","), ativoTexto]]);
      return response({ success: true, message: "Usuário atualizado" });
    }
  }

  sh.appendRow([codigo, body.nome, body.perfil, (body.eventos || []).join(","), ativoTexto]);
  return response({ success: true, message: "Usuário criado" });
}

function adminRemoveUsuario(body) {
  var sh = getUsuariosSheet();
  var rows = sh.getDataRange().getValues();
  var codigo = String(body.codigo).trim().toUpperCase();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === codigo) {
      sh.deleteRow(i + 1);
      return response({ success: true, message: "Usuário removido" });
    }
  }
  return response({ success: false, message: "Usuário não encontrado" });
}

// Quesitos agora são um catálogo GLOBAL (planilha master), não mais por evento.
function adminSaveQuesitos(body) {
  var sh = getQuesitosGlobaisSheet();
  sh.clearContents();
  sh.getRange(1, 1, 1, 6).setValues([["ID", "Nome", "Peso", "Ordem", "ValidoParaTodos", "EventosAplicaveis"]]);
  var rows = (body.quesitos || []).map(function (q) {
    return [q.id, q.nome, q.peso, q.ordem, q.validoParaTodos !== false ? "TRUE" : "FALSE", (q.eventos || []).join(",")];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
  return response({ success: true, message: "Quesitos atualizados" });
}

// Grupos/candidatas também são um catálogo GLOBAL (planilha master).
function adminSaveCandidatas(body) {
  var sh = getGruposSheet();
  sh.clearContents();
  sh.getRange(1, 1, 1, 4).setValues([["ID", "Nome", "Cidade", "Estado"]]);
  var rows = (body.grupos || []).map(function (g) { return [g.id, g.nome, g.cidade || "", g.estado || ""]; });
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  return response({ success: true, message: "Grupos atualizados" });
}

function adminGetEventoConfig(body) {
  var registro = getEventoRegistro(body.event_id);
  var grupoIds = getCandidatesArray(body.event_id).map(function (c) { return c.id; });
  return response({
    success: true,
    nome: registro ? registro.nome : "",
    dataInicio: registro ? registro.dataInicio : "",
    dataFim: registro ? registro.dataFim : "",
    regras: getEventoRegrasObj(body.event_id),
    grupoIds: grupoIds
  });
}

function adminSaveEventoConfig(body) {
  setEventoRegrasObj(body.event_id, body.regras || REGRAS_PADRAO);

  var sh = getEventosSheet();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === body.event_id) {
      if (body.nome) sh.getRange(i + 1, 2).setValue(body.nome);
      sh.getRange(i + 1, 5).setValue(body.dataInicio || "");
      sh.getRange(i + 1, 6).setValue(body.dataFim || "");
      break;
    }
  }

  // sincroniza quais grupos participam deste evento
  if (body.grupoIds) {
    var candSheet = sheet(body.event_id, "Candidatas");
    var atuais = getCandidatesArray(body.event_id);
    var novosIds = body.grupoIds;

    // remove (de baixo para cima, pra não bagunçar os índices de linha) os que saíram
    for (var j = atuais.length - 1; j >= 0; j--) {
      if (novosIds.indexOf(atuais[j].id) === -1) candSheet.deleteRow(atuais[j]._row);
    }

    var jaPresentes = atuais.filter(function (c) { return novosIds.indexOf(c.id) !== -1; }).map(function (c) { return c.id; });
    var todosGrupos = getGruposArray();
    var proximaOrdem = jaPresentes.length;

    novosIds.forEach(function (gid) {
      if (jaPresentes.indexOf(gid) !== -1) return;
      var grupo = todosGrupos.find(function (g) { return g.id === gid; });
      if (!grupo) return;
      proximaOrdem += 1;
      candSheet.appendRow([grupo.id, grupo.nome, grupo.cidade, grupo.estado, "DISPONIVEL", "PENDENTE", proximaOrdem, "", "PENDENTE"]);
    });
  }

  registrarLog(body.event_id, "ADMIN_SAVE_EVENTO_CONFIG", body.usuario, body.perfil, "Configurações do evento atualizadas");
  return response({ success: true, message: "Configurações do evento salvas" });
}

function adminSetStatusConcurso(body) {
  var sh = getEventosSheet();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === body.event_id) {
      sh.getRange(i + 1, 4).setValue(body.status);
      return response({ success: true, message: "Status do concurso atualizado" });
    }
  }
  return response({ success: false, message: "Evento não encontrado" });
}
