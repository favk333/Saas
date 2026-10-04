// Côté client : protège les actions serveur contre le réseau absent ou coupé en route.
// Sans ça, un échec de fetch remonte jusqu'à l'error boundary et l'écran est perdu.

export const NETWORK_ERROR = "Pas de réseau. Rien n'est perdu : réessayez dès que ça capte.";

export function withNetworkGuard<S extends { error: string | null }, A extends unknown[]>(
  action: (prev: S, ...args: A) => Promise<S>,
) {
  return async (prev: S, ...args: A): Promise<S> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return { ...prev, error: NETWORK_ERROR };
    try {
      return await action(prev, ...args);
    } catch (e) {
      // fetch() échoue avec un TypeError ; les autres erreurs (dont redirect) suivent leur cours.
      if (e instanceof TypeError) return { ...prev, error: NETWORK_ERROR };
      throw e;
    }
  };
}
