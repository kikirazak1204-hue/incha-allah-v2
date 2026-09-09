const { sequelize, Reservation, Fournisseur } = require('../models');
const { sendNotification } = require('../utils/notifications');

// ════════════════════════════════════════════════════════════════
// Ce fichier a été nettoyé : il contenait plusieurs fonctions
// (prestaAccepter, prestaRefuser, terminerMission, assignerFournisseur,
// autoriserDemarrage, adminCreerReservation, updateStatut,
// deleteReservation) qui dupliquaient — en moins bien, et parfois de
// façon dangereuse (aucune vérification de propriété, statuts invalides,
// contournement complet du bon d'intervention) — ce que
// backend/routes/missions.js et backend/routes/admin.js font déjà
// correctement et que le frontend appelle réellement.
//
// Ce fichier ne garde désormais que ce qui n'existe NULLE PART ailleurs :
// la création de réservation, et les deux listes en lecture seule
// utilisées par le client et le prestataire.
// ════════════════════════════════════════════════════════════════

function formaterBesoin(detailsParticuliers = {}) {
    const lignes = Object.entries(detailsParticuliers)
        .filter(([, valeur]) => valeur !== undefined && valeur !== null && valeur !== '')
        .map(([cle, valeur]) => `${cle} : ${valeur}`);
    return lignes.join('\n') || null;
}

// ── POST /api/reservations/global (et /api/reservations) ───────
// Crée UNE Reservation par service sélectionné (voir formaterBesoin).
exports.createGlobalReservation = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const {
            clientNom,
            telephone,
            adresse,
            dateIntervention,
            modePaiement,
            fournisseurId,
            services
        } = req.body;

        if (!clientNom || !telephone || !adresse || !services || !Array.isArray(services) || services.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Informations obligatoires manquantes dans la requête.'
            });
        }

        const parsedFournisseurId = fournisseurId ? parseInt(fournisseurId, 10) : null;
        const reservationsCreees = [];

        for (const srv of services) {
            const typeFormulaire = srv.typeFormulaire === 'candidature' ? 'candidature' : 'classique';
            const estCandidature = typeFormulaire === 'candidature';

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

// ── GET /api/reservations/mes-reservations — Espace Client ─────
exports.getMesReservations = async (req, res) => {
    try {
        const reservations = await Reservation.findAll({
            where: { clientId: req.user.id },
            order: [['createdAt', 'DESC']]
        });
        return res.status(200).json({ success: true, data: reservations });
    } catch (error) {
        console.error('Erreur getMesReservations :', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ── GET /api/reservations/disponibles — Espace Prestataire ─────
//
// ✅ CORRIGÉ : retournait TOUTES les demandes EN_ATTENTE de la plateforme,
// tous services confondus — un plombier voyait des demandes de traiteur.
// Filtre désormais sur la spécialité du prestataire (son serviceId) et
// exclut les demandes déjà assignées à quelqu'un d'autre.
exports.getReservationsDisponibles = async (req, res) => {
    try {
        const fournisseur = await Fournisseur.findOne({ where: { userId: req.user.id } });
        if (!fournisseur) {
            return res.status(403).json({ success: false, message: 'Profil fournisseur introuvable.' });
        }

        const reservations = await Reservation.findAll({
            where: {
                statut: 'EN_ATTENTE',
                fournisseurId: null,
                serviceId: fournisseur.serviceId
            },
            order: [['createdAt', 'DESC']]
        });
        return res.status(200).json({ success: true, data: reservations });
    } catch (error) {
        console.error('Erreur getReservationsDisponibles :', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};