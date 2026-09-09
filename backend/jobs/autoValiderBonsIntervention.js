// backend/jobs/autoValiderBonsIntervention.js
//
// Job planifié — s'exécute périodiquement (voir server.js) pour valider
// automatiquement tout bon d'intervention resté sans réponse du client
// au-delà du délai configuré (paramètre
// 'bon_intervention.delai_validation_auto_heures', 24h par défaut —
// modifiable depuis l'admin sans redéployer, voir routes/settings.js).

const { Op } = require('sequelize');
const { BonIntervention, Reservation, Fournisseur, Setting } = require('../models');
const { sendPushNotification } = require('../utils/firebaseNotifier');

const DELAI_DEFAUT_HEURES = 24;

async function getDelaiHeures() {
    try {
        const setting = await Setting.findOne({ where: { cle: 'bon_intervention.delai_validation_auto_heures' } });
        if (!setting) return DELAI_DEFAUT_HEURES;
        const delai = parseInt(setting.valeur, 10);
        return isNaN(delai) ? DELAI_DEFAUT_HEURES : delai;
    } catch {
        return DELAI_DEFAUT_HEURES;
    }
}

async function runAutoValiderBonsIntervention() {
    const delaiHeures = await getDelaiHeures();
    const seuil = new Date();
    seuil.setHours(seuil.getHours() - delaiHeures);

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
        console.log(`[auto-validation] Aucun bon en attente depuis plus de ${delaiHeures}h.`);
        return { traites: 0, erreurs: 0 };
    }

    console.log(`[auto-validation] ${bonsEligibles.length} bon(s) éligible(s) (délai : ${delaiHeures}h).`);

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

            try {
                if (reservation.clientId) {
                    await sendPushNotification({
                        userId: reservation.clientId,
                        title: 'Prestation validée automatiquement',
                        body: `Aucune action de votre part sous ${delaiHeures}h : la mission #${reservation.id} a été validée automatiquement et le paiement du prestataire a été libéré.`,
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
                        body: `Le client n'a pas répondu sous ${delaiHeures}h. La mission #${reservation.id} est validée et votre commission est due.`,
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

module.exports = { runAutoValiderBonsIntervention };