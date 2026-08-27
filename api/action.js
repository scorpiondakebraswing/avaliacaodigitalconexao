// =============================================================
// AVALIAÇÃO DIGITAL 2.0 — API (Vercel + Supabase)
// Mesmo contrato de ação usado no Apps Script (Code.gs) e no
// modo demo (assets/js/api.js): POST { action, ...payload } ->
// { success: bool, ...payload }. Isso significa que o front-end
// já publicado no cPanel não precisa ser reescrito — só apontar
// assets/js/config.js para a URL desta função.
// =============================================================

const supabase = require('../lib/supabaseAdmin');
const { REGRAS_PADRAO, gerarValoresNota, marcarDescartes, gerarRanking } = require('../lib/regras');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ success: false, message: 'Method not allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  try {
    const result = await route(body.action, body);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(200).json({ success: false, message: 'Erro interno: ' + err.message });
  }
};

async function route(action, body) {
  switch (action) {
    case 'login': return login(body);

    case 'get_quesitos': return getQuesitos(body);
    case 'get_evento_regras': return getEventoRegras(body);
    case 'get_quesitos_globais': return getQuesitosGlobais(body);
    case 'get_grupos_globais': return getGruposGlobais(body);
    case 'list_accessible_eventos': return listAccessibleEventos(body);

    case 'get_status_concurso': return getStatusConcurso(body);
    case 'get_active': return getActive(body);
    case 'get_candidates_panel': return getCandidatesPanel(body);

    case 'prepare_evaluation': return prepareEvaluation(body);
    case 'start_evaluation': return startEvaluation(body);
    case 'interrupt_evaluation': return interruptEvaluation(body);
    case 'resume_evaluation': return resumeEvaluation(body);
    case 'return_to_queue': return returnToQueue(body);
    case 'end_evaluation': return endEvaluation(body);
    case 'set_candidate_flag': return setCandidateFlag(body);

    case 'get_my_vote': return getMyVote(body);
    case 'submit_vote': return submitVote(body);
    case 'get_monitor': return getMonitor(body);

    case 'get_received_notes': return getReceivedNotes(body);
    case 'get_auditoria_candidates': return getAuditoriaCandidates(body);
    case 'get_candidate_audit': return getCandidateAudit(body);
    case 'finalize_audit': return finalizeAudit(body);
    case 'get_validated_table': return getValidatedTable(body);
    case 'get_official_ranking': return getOfficialRanking(body);
    case 'get_scoreboard':
    case 'get_apuracao_live': return getScoreboard(body);

    case 'request_correction': return requestCorrection(body);
    case 'get_my_pending_corrections': return getMyPendingCorrections(body);
    case 'submit_correction': return submitCorrection(body);
    case 'validate_correction': return validateCorrection(body);
    case 'cancel_correction': return cancelCorrection(body);
    case 'get_all_corrections': return getAllCorrections(body);

    case 'get_logs': return getLogs(body);
    case 'finalizar_concurso': return finalizarConcurso(body);

    case 'get_telao_notes': return getTelaoNotes(body);
    case 'get_telao_reveal_state': return getTelaoRevealState(body);
    case 'set_telao_reveal_index': return setTelaoRevealIndex(body);

    case 'admin_list_eventos': return adminListEventos(body);
    case 'admin_list_usuarios': return adminListUsuarios(body);
    case 'admin_save_usuario': return adminSaveUsuario(body);
    case 'admin_remove_usuario': return adminRemoveUsuario(body);
    case 'admin_save_quesitos': return adminSaveQuesitos(body);
    case 'admin_save_candidatas': return adminSaveCandidatas(body);
    case 'admin_get_evento_config': return adminGetEventoConfig(body);
    case 'admin_save_evento_config': return adminSaveEventoConfig(body);
    case 'admin_set_status_concurso': return adminSetStatusConcurso(body);
    case 'admin_create_evento': return adminCreateEvento(body);

    case 'trocar_codigo_usuario': return trocarCodigoUsuario(body);

    case 'master_list_clientes': return masterListClientes();
    case 'master_save_cliente': return masterSaveCliente(body);
    case 'master_list_usuarios': return adminListUsuarios(body);

    default:
      return { success: false, message: 'Ação não reconhecida: ' + action };
  }
}

/* ============================= helpers ============================= */

async function getEvento(eventoId) {
  const { data, error } = await supabase.from('eventos').select('*').eq('id', eventoId).maybeSingle();
  if (error) throw error;
  return data;
}

async function getQuesitosParaEvento(eventoId) {
  const [{ data: globais, error: e1 }, { data: aplic, error: e2 }] = await Promise.all([
    supabase.from('quesitos_globais').select('*').order('ordem'),
    supabase.from('quesito_eventos').select('*').eq('evento_id', eventoId)
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const idsEspecificos = new Set((aplic || []).map((r) => r.quesito_id));
  return (globais || [])
    .filter((q) => q.valido_para_todos || idsEspecificos.has(q.id))
    .map((q) => ({ id: q.id, nome: q.nome, peso: Number(q.peso), ordem: q.ordem }));
}

async function getCandidatasDoEvento(eventoId) {
  const { data, error } = await supabase.from('evento_candidatas').select('*').eq('evento_id', eventoId).order('ordem');
  if (error) throw error;
  return data || [];
}

async function getVotosDoEvento(eventoId, candidataId) {
  let q = supabase.from('votos').select('*').eq('evento_id', eventoId);
  if (candidataId) q = q.eq('candidata_id', candidataId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function getUsuarioPorCodigo(codigo) {
  const { data, error } = await supabase.from('usuarios').select('*').ilike('codigo', codigo).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: eventos } = await supabase.from('usuario_eventos').select('evento_id').eq('codigo', data.codigo);
  return { ...data, eventos: (eventos || []).map((e) => e.evento_id) };
}

async function registrarLog(eventoId, acao, usuario, perfil, detalhe) {
  await supabase.from('logs').insert({ evento_id: eventoId, acao, usuario: usuario || '', perfil: perfil || '', detalhe: detalhe || '' });
}

function normalizarNota(nota, regras) {
  const n = Number(String(nota).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  const validos = gerarValoresNota(regras.notaMin, regras.notaMax, regras.notaTipo);
  return validos.includes(n) ? n : null;
}

/* ============================= autenticação ============================= */

async function login(body) {
  const usuario = await getUsuarioPorCodigo(String(body.codigo || '').trim());
  if (!usuario) return { success: false, message: 'Código não reconhecido. Verifique com a organização do seu evento.' };
  if (usuario.ativo === false) return { success: false, message: 'Este usuário está desativado. Fale com o administrador do seu evento.' };

  // perfil master não pertence a nenhum cliente — gerencia todos.
  if (usuario.perfil !== 'master') {
    if (!usuario.cliente_id) return { success: false, message: 'Este usuário não está associado a nenhum grupo de clientes. Fale com o master da plataforma.' };

    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', usuario.cliente_id).maybeSingle();
    if (!cliente || cliente.ativo === false) {
      return { success: false, message: 'O acesso da sua organização está desativado. Fale com o master da plataforma.' };
    }
    if (cliente.data_validade_licenca && new Date(cliente.data_validade_licenca) < new Date()) {
      return { success: false, message: 'A licença da sua organização expirou em ' + new Date(cliente.data_validade_licenca).toLocaleDateString('pt-BR') + '. Fale com o master da plataforma.' };
    }
  }

  const eventoId = usuario.eventos[0] || '';
  if (eventoId) await registrarLog(eventoId, 'LOGIN', usuario.nome, usuario.perfil.toUpperCase(), 'Login efetuado com sucesso');

  return { success: true, usuario: { codigo: usuario.codigo, nome: usuario.nome, perfil: usuario.perfil, eventoId, eventos: usuario.eventos, clienteId: usuario.cliente_id || null } };
}

/* ============================= quesitos / status ============================= */

async function getQuesitos(body) {
  return { success: true, quesitos: await getQuesitosParaEvento(body.event_id) };
}

async function getEventoRegras(body) {
  const evento = await getEvento(body.event_id);
  return { success: true, regras: evento ? evento.regras : REGRAS_PADRAO };
}

async function getQuesitosGlobais(body) {
  let qGlobais = supabase.from('quesitos_globais').select('*').order('ordem');
  if (body && body.cliente_id) qGlobais = qGlobais.eq('cliente_id', body.cliente_id);

  const [{ data: globais, error: e1 }, { data: aplic, error: e2 }] = await Promise.all([
    qGlobais,
    supabase.from('quesito_eventos').select('*')
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const map = {};
  (aplic || []).forEach((r) => { (map[r.quesito_id] = map[r.quesito_id] || []).push(r.evento_id); });
  return {
    success: true,
    quesitos: (globais || []).map((q) => ({
      id: q.id, nome: q.nome, peso: Number(q.peso), ordem: q.ordem,
      validoParaTodos: q.valido_para_todos, eventos: map[q.id] || []
    }))
  };
}

async function getGruposGlobais(body) {
  let q = supabase.from('grupos_candidatas').select('*').order('nome');
  if (body && body.cliente_id) q = q.eq('cliente_id', body.cliente_id);
  const { data, error } = await q;
  if (error) throw error;
  return { success: true, grupos: data || [] };
}

async function listAccessibleEventos(body) {
  const perfil = String(body.perfil || '').toLowerCase();
  let eventos;

  if (perfil === 'admin') {
    const usuario = await getUsuarioPorCodigo(String(body.codigo || '').trim());
    if (!usuario || !usuario.cliente_id) { eventos = []; } else {
      const { data, error } = await supabase.from('eventos').select('*').eq('cliente_id', usuario.cliente_id);
      if (error) throw error;
      eventos = data || [];
    }
  } else {
    const usuario = await getUsuarioPorCodigo(String(body.codigo || '').trim());
    const ids = usuario ? usuario.eventos : [];
    if (!ids.length) { eventos = []; } else {
      const { data, error } = await supabase.from('eventos').select('*').in('id', ids);
      if (error) throw error;
      eventos = data || [];
    }
  }

  const comContagem = await Promise.all(eventos.map(async (e) => {
    const candidatas = await getCandidatasDoEvento(e.id);
    return { id: e.id, nome: e.nome, statusConcurso: e.status_concurso, dataInicio: e.data_inicio, dataFim: e.data_fim, candidatas: candidatas.length };
  }));

  return { success: true, eventos: comContagem };
}

async function getStatusConcurso(body) {
  const evento = await getEvento(body.event_id);
  if (!evento) return { success: false, message: 'Evento não encontrado' };
  return {
    success: true,
    statusConcurso: evento.status_concurso,
    statusSistema: evento.status_sistema,
    nomeConcurso: evento.nome,
    dataInicio: evento.data_inicio,
    dataFim: evento.data_fim
  };
}

async function getActive(body) {
  const evento = await getEvento(body.event_id);
  if (!evento) return { success: false, message: 'Evento não encontrado' };
  let candidata = null;
  if (evento.id_ativa) {
    const { data } = await supabase.from('evento_candidatas').select('*').eq('evento_id', body.event_id).eq('id', evento.id_ativa).maybeSingle();
    candidata = data ? mapCandidata(data) : null;
  }
  return { success: true, candidata, statusSistema: evento.status_sistema };
}

function mapCandidata(c) {
  return {
    id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado,
    disponibilidade: c.disponibilidade, statusAvaliacao: c.status_avaliacao,
    ordem: c.ordem, flagEspecial: c.flag_especial, statusAuditoria: c.status_auditoria
  };
}

async function getCandidatesPanel(body) {
  const candidatas = await getCandidatasDoEvento(body.event_id);
  return { success: true, candidatas: candidatas.map(mapCandidata) };
}

/* ============================= ciclo de avaliação ============================= */

async function prepareEvaluation(body) {
  const perfil = String(body.perfil || '').toUpperCase();
  if (!['PRESIDENTE DE MESA', 'ADMIN'].includes(perfil)) return { success: false, message: 'Acesso negado' };
  await supabase.from('eventos').update({ id_preparada: body.id_candidata }).eq('id', body.event_id);
  return { success: true, message: 'Candidata preparada' };
}

async function startEvaluation(body) {
  const { data: cand } = await supabase.from('evento_candidatas').select('*').eq('evento_id', body.event_id).eq('id', body.id_candidata).maybeSingle();
  if (!cand) return { success: false, message: 'Candidata não encontrada' };

  await supabase.from('evento_candidatas').update({ status_avaliacao: 'EM_AVALIACAO' }).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  await supabase.from('eventos').update({ id_ativa: body.id_candidata, status_sistema: 'EM_AVALIACAO', id_preparada: '' }).eq('id', body.event_id);
  await registrarLog(body.event_id, 'START_EVALUATION', body.usuario, body.perfil, cand.nome);
  return { success: true, message: 'Avaliação iniciada' };
}

async function interruptEvaluation(body) {
  await supabase.from('eventos').update({ status_sistema: 'INTERROMPIDO' }).eq('id', body.event_id);
  await registrarLog(body.event_id, 'INTERRUPT_EVALUATION', body.usuario, body.perfil, 'Avaliação interrompida');
  return { success: true, message: 'Avaliação interrompida' };
}

async function resumeEvaluation(body) {
  await supabase.from('eventos').update({ status_sistema: 'EM_AVALIACAO' }).eq('id', body.event_id);
  await registrarLog(body.event_id, 'RESUME_EVALUATION', body.usuario, body.perfil, 'Avaliação retomada');
  return { success: true, message: 'Avaliação retomada' };
}

async function returnToQueue(body) {
  await supabase.from('evento_candidatas').update({ status_avaliacao: 'PENDENTE' }).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  const evento = await getEvento(body.event_id);
  if (evento && evento.id_ativa === body.id_candidata) {
    await supabase.from('eventos').update({ id_ativa: '', status_sistema: 'AGUARDANDO' }).eq('id', body.event_id);
  }
  return { success: true, message: 'Candidata devolvida à fila' };
}

async function endEvaluation(body) {
  const { data: cand } = await supabase.from('evento_candidatas').select('*').eq('evento_id', body.event_id).eq('id', body.id_candidata).maybeSingle();
  if (!cand) return { success: false, message: 'Candidata não encontrada' };

  await supabase.from('evento_candidatas').update({ status_avaliacao: 'FINALIZADA' }).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  const evento = await getEvento(body.event_id);
  if (evento && evento.id_ativa === body.id_candidata) {
    await supabase.from('eventos').update({ id_ativa: '', status_sistema: 'AGUARDANDO' }).eq('id', body.event_id);
  }
  await registrarLog(body.event_id, 'END_EVALUATION', body.usuario, body.perfil, cand.nome);
  return { success: true, message: 'Avaliação encerrada' };
}

async function setCandidateFlag(body) {
  const perfil = String(body.perfil || '').toUpperCase();
  if (!['PRESIDENTE DE MESA', 'ADMIN', 'CONSULTOR'].includes(perfil)) return { success: false, message: 'Acesso negado' };

  const flag = String(body.flag || '').toUpperCase();
  const patch = flag === 'DESISTENTE' || flag === 'DESCLASSIFICADA'
    ? { flag_especial: flag, disponibilidade: 'NAO_DISPONIVEL', status_avaliacao: flag }
    : { flag_especial: '', disponibilidade: 'DISPONIVEL' };

  await supabase.from('evento_candidatas').update(patch).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  await registrarLog(body.event_id, 'SET_CANDIDATE_FLAG', body.usuario, body.perfil, body.id_candidata + ' -> ' + (flag || 'SEM_FLAG'));
  return { success: true, message: 'Flag atualizada com sucesso' };
}

/* ============================= votos ============================= */

async function getMyVote(body) {
  const { data, error } = await supabase.from('votos').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata).ilike('login', body.login);
  if (error) throw error;
  return { success: true, votos: (data || []).map((v) => ({ quesitoId: v.quesito_id, nota: v.nota, justificativa: v.justificativa })) };
}

async function submitVote(body) {
  const evento = await getEvento(body.event_id);
  if (!evento) return { success: false, message: 'Evento não encontrado' };
  if (evento.id_ativa !== body.id_candidata) return { success: false, message: 'Esta candidata não está ativa para votação' };
  if (evento.status_sistema !== 'EM_AVALIACAO') return { success: false, message: 'A avaliação está interrompida. Aguarde o presidente retomar a avaliação.' };

  const regras = evento.regras || REGRAS_PADRAO;
  if (regras.assinaturaObrigatoria !== false && !body.assinatura) return { success: false, message: 'Assinatura obrigatória' };

  const quesitos = await getQuesitosParaEvento(body.event_id);
  const linhas = [];

  for (const q of quesitos) {
    const nota = normalizarNota(body.notas[q.id], regras);
    const just = String((body.just || {})[q.id] || '').trim();
    if (nota === null) return { success: false, message: `Nota inválida para o quesito ${q.nome}.` };
    const minChars = regras.justificativaObrigatoria !== false ? (regras.minCaracteresJustificativa || 0) : 0;
    if (just.length < minChars) return { success: false, message: `Justificativas devem ter no mínimo ${minChars} caracteres.` };
    linhas.push({
      evento_id: body.event_id, candidata_id: body.id_candidata, login: body.login, avaliador_nome: body.avaliador,
      perfil: body.perfil, quesito_id: q.id, nota, justificativa: just, assinatura: body.assinatura || ''
    });
  }

  const { error } = await supabase.from('votos').upsert(linhas, { onConflict: 'evento_id,candidata_id,login,quesito_id' });
  if (error) throw error;

  await registrarLog(body.event_id, 'SUBMIT_VOTE', body.login, body.perfil, 'Voto registrado/atualizado para candidata ' + body.id_candidata);
  return { success: true, message: 'Voto registrado com sucesso' };
}

async function getMonitor(body) {
  const votos = await getVotosDoEvento(body.event_id, body.id_candidata);
  const votaram = new Map(votos.map((v) => [v.login.toUpperCase(), v.avaliador_nome]));

  const { data: eventosUsuarios } = await supabase.from('usuario_eventos').select('codigo').eq('evento_id', body.event_id);
  const codigos = (eventosUsuarios || []).map((r) => r.codigo);
  if (!codigos.length) return { success: true, avaliadores: [] };

  const { data: usuarios } = await supabase.from('usuarios').select('*').in('codigo', codigos).eq('perfil', 'avaliador');
  return {
    success: true,
    avaliadores: (usuarios || []).map((u) => ({ login: u.codigo, nome: u.nome, votou: votaram.has(u.codigo.toUpperCase()) }))
  };
}

/* ============================= notas / auditoria ============================= */

async function getReceivedNotes(body) {
  const [candidatas, votos] = await Promise.all([getCandidatasDoEvento(body.event_id), getVotosDoEvento(body.event_id)]);
  return {
    success: true,
    candidatas: candidatas.map((c) => ({
      id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado,
      votos: votos.filter((v) => v.candidata_id === c.id)
        .map((v) => ({ avaliador: v.login, avaliadorNome: v.avaliador_nome, quesitoId: v.quesito_id, nota: v.nota, justificativa: v.justificativa }))
    }))
  };
}

async function getAuditoriaCandidates(body) {
  const candidatas = await getCandidatasDoEvento(body.event_id);
  return { success: true, candidatas: candidatas.filter((c) => c.status_avaliacao === 'FINALIZADA').map(mapCandidata) };
}

async function computeDetalhamento(eventoId, candidataId, regraDescarte) {
  const [quesitos, votos] = await Promise.all([
    getQuesitosParaEvento(eventoId),
    getVotosDoEvento(eventoId, candidataId)
  ]);
  return quesitos.sort((a, b) => a.ordem - b.ordem).map((q) => ({
    quesito: q.nome,
    quesitoId: q.id,
    votos: marcarDescartes(votos.filter((v) => v.quesito_id === q.id), regraDescarte)
  }));
}

async function getCandidateAudit(body) {
  const evento = await getEvento(body.event_id);
  const detalhamento = await computeDetalhamento(body.event_id, body.id_candidata, (evento.regras || REGRAS_PADRAO).regraDescarte);
  return { success: true, detalhamento };
}

async function finalizeAudit(body) {
  const { data: cand } = await supabase.from('evento_candidatas').select('*').eq('evento_id', body.event_id).eq('id', body.id_candidata).maybeSingle();
  await supabase.from('evento_candidatas').update({ status_auditoria: 'AUDITADA' }).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  await registrarLog(body.event_id, 'FINALIZE_AUDIT', body.usuario, body.perfil, cand ? cand.nome : body.id_candidata);
  return { success: true, message: 'Candidata auditada' };
}

async function getValidatedTable(body) {
  const evento = await getEvento(body.event_id);
  const [quesitos, candidatas] = await Promise.all([getQuesitosParaEvento(body.event_id), getCandidatasDoEvento(body.event_id)]);
  const auditadas = candidatas.filter((c) => c.status_auditoria === 'AUDITADA');

  const comDetalhe = await Promise.all(auditadas.map(async (c) => ({
    id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado,
    detalhamento: await computeDetalhamento(body.event_id, c.id, (evento.regras || REGRAS_PADRAO).regraDescarte)
  })));

  return { success: true, quesitos, candidatas: comDetalhe };
}

async function getOfficialRanking(body) {
  const evento = await getEvento(body.event_id);
  const [quesitos, candidatasTodas, votos] = await Promise.all([
    getQuesitosParaEvento(body.event_id), getCandidatasDoEvento(body.event_id), getVotosDoEvento(body.event_id)
  ]);
  const auditadas = candidatasTodas.filter((c) => c.status_auditoria === 'AUDITADA');
  return { success: true, ranking: gerarRanking(auditadas, votos, quesitos, evento.regras || REGRAS_PADRAO) };
}

async function getScoreboard(body) {
  const evento = await getEvento(body.event_id);
  const [quesitos, candidatas, votos] = await Promise.all([
    getQuesitosParaEvento(body.event_id), getCandidatasDoEvento(body.event_id), getVotosDoEvento(body.event_id)
  ]);
  return { success: true, ranking: gerarRanking(candidatas, votos, quesitos, evento.regras || REGRAS_PADRAO) };
}

/* ============================= correções ============================= */

async function requestCorrection(body) {
  const perfil = String(body.perfil || '').toUpperCase();
  if (!['PRESIDENTE DE MESA', 'ADMIN', 'CONSULTOR'].includes(perfil)) return { success: false, message: 'Acesso negado' };

  const loginAvaliador = String(body.login_avaliador || '').toLowerCase();

  const { data: pendentes } = await supabase.from('correcoes').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata)
    .ilike('login_avaliador', loginAvaliador).eq('quesito_id', body.id_quesito).eq('status', 'PENDENTE_CORRECAO');
  if (pendentes && pendentes.length) return { success: false, message: 'Já existe correção pendente para este quesito' };

  const { data: votoOriginal } = await supabase.from('votos').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata)
    .ilike('login', loginAvaliador).eq('quesito_id', body.id_quesito).maybeSingle();
  if (!votoOriginal) return { success: false, message: 'Voto do avaliador não encontrado' };

  const id = 'COR-' + Date.now();
  await supabase.from('correcoes').insert({
    id, evento_id: body.event_id, candidata_id: body.id_candidata, login_avaliador: loginAvaliador,
    nome_avaliador: votoOriginal.avaliador_nome, quesito_id: body.id_quesito,
    nota_antes: votoOriginal.nota, justificativa_antes: votoOriginal.justificativa,
    motivo: body.motivo, status: 'PENDENTE_CORRECAO', questionada_por: body.usuario || perfil
  });

  await registrarLog(body.event_id, 'REQUEST_CORRECTION', body.usuario, body.perfil, 'Correção solicitada / quesito ' + body.id_quesito);
  return { success: true, message: 'Correção solicitada com sucesso' };
}

async function getMyPendingCorrections(body) {
  const { data, error } = await supabase.from('correcoes').select('*')
    .eq('evento_id', body.event_id).ilike('login_avaliador', body.login).eq('status', 'PENDENTE_CORRECAO');
  if (error) throw error;
  return { success: true, correcoes: (data || []).map(mapCorrecao) };
}

function mapCorrecao(c) {
  return {
    id: c.id, idCandidata: c.candidata_id, loginAvaliador: c.login_avaliador, nomeAvaliador: c.nome_avaliador,
    idQuesito: c.quesito_id, notaAntes: c.nota_antes, notaDepois: c.nota_depois, motivo: c.motivo, status: c.status
  };
}

async function submitCorrection(body) {
  const { error } = await supabase.from('correcoes').update({
    nota_depois: body.nota, justificativa_depois: body.justificativa, status: 'CORRIGIDA'
  }).eq('id', body.id_correcao);
  if (error) throw error;
  return { success: true, message: 'Correção enviada para validação' };
}

async function validateCorrection(body) {
  const { data: corr } = await supabase.from('correcoes').select('*').eq('id', body.id_correcao).maybeSingle();
  if (!corr) return { success: false, message: 'Correção não encontrada' };

  await supabase.from('correcoes').update({ status: 'VALIDADA' }).eq('id', body.id_correcao);
  await supabase.from('votos').update({ nota: corr.nota_depois, justificativa: corr.justificativa_depois })
    .eq('evento_id', corr.evento_id).eq('candidata_id', corr.candidata_id)
    .ilike('login', corr.login_avaliador).eq('quesito_id', corr.quesito_id);

  await registrarLog(corr.evento_id, 'VALIDATE_CORRECTION', body.usuario, body.perfil, 'Correção validada');
  return { success: true, message: 'Correção validada' };
}

async function cancelCorrection(body) {
  await supabase.from('correcoes').delete().eq('id', body.id_correcao);
  return { success: true, message: 'Correção cancelada' };
}

async function getAllCorrections(body) {
  const { data, error } = await supabase.from('correcoes').select('*').eq('evento_id', body.event_id).order('criado_em', { ascending: false });
  if (error) throw error;
  return { success: true, correcoes: (data || []).map(mapCorrecao) };
}

/* ============================= logs / encerramento ============================= */

async function getLogs(body) {
  const { data, error } = await supabase.from('logs').select('*').eq('evento_id', body.event_id).order('data', { ascending: false }).limit(200);
  if (error) throw error;
  return { success: true, logs: (data || []).map((l) => ({ data: l.data, acao: l.acao, usuario: l.usuario, perfil: l.perfil, detalhe: l.detalhe })) };
}

async function finalizarConcurso(body) {
  const [rankingRes, recebidasRes, validadasRes, correcoesRes] = await Promise.all([
    getOfficialRanking(body), getReceivedNotes(body), getValidatedTable(body), getAllCorrections(body)
  ]);

  await supabase.from('encerramentos').insert([
    { evento_id: body.event_id, tipo: 'RANKING_FINAL', conteudo: rankingRes.ranking },
    { evento_id: body.event_id, tipo: 'NOTAS_RECEBIDAS', conteudo: recebidasRes.candidatas },
    { evento_id: body.event_id, tipo: 'NOTAS_VALIDADAS', conteudo: validadasRes.candidatas },
    { evento_id: body.event_id, tipo: 'CORRECOES', conteudo: correcoesRes.correcoes }
  ]);

  await supabase.from('eventos').update({ status_concurso: 'FINALIZADO' }).eq('id', body.event_id);
  await registrarLog(body.event_id, 'FINALIZAR_CONCURSO', body.usuario, body.perfil, 'Concurso encerrado');
  return { success: true, message: 'Concurso encerrado com sucesso' };
}

/* ============================= telão ============================= */

async function getTelaoNotes(body) {
  const evento = await getEvento(body.event_id);
  const rankingRes = await getOfficialRanking(body);
  return { success: true, ranking: rankingRes.ranking, revealIndex: evento.reveal_index || 0 };
}

async function getTelaoRevealState(body) {
  const evento = await getEvento(body.event_id);
  return { success: true, revealIndex: evento.reveal_index || 0 };
}

async function setTelaoRevealIndex(body) {
  await supabase.from('eventos').update({ reveal_index: body.index }).eq('id', body.event_id);
  return { success: true };
}

/* ============================= admin ============================= */

async function adminListEventos(body) {
  let q = supabase.from('eventos').select('*');
  if (body && body.cliente_id) q = q.eq('cliente_id', body.cliente_id);
  const { data: eventos, error } = await q;
  if (error) throw error;
  const resultado = await Promise.all((eventos || []).map(async (e) => {
    const [candidatas, quesitos] = await Promise.all([getCandidatasDoEvento(e.id), getQuesitosParaEvento(e.id)]);
    return { id: e.id, nome: e.nome, statusConcurso: e.status_concurso, dataInicio: e.data_inicio, dataFim: e.data_fim, candidatas: candidatas.length, quesitos: quesitos.length };
  }));
  return { success: true, eventos: resultado };
}

async function adminCreateEvento(body) {
  if (!body.cliente_id) return { success: false, message: 'Cliente não informado' };
  const id = 'evt-' + Date.now();
  const { error } = await supabase.from('eventos').insert({
    id, nome: body.nome, cliente_id: body.cliente_id, status_concurso: 'A_INICIAR',
    status_sistema: 'AGUARDANDO', reveal_index: 0, regras: REGRAS_PADRAO
  });
  if (error) throw error;
  return { success: true, message: 'Evento criado', id };
}

async function adminListUsuarios(body) {
  let q = supabase.from('usuarios').select('*');
  if (body && body.cliente_id) q = q.eq('cliente_id', body.cliente_id);
  const { data: usuarios, error } = await q;
  if (error) throw error;
  const { data: vinculos } = await supabase.from('usuario_eventos').select('*');
  const map = {};
  (vinculos || []).forEach((v) => { (map[v.codigo] = map[v.codigo] || []).push(v.evento_id); });
  return { success: true, usuarios: (usuarios || []).map((u) => ({ codigo: u.codigo, nome: u.nome, perfil: u.perfil, ativo: u.ativo, clienteId: u.cliente_id, eventos: map[u.codigo] || [] })) };
}

async function adminSaveUsuario(body) {
  const codigo = String(body.codigo).trim().toUpperCase();
  const ativo = body.ativo !== false;

  const { error } = await supabase.from('usuarios').upsert({ codigo, nome: body.nome, perfil: body.perfil, ativo, cliente_id: body.clienteId || body.cliente_id || null });
  if (error) throw error;

  await supabase.from('usuario_eventos').delete().eq('codigo', codigo);
  const eventos = body.eventos || [];
  if (eventos.length) {
    await supabase.from('usuario_eventos').insert(eventos.map((eid) => ({ codigo, evento_id: eid })));
  }

  return { success: true, message: 'Usuário salvo' };
}

async function adminRemoveUsuario(body) {
  await supabase.from('usuarios').delete().eq('codigo', body.codigo);
  return { success: true, message: 'Usuário removido' };
}

// Troca o código de acesso de um usuário sem violar a referência em
// usuario_eventos — roda como uma função de banco (transação única).
async function trocarCodigoUsuario(body) {
  const codigoAntigo = String(body.codigoAntigo || '').trim().toUpperCase();
  const codigoNovo = String(body.codigoNovo || '').trim().toUpperCase();
  if (!codigoAntigo || !codigoNovo) return { success: false, message: 'Informe o código atual e o novo código.' };

  const { error } = await supabase.rpc('trocar_codigo_usuario', { old_codigo: codigoAntigo, new_codigo: codigoNovo });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Código de acesso atualizado com sucesso' };
}

async function adminSaveQuesitos(body) {
  const quesitos = body.quesitos || [];
  const ids = quesitos.map((q) => q.id);
  const clienteId = body.cliente_id;

  let del = supabase.from('quesitos_globais').delete().not('id', 'in', `(${ids.join(',') || 'null'})`);
  if (clienteId) del = del.eq('cliente_id', clienteId);
  await del;

  await supabase.from('quesitos_globais').upsert(quesitos.map((q) => ({
    id: q.id, nome: q.nome, peso: q.peso, ordem: q.ordem, valido_para_todos: q.validoParaTodos !== false, cliente_id: clienteId
  })));

  await supabase.from('quesito_eventos').delete().in('quesito_id', ids.length ? ids : ['__none__']);
  const novosVinculos = [];
  quesitos.forEach((q) => {
    if (q.validoParaTodos === false) (q.eventos || []).forEach((eid) => novosVinculos.push({ quesito_id: q.id, evento_id: eid }));
  });
  if (novosVinculos.length) await supabase.from('quesito_eventos').insert(novosVinculos);

  return { success: true, message: 'Quesitos atualizados' };
}

async function adminSaveCandidatas(body) {
  const grupos = body.grupos || [];
  const clienteId = body.cliente_id;
  const { error } = await supabase.from('grupos_candidatas').upsert(grupos.map((g) => ({ id: g.id, nome: g.nome, cidade: g.cidade || '', estado: g.estado || '', cliente_id: clienteId })));
  if (error) throw error;
  return { success: true, message: 'Grupos atualizados' };
}

async function adminGetEventoConfig(body) {
  const evento = await getEvento(body.event_id);
  if (!evento) return { success: false, message: 'Evento não encontrado' };
  const candidatas = await getCandidatasDoEvento(body.event_id);
  return {
    success: true, nome: evento.nome, dataInicio: evento.data_inicio, dataFim: evento.data_fim,
    regras: evento.regras || REGRAS_PADRAO, grupoIds: candidatas.map((c) => c.id)
  };
}

async function adminSaveEventoConfig(body) {
  const patch = { regras: body.regras || REGRAS_PADRAO };
  if (body.nome) patch.nome = body.nome;
  if (body.dataInicio !== undefined) patch.data_inicio = body.dataInicio || null;
  if (body.dataFim !== undefined) patch.data_fim = body.dataFim || null;
  await supabase.from('eventos').update(patch).eq('id', body.event_id);

  if (body.grupoIds) {
    const atuais = await getCandidatasDoEvento(body.event_id);
    const novosIds = body.grupoIds;

    const saíram = atuais.filter((c) => !novosIds.includes(c.id)).map((c) => c.id);
    if (saíram.length) await supabase.from('evento_candidatas').delete().eq('evento_id', body.event_id).in('id', saíram);

    const jaPresentes = new Set(atuais.filter((c) => novosIds.includes(c.id)).map((c) => c.id));
    const { data: todosGrupos } = await supabase.from('grupos_candidatas').select('*').in('id', novosIds);
    let proximaOrdem = jaPresentes.size;

    const novasLinhas = [];
    novosIds.forEach((gid) => {
      if (jaPresentes.has(gid)) return;
      const grupo = (todosGrupos || []).find((g) => g.id === gid);
      if (!grupo) return;
      proximaOrdem += 1;
      novasLinhas.push({
        evento_id: body.event_id, id: grupo.id, nome: grupo.nome, cidade: grupo.cidade, estado: grupo.estado,
        disponibilidade: 'DISPONIVEL', status_avaliacao: 'PENDENTE', ordem: proximaOrdem, flag_especial: '', status_auditoria: 'PENDENTE'
      });
    });
    if (novasLinhas.length) await supabase.from('evento_candidatas').insert(novasLinhas);
  }

  await registrarLog(body.event_id, 'ADMIN_SAVE_EVENTO_CONFIG', body.usuario, body.perfil, 'Configurações do evento atualizadas');
  return { success: true, message: 'Configurações do evento salvas' };
}

async function adminSetStatusConcurso(body) {
  await supabase.from('eventos').update({ status_concurso: body.status }).eq('id', body.event_id);
  return { success: true, message: 'Status do concurso atualizado' };
}

/* ============================= master (clientes / licenças) ============================= */

async function masterListClientes() {
  const { data, error } = await supabase.from('clientes').select('*').order('nome');
  if (error) throw error;
  const hoje = new Date();
  return {
    success: true,
    clientes: (data || []).map((c) => {
      const expirada = c.data_validade_licenca && new Date(c.data_validade_licenca) < hoje;
      return {
        id: c.id, nome: c.nome, dataValidadeLicenca: c.data_validade_licenca, ativo: c.ativo,
        statusLicenca: !c.ativo ? 'DESATIVADO' : (expirada ? 'EXPIRADA' : 'ATIVA')
      };
    })
  };
}

async function masterSaveCliente(body) {
  const id = body.id || ('cli-' + Date.now());
  const { error } = await supabase.from('clientes').upsert({
    id, nome: body.nome, data_validade_licenca: body.dataValidadeLicenca || null, ativo: body.ativo !== false
  });
  if (error) throw error;
  return { success: true, message: 'Grupo de clientes salvo', id };
}
