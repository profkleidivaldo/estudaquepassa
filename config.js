// Configuração do site.
//
// API_URL: cole aqui a URL do Web App do Apps Script (termina em /exec).
// Deixe vazio ("") para usar o MODO DEMONSTRAÇÃO: usa o banco de exemplo
// (demo.json) e guarda seu histórico só neste navegador.
window.QUIZ_CONFIG = {
  API_URL: "",
  TAMANHO_SESSAO: 10,      // questões por atividade
  MEIA_VIDA_DIAS: 14       // quanto tempo uma resposta "pesa" na recomendação
};
