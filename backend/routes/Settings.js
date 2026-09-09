const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAllSettings, updateSetting, getHistoriqueSetting } = require('../controllers/settingsController');

const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
};

router.get('/', protect, adminOnly, getAllSettings);
router.put('/:cle', protect, adminOnly, updateSetting);
router.get('/:cle/historique', protect, adminOnly, getHistoriqueSetting);

module.exports = router;