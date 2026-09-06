const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { Reservation, Fournisseur } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = file.originalname.replace(ext, '').replace(/\s+/g, '-').toLowerCase();
        cb(null, `${base}-${Date.now()}${ext}`);
    }
});

const upload = multer({ storage });

// Middleware — vérifie que l'utilisateur est bien un fournisseur
const checkFournisseur = async (req, res, next) => {
    try {
        const fournisseur = await Fournisseur.findOne({ where: { userId: req.user.id } });
        if (!fournisseur) return res.status(403).json({ success: false, message: 'Profil fournisseur introuvable.' });
        req.fournisseur = fournisseur;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ==========================================
// RÉSERVATIONS DU CLIENT
// GET /api/missions/client
// ==========================================
router.get('/client', protect, async (req, res) => {
    try {
        const missions = await Reservation.findAll({
            where: { clientId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        // Renvoie toujours un tableau (même vide)
        res.json({ success: true, data: missions });
    } catch (err) {
        console.error("Erreur récupération réservations client:", err);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des réservations.' });
    }
});

// ==========================================
// ROUTE PRESTATAIRE : MISSIONS DU FOURNISSEUR
// GET /api/missions
// ==========================================
router.get('/', protect, checkFournisseur, async (req, res) => {
    try {
        const missions = await Reservation.findAll({
            where: { fournisseurId: req.fournisseur.id },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: missions });
    } catch (err) {
        console.error("Erreur récupération missions prestataire:", err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/missions/:id/accepter — Fournisseur accepte la mission
router.put('/:id/accepter', protect, checkFournisseur, async (req, res) => {
    try {
        const mission = await Reservation.findOne({
            where: { id: req.params.id, fournisseurId: req.fournisseur.id }
        });
        if (!mission) return res.status(404).json({ success: false, message: 'Mission introuvable.' });
        if (!['EN_ATTENTE', 'ASSIGNEE'].includes(mission.statut)) {
            return res.status(400).json({ success: false, message: 'Mission non modifiable.' });
        }

        await mission.update({ statut: 'EN_VALIDATION_ADMIN' });
        res.json({ success: true, message: 'Mission acceptée. En attente de validation admin.', data: mission });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/missions/:id/refuser — Fournisseur refuse la mission
router.put('/:id/refuser', protect, checkFournisseur, async (req, res) => {
    try {
        const mission = await Reservation.findOne({
            where: { id: req.params.id, fournisseurId: req.fournisseur.id }
        });
        if (!mission) return res.status(404).json({ success: false, message: 'Mission introuvable.' });
        if (!['EN_ATTENTE', 'ASSIGNEE'].includes(mission.statut)) {
            return res.status(400).json({ success: false, message: 'Mission non modifiable.' });
        }

        await mission.update({
            statut: 'ANNULEE',
            refusePar: req.fournisseur.id,
            motifRefus: req.body.motifRefus || 'Refusé par le prestataire'
        });
        res.json({ success: true, message: 'Mission refusée.', data: mission });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/missions/:id/demarrer — Fournisseur démarrer la mission
router.put('/:id/demarrer', protect, checkFournisseur, async (req, res) => {
    try {
        const mission = await Reservation.findOne({
            where: { id: req.params.id, fournisseurId: req.fournisseur.id }
        });
        if (!mission) return res.status(404).json({ success: false, message: 'Mission introuvable.' });

        await mission.update({ statut: 'EN_COURS' });
        res.json({ success: true, message: 'Mission démarrée.', data: mission });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/missions/:id/terminer — Fournisseur marque la mission terminée
router.put('/:id/terminer', protect, checkFournisseur, async (req, res) => {
    try {
        const mission = await Reservation.findOne({
            where: { id: req.params.id, fournisseurId: req.fournisseur.id }
        });
        if (!mission) return res.status(404).json({ success: false, message: 'Mission introuvable.' });
        if (mission.statut !== 'EN_COURS') return res.status(400).json({ success: false, message: 'Mission non en cours.' });

        await mission.update({ statut: 'TERMINEE' });
        res.json({ success: true, message: 'Mission terminée. En attente de validation client.', data: mission });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// NOTE : la validation client d'une mission terminée ne passe plus par cette
// route. Elle se fait exclusivement via PUT /api/bons-intervention/:id/valider
// (voir routes/bonsIntervention.js), qui est la seule route à mettre à jour
// de façon cohérente : le statut de la réservation, le bon d'intervention
// (valide, valideLe), la note et la moyenne du fournisseur.

// PUT /api/missions/:id/materiel — Fournisseur signale manque matériel
router.put('/:id/materiel', protect, checkFournisseur, async (req, res) => {
    try {
        const { descriptionMateriel } = req.body;
        if (!descriptionMateriel) return res.status(400).json({ success: false, message: 'Description manquante.' });

        const mission = await Reservation.findOne({
            where: { id: req.params.id, fournisseurId: req.fournisseur.id }
        });
        if (!mission) return res.status(404).json({ success: false, message: 'Mission introuvable.' });

        await mission.update({
            statut: 'EN_PREPARATION',
            descriptionTravail: descriptionMateriel
        });

        res.json({ success: true, message: 'Signalement envoyé. New Vision va contacter un partenaire.', data: mission });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST /api/missions/:id/photos — Upload de justificatifs photo
router.post('/:id/photos', protect, checkFournisseur, upload.fields([
    { name: 'photoAvant', maxCount: 1 },
    { name: 'photoApres', maxCount: 1 }
]), async (req, res) => {
    try {
        const mission = await Reservation.findOne({
            where: { id: req.params.id, fournisseurId: req.fournisseur.id }
        });
        if (!mission) return res.status(404).json({ success: false, message: 'Mission introuvable.' });

        const fichiers = {};
        if (req.files?.photoAvant?.[0]) fichiers.photoAvant = req.files.photoAvant[0].filename;
        if (req.files?.photoApres?.[0]) fichiers.photoApres = req.files.photoApres[0].filename;

        if (Object.keys(fichiers).length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune photo fournie.' });
        }

        res.json({ success: true, message: 'Photos envoyées avec succès.', data: { missionId: mission.id, fichiers } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;