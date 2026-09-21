import React, { useState } from 'react';
import { useStore, Announcement } from '../../store/useStore';
import { Megaphone, Trash2, Plus, Power, Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AdminAnnouncements() {
  const { announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement, toggleAnnouncementStatus } = useStore();
  const { t } = useTranslation();
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    await addAnnouncement(newText);
    setNewText('');
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setEditText(a.text);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editText.trim()) return;
    await updateAnnouncement(editingId, { text: editText });
    setEditingId(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-black text-slate-900 mb-2">Announcements Bar</h2>
        <p className="text-slate-500 font-medium text-sm">Manage the scrolling news bar on the home page.</p>
      </div>

      {/* Add New */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/40">
        <form onSubmit={handleCreate} className="flex gap-4">
          <div className="flex-1 relative">
            <Megaphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input 
              type="text" 
              placeholder="Type your announcement here..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none transition-all font-medium"
            />
          </div>
          <button 
            type="submit"
            disabled={!newText.trim()}
            className="bg-indigo-600 hover:bg-slate-900 text-white px-8 rounded-2xl font-black transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </form>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {announcements.map(a => (
          <div key={a.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between gap-6 group">
            <div className="flex-1">
              {editingId === a.id ? (
                <form onSubmit={handleUpdate} className="flex gap-2">
                  <input 
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 border-b-2 border-indigo-600 py-1 outline-none font-bold text-slate-900"
                  />
                  <button type="submit" className="text-emerald-600 font-black text-xs uppercase hover:underline">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-slate-400 font-black text-xs uppercase hover:underline text-red-500">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center gap-4">
                   <div className={`w-3 h-3 rounded-full ${a.isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-slate-200'}`} />
                   <p className={`font-bold text-slate-900 ${!a.isActive && 'text-slate-300'}`}>{a.text}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => toggleAnnouncementStatus(a.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${a.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-200'}`}
                title={a.isActive ? 'Deactivate' : 'Activate'}
              >
                <Power className="w-4 h-4" />
              </button>
              <button 
                onClick={() => startEdit(a)}
                className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => deleteAnnouncement(a.id)}
                className="w-10 h-10 rounded-full bg-slate-50 text-red-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {announcements.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 border-dashed">
            <Megaphone className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No announcements yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
