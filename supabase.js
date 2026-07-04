// =============================================================================
// CENTRAL DO GESTOR EU⁺ — CONFIGURAÇÃO SUPABASE
// =============================================================================

const SUPABASE_URL = 'https://SEU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

// Inicializa o client Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Expõe globalmente
window.db = db;

// =============================================================================
// FUNÇÕES DE AUTENTICAÇÃO
// =============================================================================

// Login com email + senha
async function loginComSenha(email, senha) {
  const { data, error } = await db.auth.signInWithPassword({
    email: email,
    password: senha
  });
  return { data, error };
}

// Login com magic link
async function loginComMagicLink(email) {
  const { data, error } = await db.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: window.location.origin + '/admin.html'
    }
  });
  return { data, error };
}

// Logout
async function logout() {
  await db.auth.signOut();
  window.location.href = 'login.html';
}

// Pegar usuário atual
async function getUsuarioAtual() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

// Pegar sessão atual
async function getSessao() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

// =============================================================================
// DETECÇÃO DE PAPEL (Presidência, Gestor ou Cliente)
// =============================================================================

async function detectarPapel(userId) {
  // Primeiro verifica se é da rede comercial (presidência/diretor/gerente/lider/vendedor)
  const { data: rede, error: erroRede } = await db
    .from('rede_comercial')
    .select('id, nivel, nome')
    .eq('auth_user_id', userId)
    .single();

  if (rede) {
    return { tipo: 'rede', nivel: rede.nivel, nome: rede.nome, id: rede.id };
  }

  // Se não é rede, verifica se é cliente
  const { data: cliente, error: erroCliente } = await db
    .from('clientes')
    .select('id, id_universal, nome')
    .eq('auth_user_id', userId)
    .single();

  if (cliente) {
    return { tipo: 'cliente', nivel: 'cliente', nome: cliente.nome, id: cliente.id, id_universal: cliente.id_universal };
  }

  // Não encontrado em nenhuma tabela
  return null;
}

// =============================================================================
// REDIRECIONAMENTO POR PAPEL
// =============================================================================

async function redirecionarPorPapel() {
  const user = await getUsuarioAtual();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const papel = await detectarPapel(user.id);
  if (!papel) {
    // Usuário autenticado mas não cadastrado — redireciona para login com aviso
    await logout();
    return;
  }

  if (papel.nivel === 'presidencia') {
    if (!window.location.href.includes('admin.html')) {
      window.location.href = 'admin.html';
    }
  } else if (['diretor', 'gerente', 'lider', 'vendedor'].includes(papel.nivel)) {
    if (!window.location.href.includes('gestor.html')) {
      window.location.href = 'gestor.html';
    }
  } else if (papel.nivel === 'cliente') {
    if (!window.location.href.includes('cliente.html')) {
      window.location.href = 'cliente.html';
    }
  }

  return papel;
}

// =============================================================================
// PROTEÇÃO DE PÁGINA (colocar no início de admin.html, gestor.html, cliente.html)
// =============================================================================

async function protegerPagina(niveisPermitidos) {
  const user = await getUsuarioAtual();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }

  const papel = await detectarPapel(user.id);
  if (!papel || !niveisPermitidos.includes(papel.nivel)) {
    window.location.href = 'login.html';
    return null;
  }

  return papel;
}

// =============================================================================
// LISTENER DE MUDANÇA DE ESTADO DE AUTH
// =============================================================================

db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    window.location.href = 'login.html';
  }
});
