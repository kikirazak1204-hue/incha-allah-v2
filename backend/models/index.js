const sequelize = require('../config/database');

// 1. Import des modèles
const User = require('./User');
const Service = require('./Service');
const Fournisseur = require('./Fournisseur');
const Produit = require('./Produit');
const Commande = require('./Commande');
const CommandeProduit = require('./CommandeProduit');
const Facture = require('./Facture');
const Paiement = require('./Paiement');
const Reservation = require('./Reservation');
const Message = require('./Message');
const Solde = require('./Solde');
const Retrait = require('./Retrait');
const Devis = require('./Devis');
const BonIntervention = require('./BonIntervention');
const Setting = require('./Setting');
// Correction de la casse pour Render (h minuscule correspondant au fichier Git)
const SettingHistory = require('./Settinghistory'); 

// 2. Définition des associations

// ==========================================
// Service
// ==========================================
Service.hasMany(Fournisseur, { foreignKey: 'serviceId', as: 'fournisseursService' });
Fournisseur.belongsTo(Service, { foreignKey: 'serviceId', as: 'serviceFournisseur' });

Service.hasMany(Produit, { foreignKey: 'serviceId', as: 'produitsService' });
Produit.belongsTo(Service, { foreignKey: 'serviceId', as: 'produitService' });

Service.hasMany(Reservation, { foreignKey: 'serviceId', as: 'reservationsService' });
Reservation.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

// ==========================================
// Fournisseur
// ==========================================
User.hasOne(Fournisseur, { foreignKey: 'userId', as: 'profilFournisseur' });
Fournisseur.belongsTo(User, { foreignKey: 'userId', as: 'userFournisseur' });

Fournisseur.hasMany(Produit, { foreignKey: 'fournisseurId', as: 'produitsFournisseur' });
Produit.belongsTo(Fournisseur, { foreignKey: 'fournisseurId', as: 'fournisseur' });

Fournisseur.hasMany(Commande, { foreignKey: 'fournisseurId', as: 'commandesFournisseur' });
Commande.belongsTo(Fournisseur, { foreignKey: 'fournisseurId', as: 'fournisseurCommande' });

Fournisseur.hasMany(Reservation, { foreignKey: 'fournisseurId', as: 'missionsPrestataire' });
Reservation.belongsTo(Fournisseur, { foreignKey: 'fournisseurId', as: 'prestataire' });

// ==========================================
// Commande & Produits
// ==========================================
User.hasMany(Commande, { foreignKey: 'clientId', as: 'commandesClient' });
Commande.belongsTo(User, { foreignKey: 'clientId', as: 'clientCommande' });

Commande.hasMany(Facture, { foreignKey: 'commandeId', as: 'facturesCommande' });
Facture.belongsTo(Commande, { foreignKey: 'commandeId', as: 'factureCommande' });

Commande.hasMany(Paiement, { foreignKey: 'commandeId', as: 'paiements' });
Paiement.belongsTo(Commande, { foreignKey: 'commandeId', as: 'commande' });

Commande.hasMany(CommandeProduit, { foreignKey: 'commandeId', as: 'itemsCommande' });
CommandeProduit.belongsTo(Commande, { foreignKey: 'commandeId', as: 'commandeProduit' });
Produit.hasMany(CommandeProduit, { foreignKey: 'produitId', as: 'commandeProduits' });
CommandeProduit.belongsTo(Produit, { foreignKey: 'produitId', as: 'produitCommandeProduit' });

// ==========================================
// Reservation
// ==========================================
User.hasMany(Reservation, { foreignKey: 'clientId', as: 'reservationsClient' });
Reservation.belongsTo(User, { foreignKey: 'clientId', as: 'client' });

Reservation.hasMany(Paiement, { foreignKey: 'reservationId', as: 'paiements' });
Paiement.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });

Reservation.hasMany(Message, { foreignKey: 'reservationId', as: 'messages' });
Message.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservationMessage' });

// ==========================================
// Paiement (Relation User)
// ==========================================
User.hasMany(Paiement, { foreignKey: 'clientId', as: 'paiements' });
Paiement.belongsTo(User, { foreignKey: 'clientId', as: 'client' });

// ==========================================
// Messages & Devis
// ==========================================
User.hasMany(Message, { foreignKey: 'senderId', as: 'messagesEnvoyes' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'expediteur' });

Reservation.hasMany(Devis, { foreignKey: 'reservationId', as: 'devis' });
Devis.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservationDevis' });

Fournisseur.hasMany(Devis, { foreignKey: 'fournisseurId', as: 'devisFournisseur' });
Devis.belongsTo(Fournisseur, { foreignKey: 'fournisseurId', as: 'fournisseurDevis' });

// ==========================================
// Finances Fournisseur (Solde & Retrait)
// ==========================================
Fournisseur.hasOne(Solde, { foreignKey: 'fournisseurId', as: 'soldeFournisseur' });
Solde.belongsTo(Fournisseur, { foreignKey: 'fournisseurId', as: 'fournisseurSolde' });

Fournisseur.hasMany(Retrait, { foreignKey: 'fournisseurId', as: 'retraits' });
Retrait.belongsTo(Fournisseur, { foreignKey: 'fournisseurId', as: 'fournisseurRetrait' });

// ==========================================
// Bon Intervention
// ==========================================
Reservation.hasOne(BonIntervention, { foreignKey: 'reservationId', as: 'bonIntervention' });
BonIntervention.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservationBon' });

Fournisseur.hasMany(BonIntervention, { foreignKey: 'fournisseurId', as: 'bonsIntervention' });
BonIntervention.belongsTo(Fournisseur, { foreignKey: 'fournisseurId', as: 'fournisseurBon' });

// ==========================================
// Paramètres (Setting) 
// ==========================================
User.hasMany(SettingHistory, { foreignKey: 'modifiePar', as: 'modificationsParametres' });
SettingHistory.belongsTo(User, { foreignKey: 'modifiePar', as: 'auteur' });

// 3. Export global
module.exports = {
  sequelize,
  User,
  Service,
  Fournisseur,
  Produit,
  Commande,
  CommandeProduit,
  Facture,
  Paiement,
  Reservation,
  Message,
  Solde,
  Retrait,
  Devis,
  BonIntervention,
  Setting,
  SettingHistory
};