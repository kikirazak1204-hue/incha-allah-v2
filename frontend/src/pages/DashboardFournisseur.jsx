import React, { useEffect, useState, useRef } from 'react';
import { getDashboardFournisseur, getProduitsFournisseur, deleteProduit, addProduit } from '../util/api';
import { useNotification } from '../context/NotificationContext.jsx';
import SoldeRetrait from '../components/SoldeRetrait';
import { STATUT, STATUT_FALLBACK, BADGE_PROFIL, STATUTS_TELEPHONE_VISIBLE } from '../constants/statuts';
import BonInterventionPrint from '../components/BonInterventionPrint';

const API = import.meta.env.VITE_API_URL;

function StatutBadge({ statut }) {
    const s = STATUT[statut] || { ...STATUT_FALLBACK, label: statut || 'Inconnu' };
    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${s.bg} ${s.text} ${s.border} backdrop-blur-md shadow-sm transition-all`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    );
}

function StatCard({ label, value, gradient }) {
    return (
        <div className="relative overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] p-6 rounded-2xl border border-white/[0.07] hover:border-white/[0.15] transition-all duration-300 group shadow-xl">
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors block mb-2">{label}</span>
            <p className="text-3xl font-extrabold tracking-tight text-white">{value ?? '—'}</p>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════
// MODAL : BON D'INTERVENTION — POST /api/bons-intervention
// Après envoi réussi : proposition d'impression immédiate du bon transmis.
// ════════════════════════════════════════════════════════════════
function BonInterventionModal({ mission, onClose, token, onSuccess }) {
    const [description, setDescription] = useState('');
    const [montantMainOeuvre, setMontantMainOeuvre] = useState('');
    const [piecesOutils, setPiecesOutils] = useState('');
    const [montantPiecesOutils, setMontantPiecesOutils] = useState('');
    const [loading, setLoading] = useState(false);
    const [erreur, setErreur] = useState('');
    const [bonEnvoye, setBonEnvoye] = useState(null);
    const printRef = useRef(null);

    const totalFinal = Number(montantMainOeuvre || 0) + Number(montantPiecesOutils || 0);

    const soumettreBon = async (e) => {
        e.preventDefault();
        setErreur('');

        if (!description.trim() || !montantMainOeuvre) {
            setErreur("Veuillez remplir la description et le montant de la main-d'œuvre.");
            return;
        }
        if (isNaN(Number(montantMainOeuvre)) || Number(montantMainOeuvre) <= 0) {
            setErreur("Le montant de main-d'œuvre doit être un nombre supérieur à 0.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API}/api/bons-intervention`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    reservationId: mission.id,
                    descriptionTravail: description.trim(),
                    montantMainOeuvre: Number(montantMainOeuvre),
                    piecesOutils: piecesOutils.trim() || null,
                    montantPiecesOutils: Number(montantPiecesOutils || 0),
                })
            }).then(r => r.json());

            if (response.success) {
                onSuccess(mission.id, 'TERMINEE');
                setBonEnvoye({
                    descriptionTravail: description.trim(),
                    montantMainOeuvre: Number(montantMainOeuvre),
                    piecesOutils: piecesOutils.trim() || null,
                    montantPiecesOutils: Number(montantPiecesOutils || 0),
                    createdAt: new Date().toISOString(),
                });
            } else {
                setErreur(response.message || 'Erreur lors de la validation.');
            }
        } catch (err) {
            console.error(err);
            setErreur('Erreur réseau ou serveur lors de la transmission.');
        } finally {
            setLoading(false);
        }
    };

    const imprimer = () => window.print();

    // Écran de confirmation + impression après envoi réussi
    if (bonEnvoye) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md print:bg-white">
                <div className="w-full max-w-lg bg-[#0E1320] border border-emerald-500/30 rounded-3xl shadow-2xl p-6 space-y-5 text-center print:hidden">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500/30" />
                    <div>
                        <h3 className="text-lg font-black text-white">Bon transmis avec succès</h3>
                        <p className="text-sm text-slate-400 mt-1">Le client va recevoir une notification pour valider la prestation.</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={imprimer} className="flex-1 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold rounded-xl text-xs transition-all">
                            Imprimer le bon
                        </button>
                        <button onClick={onClose} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all">
                            Fermer
                        </button>
                    </div>
                </div>

                <BonInterventionPrint
                    ref={printRef}
                    type="bon"
                    numero={`BI-${mission.id}`}
                    mission={mission}
                    client={mission.client}
                    prestataire={mission.prestataire}
                    description={bonEnvoye.descriptionTravail}
                    dateDocument={bonEnvoye.createdAt}
                    lignes={[
                        { label: "Main d'œuvre", montant: bonEnvoye.montantMainOeuvre },
                        { label: bonEnvoye.piecesOutils || 'Pièces / matériel', montant: bonEnvoye.montantPiecesOutils },
                    ]}
                />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="w-full max-w-lg bg-[#0E1320] border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 text-slate-100">
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">Rapport & Bon d'Intervention</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg font-bold">×</button>
                </div>

                {erreur && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 text-rose-300 text-xs font-semibold text-center">
                        {erreur}
                    </div>
                )}

                <form onSubmit={soumettreBon} className="space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5">Description des travaux effectués *</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Détaillez précisément ce que vous avez réparé ou accompli..."
                            rows="4"
                            className="w-full bg-[#090D16] border border-white/[0.08] focus:border-purple-500 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all shadow-inner"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5">Matériaux / Pièces utilisés (Optionnel)</label>
                        <input
                            type="text"
                            value={piecesOutils}
                            onChange={e => setPiecesOutils(e.target.value)}
                            placeholder="Ex: Joint silicone, Câble 2m, Robinetterie"
                            className="w-full bg-[#090D16] border border-white/[0.08] focus:border-purple-500 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none transition-all shadow-inner"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5">Coût Main d'œuvre (FCFA) *</label>
                            <input
                                type="number"
                                value={montantMainOeuvre}
                                onChange={e => setMontantMainOeuvre(e.target.value)}
                                placeholder="Ex: 15000"
                                className="w-full bg-[#090D16] border border-white/[0.08] focus:border-purple-500 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all shadow-inner"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5">Coût des Pièces (FCFA)</label>
                            <input
                                type="number"
                                value={montantPiecesOutils}
                                onChange={e => setMontantPiecesOutils(e.target.value)}
                                placeholder="Ex: 5000 (Laisser vide si 0)"
                                className="w-full bg-[#090D16] border border-white/[0.08] focus:border-purple-500 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex justify-between items-center text-sm">
                        <span className="font-bold text-emerald-400">Total Facturé au Client :</span>
                        <span className="font-black text-emerald-400 text-base">{totalFinal.toLocaleString('fr-FR')} FCFA</span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                        Ce bon sera envoyé au client pour validation. Une fois validé, le compte à rebours de 48h pour le dépôt de votre commission démarre automatiquement.
                    </p>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold rounded-xl text-sm transition-all">Annuler</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.99] disabled:opacity-50">
                            {loading ? 'Transmission...' : 'Envoyer le Bon'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════
// MODAL : AJOUTER UN PRODUIT
// ════════════════════════════════════════════════════════════════
function AjouterProduitModal({ onClose, onSuccess }) {
    const { showNotification } = useNotification();
    const [nom, setNom] = useState('');
    const [prix, setPrix] = useState('');
    const [categorie, setCategorie] = useState('');
    const [quantite, setQuantite] = useState('');
    const [description, setDescription] = useState('');
    const [fichier, setFichier] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const soumettre = async (e) => {
        e.preventDefault();
        setError('');
        if (!nom.trim() || !prix) { setError('Le nom et le prix sont obligatoires.'); return; }
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('nom', nom.trim());
            fd.append('prix', prix);
            fd.append('categorie', categorie.trim());
            fd.append('quantite', quantite || 0);
            fd.append('description', description.trim());
            if (fichier) fd.append('image', fichier);

            const res = await addProduit(fd);
            if (res && res.success !== false) {
                onSuccess(res.data || { id: Date.now(), nom: nom.trim(), prix, categorie: categorie.trim(), quantite });
                showNotification({ title: 'Produit ajouté', body: `L'article "${nom.trim()}" a bien été ajouté à votre boutique.`, categorie: 'Boutique' });
                onClose();
            } else {
                setError(res?.message || "Échec de l'ajout du produit.");
            }
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Erreur réseau. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="w-full max-w-lg bg-[#0E1320] border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-white"> Ajouter un produit</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-bold">×</button>
                </div>

                {error && (
                    <div className="mb-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 text-rose-300 text-xs font-semibold text-center">{error}</div>
                )}

                <form onSubmit={soumettre} className="space-y-4">
                    <input type="text" placeholder="Nom du produit *" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full bg-[#161c2e] text-white p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500" />
                    <input type="number" placeholder="Prix (FCFA) *" value={prix} onChange={(e) => setPrix(e.target.value)} className="w-full bg-[#161c2e] text-white p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500" />
                    <div className="flex gap-2">
                        <input type="text" placeholder="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value)} className="flex-1 bg-[#161c2e] text-white p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500" />
                        <input type="number" placeholder="Qté" min="0" value={quantite} onChange={(e) => setQuantite(e.target.value)} className="w-24 bg-[#161c2e] text-white p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500" />
                    </div>
                    <textarea placeholder="Description..." rows="3" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-[#161c2e] text-white p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500" />
                    <div>
                        <label className="block text-[10px] text-purple-400 font-bold uppercase mb-1">Photo / fichier (optionnel)</label>
                        <input type="file" onChange={(e) => setFichier(e.target.files?.[0] || null)} className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:bg-purple-600 file:text-white file:rounded-xl file:border-0 cursor-pointer" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all disabled:opacity-50">
                        {loading ? 'Traitement...' : 'Ajouter au catalogue'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════
// MODAL : MESSAGERIE CLIENT
// ════════════════════════════════════════════════════════════════
function ChatModal({ mission, userId, onClose }) {
    const [messages, setMessages] = useState([]);
    const [texte, setTexte] = useState('');
    const [init, setInit] = useState(true);
    const [sending, setSending] = useState(false);
    const bottomRef = useRef(null);
    const token = localStorage.getItem('token');

    const charger = async () => {
        try {
            const r = await fetch(`${API}/api/messages/${mission.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json();
            if (d.success) setMessages(d.data || []);
        } catch { } finally { setInit(false); }
    };

    useEffect(() => { charger(); const t = setInterval(charger, 5000); return () => clearInterval(t); }, [mission.id]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const envoyer = async () => {
        if (!texte.trim() || sending) return;
        setSending(true);
        try {
            const r = await fetch(`${API}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reservationId: mission.id, contenu: texte.trim() })
            });
            const d = await r.json();
            if (d.success) { setMessages(p => [...p, d.data]); setTexte(''); }
        } catch { } finally { setSending(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="w-full max-w-lg bg-[#0E1320] border border-purple-500/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[550px]">
                <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/[0.07]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-purple-500/20">
                            {mission.client?.nom?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <div>
                            <p className="font-bold text-slate-100 text-sm">{mission.client?.nom || mission.clientNom || 'Client'}</p>
                            <p className="text-purple-400/80 text-xs font-medium">Mission #{mission.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm">×</button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {init ? (
                        <div className="flex justify-center items-center h-full"><p className="text-slate-500 text-sm animate-pulse">Chargement de la conversation...</p></div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2"><p className="text-sm font-medium">Aucun message. Lancez la discussion !</p></div>
                    ) : (
                        messages.map(msg => {
                            const moi = msg.senderId === userId;
                            return (
                                <div key={msg.id} className={`flex ${moi ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${moi ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs font-medium' : 'bg-white/[0.05] border border-white/[0.05] text-slate-200 rounded-bl-xs'}`}>
                                        <p>{msg.contenu}</p>
                                        <p className={`text-[10px] mt-1 text-right ${moi ? 'text-purple-200/70' : 'text-slate-400'}`}>
                                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="p-4 bg-white/[0.02] border-t border-white/[0.07] flex gap-2.5">
                    <input
                        value={texte}
                        onChange={e => setTexte(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && envoyer()}
                        placeholder="Écrivez votre message ici..."
                        className="flex-1 bg-[#090D16] border border-white/[0.08] focus:border-purple-500 text-slate-200 placeholder-slate-500 rounded-2xl px-4 py-3 text-sm outline-none transition-all shadow-inner"
                    />
                    <button
                        onClick={envoyer}
                        disabled={!texte.trim() || sending}
                        className={`px-5 rounded-2xl text-sm font-bold flex items-center justify-center transition-all ${texte.trim() ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white shadow-lg shadow-purple-500/25 active:scale-95' : 'bg-white/[0.04] text-slate-600 cursor-not-allowed'}`}>
                        {sending ? '...' : 'Envoyer'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════
// ONGLET : AO & DEVIS — avec impression du devis accepté
// ════════════════════════════════════════════════════════════════
function OngletDevis({ token }) {
    const [reservations, setReservations] = useState([]);
    const [mesDevis, setMesDevis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState('disponibles');
    const [montant, setMontant] = useState({});
    const [description, setDescription] = useState({});
    const [sending, setSending] = useState(null);
    const [photos, setPhotos] = useState({});
    const [uploadLoading, setUploadLoading] = useState(null);
    const [devisAImprimer, setDevisAImprimer] = useState(null);
    const printRef = useRef(null);

    const charger = async () => {
        try {
            const [r1, r2] = await Promise.all([
                fetch(`${API}/api/reservations/disponibles`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
                fetch(`${API}/api/devis/mes-devis`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            ]);
            if (r1.success) setReservations(r1.data || []);
            if (r2.success) setMesDevis(r2.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { charger(); }, []);

    // Impression déclenchée après mise à jour du devis à imprimer (le DOM doit être prêt)
    useEffect(() => {
        if (devisAImprimer) {
            const t = setTimeout(() => window.print(), 150);
            return () => clearTimeout(t);
        }
    }, [devisAImprimer]);

    const envoyerDevis = async (reservationId) => {
        if (!montant[reservationId]) { alert('Entrez un montant'); return; }
        setSending(reservationId);
        try {
            const r = await fetch(`${API}/api/devis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reservationId, montant: montant[reservationId], description: description[reservationId] || '' })
            }).then(r => r.json());
            if (r.success) { alert('Devis envoyé !'); charger(); }
            else alert(r.message || 'Erreur');
        } catch { alert('Erreur serveur'); }
        finally { setSending(null); }
    };

    const envoyerPhotos = async (missionId, type) => {
        const file = photos[`${missionId}_${type}`];
        if (!file) { alert('Choisissez une photo'); return; }
        setUploadLoading(`${missionId}_${type}`);
        const fd = new FormData();
        fd.append(type, file);
        try {
            const r = await fetch(`${API}/api/missions/${missionId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }).then(r => r.json());
            if (r.success) alert('Photo envoyée !');
            else alert(r.message || 'Erreur');
        } catch { alert('Erreur'); }
        finally { setUploadLoading(null); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm animate-pulse">Recherche des opportunités...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01] p-2 rounded-2xl border border-white/[0.05] print:hidden">
                <div className="flex gap-1 p-1 bg-[#070A12] rounded-xl border border-white/[0.05]">
                    {[['disponibles', 'Demandes disponibles'], ['mesdevis', 'Mes devis envoyés']].map(([id, label]) => (
                        <button key={id} onClick={() => setActiveSubTab(id)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {activeSubTab === 'disponibles' && (
                <div className="space-y-4 print:hidden">
                    {reservations.length === 0 ? (
                        <div className="text-center py-16 bg-white/[0.01] border border-white/[0.05] rounded-3xl text-slate-500 space-y-3">
                            <p className="text-sm font-medium">Aucune nouvelle demande d'intervention dans votre secteur.</p>
                        </div>
                    ) : reservations.map(res => {
                        const dejaEnvoye = mesDevis.some(d => d.reservationDevis?.id === res.id);
                        return (
                            <div key={res.id} className="bg-white/[0.02] hover:bg-white/[0.03] border border-white/[0.07] hover:border-purple-500/30 rounded-3xl p-6 space-y-5 transition-all shadow-xl relative overflow-hidden group text-left">
                                <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                                <div className="flex justify-between items-start flex-wrap gap-3 pl-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Demande #{res.id}</span>
                                            <span className="text-slate-600">•</span>
                                            <span className="text-xs text-slate-400">{res.serviceNom}</span>
                                        </div>
                                        <h3 className="font-extrabold text-xl text-white mt-1">{res.clientNom || 'Client anonyme'}</h3>
                                    </div>
                                    <StatutBadge statut={res.statut} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        ['Lieu', res.adresseIntervention || res.adresse],
                                        ['Date ciblée', res.dateSouhaitee ? new Date(res.dateSouhaitee).toLocaleDateString('fr-FR') : 'Dès que possible'],
                                        ['Contact', 'Numéro masqué'],
                                    ].map(([label, val]) => val ? (
                                        <div key={label} className="bg-[#070A12]/60 rounded-2xl p-3.5 border border-white/[0.04]">
                                            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">{label}</p>
                                            <p className="text-slate-200 text-sm font-semibold truncate">{val}</p>
                                        </div>
                                    ) : null)}
                                </div>

                                {(res.description || res.besoin) && (
                                    <div className="bg-purple-950/10 rounded-2xl p-4 border border-purple-500/15">
                                        <span className="text-purple-400 text-xs font-bold uppercase tracking-wider">Détail du besoin</span>
                                        <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{res.description || res.besoin}</p>
                                    </div>
                                )}

                                {dejaEnvoye ? (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                        <p className="text-emerald-300 font-bold text-xs tracking-wide uppercase">Devis transmis avec succès</p>
                                    </div>
                                ) : (
                                    <div className="bg-[#070A12]/80 rounded-2xl p-5 border border-white/[0.05] space-y-4">
                                        <span className="text-slate-300 text-xs font-bold uppercase tracking-wider">Formuler une offre</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <input
                                                type="number"
                                                placeholder="Prix proposé (FCFA) *"
                                                value={montant[res.id] || ''}
                                                onChange={e => setMontant(p => ({ ...p, [res.id]: e.target.value }))}
                                                className="bg-white/[0.03] border border-white/[0.08] focus:border-purple-500 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none font-bold"
                                            />
                                            <textarea
                                                placeholder="Précisions sur l'intervention..."
                                                value={description[res.id] || ''}
                                                onChange={e => setDescription(p => ({ ...p, [res.id]: e.target.value }))}
                                                className="sm:col-span-2 bg-white/[0.03] border border-white/[0.08] focus:border-purple-500 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none resize-none h-11"
                                            />
                                        </div>
                                        <button
                                            onClick={() => envoyerDevis(res.id)}
                                            disabled={sending === res.id}
                                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 transition-all active:scale-[0.99] disabled:opacity-50">
                                            {sending === res.id ? 'Transmission en cours...' : 'Envoyer ma proposition commerciale'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {activeSubTab === 'mesdevis' && (
                <div className="space-y-4 print:hidden">
                    {mesDevis.length === 0 ? (
                        <div className="text-center py-16 bg-white/[0.01] border border-white/[0.05] rounded-3xl text-slate-500 space-y-2 text-left">
                            <p className="text-sm font-medium">Aucun devis émis pour le moment.</p>
                        </div>
                    ) : mesDevis.map(devis => {
                        const res = devis.reservationDevis;
                        const statutDevis = {
                            EN_ATTENTE: { label: 'En attente de réponse', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                            ACCEPTE: { label: 'Devis Accepté !', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]' },
                            REFUSE: { label: 'Décliné', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                        }[devis.statut] || { label: devis.statut, color: 'text-slate-400 bg-white/[0.05] border-white/[0.1]' };

                        return (
                            <div key={devis.id} className="bg-white/[0.02] border border-white/[0.07] rounded-3xl p-6 space-y-4 shadow-xl text-left">
                                <div className="flex justify-between items-start flex-wrap gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Devis #{devis.id}</span>
                                            <span className="text-slate-600">/</span>
                                            <span className="text-xs text-purple-400 font-semibold">Demande #{res?.id}</span>
                                        </div>
                                        <h4 className="text-lg font-bold text-white mt-0.5">{res?.clientNom || 'Client'}</h4>
                                    </div>
                                    <span className={`px-3.5 py-1 rounded-full text-xs font-bold border ${statutDevis.color}`}>{statutDevis.label}</span>
                                </div>

                                <div className="flex justify-between items-center bg-[#070A12]/80 rounded-2xl px-5 py-3.5 border border-white/[0.04]">
                                    <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Montant convenu</span>
                                    <span className="font-black text-lg text-amber-400">{Number(devis.montant).toLocaleString()} FCFA</span>
                                </div>

                                {devis.description && (
                                    <p className="text-sm text-slate-400 bg-white/[0.01] rounded-2xl p-4 border border-white/[0.03] italic">« {devis.description} »</p>
                                )}

                                {devis.statut === 'ACCEPTE' && (
                                    <div className="bg-purple-950/10 border border-purple-500/20 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Justificatifs d'intervention requis</span>
                                            <button onClick={() => setDevisAImprimer(devis)} className="text-xs font-bold text-purple-300 hover:text-white underline">Imprimer le devis</button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {['photoAvant', 'photoApres'].map(type => (
                                                <div key={type} className="flex items-center gap-2 bg-[#070A12] p-2 rounded-xl border border-white/[0.05]">
                                                    <label className="flex-1 flex items-center gap-2 px-3 py-1.5 cursor-pointer truncate">
                                                        <span className="text-xs font-medium text-slate-300">{type === 'photoAvant' ? 'État initial' : 'Résultat final'}</span>
                                                        <input type="file" accept="image/*" className="hidden" onChange={e => setPhotos(p => ({ ...p, [`${res?.id}_${type}`]: e.target.files[0] }))} />
                                                        {photos[`${res?.id}_${type}`] && <span className="text-[10px] text-emerald-400 font-bold ml-auto bg-emerald-500/10 px-2 py-0.5 rounded">Prêt</span>}
                                                    </label>
                                                    <button
                                                        onClick={() => envoyerPhotos(res?.id, type)}
                                                        disabled={uploadLoading === `${res?.id}_${type}` || !photos[`${res?.id}_${type}`]}
                                                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-white/[0.03] disabled:text-slate-600 text-white rounded-lg text-xs font-bold transition-all">
                                                        {uploadLoading === `${res?.id}_${type}` ? '...' : 'Upload'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {devisAImprimer && (
                <BonInterventionPrint
                    ref={printRef}
                    type="devis"
                    numero={`DEV-${devisAImprimer.id}`}
                    mission={devisAImprimer.reservationDevis}
                    client={{ nom: devisAImprimer.reservationDevis?.clientNom }}
                    description={devisAImprimer.description}
                    dateDocument={devisAImprimer.createdAt}
                    lignes={[{ label: 'Prestation proposée', montant: devisAImprimer.montant }]}
                />
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function DashboardFournisseur({ setCurrentView }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [data, setData] = useState(null);
    const [produits, setProduits] = useState([]);
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoad, setActionLoad] = useState(null);
    const [menuOuvert, setMenuOuvert] = useState(false);
    const [chatMission, setChatMission] = useState(null);
    const [bonMission, setBonMission] = useState(null);
    const [ajoutProduitOuvert, setAjoutProduitOuvert] = useState(false);
    const token = localStorage.getItem('token');

    let currentUser = {};
    try { currentUser = JSON.parse(localStorage.getItem('user')) || {}; } catch { }

    const chargerDonnees = async () => {
        if (!token) return;
        try {
            const [dash, prods] = await Promise.all([getDashboardFournisseur(), getProduitsFournisseur()]);
            if (!dash.success) throw new Error(dash.message);
            setData(dash.data);
            setMissions(dash.data.missions || []);
            setProduits(prods.data || []);
        } catch (e) {
            console.error(e);
            setError('Impossible de charger le dashboard.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { chargerDonnees(); }, [token]);

    const callAction = async (id, endpoint, nextStatut, body = {}) => {
        setActionLoad(`${id}_${endpoint}`);
        try {
            const r = await fetch(`${API}/api/missions/${id}/${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const resData = await r.json().catch(() => ({}));
            if (r.ok && resData.success !== false) {
                setMissions(p => p.map(m => m.id === id ? { ...m, statut: nextStatut, ...body } : m));
            } else {
                alert(resData.message || `Erreur (${r.status})`);
            }
        } catch {
            alert('Erreur serveur');
        } finally {
            setActionLoad(null);
        }
    };

    const handlerActionSuccess = (id, nextStatut) => {
        setMissions(p => p.map(m => m.id === id ? { ...m, statut: nextStatut } : m));
    };

    const signalerMateriel = async (id) => {
        const desc = window.prompt('Décrivez le matériel manquant :');
        if (!desc) return;
        await callAction(id, 'materiel', 'EN_PREPARATION', { descriptionMateriel: desc, manqueMateriel: true });
        alert('Kanari Service a été notifié.');
    };

    if (!token) { setCurrentView && setCurrentView('login'); return null; }

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-[#0B0F19] text-white">
            <div className="text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" />
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_15px_#a855f7]" />
                </div>
                <p className="text-slate-400 font-medium tracking-wide text-sm animate-pulse">Synchronisation sécurisée...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-screen bg-[#0B0F19] p-4">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 max-w-md text-center space-y-4">
                <p className="text-rose-200 font-bold text-lg">{error}</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition-all">Réessayer</button>
            </div>
        </div>
    );

    const { profil, stats, commandesRecentes = [] } = data || {};
    // CORRIGÉ : utilise le même ensemble de statuts actifs que le badge partagé,
    // 'ASSIGNEE' est désormais bien reconnu partout (avant : mission bloquée visuellement).
    const missionsActives = missions.filter(m => !['TERMINEE', 'VALIDEE', 'ANNULEE'].includes(m.statut));
    const badgeProfil = BADGE_PROFIL[profil?.statutKanari] || BADGE_PROFIL.EN_ATTENTE;

    const tabs = [
        { id: 'overview', label: 'Vue d\'ensemble', icon: '' },
        { id: 'devis', label: 'AO & Devis', icon: '' },
        { id: 'missions', label: 'Interventions', icon: '', badge: missionsActives.length },
        { id: 'commandes', label: 'Commandes Shop', icon: '' },
        { id: 'produits', label: 'Catalogue', icon: '' },
        { id: 'solde', label: 'Portefeuille', icon: '' },
        { id: 'profil', label: 'Fiche Établissement', icon: '' },
    ];

    return (
        <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex relative overflow-hidden font-sans selection:bg-purple-500 selection:text-white print:bg-white">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none print:hidden" />
            <div className="absolute bottom-0 right-10 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none print:hidden" />

            <aside className="hidden md:flex w-72 bg-[#0E1320]/80 backdrop-blur-2xl p-6 flex-col gap-4 border-r border-white/[0.05] z-20 shadow-2xl text-left print:hidden">
                <div className="flex items-center gap-3 px-2 pt-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                        <span className="font-black text-white text-base">K</span>
                    </div>
                    <div>
                        <h2 className="font-extrabold text-base tracking-tight text-white leading-none">Kanari Service</h2>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400">Partner Portal</span>
                    </div>
                </div>
                <div className={`mt-2 rounded-2xl p-3 border ${badgeProfil.bg} ${badgeProfil.border} flex items-center gap-2`}>
                    <p className={`text-[11px] font-bold tracking-wide ${badgeProfil.text}`}>{badgeProfil.label}</p>
                </div>
                <nav className="flex flex-col gap-1.5 flex-1 mt-2">
                    <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Navigation</span>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} className={`text-left px-3.5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between group ${activeTab === t.id ? 'bg-gradient-to-r from-purple-600/20 to-indigo-600/10 border border-purple-500/30 text-white shadow-lg' : 'hover:bg-white/[0.03] text-slate-400 hover:text-slate-200 border border-transparent'}`}>
                            <div className="flex items-center gap-3 text-left">
                                <span>{t.label}</span>
                            </div>
                            {t.badge > 0 && <span className="bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">{t.badge}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-[#0E1320]/90 backdrop-blur-lg border-b border-white/[0.05] z-30 px-4 flex justify-between items-center print:hidden">
                <div className="flex items-center gap-2">
                    <button onClick={() => window.history.back()} className="text-slate-400 hover:text-white text-lg mr-1">‹</button>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white text-xs">K</div>
                    <span className="font-extrabold text-sm tracking-tight text-white">Kanari Portal</span>
                </div>
                <button onClick={() => setMenuOuvert(!menuOuvert)} className="px-3 py-1.5 rounded-xl bg-white/[0.05] text-slate-300 font-bold text-xs">{menuOuvert ? 'Fermer' : 'Menu'}</button>
            </div>

            {menuOuvert && (
                <div className="md:hidden fixed inset-x-0 top-14 bottom-0 z-40 bg-[#0B0F19]/95 backdrop-blur-2xl border-b border-white/[0.05] p-6 space-y-2 overflow-y-auto print:hidden">
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 text-left">Menu Principal</p>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setMenuOuvert(false); }} className={`w-full text-left px-4 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-between ${activeTab === t.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg' : 'text-slate-300 bg-white/[0.02]'}`}>
                            <div className="flex items-center gap-3"><span>{t.label}</span></div>
                            {t.badge > 0 && <span className="bg-rose-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black">{t.badge}</span>}
                        </button>
                    ))}
                </div>
            )}

            <main className="flex-1 p-6 md:p-10 overflow-y-auto mt-14 md:mt-0 max-w-7xl mx-auto z-10 space-y-8 print:hidden">
                <header className="hidden md:flex items-center justify-between pb-4 border-b border-white/[0.05]">
                    <div className="text-left">
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Espace de gestion</span>
                        <h1 className="text-2xl font-black text-white mt-0.5">{tabs.find(t => t.id === activeTab)?.label}</h1>
                    </div>
                    <button onClick={() => window.history.back()} className="px-4 py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-xs flex items-center gap-2 transition-all">Retour</button>
                </header>

                {activeTab === 'overview' && (
                    <section className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <StatCard label="Missions actives" value={missionsActives.length} gradient="from-purple-600 to-blue-500" />
                            <StatCard label="Missions traitées" value={stats?.totalMissions ?? 0} gradient="from-purple-500 to-pink-500" />
                            <StatCard label="Ventes directes" value={stats?.totalCommandes ?? 0} gradient="from-blue-500 to-cyan-500" />
                            <StatCard label="Chiffre d'affaires" value={`${stats?.totalRevenus?.toLocaleString() ?? 0} F`} gradient="from-emerald-400 to-teal-500" />
                        </div>

                        {missionsActives.length > 0 && (
                            <div className="bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-4 text-left">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <h3 className="font-extrabold text-purple-300 text-base">Missions nécessitant votre attention</h3>
                                        <span className="text-xs text-slate-400">{missionsActives.length} dossier{missionsActives.length > 1 ? 's' : ''} en attente ou en cours</span>
                                    </div>
                                    <button onClick={() => setActiveTab('missions')} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white rounded-xl text-xs font-black transition-all shadow-md">Ouvrir l'onglet</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                    {missionsActives.slice(0, 3).map(m => (
                                        <div key={m.id} className="bg-[#070A12]/80 border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-purple-500/40 transition-all text-left">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] uppercase font-extrabold text-slate-500">Réf #{m.id}</span>
                                                    <p className="font-extrabold text-white text-sm truncate max-w-[140px] mt-0.5">{m.client?.nom || m.clientNom || 'Client'}</p>
                                                </div>
                                                <StatutBadge statut={m.statut} />
                                            </div>
                                            <button onClick={() => setActiveTab('missions')} className="w-full py-2 bg-white/[0.03] hover:bg-purple-500/20 hover:text-purple-300 text-slate-400 rounded-xl text-xs font-bold transition-all text-center">Gérer l'intervention</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'devis' && <OngletDevis token={token} />}

                {activeTab === 'missions' && (
                    <section className="space-y-6 text-left">
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                            <h2 className="text-xl font-black text-white">Suivi de vos Interventions</h2>
                            <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
                                {missions.length} mission{missions.length > 1 ? 's' : ''} au total
                            </span>
                        </div>

                        {missions.length === 0 ? (
                            <div className="text-center py-20 bg-white/[0.01] border border-white/[0.05] rounded-3xl text-slate-500">
                                <p className="text-sm font-medium">Aucune mission ne vous est affectée pour le moment.</p>
                                <p className="text-xs text-slate-600 mt-2">Vos missions apparaîtront ici dès qu'un Admin vous assignera une réservation.</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {missions.map(mission => (
                                    <div key={mission.id} className="bg-white/[0.02] border border-white/[0.07] hover:border-purple-500/20 rounded-3xl p-6 space-y-5 shadow-xl transition-all relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-600 opacity-40 group-hover:opacity-100 transition-opacity" />

                                        <div className="flex justify-between items-start flex-wrap gap-4 pl-2">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Mission ID #{mission.id}</span>
                                                    <span className="text-slate-600">•</span>
                                                    <span className="text-xs font-medium text-slate-400">{mission.serviceNom || mission.service?.nom || 'Prestation de service'}</span>
                                                </div>
                                                <h3 className="font-extrabold text-2xl text-white mt-1">{mission.client?.nom || mission.clientNom || 'Client'}</h3>
                                                <p className="text-xs text-slate-400 font-medium mt-1">
                                                    Téléphone :{' '}
                                                    <span className={`font-bold ${STATUTS_TELEPHONE_VISIBLE.includes(mission.statut) ? 'text-amber-400' : 'text-slate-500'}`}>
                                                        {STATUTS_TELEPHONE_VISIBLE.includes(mission.statut)
                                                            ? (mission.client?.telephone || mission.telephone || 'Non spécifié')
                                                            : "Numéro masqué (Disponible après validation par l'Admin)"}
                                                    </span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button onClick={() => setChatMission(mission)} className="px-4 py-2 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center gap-2 transition-all">Messagerie Client</button>
                                                <StatutBadge statut={mission.statut} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {[
                                                ['Adresse exacte', mission.adresseIntervention || mission.adresse],
                                                ['Horaires convenus', mission.dateSouhaitee ? new Date(mission.dateSouhaitee).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Non spécifié'],
                                                ['Acompte versé', mission.acompte ? `${Number(mission.acompte).toLocaleString()} FCFA` : 'Aucun acompte'],
                                            ].map(([label, val]) => val && (
                                                <div key={label} className="bg-[#070A12]/80 rounded-2xl p-4 border border-white/[0.04]">
                                                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-wider mb-1">{label}</p>
                                                    <p className="text-slate-200 text-sm font-bold truncate">{val}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {(mission.description || mission.besoin) && (
                                            <div className="bg-white/[0.01] rounded-2xl p-4 border border-white/[0.04]">
                                                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Cahier des charges client</span>
                                                <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{mission.description || mission.besoin}</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-3 pt-2">
                                            {['EN_ATTENTE', 'ASSIGNEE'].includes(mission.statut) && (
                                                <>
                                                    <button onClick={() => callAction(mission.id, 'accepter', 'EN_VALIDATION_ADMIN')} disabled={actionLoad === `${mission.id}_accepter`} className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                                        {actionLoad === `${mission.id}_accepter` ? 'Traitement...' : "Je suis partant — Envoyer à l'Admin"}
                                                    </button>
                                                    <button onClick={() => callAction(mission.id, 'refuser', 'ANNULEE')} disabled={actionLoad === `${mission.id}_refuser`} className="px-6 py-3 bg-white/[0.04] hover:bg-rose-500/20 text-rose-400 border border-transparent hover:border-rose-500/30 font-bold rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50">
                                                        {actionLoad === `${mission.id}_refuser` ? 'Refus...' : 'Je ne suis pas disponible'}
                                                    </button>
                                                </>
                                            )}

                                            {mission.statut === 'EN_VALIDATION_ADMIN' && (
                                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3 w-full">
                                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                                    <p className="text-blue-300 font-bold text-xs tracking-wide uppercase">Transmission effectuée — En attente d'approbation de l'administration</p>
                                                </div>
                                            )}

                                            {mission.statut === 'ACCEPTEE' && (
                                                <button onClick={() => callAction(mission.id, 'demarrer', 'EN_COURS')} disabled={actionLoad === `${mission.id}_demarrer`} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                                    {actionLoad === `${mission.id}_demarrer` ? 'Démarrage...' : "Démarrer l'intervention"}
                                                </button>
                                            )}

                                            {mission.statut === 'EN_COURS' && (
                                                <>
                                                    <button onClick={() => setBonMission(mission)} className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all active:scale-95">
                                                        Remplir le Bon d'intervention & Terminer
                                                    </button>
                                                    <button onClick={() => signalerMateriel(mission.id)} className="px-4 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold rounded-xl text-xs transition-all">Signaler matériel manquant</button>
                                                </>
                                            )}

                                            {mission.statut === 'EN_PREPARATION' && (
                                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-3 w-full">
                                                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                                                    <p className="text-orange-300 font-bold text-xs tracking-wide uppercase">Matériel manquant signalé — Reprise dès réception</p>
                                                </div>
                                            )}

                                            {mission.statut === 'TERMINEE' && (
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 w-full">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    <p className="text-emerald-300 font-bold text-xs tracking-wide uppercase">Bon envoyé — En attente de validation du client</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'commandes' && (
                    <section className="space-y-6 text-left">
                        <div className="bg-white/[0.01] p-6 rounded-3xl border border-white/[0.05]">
                            <h2 className="text-2xl font-black text-white">Commandes de la Boutique</h2>
                            <p className="text-slate-400 text-xs mt-1">Achats directs passés sur votre vitrine Kanari</p>
                        </div>
                        {commandesRecentes.length === 0 ? (
                            <div className="text-center py-20 bg-white/[0.01] border border-white/[0.05] rounded-3xl text-slate-500">
                                <p className="text-sm font-medium">Aucune commande récente.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                                {commandesRecentes.map(cmd => (
                                    <div key={cmd.id} className="bg-white/[0.02] border border-white/[0.07] rounded-3xl p-6 space-y-4 shadow-xl">
                                        <div className="flex justify-between items-center pb-3 border-b border-white/[0.05]">
                                            <span className="font-extrabold text-white text-base">Commande #{cmd.id}</span>
                                            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">{new Date(cmd.createdAt).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium">Destinataire : <span className="text-white font-bold">{cmd.clientCommande?.nom || 'Non spécifié'}</span></p>
                                        <div className="space-y-2 pt-1">
                                            {cmd.itemsCommande?.map(item => (
                                                <div key={item.id} className="flex justify-between items-center text-xs bg-[#070A12] rounded-xl px-3.5 py-2.5 border border-white/[0.04]">
                                                    <span className="text-slate-200 font-semibold">{item.produitCommandeProduit?.nom}</span>
                                                    <span className="text-purple-300 font-extrabold bg-white/[0.05] px-2 py-0.5 rounded">x{item.quantite}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'produits' && (
                    <section className="space-y-6 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01] p-6 rounded-3xl border border-white/[0.05]">
                            <div>
                                <h2 className="text-2xl font-black text-white">Gestion du Catalogue</h2>
                                <p className="text-slate-400 text-xs mt-1">Gérez vos produits en vente directe</p>
                            </div>
                            <button onClick={() => setAjoutProduitOuvert(true)} className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-purple-500/20 transition-all active:scale-95">
                                + Ajouter un produit
                            </button>
                        </div>
                        {produits.length === 0 ? (
                            <div className="text-center py-20 bg-white/[0.01] border border-white/[0.05] rounded-3xl text-slate-500">
                                <p className="text-sm font-medium">Aucun produit dans votre vitrine.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
                                {produits.map(p => (
                                    <div key={p.id} className="bg-white/[0.02] border border-white/[0.07] rounded-3xl overflow-hidden flex flex-col justify-between shadow-xl">
                                        <div className="w-full h-36 bg-[#070A12] flex items-center justify-center overflow-hidden">
                                            {p.image ? (
                                                <img
                                                    src={`${API}/uploads/${p.image}`}
                                                    alt={p.nom}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.innerHTML = '<span class="text-3xl"></span>'; }}
                                                />
                                            ) : (
                                                <span className="text-3xl"></span>
                                            )}
                                        </div>
                                        <div className="p-5 flex flex-col justify-between space-y-4 flex-1">
                                            <div>
                                                <h4 className="font-extrabold text-base text-white">{p.nom}</h4>
                                                <p className="text-xs text-purple-400 font-black mt-1">{Number(p.prix).toLocaleString()} FCFA</p>
                                                {p.categorie && <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">{p.categorie}</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { if (window.confirm('Supprimer cet article ?')) deleteProduit(p.id).then(() => setProduits(prev => prev.filter(x => x.id !== p.id))); }} className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all">Supprimer l'article</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'solde' && (
                    <section className="space-y-6 text-left">
                        <div className="bg-white/[0.01] p-6 rounded-3xl border border-white/[0.05]">
                            <h2 className="text-2xl font-black text-white">Flux Financiers</h2>
                            <p className="text-slate-400 text-xs mt-1">Gérez vos encaissements et demandez vos virements</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/[0.07] rounded-3xl p-6 md:p-8 shadow-2xl">
                            <SoldeRetrait />
                        </div>
                    </section>
                )}

                {activeTab === 'profil' && (
                    <section className="space-y-6 text-left">
                        <div className="bg-white/[0.02] border border-white/[0.07] rounded-3xl p-6 md:p-8 shadow-2xl max-w-2xl">
                            <h2 className="text-xl font-black text-white border-b border-white/[0.05] pb-3">Informations de l'Établissement</h2>
                            <div className="divide-y divide-white/[0.05] pt-2">
                                {[
                                    ['Responsable légal', profil?.nom || currentUser.nom || '—'],
                                    ['Téléphone Pro.', profil?.telephone || profil?.userFournisseur?.telephone || currentUser.telephone || '—'],
                                    ['Email professionnel', profil?.email || currentUser.email || '—'],
                                    ['Siège / Adresse', profil?.adresse || '—'],
                                    ['Secteur / Quartier', profil?.quartier || '—'],
                                    ['Capacité de Transport', profil?.hasTransport ? 'Véhiculé' : 'Non véhiculé'],
                                    ['Outillage Pro.', profil?.hasMateriel ? 'Équipement complet' : 'À vérifier'],
                                    ['Indice de satisfaction', profil?.note > 0 ? `${profil.note.toFixed(1)} / 5` : 'Nouveau partenaire (Non noté)'],
                                ].map(([label, val]) => (
                                    <div key={label} className="flex justify-between items-center py-3.5">
                                        <span className="text-slate-400 text-sm">{label}</span>
                                        <span className="font-extrabold text-white text-right text-sm">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {chatMission && <ChatModal mission={chatMission} userId={currentUser.id} onClose={() => setChatMission(null)} />}

            {bonMission && (
                <BonInterventionModal
                    mission={bonMission}
                    token={token}
                    onClose={() => setBonMission(null)}
                    onSuccess={handlerActionSuccess}
                />
            )}

            {ajoutProduitOuvert && (
                <AjouterProduitModal onClose={() => setAjoutProduitOuvert(false)} onSuccess={(nouveauProduit) => setProduits(prev => [nouveauProduit, ...prev])} />
            )}
        </div>
    );
}