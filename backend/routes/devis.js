const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
// ✅ CORRIGÉ : User n'était pas importé alors qu'il est utilisé plus bas
// dans l'include imbriqué de /mes-devis (model: User, as: 'client').
// Ça faisait planter la route à chaque appel — probable cause de l'onglet
// "Mes devis envoyés" toujours vide côté prestataire.
const { Devis, Reservation, Fournisseur, User } = require('../models');
const { Op } = require('sequelize');

// ── POST /api/devis — Presta envoie son devis ─────────────
router.post('/', protect, authorize('fournisseur'), async (req, res) => {
    try {
        const { reservationId, montant, description } = req.body;
        if (!reservationId || !montant)
            return res.status(400).json({ success: false, message: 'Données manquantes.' });

        const reservation = await Reservation.findByPk(reservationId);
        if (!reservation)
            return res.status(404).json({ success: false, message: 'Réservation introuvable.' });

        const fournisseur = await Fournisseur.findOne({ where: { userId: req.user.id } });
        if (!fournisseur)
            return res.status(404).json({ success: false, message: 'Profil fournisseur introuvable.' });

        const devisExistant = await Devis.findOne({ where: { reservationId, fournisseurId: fournisseur.id } });
        if (devisExistant)
            return res.status(400).json({ success: false, message: 'Devis déjà envoyé.' });

        const totalDevis = await Devis.count({ where: { reservationId, statut: 'EN_ATTENTE' } });
        if (totalDevis >= 3)
            return res.status(400).json({ success: false, message: 'Limite de 3 devis atteinte.' });

        const devis = await Devis.create({
            reservationId,
            fournisseurId: fournisseur.id,
            montant,
            description,
            statut: 'EN_ATTENTE'
        });

        res.status(201).json({ success: true, data: devis });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/devis/mes-devis — Fournisseur voit ses devis ──
router.get('/mes-devis', protect, authorize('fournisseur'), async (req, res) => {
    try {
        const fournisseur = await Fournisseur.findOne({ where: { userId: req.user.id } });
        if (!fournisseur) return res.status(404).json({ success: false, message: 'Profil fournisseur introuvable.' });

        const devis = await Devis.findAll({
            where: { fournisseurId: fournisseur.id },
            include: [
                {
                    model: Reservation,
                    as: 'reservationDevis',
                    include: [{ model: User, as: 'client', attributes: ['id', 'nom', 'telephone'] }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, data: devis });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/devis/reservation/:id — Client voit les devis ─
router.get('/reservation/:id', protect, async (req, res) => {
    try {
        const devis = await Devis.findAll({
            where: { reservationId: req.params.id },
            include: [{ model: Fournisseur, as: 'fournisseurDevis', attributes: ['id', 'nomEntreprise', 'telephone', 'note'] }],
            order: [['createdAt', 'ASC']]
        });
        res.json({ success: true, data: devis });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/devis/:id/accepter — Client accepte un devis ──
router.put('/:id/accepter', protect, async (req, res) => {
    try {
        const devis = await Devis.findByPk(req.params.id);
        if (!devis) return res.status(404).json({ success: false, message: 'Devis introuvable.' });

        // 1. Accepter le devis choisi
        await devis.update({ statut: 'ACCEPTE' });

        // 2. Refuser les autres
        await Devis.update({ statut: 'REFUSE' }, {
            where: { reservationId: devis.reservationId, id: { [Op.ne]: devis.id } }
        });

        // 3. Mettre à jour la réservation
        await Reservation.update(
            { montantTotal: devis.montant, statut: 'ACCEPTEE', fournisseurId: devis.fournisseurId },
            { where: { id: devis.reservationId } }
        );

        res.json({ success: true, message: 'Devis accepté avec succès.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/devis/annuler/:reservationId ──────────────────
router.put('/annuler/:reservationId', protect, async (req, res) => {
    try {
        const reservation = await Reservation.findByPk(req.params.reservationId);
        if (!reservation) return res.status(404).json({ success: false, message: 'Introuvable.' });

        await reservation.update({ statut: 'ANNULEE' });
        res.json({ success: true, message: 'Réservation annulée.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;