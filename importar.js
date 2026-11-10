/* Importador de provas: PDF -> texto -> questões -> revisão -> banco. */
(function () {
  'use strict';

  var CFG = Object.assign({ API_URL: '' }, window.QUIZ_CONFIG || {});
  var DEMO = !CFG.API_URL;
  var LETRAS = ['A', 'B', 'C', 'D', 'E'];
  var AREAS = ['Educação', 'Administração', 'Direito', 'Não classificada'];
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  var S = { questoes: [], nomeArquivo: '' };
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, props) {
    var n = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'value') n.value = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }
  function append(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(n, x); }); return; }
    n.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  /* ---------- extração de texto do PDF ---------- */
  function paginaParaTexto(page) {
    var W = page.getViewport({ scale: 1 }).width;
    return page.getTextContent().then(function (tc) {
      var itens = tc.items.filter(function (it) { return it.str && it.str.trim() !== ''; }).map(function (it) {
        return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 };
      });
      if (!itens.length) return '';

      // detecta duas colunas: faixa central quase vazia, com texto dos dois lados
      var faixaA = W * 0.42, faixaB = W * 0.58;
      var cruza = itens.filter(function (i) { return i.x < faixaB && i.x + i.w > faixaA; }).length;
      var esq = itens.filter(function (i) { return i.x + i.w <= faixaA + 4; }).length;
      var dir = itens.filter(function (i) { return i.x >= faixaB - 4; }).length;
      var duasCol = itens.length > 20 && cruza / itens.length < 0.06 && esq / itens.length > 0.25 && dir / itens.length > 0.25;

      function linhasDe(lista) {
        lista = lista.slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; });
        var linhas = [], atual = null;
        lista.forEach(function (i) {
          if (!atual || Math.abs(atual.y - i.y) > 3) { atual = { y: i.y, itens: [] }; linhas.push(atual); }
          atual.itens.push(i);
        });
        return linhas.map(function (l) {
          l.itens.sort(function (a, b) { return a.x - b.x; });
          var t = '', fim = null;
          l.itens.forEach(function (i) {
            if (fim !== null && i.x - fim > 1.2 && !/\s$/.test(t) && !/^\s/.test(i.s)) t += ' ';
            t += i.s; fim = i.x + i.w;
          });
          return t.replace(/\s+/g, ' ').trim();
        }).filter(Boolean);
      }

      if (duasCol) {
        var meio = W / 2;
        var cabeca = linhasDe(itens.filter(function (i) { return i.x + i.w / 2 < meio; }));
        var cauda = linhasDe(itens.filter(function (i) { return i.x + i.w / 2 >= meio; }));
        return cabeca.concat(cauda).join('\n');
      }
      return linhasDe(itens).join('\n');
    });
  }

  function lerPdf(arquivo, aoProgresso) {
    return arquivo.arrayBuffer().then(function (buf) {
      return pdfjsLib.getDocument({ data: buf }).promise;
    }).then(function (pdf) {
      var paginas = [];
      var cadeia = Promise.resolve();
      for (var n = 1; n <= pdf.numPages; n++) {
        (function (num) {
          cadeia = cadeia.then(function () { return pdf.getPage(num); })
            .then(paginaParaTexto)
            .then(function (t) { paginas.push(t); if (aoProgresso) aoProgresso(num, pdf.numPages); });
        })(n);
      }
      return cadeia.then(function () { return paginas; });
    });
  }

  /* ---------- fluxo principal ---------- */
  var fProva = $('f-prova'), fGab = $('f-gab'), btnLer = $('btn-ler'), stLeitura = $('st-leitura');
  fProva.addEventListener('change', function () {
    btnLer.disabled = !fProva.files.length;
    stLeitura.textContent = '';
  });

  btnLer.addEventListener('click', function () {
    if (!window.pdfjsLib) { stLeitura.textContent = 'A biblioteca de leitura de PDF não carregou. Verifique a conexão e recarregue a página.'; return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    var arq = fProva.files[0];
    if (!arq) return;
    S.nomeArquivo = arq.name;
    btnLer.disabled = true;
    stLeitura.textContent = 'Lendo o PDF…';

    var textoGab = '';
    lerPdf(arq, function (n, t) { stLeitura.textContent = 'Lendo página ' + n + ' de ' + t + '…'; })
      .then(function (paginas) {
        var chars = paginas.join('').replace(/\s/g, '').length;
        if (chars < 60 * paginas.length) {
          throw new Error('Este PDF quase não tem texto selecionável, provavelmente é uma digitalização (imagem). Faça OCR antes: envie o PDF ao Google Drive, clique com o botão direito e abra com o Google Docs, depois baixe como PDF.');
        }
        return fGab.files[0]
          ? lerPdf(fGab.files[0]).then(function (g) { textoGab = g.join('\n'); return paginas; })
          : paginas;
      })
      .then(function (paginas) {
        var r = QuizParser.parseProva(paginas, { nomeArquivo: arq.name });
        if (textoGab) QuizParser.aplicarGabarito(r.questoes, QuizParser.parseGabarito(textoGab));
        if (!r.questoes.length) {
          throw new Error('Não encontrei questões numeradas. Confira se o PDF segue o padrão "Questão 1" ou "1." com alternativas A) a E).');
        }
        if (!$('m-banca').value) $('m-banca').value = r.meta.banca;
        if (!$('m-ano').value) $('m-ano').value = r.meta.ano;
        S.questoes = r.questoes;
        var prontas = r.questoes.filter(function (q) { return q.incluir; }).length;
        stLeitura.textContent = 'Pronto: ' + r.questoes.length + ' questões encontradas, ' + prontas + ' prontas para envio.' +
          (r.gabaritoEncontrado ? '' : ' Gabarito não encontrado no PDF: envie o PDF do gabarito acima ou cole o gabarito em "Colar ou corrigir o gabarito" (sem gabarito nenhuma questão fica pronta).');
        $('sec-rev').hidden = false;
        renderTudo();
        $('sec-rev').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (e) { console.error(e); stLeitura.textContent = 'Erro ao ler o PDF: ' + (e && e.message || e); })
      .finally(function () { btnLer.disabled = false; });
  });

  /* ---------- revisão ---------- */
  function precisaRevisar(q) {
    return !q.gabarito || q.avisos.some(function (a) { return a !== 'Sem gabarito.'; });
  }
  function atualizarDatalist() {
    var dl = $('dl-temas');
    var vistos = {};
    Taxonomia.TAXONOMIA.forEach(function (t) { vistos[t.tema] = 1; });
    S.questoes.forEach(function (q) { vistos[q.tema] = 1; });
    dl.replaceChildren.apply(dl, Object.keys(vistos).sort().map(function (t) { return el('option', { value: t }); }));
  }
  function atualizarResumo() {
    var inc = S.questoes.filter(function (q) { return q.incluir; }).length;
    var rev = S.questoes.filter(precisaRevisar).length;
    $('resumo-rev').textContent = S.questoes.length + ' questões encontradas · ' + inc + ' marcadas para envio · ' + rev + ' pedem revisão.';
    $('btn-enviar').disabled = inc === 0;
    $('btn-enviar').textContent = inc ? 'Enviar ' + inc + ' para o banco' : 'Enviar para o banco';
    $('btn-csv').disabled = inc === 0;
  }

  function cartao(q, idx) {
    var avisos = q.avisos.length
      ? el('ul', { class: 'avisos' }, q.avisos.map(function (a) { return el('li', { text: a }); }))
      : null;
    var chk = el('input', { type: 'checkbox', id: 'inc-' + idx, onchange: function (e) { q.incluir = e.target.checked; atualizarResumo(); } });
    chk.checked = q.incluir;

    var selArea = el('select', { 'aria-label': 'Área', onchange: function (e) { q.area = e.target.value; } },
      AREAS.map(function (a) { return el('option', { value: a, text: a, selected: q.area === a }); }));
    var inTema = el('input', { type: 'text', list: 'dl-temas', 'aria-label': 'Tema', value: q.tema, maxlength: '60', onchange: function (e) {
      q.tema = e.target.value.trim() || 'Revisar';
      var t = Taxonomia.TAXONOMIA.filter(function (x) { return x.tema === q.tema; })[0];
      if (t) { q.area = t.area; selArea.value = t.area; }
      atualizarDatalist();
    } });
    var selDif = el('select', { 'aria-label': 'Dificuldade', onchange: function (e) { q.dificuldade = e.target.value; } },
      [['facil', 'fácil'], ['medio', 'médio'], ['dificil', 'difícil']].map(function (d) { return el('option', { value: d[0], text: d[1], selected: q.dificuldade === d[0] }); }));
    var selGab = el('select', { 'aria-label': 'Gabarito', onchange: function (e) { q.gabarito = e.target.value; QuizParser.atualizarEstado(q); renderTudo(); } },
      el('option', { value: '', text: 'Sem gabarito' }),
      Object.keys(q.opcoes).sort().map(function (L) { return el('option', { value: L, text: 'Gabarito ' + L, selected: q.gabarito === L }); }));

    var ta = el('textarea', { rows: '4', 'aria-label': 'Enunciado', value: q.enunciado, onchange: function (e) { q.enunciado = e.target.value.trim(); } });
    var ops = el('div', { class: 'ops' });
    LETRAS.forEach(function (L) {
      if (!(L in q.opcoes) && !(L === 'E' || L === 'D')) return;
      ops.appendChild(el('label', { class: 'op' },
        el('span', { class: 'bolha mini', text: L, 'aria-hidden': 'true' }),
        el('input', { type: 'text', 'aria-label': 'Alternativa ' + L, value: q.opcoes[L] || '', onchange: function (e) {
          var v = e.target.value.trim();
          if (v) q.opcoes[L] = v; else delete q.opcoes[L];
          if (q.gabarito && !q.opcoes[q.gabarito]) q.gabarito = '';
          QuizParser.atualizarEstado(q);
          renderTudo();
        } })));
    });

    return el('li', { class: 'cartao-q' + (precisaRevisar(q) ? ' revisar' : '') },
      el('div', { class: 'cab-q' },
        el('label', { class: 'chk' }, chk, el('b', { text: ' Questão ' + q.numero })),
        q.secao ? el('span', { class: 'apoio', text: q.secao }) : null),
      avisos,
      el('div', { class: 'linha-sel' }, selArea, inTema, selDif, selGab),
      ta, ops);
  }

  function renderTudo() {
    atualizarDatalist();
    var so = $('so-revisar').checked;
    var cards = $('cards');
    cards.replaceChildren.apply(cards, S.questoes.map(function (q, i) { return { q: q, i: i }; })
      .filter(function (x) { return !so || precisaRevisar(x.q); })
      .map(function (x) { return cartao(x.q, x.i); }));
    atualizarResumo();
  }

  $('so-revisar').addEventListener('change', renderTudo);
  $('btn-todas').addEventListener('click', function () {
    S.questoes.forEach(function (q) { q.incluir = !!q.gabarito && !!q.opcoes[q.gabarito] && Object.keys(q.opcoes).length >= 2; });
    renderTudo();
  });
  $('btn-nenhuma').addEventListener('click', function () { S.questoes.forEach(function (q) { q.incluir = false; }); renderTudo(); });
  $('btn-gab').addEventListener('click', function () {
    var mapa = QuizParser.parseGabarito($('t-gab').value);
    if (!mapa.length) { alert('Não reconheci nenhum gabarito. Use o formato 1-A 2-B 3-C.'); return; }
    QuizParser.aplicarGabarito(S.questoes, mapa);
    renderTudo();
  });

  /* ---------- envio ---------- */
  function normChave(s) { return Taxonomia.norm(s).replace(/[^a-z0-9]+/g, ' ').trim(); }

  function paraEnvio() {
    var meta = { banca: $('m-banca').value.trim(), orgao: $('m-orgao').value.trim(), ano: $('m-ano').value.trim() };
    var fonte = [meta.banca, meta.orgao, meta.ano].filter(Boolean).join(' ') + ' – ' + S.nomeArquivo;
    return S.questoes.filter(function (q) { return q.incluir && q.gabarito && q.opcoes[q.gabarito]; }).map(function (q) {
      return { area: q.area, tema: q.tema, banca: meta.banca, orgao: meta.orgao, ano: meta.ano, enunciado: q.enunciado,
        opcoes: q.opcoes, gabarito: q.gabarito, comentario: q.comentario || '', dificuldade: q.dificuldade, fonte: fonte };
    });
  }

  function csvCampo(v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  $('btn-csv').addEventListener('click', function () {
    var cab = ['id', 'area', 'tema', 'banca', 'orgao', 'ano', 'enunciado', 'A', 'B', 'C', 'D', 'E', 'gabarito', 'comentario', 'dificuldade', 'fonte'];
    var base = Date.now().toString(36);
    var linhas = [cab.join(',')].concat(paraEnvio().map(function (q, i) {
      return [('I' + base + i), q.area, q.tema, q.banca, q.orgao, q.ano, q.enunciado, q.opcoes.A, q.opcoes.B, q.opcoes.C, q.opcoes.D, q.opcoes.E, q.gabarito, q.comentario, q.dificuldade, q.fonte].map(csvCampo).join(',');
    }));
    var blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'questoes-importadas.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  });

  if (!DEMO) {
    $('box-chave').hidden = false;
    try { $('in-chave').value = sessionStorage.getItem('quiz.chave') || ''; } catch (e) { /* ignore */ }
  }

  function enviarDemo(lista) {
    var atuais = [];
    try { atuais = JSON.parse(localStorage.getItem('quiz.custom') || '[]'); } catch (e) { atuais = []; }
    var vistos = {};
    atuais.forEach(function (q) { vistos[normChave(q.enunciado)] = 1; });
    var novos = 0, dups = 0, base = Date.now().toString(36);
    lista.forEach(function (q, i) {
      var k = normChave(q.enunciado);
      if (vistos[k]) { dups++; return; }
      vistos[k] = 1; novos++;
      atuais.push({ id: 'L' + base + i, area: q.area, tema: q.tema, banca: q.banca, orgao: q.orgao, ano: q.ano,
        enunciado: q.enunciado, opcoes: q.opcoes, gabarito: q.gabarito, comentario: q.comentario, dificuldade: q.dificuldade });
    });
    try { localStorage.setItem('quiz.custom', JSON.stringify(atuais)); } catch (e) { return Promise.reject(new Error('Sem espaço no navegador para guardar as questões. Use o CSV.')); }
    return Promise.resolve({ adicionadas: novos, duplicadas: dups });
  }

  function enviarApi(lista, chave) {
    var total = { adicionadas: 0, duplicadas: 0 };
    var cadeia = Promise.resolve();
    for (var i = 0; i < lista.length; i += 20) {
      (function (lote) {
        cadeia = cadeia.then(function () {
          return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'import', key: chave, questions: lote }) })
            .then(function (r) { if (!r.ok) throw new Error('Servidor respondeu ' + r.status); return r.json(); })
            .then(function (j) {
              if (j.error) throw new Error(j.error);
              total.adicionadas += j.adicionadas; total.duplicadas += j.duplicadas;
              $('st-envio').textContent = 'Enviando… ' + total.adicionadas + ' adicionadas até agora.';
            });
        });
      })(lista.slice(i, i + 20));
    }
    return cadeia.then(function () { return total; });
  }

  $('btn-enviar').addEventListener('click', function () {
    var lista = paraEnvio();
    if (!lista.length) return;
    var st = $('st-envio');
    var chave = $('in-chave').value.trim();
    if (!DEMO && !chave) { st.textContent = 'Digite a chave de administrador (a propriedade ADMIN_KEY do Apps Script).'; $('in-chave').focus(); return; }
    if (!DEMO) { try { sessionStorage.setItem('quiz.chave', chave); } catch (e) { /* ignore */ } }
    $('btn-enviar').disabled = true;
    st.textContent = 'Enviando…';
    (DEMO ? enviarDemo(lista) : enviarApi(lista, chave)).then(function (r) {
      st.textContent = r.adicionadas + ' questões adicionadas ao banco' + (r.duplicadas ? ' e ' + r.duplicadas + ' ignoradas por já existirem' : '') + '.' + (DEMO ? ' (Modo demonstração: ficam só neste navegador. Para o banco definitivo, configure a API_URL ou baixe o CSV.)' : '');
      S.questoes = S.questoes.filter(function (q) { return !lista.some(function (l) { return l.enunciado === q.enunciado; }); });
      renderTudo();
    }).catch(function (e) {
      st.textContent = 'Não foi possível enviar: ' + e.message;
    }).finally(function () { atualizarResumo(); });
  });
})();
