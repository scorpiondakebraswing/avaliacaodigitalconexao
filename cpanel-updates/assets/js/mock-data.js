/* =========================================================
   Avaliação Digital 2.0 — Banco de dados de demonstração
   Guardado no localStorage do navegador. Serve só para o
   sistema funcionar "clicável" antes de conectar o backend
   real (Apps Script). Troque APP_CONFIG.API_URL e o wrapper
   Api (em api.js) passa a usar o backend de verdade.
   ========================================================= */

var MOCK_DB_KEY = "ad2_demo_db";

var MockDB = {

  seed: function () {
    return {
      clientes: [
        { id: "cli-1", nome: "CONEXÃO JUNINA (PADRÃO)", dataValidadeLicenca: "2030-12-31", ativo: true }
      ],

      usuarios: [
        { codigo: "MASTER-2027", nome: "MASTER DA PLATAFORMA", perfil: "master", eventos: [], ativo: true, clienteId: null, senha: "123456" },
        { codigo: "ADM-2027", nome: "ANA (CONEXÃO JUNINA)", perfil: "admin", eventos: ["evt-1"], ativo: true, clienteId: "cli-1", senha: "123456" },
        { codigo: "PRES-2027", nome: "UBIRATAM", perfil: "presidente", eventos: ["evt-1"], ativo: true, clienteId: "cli-1", senha: "123456" },
        { codigo: "AVAL-2027", nome: "HELENA BARBOSA", perfil: "avaliador", eventos: ["evt-1"], ativo: true, clienteId: "cli-1", avaliadorIndividual: false, quesitosPorEvento: {}, senha: "123456" },
        { codigo: "AVAL2-2027", nome: "TAYWAN RAMIRES", perfil: "avaliador", eventos: ["evt-1"], ativo: true, clienteId: "cli-1", avaliadorIndividual: false, quesitosPorEvento: {}, senha: "123456" },
        { codigo: "AVAL3-2027", nome: "GRACINHA", perfil: "avaliador", eventos: ["evt-1"], ativo: true, clienteId: "cli-1", avaliadorIndividual: false, quesitosPorEvento: {}, senha: "123456" },
        { codigo: "CONS-2027", nome: "CONSULTORIA CONEXÃO", perfil: "consultor", eventos: ["evt-1"], ativo: true, clienteId: "cli-1", senha: "123456" }
      ],

      // Catálogo GLOBAL de quesitos (por cliente). Cada evento usa os que
      // forem "válidos para todos" + os específicos que o incluam em `eventos`.
      quesitosGlobais: [
        { id: "q1", nome: "TEMA", peso: 1, ordem: 1, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "quadrilha", grupoPai: null,
          descricao: "Conceito central que dá unidade à apresentação. Avalia-se: a criatividade na abordagem do tema e como ele se conecta ao contexto junino; a pesquisa que fundamenta o tema (histórica, social, religiosa, folclórica ou literária), dando autenticidade e profundidade; o enredo — a forma narrativa como o tema é contado, com início, desenvolvimento e desfecho coerentes; e a adaptação — a habilidade do grupo em traduzir o tema para a linguagem junina, sem perder a essência do São João mesmo quando o tema é contemporâneo ou universal." },
        { id: "q2", nome: "REPERTÓRIO", peso: 2, ordem: 2, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "quadrilha", grupoPai: null,
          descricao: "Conjunto de músicas com letras (cantadas, recitadas ou instrumentais) em sincronia com o ritmo. Avalia-se a LETRA — clareza e coerência com o tema e os festejos juninos, criação poética, uso de expressões culturais e contribuição pra narrativa; e o RITMO — coerência com a cadência junina tradicional (mesmo dialogando com influências contemporâneas), transições bem construídas e precisão na execução." },
        { id: "q3", nome: "FIGURINO", peso: 3, ordem: 3, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "quadrilha", grupoPai: null,
          descricao: "Conjunto de vestuário e acessórios, ligado obrigatoriamente à cultura junina. Avalia-se a relação do figurino com o TEMA proposto; o JOGO DE CORES (harmonia cromática entre as peças); os ACESSÓRIOS (chapéus, bijuterias, cintos etc., em equilíbrio com o conjunto); e a CONSERVAÇÃO (estado das peças, acabamento, limpeza e ajuste ao corpo dos brincantes)." },
        { id: "q4", nome: "COREOGRAFIA", peso: 4, ordem: 4, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "quadrilha", grupoPai: null,
          descricao: "Conjunto de movimentos sequenciados com acompanhamento musical — tradicionais, releituras ou novos passos. Avalia-se o PRODUTO DA CRIATIVIDADE (desenvolvimento coreográfico, clareza da proposta cênica, transições e formações); a EXECUÇÃO (sincronia, precisão, domínio do tempo musical, e a execução da quantidade mínima obrigatória de passos tradicionais); e o QUANTITATIVO (aproveitamento do espaço cênico e harmonia entre a quantidade de brincantes em cena e a estética do conjunto)." },
        { id: "q5", nome: "ANIMAÇÃO", peso: 5, ordem: 5, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "quadrilha", grupoPai: null,
          descricao: "Movimento entusiasmado, espontâneo e vivaz — entrega de corpo e alma durante toda a apresentação. Avalia-se a VIVACIDADE (energia e vigor constantes, força cênica que contagia o público) e a EMPATIA CÊNICA (comunicação afetiva com o público e entre os próprios brincantes, carisma e autenticidade)." },
        { id: "q6", nome: "CASAMENTO", peso: 6, ordem: 6, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "quadrilha", grupoPai: null,
          descricao: "Representação cênica da celebração da união (independente do rito religioso). Avalia-se o TEXTO em cena e sua relação com o tema; a coerência narrativa; a INTERPRETAÇÃO dos personagens; a MARCAÇÃO (movimentação e posicionamento em cena); a CARACTERIZAÇÃO (trajes e aspectos comportamentais); e, se houver, o uso de CENÁRIO (não é obrigatório)." },
        { id: "q7", nome: "DINÂMICA", peso: 7, ordem: 7, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "quadrilha", grupoPai: null,
          descricao: "Progressão narrativa e coreográfica que garante o bom andamento da apresentação. Avalia-se se a sequência está coesa (sem cortes ou interrupções longas); se os elementos artísticos estão bem conectados; se há diálogo coerente entre a temática e a cultura junina; e se a apresentação flui com naturalidade, sem parecer mecanizada." },

        { id: "d1", nome: "DESENVOLTURA", peso: 1, ordem: 1, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "RAINHA",
          descricao: "Representação com desembaraço e vivacidade. Avalia-se a naturalidade e elegância nos movimentos, a expressividade facial e corporal, a capacidade de adaptação a imprevistos, e a proposta coreográfica bem executada (fluidez, controle técnico, leveza)." },
        { id: "d2", nome: "FIGURINO", peso: 2, ordem: 2, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "RAINHA",
          descricao: "Conjunto de vestuário e acessórios ligado à cultura junina. Avalia-se a harmonia cromática, a relação com a temática do grupo, a presença de elementos juninos tradicionais (bicos, fitas, bordados etc.), a conservação/acabamento, e o ajuste ao corpo da personagem." },
        { id: "d3", nome: "ANIMAÇÃO", peso: 3, ordem: 3, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "RAINHA",
          descricao: "Entusiasmo, emoção e vivacidade ao longo de toda a apresentação. Avalia-se a energia constante, a postura e vigor cênico sem perder a elegância, e o equilíbrio entre emoção e técnica mesmo em momentos de alta intensidade." },
        { id: "d4", nome: "INTEGRAÇÃO", peso: 4, ordem: 4, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "RAINHA",
          descricao: "Ato de interagir e se integrar ao grupo, demonstrando pertencimento. Avalia-se a sintonia com os demais brincantes (sem protagonismo isolado excessivo), a harmonia nos movimentos coletivos, a participação ativa no enredo, e o equilíbrio entre destaque individual e coletividade." },

        { id: "d5", nome: "LIDERANÇA", peso: 1, ordem: 1, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "MARCADOR",
          descricao: "Capacidade de conduzir a apresentação com competência e autoridade. Avalia-se o domínio da coreografia, do tempo musical e da narrativa; se o marcador prioriza corretamente sua função de condução; a postura de liderança natural e respeitosa; a clareza das marcações e comandos; e se o grupo reconhece o marcador como o condutor da apresentação." },
        { id: "d6", nome: "DESENVOLTURA", peso: 2, ordem: 2, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "MARCADOR",
          descricao: "Representação com desembaraço e vivacidade. Avalia-se a naturalidade e espontaneidade nas falas e movimentações, o domínio na narração, a capacidade de improviso mantendo coerência com a narrativa junina, e a execução harmônica da coreografia coletiva e individual." },
        { id: "d7", nome: "FIGURINO", peso: 3, ordem: 3, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "MARCADOR",
          descricao: "Conjunto de vestuário e acessórios ligado à cultura junina. Avalia-se a harmonia cromática, a presença de elementos juninos tradicionais, a adequação temática (o figurino dialoga com o enredo e o papel do marcador), a conservação/acabamento, e o ajuste ao corpo." },
        { id: "d8", nome: "ANIMAÇÃO", peso: 4, ordem: 4, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "MARCADOR",
          descricao: "Entusiasmo, emoção e vivacidade ao longo de toda a apresentação. Avalia-se a energia contínua do início ao fim, a participação ativa e contagiante, a expressão facial/corporal coerente, e o equilíbrio no ritmo sem prejudicar a clareza das marcações." },
        { id: "d9", nome: "INTEGRAÇÃO", peso: 5, ordem: 5, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "MARCADOR",
          descricao: "Ato de interagir e se integrar ao grupo. Avalia-se a harmonia entre o marcador e o grupo, o respeito ao tempo coletivo (sem sobreposições ou quebras de ritmo), a comunicação afetiva com os brincantes, e a sensibilidade para destacar o grupo mantendo equilíbrio entre protagonismo e coletividade." },

        { id: "d10", nome: "INTERPRETAÇÃO", peso: 1, ordem: 1, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "CASAL",
          descricao: "Representação dos personagens, considerando a atuação individual e a cumplicidade do casal. Avalia-se a construção cênica dos personagens (coerência com o tema e a cultura junina), a expressividade emocional/teatral, a cumplicidade entre os noivos, e o uso da linguagem corporal sustentando o protagonismo cênico." },
        { id: "d11", nome: "DESENVOLTURA", peso: 2, ordem: 2, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "CASAL",
          descricao: "Representação com desembaraço e vivacidade. Avalia-se a naturalidade nas movimentações (evitando rigidez), a confiança e fluidez na execução de gestos e falas, o domínio de palco, e a capacidade de improvisação diante de situações inesperadas." },
        { id: "d12", nome: "FIGURINO", peso: 3, ordem: 3, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "CASAL",
          descricao: "Conjunto de vestuário e acessórios ligado à cultura junina. Avalia-se o equilíbrio e uso das cores, a relação com a temática e a cultura junina, a presença de elementos juninos tradicionais, a qualidade do acabamento/conservação, e o ajuste ao corpo do personagem." },
        { id: "d13", nome: "ANIMAÇÃO", peso: 4, ordem: 4, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "CASAL",
          descricao: "Entusiasmo, emoção e vivacidade ao longo de toda a apresentação. Avalia-se a energia e entusiasmo contínuos, a expressão facial/corporal coerente com a proposta, e o ritmo/empolgação equilibrados, sem exageros." },
        { id: "d14", nome: "INTEGRAÇÃO", peso: 5, ordem: 5, validoParaTodos: true, eventos: [], clienteId: "cli-1", familia: "destaque", grupoPai: "CASAL",
          descricao: "Ato de interagir e se integrar ao grupo. Avalia-se a sintonia com os demais brincantes, a harmonia nos movimentos coletivos, a participação ativa no enredo, a comunicação afetiva com o grupo, e a coerência entre a performance do casal e o contexto coletivo." }
      ],

      // Catálogo GLOBAL de grupos/quadrilhas (por cliente). Cada evento associa
      // um subconjunto deles (ver evento.candidatas, que referencia estes IDs).
      gruposCandidatas: [
        { id: "c1", nome: "QUADRILHA ESTRELA DO NORTE", cidade: "FORTALEZA", estado: "CE", clienteId: "cli-1" },
        { id: "c2", nome: "ARRAIÁ DO VALE", cidade: "CARUARU", estado: "PE", clienteId: "cli-1" },
        { id: "c3", nome: "SANFONA DE OURO", cidade: "FEIRA DE SANTANA", estado: "BA", clienteId: "cli-1" },
        { id: "c4", nome: "JUNINA ENCANTO", cidade: "JUAZEIRO DO NORTE", estado: "CE", clienteId: "cli-1" },
        { id: "c5", nome: "FORRÓ DO SERTÃO", cidade: "MOSSORÓ", estado: "RN", clienteId: "cli-1" }
      ],

      eventos: [
        {
          id: "evt-1",
          clienteId: "cli-1",
          nome: "26º FESTEJO CEARÁ JUNINO",
          statusConcurso: "EM_ANDAMENTO", // A_INICIAR | EM_ANDAMENTO | FINALIZADO
          dataInicio: "2027-06-10T18:00",
          dataFim: "2027-06-12T23:00",
          config: {
            idAtiva: "c2",
            idPreparada: "",
            statusSistema: "EM_AVALIACAO", // AGUARDANDO | EM_AVALIACAO | INTERROMPIDO
            revealIndex: 0,
            regras: {
              notaMin: 8,
              notaMax: 10,
              notaTipo: "fracionada", // 'fracionada' (x,5 de 1 em 1) | 'quebrada' (0,1 em 0,1)
              regraDescarte: "maior_e_menor", // 'sem_descarte' | 'maior' | 'maior_e_menor'
              desempatePorQuesito: true,
              justificativaObrigatoria: true,
              maxCaracteresJustificativa: 500,
              assinaturaObrigatoria: true
            }
          },
          // Participação deste evento: referencia gruposCandidatas por ID,
          // com estado de execução próprio do evento (status, ordem, flags...).
          candidatas: [
            { id: "c1", nome: "QUADRILHA ESTRELA DO NORTE", cidade: "FORTALEZA", estado: "CE", disponibilidade: "NAO_DISPONIVEL", statusAvaliacao: "FINALIZADA", ordem: 1, flagEspecial: "", statusAuditoria: "AUDITADA" },
            { id: "c2", nome: "ARRAIÁ DO VALE", cidade: "CARUARU", estado: "PE", disponibilidade: "NAO_DISPONIVEL", statusAvaliacao: "EM_AVALIACAO", ordem: 2, flagEspecial: "", statusAuditoria: "PENDENTE" },
            { id: "c3", nome: "SANFONA DE OURO", cidade: "FEIRA DE SANTANA", estado: "BA", disponibilidade: "DISPONIVEL", statusAvaliacao: "PENDENTE", ordem: 3, flagEspecial: "", statusAuditoria: "PENDENTE" },
            { id: "c4", nome: "JUNINA ENCANTO", cidade: "JUAZEIRO DO NORTE", estado: "CE", disponibilidade: "DISPONIVEL", statusAvaliacao: "PENDENTE", ordem: 4, flagEspecial: "", statusAuditoria: "PENDENTE" },
            { id: "c5", nome: "FORRÓ DO SERTÃO", cidade: "MOSSORÓ", estado: "RN", disponibilidade: "DISPONIVEL", statusAvaliacao: "PENDENTE", ordem: 5, flagEspecial: "", statusAuditoria: "PENDENTE" }
          ],
          votos: [
            // candidata c1 (finalizada e já auditada) — 3 avaliadores por quesito
            { candidataId: "c1", avaliador: "AVAL-2027", avaliadorNome: "HELENA BARBOSA", quesitoId: "q1", nota: 9.5, justificativa: "Boa marcação de compasso e sincronia do grupo." },
            { candidataId: "c1", avaliador: "AVAL-2027", avaliadorNome: "HELENA BARBOSA", quesitoId: "q2", nota: 9.0, justificativa: "Figurino criativo, temática bem trabalhada." },
            { candidataId: "c1", avaliador: "AVAL-2027", avaliadorNome: "HELENA BARBOSA", quesitoId: "q3", nota: 10, justificativa: "Grupo interagiu muito bem com a plateia." },
            { candidataId: "c1", avaliador: "AVAL-2027", avaliadorNome: "HELENA BARBOSA", quesitoId: "q4", nota: 9.5, justificativa: "Atuação convincente do casal de noivos." },

            { candidataId: "c1", avaliador: "AVAL2-2027", avaliadorNome: "TAYWAN RAMIRES", quesitoId: "q1", nota: 9.0, justificativa: "Coreografia consistente, pequenas falhas de sincronia." },
            { candidataId: "c1", avaliador: "AVAL2-2027", avaliadorNome: "TAYWAN RAMIRES", quesitoId: "q2", nota: 9.5, justificativa: "Cenário e adereços muito criativos." },
            { candidataId: "c1", avaliador: "AVAL2-2027", avaliadorNome: "TAYWAN RAMIRES", quesitoId: "q3", nota: 9.5, justificativa: "Ótima empolgação do grupo." },
            { candidataId: "c1", avaliador: "AVAL2-2027", avaliadorNome: "TAYWAN RAMIRES", quesitoId: "q4", nota: 9.0, justificativa: "Atuação sólida, com bom timing cômico." },

            { candidataId: "c1", avaliador: "AVAL3-2027", avaliadorNome: "GRACINHA", quesitoId: "q1", nota: 8.5, justificativa: "Alguns desencontros na parte final da coreografia." },
            { candidataId: "c1", avaliador: "AVAL3-2027", avaliadorNome: "GRACINHA", quesitoId: "q2", nota: 9.0, justificativa: "Boa proposta visual do grupo." },
            { candidataId: "c1", avaliador: "AVAL3-2027", avaliadorNome: "GRACINHA", quesitoId: "q3", nota: 9.5, justificativa: "Grupo animado do início ao fim." },
            { candidataId: "c1", avaliador: "AVAL3-2027", avaliadorNome: "GRACINHA", quesitoId: "q4", nota: 9.0, justificativa: "Atuação convincente, boa expressividade." }
          ],
          correcoes: [],
          logs: [
            { data: new Date().toISOString(), acao: "LOGIN", usuario: "UBIRATAM", perfil: "PRESIDENTE DE MESA", detalhe: "Login efetuado com sucesso" }
          ]
        }
      ]
    };
  },

  load: function () {
    var raw = localStorage.getItem(MOCK_DB_KEY);
    if (!raw) {
      var seeded = this.seed();
      this.save(seeded);
      return seeded;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      var seeded2 = this.seed();
      this.save(seeded2);
      return seeded2;
    }
  },

  save: function (db) {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
  },

  reset: function () {
    localStorage.removeItem(MOCK_DB_KEY);
    return this.load();
  },

  getEvento: function (eventoId) {
    var db = this.load();
    return db.eventos.find(function (e) { return e.id === eventoId; }) || db.eventos[0];
  },

  log: function (evento, acao, usuario, perfil, detalhe) {
    evento.logs.unshift({
      data: new Date().toISOString(),
      acao: acao,
      usuario: usuario || "",
      perfil: perfil || "",
      detalhe: detalhe || ""
    });
  },

  // Quesitos aplicáveis a um evento específico: os "válidos para todos"
  // + os específicos que incluam esse eventoId na própria lista.
  nomeExibicaoQuesito: function (q) {
    return q.grupoPai ? (q.grupoPai + " - " + q.nome) : q.nome;
  },

  getQuesitosParaEvento: function (db, eventoId) {
    return (db.quesitosGlobais || []).filter(function (q) {
      return q.validoParaTodos || (q.eventos || []).indexOf(eventoId) !== -1;
    }).sort(function (a, b) { return a.ordem - b.ordem; }).map(function (q) {
      return {
        id: q.id, nome: q.nome, peso: q.peso, ordem: q.ordem,
        familia: q.familia || "quadrilha", grupoPai: q.grupoPai || null, descricao: q.descricao || "",
        nomeExibicao: MockDB.nomeExibicaoQuesito(q)
      };
    });
  },

  /* ---------------- notas válidas (nota mín/máx + tipo) ---------------- */

  // tipo 'quebrada'   -> passo de 0,1  (ex.: 7,1 / 7,2 / 7,3 ...)
  // tipo 'fracionada' -> passo de 1,0 terminando em ,5 (ex.: 7,5 / 8,5 / 9,5 ...)
  // tipo 'quebrada'   -> passo de 0,1  (ex.: min=8 → 8,0 / 8,1 / 8,2 ...)
  // tipo 'fracionada' -> passo de 0,5  (ex.: min=8 → 8,0 / 8,5 / 9,0 / 9,5 / 10,0)
  gerarValoresNota: function (min, max, tipo) {
    min = Number(min); max = Number(max);
    var valores = [];
    var passoDecimos = (tipo === "quebrada") ? 1 : 5; // em décimos, pra evitar erro de ponto flutuante
    var inicioDecimos = Math.round(min * 10);
    var fimDecimos = Math.round(max * 10);

    for (var v = inicioDecimos; v <= fimDecimos; v += passoDecimos) {
      valores.push(Math.round(v) / 10);
    }
    return valores;
  },

  /* ---------------- lógica de apuração ---------------- */

  // Aplica a regra de descarte escolhida pelo admin sobre uma lista de notas
  // (já numérica) de um único quesito. A regra só entra em vigor com 3+ votos.
  aplicarRegraDescarte: function (notasOrdenadasAsc, regraDescarte) {
    if (!regraDescarte || regraDescarte === "sem_descarte") return notasOrdenadasAsc;
    if (notasOrdenadasAsc.length < 3) return notasOrdenadasAsc;

    if (regraDescarte === "maior") return notasOrdenadasAsc.slice(0, -1);
    if (regraDescarte === "maior_e_menor") return notasOrdenadasAsc.slice(1, -1);
    return notasOrdenadasAsc;
  },

  somaComDescarte: function (notas, evento) {
    var regras = (evento && evento.config && evento.config.regras) || {};
    var arr = notas.slice().sort(function (a, b) { return a - b; });
    var considerados = MockDB.aplicarRegraDescarte(arr, regras.regraDescarte);
    return considerados.reduce(function (acc, n) { return acc + n; }, 0);
  },

  computeRanking: function (evento, somenteAuditadas, quesitos) {
    var regras = (evento.config && evento.config.regras) || {};
    var desempatarPorPeso = regras.desempatePorQuesito !== false;

    var quesitosOrdenados = quesitos.slice().sort(function (a, b) { return a.ordem - b.ordem; });
    var quesitosPorPeso = quesitos.slice().sort(function (a, b) { return (Number(a.peso) || 0) - (Number(b.peso) || 0); });

    var candidatas = evento.candidatas.filter(function (c) {
      if (somenteAuditadas) return c.statusAuditoria === "AUDITADA";
      return true;
    });

    var resultado = candidatas.map(function (c) {
      var detalhamento = {};
      var total = 0;
      var observacao = "";

      if (c.flagEspecial === "DESCLASSIFICADA" || c.flagEspecial === "DESISTENTE") {
        quesitosOrdenados.forEach(function (q) { detalhamento[q.id] = 0; });
        return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, total: 0, detalhamento: detalhamento, observacao: c.flagEspecial };
      }

      quesitosOrdenados.forEach(function (q) {
        var notas = evento.votos
          .filter(function (v) { return v.candidataId === c.id && v.quesitoId === q.id; })
          .map(function (v) { return Number(v.nota); });

        var soma = MockDB.somaComDescarte(notas, evento);
        detalhamento[q.id] = soma;
        total += soma;
      });

      return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, total: total, detalhamento: detalhamento, observacao: observacao };
    });

    resultado.sort(function (a, b) {
      var aEsp = a.observacao === "DESCLASSIFICADA" || a.observacao === "DESISTENTE";
      var bEsp = b.observacao === "DESCLASSIFICADA" || b.observacao === "DESISTENTE";
      if (aEsp && !bEsp) return 1;
      if (!aEsp && bEsp) return -1;
      if (aEsp && bEsp) return 0;
      if (b.total !== a.total) return b.total - a.total;
      if (!desempatarPorPeso) return 0;
      for (var i = 0; i < quesitosPorPeso.length; i++) {
        var q = quesitosPorPeso[i];
        var av = a.detalhamento[q.id] || 0;
        var bv = b.detalhamento[q.id] || 0;
        if (bv !== av) return bv - av;
      }
      return 0;
    });

    for (var i = 0; i < resultado.length - 1; i++) {
      var atual = resultado[i];
      var prox = resultado[i + 1];
      var atualEsp = atual.observacao === "DESCLASSIFICADA" || atual.observacao === "DESISTENTE";
      var proxEsp = prox.observacao === "DESCLASSIFICADA" || prox.observacao === "DESISTENTE";
      if (atualEsp || proxEsp) continue;

      if (Number(atual.total) === Number(prox.total)) {
        var obs = "Empate total após todos os critérios.";
        if (desempatarPorPeso) {
          for (var j = 0; j < quesitosPorPeso.length; j++) {
            var q2 = quesitosPorPeso[j];
            var aVal = atual.detalhamento[q2.id] || 0;
            var bVal = prox.detalhamento[q2.id] || 0;
            if (aVal !== bVal) {
              obs = "Desempate aplicado por peso — " + q2.nome + " (peso " + q2.peso + "): " + aVal + " x " + bVal;
              break;
            }
          }
        } else {
          obs = "Empate — desempate por peso de quesitos está desativado neste evento.";
        }
        atual.observacao = obs;
        prox.observacao = obs;
      }
    }

    return resultado;
  },

  computeDiscardInfo: function (evento, candidataId, quesitos) {
    quesitos = quesitos.slice().sort(function (a, b) { return a.ordem - b.ordem; });
    var votosCandidata = evento.votos.filter(function (v) { return v.candidataId === candidataId; });
    var regraDescarte = (evento.config && evento.config.regras && evento.config.regras.regraDescarte) || "sem_descarte";

    return quesitos.map(function (q) {
      var doQuesito = votosCandidata.filter(function (v) { return v.quesitoId === q.id; });
      var marcados = doQuesito.map(function (v) { return { avaliador: v.avaliadorNome, nota: Number(v.nota), justificativa: v.justificativa, descartada: false }; });

      if (marcados.length >= 3 && regraDescarte !== "sem_descarte") {
        var ordenados = marcados.slice().sort(function (a, b) { return a.nota - b.nota; });
        // marca só UMA ocorrência da maior (e, se aplicável, uma da menor)
        ordenados[ordenados.length - 1].descartada = true;
        if (regraDescarte === "maior_e_menor") {
          ordenados[0].descartada = true;
        }
      }

      return { quesito: MockDB.nomeExibicaoQuesito(q), quesitoId: q.id, votos: marcados };
    });
  }
};
