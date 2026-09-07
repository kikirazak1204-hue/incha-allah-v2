require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Importation de la connexion Sequelize
const { sequelize } = require('./models');

// Job planifié : validation automatique des bons d'intervention après 24h
const { runAutoValiderBonsIntervention } = require('./jobs/autoValiderBonsIntervention');

// ==========================================
// 🔥 INITIALISATION FIREBASE ADMIN SDK
// ==========================================
try {
    require('./config/firebase-admin');
} catch (fbErr) {
    console.warn('⚠️ Firebase Admin n’a pas pu être chargé au démarrage :', fbErr.message);
}

const app = express();

// ==========================================
// 🛡️ NETTOYEUR DE DOUBLE SLASH (Anti-404 URL)
// ==========================================
app.use((req, res, next) => {
    if (req.url.includes('//')) {
        req.url = req.url.replace(/\/+/g, '/');
    }
    next();
});

// ==========================================
// 📁 UPLOADS — dossier + route statique
// ==========================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Dossier "uploads" créé automatiquement.');
}

// ==========================================
// 1. MIDDLEWARES DE SÉCURITÉ & PARSING
// ==========================================

app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sert les fichiers uploadés
app.use('/uploads', express.static(uploadDir));

// ==========================================
// 2. ROUTES DE DIAGNOSTIC (Health Check)
// ==========================================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// ==========================================
// SUPPRIMÉ : ancienne route factice /api/reservations/global déclarée
// directement sur `app`. Elle interceptait TOUTES les réservations avant
// qu'elles n'atteignent le vrai contrôleur (routes/reservations.js →
// createGlobalReservation), qui écrit réellement en base et notifie le
// prestataire. Résultat concret du bug : chaque réservation soumise
// depuis ReservationPage.jsx recevait une fausse confirmation, sans
// jamais être créée en base — aucun fournisseur ne la recevait jamais.
// La vraie route est maintenant la seule à exister, montée plus bas via
// app.use('/api/reservations', require('./routes/reservations')).
// ==========================================

// ==========================================
// 4. ENREGISTREMENT DES ROUTES API
// ==========================================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/paiements', require('./routes/paiement'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/produits', require('./routes/produits'));
app.use('/api/services', require('./routes/services'));
app.use('/api/fournisseurs', require('./routes/fournisseurs'));
app.use('/api/bons-intervention', require('./routes/bonsIntervention'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/devis', require('./routes/devis'));
app.use('/api/commandes', require('./routes/commandes'));
app.use('/api/commande-produits', require('./routes/commandeProduits'));
app.use('/api/factures', require('./routes/factures'));
app.use('/api/soldes', require('./routes/soldes'));
app.use('/api/missions', require('./routes/missions'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// ==========================================
// 5. GESTION DES ROUTES INEXISTANTES (404)
// ==========================================

app.use((req, res, next) => {
    res.status(404).json({
        error: `La route demandée ${req.originalUrl} n'existe pas sur ce serveur.`
    });
});

// ==========================================
// 6. MIDDLEWARE GLOBAL DE GESTION D'ERREURS
// ==========================================

app.use((err, req, res, next) => {
    console.error('❌ ERREUR SERVEUR :', err);

    if (err.name === 'SequelizeDatabaseError') {
        return res.status(400).json({
            error: 'Erreur SQL (données tronquées, type invalide ou contrainte violée).',
            details: err.message
        });
    }

    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            error: 'Erreur de validation des champs.',
            details: err.errors.map(e => e.message)
        });
    }

    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Jeton d’authentification invalide ou expiré.' });
    }

    return res.status(err.status || 500).json({
        error: err.message || 'Erreur interne du serveur.'
    });
});

// ==========================================
// 🛠️ RÉPARATION AUTOMATIQUE DE COLONNES
// ==========================================
const repairDatabase = async () => {
    const queries = [
        "ALTER TABLE produits ADD COLUMN categorie VARCHAR(255);",
        "ALTER TABLE produits ADD COLUMN quantite INT DEFAULT 0;",
        "ALTER TABLE users ADD COLUMN fcm_token TEXT;"
    ];

    console.log("🛠️ Vérification des colonnes manquantes...");
    for (const q of queries) {
        try {
            await sequelize.query(q);
            console.log(`✅ Colonne ajoutée : ${q}`);
        } catch (error) {
            if (error.message.includes('Duplicate column') || error.message.includes('ER_DUP_FIELDNAME')) {
                console.log(`ℹ️ Déjà présente, ignorée.`);
            } else {
                console.log(`⚠️ Erreur ignorée :`, error.message);
            }
        }
    }
    console.log("✅ Vérification des colonnes terminée.");
};

// ==========================================
// ⏱️ PLANIFICATION DU JOB DE VALIDATION AUTOMATIQUE
// ==========================================
// Exécute la validation automatique des bons d'intervention en attente
// depuis plus de 24h : une fois au démarrage (rattrape ce qui s'est
// accumulé pendant que le serveur était éteint), puis toutes les heures.
const INTERVALLE_JOB_MS = 60 * 60 * 1000; // 1 heure
let intervalleJobBons = null;

const demarrerJobAutoValidation = () => {
    // Premier passage peu après le démarrage, pour ne pas bloquer le boot
    setTimeout(() => {
        runAutoValiderBonsIntervention().catch(err =>
            console.error('[auto-validation] Erreur au passage initial :', err.message)
        );
    }, 10_000);

    intervalleJobBons = setInterval(() => {
        runAutoValiderBonsIntervention().catch(err =>
            console.error('[auto-validation] Erreur lors du passage planifié :', err.message)
        );
    }, INTERVALLE_JOB_MS);

    console.log(`⏱️ Job de validation automatique des bons d'intervention planifié (toutes les ${INTERVALLE_JOB_MS / 60000} min).`);
};

// ==========================================
// 7. INITIALISATION ET DÉMARRAGE
// ==========================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion réussie à la base de données MySQL.');

        await repairDatabase();

        await sequelize.sync();
        console.log('✅ Base de données synchronisée.');

        app.listen(PORT, () => {
            console.log(`🚀 Serveur en écoute sur le port ${PORT}`);
        });

        demarrerJobAutoValidation();
    } catch (error) {
        console.error('❌ Impossible de se connecter ou de synchroniser la base de données :', error);
        process.exit(1);
    }
};

startServer();

process.on('SIGINT', async () => {
    console.log('\nFermeture du serveur et des connexions DB...');
    if (intervalleJobBons) clearInterval(intervalleJobBons);
    await sequelize.close();
    process.exit(0);
});