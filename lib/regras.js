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
  minCaracteresJustificativa: 10,
  assinaturaObrigatoria: true
};

// tipo 'quebrada'   -> passo de 0,1  (ex.: 7,1 / 7,2 / 7,3 ...)
// tipo 'fracionada' -> passo de 1,0 terminando em ,5 (ex.: 7,5 / 8,5 / 9,5 ...)
function gerarValoresNota(min, max, tipo) {
  min = Number(min);
  max = Number(max);
  const valores = [];

  if (tipo === 'quebrada') {
    const start10 = Math.round(min * 10);
    const end10 = Math.round(max * 10);
    for (let v = start10; v <= end10; v++) valores.push(Math.round(v) / 10);
  } else {
    let start = Math.floor(min) + 0.5;
    if (start < min) start += 1;
    for (let v = start; v <= max + 1e-9; v += 1) valores.push(Math.round(v * 10) / 10);
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
// vivo"), aplicando descarte por quesito e desempate por ordem de
// quesito quando o total empata.
function gerarRanking(candidatas, votos, quesitos, regraDescarte) {
  const quesitosOrdenados = [...quesitos].sort((a, b) => a.ordem - b.ordem);

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
    for (const q of quesitosOrdenados) {
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
      for (const q of quesitosOrdenados) {
        const aVal = atual.detalhamento[q.id] || 0;
        const bVal = prox.detalhamento[q.id] || 0;
        if (aVal !== bVal) { obs = `Desempate aplicado por ${q.nome} (${aVal} x ${bVal})`; break; }
      }
      atual.observacao = obs;
      prox.observacao = obs;
    }
  }

  return resultado;
}

module.exports = { REGRAS_PADRAO, gerarValoresNota, somaComDescarte, marcarDescartes, gerarRanking };
