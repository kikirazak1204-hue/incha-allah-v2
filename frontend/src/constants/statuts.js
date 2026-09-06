// frontend/src/constants/statuts.js
//
// Source UNIQUE des statuts de mission et de profil prestataire.
// Les deux dashboards (Client et Fournisseur) DOIVENT importer ce fichier
// au lieu de redéfinir leur propre objet STATUT localement.
//
// Bug corrigé : DashboardFournisseur.jsx testait le statut 'ASSIGNEE'
// (`['EN_ATTENTE', 'ASSIGNEE'].includes(mission.statut)`) mais 'ASSIGNEE'
// n'existait dans AUCUN objet STATUT des deux fichiers. Résultat : le badge
// retombait sur un statut "Inconnu" / undefined, ce qui cassait l'affichage.

export const STATUT = {
    EN_ATTENTE: {
        label: 'Nouvelle demande',
        bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20',
        dot: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
    },
    ASSIGNEE: {
        label: 'Assignée par Kanari',
        bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20',
        dot: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]',
    },
    EN_VALIDATION_ADMIN: {
        label: 'En attente de validation Admin',
        bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20',
        dot: 'bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse',
    },
    ACCEPTEE: {
        label: 'Prestataire confirmé',
        bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20',
        dot: 'bg-indigo-400 shadow-[0_0_8px_#6366f1]',
    },
    EN_PREPARATION: {
        label: 'Préparation / Matériel',
        bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20',
        dot: 'bg-orange-400 shadow-[0_0_8px_#fb923c]',
    },
    EN_COURS: {
        label: 'Intervention en cours',
        bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20',
        dot: 'bg-purple-400 shadow-[0_0_8px_#c084fc]',
    },
    TERMINEE: {
        label: 'Travaux terminés — à valider',
        bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20',
        dot: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
    },
    VALIDEE: {
        label: 'Clôturée & Validée',
        bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30',
        dot: 'bg-emerald-400',
    },
    ANNULEE: {
        label: 'Annulée / Refusée',
        bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20',
        dot: 'bg-rose-400 shadow-[0_0_8px_#fb7185]',
    },
};

export const STATUT_FALLBACK = {
    label: 'Statut inconnu',
    bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/20',
    dot: 'bg-slate-400',
};

export const BADGE_PROFIL = {
    EN_ATTENTE: { label: 'En attente de validation', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    EN_EVALUATION: { label: "En cours d'évaluation", bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    CONFORME: { label: 'Garanti Kanari Service', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    SUSPENDU: { label: 'Compte suspendu', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

// Groupes de statuts réutilisés dans les deux dashboards — un seul endroit
// à modifier si la logique métier change.
export const STATUTS_ACTIFS = ['EN_ATTENTE', 'ASSIGNEE', 'EN_VALIDATION_ADMIN', 'ACCEPTEE', 'EN_PREPARATION', 'EN_COURS'];
export const STATUTS_TELEPHONE_VISIBLE = ['ACCEPTEE', 'EN_PREPARATION', 'EN_COURS', 'TERMINEE', 'VALIDEE'];

export function getStatutMeta(statut) {
    return STATUT[statut] || STATUT_FALLBACK;
}