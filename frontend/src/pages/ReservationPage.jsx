import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Layers, Trash2,
    ChevronDown, Wrench, MapPin, AlertTriangle, User
} from 'lucide-react';
import { CONFIG_SERVICES } from '../config/servicesConfig';

const API = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Utilitaires
// ============================================================================
const generateSafeId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `srv-${Math.random().toString(36).substr(2, 9)}`;

const normalize = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getConfigPourService = (srv) => {
    const cle = normalize(srv.categorie || 'default');
    return CONFIG_SERVICES[cle] || CONFIG_SERVICES.default || {
        titre: 'Service', actionBouton: 'Confirmer', typeFormulaire: 'reservation',
        paiementObligatoire: false, collectif: false, champs: []
    };
};

export default function ReservationPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state || {};

    const [servicesSelectionnes, setServicesSelectionnes] = useState(() => {
        const singleService = state.service || JSON.parse(localStorage.getItem('selectedService') || 'null');
        let initialServices = [];
        if (state.services && Array.isArray(state.services)) initialServices = state.services;
        else if (singleService) initialServices = [singleService];
        else {
            const cart = JSON.parse(localStorage.getItem('kanari_cart') || '[]');
            initialServices = cart.map(item => item.service || item);
        }
        return initialServices.map(srv => ({ ...srv, safeId: srv.id || srv._id || srv.serviceId || generateSafeId() }));
    });

    const fournisseurPreselectionne = useMemo(() => {
        return state.fournisseur || JSON.parse(localStorage.getItem('selectedFournisseur') || 'null');
    }, [state.fournisseur]);

    const [activeServiceIndex, setActiveServiceIndex] = useState(0);
    const [detailsServices, setDetailsServices] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [socle, setSocle] = useState({
        clientNom: '', telephone: '', adresse: '', dateIntervention: '', coords: null
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

    // ── Logique dérivée de servicesConfig.js pour l'ENSEMBLE du panier ──
    const requiresKanariPayment = useMemo(() => {
        return servicesSelectionnes.some(srv => getConfigPourService(srv).paiementObligatoire);
    }, [servicesSelectionnes]);

    const totalMontant = useMemo(() => {
        return servicesSelectionnes.reduce((acc, srv) => {
            const config = getConfigPourService(srv);
            return config.paiementObligatoire ? acc + Number(srv.prix || srv.tarif || 0) : acc;
        }, 0);
    }, [servicesSelectionnes]);

    const auMoinsUneCandidature = useMemo(() => {
        return servicesSelectionnes.some(srv => getConfigPourService(srv).typeFormulaire === 'candidature');
    }, [servicesSelectionnes]);

    const handleSocleChange = (field) => (e) => setSocle(p => ({ ...p, [field]: e.target.value }));

    const handleDetailChange = (srvKey, field, value) => {
        setDetailsServices(p => ({ ...p, [srvKey]: { ...(p[srvKey] || {}), [field]: value } }));
    };

    const requestGeolocation = () => {
        if (!navigator.geolocation) return alert("Géolocalisation non supportée.");
        navigator.geolocation.getCurrentPosition(
            (pos) => setSocle(p => ({ ...p, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, adresse: "Position GPS acquise" })),
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

    // ── Validation dynamique : chaque champ `requis` de la config doit être
    // rempli, mais seulement s'il est actuellement affiché (conditionAffiche) ──
    const validerChampsDynamiques = () => {
        for (const srv of servicesSelectionnes) {
            const config = getConfigPourService(srv);
            const valeursActuelles = detailsServices[srv.safeId] || {};
            for (const champ of config.champs || []) {
                const estAffiche = !champ.conditionAffiche || champ.conditionAffiche(valeursActuelles);
                if (estAffiche && champ.requis && !valeursActuelles[champ.id]) {
                    return `Le champ "${champ.label}" est obligatoire pour ${config.titre}.`;
                }
            }
        }
        return null;
    };

    const handleSubmit = async () => {
        setMessage({ text: '', type: '' });

        if (!socle.clientNom || !socle.telephone || !socle.adresse) {
            return setMessage({ text: 'Veuillez remplir votre nom, téléphone et adresse.', type: 'error' });
        }
        // La date n'est obligatoire que si au moins un service en a besoin
        // (une candidature freelance n'a pas forcément de date d'intervention).
        const dateRequise = servicesSelectionnes.some(srv => {
            const config = getConfigPourService(srv);
            return (config.champs || []).every(c => c.id !== 'date') && config.typeFormulaire !== 'candidature';
        });
        if (dateRequise && !socle.dateIntervention) {
            return setMessage({ text: 'Veuillez indiquer une date souhaitée.', type: 'error' });
        }

        const erreurChamp = validerChampsDynamiques();
        if (erreurChamp) {
            return setMessage({ text: erreurChamp, type: 'error' });
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                clientNom: socle.clientNom,
                telephone: socle.telephone,
                adresse: socle.adresse,
                coordonneesGps: socle.coords,
                dateIntervention: socle.dateIntervention ? new Date(socle.dateIntervention).toISOString() : null,
                modePaiement: requiresKanariPayment ? 'depot_kanari' : 'aucun',
                fournisseurId: fournisseurPreselectionne?.id || null,
                services: servicesSelectionnes.map(srv => {
                    const config = getConfigPourService(srv);
                    return {
                        serviceId: srv.safeId,
                        nom: srv.nom || srv.serviceNom || 'Service',
                        prix: config.paiementObligatoire ? Number(srv.prix || srv.tarif || 0) : 0,
                        typeFormulaire: config.typeFormulaire,
                        detailsParticuliers: detailsServices[srv.safeId] || {},
                    };
                }),
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

            if (!res.ok || !data.success) throw new Error(data.message || 'Erreur serveur.');

            ['kanari_cart', 'selectedService', 'selectedFournisseur'].forEach(k => localStorage.removeItem(k));

            const montantAPayer = data.montantTotal ?? (requiresKanariPayment ? totalMontant : 0);

            if (montantAPayer > 0) {
                navigate('/paiement', { state: { reservation: { id: data.id, montantTotal: montantAPayer } } });
            } else {
                setMessage({
                    text: auMoinsUneCandidature
                        ? 'Votre candidature a été transmise avec succès.'
                        : 'Demande transmise avec succès. Le prestataire a été notifié.',
                    type: 'success'
                });
                setTimeout(() => navigate('/'), 1800);
            }
        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

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
    const configActive = getConfigPourService(currentService);
    const valeursActuelles = detailsServices[currentService.safeId] || {};

    return (
        <div className="min-h-screen bg-[#0B0F19] text-white p-6 pb-28 font-sans">
            <div className="max-w-2xl mx-auto space-y-6">

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
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                        {servicesSelectionnes.length === 1 ? configActive.titre : 'Finalisation'}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {fournisseurPreselectionne
                            ? `Prestataire sélectionné : ${fournisseurPreselectionne.nomEntreprise || 'Prestataire'}`
                            : 'Dossier Kanari sécurisé.'}
                    </p>
                </div>

                {message.text && (
                    <div className={`p-4 rounded-xl text-sm font-semibold border ${message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                        {message.text}
                    </div>
                )}

                {/* 1. INFORMATIONS ESSENTIELLES */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                    <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                        <User size={16} className="text-purple-400" /> Vos informations
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="text" placeholder="Nom complet *" value={socle.clientNom} onChange={handleSocleChange('clientNom')} className="w-full bg-black/40 p-3.5 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm transition" />
                        <input type="tel" placeholder="Téléphone *" value={socle.telephone} onChange={handleSocleChange('telephone')} className="w-full bg-black/40 p-3.5 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm transition" />
                    </div>
                    <div className="relative">
                        <input type="text" placeholder="Adresse complète *" value={socle.adresse} onChange={handleSocleChange('adresse')} className="w-full bg-black/40 p-3.5 pr-12 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm transition" />
                        <button type="button" onClick={requestGeolocation} className="absolute right-3 top-3.5 text-purple-400 hover:text-purple-300" title="Utiliser ma position GPS">
                            <MapPin size={18} />
                        </button>
                    </div>
                    {!auMoinsUneCandidature && (
                        <div>
                            <label className="text-[11px] text-slate-500 mb-1 block uppercase font-bold tracking-wider">Date & heure souhaitées</label>
                            <input type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={socle.dateIntervention} onChange={handleSocleChange('dateIntervention')} className="w-full bg-black/40 p-3.5 rounded-xl border border-white/5 focus:border-purple-500 outline-none text-sm" style={{ colorScheme: 'dark' }} />
                        </div>
                    )}
                </div>

                {/* 2. CONFIGURATION DYNAMIQUE — pilotée par servicesConfig.js */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                        <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                            <Layers size={16} className="text-indigo-400" /> Détails ({servicesSelectionnes.length})
                        </h2>
                    </div>

                    {servicesSelectionnes.length > 1 && (
                        <div className="relative">
                            <select value={activeServiceIndex} onChange={(e) => setActiveServiceIndex(Number(e.target.value))} className="w-full bg-black/60 border border-white/10 text-white p-3.5 rounded-xl text-sm font-semibold outline-none appearance-none cursor-pointer focus:border-indigo-500">
                                {servicesSelectionnes.map((srv, idx) => {
                                    const cfg = getConfigPourService(srv);
                                    return (
                                        <option key={srv.safeId} value={idx}>
                                            {idx + 1}. {srv.nom || srv.serviceNom} {cfg.paiementObligatoire && srv.prix ? `(${srv.prix} FCFA)` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-3.5 text-indigo-400 pointer-events-none" />
                        </div>
                    )}

                    <div className="bg-indigo-950/10 border border-indigo-500/20 rounded-xl p-4 mt-3">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{configActive.titre}</span>
                                {configActive.typeFormulaire === 'candidature' && (
                                    <span className="ml-2 text-[10px] text-slate-400 uppercase">Candidature — sans paiement</span>
                                )}
                            </div>
                            {servicesSelectionnes.length > 1 && (
                                <button type="button" onClick={() => handleRemoveService(activeServiceIndex)} className="text-rose-400/70 hover:text-rose-400 transition p-1">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {(configActive.champs || []).map(champ => {
                                const estAffiche = !champ.conditionAffiche || champ.conditionAffiche(valeursActuelles);
                                if (!estAffiche) return null;

                                const largeurClass = champ.demiLargeur ? 'sm:col-span-1' : 'sm:col-span-2';
                                const valeur = valeursActuelles[champ.id] || '';

                                return (
                                    <div key={champ.id} className={largeurClass}>
                                        {champ.type === 'textarea' ? (
                                            <textarea
                                                rows={2}
                                                placeholder={(champ.placeholder || champ.label) + (champ.requis ? ' *' : '')}
                                                value={valeur}
                                                onChange={(e) => handleDetailChange(currentService.safeId, champ.id, e.target.value)}
                                                className="w-full bg-black/40 p-3 rounded-xl border border-white/5 text-sm outline-none focus:border-indigo-500 resize-none transition"
                                            />
                                        ) : champ.type === 'select' ? (
                                            <select
                                                value={valeur}
                                                onChange={(e) => handleDetailChange(currentService.safeId, champ.id, e.target.value)}
                                                className="w-full bg-black/40 p-3 rounded-xl border border-white/5 text-sm outline-none focus:border-indigo-500 transition appearance-none"
                                            >
                                                <option value="" disabled>{champ.label}{champ.requis ? ' *' : ''}</option>
                                                {(champ.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type={champ.type}
                                                placeholder={(champ.placeholder || champ.label) + (champ.requis ? ' *' : '')}
                                                value={valeur}
                                                onChange={(e) => handleDetailChange(currentService.safeId, champ.id, e.target.value)}
                                                className="w-full bg-black/40 p-3 rounded-xl border border-white/5 text-sm outline-none focus:border-indigo-500 transition"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-2xl font-black text-sm tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                    {loading
                        ? 'Traitement en cours...'
                        : requiresKanariPayment
                            ? `Payer & valider (${totalMontant.toLocaleString()} FCFA)`
                            : servicesSelectionnes.length === 1
                                ? configActive.actionBouton
                                : 'Confirmer la demande'}
                </button>
            </div>
        </div>
    );
}