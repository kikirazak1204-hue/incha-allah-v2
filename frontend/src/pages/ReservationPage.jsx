import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Layers, CreditCard, CheckCircle2, Trash2, 
    ChevronDown, Wrench, MapPin, AlertTriangle, User, Calendar 
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

// ============================================================================
// 🛠 CONFIGURATION DYNAMIQUE DES SERVICES (Règles métier Kanari)
// ============================================================================
const CONFIG_SERVICES = {
    panne: {
        titre: "Signaler une Panne",
        paiementKanari: false, // Évaluation sur place obligatoire
        champs: [
            { id: 'urgence', type: 'select', label: 'Niveau d\'urgence', options: ['Basse (48h)', 'Moyenne (Journée)', 'Haute (Immédiat)'] },
            { id: 'description', type: 'textarea', label: 'Description de la panne', placeholder: 'Ex: Fuite d\'eau, appareil qui ne s\'allume plus...' }
        ]
    },
    divertissement: {
        titre: "Événement / Divertissement",
        paiementKanari: true, // Cotisation ou ticket obligatoire
        champs: [
            { id: 'lieu', type: 'text', label: 'Lieu de l\'événement' },
            { id: 'participants', type: 'number', label: 'Nombre de participants' }
        ]
    },
    rendez_vous: {
        titre: "Prise de Rendez-vous",
        paiementKanari: false, // Juste une prise de contact
        champs: [
            { id: 'motif', type: 'text', label: 'Motif du RDV', placeholder: 'Ex: Consultation, Devis...' }
        ]
    },
    mission_freelance: {
        titre: "Mission Freelance",
        paiementKanari: false,
        champs: [
            { id: 'domaine', type: 'select', label: 'Domaine', options: ['Manutention', 'Tech', 'Bricolage', 'Esthétique'] },
            { id: 'details', type: 'textarea', label: 'Détails de la mission' }
        ]
    },
    benevolat: {
        titre: "Bénévolat",
        paiementKanari: false,
        champs: [
            { id: 'motivation', type: 'textarea', label: 'Votre motivation / besoin' }
        ]
    },
    default: {
        titre: "Service Standard",
        paiementKanari: false,
        champs: [
            { id: 'precision', type: 'textarea', label: 'Précisions pour le prestataire', placeholder: 'Détaillez votre besoin ici...' }
        ]
    }
};

// ============================================================================
// 🧩 UTILITAIRES
// ============================================================================
const generateSafeId = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `srv-${Math.random().toString(36).substr(2, 9)}`;
};

const normalize = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function ReservationPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state || {};

    // 1. Initialisation sécurisée des services
    const [servicesSelectionnes, setServicesSelectionnes] = useState(() => {
        const singleService = state.service || JSON.parse(localStorage.getItem('selectedService') || 'null');
        let initialServices = [];
        if (state.services && Array.isArray(state.services)) initialServices = state.services;
        else if (singleService) initialServices = [singleService];
        else {
            const cart = JSON.parse(localStorage.getItem('kanari_cart') || '[]');
            initialServices = cart.map(item => item.service || item);
        }
        // Sécurisation des IDs pour éviter le plantage SQL
        return initialServices.map(srv => ({ ...srv, safeId: srv.id || srv._id || srv.serviceId || generateSafeId() }));
    });

    const [activeServiceIndex, setActiveServiceIndex] = useState(0);
    const [detailsServices, setDetailsServices] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // 2. Auto-complétion via le profil utilisateur
    const [socle, setSocle] = useState({
        clientNom: '', telephone: '', adresse: '', dateIntervention: '', coords: null, modePaiement: 'direct_prestataire'
    });

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const token = localStorage.getItem('token');
            if (token && user.nom) {
                setIsLoggedIn(true);
                setSocle(prev => ({
                    ...prev,
                    clientNom: `${user.prenom || ''} ${user.nom || ''}`.trim(),
                    telephone: user.telephone || '',
                }));
            }
        } catch (e) { console.error("Erreur lecture user:", e); }
    }, []);

    // 3. Logique Métier Dynamique : Faut-il payer via Kanari ?
    const requiresKanariPayment = useMemo(() => {
        return servicesSelectionnes.some(srv => {
            const cat = normalize(srv.categorie || 'default');
            const config = CONFIG_SERVICES[cat] || CONFIG_SERVICES.default;
            return config.paiementKanari;
        });
    }, [servicesSelectionnes]);

    const totalMontant = useMemo(() => {
        if (!requiresKanariPayment) return 0;
        return servicesSelectionnes.reduce((acc, srv) => acc + Number(srv.prix || srv.tarif || 0), 0);
    }, [servicesSelectionnes, requiresKanariPayment]);

    // 4. Gestionnaires d'événements
    const handleSocleChange = (field) => (e) => setSocle(p => ({ ...p, [field]: e.target.value }));
    const handleDetailChange = (srvKey, field, value) => {
        setDetailsServices(p => ({ ...p, [srvKey]: { ...(p[srvKey] || {}), [field]: value } }));
    };

    const requestGeolocation = () => {
        if (!navigator.geolocation) return alert("Géolocalisation non supportée.");
        navigator.geolocation.getCurrentPosition(
            (pos) => setSocle(p => ({ ...p, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, adresse: "Position GPS acquise 📍" })),
            () => alert("Impossible d'obtenir la position.")
        );
    };

    const handleRemoveService = (indexToRemove) => {
        const updated = servicesSelectionnes.filter((_, idx) => idx !== indexToRemove);
        setServicesSelectionnes(updated);
        if (activeServiceIndex >= updated.length) setActiveServiceIndex(Math.max(0, updated.length - 1));
        if (updated.length === 0) {
            localStorage.removeItem('selectedService');
            localStorage.removeItem('kanari_cart');
        }
    };

    const handleSubmit = async () => {
        setMessage({ text: '', type: '' });
        
        if (!socle.clientNom || !socle.telephone || !socle.adresse || !socle.dateIntervention) {
            return setMessage({ text: 'Veuillez remplir tous les champs obligatoires (*).', type: 'error' });
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                clientNom: socle.clientNom,
                telephone: socle.telephone,
                adresse: socle.adresse,
                coordonneesGps: socle.coords,
                dateIntervention: new Date(socle.dateIntervention).toISOString(),
                modePaiement: requiresKanariPayment ? 'depot_kanari' : 'aucun', // Automatisé
                montantTotal: totalMontant,
                fournisseurId: JSON.parse(localStorage.getItem('selectedFournisseur') || 'null')?.id || null,
                services: servicesSelectionnes.map(srv => ({
                    serviceId: srv.safeId,
                    nom: srv.nom || srv.serviceNom || 'Service',
                    prix: requiresKanariPayment ? Number(srv.prix || srv.tarif || 0) : 0,
                    detailsParticuliers: detailsServices[srv.safeId] || {},
                })),
            };

            const res = await fetch(`${API}/api/reservations/global`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok || !(data.success || data.id)) throw new Error(data.message || 'Erreur serveur.');

            // Nettoyage complet
            ['kanari_cart', 'selectedService', 'selectedFournisseur'].forEach(k => localStorage.removeItem(k));

            if (requiresKanariPayment && totalMontant > 0) {
                navigate('/paiement', { state: { reservation: { id: data.id || data.data?.id, montantTotal: totalMontant } } });
            } else {
                alert('✅ Demande transmise avec succès ! Le prestataire a été notifié.');
                navigate('/');
            }
        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Rendu si panier vide
    if (servicesSelectionnes.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F19] text-white p-6">
                <Wrench size={48} className="text-slate-600 mb-4" />
                <p className="text-2xl font-black mb-2">Dossier vide</p>
                <p className="text-slate-400 mb-6">Sélectionnez un service depuis l'accueil.</p>
                <button onClick={() => navigate('/')} className="px-6 py-3 bg-purple-600 rounded-xl font-bold hover:bg-purple-700 transition">Retour</button>
            </div>
        );
    }

    const currentService = servicesSelectionnes[activeServiceIndex];
    const catNormalize = normalize(currentService.categorie || 'default');
    const configActive = CONFIG_SERVICES[catNormalize] || CONFIG_SERVICES.default;

    return (
        <div className="min-h-screen bg-[#0B0F19] text-white p-6 pb-28 font-sans selection:bg-purple-500/30">
            <div className="max-w-2xl mx-auto space-y-6">
                
                {/* HEADER */}
                <div className="flex justify-between items-center">
                    <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center gap-2 transition">
                        <ArrowLeft size={18} /> Retour
                    </button>
                    {!isLoggedIn && (
                        <span className="text-[10px] bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full border border-orange-500/20 flex items-center gap-1.5 uppercase font-bold tracking-wider">
                            <AlertTriangle size={12} /> Non connecté
                        </span>
                    )}
                </div>

                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Finalisation</h1>
                    <p className="text-slate-400 text-sm mt-1">Dossier multi-services sécurisé Kanari.</p>
                </div>

                {message.text && (
                    <div className={`p-4 rounded-xl text-sm font-semibold border ${message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                        {message.text}
                    </div>
                )}

                {/* 1. INFORMATIONS ESSENTIELLES */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                        <User size={16} className="text-purple-400" /> 1. Vos Informations
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <input type="text" placeholder="Nom complet *" value={socle.clientNom} onChange={handleSocleChange('clientNom')} className="w-full bg-black/40 p-3.5 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm transition" />
                        </div>
                        <div>
                            <input type="tel" placeholder="Téléphone *" value={socle.telephone} onChange={handleSocleChange('telephone')} className="w-full bg-black/40 p-3.5 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm transition" />
                        </div>
                    </div>
                    <div className="relative">
                        <input type="text" placeholder="Adresse complète d'intervention *" value={socle.adresse} onChange={handleSocleChange('adresse')} className="w-full bg-black/40 p-3.5 pr-12 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm transition" />
                        <button onClick={requestGeolocation} className="absolute right-3 top-3.5 text-purple-400 hover:text-purple-300" title="Utiliser ma position GPS">
                            <MapPin size={18} />
                        </button>
                    </div>
                    <div>
                        <label className="text-[11px] text-slate-500 mb-1 block uppercase font-bold tracking-wider">Date & Heure souhaitées *</label>
                        <input type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={socle.dateIntervention} onChange={handleSocleChange('dateIntervention')} className="w-full bg-black/40 p-3.5 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm" style={{ colorScheme: 'dark' }} />
                    </div>
                </div>

                {/* 2. CONFIGURATION DYNAMIQUE */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                        <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                            <Layers size={16} className="text-indigo-400" /> 2. Configuration ({servicesSelectionnes.length})
                        </h2>
                    </div>

                    <div className="relative">
                        <select value={activeServiceIndex} onChange={(e) => setActiveServiceIndex(Number(e.target.value))} className="w-full bg-black/60 border border-white/10 text-white p-3.5 rounded-xl text-sm font-semibold outline-none appearance-none cursor-pointer focus:border-indigo-500">
                            {servicesSelectionnes.map((srv, idx) => (
                                <option key={srv.safeId} value={idx}>{idx + 1}. {srv.nom || srv.serviceNom} {requiresKanariPayment && srv.prix ? `(${srv.prix} FCFA)` : ''}</option>
                            ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-4 top-3.5 text-indigo-400 pointer-events-none" />
                    </div>

                    <div className="bg-indigo-950/10 border border-indigo-500/20 rounded-xl p-4 mt-3">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{configActive.titre}</span>
                            <button onClick={() => handleRemoveService(activeServiceIndex)} className="text-rose-400/70 hover:text-rose-400 transition p-1"><Trash2 size={16} /></button>
                        </div>
                        
                        {/* RENDU DYNAMIQUE DES CHAMPS SELON LA CATÉGORIE */}
                        <div className="space-y-3">
                            {configActive.champs.map(champ => (
                                <div key={champ.id}>
                                    {champ.type === 'textarea' ? (
                                        <textarea
                                            rows={2}
                                            placeholder={champ.placeholder || champ.label}
                                            value={detailsServices[currentService.safeId]?.[champ.id] || ''}
                                            onChange={(e) => handleDetailChange(currentService.safeId, champ.id, e.target.value)}
                                            className="w-full bg-black/40 p-3 rounded-xl border border-white/5 text-sm outline-none focus:border-indigo-500 resize-none transition"
                                        />
                                    ) : champ.type === 'select' ? (
                                        <select
                                            value={detailsServices[currentService.safeId]?.[champ.id] || ''}
                                            onChange={(e) => handleDetailChange(currentService.safeId, champ.id, e.target.value)}
                                            className="w-full bg-black/40 p-3 rounded-xl border border-white/5 text-sm outline-none focus:border-indigo-500 transition appearance-none"
                                        >
                                            <option value="" disabled>{champ.label}</option>
                                            {champ.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type={champ.type}
                                            placeholder={champ.label}
                                            value={detailsServices[currentService.safeId]?.[champ.id] || ''}
                                            onChange={(e) => handleDetailChange(currentService.safeId, champ.id, e.target.value)}
                                            className="w-full bg-black/40 p-3 rounded-xl border border-white/5 text-sm outline-none focus:border-indigo-500 transition"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* BOUTON DE VALIDATION INTELLIGENT */}
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-2xl font-black text-sm tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                    {loading ? 'Traitement en cours...' : requiresKanariPayment ? `Payer & Valider (${totalMontant.toLocaleString()} FCFA)` : 'Confirmer la Demande (Sans Paiement)'}
                </button>
            </div>
        </div>
    );
}