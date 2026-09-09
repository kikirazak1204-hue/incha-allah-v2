import React, { useState } from 'react';
// On remonte d'un seul niveau (../) car nous sommes dans src/pages/
import ValidationsAdmin from '../components/admin/ValidationsAdmin';
import PaiementAdmin from '../components/admin/PaiementAdmin';
import UtilisateursAdmin from '../components/admin/UtilisateursAdmin';
import ProduitsAdmin from '../components/admin/ProduitsAdmin';
import ReservationsAdmin from '../components/admin/ReservationsAdmin';
import ParametresAdmin from '../components/admin/ParametresAdmin';

export default function AdminDashboard() {
  const [tab, setTab] = useState('reservations');

  const menuItems = [
    { id: 'reservations', label: 'Missions', color: 'from-pink-600 to-rose-500' },
    { id: 'validations', label: 'Validations', color: 'from-blue-600 to-cyan-500' },
    { id: 'utilisateurs', label: 'Utilisateurs', color: 'from-purple-600 to-indigo-500' },
    { id: 'paiements', label: 'Paiements', color: 'from-emerald-600 to-teal-500' },
    { id: 'produits', label: 'Produits', color: 'from-orange-600 to-red-500' },
    { id: 'parametres', label: 'Paramètres', color: 'from-slate-600 to-slate-500' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-gray-900/50 backdrop-blur-xl border-r border-white/5 p-6 flex flex-col shadow-2xl">
        <div className="mb-10 px-2">
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            PANEL ADMIN
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Kanari Service</p>
        </div>

        <nav className="space-y-2 flex-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-300 font-medium ${tab === item.id
                  ? `bg-gradient-to-r ${item.color} shadow-lg shadow-indigo-500/20 text-white translate-x-1`
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/';
            }}
            className="w-full p-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            Quitter l'Admin
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold capitalize">{tab}</h2>
          <p className="text-gray-500 text-sm">Gestion des données de la plateforme</p>
        </header>

        <div className="bg-white/5 p-1 rounded-2xl">
          {tab === 'reservations' && <ReservationsAdmin />}
          {tab === 'validations' && <ValidationsAdmin />}
          {tab === 'utilisateurs' && <UtilisateursAdmin />}
          {tab === 'paiements' && <PaiementAdmin />}
          {tab === 'produits' && <ProduitsAdmin />}
          {tab === 'parametres' && <ParametresAdmin />}
        </div>
      </main>
    </div>
  );
}