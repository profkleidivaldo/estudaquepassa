/* Separa questões de uma prova a partir do texto extraído do PDF.
   Entrada: array com o texto de cada página (linhas separadas por \n).
   Saída: lista de questões { numero, enunciado, opcoes, gabarito, area, tema, avisos[], incluir }. */
(function (root) {
  'use strict';

  var Tax = (typeof module !== 'undefined' && module.exports) ? require('./taxonomia.js') : root.Taxonomia;

  var RE_QUESTAO = /^\s*(?:QUEST[ÃA]O|Quest[ãa]o)\s*(?:n[ºo°.]*\s*)?(\d{1,3})\s*[.:)\-–]?\s*(.*)$/;
  var RE_NUM = /^\s*(\d{1,3})\s*[.)\-–]\s+(\S.*)$/;
  var RE_NUM_ESPACO = /^\s*(\d{1,3})\s+(?=[A-ZÀ-Ú(“"'])(\S.*)$/;
  var RE_ALT = /^\s*(?:\(([A-Ea-e])\)|([A-Ea-e])\s*[).]|([A-Ea-e])\s+[-–])\s*(.*)$/;
  var RE_ITEM = /^\s*(?:[IVX]{1,4}\s*[-–.)]|\(\s*\)|[•·▪]\s|[-–]\s+\S)/;
  var RE_APOIO = /^\s*(?:TEXTO|Texto)\s*(?:\d+|[IVX]+|para|associado|base)\b/;
  var RE_RODAPE = /^\s*(?:p[áa]g(?:ina)?\.?\s*\d+(?:\s*(?:de|\/)\s*\d+)?|-+\s*\d+\s*-+)\s*$/i;
  var SEM_ESCOPO = /(l[íi]ngua portuguesa|portugu[êe]s|matem[áa]tica|racioc[íi]nio l[óo]gico|inform[áa]tica|ingl[êe]s|geografia|hist[óo]ria|atualidades|conhecimentos gerais|contabilidade|medicina|enfermagem)/i;
  var BANCAS = ['Cebraspe', 'CESPE', 'FGV', 'FCC', 'VUNESP', 'IBFC', 'IDECAN', 'Quadrix', 'AOCP', 'Consulpam', 'FUNDATEC', 'CESGRANRIO', 'IADES', 'FUNCAB', 'Instituto Access', 'Instituto AOCP', 'FEPESE', 'FAURGS', 'OBJETIVA', 'Legalle', 'IMA', 'Selecon', 'CONSULPLAN', 'UECE', 'COPERVE', 'UFPR', 'NC-UFPR', 'FADESP', 'FUNIVERSA', 'ACAFE', 'INSTITUTO CONSULPLAN', 'IBADE', 'FUNRIO', 'MSCONCURSOS', 'CKM', 'FAFIPA', 'Instituto Mais', 'Itame', 'Ibam'];

  function limparRodapes(paginas) {
    var cont = {};
    paginas.forEach(function (p) {
      var vistos = {};
      p.split('\n').forEach(function (l) {
        var k = l.trim().toLowerCase().replace(/\d+/g, '#');
        if (k.length > 3 && !vistos[k]) { vistos[k] = 1; cont[k] = (cont[k] || 0) + 1; }
      });
    });
    var lim = Math.max(3, Math.ceil(paginas.length * 0.5));
    return paginas.map(function (p) {
      return p.split('\n').filter(function (l) {
        var t = l.trim();
        if (!t) return false;
        if (RE_RODAPE.test(t)) return false;
        var k = t.toLowerCase().replace(/\d+/g, '#');
        return !(cont[k] >= lim && paginas.length >= 3 && !RE_ALT.test(t) && !RE_QUESTAO.test(t) && !RE_NUM.test(t));
      });
    }).reduce(function (a, b) { return a.concat(b); }, []);
  }

  function pareGabarito(texto) {
    var lista = [];
    var re = /(?:^|[\s,;|])(\d{1,3})\s*(?:[-–.:)]\s*|\s+)(ANULAD[AO]|[A-Ea-e]|\*|X)(?=$|[\s,;|.])/g;
    var m;
    while ((m = re.exec(texto))) {
      var v = m[2].toUpperCase();
      lista.push({ n: parseInt(m[1], 10), letra: /^[A-E]$/.test(v) ? v : null });
      re.lastIndex = m.index + m[0].length - 1;
    }
    return lista;
  }

  function cortarGabarito(linhas) {
    for (var i = 0; i < linhas.length; i++) {
      if (/^\s*(?:GABARITOS?|RESPOSTAS?)\b/i.test(linhas[i]) || /^\s*(?:Gabarito\s+(?:oficial|preliminar|definitivo))/i.test(linhas[i])) {
        var trecho = linhas.slice(i, i + 80).join('\n');
        if (pareGabarito(trecho).length >= 3) {
          return { corpo: linhas.slice(0, i), gabarito: linhas.slice(i).join('\n') };
        }
      }
    }
    return { corpo: linhas, gabarito: '' };
  }

  function selecionar(linhas, re, explicito) {
    var aceitos = [], esperado = 1;
    linhas.forEach(function (l, i) {
      var m = re.exec(l);
      if (!m) return;
      var n = parseInt(m[1], 10);
      if (n === esperado) { aceitos.push({ i: i, n: n, resto: m[2] || '' }); esperado++; }
      else if (n === 1 && aceitos.length >= 5 && (explicito || esperado > 10)) {
        aceitos.push({ i: i, n: 1, resto: m[2] || '' }); esperado = 2;
      }
    });
    return aceitos;
  }

  function ehTitulo(l) {
    var t = l.trim();
    if (t.length < 6 || t.length > 90) return false;
    var letras = t.replace(/[^A-Za-zÀ-ú]/g, '');
    if (letras.length < 5) return false;
    var maiusc = t.replace(/[^A-ZÀ-Ú]/g, '').length;
    return maiusc / letras.length > 0.85 && !RE_ALT.test(t) && !/^\d/.test(t);
  }

  function juntar(linhas) {
    var out = '';
    linhas.forEach(function (l) {
      var t = l.replace(/\s+/g, ' ').trim();
      if (!t) return;
      if (!out) out = t;
      else if (RE_ITEM.test(t)) out += '\n' + t;
      else if (/[A-Za-zÀ-ú]-$/.test(out) && /^[a-zà-ú]/.test(t)) out = out.slice(0, -1) + t;
      else out += ' ' + t;
    });
    return out.trim();
  }

  function extrairAlternativas(linhas) {
    var marcas = [];
    linhas.forEach(function (l, i) {
      var m = RE_ALT.exec(l);
      if (m) marcas.push({ i: i, L: (m[1] || m[2] || m[3]).toUpperCase(), txt: m[4] || '' });
    });
    var melhor = null;
    for (var a = marcas.length - 1; a >= 0; a--) {
      if (marcas[a].L !== 'A') continue;
      var cadeia = [marcas[a]], prox = 'B';
      for (var k = a + 1; k < marcas.length; k++) {
        if (marcas[k].L === prox) { cadeia.push(marcas[k]); prox = String.fromCharCode(prox.charCodeAt(0) + 1); }
      }
      if (cadeia.length >= 2) { melhor = cadeia; if (cadeia.length >= 4) break; }
    }
    if (!melhor) return null;
    var opcoes = {};
    melhor.forEach(function (mk, idx) {
      var fim = idx + 1 < melhor.length ? melhor[idx + 1].i : linhas.length;
      var corpo = [mk.txt].concat(linhas.slice(mk.i + 1, fim));
      if (idx === melhor.length - 1) {
        // a última alternativa não deve engolir título de seção ou texto de apoio
        for (var j = 1; j < corpo.length; j++) {
          if (ehTitulo(corpo[j]) || RE_APOIO.test(corpo[j])) { corpo = corpo.slice(0, j); break; }
        }
      }
      opcoes[mk.L] = juntar(corpo);
    });
    return { primeira: melhor[0].i, opcoes: opcoes };
  }

  function chuteMeta(textoInicial, nomeArquivo) {
    var base = (textoInicial || '') + ' ' + (nomeArquivo || '');
    var banca = '';
    for (var i = 0; i < BANCAS.length; i++) {
      if (new RegExp('(^|[^A-Za-z])' + BANCAS[i].replace(/[-]/g, '\\-') + '([^A-Za-z]|$)', 'i').test(base)) { banca = BANCAS[i]; break; }
    }
    if (/cespe/i.test(banca)) banca = 'Cebraspe';
    var anos = (base.match(/\b(20[0-3]\d)\b/g) || []);
    return { banca: banca, ano: anos.length ? anos[0] : '' };
  }

  var RE_DEPENDE = /\b(texto|figura|gr[áa]fico|tabela|imagem|charge|tirinha|quadro|mapa|fragmento|trecho)\s+(acima|abaixo|anterior|seguinte|a seguir|i{1,3}\b|\d)|\b(acima|abaixo)\b.{0,40}\b(texto|figura|gr[áa]fico|tabela|imagem|charge|tirinha|quadro)\b|com base (?:no|na|nos|nas) (?:texto|figura|gr[áa]fico|tabela|imagem)/i;

  function parseProva(paginas, opcoes) {
    opcoes = opcoes || {};
    var linhas = limparRodapes(paginas);
    var cg = cortarGabarito(linhas);
    linhas = cg.corpo;

    var cands = selecionar(linhas, RE_QUESTAO, true);
    if (cands.length < 3) {
      var c2 = selecionar(linhas, RE_NUM, false);
      if (c2.length > cands.length) cands = c2;
    }
    if (cands.length < 3) {
      var c3 = selecionar(linhas, RE_NUM_ESPACO, false);
      if (c3.length > cands.length) cands = c3;
    }

    var secao = '';
    var secoesPorLinha = [];
    linhas.forEach(function (l, i) { if (ehTitulo(l) && !RE_QUESTAO.test(l)) secao = l.trim(); secoesPorLinha[i] = secao; });

    var questoes = [];
    cands.forEach(function (c, k) {
      var fim = k + 1 < cands.length ? cands[k + 1].i : linhas.length;
      var bloco = [c.resto].concat(linhas.slice(c.i + 1, fim));
      var alt = extrairAlternativas(bloco);
      var avisos = [];
      var enun, ops = {}, semAlt = false;
      if (alt) {
        enun = juntar(bloco.slice(0, alt.primeira));
        ops = alt.opcoes;
        var n = Object.keys(ops).length;
        if (n < 4) avisos.push('Poucas alternativas (' + n + ').');
        // apoio colado no final do enunciado de questões sem alternativas já tratado abaixo
      } else {
        var corpo = bloco.slice();
        enun = juntar(corpo);
        semAlt = true;
        avisos.push('Alternativas não encontradas.');
      }
      var apoioIdx = -1;
      for (var j = 1; j < bloco.length; j++) { if (RE_APOIO.test(bloco[j]) && (!alt || j > alt.primeira)) { apoioIdx = j; break; } }
      if (apoioIdx > 0 && semAlt) enun = juntar(bloco.slice(0, apoioIdx));

      if (enun.length < 25) avisos.push('Enunciado muito curto.');
      if (RE_DEPENDE.test(enun)) avisos.push('Parece depender de texto de apoio, figura ou tabela.');
      Object.keys(ops).forEach(function (L) { if (ops[L].length > 600) avisos.push('Alternativa ' + L + ' muito longa (talvez inclua texto de outra questão).'); });

      var secaoQ = secoesPorLinha[c.i] || '';
      var foraEscopo = SEM_ESCOPO.test(secaoQ);
      var cls = Tax.classificar(enun, ops, '', foraEscopo ? '' : secaoQ);
      if (foraEscopo && cls.area !== 'Não classificada' && cls.score < 6) cls = { area: 'Não classificada', tema: 'Revisar', score: cls.score, confianca: 0 };
      if (cls.area === 'Não classificada') avisos.push('Não consegui classificar o tema.');
      else if (cls.confianca < 0.55) avisos.push('Classificação incerta entre temas parecidos.');

      questoes.push({
        numero: c.n, secao: secaoQ, enunciado: enun, opcoes: ops, semAlt: semAlt,
        gabarito: '', comentario: '', dificuldade: 'medio',
        area: cls.area, tema: cls.tema, avisos: avisos, incluir: false
      });
    });

    // descarta blocos iniciais sem alternativas (instruções da capa numeradas)
    while (questoes.length && questoes[0].semAlt && questoes.length > 1) questoes.shift();

    var mapa = pareGabarito(cg.gabarito);
    aplicarGabarito(questoes, mapa);
    var meta = chuteMeta(paginas.slice(0, 2).join(' ').slice(0, 3000), opcoes.nomeArquivo);
    return { questoes: questoes, gabaritoEncontrado: mapa.length, meta: meta };
  }

  /** Aplica gabarito (lista [{n, letra}]) às questões; trata numeração que recomeça por bloco. */
  function aplicarGabarito(questoes, mapa) {
    var porNum = {};
    mapa.forEach(function (g) { (porNum[g.n] = porNum[g.n] || []).push(g.letra); });
    var vistos = {};
    questoes.forEach(function (q) {
      var lista = porNum[q.numero];
      var ocorr = vistos[q.numero] = (vistos[q.numero] || 0) + 1;
      if (!lista || !lista.length) { atualizarEstado(q); return; }
      var letra = lista[Math.min(ocorr - 1, lista.length - 1)];
      if (letra) {
        if (q.semAlt && (letra === 'C' || letra === 'E')) {
          q.opcoes = { A: 'Certo', B: 'Errado' };
          q.gabarito = letra === 'C' ? 'A' : 'B';
          q.semAlt = false;
          q.avisos = q.avisos.filter(function (a) { return a.indexOf('Alternativas não') !== 0; });
        } else q.gabarito = letra;
      } else {
        q.gabarito = '';
        if (q.avisos.indexOf('Questão anulada no gabarito.') < 0) q.avisos.push('Questão anulada no gabarito.');
      }
      atualizarEstado(q);
    });
  }

  function atualizarEstado(q) {
    q.avisos = q.avisos.filter(function (a) { return a !== 'Sem gabarito.'; });
    if (!q.gabarito) q.avisos.push('Sem gabarito.');
    var ruim = q.avisos.some(function (a) {
      return /^(Sem gabarito|Alternativas não|Parece depender|Não consegui|Questão anulada|Enunciado muito)/.test(a);
    });
    if (!q.gabarito || !q.opcoes[q.gabarito]) ruim = true;
    q.incluir = !ruim && Object.keys(q.opcoes).length >= 2;
  }

  var api = {
    parseProva: parseProva, parseGabarito: pareGabarito, aplicarGabarito: aplicarGabarito,
    atualizarEstado: atualizarEstado, limparRodapes: limparRodapes
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QuizParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
