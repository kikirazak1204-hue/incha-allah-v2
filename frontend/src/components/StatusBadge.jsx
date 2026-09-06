import React from 'react';
import { STATUT, STATUT_FALLBACK } from '../constants/statuts';

// Aligné sur les vraies valeurs de Reservation.statut (toujours en MAJUSCULES,
// voir backend/models/Reservation.js). Source unique : constants/statuts.js,
// partagée avec DashboardClient.jsx et DashboardFournisseur.jsx — un seul
// endroit à modifier si un statut ou un libellé change.
export default function StatusBadge({ statut }) {
    const config = STATUT[statut] || { ...STATUT_FALLBACK, label: statut || 'Inconnu' };

    return (
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
}