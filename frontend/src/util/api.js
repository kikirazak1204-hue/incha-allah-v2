// ============================================================
// 🔧 UTILITAIRE REQUEST (Gère JSON, FormData, 204 et pannes réseau)
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || '';

const request = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const isFormData = options.body instanceof FormData;

  // On s'assure d'inclure Content-Type: application/json si ce n'est pas du FormData
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  console.log(`🌐 Appel API : ${config.method || 'GET'} ${url}`);

  let res;
  try {
    res = await fetch(url, config);
  } catch (networkError) {
    // Intercepte le "Failed to fetch" (Serveur arrêté / Render en veille / Pas de réseau)
    console.warn(`⚠️ Serveur injoignable (Cold Start ou coupure réseau) sur : ${url}`);
    const error = new Error("Le serveur est en train de démarrer ou est inaccessible. Nouvelle tentative en cours...");
    error.status = 503;
    error.isNetworkError = true;
    throw error;
  }

  // Gestion des réponses sans contenu (ex: 204 No Content)
  if (res.status === 204) {
    return null;
  }

  let data;
  const contentType = res.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  } catch (parseError) {
    data = null; // Évite les crashs si le serveur renvoie du JSON malformé
  }

  if (!res.ok) {
    console.error(`❌ Erreur API (${res.status}) :`, data);
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `HTTP ${res.status} ${res.statusText}`;

    const error = new Error(message);
    error.status = res.status;
    error.data = data; // Permet de récupérer le détail de l'erreur dans le composant
    throw error;
  }

  return data;
};

// ============================================================
// 🔐 HEADERS AUTH (Sécurisé contre les crashs localStorage)
// ============================================================
export const authHeaders = () => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (e) {
    console.warn("⚠️ Impossible d'accéder au localStorage (Navigation privée ?)");
    return {};
  }
};

// ============================================================
// 👤 AUTH
// ============================================================
export const loginUser = async ({ email, password }) =>
  request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const registerUser = (payload) =>
  request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ============================================================
// 🧑‍💼 FOURNISSEURS (AJOUT ET SÉCURISATION)
// ============================================================
export const registerFournisseur = async (formData) =>
  request('/api/fournisseurs', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

// ✨ AJOUTÉ : Permet à MissionDetailsModal de charger la liste déroulante
export const getFournisseurs = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/fournisseurs${query ? `?${query}` : ''}`, { 
    headers: authHeaders() 
  });
};

// ============================================================
// 📊 DASHBOARDS
// ============================================================
export const getDashboardClient = () =>
  request('/api/dashboard/client', { headers: authHeaders() });

export const getDashboardFournisseur = () =>
  request('/api/dashboard/fournisseur', { headers: authHeaders() });

// ============================================================
// 🛠️ SERVICES
// ============================================================
export const getServices = () => request('/api/services');

export const getService = (id) => {
  if (!id) throw new Error('ID de service manquant');
  return request(`/api/services/${id}`);
};

export const getFournisseursParService = (id) => {
  if (!id) throw new Error('ID de service manquant');
  return request(`/api/services/${id}/fournisseurs`);
};

export const getFournisseurById = (id) => {
  if (!id) throw new Error('ID de fournisseur manquant');
  return request(`/api/fournisseurs/${id}`);
};

// ============================================================
// 📦 PRODUITS
// ============================================================
export const getProduits = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/produits${query ? `?${query}` : ''}`);
};

export const getProduitsFournisseur = () =>
  request('/api/produits/fournisseur', { headers: authHeaders() });

export const addProduit = (formData) =>
  request('/api/produits', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

export const deleteProduit = (id) =>
  request(`/api/produits/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

// ============================================================
// 💳 COMMANDES / PAIEMENTS
// ============================================================
export const creerCommande = (commande) =>
  request('/api/commandes', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(commande),
  });

export const soumettrePaiementMobileMoney = (payload) =>
  request('/api/paiements/mobile-money', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

export const getHistoriquePaiements = () =>
  request('/api/paiements/historique', { headers: authHeaders() });

// ============================================================
// 🛡️ ADMIN GENERAL & PAIEMENTS ADMIN
// ============================================================
export const getAdminFournisseurs = (statut = '') => {
  const query = statut ? `?statut=${statut}` : '';
  return request(`/api/admin/fournisseurs${query}`, { headers: authHeaders() });
};

export const updateStatutFournisseur = (id, statut) =>
  request(`/api/admin/fournisseurs/${id}/statut`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ statut }),
  });

export const getAdminPaiements = () =>
  request('/api/admin/paiements', { headers: authHeaders() });

export const validerPaiement = (id) =>
  request(`/api/admin/paiements/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
  });

export const rejeterPaiement = (id) =>
  request(`/api/admin/paiements/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
  });

export const getAdminUtilisateurs = () =>
  request('/api/admin/utilisateurs', { headers: authHeaders() });

export const deleteUtilisateur = (id) =>
  request(`/api/admin/utilisateurs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

export const getAdminProduits = () =>
  request('/api/admin/produits', { headers: authHeaders() });

export const deleteAdminProduit = (id) =>
  request(`/api/admin/produits/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

// ============================================================
// 📅 RÉSERVATIONS ADMIN
// ============================================================
export const getAdminReservations = () =>
  request('/api/admin/reservations', { headers: authHeaders() });

const normalizeReservationStatut = (statut) =>
  String(statut || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

export const updateReservationStatut = (id, statut) =>
  request(`/api/admin/reservations/${id}/statut`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ statut: normalizeReservationStatut(statut) }),
  });

export const deleteReservation = (id) =>
  request(`/api/admin/reservations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

// ✨ AMÉLIORÉ : Supporte maintenant l'accord téléphonique en option
export const assignerFournisseur = (id, fournisseurId, accordTelephone = false) =>
  request(`/api/admin/reservations/${id}/assigner`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ fournisseurId, accordTelephone }),
  });

export const autoriserDemarrage = (id) =>
  request(`/api/admin/reservations/${id}/autoriser`, {
    method: 'PUT',
    headers: authHeaders(),
  });

export const adminCreerReservation = (payload) =>
  request('/api/admin/reservations/admin-creer', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

// SUPPRIMÉ : validerReservation (appelait PUT /api/admin/reservations/:id/valider,
// route retirée côté backend). La validation d'une mission passe désormais
// exclusivement par validerBonIntervention() ci-dessous, ou par le job
// automatique après 24h côté serveur.

export const refuserReservation = (id, motif = '') =>
  request(`/api/admin/reservations/${id}/refuser`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ motif }),
  });

// ============================================================
// 🚀 MISSIONS (FOURNISSEUR & CLIENT)
// ============================================================
export const getMissionsFournisseur = () =>
  request('/api/missions', { headers: authHeaders() });

export const accepterMission = (id) =>
  request(`/api/missions/${id}/accepter`, {
    method: 'PUT',
    headers: authHeaders(),
  });

export const refuserMission = (id, motifRefus) =>
  request(`/api/missions/${id}/refuser`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ motifRefus }),
  });

export const demarrerMission = (id) =>
  request(`/api/missions/${id}/demarrer`, {
    method: 'PUT',
    headers: authHeaders(),
  });

export const terminerMission = (id) =>
  request(`/api/missions/${id}/terminer`, {
    method: 'PUT',
    headers: authHeaders(),
  });

// NOTE : la validation client d'une mission ne passe plus par
// /api/missions/:id/valider (route supprimée côté backend pour éviter
// un double chemin incohérent). Utiliser exclusivement
// validerBonIntervention(bonId, { note, commentaire }) ci-dessous,
// qui met à jour la réservation, le bon ET la réputation du fournisseur
// en une seule opération cohérente.

export const signalerManqueMateriel = (id, descriptionMateriel) =>
  request(`/api/missions/${id}/materiel`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ descriptionMateriel }),
  });

// ============================================================
// 📝 BONS D'INTERVENTION
// ============================================================
export const creerBonIntervention = (payload) =>
  request('/api/bons-intervention', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

export const getBonInterventionParReservation = (reservationId) =>
  request(`/api/bons-intervention/reservation/${reservationId}`, {
    headers: authHeaders(),
  });

export const validerBonIntervention = (bonId, { note, commentaire }) =>
  request(`/api/bons-intervention/${bonId}/valider`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ note, commentaire }),
  });