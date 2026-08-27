// =============================================================
// Regras de negócio (mesma lógica do V1/V2: descarte de notas,
// desempate, geração de valores de nota válidos). Mantidas em um
// módulo à parte para ficar fácil de auditar/testar.
// =============================================================

const REGRAS_PADRAO = {
  notaMin: 8,
  notaMax: 10,
  notaTipo: 'fracionada',
  regraDescarte: 'maior_e_menor',
  desempatePorQuesito: true,
  justificativaObrigatoria: true,
  maxCaracteresJustificativa: 500,
  assinaturaObrigatoria: true
};

// tipo 'quebrada'   -> passo de 0,1  (ex.: 7,1 / 7,2 / 7,3 ...)
// tipo 'fracionada' -> passo de 1,0 terminando em ,5 (ex.: 7,5 / 8,5 / 9,5 ...)
// tipo 'quebrada'   -> passo de 0,1  (ex.: min=8 → 8,0 / 8,1 / 8,2 ...)
// tipo 'fracionada' -> passo de 0,5  (ex.: min=8 → 8,0 / 8,5 / 9,0 / 9,5 / 10,0)
function gerarValoresNota(min, max, tipo) {
  min = Number(min);
  max = Number(max);
  const valores = [];
  const passoDecimos = tipo === 'quebrada' ? 1 : 5; // em décimos, evita erro de ponto flutuante
  const inicioDecimos = Math.round(min * 10);
  const fimDecimos = Math.round(max * 10);

  for (let v = inicioDecimos; v <= fimDecimos; v += passoDecimos) {
    valores.push(Math.round(v) / 10);
  }
  return valores;
}

// Soma as notas de UM quesito já aplicando a regra de descarte.
// Só descarta com 3+ avaliadores votando aquele quesito.
function somaComDescarte(notas, regraDescarte) {
  const arr = [...notas].sort((a, b) => a - b);
  if (!regraDescarte || regraDescarte === 'sem_descarte' || arr.length < 3) {
    return arr.reduce((acc, n) => acc + n, 0);
  }
  if (regraDescarte === 'maior') {
    return arr.slice(0, -1).reduce((acc, n) => acc + n, 0);
  }
  // maior_e_menor
  return arr.slice(1, -1).reduce((acc, n) => acc + n, 0);
}

// Marca, voto a voto, quais foram descartados — para as telas de
// auditoria e notas validadas.
function marcarDescartes(votosDoQuesito, regraDescarte) {
  const marcados = votosDoQuesito.map((v) => ({
    avaliador: v.avaliador_nome,
    nota: Number(v.nota),
    justificativa: v.justificativa,
    descartada: false
  }));

  if (marcados.length >= 3 && regraDescarte && regraDescarte !== 'sem_descarte') {
    const ordenados = [...marcados].sort((a, b) => a.nota - b.nota);
    ordenados[ordenados.length - 1].descartada = true;
    if (regraDescarte === 'maior_e_menor') ordenados[0].descartada = true;
  }
  return marcados;
}

// Monta o ranking (usado tanto no ranking oficial quanto no "ao
// vivo"), aplicando descarte por quesito e, quando ativado nas regras
// do evento, desempate seguindo a ordem de PESO dos quesitos (peso 1
// primeiro, depois peso 2, e assim por diante).
function gerarRanking(candidatas, votos, quesitos, regras) {
  regras = regras || {};
  const regraDescarte = regras.regraDescarte;
  const desempatarPorPeso = regras.desempatePorQuesito !== false;

  const quesitosOrdenados = [...quesitos].sort((a, b) => a.ordem - b.ordem);
  const quesitosPorPeso = [...quesitos].sort((a, b) => (Number(a.peso) || 0) - (Number(b.peso) || 0));

  const resultado = candidatas.map((c) => {
    const detalhamento = {};
    let total = 0;

    if (c.flag_especial === 'DESCLASSIFICADA' || c.flag_especial === 'DESISTENTE') {
      quesitosOrdenados.forEach((q) => { detalhamento[q.id] = 0; });
      return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, total: 0, detalhamento, observacao: c.flag_especial };
    }

    quesitosOrdenados.forEach((q) => {
      const notasQuesito = votos
        .filter((v) => v.candidata_id === c.id && v.quesito_id === q.id)
        .map((v) => Number(v.nota));
      const soma = somaComDescarte(notasQuesito, regraDescarte);
      detalhamento[q.id] = soma;
      total += soma;
    });

    return { id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado, total, detalhamento, observacao: '' };
  });

  resultado.sort((a, b) => {
    const aEsp = a.observacao === 'DESCLASSIFICADA' || a.observacao === 'DESISTENTE';
    const bEsp = b.observacao === 'DESCLASSIFICADA' || b.observacao === 'DESISTENTE';
    if (aEsp && !bEsp) return 1;
    if (!aEsp && bEsp) return -1;
    if (aEsp && bEsp) return 0;
    if (b.total !== a.total) return b.total - a.total;
    if (!desempatarPorPeso) return 0;
    for (const q of quesitosPorPeso) {
      const av = a.detalhamento[q.id] || 0;
      const bv = b.detalhamento[q.id] || 0;
      if (bv !== av) return bv - av;
    }
    return 0;
  });

  for (let i = 0; i < resultado.length - 1; i++) {
    const atual = resultado[i];
    const prox = resultado[i + 1];
    const atualEsp = atual.observacao === 'DESCLASSIFICADA' || atual.observacao === 'DESISTENTE';
    const proxEsp = prox.observacao === 'DESCLASSIFICADA' || prox.observacao === 'DESISTENTE';
    if (atualEsp || proxEsp) continue;

    if (Number(atual.total) === Number(prox.total)) {
      let obs = 'Empate total após todos os critérios.';
      if (desempatarPorPeso) {
        for (const q of quesitosPorPeso) {
          const aVal = atual.detalhamento[q.id] || 0;
          const bVal = prox.detalhamento[q.id] || 0;
          if (aVal !== bVal) { obs = `Desempate aplicado por peso — ${q.nome} (peso ${q.peso}): ${aVal} x ${bVal}`; break; }
        }
      } else {
        obs = 'Empate — desempate por peso de quesitos está desativado neste evento.';
      }
      atual.observacao = obs;
      prox.observacao = obs;
    }
  }

  return resultado;
}

module.exports = { REGRAS_PADRAO, gerarValoresNota, somaComDescarte, marcarDescartes, gerarRanking };
