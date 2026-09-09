const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BonIntervention = sequelize.define('BonIntervention', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    reservationId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    fournisseurId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    // ── Rempli par le prestataire ──────────────────────
    descriptionTravail: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    montantMainOeuvre: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    piecesOutils: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    montantPiecesOutils: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    montantFinal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false // Calculé automatiquement par le Hook ci-dessous
    },

    // ── Commission Kanari — CORRIGÉ : ces trois champs existaient déjà
    // en base (migration 20260908000002) mais n'étaient pas déclarés ici,
    // donc Sequelize les ignorait silencieusement à chaque écriture.
    // Le taux est figé sur CE bon au moment de sa création et ne change
    // jamais rétroactivement, même si le taux standard est modifié
    // ensuite (voir Setting 'commission.taux_standard').
    tauxCommissionApplique: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    montantCommission: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    montantNet: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },

    // ── Validation côté client ─────────────────────────
    valide: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    valideLe: {
        type: DataTypes.DATE,
        allowNull: true
    },
    valideAutomatiquement: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    note: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 1,
            max: 5
        }
    },
    commentaire: {
        type: DataTypes.TEXT,
        allowNull: true
    },

}, {
    tableName: 'bons_intervention',
    timestamps: true,

    hooks: {
        beforeValidate: (bon) => {
            const mainOeuvre = parseFloat(bon.montantMainOeuvre) || 0;
            const pieces = parseFloat(bon.montantPiecesOutils) || 0;

            bon.montantMainOeuvre = mainOeuvre;
            bon.montantPiecesOutils = pieces;
            bon.montantFinal = mainOeuvre + pieces;
        }
    }
});

module.exports = BonIntervention;