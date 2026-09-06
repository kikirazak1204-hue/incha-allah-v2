const { sequelize, Reservation, ReservationItem, Fournisseur } = require('../models');
const { sendNotification } = require('../utils/notifications'); // Ton utilitaire FCM

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
            commentaireGlobal,
            fournisseurId,
            montantTotal,
            services
        } = req.body;

        // 1. Validation de base
        if (!clientNom || !telephone || !adresse || !services || services.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'Informations obligatoires manquantes dans la requête.' 
            });
        }

        // 2. Création de la Réservation Mère (Socle)
        const reservation = await Reservation.create({
            clientNom,
            telephone,
            adresse,
            coordonneesGps: coordonneesGps || null, // Stockage propre en JSON/JSONB dans Postgres
            dateIntervention: dateIntervention || new Date(),
            modePaiement: modePaiement || 'depot_kanari',
            commentaireGlobal: commentaireGlobal || '',
            montantTotal: Number(montantTotal) || 0,
            statut: 'EN_ATTENTE', // Sécurité ENUM validée
            clientId: req.user ? req.user.id : null,
            fournisseurId: fournisseurId || null
        }, { transaction });

        // 3. Création des Sous-Services (Items) avec les détails dynamiques
        for (const srv of services) {
            await ReservationItem.create({
                reservationId: reservation.id,
                serviceId: srv.serviceId,
                nom: srv.nom,
                prix: Number(srv.prix) || 0,
                detailsParticuliers: srv.detailsParticuliers || {} // Capture tous les champs variables (urgence, participants, etc.)
            }, { transaction });
        }

        // Validation atomique de la transaction Aiven
        await transaction.commit();

        // 4. Gestion des Notifications FCM (Push)
        try {
            if (fournisseurId) {
                // Si un prestataire spécifique a été choisi
                const fournisseur = await Fournisseur.findByPk(fournisseurId);
                if (fournisseur?.fcmToken) {
                    await sendNotification({
                        token: fournisseur.fcmToken,
                        title: '🚀 Nouvelle mission Kanari !',
                        body: `Client : ${clientNom} - ${adresse}`,
                        data: { type: 'RESERVATION', reservationId: String(reservation.id) }
                    });
                }
            } else if (services.length > 0) {
                // Diffusion par topic sur le premier service du dossier
                const mainServiceId = services[0].serviceId;
                await sendNotification({
                    topic: `service_${mainServiceId}`,
                    title: '🔔 Nouvelle demande multi-services',
                    body: `Nouvelle opportunité à ${adresse}`,
                    data: { type: 'DEMANDE_GENERALE', reservationId: String(reservation.id) }
                });
            }
        } catch (notifErr) {
            console.error("Erreur non bloquante lors de l'envoi de la notification FCM :", notifErr);
        }

        return res.status(201).json({
            success: true,
            id: reservation.id,
            message: 'Réservation globale enregistrée avec succès.'
        });

    } catch (error) {
        // En cas de crash, annulation totale pour protéger la base Aiven
        await transaction.rollback();
        console.error('Erreur critique createGlobalReservation :', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur interne du serveur lors de la création de la réservation.' 
        });
    }
};