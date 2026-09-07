const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const resController = require('../controllers/reservationController');

// ── 🌍 Route Globale Multi-Services (Kanari Pro) ──────────
// 💡 On délègue TOUTE la logique au contrôleur pour bénéficier 
// des transactions et des notifications.
router.post('/global', resController.createGlobalReservation);

// ── Public / Client ───────────────────────────────────────
// CORRECTION : On utilise createGlobalReservation au lieu de createReservation (qui n'existait plus)
router.post('/', resController.createGlobalReservation);

// Le token de l'utilisateur connecté ("protect") suffira grâce à req.user.id
router.get('/mes-reservations', protect, resController.getMesReservations);

// ── Presta ────────────────────────────────────────────────
router.get('/disponibles', protect, resController.getReservationsDisponibles);
router.put('/:id/presta-accepter', protect, resController.prestaAccepter);
router.put('/:id/presta-refuser', protect, resController.prestaRefuser);
router.post('/:id/terminer', protect, resController.terminerMission);

// ── Admin ─────────────────────────────────────────────────
router.get('/admin', protect, adminOnly, resController.getAdminReservations);
router.put('/:id/statut', protect, adminOnly, resController.updateStatut);
router.put('/:id/assigner', protect, adminOnly, resController.assignerFournisseur);
router.put('/:id/autoriser', protect, adminOnly, resController.autoriserDemarrage);
router.post('/admin-creer', protect, adminOnly, resController.adminCreerReservation);
router.delete('/:id', protect, adminOnly, resController.deleteReservation);

module.exports = router;
