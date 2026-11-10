/* Gabarito – aplicação do aluno (quiz, correção e recomendação).
   Funciona em dois modos:
   - API_URL preenchida: banco e histórico vêm do Apps Script (planilha Google).
   - API_URL vazia: modo demonstração (demo.json + provas importadas + histórico no navegador). */
(function () {
  'use strict';

  var CFG = Object.assign({ API_URL: '', TAMANHO_SESSAO: 10, MEIA_VIDA_DIAS: 14 }, window.QUIZ_CONFIG || {});
  var DEMO = !CFG.API_URL;
  var DIFS = ['facil', 'medio', 'dificil'];
  var DIF_NOME = { facil: 'fácil', medio: 'médio', dificil: 'difícil' };

  /* ---------- utilidades ---------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  function el(tag, props) {
    var n = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
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
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function novoId() {
    var b = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(b);
    return 'u' + Array.prototype.map.call(b, function (x) { return x.toString(36).padStart(2, '0'); }).join('');
  }

  function fetchJson(url, opts, ms) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms || 25000);
    var o = Object.assign({}, opts || {}, { signal: ctl.signal });
    return fetch(url, o).then(function (r) {
      if (!r.ok) throw new Error('Servidor respondeu ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j && j.error) throw new Error(j.error);
      return j;
    }).catch(function (e) {
      if (e.name === 'AbortError') throw new Error('Tempo esgotado. Verifique a conexão.');
      throw e;
    }).finally(function () { clearTimeout(t); });
  }

  /* ---------- estado ---------- */
  var state = {
    user: LS.get('quiz.user', null),
    questions: [], byId: {}, history: [], view: 'praticar', sessao: null,
    filtro: { area: '', tema: '' }
  };
  if (!state.user) { state.user = { id: novoId(), nome: '' }; LS.set('quiz.user', state.user); }
  var root = document.getElementById('app');

  /* ---------- dados ---------- */
  function normalizeQ(q) {
    q.id = String(q.id);
    q.area = q.area || 'Sem área';
    q.tema = q.tema || 'Geral';
    q.dificuldade = DIFS.indexOf(String(q.dificuldade).toLowerCase()) >= 0 ? String(q.dificuldade).toLowerCase() : 'medio';
    return q;
  }
  function indexQuestions(list) {
    state.questions = list.map(normalizeQ);
    state.byId = {};
    state.questions.forEach(function (q) { state.byId[q.id] = q; });
  }
  function histKey() { return 'quiz.hist.' + state.user.id; }

  function loadQuestions() {
    if (!DEMO) {
      return fetchJson(CFG.API_URL + '?action=questions').then(function (j) { indexQuestions(j.questions || []); });
    }
    return fetchJson('demo.json').then(function (j) {
      var extra = LS.get('quiz.custom', []);
      indexQuestions((j.questions || []).concat(extra));
    });
  }
  function loadHistory() {
    var local = LS.get(histKey(), []);
    if (DEMO) { state.history = local; return Promise.resolve(); }
    return fetchJson(CFG.API_URL + '?action=history&userId=' + encodeURIComponent(state.user.id))
      .then(function (j) { state.history = j.rows || []; LS.set(histKey(), state.history); })
      .catch(function () { state.history = local; });
  }

  function grade(q, letra, tempoSeg) {
    if (DEMO) {
      var gab = String(q.gabarito || '').toUpperCase();
      return Promise.resolve({ correta: letra === gab, gabarito: gab, comentario: q.comentario || '' });
    }
    return fetchJson(CFG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'answer', userId: state.user.id, nome: state.user.nome, questaoId: q.id, resposta: letra, tempoSeg: tempoSeg })
    });
  }
  function registrar(q, correta, tempoSeg) {
    state.history.push({ timestamp: Date.now(), questaoId: q.id, area: q.area, tema: q.tema, correta: correta, tempoSeg: tempoSeg });
    LS.set(histKey(), state.history);
  }

  /* ---------- estatísticas e recomendação ---------- */
  function computeStats() {
    var now = Date.now();
    var map = {};
    state.questions.forEach(function (q) {
      var s = map[q.tema] || (map[q.tema] = { tema: q.tema, area: q.area, total: 0, n: 0, c: 0, nw: 0, cw: 0, ultima: 0 });
      s.total++;
    });
    state.history.forEach(function (h) {
      var s = map[h.tema];
      if (!s) return;
      var dias = Math.max(0, (now - h.timestamp) / 864e5);
      var w = Math.pow(0.5, dias / CFG.MEIA_VIDA_DIAS);
      s.n++; s.nw += w;
      if (h.correta) { s.c++; s.cw += w; }
      if (h.timestamp > s.ultima) s.ultima = h.timestamp;
    });
    var lista = Object.keys(map).map(function (k) {
      var s = map[k];
      s.acc = (s.cw + 1.2) / (s.nw + 2);          // acerto suavizado, com peso maior para o recente
      s.accBruto = s.n ? s.c / s.n : null;
      var dias = s.ultima ? (now - s.ultima) / 864e5 : 0;
      s.fraqueza = (1 - s.acc) + (s.n < 3 ? 0.2 : 0) + (dias > 7 ? 0.1 : 0);
      return s;
    });
    lista.sort(function (a, b) { return b.fraqueza - a.fraqueza; });
    return lista;
  }
  function recomendar() {
    if (!state.questions.length) return null;
    if (!state.history.length) return { tipo: 'diagnostico' };
    var stats = computeStats();
    var top = stats[0];
    var motivo;
    if (top.n === 0) motivo = 'Você ainda não praticou este tema.';
    else if (top.accBruto < 0.6) motivo = 'Seu acerto é de ' + pct(top.accBruto) + ' em ' + top.n + ' resposta' + (top.n > 1 ? 's' : '') + '. É onde mais vale reforçar.';
    else motivo = 'Seu acerto é de ' + pct(top.accBruto) + ' em ' + top.n + ' resposta' + (top.n > 1 ? 's' : '') + ', mas é o tema com mais espaço para crescer agora.';
    return { tipo: 'foco', tema: top.tema, area: top.area, motivo: motivo, stats: stats };
  }

  function buildSession(pool, foco, tamanho) {
    var now = Date.now();
    var stats = computeStats();
    var porTema = {};
    stats.forEach(function (s) { porTema[s.tema] = s; });
    var ultima = {};
    state.history.forEach(function (h) { ultima[h.questaoId] = h; });

    function prioridade(q) {
      var u = ultima[q.id];
      var p = 0;
      if (!u) p += 2;
      else if (!u.correta) p += 3;
      else {
        var d = (now - u.timestamp) / 864e5;
        p += d < 3 ? -3 : Math.min(d / 30, 1) * 0.5;
      }
      var s = porTema[q.tema];
      var acc = s && s.n > 0 ? s.acc : 0.6;
      var alvo = acc < 0.5 ? 0.5 : acc < 0.75 ? 1 : 1.7;
      p += 1 - Math.min(Math.abs(DIFS.indexOf(q.dificuldade) - alvo), 2) * 0.4;
      return p + Math.random() * 0.8;
    }

    var grupos = {};
    pool.forEach(function (q) { (grupos[q.tema] = grupos[q.tema] || []).push(q); });
    Object.keys(grupos).forEach(function (t) {
      grupos[t] = grupos[t].map(function (q) { return { q: q, p: prioridade(q) }; })
        .sort(function (a, b) { return b.p - a.p; });
    });
    var ordemTemas = Object.keys(grupos).sort(function (a, b) {
      return (porTema[b] ? porTema[b].fraqueza : 0) - (porTema[a] ? porTema[a].fraqueza : 0);
    });
    var tam = Math.min(tamanho, pool.length);
    var escolhidas = [];
    function pegar(t, n) {
      var g = grupos[t] || [];
      while (n > 0 && g.length) { escolhidas.push(g.shift().q); n--; }
    }
    if (foco && grupos[foco]) pegar(foco, Math.ceil(tam * 0.7));
    var guard = 0;
    while (escolhidas.length < tam && guard++ < 500) {
      var andou = false;
      for (var i = 0; i < ordemTemas.length && escolhidas.length < tam; i++) {
        var antes = escolhidas.length;
        pegar(ordemTemas[i], 1);
        if (escolhidas.length > antes) andou = true;
      }
      if (!andou) break;
    }
    return shuffle(escolhidas);
  }

  /* ---------- sessão ---------- */
  function iniciar(items, titulo) {
    if (!items.length) { alert('Não há questões para essa seleção.'); return; }
    state.sessao = { items: items, idx: 0, resultados: [], respondida: false, inicio: Date.now(), t0: Date.now(), titulo: titulo, fim: false, escolha: '' };
    state.view = 'praticar';
    render();
  }
  function iniciarSugestao() {
    var r = recomendar();
    if (!r) return;
    if (r.tipo === 'diagnostico') {
      iniciar(buildSession(state.questions, null, CFG.TAMANHO_SESSAO), 'Diagnóstico');
    } else {
      iniciar(buildSession(state.questions, r.tema, CFG.TAMANHO_SESSAO), r.tema);
    }
  }

  /* ---------- telas ---------- */
  function setTabs() {
    document.querySelectorAll('.aba').forEach(function (b) {
      if (b.dataset.view === state.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function render() {
    setTabs();
    if (state.view === 'desempenho') return viewDesempenho();
    if (state.sessao && !state.sessao.fim) return viewQuestao();
    if (state.sessao && state.sessao.fim) return viewFim();
    return viewHome();
  }

  function viewHome() {
    var r = recomendar();
    var areas = Array.from(new Set(state.questions.map(function (q) { return q.area; }))).sort();
    var f = state.filtro;
    var temas = Array.from(new Set(state.questions.filter(function (q) { return !f.area || q.area === f.area; }).map(function (q) { return q.tema; }))).sort();
    if (f.tema && temas.indexOf(f.tema) < 0) f.tema = '';

    var cartao;
    if (!r) {
      cartao = el('section', { class: 'sugestao' }, el('h2', { text: 'Sem questões ainda' }),
        el('p', { class: 'motivo', text: 'Importe uma prova em PDF ou adicione questões à planilha para começar.' }),
        el('a', { class: 'btn', href: 'importar.html', text: 'Importar prova' }));
    } else if (r.tipo === 'diagnostico') {
      cartao = el('section', { class: 'sugestao' },
        el('h2', { text: 'Comece por um diagnóstico' }),
        el('p', { class: 'motivo', text: 'São ' + Math.min(CFG.TAMANHO_SESSAO, state.questions.length) + ' questões de temas variados. Com suas respostas, passo a sugerir o que estudar primeiro.' }),
        el('div', { class: 'acoes' }, el('button', { class: 'btn', type: 'button', onclick: iniciarSugestao, text: 'Começar diagnóstico' })));
    } else {
      cartao = el('section', { class: 'sugestao' },
        el('h2', { text: 'Próxima atividade: ' + r.tema }),
        el('p', { class: 'motivo', text: r.motivo }),
        el('div', { class: 'acoes' },
          el('button', { class: 'btn', type: 'button', onclick: iniciarSugestao, text: 'Começar ' + Math.min(CFG.TAMANHO_SESSAO, state.questions.length) + ' questões' }),
          el('span', { class: 'detalhe', text: r.area + ' · maior parte das questões nesse tema, o restante nos próximos mais fracos' })));
    }

    var chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Área' });
    [''].concat(areas).forEach(function (a) {
      chips.appendChild(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(f.area === a), text: a || 'Todas',
        onclick: function () { f.area = a; f.tema = ''; viewHome(); }
      }));
    });
    var sel = el('select', { id: 'sel-tema', onchange: function (e) { f.tema = e.target.value; } },
      el('option', { value: '', text: 'Todos os temas' }),
      temas.map(function (t) { return el('option', { value: t, text: t, selected: f.tema === t }); }));

    var livre = el('section', { class: 'secao' },
      el('h2', { text: 'Praticar por conta própria' }),
      el('div', { class: 'filtros' }, chips,
        el('div', { class: 'linha-filtro' },
          el('label', { class: 'campo' }, el('span', { text: 'Tema' }), sel),
          el('button', {
            class: 'btn-sec', type: 'button', text: 'Começar',
            onclick: function () {
              var pool = state.questions.filter(function (q) { return (!f.area || q.area === f.area) && (!f.tema || q.tema === f.tema); });
              iniciar(buildSession(pool, f.tema || null, CFG.TAMANHO_SESSAO), f.tema || f.area || 'Livre');
            }
          }))));

    root.replaceChildren(
      el('h1', { class: 'titulo-pagina', text: state.user.nome ? 'Olá, ' + state.user.nome : 'Vamos estudar' }),
      el('p', { class: 'apoio', text: state.questions.length + ' questões no banco. Uma por vez, com correção na hora.' }),
      cartao, livre);
  }

  function viewQuestao() {
    var s = state.sessao, q = s.items[s.idx];
    var folha = el('ol', { class: 'folha', 'aria-label': 'Progresso da atividade' });
    s.items.forEach(function (_, i) {
      var r = s.resultados[i];
      var est = r ? (r.correta ? 'ok' : 'erro') : (i === s.idx ? 'atual' : '');
      folha.appendChild(el('li', { 'data-estado': est, text: String(i + 1), 'aria-label': 'Questão ' + (i + 1) + (r ? (r.correta ? ', certa' : ', errada') : i === s.idx ? ', atual' : '') }));
    });

    var meta = el('div', { class: 'meta-q' },
      el('b', { text: q.tema }), el('span', { text: q.area }),
      (q.banca || q.orgao || q.ano) ? el('span', { text: [q.banca, q.orgao, q.ano].filter(Boolean).join(' ') }) : null,
      el('span', { text: 'nível ' + DIF_NOME[q.dificuldade] }));

    var enun = el('p', { class: 'enunciado', id: 'enun', text: q.enunciado });
    var grupo = el('fieldset', { class: 'opcoes', 'aria-labelledby': 'enun' });
    Object.keys(q.opcoes).sort().forEach(function (L) {
      var inp = el('input', { type: 'radio', name: 'op', value: L, onchange: function () { s.escolha = L; btnOk.disabled = false; } });
      grupo.appendChild(el('label', { class: 'opcao', 'data-letra': L }, inp,
        el('span', { class: 'bolha', 'aria-hidden': 'true', text: L }),
        el('span', { class: 'texto' }, el('span', { class: 'sr-only', text: 'Alternativa ' + L + '. ' }), q.opcoes[L])));
    });

    var feedback = el('div', { role: 'status', 'aria-live': 'polite' });
    var btnOk = el('button', { class: 'btn', type: 'button', disabled: true, text: 'Responder', onclick: confirmar });
    var acoes = el('div', { class: 'acoes-q' }, btnOk,
      el('button', { class: 'btn-sec', type: 'button', text: 'Encerrar atividade', onclick: function () { if (confirm('Encerrar agora? As respostas já dadas ficam salvas.')) { s.fim = true; render(); } } }),
      el('span', { class: 'dica-teclas', text: 'Teclas A a E escolhem, Enter confirma.' }));

    root.replaceChildren(folha, meta, enun, grupo, feedback, acoes);
    s.t0 = Date.now();
    s.respondida = false;
    s.escolha = '';

    function confirmar() {
      if (s.respondida) return proxima();
      if (!s.escolha) return;
      var letra = s.escolha;
      var tempo = Math.round((Date.now() - s.t0) / 1000);
      btnOk.disabled = true; btnOk.textContent = 'Corrigindo…';
      grupo.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
      grade(q, letra, tempo).then(function (r) {
        s.respondida = true;
        registrar(q, r.correta, tempo);
        s.resultados[s.idx] = { q: q, resposta: letra, correta: r.correta, gabarito: r.gabarito, comentario: r.comentario };
        grupo.classList.add('travado');
        grupo.querySelectorAll('.opcao').forEach(function (o) {
          var L = o.getAttribute('data-letra');
          var t = o.querySelector('.texto');
          if (L === r.gabarito) { o.classList.add('certa'); t.appendChild(el('strong', { class: 'rot', text: ' (gabarito)' })); }
          else if (L === letra) { o.classList.add('errada'); t.appendChild(el('strong', { class: 'rot', text: ' (sua resposta)' })); }
        });
        feedback.replaceChildren(el('div', { class: 'resultado' + (r.correta ? '' : ' errou') },
          el('h3', { text: r.correta ? 'Correta' : 'Incorreta. O gabarito é ' + r.gabarito }),
          r.comentario ? el('p', { text: r.comentario }) : el('p', { class: 'apoio', text: 'Esta questão ainda não tem comentário.' })));
        var ultimo = s.idx === s.items.length - 1;
        btnOk.disabled = false; btnOk.textContent = ultimo ? 'Ver resultado' : 'Próxima questão';
        btnOk.focus();
      }).catch(function (e) {
        grupo.querySelectorAll('input').forEach(function (i) { i.disabled = false; });
        btnOk.disabled = false; btnOk.textContent = 'Responder';
        feedback.replaceChildren(el('div', { class: 'erro-box' },
          el('h3', { text: 'Não foi possível registrar sua resposta' }),
          el('p', { text: e.message + ' Sua escolha foi mantida; tente responder de novo.' })));
      });
    }
    function proxima() {
      if (s.idx >= s.items.length - 1) { s.fim = true; } else { s.idx++; }
      render();
      root.focus();
    }
  }

  function viewFim() {
    var s = state.sessao;
    var feitas = s.resultados.filter(Boolean);
    var certas = feitas.filter(function (r) { return r.correta; }).length;
    var erradas = feitas.filter(function (r) { return !r.correta; });
    var rec = recomendar();

    var partes = [
      el('h1', { class: 'titulo-pagina', text: 'Atividade concluída' }),
      el('p', { class: 'apoio', text: s.titulo }),
      el('p', { class: 'placar' }, String(certas), el('small', { text: ' de ' + feitas.length + ' certas' }))
    ];
    if (rec && rec.tipo === 'foco') {
      partes.push(el('section', { class: 'sugestao' },
        el('h2', { text: 'Próxima atividade: ' + rec.tema }),
        el('p', { class: 'motivo', text: rec.motivo }),
        el('div', { class: 'acoes' },
          el('button', { class: 'btn', type: 'button', text: 'Começar agora', onclick: iniciarSugestao }),
          el('button', { class: 'btn-sec', type: 'button', text: 'Voltar ao início', onclick: function () { state.sessao = null; render(); } }))));
    } else {
      partes.push(el('div', { class: 'acoes-q' }, el('button', { class: 'btn', type: 'button', text: 'Voltar ao início', onclick: function () { state.sessao = null; render(); } })));
    }
    if (erradas.length) {
      partes.push(el('section', { class: 'secao' }, el('h2', { text: 'Para revisar' }),
        el('ul', { class: 'lista-rev' }, erradas.map(function (r) {
          return el('li', {},
            el('p', { class: 'q', text: r.q.enunciado }),
            el('p', { class: 'gab', text: 'Gabarito ' + r.gabarito + ': ' + (r.q.opcoes[r.gabarito] || '') }),
            r.comentario ? el('p', { class: 'com', text: r.comentario }) : null);
        }))));
    }
    root.replaceChildren.apply(root, partes);
    root.focus();
  }

  function viewDesempenho() {
    var total = state.history.length;
    var certas = state.history.filter(function (h) { return h.correta; }).length;
    var vistas = new Set(state.history.map(function (h) { return h.questaoId; })).size;
    var stats = computeStats();
    var rec = recomendar();

    if (!total) {
      root.replaceChildren(el('h1', { class: 'titulo-pagina', text: 'Desempenho' }),
        el('p', { class: 'vazio', text: 'Nada por aqui ainda. Responda uma atividade e seus resultados por tema aparecem nesta tela.' }));
      return;
    }
    var porArea = {};
    stats.forEach(function (s) {
      var a = porArea[s.area] || (porArea[s.area] = { area: s.area, n: 0, c: 0 });
      a.n += s.n; a.c += s.c;
    });

    function linha(nome, areaTxt, n, c, tag, nota) {
      var a = n ? c / n : null;
      var nivel = a == null ? '' : a < 0.5 ? 'fraco' : a >= 0.75 ? 'bom' : '';
      return el('li', { class: 'tema-item' },
        el('span', { class: 'nome' }, nome, areaTxt ? el('span', { class: 'area', text: areaTxt }) : null, tag ? el('span', { class: 'tag', text: tag }) : null),
        el('span', { class: 'num', text: a == null ? 'sem respostas' : pct(a) + ' · ' + c + '/' + n }),
        el('div', { class: 'barra', role: 'img', 'aria-label': a == null ? 'Sem respostas' : 'Acerto de ' + pct(a) }, el('i', { 'data-n': nivel, style: 'width:' + (a == null ? 0 : Math.round(a * 100)) + '%' })),
        nota ? el('span', { class: 'nota', text: nota }) : null);
    }

    var temasOrd = stats.slice().sort(function (a, b) { return b.fraqueza - a.fraqueza; });
    root.replaceChildren(
      el('h1', { class: 'titulo-pagina', text: 'Desempenho' }),
      el('div', { class: 'resumo' },
        el('div', {}, el('b', { text: String(total) }), el('span', { text: 'respostas' })),
        el('div', {}, el('b', { text: pct(certas / total) }), el('span', { text: 'de acerto geral' })),
        el('div', {}, el('b', { text: vistas + '/' + state.questions.length }), el('span', { text: 'questões já vistas' }))),
      el('section', { class: 'secao' }, el('h2', { text: 'Por área' }),
        el('ul', { class: 'tema-lista' }, Object.keys(porArea).sort().map(function (k) {
          return linha(k, '', porArea[k].n, porArea[k].c);
        }))),
      el('section', { class: 'secao' }, el('h2', { text: 'Por tema, do que mais precisa de atenção ao menos' }),
        el('ul', { class: 'tema-lista' }, temasOrd.map(function (s) {
          var sug = rec && rec.tipo === 'foco' && rec.tema === s.tema;
          return linha(s.tema, s.area, s.n, s.c, sug ? 'Sugerido' : '', s.n === 0 ? 'Ainda não praticado · ' + s.total + ' questões' : s.total + ' questões no banco');
        }))));
    root.focus();
  }

  /* ---------- eventos globais ---------- */
  document.querySelectorAll('.aba').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.dataset.view; render(); });
  });
  document.addEventListener('keydown', function (e) {
    var s = state.sessao;
    if (!s || s.fim || state.view !== 'praticar') return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'radio') return;
    if (document.getElementById('dlg-conta').open) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toUpperCase();
    if (!s.respondida && /^[A-E]$/.test(k)) {
      var inp = root.querySelector('input[value="' + k + '"]');
      if (inp && !inp.disabled) { inp.checked = true; inp.dispatchEvent(new Event('change')); }
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      var b = root.querySelector('.acoes-q .btn');
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }
  });

  /* ---------- conta ---------- */
  var dlg = document.getElementById('dlg-conta');
  document.getElementById('btn-conta').addEventListener('click', function () {
    document.getElementById('in-nome').value = state.user.nome || '';
    document.getElementById('in-codigo').value = state.user.id;
    document.getElementById('txt-modo').textContent = DEMO
      ? 'Modo demonstração: o histórico fica só neste navegador.'
      : 'Conectado à sua planilha. O histórico fica salvo nela.';
    document.getElementById('btn-zerar').hidden = !DEMO;
    dlg.showModal();
  });
  document.getElementById('btn-fechar').addEventListener('click', function () { dlg.close(); });
  document.getElementById('btn-zerar').addEventListener('click', function () {
    if (!confirm('Apagar todo o histórico deste aparelho?')) return;
    LS.del(histKey()); state.history = []; state.sessao = null; dlg.close(); render();
  });
  document.getElementById('form-conta').addEventListener('submit', function (e) {
    var sub = e.submitter && e.submitter.value;
    if (sub !== 'salvar') return;
    var nome = document.getElementById('in-nome').value.trim();
    var cod = document.getElementById('in-codigo').value.trim().replace(/[^\w.\-@]/g, '').slice(0, 40);
    var mudouId = cod && cod !== state.user.id;
    state.user.nome = nome;
    if (mudouId) state.user.id = cod;
    LS.set('quiz.user', state.user);
    if (mudouId) { state.sessao = null; loadHistory().then(render); } else { render(); }
  });

  /* ---------- início ---------- */
  function iniciarApp() {
    root.replaceChildren(el('p', { class: 'carregando', text: 'Carregando questões…' }));
    Promise.all([loadQuestions(), loadHistory()]).then(render).catch(function (e) {
      root.replaceChildren(el('div', { class: 'erro-box' },
        el('h3', { text: 'Não foi possível carregar as questões' }),
        el('p', { text: e.message }),
        el('div', { class: 'acoes' }, el('button', { class: 'btn', type: 'button', text: 'Tentar de novo', onclick: iniciarApp }))));
    });
  }
  iniciarApp();
})();
