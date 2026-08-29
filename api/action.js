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
const { hashSenha, verificarSenha } = require('../lib/auth');

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
    case 'redefinir_senha': return redefinirSenha(body);
    case 'salvar_rascunho': return salvarRascunho(body);
    case 'get_rascunho': return getRascunho(body);
    case 'marcar_avaliador_problema': return marcarAvaliadorProblema(body);
    case 'reabrir_avaliacao': return reabrirAvaliacao(body);

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
    case 'reopen_audit': return reopenAudit(body);
    case 'get_validated_table': return getValidatedTable(body);
    case 'get_official_ranking': return getOfficialRanking(body);
    case 'get_scoreboard':
    case 'get_apuracao_live': return getScoreboard(body);

    case 'request_correction': return requestCorrection(body);
    case 'validar_nota_direto': return validarNotaDireto(body);
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

// Uma candidata entra no ranking/notas validadas automaticamente quando:
// (1) o presidente já encerrou a avaliação dela (FINALIZADA), e
// (2) não há nenhum questionamento em aberto (pendente de resposta do
//     avaliador, ou já corrigido mas ainda não validado pelo presidente).
// Isso substitui o antigo botão manual "Marcar como auditada" — assim
// que a última correção pendente é validada, a candidata já aparece.
async function candidataEstaCompleta(eventoId, candidataId) {
  const { data: cand } = await supabase.from('evento_candidatas').select('status_avaliacao').eq('evento_id', eventoId).eq('id', candidataId).maybeSingle();
  if (!cand || cand.status_avaliacao !== 'FINALIZADA') return false;

  const { data: pendentes } = await supabase.from('correcoes').select('id')
    .eq('evento_id', eventoId).eq('candidata_id', candidataId).in('status', ['PENDENTE_CORRECAO', 'CORRIGIDA']);
  return !(pendentes && pendentes.length);
}

async function getCandidatasCompletas(eventoId) {
  const candidatas = await getCandidatasDoEvento(eventoId);
  const finalizadas = candidatas.filter((c) => c.status_avaliacao === 'FINALIZADA');
  if (!finalizadas.length) return [];

  const { data: pendentes } = await supabase.from('correcoes').select('candidata_id')
    .eq('evento_id', eventoId).in('status', ['PENDENTE_CORRECAO', 'CORRIGIDA']);
  const idsComPendencia = new Set((pendentes || []).map((p) => p.candidata_id));
  return finalizadas.filter((c) => !idsComPendencia.has(c.id));
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

  // Só o avaliador loga só com código. Os demais perfis (master, admin,
  // presidente, consultor) agora também precisam de senha.
  if (usuario.perfil !== 'avaliador') {
    if (!usuario.senha_hash) {
      return { success: false, message: 'Este usuário ainda não tem senha definida. Peça ao administrador para redefinir sua senha.' };
    }
    if (!verificarSenha(String(body.senha || ''), usuario.senha_hash)) {
      return { success: false, message: 'Código ou senha incorretos.' };
    }
  }

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

async function redefinirSenha(body) {
  const perfilQuemPede = String(body.perfil || '').toLowerCase();
  if (!['master', 'admin'].includes(perfilQuemPede)) return { success: false, message: 'Acesso negado' };

  const alvo = await getUsuarioPorCodigo(String(body.codigo || '').trim());
  if (!alvo) return { success: false, message: 'Usuário não encontrado' };
  if (alvo.perfil === 'avaliador') return { success: false, message: 'Avaliadores não usam senha — só código de acesso.' };

  // admin só pode redefinir senha de usuários do próprio cliente
  if (perfilQuemPede === 'admin' && alvo.cliente_id !== body.cliente_id) {
    return { success: false, message: 'Você só pode redefinir a senha de usuários do seu próprio grupo.' };
  }

  const novaSenha = String(body.novaSenha || '');
  if (novaSenha.length < 6) return { success: false, message: 'A nova senha precisa ter pelo menos 6 caracteres.' };

  const { error } = await supabase.from('usuarios').update({ senha_hash: hashSenha(novaSenha) }).eq('codigo', alvo.codigo);
  if (error) return { success: false, message: 'Erro ao redefinir senha: ' + error.message };

  if (alvo.eventos && alvo.eventos[0]) {
    await registrarLog(alvo.eventos[0], 'RESET_PASSWORD', body.usuario, body.perfil, `Senha de ${alvo.codigo} redefinida por ${body.usuario || perfilQuemPede}`);
  }
  return { success: true, message: 'Senha redefinida com sucesso.' };
}

/* ============================= quesitos / status ============================= */

async function getQuesitosVisiveisParaLogin(eventoId, login) {
  const quesitos = await getQuesitosParaEvento(eventoId);
  if (!login) return quesitos;

  const usuario = await getUsuarioPorCodigo(login);
  if (!usuario || !usuario.avaliador_individual) return quesitos;

  const { data, error } = await supabase.from('usuario_evento_quesitos').select('quesito_id').eq('codigo', usuario.codigo).eq('evento_id', eventoId);
  if (error) throw error;
  const permitidos = new Set((data || []).map((r) => r.quesito_id));
  return quesitos.filter((q) => permitidos.has(q.id));
}

async function getQuesitos(body) {
  return { success: true, quesitos: await getQuesitosVisiveisParaLogin(body.event_id, body.login) };
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

  const jaCompleta = await candidataEstaCompleta(body.event_id, body.id_candidata);
  if (jaCompleta) {
    return { success: false, message: 'Esta candidata já está com todas as notas validadas e faz parte do ranking oficial. Abra um novo questionamento nela pra poder alterar o status de novo.' };
  }

  const flag = String(body.flag || '').toUpperCase();
  const patch = flag === 'DESISTENTE' || flag === 'DESCLASSIFICADA'
    ? { flag_especial: flag, disponibilidade: 'NAO_DISPONIVEL', status_avaliacao: flag }
    : { flag_especial: '', disponibilidade: 'DISPONIVEL' };

  if (flag !== 'DESISTENTE' && flag !== 'DESCLASSIFICADA') {
    // Reativando: volta pra fila, a não ser que já tivesse sido finalizada
    // antes de ser desclassificada/desistente (aí preserva o FINALIZADA).
    const { data: atual } = await supabase.from('evento_candidatas').select('status_avaliacao').eq('evento_id', body.event_id).eq('id', body.id_candidata).maybeSingle();
    patch.status_avaliacao = (atual && atual.status_avaliacao === 'FINALIZADA') ? 'FINALIZADA' : 'PENDENTE';
  }

  await supabase.from('evento_candidatas').update(patch).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  await registrarLog(body.event_id, 'SET_CANDIDATE_FLAG', body.usuario, body.perfil, body.id_candidata + ' -> ' + (flag || 'SEM_FLAG'));
  return { success: true, message: 'Flag atualizada com sucesso' };
}

/* ============================= votos ============================= */

async function salvarRascunho(body) {
  const login = String(body.login || '').trim();
  if (!login) return { success: false, message: 'Login obrigatório' };

  const linhas = Object.keys(body.notas || {}).map((qid) => ({
    evento_id: body.event_id, candidata_id: body.id_candidata, codigo: login, quesito_id: qid,
    nota: body.notas[qid] !== undefined && body.notas[qid] !== null && body.notas[qid] !== '' ? body.notas[qid] : null,
    justificativa: (body.just || {})[qid] || '', atualizado_em: new Date().toISOString()
  }));
  if (!linhas.length) return { success: true };

  const { error } = await supabase.from('rascunhos_voto').upsert(linhas, { onConflict: 'evento_id,candidata_id,codigo,quesito_id' });
  if (error) return { success: false, message: 'Erro ao salvar rascunho: ' + error.message };
  return { success: true };
}

async function getRascunho(body) {
  const { data, error } = await supabase.from('rascunhos_voto').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata).ilike('codigo', body.login);
  if (error) throw error;
  const notas = {}, justificativas = {};
  (data || []).forEach((r) => { notas[r.quesito_id] = r.nota; justificativas[r.quesito_id] = r.justificativa; });
  return { success: true, notas, justificativas };
}

async function limparRascunho(eventoId, candidataId, login) {
  await supabase.from('rascunhos_voto').delete().eq('evento_id', eventoId).eq('candidata_id', candidataId).ilike('codigo', login);
}

async function marcarAvaliadorProblema(body) {
  const perfil = String(body.perfil || '').toUpperCase();
  if (perfil !== 'ADMIN') return { success: false, message: 'Acesso negado' };

  const codigo = String(body.codigo || '').trim();
  const motivo = String(body.motivo || '').trim();
  if (!motivo) return { success: false, message: 'Informe o motivo.' };

  const comProblema = body.comProblema !== false;

  const { error: e1 } = await supabase.from('usuarios').update({
    com_problema: comProblema, motivo_problema: comProblema ? motivo : null
  }).eq('codigo', codigo);
  if (e1) return { success: false, message: 'Erro ao atualizar usuário: ' + e1.message };

  if (!comProblema) {
    return { success: true, message: 'Avaliador reativado. Nenhuma nota mínima automática foi aplicada retroativamente.' };
  }

  // Preenche nota mínima em todos os quesitos de todas as candidatas do
  // evento informado, SÓ onde esse avaliador ainda não tinha votado —
  // votos já registrados não são sobrescritos.
  const eventoId = body.event_id;
  if (!eventoId) return { success: true, message: 'Avaliador marcado como indisponível.' };

  const evento = await getEvento(eventoId);
  const regras = (evento && evento.regras) || REGRAS_PADRAO;
  const notaMinima = regras.notaMin;

  const [candidatas, quesitos, votosExistentes] = await Promise.all([
    getCandidatasDoEvento(eventoId),
    getQuesitosParaEvento(eventoId),
    getVotosDoEvento(eventoId)
  ]);

  const jaVotou = new Set(votosExistentes.filter((v) => v.login.toUpperCase() === codigo.toUpperCase()).map((v) => v.candidata_id + '::' + v.quesito_id));

  const linhas = [];
  candidatas.forEach((c) => {
    quesitos.forEach((q) => {
      const chave = c.id + '::' + q.id;
      if (jaVotou.has(chave)) return;
      linhas.push({
        evento_id: eventoId, candidata_id: c.id, login: codigo, avaliador_nome: body.nomeAvaliador || codigo,
        perfil: 'AVALIADOR', quesito_id: q.id, nota: notaMinima,
        justificativa: `Nota mínima aplicada automaticamente — avaliador indisponível. Motivo: ${motivo}`, assinatura: ''
      });
    });
  });

  if (linhas.length) {
    const { error: e2 } = await supabase.from('votos').upsert(linhas, { onConflict: 'evento_id,candidata_id,login,quesito_id' });
    if (e2) return { success: false, message: 'Usuário marcado, mas houve erro ao aplicar as notas mínimas: ' + e2.message };
  }

  await registrarLog(eventoId, 'MARK_AVALIADOR_PROBLEMA', body.usuario, body.perfil, `Avaliador ${codigo} marcado como indisponível — motivo: ${motivo}. ${linhas.length} nota(s) mínima(s) aplicada(s) automaticamente.`);
  return { success: true, message: `Avaliador marcado como indisponível. ${linhas.length} nota(s) mínima(s) foram preenchidas automaticamente.` };
}

async function reabrirAvaliacao(body) {
  const perfil = String(body.perfil || '').toUpperCase();
  if (!['PRESIDENTE DE MESA', 'ADMIN'].includes(perfil)) return { success: false, message: 'Acesso negado' };

  const jaCompleta = await candidataEstaCompleta(body.event_id, body.id_candidata);
  if (jaCompleta) {
    return { success: false, message: 'Esta candidata já está com todas as notas validadas e faz parte do ranking oficial. Abra um novo questionamento nela pra poder reabrir a avaliação.' };
  }

  const { data: cand } = await supabase.from('evento_candidatas').select('*').eq('evento_id', body.event_id).eq('id', body.id_candidata).maybeSingle();
  if (!cand) return { success: false, message: 'Candidata não encontrada' };

  const { error } = await supabase.from('evento_candidatas').update({ status_avaliacao: 'PENDENTE' }).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  if (error) return { success: false, message: 'Erro ao reabrir: ' + error.message };

  await registrarLog(body.event_id, 'REOPEN_EVALUATION', body.usuario, body.perfil, `Avaliação de "${cand.nome}" reaberta (estava finalizada).`);
  return { success: true, message: 'Avaliação reaberta — a candidata voltou para a fila.' };
}

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

  const quesitos = await getQuesitosVisiveisParaLogin(body.event_id, body.login);
  const linhas = [];

  for (const q of quesitos) {
    const nota = normalizarNota(body.notas[q.id], regras);
    const just = String((body.just || {})[q.id] || '').trim();
    if (nota === null) return { success: false, message: `Nota inválida para o quesito ${q.nome}.` };
    const obrigatoria = regras.justificativaObrigatoria !== false;
    const maxChars = regras.maxCaracteresJustificativa || 500;
    if (obrigatoria && just.length === 0) return { success: false, message: `Justificativa obrigatória para o quesito ${q.nome}.` };
    if (just.length > maxChars) return { success: false, message: `Justificativa do quesito ${q.nome} excede o máximo de ${maxChars} caracteres.` };
    linhas.push({
      evento_id: body.event_id, candidata_id: body.id_candidata, login: body.login, avaliador_nome: body.avaliador,
      perfil: body.perfil, quesito_id: q.id, nota, justificativa: just, assinatura: body.assinatura || ''
    });
  }

  const { error } = await supabase.from('votos').upsert(linhas, { onConflict: 'evento_id,candidata_id,login,quesito_id' });
  if (error) throw error;

  await limparRascunho(body.event_id, body.id_candidata, body.login);
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
      id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, statusAvaliacao: c.status_avaliacao,
      votos: votos.filter((v) => v.candidata_id === c.id)
        .map((v) => ({ avaliador: v.login, avaliadorNome: v.avaliador_nome, quesitoId: v.quesito_id, nota: v.nota, justificativa: v.justificativa, assinatura: v.assinatura }))
    }))
  };
}

async function getAuditoriaCandidates(body) {
  const candidatas = await getCandidatasDoEvento(body.event_id);
  const finalizadas = candidatas.filter((c) => c.status_avaliacao === 'FINALIZADA');
  const completas = await getCandidatasCompletas(body.event_id);
  const idsCompletos = new Set(completas.map((c) => c.id));
  return {
    success: true,
    candidatas: finalizadas.map((c) => ({ ...mapCandidata(c), completa: idsCompletos.has(c.id) }))
  };
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

async function reopenAudit(body) {
  const perfil = String(body.perfil || '').toUpperCase();
  if (!['PRESIDENTE DE MESA', 'ADMIN'].includes(perfil)) return { success: false, message: 'Acesso negado' };

  const { data: cand } = await supabase.from('evento_candidatas').select('*').eq('evento_id', body.event_id).eq('id', body.id_candidata).maybeSingle();
  if (!cand) return { success: false, message: 'Candidata não encontrada' };

  const { error } = await supabase.from('evento_candidatas').update({ status_auditoria: 'PENDENTE' }).eq('evento_id', body.event_id).eq('id', body.id_candidata);
  if (error) return { success: false, message: 'Erro ao reabrir auditoria: ' + error.message };

  await registrarLog(body.event_id, 'REOPEN_AUDIT', body.usuario, body.perfil, `Auditoria de "${cand.nome}" reaberta — a candidata saiu do ranking oficial até ser auditada de novo.`);
  return { success: true, message: 'Auditoria reaberta. A candidata saiu do ranking oficial até ser auditada novamente.' };
}

async function getValidatedTable(body) {
  const evento = await getEvento(body.event_id);
  const [quesitos, completas] = await Promise.all([getQuesitosParaEvento(body.event_id), getCandidatasCompletas(body.event_id)]);

  const comDetalhe = await Promise.all(completas.map(async (c) => ({
    id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado,
    detalhamento: await computeDetalhamento(body.event_id, c.id, (evento.regras || REGRAS_PADRAO).regraDescarte)
  })));

  return { success: true, quesitos, candidatas: comDetalhe };
}

async function getOfficialRanking(body) {
  const evento = await getEvento(body.event_id);
  const [quesitos, completas, votos] = await Promise.all([
    getQuesitosParaEvento(body.event_id), getCandidatasCompletas(body.event_id), getVotosDoEvento(body.event_id)
  ]);
  return { success: true, ranking: gerarRanking(completas, votos, quesitos, evento.regras || REGRAS_PADRAO) };
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

  const { data: existentes } = await supabase.from('correcoes').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata)
    .ilike('login_avaliador', loginAvaliador).eq('quesito_id', body.id_quesito);
  if (existentes && existentes.length) return { success: false, message: 'Este quesito já foi questionado antes para este avaliador. Cancele o questionamento anterior (só é possível antes do avaliador responder) para questionar de novo.' };

  const { data: votoOriginal } = await supabase.from('votos').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata)
    .ilike('login', loginAvaliador).eq('quesito_id', body.id_quesito).maybeSingle();
  if (!votoOriginal) return { success: false, message: 'Voto do avaliador não encontrado' };

  const id = 'COR-' + Date.now();
  const { error } = await supabase.from('correcoes').insert({
    id, evento_id: body.event_id, candidata_id: body.id_candidata, login_avaliador: loginAvaliador,
    nome_avaliador: votoOriginal.avaliador_nome, quesito_id: body.id_quesito,
    nota_antes: votoOriginal.nota, justificativa_antes: votoOriginal.justificativa,
    motivo: body.motivo, status: 'PENDENTE_CORRECAO', questionada_por: body.usuario || perfil
  });
  if (error) return { success: false, message: 'Erro ao solicitar correção: ' + error.message };

  await registrarLog(body.event_id, 'REQUEST_CORRECTION', body.usuario, body.perfil, 'Correção solicitada / quesito ' + body.id_quesito);
  return { success: true, message: 'Correção solicitada com sucesso' };
}

async function validarNotaDireto(body) {
  const perfil = String(body.perfil || '').toUpperCase();
  if (!['PRESIDENTE DE MESA', 'ADMIN'].includes(perfil)) return { success: false, message: 'Acesso negado' };

  const loginAvaliador = String(body.login_avaliador || '').toLowerCase();

  const { data: existentes } = await supabase.from('correcoes').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata)
    .ilike('login_avaliador', loginAvaliador).eq('quesito_id', body.id_quesito);
  if (existentes && existentes.length) return { success: false, message: 'Este quesito já foi questionado antes para este avaliador.' };

  const { data: voto } = await supabase.from('votos').select('*')
    .eq('evento_id', body.event_id).eq('candidata_id', body.id_candidata)
    .ilike('login', loginAvaliador).eq('quesito_id', body.id_quesito).maybeSingle();
  if (!voto) return { success: false, message: 'Voto não encontrado' };

  const id = 'COR-' + Date.now();
  const { error } = await supabase.from('correcoes').insert({
    id, evento_id: body.event_id, candidata_id: body.id_candidata, login_avaliador: loginAvaliador,
    nome_avaliador: voto.avaliador_nome, quesito_id: body.id_quesito,
    nota_antes: voto.nota, justificativa_antes: voto.justificativa,
    nota_depois: voto.nota, justificativa_depois: voto.justificativa,
    motivo: 'Validado diretamente pelo presidente de mesa, sem questionamento.',
    status: 'VALIDADA', questionada_por: body.usuario || perfil
  });
  if (error) return { success: false, message: 'Erro ao validar: ' + error.message };

  await registrarLog(body.event_id, 'VALIDATE_DIRECT', body.usuario, body.perfil, `Nota do quesito ${body.id_quesito} validada diretamente, sem questionamento`);
  return { success: true, message: 'Nota validada com sucesso' };
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
    idQuesito: c.quesito_id, notaAntes: c.nota_antes, notaDepois: c.nota_depois,
    justificativaAntes: c.justificativa_antes, justificativaDepois: c.justificativa_depois,
    motivo: c.motivo, motivoResposta: c.motivo_resposta, status: c.status
  };
}

async function submitCorrection(body) {
  if (body.tipo === 'confirmar') {
    const { data: corr } = await supabase.from('correcoes').select('*').eq('id', body.id_correcao).maybeSingle();
    if (!corr) return { success: false, message: 'Correção não encontrada' };

    // nota_depois/justificativa_depois iguais às originais — assim, quando o
    // presidente validar, a atualização no voto é um "no-op" seguro (não
    // apaga nada), mesmo que nada tenha mudado de verdade.
    const { error } = await supabase.from('correcoes').update({
      status: 'CONFIRMADA', motivo_resposta: 'Avaliador confirmou que a nota original está correta.',
      nota_depois: corr.nota_antes, justificativa_depois: corr.justificativa_antes
    }).eq('id', body.id_correcao);
    if (error) return { success: false, message: 'Erro ao confirmar: ' + error.message };

    await registrarLog(corr.evento_id, 'CONFIRM_CORRECTION', body.usuario, body.perfil, `Avaliador confirmou nota original do quesito ${corr.quesito_id}`);
    return { success: true, message: 'Confirmado — a nota original permanece.' };
  }

  const { data: corrAntes } = await supabase.from('correcoes').select('*').eq('id', body.id_correcao).maybeSingle();
  if (!corrAntes) return { success: false, message: 'Correção não encontrada' };

  const { error } = await supabase.from('correcoes').update({
    nota_depois: body.nota, justificativa_depois: body.justificativa,
    motivo_resposta: body.motivoResposta || '', status: 'CORRIGIDA'
  }).eq('id', body.id_correcao);
  if (error) return { success: false, message: 'Erro ao enviar correção: ' + error.message };

  await registrarLog(corrAntes.evento_id, 'SUBMIT_CORRECTION', body.usuario, body.perfil, `Avaliador corrigiu quesito ${corrAntes.quesito_id} — motivo: ${body.motivoResposta || ''}`);
  return { success: true, message: 'Correção enviada para validação' };
}

async function validateCorrection(body) {
  const { data: corr } = await supabase.from('correcoes').select('*').eq('id', body.id_correcao).maybeSingle();
  if (!corr) return { success: false, message: 'Correção não encontrada' };

  const { error: e1 } = await supabase.from('correcoes').update({ status: 'VALIDADA' }).eq('id', body.id_correcao);
  if (e1) return { success: false, message: 'Erro ao validar: ' + e1.message };

  const { error: e2 } = await supabase.from('votos').update({ nota: corr.nota_depois, justificativa: corr.justificativa_depois })
    .eq('evento_id', corr.evento_id).eq('candidata_id', corr.candidata_id)
    .ilike('login', corr.login_avaliador).eq('quesito_id', corr.quesito_id);
  if (e2) return { success: false, message: 'Correção marcada como validada, mas houve erro ao atualizar o voto: ' + e2.message };

  await registrarLog(corr.evento_id, 'VALIDATE_CORRECTION', body.usuario, body.perfil, 'Correção validada');
  return { success: true, message: 'Correção validada' };
}

async function cancelCorrection(body) {
  const { error } = await supabase.from('correcoes').delete().eq('id', body.id_correcao);
  if (error) return { success: false, message: 'Erro ao cancelar: ' + error.message };
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

  const [{ data: cliente }, { count }] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', body.cliente_id).maybeSingle(),
    supabase.from('eventos').select('id', { count: 'exact', head: true }).eq('cliente_id', body.cliente_id)
  ]);

  const limite = cliente && cliente.limite_eventos != null ? cliente.limite_eventos : 5;
  if ((count || 0) >= limite) {
    return { success: false, message: `Limite de ${limite} evento(s) atingido para este grupo de clientes. Fale com o master da plataforma para aumentar o limite.` };
  }

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

  const { data: quesitosVinculos } = await supabase.from('usuario_evento_quesitos').select('*');
  const mapQuesitos = {};
  (quesitosVinculos || []).forEach((v) => {
    mapQuesitos[v.codigo] = mapQuesitos[v.codigo] || {};
    mapQuesitos[v.codigo][v.evento_id] = mapQuesitos[v.codigo][v.evento_id] || [];
    mapQuesitos[v.codigo][v.evento_id].push(v.quesito_id);
  });

  return {
    success: true,
    usuarios: (usuarios || []).map((u) => ({
      codigo: u.codigo, nome: u.nome, perfil: u.perfil, ativo: u.ativo, clienteId: u.cliente_id,
      eventos: map[u.codigo] || [], avaliadorIndividual: u.avaliador_individual || false,
      quesitosPorEvento: mapQuesitos[u.codigo] || {}, temSenha: !!u.senha_hash,
      comProblema: u.com_problema || false, motivoProblema: u.motivo_problema || ''
    }))
  };
}

async function adminSaveUsuario(body) {
  const codigo = String(body.codigo).trim().toUpperCase();
  const ativo = body.ativo !== false;
  const avaliadorIndividual = !!body.avaliadorIndividual;

  const payload = {
    codigo, nome: body.nome, perfil: body.perfil, ativo, cliente_id: body.clienteId || body.cliente_id || null,
    avaliador_individual: avaliadorIndividual
  };
  if (body.senha) payload.senha_hash = hashSenha(String(body.senha));

  const { error } = await supabase.from('usuarios').upsert(payload);
  if (error) throw error;

  await supabase.from('usuario_eventos').delete().eq('codigo', codigo);
  const eventos = body.eventos || [];
  if (eventos.length) {
    await supabase.from('usuario_eventos').insert(eventos.map((eid) => ({ codigo, evento_id: eid })));
  }

  await supabase.from('usuario_evento_quesitos').delete().eq('codigo', codigo);
  if (avaliadorIndividual && body.quesitosPorEvento) {
    const linhas = [];
    Object.keys(body.quesitosPorEvento).forEach((eid) => {
      (body.quesitosPorEvento[eid] || []).forEach((qid) => linhas.push({ codigo, evento_id: eid, quesito_id: qid }));
    });
    if (linhas.length) await supabase.from('usuario_evento_quesitos').insert(linhas);
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
        limiteEventos: c.limite_eventos != null ? c.limite_eventos : 5,
        statusLicenca: !c.ativo ? 'DESATIVADO' : (expirada ? 'EXPIRADA' : 'ATIVA')
      };
    })
  };
}

async function masterSaveCliente(body) {
  const id = body.id || ('cli-' + Date.now());
  const { error } = await supabase.from('clientes').upsert({
    id, nome: body.nome, data_validade_licenca: body.dataValidadeLicenca || null, ativo: body.ativo !== false,
    limite_eventos: body.limiteEventos != null ? Number(body.limiteEventos) : 5
  });
  if (error) throw error;
  return { success: true, message: 'Grupo de clientes salvo', id };
}
