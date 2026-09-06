import React, { useEffect, useState } from 'react';
import { getAdminReservations } from '../../util/api';
import { Loader2, AlertCircle, Plus, RefreshCw } from 'lucide-react';
import StatusBadge from "../StatusBadge";
import CreateMissionModal from "../CreateMissionModal";
import MissionDetailsModal from "../MissionDetailsModal";

export default function ReservationsAdmin() {
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAdminReservations();
            setReservations(res.data || []);
        } catch (e) {
            console.error("Erreur chargement:", e);
            setError("Impossible de charger les réservations. Le serveur est indisponible.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    return (
        <div className="space-y-6 text-slate-100">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-white/5 pb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Gestion du Réseau Kanari</h2>
                    <p className="text-slate-400 text-sm">Supervision en temps réel des interventions et de la double validation</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-2xl text-xs font-bold text-white transition flex items-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95"
                    >
                        <Plus size={14} /> Créer une Mission
                    </button>
                    <button
                        onClick={loadData}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-white border border-white/10 transition active:scale-95 flex items-center gap-2"
                    >
                        <RefreshCw size={14} /> Actualiser
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 flex items-center gap-2 text-sm">
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/5 text-slate-500 text-[10px] uppercase tracking-widest bg-white/[0.01]">
                                <th className="px-6 py-5">Dossier / Client</th>
                                <th className="px-6 py-5">Service requis</th>
                                <th className="px-6 py-5">Prestataire Assigné</th>
                                <th className="px-6 py-5">Statut actuel</th>
                                <th className="px-6 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="animate-spin text-purple-500" size={30} />
                                            <span className="text-sm">Synchronisation avec la base Kanari...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : reservations.length === 0 ? (
                                <tr><td colSpan="5" className="py-12 text-center text-slate-500 text-sm">Aucune mission enregistrée pour le moment.</td></tr>
                            ) : reservations.map(r => (
                                <tr key={r.id} className="hover:bg-white/[0.02] transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white text-sm">{r.clientNom || 'Client Anonyme'}</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">{r.telephone || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-purple-300">{r.serviceNom || 'Intervention'}</div>
                                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{r.adresse}</div>
                                    </td>

                                    <td className="px-6 py-4">
                                        {r.prestataire ? (
                                            <div>
                                                <div className="text-sm font-medium text-white">{r.prestataire.nomEntreprise || 'Prestataire'}</div>
                                                <div className="text-[10px] text-slate-500">ID : #{r.prestataire.id}</div>
                                            </div>
                                        ) : r.fournisseurId ? (
                                            <div className="text-xs text-purple-400 italic">
                                                Assigné (ID: {r.fournisseurId})
                                            </div>
                                        ) : r.refusePar ? (
                                            <span className="text-[11px] text-rose-400 bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10">Refusé #{r.refusePar}</span>
                                        ) : (
                                            <span className="text-xs text-slate-600 italic">Aucun prestataire</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        <StatusBadge statut={r.statut} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedReservation(r)}
                                            className="px-3 py-1.5 bg-white/5 hover:bg-purple-500/20 rounded-xl text-slate-300 hover:text-purple-300 transition text-xs font-semibold"
                                        >
                                            Gérer
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modales */}
            {selectedReservation && (
                <MissionDetailsModal
                    reservation={selectedReservation}
                    onClose={() => setSelectedReservation(null)}
                    onRefresh={loadData}
                />
            )}
            {showCreateModal && (
                <CreateMissionModal
                    onClose={() => setShowCreateModal(false)}
                    onRefresh={loadData}
                />
            )}
        </div>
    );
}