const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const resController = require('../controllers/reservationController');

// ════════════════════════════════════════════════════════════════
// Nettoyé : toutes les routes d'accepter/refuser/démarrer/terminer/
// assigner/autoriser/créer-par-admin/supprimer une mission vivent
// désormais UNIQUEMENT dans routes/missions.js (prestataire) et
// routes/admin.js (admin) — les versions qui existaient ici en double
// n'étaient pas sécurisées (aucune vérification de propriété) et
// utilisaient des statuts incohérents avec le reste de l'application.
// Voir reservationController.js pour le détail de ce qui a été retiré.
// ════════════════════════════════════════════════════════════════

// ── Création de réservation (public ou connecté) ────────────────
router.post('/global', resController.createGlobalReservation);
router.post('/', resController.createGlobalReservation);

// ── Espace Client ────────────────────────────────────────────────
router.get('/mes-reservations', protect, resController.getMesReservations);

// ── Espace Prestataire ───────────────────────────────────────────
router.get('/disponibles', protect, resController.getReservationsDisponibles);

module.exports = router;