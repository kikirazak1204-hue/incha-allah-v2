const { sequelize, Reservation, Fournisseur } = require('../models');
const { sendNotification } = require('../utils/notifications');

// ════════════════════════════════════════════════════════════════
// POST /api/reservations/global
//
// RÉÉCRIT ENTIÈREMENT. L'ancienne version créait une Reservation "mère"
// + des ReservationItem enfants dans une table que RIEN d'autre dans
// l'application ne lit jamais (routes/missions.js, DashboardFournisseur.jsx,
// DashboardClient.jsx, MissionDetailsModal.jsx, StatusBadge.jsx — tout le
// système de missions travaille sur UNE ligne Reservation = UNE mission,
// avec serviceNom/serviceId/fournisseurId/statut directement dessus).
//
// Nouvelle logique : chaque service sélectionné devient sa PROPRE
// Reservation (sa propre mission, avec son propre cycle accepter/refuser/
// démarrer/terminer/bon d'intervention), créées ensemble dans une seule
// transaction atomique.
//
// Le statut initial dépend de deux choses :
//   - si un fournisseur précis a été choisi (réservation depuis un profil
//     fournisseur) → 'ASSIGNEE' (le fournisseur doit accepter/refuser)
//   - sinon → 'EN_ATTENTE' (l'admin doit assigner un prestataire)
//
// Le type de chaque réservation dépend de servicesConfig.js côté frontend :
// 'candidature' pour mission_freelance/benevolat (pas de paiement, pas de
// fournisseur imposé), 'classique' pour le reste.
// ════════════════════════════════════════════════════════════════

// Construit un texte lisible à partir des détails dynamiques du formulaire,
// pour affichage dans MissionDetailsModal.jsx / DashboardFournisseur.jsx
// (qui affichent reservation.besoin en texte brut).
function formaterBesoin(detailsParticuliers = {}) {
    const lignes = Object.entries(detailsParticuliers)
        .filter(([, valeur]) => valeur !== undefined && valeur !== null && valeur !== '')
        .map(([cle, valeur]) => `${cle} : ${valeur}`);
    return lignes.join('\n') || null;
}

exports.createGlobalReservation = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const {
            clientNom,
            telephone,
            adresse,
            coordonneesGps,
            dateIntervention,
            modePaiement,
            fournisseurId,
            services
        } = req.body;

        // 1. Validation de base
        if (!clientNom || !telephone || !adresse || !services || !Array.isArray(services) || services.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Informations obligatoires manquantes dans la requête.'
            });
        }

        const parsedFournisseurId = fournisseurId ? parseInt(fournisseurId, 10) : null;

        // 2. Création d'UNE Reservation (= UNE mission) par service
        const reservationsCreees = [];

        for (const srv of services) {
            const typeFormulaire = srv.typeFormulaire === 'candidature' ? 'candidature' : 'classique';
            const estCandidature = typeFormulaire === 'candidature';

            // Une candidature n'a jamais de fournisseur imposé à la création
            // (elle sera traitée par l'admin comme un dossier à examiner),
            // et jamais de paiement.
            const fournisseurAssigne = estCandidature ? null : parsedFournisseurId;
            const statutInitial = fournisseurAssigne ? 'ASSIGNEE' : 'EN_ATTENTE';

            const reservation = await Reservation.create({
                clientNom,
                telephone,
                adresse,
                dateIntervention: dateIntervention ? new Date(dateIntervention) : new Date(),
                modePaiement: estCandidature ? 'aucun' : (modePaiement || 'depot_kanari'),
                montantTotal: estCandidature ? 0 : Number(srv.prix || srv.tarif || 0),
                statut: statutInitial,
                type: typeFormulaire,
                parcours: fournisseurAssigne ? 'direct' : 'assignation',
                clientId: req.user ? req.user.id : null,
                fournisseurId: fournisseurAssigne,
                serviceId: srv.serviceId || null,
                serviceNom: srv.nom || 'Service',
                besoin: formaterBesoin(srv.detailsParticuliers),
                services: srv.detailsParticuliers || {}
            }, { transaction });

            reservationsCreees.push(reservation);
        }

        await transaction.commit();

        // 3. Notifications (non bloquantes) — une par mission créée
        for (const reservation of reservationsCreees) {
            try {
                if (reservation.fournisseurId) {
                    const fournisseur = await Fournisseur.findByPk(reservation.fournisseurId);
                    if (fournisseur?.fcmToken) {
                        await sendNotification({
                            token: fournisseur.fcmToken,
                            title: 'Nouvelle mission Kanari',
                            body: `${reservation.serviceNom} — ${reservation.clientNom} — ${reservation.adresse}`,
                            data: { type: 'RESERVATION', reservationId: String(reservation.id) }
                        });
                    }
                } else if (reservation.serviceId) {
                    await sendNotification({
                        topic: `service_${reservation.serviceId}`,
                        title: 'Nouvelle demande',
                        body: `${reservation.serviceNom} à ${reservation.adresse}`,
                        data: { type: 'DEMANDE_GENERALE', reservationId: String(reservation.id) }
                    });
                }
            } catch (notifErr) {
                console.error(`Notification non envoyée pour la réservation #${reservation.id} :`, notifErr.message);
            }
        }

        // 4. Réponse : IDs de toutes les missions créées + montant total
        // (utile pour la redirection paiement si au moins une mission le requiert)
        const montantTotalAPayer = reservationsCreees
            .filter(r => r.type !== 'candidature')
            .reduce((acc, r) => acc + Number(r.montantTotal || 0), 0);

        return res.status(201).json({
            success: true,
            id: reservationsCreees[0].id,
            ids: reservationsCreees.map(r => r.id),
            montantTotal: montantTotalAPayer,
            message: `${reservationsCreees.length} demande(s) enregistrée(s) avec succès.`
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Erreur critique createGlobalReservation :', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur lors de la création de la réservation.'
        });
    }
};