/* Importador de provas: PDF -> visor com seleção de texto -> lista de revisão -> banco. */
(function () {
  'use strict';

  var CFG = Object.assign({ API_URL: '' }, window.QUIZ_CONFIG || {});
  var DEMO = !CFG.API_URL;
  var LETRAS = ['A', 'B', 'C', 'D', 'E'];
  var AREAS = ['Educação', 'Administração', 'Direito', 'Não classificada'];
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var RASCUNHO = 'quiz.rascunho';

  var S = { pdf: null, nomeArquivo: '', pagina: 1, zoom: 1, token: 0, tarefa: null, questoes: [], selecao: '' };
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

  /* ================= PDF ================= */
  function prepararPdfjs() {
    if (!window.pdfjsLib) throw new Error('A biblioteca de leitura de PDF não carregou. Verifique a conexão e recarregue a página.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
  function abrirDoc(arquivo) {
    prepararPdfjs();
    return arquivo.arrayBuffer().then(function (buf) { return pdfjsLib.getDocument({ data: buf }).promise; });
  }

  /** Texto de uma página em linhas (usado só na separação automática e na detecção de banca/ano). */
  function paginaParaTexto(page) {
    var W = page.getViewport({ scale: 1 }).width;
    return page.getTextContent().then(function (tc) {
      var itens = tc.items.filter(function (it) { return it.str && it.str.trim() !== ''; }).map(function (it) {
        return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 };
      });
      if (!itens.length) return '';
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
