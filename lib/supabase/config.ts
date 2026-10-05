// Valeurs nettoyées : un copier-coller dans Vercel laisse souvent des espaces, un retour à la ligne
// ou des guillemets, que Supabase refuse ensuite (« Invalid API key », URL invalide).
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();

export const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
export const supabaseAnonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Sans variables d'env, l'app tourne en mode démo (données fictives, pas d'auth). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function jwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

/**
 * Problèmes de configuration Supabase, sans jamais afficher les valeurs elles-mêmes.
 * Tableau vide : configuration valide (ou mode démo voulu, les deux variables vides).
 */
export function supabaseConfigIssues(url = supabaseUrl, key = supabaseAnonKey): string[] {
  if (!url && !key) return [];
  const issues: string[] = [];
  if (!url) issues.push("NEXT_PUBLIC_SUPABASE_URL est vide alors que la clé est définie : l'app reste en mode démo.");
  if (!key) issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY est vide alors que l'URL est définie : l'app reste en mode démo.");

  let ref: string | null = null;
  if (url) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      issues.push("NEXT_PUBLIC_SUPABASE_URL n'est pas une URL valide (attendu : https://<projet>.supabase.co).");
    }
    if (parsed) {
      const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (parsed.hostname === "supabase.com" || parsed.hostname.endsWith(".supabase.com")) {
        issues.push("NEXT_PUBLIC_SUPABASE_URL pointe vers le tableau de bord Supabase. Prendre l'URL du projet : Settings → API → Project URL (https://<projet>.supabase.co).");
      } else if (parsed.protocol !== "https:" && !local) {
        issues.push("NEXT_PUBLIC_SUPABASE_URL doit commencer par https://.");
      }
      if (parsed.pathname !== "/" || parsed.search) {
        issues.push("NEXT_PUBLIC_SUPABASE_URL ne doit contenir que l'adresse du projet, sans chemin (pas de /rest/v1 ni /auth/v1).");
      }
      ref = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null;
    }
  }

  if (key) {
    if (key.startsWith("sb_secret_")) {
      issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY contient une clé SECRÈTE (sb_secret_…), visible par tous dans le navigateur. Utiliser la clé publishable / anon, et régénérer la clé secrète.");
    } else if (!key.startsWith("sb_publishable_")) {
      const payload = jwtPayload(key);
      if (!payload) {
        issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY n'a pas le format d'une clé Supabase (clé anon « eyJ… » ou « sb_publishable_… »).");
      } else {
        if (payload.role === "service_role") {
          issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY contient la clé service_role, visible par tous dans le navigateur. Utiliser la clé anon, et régénérer la clé service_role.");
        } else if (payload.role !== "anon") {
          issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY n'est pas une clé anon.");
        }
        if (ref && typeof payload.ref === "string" && payload.ref !== ref) {
          issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY appartient à un autre projet Supabase que NEXT_PUBLIC_SUPABASE_URL.");
        }
        if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
          issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY a expiré.");
        }
      }
    }
  }
  return issues;
}
