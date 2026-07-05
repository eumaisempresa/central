// =============================================================================
// CENTRAL DO GESTOR EU⁺ — CONFIGURAÇÃO SUPABASE
// =============================================================================

const SUPABASE_URL = 'https://mjlcfhzqhcqsldjxaggc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_60gCcEFSLY_HCabrjunGYA_cB58xve4';

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
      emailRedirectTo: window.location.origin + '/central/admin.html'
    }
  });
  return { data, error };
}

// Logout
async function logout() {
  await db.auth.signOut();
  window.location.href = 'login.html';
}

// Pegar usuário atual — COM ESPERA pela sessão
async function getUsuarioAtual() {
  // Primeiro tenta pegar a sessão existente
  const { data: { session } } = await db.auth.getSession();
  if (session && session.user) {
    return session.user;
  }
  // Se não tem sessão imediata, espera o onAuthStateChange resolver
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 3000); // espera no máximo 3 segundos

    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      resolve(session ? session.user : null);
    });
  });
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
  // Usa .maybeSingle() em vez de .single() para não dar erro se não encontrar
  const { data: rede, error: erroRede } = await db
    .from('rede_comercial')
    .select('id, nivel, nome')
    .eq('auth_user_id', userId)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle();

  console.log('[Central] detectarPapel - userId:', userId);
  console.log('[Central] detectarPapel - rede:', rede, 'erro:', erroRede);

  if (rede) {
    return { tipo: 'rede', nivel: rede.nivel, nome: rede.nome, id: rede.id };
  }

  // Se não é rede, verifica se é cliente
  const { data: cliente, error: erroCliente } = await db
    .from('clientes')
    .select('id, id_universal, nome')
    .eq('auth_user_id', userId)
    .limit(1)
    .maybeSingle();

  console.log('[Central] detectarPapel - cliente:', cliente, 'erro:', erroCliente);

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
  console.log('[Central] redirecionarPorPapel - user:', user);

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const papel = await detectarPapel(user.id);
  console.log('[Central] redirecionarPorPapel - papel:', papel);

  if (!papel) {
    // Usuário autenticado mas não cadastrado — mostra erro em vez de loop
    alert('Usuário autenticado mas não encontrado na rede comercial. Verifique se o auth_user_id está correto no banco.');
    await db.auth.signOut();
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
  console.log('[Central] protegerPagina - user:', user);

  if (!user) {
    window.location.href = 'login.html';
    return null;
  }

  const papel = await detectarPapel(user.id);
  console.log('[Central] protegerPagina - papel:', papel, 'permitidos:', niveisPermitidos);

  if (!papel || !niveisPermitidos.includes(papel.nivel)) {
    window.location.href = 'login.html';
    return null;
  }

  return papel;
}

// =============================================================================
// LISTENER DE MUDANÇA DE ESTADO DE AUTH (sem redirect automático para evitar loop)
// =============================================================================

db.auth.onAuthStateChange((event, session) => {
  console.log('[Central] authStateChange:', event);
  if (event === 'SIGNED_OUT' && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
  }
});
