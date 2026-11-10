/* Taxonomia de áreas e temas + classificador por palavras-chave.
   Para ampliar: acrescente temas ou palavras na lista (sem acento, em minúsculas). */
(function (root) {
  'use strict';

  var TAXONOMIA = [
    // ---------------- Educação
    { area: 'Educação', tema: 'LDB', palavras: ['ldb', '9.394', '9394', 'educacao basica', 'diretrizes e bases da educacao', 'lei de diretrizes e bases', 'sistemas de ensino', 'educacao basica obrigatoria', 'calendario escolar', 'carga horaria minima', 'profissionais da educacao'] },
    { area: 'Educação', tema: 'BNCC', palavras: ['bncc', 'base nacional comum curricular', 'competencias gerais', 'campos de experiencia', 'objetos de conhecimento', 'direitos de aprendizagem', 'competencias especificas', 'habilidades da bncc'] },
    { area: 'Educação', tema: 'Teorias da aprendizagem', palavras: ['piaget', 'vygotsky', 'vigotski', 'wallon', 'ausubel', 'skinner', 'bruner', 'behaviorismo', 'comportamentalis', 'construtivis', 'sociointeracion', 'zona de desenvolvimento proximal', 'aprendizagem significativa', 'cognitivis', 'estagio operatorio', 'sensorio-motor', 'assimilacao', 'acomodacao', 'equilibracao', 'mediacao', 'inatismo', 'ambientalismo', 'psicogenese'] },
    { area: 'Educação', tema: 'Avaliação', palavras: ['avaliacao da aprendizagem', 'avaliacao formativa', 'avaliacao somativa', 'avaliacao diagnostica', 'avaliacao classificatoria', 'avaliacao mediadora', 'recuperacao paralela', 'rendimento escolar', 'instrumentos avaliativos', 'instrumento de avaliacao', 'avaliacao institucional', 'avaliacao em larga escala', 'saeb', 'ideb', 'avaliacao processual', 'prova', 'feedback'] },
    { area: 'Educação', tema: 'Educação inclusiva', palavras: ['inclusiva', 'inclusao escolar', 'educacao especial', 'deficiencia', 'atendimento educacional especializado', 'aee', 'altas habilidades', 'superdotacao', 'transtorno do espectro autista', 'tea', 'libras', 'acessibilidade', 'tecnologia assistiva', 'lei brasileira de inclusao', '13.146', 'sala de recursos', 'transtornos globais do desenvolvimento', 'barreiras', 'necessidades educacionais especiais', 'dislexia', 'tdah'] },
    { area: 'Educação', tema: 'Didática e currículo', palavras: ['didatica', 'curriculo', 'curricular', 'plano de ensino', 'plano de aula', 'sequencia didatica', 'metodologia de ensino', 'interdisciplinar', 'transversal', 'contextualizacao', 'transposicao didatica', 'planejamento de ensino', 'projeto de trabalho', 'metodologias ativas', 'aprendizagem baseada em projetos', 'curriculo oculto', 'estrategias de ensino'] },
    { area: 'Educação', tema: 'Fundamentos e tendências pedagógicas', palavras: ['paulo freire', 'saviani', 'libaneo', 'dewey', 'anisio teixeira', 'escola nova', 'pedagogia tradicional', 'tecnicista', 'pedagogia libertadora', 'libertaria', 'historico-critica', 'critico-social', 'tendencias pedagogicas', 'educacao bancaria', 'rousseau', 'comenius', 'durkheim', 'montessori', 'pestalozzi', 'froebel', 'manifesto dos pioneiros', 'historia da educacao', 'pedagogia critica', 'emancipacao', 'educacao popular'] },
    { area: 'Educação', tema: 'Educação infantil', palavras: ['educacao infantil', 'creche', 'pre-escola', 'brincar', 'brincadeira', 'dcnei', 'interacoes e brincadeira', 'crianca pequena', 'bebes', 'cuidar e educar', 'ludico', 'ludicidade', 'jogos e brincadeiras'] },
    { area: 'Educação', tema: 'Alfabetização e letramento', palavras: ['alfabetizacao', 'letramento', 'consciencia fonologica', 'emilia ferreiro', 'teberosky', 'hipotese silabica', 'hipotese alfabetica', 'hipotese pre-silabica', 'pnaic', 'leitura e escrita', 'magda soares', 'metodo fonico', 'metodo global', 'alfabetizar', 'sistema de escrita alfabetica'] },
    { area: 'Educação', tema: 'Tecnologias na educação', palavras: ['tecnologias digitais', 'tic', 'educacao a distancia', 'ensino remoto', 'ensino hibrido', 'sala de aula invertida', 'ambiente virtual de aprendizagem', 'letramento digital', 'cultura digital', 'inteligencia artificial'] },

    // ---------------- Administração
    { area: 'Administração', tema: 'Processo administrativo', palavras: ['funcoes administrativas', 'processo administrativo', 'planejar, organizar', 'organizacao formal', 'organograma', 'departamentalizacao', 'centralizacao', 'descentralizacao', 'delegacao', 'amplitude de controle', 'teoria geral da administracao', 'taylor', 'fayol', 'weber', 'burocracia', 'teoria classica', 'relacoes humanas', 'teoria sistemica', 'contingencial', 'fluxograma'] },
    { area: 'Administração', tema: 'Planejamento', palavras: ['planejamento estrategico', 'planejamento tatico', 'planejamento operacional', 'missao', 'visao de futuro', 'swot', 'analise swot', 'objetivos estrategicos', 'plano de acao', '5w2h', 'cenarios', 'balanced scorecard', 'bsc', 'metas e indicadores', 'planejamento participativo'] },
    { area: 'Administração', tema: 'Liderança', palavras: ['lideranca', 'lider', 'liderados', 'lideranca situacional', 'lideranca transformacional', 'lideranca autocratica', 'lideranca democratica', 'laissez-faire', 'hersey', 'blanchard', 'grid gerencial', 'estilos de lideranca', 'poder e autoridade'] },
    { area: 'Administração', tema: 'Gestão de pessoas', palavras: ['gestao de pessoas', 'motivacao', 'maslow', 'herzberg', 'mcgregor', 'vroom', 'clima organizacional', 'cultura organizacional', 'avaliacao de desempenho', 'recrutamento', 'selecao de pessoal', 'treinamento e desenvolvimento', 'capacitacao', 'equipe', 'conflito', 'comunicacao organizacional', 'competencias profissionais', 'qualidade de vida no trabalho', 'recursos humanos', 'hierarquia das necessidades'] },
    { area: 'Administração', tema: 'Gestão escolar', palavras: ['gestao escolar', 'gestao democratica', 'conselho escolar', 'projeto politico-pedagogico', 'projeto politico pedagogico', 'ppp', 'diretor escolar', 'coordenacao pedagogica', 'coordenador pedagogico', 'supervisao escolar', 'regimento escolar', 'conselho de classe', 'grêmio', 'gremio estudantil', 'autonomia da escola', 'associacao de pais e mestres', 'pdde', 'administracao escolar', 'orientacao educacional', 'comunidade escolar', 'proposta pedagogica'] },
    { area: 'Administração', tema: 'Administração pública', palavras: ['administracao publica', 'administracao gerencial', 'administracao burocratica', 'patrimonialismo', 'new public management', 'reforma gerencial', 'governanca', 'accountability', 'orcamento publico', 'ppa', 'ldo', 'loa', 'lei de responsabilidade fiscal', 'terceiro setor', 'organizacoes sociais', 'oscip', 'gestao por resultados', 'transparencia', 'controle social', 'eficiencia no setor publico'] },
    { area: 'Administração', tema: 'Gestão da qualidade e projetos', palavras: ['pdca', 'gestao da qualidade', 'qualidade total', 'ciclo pdca', 'melhoria continua', 'gestao de projetos', 'pmbok', 'cronograma', 'escopo do projeto', 'diagrama de ishikawa', 'diagrama de pareto', 'kaizen', 'seis sigma', 'lean', 'indicadores de desempenho', 'gestao de processos', 'mapeamento de processos'] },

    // ---------------- Direito
    { area: 'Direito', tema: 'Direito Constitucional', palavras: ['constituicao federal', 'constituicao da republica', 'cf/88', 'cf/1988', 'direitos fundamentais', 'direitos e garantias', 'art. 5', 'art. 37', 'art. 205', 'art. 206', 'art. 208', 'art. 211', 'art. 212', 'poder constituinte', 'controle de constitucionalidade', 'mandado de seguranca', 'habeas corpus', 'habeas data', 'acao popular', 'emenda constitucional', 'separacao de poderes', 'federacao', 'competencia legislativa', 'competencia concorrente', 'principios fundamentais', 'direitos sociais', 'stf'] },
    { area: 'Direito', tema: 'ECA', palavras: ['eca', 'estatuto da crianca', '8.069', 'crianca e do adolescente', 'conselho tutelar', 'ato infracional', 'medidas socioeducativas', 'medida de protecao', 'guarda e tutela', 'adocao', 'doutrina da protecao integral', 'prioridade absoluta', 'poder familiar', 'trabalho do adolescente', 'aprendiz'] },
    { area: 'Direito', tema: 'Direito Administrativo', palavras: ['direito administrativo', 'ato administrativo', 'atos administrativos', 'licitacao', 'licitacoes', 'lei 14.133', '14.133', '8.666', 'contrato administrativo', 'pregao', 'concorrencia', 'servidor publico', 'lei 8.112', '8.112', 'improbidade', '8.429', 'processo administrativo disciplinar', 'pad', 'sindicancia', 'poder de policia', 'poder hierarquico', 'poder disciplinar', 'responsabilidade civil do estado', 'servicos publicos', 'concessao', 'permissao', 'autarquia', 'fundacao publica', 'empresa publica', 'sociedade de economia mista', 'bens publicos', 'desapropriacao', 'lei 9.784', '9.784', 'agentes publicos', 'cargo publico', 'estagio probatorio', 'estabilidade', 'vacancia', 'autoexecutoriedade', 'imperatividade', 'presuncao de legitimidade', 'discricionariedade', 'vinculado', 'lia', 'lindb', 'principios da administracao'] },
    { area: 'Direito', tema: 'Direito Educacional', palavras: ['plano nacional de educacao', 'pne', 'lei 13.005', 'fundeb', 'fundo de manutencao e desenvolvimento da educacao basica', 'lei do piso', '11.738', 'piso salarial profissional nacional', 'diretrizes curriculares nacionais', 'conselho nacional de educacao', 'cne', 'regime de colaboracao', 'sistema nacional de educacao', 'financiamento da educacao', 'salario-educacao', 'manutencao e desenvolvimento do ensino', 'mde', 'carreira do magisterio', 'estatuto do magisterio', 'plano de carreira', 'lei 14.113', 'pnae', 'pnld', 'transporte escolar', 'direito a educacao', 'ensino religioso', 'educacao escolar indigena', 'educacao do campo', 'educacao de jovens e adultos', 'eja', 'educacao quilombola', 'relacoes etnico-raciais', '10.639', '11.645', 'educacao profissional'] }
  ];

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  var cache = TAXONOMIA.map(function (t) {
    return { area: t.area, tema: t.tema, palavras: t.palavras.map(norm) };
  });

  function contar(texto, palavra) {
    var n = 0, pos = 0;
    while (n < 3 && (pos = texto.indexOf(palavra, pos)) >= 0) {
      // palavras muito curtas só contam como termo inteiro
      if (palavra.length <= 4) {
        var a = texto.charAt(pos - 1), b = texto.charAt(pos + palavra.length);
        if (/[a-z0-9]/.test(a) || /[a-z0-9]/.test(b)) { pos += palavra.length; continue; }
      }
      n++; pos += palavra.length;
    }
    return n;
  }

  /** Retorna { area, tema, score, confianca } — área "Não classificada" se faltar sinal. */
  function classificar(enunciado, opcoes, comentario, secao) {
    var corpo = norm(enunciado);
    var resto = norm(Object.keys(opcoes || {}).map(function (k) { return opcoes[k]; }).join(' ') + ' ' + (comentario || '') + ' ' + (secao || ''));
    var pontos = cache.map(function (t) {
      var s = 0;
      t.palavras.forEach(function (p) {
        var peso = (p.length >= 9 || p.length <= 4) ? 2 : 1;
        s += contar(corpo, p) * peso * 2 + contar(resto, p) * peso;
      });
      return { area: t.area, tema: t.tema, score: s };
    }).sort(function (a, b) { return b.score - a.score; });
    var top = pontos[0], seg = pontos[1];
    if (!top || top.score < 3) return { area: 'Não classificada', tema: 'Revisar', score: top ? top.score : 0, confianca: 0 };
    var conf = top.score / (top.score + (seg ? seg.score : 0));
    return { area: top.area, tema: top.tema, score: top.score, confianca: Math.round(conf * 100) / 100 };
  }

  var api = { TAXONOMIA: TAXONOMIA, classificar: classificar, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Taxonomia = api;
})(typeof window !== 'undefined' ? window : globalThis);
