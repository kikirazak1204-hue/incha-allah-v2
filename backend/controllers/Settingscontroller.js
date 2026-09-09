const { Setting, SettingHistory } = require('../models');

// Hiérarchie des niveaux — un niveau peut modifier son propre palier et
// tout ce qui est en dessous (SUPER_ADMIN peut tout, OPERATIONS le moins).
const NIVEAUX = ['OPERATIONS', 'COMPTABILITE', 'AGENT', 'ADMIN', 'SUPER_ADMIN'];

function peutModifier(niveauUtilisateur, niveauRequis) {
    const iUtilisateur = NIVEAUX.indexOf(niveauUtilisateur);
    const iRequis = NIVEAUX.indexOf(niveauRequis);
    if (iUtilisateur === -1 || iRequis === -1) return false;
    return iUtilisateur >= iRequis;
}

function parseValeur(setting) {
    switch (setting.type) {
        case 'INTEGER': return parseInt(setting.valeur, 10);
        case 'DECIMAL': return parseFloat(setting.valeur);
        case 'BOOLEAN': return setting.valeur === 'true' || setting.valeur === '1';
        case 'JSON': try { return JSON.parse(setting.valeur); } catch { return null; }
        default: return setting.valeur;
    }
}

// ── GET /api/settings — tous les paramètres, groupés par catégorie ──
exports.getAllSettings = async (req, res) => {
    try {
        const settings = await Setting.findAll({ order: [['categorie', 'ASC'], ['cle', 'ASC']] });
        const parCategorie = {};
        for (const s of settings) {
            if (!parCategorie[s.categorie]) parCategorie[s.categorie] = [];
            parCategorie[s.categorie].push({ ...s.toJSON(), valeurTypee: parseValeur(s) });
        }
        res.json({ success: true, data: parCategorie });
    } catch (err) {
        console.error('Erreur getAllSettings :', err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ── GET /api/settings/:cle — un paramètre précis (usage interne backend) ──
exports.getSettingParCle = async (cle) => {
    const setting = await Setting.findOne({ where: { cle } });
    if (!setting) return null;
    return parseValeur(setting);
};

// ── PUT /api/settings/:cle — modification, historique obligatoire ──
exports.updateSetting = async (req, res) => {
    try {
        const { cle } = req.params;
        const { valeur, motif } = req.body;

        if (valeur === undefined || valeur === null || valeur === '') {
            return res.status(400).json({ success: false, message: 'La nouvelle valeur est obligatoire.' });
        }
        if (!motif || !motif.trim()) {
            return res.status(400).json({ success: false, message: 'Un motif de modification est obligatoire (traçabilité).' });
        }

        const setting = await Setting.findOne({ where: { cle } });
        if (!setting) return res.status(404).json({ success: false, message: 'Paramètre introuvable.' });

        const niveauUtilisateur = req.user.niveauAdmin || (req.user.role === 'admin' ? 'ADMIN' : 'OPERATIONS');
        if (!peutModifier(niveauUtilisateur, setting.modifiablePar)) {
            return res.status(403).json({
                success: false,
                message: `Ce paramètre nécessite le niveau ${setting.modifiablePar} ou supérieur.`
            });
        }

        const ancienneValeur = setting.valeur;
        await setting.update({ valeur: String(valeur) });

        await SettingHistory.create({
            settingCle: cle,
            ancienneValeur,
            nouvelleValeur: String(valeur),
            modifiePar: req.user.id,
            motif: motif.trim()
        });

        res.json({ success: true, message: 'Paramètre mis à jour.', data: setting });
    } catch (err) {
        console.error('Erreur updateSetting :', err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ── GET /api/settings/:cle/historique ──
exports.getHistoriqueSetting = async (req, res) => {
    try {
        const historique = await SettingHistory.findAll({
            where: { settingCle: req.params.cle },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: historique });
    } catch (err) {
        console.error('Erreur getHistoriqueSetting :', err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};