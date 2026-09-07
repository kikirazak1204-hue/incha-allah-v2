// backend/jobs/autoValiderBonsIntervention.js
//
// Job planifié — s'exécute périodiquement (voir server.js) pour valider
// automatiquement tout bon d'intervention resté sans réponse du client
// pendant plus de 24h.
//
// Pourquoi ce fichier existe : le modèle BonIntervention prévoit déjà un
// champ `valideAutomatiquement` (booléen) — l'intention de cette
// validation automatique existait dans le schéma dès le départ, mais
// aucun code ne l'exécutait réellement. Résultat possible sans ce job :
// une mission reste bloquée en 'TERMINEE' indéfiniment si le client ne
// valide jamais, et le prestataire n'est jamais payé.
//
// Ce fichier est volontairement séparé du contrôleur HTTP
// (bonInterventionController.js) : ce n'est pas une route appelée par un
// utilisateur, c'est une tâche de fond invoquée par le serveur lui-même.

const { Op } = require('sequelize');
const { BonIntervention, Reservation, Fournisseur } = require('../models');
const { sendPushNotification } = require('../utils/firebaseNotifier');

const DELAI_VALIDATION_AUTO_HEURES = 24;

async function runAutoValiderBonsIntervention() {
    const seuil = new Date();
    seuil.setHours(seuil.getHours() - DELAI_VALIDATION_AUTO_HEURES);

    let bonsEligibles = [];
    try {
        bonsEligibles = await BonIntervention.findAll({
            where: {
                valide: false,
                createdAt: { [Op.lte]: seuil }
            }
        });
    } catch (err) {
        console.error('[auto-validation] Erreur lors de la recherche des bons éligibles :', err.message);
        return { traites: 0, erreurs: 0 };
    }

    if (bonsEligibles.length === 0) {
        console.log('[auto-validation] Aucun bon en attente depuis plus de 24h.');
        return { traites: 0, erreurs: 0 };
    }

    console.log(`[auto-validation] ${bonsEligibles.length} bon(s) éligible(s) à la validation automatique.`);

    let traites = 0;
    let erreurs = 0;

    for (const bon of bonsEligibles) {
        try {
            const reservation = await Reservation.findByPk(bon.reservationId);
            if (!reservation) {
                console.warn(`[auto-validation] Bon #${bon.id} : réservation #${bon.reservationId} introuvable, ignoré.`);
                erreurs++;
                continue;
            }

            // On ne valide automatiquement que si la mission est bien
            // encore au statut TERMINEE (évite d'écraser un état déjà
            // modifié entre-temps, ex : litige ouvert, annulation).
            if (reservation.statut !== 'TERMINEE') {
                console.warn(`[auto-validation] Bon #${bon.id} : réservation #${reservation.id} n'est plus TERMINEE (statut actuel : ${reservation.statut}), ignoré.`);
                continue;
            }

            await bon.update({
                valide: true,
                valideLe: new Date(),
                valideAutomatiquement: true
            });

            await reservation.update({ statut: 'VALIDEE' });

            // Notifications non bloquantes — un échec ici ne doit jamais
            // empêcher la validation elle-même.
            try {
                if (reservation.clientId) {
                    await sendPushNotification({
                        userId: reservation.clientId,
                        title: 'Prestation validée automatiquement',
                        body: `Aucune action de votre part sous 24h : la mission #${reservation.id} a été validée automatiquement et le paiement du prestataire a été libéré.`,
                        data: { type: 'BON_VALIDE_AUTO', reservationId: String(reservation.id), bonId: String(bon.id) }
                    });
                }
            } catch (notifErr) {
                console.warn(`[auto-validation] Notification client non envoyée (bon #${bon.id}) :`, notifErr.message);
            }

            try {
                const fournisseur = await Fournisseur.findByPk(bon.fournisseurId);
                if (fournisseur?.userId) {
                    await sendPushNotification({
                        userId: fournisseur.userId,
                        title: 'Mission validée automatiquement',
                        body: `Le client n'a pas répondu sous 24h. La mission #${reservation.id} est validée et votre commission est due.`,
                        data: { type: 'BON_VALIDE_AUTO', reservationId: String(reservation.id), bonId: String(bon.id) }
                    });
                }
            } catch (notifErr) {
                console.warn(`[auto-validation] Notification prestataire non envoyée (bon #${bon.id}) :`, notifErr.message);
            }

            console.log(`[auto-validation] Bon #${bon.id} / Réservation #${reservation.id} validés automatiquement.`);
            traites++;
        } catch (err) {
            console.error(`[auto-validation] Erreur sur le bon #${bon.id} :`, err.message);
            erreurs++;
        }
    }

    console.log(`[auto-validation] Terminé : ${traites} validé(s), ${erreurs} erreur(s).`);
    return { traites, erreurs };
}

module.exports = { runAutoValiderBonsIntervention, DELAI_VALIDATION_AUTO_HEURES };