/* =========================================================
   Avaliação Digital 2.0 — Camada de API
   Chama o backend real (Apps Script) quando configurado em
   config.js. Enquanto API_URL não for trocado, resolve tudo
   localmente usando MockDB, com a mesma "forma" de resposta
   ({ success, ... }) que o backend real devolve — assim,
   trocar de demo para produção não exige mudar as telas.
   ========================================================= */

var Api = {

  isDemo: function () {
    return !window.APP_CONFIG || !window.APP_CONFIG.API_URL || window.APP_CONFIG.API_URL === "REPLACE_ME_APPS_SCRIPT_URL";
  },

  call: function (action, payload) {
    payload = payload || {};
    payload.action = action;
    payload.event_id = payload.event_id || (window.APP_CONFIG && window.APP_CONFIG.EVENT_ID);

    if (this.isDemo()) {
      return this._mock(action, payload);
    }

    return fetch(window.APP_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .catch(function (err) {
        return { success: false, message: "Falha de conexão com o servidor. Tente novamente em instantes." };
      });
  },

  /* =========================================================
     Simulação local (modo demo)
     ========================================================= */
  _mock: function (action, payload) {
    var db = MockDB.load();
    var evento = MockDB.getEvento(payload.event_id);
    var delay = 260;

    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(Api._handleMock(action, payload, db, evento));
      }, delay);
    });
  },

  _handleMock: function (action, p, db, evento) {
    switch (action) {

      case "login": {
        var user = db.usuarios.find(function (u) { return u.codigo.toUpperCase() === String(p.codigo || "").toUpperCase(); });
        if (!user) return { success: false, message: "Código não reconhecido. Verifique com a organização do seu evento." };
        if (user.ativo === false) return { success: false, message: "Este usuário está desativado. Fale com o administrador do seu evento." };

        if (user.perfil !== "master") {
          if (!user.clienteId) return { success: false, message: "Este usuário não está associado a nenhum grupo de clientes. Fale com o master da plataforma." };
          var clienteLogin = db.clientes.find(function (c) { return c.id === user.clienteId; });
          if (!clienteLogin || clienteLogin.ativo === false) return { success: false, message: "O acesso da sua organização está desativado. Fale com o master da plataforma." };
          if (clienteLogin.dataValidadeLicenca && new Date(clienteLogin.dataValidadeLicenca) < new Date()) {
            return { success: false, message: "A licença da sua organização expirou em " + new Date(clienteLogin.dataValidadeLicenca).toLocaleDateString("pt-BR") + ". Fale com o master da plataforma." };
          }
        }

        return { success: true, usuario: { codigo: user.codigo, nome: user.nome, perfil: user.perfil, eventoId: user.eventos[0], clienteId: user.clienteId || null } };
      }

      case "get_evento_regras":
        return { success: true, regras: evento.config.regras || {} };

      case "get_quesitos":
        return { success: true, quesitos: MockDB.getQuesitosParaEvento(db, evento.id) };

      case "get_status_concurso":
        return { success: true, statusConcurso: evento.statusConcurso, statusSistema: evento.config.statusSistema, nomeConcurso: evento.nome, dataInicio: evento.dataInicio || "", dataFim: evento.dataFim || "" };

      case "get_active": {
        var ativa = evento.candidatas.find(function (c) { return c.id === evento.config.idAtiva; });
        return { success: true, candidata: ativa || null, statusSistema: evento.config.statusSistema };
      }

      case "get_candidates_panel":
        return { success: true, candidatas: evento.candidatas.slice().sort(function (a, b) { return a.ordem - b.ordem; }) };

      case "prepare_evaluation":
        evento.config.idPreparada = p.id_candidata;
        MockDB.save(db);
        return { success: true, message: "Candidata preparada" };

      case "start_evaluation": {
        var c = evento.candidatas.find(function (x) { return x.id === p.id_candidata; });
        if (!c) return { success: false, message: "Candidata não encontrada" };
        c.statusAvaliacao = "EM_AVALIACAO";
        evento.config.idAtiva = c.id;
        evento.config.idPreparada = "";
        evento.config.statusSistema = "EM_AVALIACAO";
        MockDB.log(evento, "START_EVALUATION", p.usuario, p.perfil, c.nome);
        MockDB.save(db);
        return { success: true, message: "Avaliação iniciada" };
      }

      case "interrupt_evaluation":
        evento.config.statusSistema = "INTERROMPIDO";
        MockDB.save(db);
        return { success: true, message: "Avaliação interrompida" };

      case "resume_evaluation":
        evento.config.statusSistema = "EM_AVALIACAO";
        MockDB.save(db);
        return { success: true, message: "Avaliação retomada" };

      case "return_to_queue": {
        var cq = evento.candidatas.find(function (x) { return x.id === p.id_candidata; });
        if (cq) { cq.statusAvaliacao = "PENDENTE"; }
        if (evento.config.idAtiva === p.id_candidata) {
          evento.config.idAtiva = "";
          evento.config.statusSistema = "AGUARDANDO";
        }
        MockDB.save(db);
        return { success: true, message: "Candidata devolvida à fila" };
      }

      case "end_evaluation": {
        var ce = evento.candidatas.find(function (x) { return x.id === p.id_candidata; });
        if (ce) ce.statusAvaliacao = "FINALIZADA";
        if (evento.config.idAtiva === p.id_candidata) {
          evento.config.idAtiva = "";
          evento.config.statusSistema = "AGUARDANDO";
        }
        MockDB.log(evento, "END_EVALUATION", p.usuario, p.perfil, ce ? ce.nome : p.id_candidata);
        MockDB.save(db);
        return { success: true, message: "Avaliação encerrada" };
      }

      case "set_candidate_flag": {
        var cf = evento.candidatas.find(function (x) { return x.id === p.id_candidata; });
        if (!cf) return { success: false, message: "Candidata não encontrada" };
        cf.flagEspecial = p.flag || "";
        if (p.flag === "DESISTENTE" || p.flag === "DESCLASSIFICADA") {
          cf.disponibilidade = "NAO_DISPONIVEL";
          cf.statusAvaliacao = p.flag;
        } else {
          cf.disponibilidade = "DISPONIVEL";
          if (cf.statusAvaliacao !== "FINALIZADA") cf.statusAvaliacao = "PENDENTE";
        }
        MockDB.log(evento, "SET_CANDIDATE_FLAG", p.usuario, p.perfil, cf.nome + " -> " + (p.flag || "SEM_FLAG"));
        MockDB.save(db);
        return { success: true, message: "Flag atualizada" };
      }

      case "get_my_vote": {
        var meusVotos = evento.votos.filter(function (v) { return v.candidataId === p.id_candidata && v.avaliador === p.login; });
        return { success: true, votos: meusVotos };
      }

      case "submit_vote": {
        if (evento.config.idAtiva !== p.id_candidata) return { success: false, message: "Esta candidata não está ativa para votação" };
        if (evento.config.statusSistema !== "EM_AVALIACAO") return { success: false, message: "A avaliação está interrompida. Aguarde o presidente retomar a avaliação." };

        var quesitosDoEvento = MockDB.getQuesitosParaEvento(db, evento.id);
        var regrasVoto = evento.config.regras || {};
        var minChars = regrasVoto.justificativaObrigatoria !== false ? (regrasVoto.minCaracteresJustificativa || 10) : 0;
        var valoresValidos = MockDB.gerarValoresNota(regrasVoto.notaMin, regrasVoto.notaMax, regrasVoto.notaTipo);

        for (var k = 0; k < quesitosDoEvento.length; k++) {
          var qv = quesitosDoEvento[k];
          var notaK = Number(p.notas[qv.id]);
          var justK = (p.just[qv.id] || "").trim();
          if (!p.notas[qv.id] || valoresValidos.indexOf(notaK) === -1) return { success: false, message: "Nota inválida para o quesito " + qv.nome + "." };
          if (justK.length < minChars) return { success: false, message: "Justificativas devem ter no mínimo " + minChars + " caracteres." };
        }
        if (regrasVoto.assinaturaObrigatoria !== false && !p.assinatura) {
          return { success: false, message: "Assinatura obrigatória." };
        }

        quesitosDoEvento.forEach(function (q) {
          var nota = p.notas[q.id];
          var just = (p.just[q.id] || "").trim();
          if (!nota) return;
          var existente = evento.votos.find(function (v) { return v.candidataId === p.id_candidata && v.avaliador === p.login && v.quesitoId === q.id; });
          if (existente) {
            existente.nota = nota;
            existente.justificativa = just;
            existente.assinatura = p.assinatura;
          } else {
            evento.votos.push({ candidataId: p.id_candidata, avaliador: p.login, avaliadorNome: p.avaliador, quesitoId: q.id, nota: nota, justificativa: just, assinatura: p.assinatura });
          }
        });

        MockDB.log(evento, "SUBMIT_VOTE", p.login, p.perfil, "Voto registrado para candidata " + p.id_candidata);
        MockDB.save(db);
        return { success: true, message: "Voto registrado com sucesso" };
      }

      case "get_monitor": {
        var votosCand = evento.votos.filter(function (v) { return v.candidataId === p.id_candidata; });
        var avaliadoresQueVotaram = {};
        votosCand.forEach(function (v) { avaliadoresQueVotaram[v.avaliador] = v.avaliadorNome; });
        var avaliadoresTotal = db.usuarios.filter(function (u) { return u.perfil === "avaliador"; });
        return {
          success: true,
          avaliadores: avaliadoresTotal.map(function (u) {
            return { login: u.codigo, nome: u.nome, votou: !!avaliadoresQueVotaram[u.codigo] };
          })
        };
      }

      case "get_received_notes": {
        return {
          success: true,
          candidatas: evento.candidatas.map(function (c) {
            return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, votos: evento.votos.filter(function (v) { return v.candidataId === c.id; }) };
          })
        };
      }

      case "get_auditoria_candidates":
        return { success: true, candidatas: evento.candidatas.filter(function (c) { return c.statusAvaliacao === "FINALIZADA"; }) };

      case "get_candidate_audit":
        return { success: true, detalhamento: MockDB.computeDiscardInfo(evento, p.id_candidata, MockDB.getQuesitosParaEvento(db, evento.id)) };

      case "finalize_audit": {
        var ca = evento.candidatas.find(function (x) { return x.id === p.id_candidata; });
        if (ca) { ca.statusAuditoria = "AUDITADA"; }
        MockDB.log(evento, "FINALIZE_AUDIT", p.usuario, p.perfil, ca ? ca.nome : p.id_candidata);
        MockDB.save(db);
        return { success: true, message: "Candidata auditada" };
      }

      case "get_validated_table": {
        var quesitosVT = MockDB.getQuesitosParaEvento(db, evento.id);
        return {
          success: true,
          quesitos: quesitosVT,
          candidatas: evento.candidatas.filter(function (c) { return c.statusAuditoria === "AUDITADA"; }).map(function (c) {
            return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, detalhamento: MockDB.computeDiscardInfo(evento, c.id, quesitosVT) };
          })
        };
      }

      case "get_official_ranking":
        return { success: true, ranking: MockDB.computeRanking(evento, true, MockDB.getQuesitosParaEvento(db, evento.id)) };

      case "get_scoreboard":
      case "get_apuracao_live":
        return { success: true, ranking: MockDB.computeRanking(evento, false, MockDB.getQuesitosParaEvento(db, evento.id)) };

      case "request_correction": {
        var jaExiste = evento.correcoes.find(function (c) {
          return c.idCandidata === p.id_candidata && c.loginAvaliador === p.login_avaliador && c.idQuesito === p.id_quesito && c.status === "PENDENTE_CORRECAO";
        });
        if (jaExiste) return { success: false, message: "Já existe correção pendente para este quesito" };

        var votoOriginal = evento.votos.find(function (v) { return v.candidataId === p.id_candidata && v.avaliador === p.login_avaliador && v.quesitoId === p.id_quesito; });
        if (!votoOriginal) return { success: false, message: "Voto do avaliador não encontrado" };

        evento.correcoes.push({
          id: "cor-" + Date.now(),
          idCandidata: p.id_candidata,
          loginAvaliador: p.login_avaliador,
          nomeAvaliador: votoOriginal.avaliadorNome,
          idQuesito: p.id_quesito,
          notaAntes: votoOriginal.nota,
          justificativaAntes: votoOriginal.justificativa,
          notaDepois: "",
          justificativaDepois: "",
          motivo: p.motivo,
          status: "PENDENTE_CORRECAO",
          questionadaPor: p.usuario
        });

        MockDB.log(evento, "REQUEST_CORRECTION", p.usuario, p.perfil, "Correção solicitada / quesito " + p.id_quesito);
        MockDB.save(db);
        return { success: true, message: "Correção solicitada com sucesso" };
      }

      case "get_all_corrections":
        return { success: true, correcoes: evento.correcoes };

      case "get_my_pending_corrections":
        return { success: true, correcoes: evento.correcoes.filter(function (c) { return c.loginAvaliador === p.login && c.status === "PENDENTE_CORRECAO"; }) };

      case "submit_correction": {
        var corr = evento.correcoes.find(function (c) { return c.id === p.id_correcao; });
        if (!corr) return { success: false, message: "Correção não encontrada" };
        corr.notaDepois = p.nota;
        corr.justificativaDepois = p.justificativa;
        corr.status = "CORRIGIDA";
        MockDB.save(db);
        return { success: true, message: "Correção enviada para validação" };
      }

      case "validate_correction": {
        var corrV = evento.correcoes.find(function (c) { return c.id === p.id_correcao; });
        if (!corrV) return { success: false, message: "Correção não encontrada" };
        corrV.status = "VALIDADA";
        var votoAlvo = evento.votos.find(function (v) { return v.candidataId === corrV.idCandidata && v.avaliador === corrV.loginAvaliador && v.quesitoId === corrV.idQuesito; });
        if (votoAlvo) { votoAlvo.nota = corrV.notaDepois; votoAlvo.justificativa = corrV.justificativaDepois; }
        MockDB.log(evento, "VALIDATE_CORRECTION", p.usuario, p.perfil, "Correção validada");
        MockDB.save(db);
        return { success: true, message: "Correção validada" };
      }

      case "cancel_correction": {
        evento.correcoes = evento.correcoes.filter(function (c) { return c.id !== p.id_correcao; });
        MockDB.save(db);
        return { success: true, message: "Correção cancelada" };
      }

      case "get_logs":
        return { success: true, logs: evento.logs.slice(0, 100) };

      case "get_telao_notes":
        return { success: true, ranking: MockDB.computeRanking(evento, true, MockDB.getQuesitosParaEvento(db, evento.id)), revealIndex: evento.config.revealIndex };

      case "get_telao_reveal_state":
        return { success: true, revealIndex: evento.config.revealIndex };

      case "set_telao_reveal_index":
        evento.config.revealIndex = p.index;
        MockDB.save(db);
        return { success: true };

      case "finalizar_concurso":
        evento.statusConcurso = "FINALIZADO";
        MockDB.log(evento, "FINALIZAR_CONCURSO", p.usuario, p.perfil, "Concurso encerrado");
        MockDB.save(db);
        return { success: true, message: "Concurso encerrado com sucesso" };

      /* -------- acesso a eventos (usado pela tela de Acompanhamento) -------- */
      case "list_accessible_eventos": {
        var perfilAcesso = String(p.perfil || "").toLowerCase();
        var eventosVisiveis;

        if (perfilAcesso === "admin") {
          eventosVisiveis = db.eventos;
        } else {
          var usuarioAtual = db.usuarios.find(function (u) { return u.codigo.toUpperCase() === String(p.codigo || "").toUpperCase(); });
          var idsPermitidos = usuarioAtual ? usuarioAtual.eventos : [];
          eventosVisiveis = db.eventos.filter(function (e) { return idsPermitidos.indexOf(e.id) !== -1; });
        }

        return {
          success: true,
          eventos: eventosVisiveis.map(function (e) {
            return { id: e.id, nome: e.nome, statusConcurso: e.statusConcurso, dataInicio: e.dataInicio, dataFim: e.dataFim, candidatas: e.candidatas.length };
          })
        };
      }

      /* -------- admin: multi-evento -------- */
      case "admin_list_eventos":
        return {
          success: true,
          eventos: db.eventos.filter(function (e) { return !p.cliente_id || e.clienteId === p.cliente_id; }).map(function (e) {
            return {
              id: e.id, nome: e.nome, statusConcurso: e.statusConcurso,
              dataInicio: e.dataInicio, dataFim: e.dataFim,
              candidatas: e.candidatas.length, quesitos: MockDB.getQuesitosParaEvento(db, e.id).length
            };
          })
        };

      case "admin_create_evento": {
        if (!p.cliente_id) return { success: false, message: "Cliente não informado" };
        var novoEventoId = "evt-" + Date.now();
        db.eventos.push({
          id: novoEventoId, clienteId: p.cliente_id, nome: p.nome, statusConcurso: "A_INICIAR", dataInicio: "", dataFim: "",
          config: { idAtiva: "", idPreparada: "", statusSistema: "AGUARDANDO", revealIndex: 0, regras: JSON.parse(JSON.stringify(MockDB.REGRAS_PADRAO || { notaMin: 8, notaMax: 10, notaTipo: "fracionada", regraDescarte: "maior_e_menor", justificativaObrigatoria: true, minCaracteresJustificativa: 10, assinaturaObrigatoria: true })) },
          candidatas: [], votos: [], correcoes: [], logs: []
        });
        MockDB.save(db);
        return { success: true, message: "Evento criado", id: novoEventoId };
      }

      case "admin_list_usuarios":
        return { success: true, usuarios: db.usuarios.filter(function (u) { return !p.cliente_id || u.clienteId === p.cliente_id; }) };

      case "trocar_codigo_usuario": {
        var codAntigo = String(p.codigoAntigo || "").toUpperCase();
        var codNovo = String(p.codigoNovo || "").toUpperCase();
        var alvo = db.usuarios.find(function (u) { return u.codigo === codAntigo; });
        if (!alvo) return { success: false, message: "Usuário não encontrado" };
        if (db.usuarios.some(function (u) { return u.codigo === codNovo; })) return { success: false, message: "Já existe um usuário com esse código" };
        alvo.codigo = codNovo;
        MockDB.save(db);
        return { success: true, message: "Código de acesso atualizado com sucesso" };
      }

      case "admin_create_evento":
        return { success: false, message: "Criar um segundo evento não é suportado no modo demonstração. Conecte o backend real (Supabase) para multi-evento completo." };

      case "admin_save_usuario": {
        var existenteU = db.usuarios.find(function (u) { return u.codigo === p.codigo; });
        var novoAtivo = p.ativo !== undefined ? !!p.ativo : true;
        var clienteIdSalvar = p.clienteId !== undefined ? p.clienteId : (p.cliente_id !== undefined ? p.cliente_id : null);
        if (existenteU) {
          existenteU.nome = p.nome;
          existenteU.perfil = p.perfil;
          existenteU.eventos = p.eventos || [];
          existenteU.ativo = p.ativo !== undefined ? !!p.ativo : existenteU.ativo;
          if (clienteIdSalvar !== null) existenteU.clienteId = clienteIdSalvar;
        } else {
          db.usuarios.push({ codigo: p.codigo, nome: p.nome, perfil: p.perfil, eventos: p.eventos || [], ativo: novoAtivo, clienteId: clienteIdSalvar });
        }
        MockDB.save(db);
        return { success: true, message: "Usuário salvo" };
      }

      case "admin_remove_usuario":
        db.usuarios = db.usuarios.filter(function (u) { return u.codigo !== p.codigo; });
        MockDB.save(db);
        return { success: true, message: "Usuário removido" };

      case "trocar_codigo_usuario": {
        var antigoCod = String(p.codigoAntigo || "").trim().toUpperCase();
        var novoCod = String(p.codigoNovo || "").trim().toUpperCase();
        if (!antigoCod || !novoCod) return { success: false, message: "Informe o código atual e o novo código." };
        var usuarioAntigo = db.usuarios.find(function (u) { return u.codigo === antigoCod; });
        if (!usuarioAntigo) return { success: false, message: "Usuário com código " + antigoCod + " não encontrado" };
        if (db.usuarios.some(function (u) { return u.codigo === novoCod; })) return { success: false, message: "Já existe um usuário com o código " + novoCod };

        usuarioAntigo.codigo = novoCod;
        db.eventos.forEach(function (e) {
          // nada a fazer no demo: eventos.usuarios (evento.votos etc já referenciam pelo login que ficou registrado no voto, não precisamos migrar histórico aqui)
        });
        MockDB.save(db);
        return { success: true, message: "Código de acesso atualizado com sucesso" };
      }

      /* -------- quesitos: catálogo GLOBAL -------- */
      case "get_quesitos_globais":
        return { success: true, quesitos: db.quesitosGlobais.filter(function (q) { return !p.cliente_id || q.clienteId === p.cliente_id; }).sort(function (a, b) { return a.ordem - b.ordem; }) };

      case "admin_save_quesitos":
        db.quesitosGlobais = db.quesitosGlobais.filter(function (q) { return p.cliente_id && q.clienteId !== p.cliente_id; })
          .concat((p.quesitos || []).map(function (q) { q.clienteId = p.cliente_id || q.clienteId; return q; }));
        MockDB.save(db);
        return { success: true, message: "Quesitos atualizados" };

      /* -------- grupos/candidatas: catálogo GLOBAL -------- */
      case "get_grupos_globais":
        return { success: true, grupos: db.gruposCandidatas.filter(function (g) { return !p.cliente_id || g.clienteId === p.cliente_id; }) };

      case "admin_save_candidatas":
        db.gruposCandidatas = db.gruposCandidatas.filter(function (g) { return p.cliente_id && g.clienteId !== p.cliente_id; })
          .concat((p.grupos || []).map(function (g) { g.clienteId = p.cliente_id || g.clienteId; return g; }));
        MockDB.save(db);
        return { success: true, message: "Grupos atualizados" };

      /* -------- master: clientes/licenças -------- */
      case "master_list_clientes": {
        var hoje = new Date();
        return {
          success: true,
          clientes: db.clientes.map(function (c) {
            var expirada = c.dataValidadeLicenca && new Date(c.dataValidadeLicenca) < hoje;
            return {
              id: c.id, nome: c.nome, dataValidadeLicenca: c.dataValidadeLicenca, ativo: c.ativo,
              statusLicenca: !c.ativo ? "DESATIVADO" : (expirada ? "EXPIRADA" : "ATIVA")
            };
          })
        };
      }

      case "master_save_cliente": {
        var clienteExistente = p.id && db.clientes.find(function (c) { return c.id === p.id; });
        if (clienteExistente) {
          clienteExistente.nome = p.nome;
          clienteExistente.dataValidadeLicenca = p.dataValidadeLicenca || "";
          clienteExistente.ativo = p.ativo !== false;
        } else {
          var novoClienteId = p.id || ("cli-" + Date.now());
          db.clientes.push({ id: novoClienteId, nome: p.nome, dataValidadeLicenca: p.dataValidadeLicenca || "", ativo: p.ativo !== false });
        }
        MockDB.save(db);
        return { success: true, message: "Grupo de clientes salvo" };
      }

      case "master_list_usuarios":
        return { success: true, usuarios: db.usuarios.filter(function (u) { return !p.cliente_id || u.clienteId === p.cliente_id; }) };

      case "admin_set_status_concurso":
        evento.statusConcurso = p.status;
        MockDB.save(db);
        return { success: true, message: "Status do concurso atualizado" };

      case "admin_get_evento_config":
        return {
          success: true,
          nome: evento.nome,
          dataInicio: evento.dataInicio || "",
          dataFim: evento.dataFim || "",
          regras: evento.config.regras || {},
          grupoIds: evento.candidatas.map(function (c) { return c.id; })
        };

      case "admin_save_evento_config": {
        evento.nome = p.nome || evento.nome;
        evento.dataInicio = p.dataInicio || "";
        evento.dataFim = p.dataFim || "";
        evento.config.regras = p.regras || evento.config.regras;

        // sincroniza participação de grupos: mantém estado dos que continuam,
        // adiciona os novos, remove os desmarcados.
        if (p.grupoIds) {
          var novosIds = p.grupoIds;
          evento.candidatas = evento.candidatas.filter(function (c) { return novosIds.indexOf(c.id) !== -1; });
          var jaPresentes = evento.candidatas.map(function (c) { return c.id; });
          var proximaOrdem = evento.candidatas.length;

          novosIds.forEach(function (gid) {
            if (jaPresentes.indexOf(gid) !== -1) return;
            var grupo = db.gruposCandidatas.find(function (g) { return g.id === gid; });
            if (!grupo) return;
            proximaOrdem += 1;
            evento.candidatas.push({
              id: grupo.id, nome: grupo.nome, cidade: grupo.cidade, estado: grupo.estado,
              disponibilidade: "DISPONIVEL", statusAvaliacao: "PENDENTE", ordem: proximaOrdem,
              flagEspecial: "", statusAuditoria: "PENDENTE"
            });
          });
        }

        MockDB.log(evento, "ADMIN_SAVE_EVENTO_CONFIG", p.usuario, p.perfil, "Configurações do evento atualizadas");
        MockDB.save(db);
        return { success: true, message: "Configurações do evento salvas" };
      }

      default:
        return { success: false, message: "Ação não reconhecida no modo demo: " + action };
    }
  }
};
