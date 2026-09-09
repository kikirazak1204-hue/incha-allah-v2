const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { Fournisseur, User, Reservation, Paiement, Produit, Commande } = require('../models');

// ============================================================
// 🛡️ MIDDLEWARE DE CONTRÔLE ADMIN
// ============================================================
const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
};

const RESERVATION_STATUS_MAP = {
    EN_ATTENTE: 'EN_ATTENTE',
    ASSIGNEE: 'ASSIGNEE',
    EN_VALIDATION_ADMIN: 'EN_VALIDATION_ADMIN',
    EN_ATTENTE_VALIDATION: 'EN_VALIDATION_ADMIN',
    ACCEPTEE: 'ACCEPTEE',
    EN_PREPARATION: 'EN_PREPARATION',
    EN_COURS: 'EN_COURS',
    VALIDEE: 'VALIDEE',
    TERMINEE: 'TERMINEE',
    TERMINE: 'TERMINEE',
    ANNULEE: 'ANNULEE',
    ANNULE: 'ANNULEE'
};

const normalizeReservationStatut = (statut) => {
    if (typeof statut !== 'string') return null;
    const normalized = statut
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');

    return RESERVATION_STATUS_MAP[normalized] || null;
};

// ============================================================
// 📊 STATISTIQUES & UTILISATEURS
// ============================================================

router.get('/stats', protect, adminOnly, async (req, res) => {
    try {
        const [totalFournisseurs, enAttente, conformes, totalMissions] = await Promise.all([
            Fournisseur.count(),
            Fournisseur.count({ where: { statut: 'EN_ATTENTE' } }),
            Fournisseur.count({ where: { statut: 'CONFORME' } }),
            Reservation.count(),
        ]);
        res.json({ success: true, data: { totalFournisseurs, enAttente, conformes, totalMissions } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.get('/utilisateurs', protect, adminOnly, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'nom', 'prenom', 'email', 'role', 'telephone', 'ville', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.delete('/utilisateurs/:id', protect, adminOnly, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        await user.destroy();
        res.json({ success: true, message: 'Utilisateur supprimé.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// 🧑‍💼 GESTION DES FOURNISSEURS
// ============================================================

router.get('/fournisseurs', protect, adminOnly, async (req, res) => {
    try {
        const { statut } = req.query;
        const where = statut ? { statut } : {};
        const fournisseurs = await Fournisseur.findAll({
            where,
            include: [{ model: User, as: 'userFournisseur', attributes: ['id', 'nom', 'email', 'telephone'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: fournisseurs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.put('/fournisseurs/:id/statut', protect, adminOnly, async (req, res) => {
    try {
        const { statut } = req.body;
        const statutsValides = ['EN_ATTENTE', 'EN_EVALUATION', 'CONFORME', 'SUSPENDU'];
        if (!statutsValides.includes(statut)) {
            return res.status(400).json({ success: false, message: 'Statut invalide.' });
        }
        const fournisseur = await Fournisseur.findByPk(req.params.id);
        if (!fournisseur) return res.status(404).json({ success: false, message: 'Fournisseur introuvable.' });
        await fournisseur.update({ statut });
        res.json({ success: true, message: `Statut mis à jour : ${statut}`, data: fournisseur });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// 📅 GESTION DES RÉSERVATIONS (MISSIONS KANARI)
// ============================================================

// 🟢 GET /api/admin/reservations
router.get('/reservations', protect, adminOnly, async (req, res) => {
    try {
        const reservations = await Reservation.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: reservations });
    } catch (err) {
        console.error("❌ Erreur GET /reservations :", err);
        res.status(500).json({ success: false, message: 'Erreur serveur.', error: err.message });
    }
});

// 🟢 PATCH /api/admin/reservations/:id/statut
router.patch('/reservations/:id/statut', protect, adminOnly, async (req, res) => {
    try {
        const { statut: rawStatut } = req.body;
        const statut = normalizeReservationStatut(rawStatut);
        if (!statut) {
            return res.status(400).json({ success: false, message: 'Statut de réservation invalide.' });
        }

        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) return res.status(404).json({ success: false, message: 'Réservation introuvable.' });

        await reservation.update({ statut });
        res.json({ success: true, data: reservation });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// 🟢 PUT /api/admin/reservations/:id/assigner
//
// ✅ CORRIGÉ : cette route mettait le statut à 'EN_PREPARATION' juste après
// l'assignation d'un prestataire. Or routes/missions.js n'autorise le
// prestataire à accepter/refuser une mission QUE si son statut est
// 'EN_ATTENTE' ou 'ASSIGNEE'. Résultat : toute mission assignée par l'admin
// devenait immédiatement bloquée — le prestataire ne pouvait plus l'accepter,
// et DashboardFournisseur.jsx l'affichait à tort comme "matériel manquant".
// C'était très probablement la cause principale du blocage observé.
//
// Exception : si l'admin coche "accord téléphonique direct obtenu", la
// mission saute directement à 'ACCEPTEE' (prête à démarrer), sans attendre
// que le prestataire confirme sur l'application — comportement voulu.
router.put('/reservations/:id/assigner', protect, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { fournisseurId, accordTelephone } = req.body;

        const reservation = await Reservation.findByPk(id);
        if (!reservation) {
            return res.status(404).json({ success: false, message: 'Réservation introuvable.' });
        }

        const statut = accordTelephone ? 'ACCEPTEE' : 'ASSIGNEE';

        await reservation.update({ fournisseurId, statut });

        res.json({ success: true, message: 'Fournisseur assigné avec succès.', data: reservation });
    } catch (err) {
        console.error("❌ Erreur PUT /assigner :", err);
        res.status(500).json({ success: false, message: 'Erreur serveur.', error: err.message });
    }
});

// 🟢 PUT /api/admin/reservations/:id/autoriser
//
// N'a de sens que lorsque le prestataire a déjà accepté la mission
// (statut EN_VALIDATION_ADMIN) — voir le fix correspondant dans
// MissionDetailsModal.jsx qui n'affiche plus ce bouton pour 'ASSIGNEE'.
router.put('/reservations/:id/autoriser', protect, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const reservation = await Reservation.findByPk(id);
        if (!reservation) {
            return res.status(404).json({ success: false, message: 'Réservation introuvable.' });
        }

        await reservation.update({ statut: 'ACCEPTEE' });

        res.json({ success: true, message: 'Démarrage de la mission autorisé.', data: reservation });
    } catch (err) {
        console.error("❌ Erreur PUT /autoriser :", err);
        res.status(500).json({ success: false, message: 'Erreur serveur.', error: err.message });
    }
});

// SUPPRIMÉ : PUT /api/admin/reservations/:id/valider
//
// Cette route court-circuitait le bon d'intervention (pas de bon.valide,
// pas de note, pas de mise à jour de la réputation du fournisseur).
// Décision prise : un seul chemin de validation existe désormais —
// PUT /api/bons-intervention/:id/valider — exclusivement déclenché par
// le client depuis DashboardClient.jsx. La validation automatique après
// 24h sans action du client est gérée par le job planifié
// backend/jobs/autoValiderBonsIntervention.js (voir server.js).

// 🟢 PUT /api/admin/reservations/:id/refuser
router.put('/reservations/:id/refuser', protect, adminOnly, async (req, res) => {
    try {
        const { motif } = req.body;
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) return res.status(404).json({ success: false, message: 'Réservation introuvable.' });

        await reservation.update({
            statut: 'ANNULEE',
            motifRefus: motif || 'Refusé par l\'administration'
        });

        res.json({ success: true, message: 'Mission refusée/annulée.', data: reservation });
    } catch (err) {
        console.error("❌ Erreur PUT /refuser :", err);
        res.status(500).json({ success: false, message: 'Erreur serveur.', error: err.message });
    }
});

// 🟢 POST /api/admin/reservations/admin-creer
router.post('/reservations/admin-creer', protect, adminOnly, async (req, res) => {
    try {
        const {
            besoin,
            adresse,
            telephone,
            clientNom,
            serviceId,
            serviceNom,
            fournisseurId,
            type,
            dateIntervention,
            modePaiement,
            accordTelephone
        } = req.body;

        if (!besoin || !adresse || !telephone || !serviceId) {
            return res.status(400).json({ success: false, message: 'Besoin, adresse, téléphone et service sont obligatoires.' });
        }

        const parsedFournisseurId = fournisseurId ? parseInt(fournisseurId, 10) : null;
        const parcours = parsedFournisseurId ? 'direct' : 'assignation';
        const statut = parsedFournisseurId
            ? (accordTelephone ? 'ACCEPTEE' : 'ASSIGNEE')
            : 'EN_ATTENTE';

        const newReservation = await Reservation.create({
            besoin,
            adresse,
            telephone,
            clientNom: clientNom || null,
            serviceId,
            serviceNom,
            fournisseurId: parsedFournisseurId,
            type: type || 'classique',
            dateIntervention: dateIntervention || null,
            parcours,
            statut,
            modePaiement: modePaiement || 'depot_kanari'
        });

        res.status(201).json({ success: true, message: 'Réservation créée par l’admin.', data: newReservation });
    } catch (err) {
        console.error("❌ Erreur POST /admin-creer :", err);
        res.status(500).json({ success: false, message: 'Erreur lors de la création.', error: err.message });
    }
});

// 🟢 DELETE /api/admin/reservations/:id
//
// ✅ AJOUTÉ : le frontend (util/api.js → deleteReservation) appelait déjà
// cette route depuis le début, mais elle n'existait nulle part à ce
// chemin — seule une version équivalente vivait dans l'ancien
// routes/reservations.js (désormais retiré). Sans cette route, supprimer
// une réservation depuis l'admin échouait silencieusement en 404.
router.delete('/reservations/:id', protect, adminOnly, async (req, res) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) return res.status(404).json({ success: false, message: 'Réservation introuvable.' });
        await reservation.destroy();
        res.json({ success: true, message: 'Réservation supprimée.' });
    } catch (err) {
        console.error("❌ Erreur DELETE /reservations/:id :", err);
        res.status(500).json({ success: false, message: 'Erreur serveur.', error: err.message });
    }
});

// ============================================================
// 💳 GESTION DES PAIEMENTS
// ============================================================

router.get('/paiements', protect, adminOnly, async (req, res) => {
    try {
        // ✅ CORRIGÉ : l'alias réel défini dans models/index.js est 'commande',
        // pas 'commandePaiement' — Sequelize renvoyait une EagerLoadingError
        // qui faisait planter tout l'onglet Paiements de l'admin.
        // Ajout de l'inclusion Reservation, absente ici alors qu'un paiement
        // peut être lié à une réservation plutôt qu'à une commande
        // (voir backend/models/Paiement.js, champ reservationId).
        const paiements = await Paiement.findAll({
            include: [
                {
                    model: Commande,
                    as: 'commande',
                    required: false,
                    include: [{ model: User, as: 'clientCommande', attributes: ['id', 'nom', 'email'] }]
                },
                {
                    model: Reservation,
                    as: 'reservation',
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: paiements });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.put('/paiements/:id', protect, adminOnly, async (req, res) => {
    try {
        const { statut } = req.body;
        const paiement = await Paiement.findByPk(req.params.id);
        if (!paiement) return res.status(404).json({ success: false, message: 'Paiement introuvable.' });
        await paiement.update({ statut });
        res.json({ success: true, data: paiement });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// 📦 GESTION DES PRODUITS
// ============================================================

router.get('/produits', protect, adminOnly, async (req, res) => {
    try {
        const produits = await Produit.findAll({
            include: [{ model: Fournisseur, as: 'fournisseur', attributes: ['id', 'nomEntreprise'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: produits });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.delete('/produits/:id', protect, adminOnly, async (req, res) => {
    try {
        const produit = await Produit.findByPk(req.params.id);
        if (!produit) return res.status(404).json({ success: false, message: 'Produit introuvable.' });
        await produit.destroy();
        res.json({ success: true, message: 'Produit supprimé.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;