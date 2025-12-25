import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/database';
import { User, Language, Role, CountryBan, Ad } from '../types';
import { translations } from '../translations';
import { Trash2, Users, MessageSquare, Activity, LogOut, Shield, ShieldOff, CheckCircle, Edit2, X, Lock, User as UserIcon, Ban, Smile, Globe, Plus, MapPin, Search, Zap, Star, Check, Megaphone, Database as DatabaseIcon } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onSwitchToChat: () => void;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'RU', name: 'Russia' },
  { code: 'CN', name: 'China' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout, onSwitchToChat }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [countryBans, setCountryBans] = useState<CountryBan[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalConversations: 0, totalMessages: 0, activeNow: 0 });
  const [adminLang, setAdminLang] = useState<Language>(currentUser.preferences?.language || 'en');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState(db.isOnline);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Search State
  const [userSearch, setUserSearch] = useState('');

  // Modals state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  
  // Forms state
  const [editForm, setEditForm] = useState({ 
    username: '', 
    displayName: '', 
    password: '', 
    role: 'USER', 
    country: 'US', 
    autoMessage: '', 
    modifiers: [] as string[] 
  });
  const [createUserForm, setCreateUserForm] = useState({ username: '', displayName: '', password: '', role: 'USER', country: 'US' });
  const [roleForm, setRoleForm] = useState({ name: '', description: '', color: 'gray' });
  const [adForm, setAdForm] = useState({ name: '', text: '', posterUrl: '', link: '' });
  
  // Ban Form
  const [banForm, setBanForm] = useState<{
    countryCode: string;
    type: 'FULL_CHAT' | 'ROLE_INTERACTION' | 'USERNAME';
    targetRoleId: string;
    targetUserId: string;
  }>({
    countryCode: 'US',
    type: 'FULL_CHAT',
    targetRoleId: '',
    targetUserId: ''
  });
  
  const [banUsername, setBanUsername] = useState('');

  const t = translations[adminLang];

  useEffect(() => {
    const refreshData = async () => {
      // Server sync
      await db.sync();
      db.reload();
      
      setUsers(db.getUsers());
      setStats(db.getStats());
      setRoles(db.getRoles());
      setCountryBans(db.getCountryBans());
      setAds(db.getAds());
      setServerOnline(db.isOnline);
    };

    refreshData();
    const interval = setInterval(refreshData, 2000); // 2 second poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshLocalOnly = () => {
      db.reload();
      setUsers(db.getUsers());
      setStats(db.getStats());
      setRoles(db.getRoles());
      setCountryBans(db.getCountryBans());
      setAds(db.getAds());
      setServerOnline(db.isOnline);
  };

  const handleLanguageChange = (lang: Language) => {
     setAdminLang(lang);
     db.updateProfile(currentUser.id, { preferences: { ...currentUser.preferences, language: lang }});
     setIsLangMenuOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm(t.confirmDelete)) {
      db.deleteUser(userId);
      refreshLocalOnly();
    }
  };

  const handleToggleBan = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    const action = user.isBanned ? t.confirmUnban : t.confirmBan;
    if (confirm(`${action} ${user.username}?`)) {
      db.updateProfile(user.id, { isBanned: !user.isBanned });
      refreshLocalOnly();
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({ 
      username: user.username, 
      displayName: user.displayName || user.username,
      password: user.password || '',
      role: user.role,
      country: user.country || 'US',
      autoMessage: user.autoMessage || '',
      modifiers: user.modifiers || []
    });
  };

  const toggleEditModifier = (modifier: string) => {
      setEditForm(prev => ({
          ...prev,
          modifiers: prev.modifiers.includes(modifier) 
            ? prev.modifiers.filter(m => m !== modifier)
            : [...prev.modifiers, modifier]
      }));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      db.updateProfile(editingUser.id, { 
        username: editForm.username,
        displayName: editForm.displayName,
        password: editForm.password,
        role: editForm.role,
        country: editForm.country,
        autoMessage: editForm.autoMessage,
        modifiers: editForm.modifiers
      });
      setEditingUser(null);
      refreshLocalOnly();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
      e.preventDefault();
      try {
          db.createUser(createUserForm);
          setShowCreateUserModal(false);
          setCreateUserForm({ username: '', displayName: '', password: '', role: 'USER', country: 'US' });
          refreshLocalOnly();
      } catch (error: any) {
          alert(error.message);
      }
  };

  const handleCreateRole = (e: React.FormEvent) => {
      e.preventDefault();
      try {
          db.addRole(roleForm.name, roleForm.description, roleForm.color);
          setRoleForm({ name: '', description: '', color: 'gray' });
          refreshLocalOnly();
      } catch (error: any) {
          alert(error.message);
      }
  };

  const handleDeleteRole = (roleId: string) => {
      try {
          db.deleteRole(roleId);
          refreshLocalOnly();
      } catch (error: any) {
          alert(error.message);
      }
  };

  const handleCreateAd = (e: React.FormEvent) => {
      e.preventDefault();
      try {
          db.addAd(adForm.name, adForm.text, adForm.posterUrl, adForm.link);
          setAdForm({ name: '', text: '', posterUrl: '', link: '' });
          refreshLocalOnly();
      } catch (error: any) {
          alert(error.message);
      }
  };

  const handleDeleteAd = (adId: string) => {
      try {
          db.deleteAd(adId);
          refreshLocalOnly();
      } catch (error: any) {
          alert(error.message);
      }
  };

  const handleAddBan = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      db.addCountryBan(banForm.countryCode, banForm.type, banForm.targetRoleId, banForm.targetUserId);
      refreshLocalOnly();
    } catch (error: any) {
      alert(error.message);
    }
  };
  
  const handleBanByUsername = () => {
      if (!banUsername) return;
      const user = db.getUserByUsername(banUsername);
      if (!user) {
          alert(t.userNotFound);
          return;
      }
      try {
          // Changed from FULL_CHAT to USERNAME type
          db.addCountryBan(user.country, 'USERNAME', undefined, user.id);
          setBanUsername('');
          refreshLocalOnly();
          alert(`Banned user ${user.username} from chatting in ${user.country}`);
      } catch (error: any) {
          alert(error.message);
      }
  };

  const handleDeleteBan = (banId: string) => {
    db.deleteCountryBan(banId);
    refreshLocalOnly();
  };

  const getRoleBadgeStyle = (color: string) => {
      const styles: Record<string, string> = {
          purple: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
          gray: 'bg-gray-600/10 border-gray-600/30 text-gray-300',
          red: 'bg-red-500/10 border-red-500/30 text-red-300',
          blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
          green: 'bg-green-500/10 border-green-500/30 text-green-300',
          orange: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
          yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
          pink: 'bg-pink-500/10 border-pink-500/30 text-pink-300',
      };
      return styles[color] || styles.gray;
  };

  // Filter Users
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.displayName.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-dark-bg text-white p-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-400">4 {t.adminPanel}</h1>
          <p className="text-gray-400">{t.systemManagement}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
           {/* Server Connection Indicator */}
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${serverOnline ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`} title={serverOnline ? "Connected to Server" : "Offline Mode"}>
               <Activity size={14} className={serverOnline ? "text-green-400" : "text-red-400"} />
               <span className="text-xs text-gray-300">{serverOnline ? "Server Online" : "Offline"}</span>
               <div className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
           </div>

           {/* Back to Chat Button */}
           <button 
             onClick={onSwitchToChat} 
             className="hidden sm:flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition text-sm font-medium"
           >
              <MessageSquare size={18} />
              <span>{t.chats}</span>
           </button>

           {/* Language Selector */}
           <div className="relative" ref={langMenuRef}>
              <button 
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="p-2 rounded-full hover:bg-white/10 text-gray-300 flex items-center gap-2 transition"
              >
                <Globe size={20} />
                <span className="uppercase text-xs font-bold">{adminLang}</span>
              </button>
              {isLangMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-32 bg-dark-panel border border-gray-700 rounded-xl overflow-hidden shadow-xl animate-fade-in z-50">
                   {(['en', 'ru', 'fr', 'es', 'zh'] as Language[]).map(lang => (
                     <button 
                       key={lang}
                       onClick={() => handleLanguageChange(lang)}
                       className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${adminLang === lang ? 'text-brand-400 font-bold' : 'text-gray-400'}`}
                     >
                       {lang === 'en' ? 'English' : lang === 'ru' ? 'Русский' : lang === 'fr' ? 'Français' : lang === 'es' ? 'Español' : '中文'}
                     </button>
                   ))}
                </div>
              )}
           </div>

           <div className="text-right hidden sm:block">
              <p className="font-semibold">{currentUser.displayName || currentUser.username}</p>
              <p className="text-xs text-brand-500">Administrator</p>
           </div>
           <img src={currentUser.avatarUrl} alt="Admin" className="w-10 h-10 rounded-full border-2 border-brand-500" />
           <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-full text-red-400 transition" title={t.logout}>
             <LogOut size={20} />
           </button>
        </div>
      </header>
      
      {/* Rest of the component (Stats Grid, Tables etc) */}
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-dark-panel p-6 rounded-xl border border-gray-700 hover:border-brand-500 transition">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-500/20 text-brand-400 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t.totalUsers}</p>
              <h3 className="text-2xl font-bold">{stats.totalUsers}</h3>
            </div>
          </div>
        </div>
        <div className="bg-dark-panel p-6 rounded-xl border border-gray-700 hover:border-brand-500 transition">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 text-green-400 rounded-lg">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t.activeNow}</p>
              <h3 className="text-2xl font-bold">{stats.activeNow}</h3>
            </div>
          </div>
        </div>
        <div className="bg-dark-panel p-6 rounded-xl border border-gray-700 hover:border-brand-500 transition">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg">
              <MessageSquare size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t.messages}</p>
              <h3 className="text-2xl font-bold">{stats.totalMessages}</h3>
            </div>
          </div>
        </div>
        <div className="bg-dark-panel p-6 rounded-xl border border-gray-700 hover:border-brand-500 transition">
           <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/20 text-orange-400 rounded-lg">
              <MessageSquare size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t.conversations}</p>
              <h3 className="text-2xl font-bold">{stats.totalConversations}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Users Table */}
          <div className="xl:col-span-2 bg-dark-panel rounded-xl border border-gray-700 overflow-hidden shadow-xl flex flex-col">
            <div className="p-6 border-b border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-semibold">{t.userManagement}</h2>
              <div className="flex gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                      <input 
                        type="text" 
                        placeholder={t.searchPlaceholder}
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="bg-dark-bg border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-brand-500 outline-none w-full md:w-64"
                      />
                  </div>
                  <button 
                      onClick={() => setShowCreateUserModal(true)}
                      className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                      <Plus size={16} /> <span className="hidden sm:inline">{t.createUser}</span>
                  </button>
              </div>
            </div>
            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar max-h-[600px]">
              <table className="w-full text-left">
                <thead className="bg-gray-800/50 text-gray-400 text-sm sticky top-0 backdrop-blur-md z-10">
                  <tr>
                    <th className="p-4 pl-6">{t.user}</th>
                    <th className="p-4">{t.role}</th>
                    <th className="p-4">{t.country}</th>
                    <th className="p-4">{t.status}</th>
                    <th className="p-4 text-right pr-6">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                      <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                             {t.noUsersFound}
                          </td>
                      </tr>
                  ) : filteredUsers.map((user) => {
                    const userRole = roles.find(r => r.id === user.role) || { name: user.role, color: 'gray' };
                    return (
                    <tr key={user.id} className={`border-b border-gray-700 hover:bg-white/5 transition ${user.isBanned ? 'bg-red-900/10' : ''}`}>
                      <td className="p-4 pl-6 flex items-center gap-3">
                        <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-700" />
                        <div>
                          <div className="font-medium flex items-center gap-1 text-white">
                            {user.displayName}
                            {user.modifiers?.includes('VIP') && <Star size={14} className="text-yellow-400 fill-current" />}
                            {user.isVerified && <CheckCircle size={14} className="text-blue-400" fill="currentColor" />}
                          </div>
                          <div className="text-xs text-gray-500">@{user.username}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeStyle(userRole.color)}`}>
                          {userRole.name}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-mono bg-white/5 px-2 py-0.5 rounded text-gray-300">
                          {user.country || 'US'}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.isBanned ? (
                           <span className="flex items-center gap-2 text-sm text-red-400 font-medium">
                             <Ban size={14} /> {t.blocked}
                           </span>
                        ) : (
                           <span className={`flex items-center gap-2 text-sm ${
                            user.status === 'online' ? 'text-green-400' : 
                            user.status === 'busy' ? 'text-red-400' : 'text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                               user.status === 'online' ? 'bg-green-400' : 
                               user.status === 'busy' ? 'bg-red-400' : 'bg-gray-500'
                            }`} />
                            {user.status === 'online' ? t.online : user.status === 'busy' ? t.busy : t.offline}
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right flex items-center justify-end gap-2">
                        {user.id !== currentUser.id && (
                          <>
                            <button 
                              onClick={() => openEditModal(user)}
                              className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                              title={t.editUser}
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={(e) => handleToggleBan(e, user)}
                              className={`p-2 rounded-lg transition ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`}
                              title={user.isBanned ? t.unbanUser : t.banUser}
                            >
                              {user.isBanned ? <Shield size={18} /> : <ShieldOff size={18} />}
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                              title={t.deleteUser}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column Stack */}
          <div className="flex flex-col gap-6">
              {/* Role Management */}
              <div className="bg-dark-panel rounded-xl border border-gray-700 overflow-hidden shadow-xl flex flex-col max-h-[400px]">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/30">
                      <h2 className="text-xl font-semibold">{t.roleManagement}</h2>
                  </div>
                  
                  <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                      {roles.map(role => (
                          <div key={role.id} className="p-4 rounded-xl bg-dark-bg border border-gray-700 hover:border-gray-500 transition group">
                              <div className="flex justify-between items-start mb-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getRoleBadgeStyle(role.color)}`}>
                                      {role.name}
                                  </span>
                                  {!role.isSystem && (
                                      <button 
                                          onClick={() => handleDeleteRole(role.id)} 
                                          className="text-gray-500 hover:text-red-400 transition"
                                          title="Delete Role"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  )}
                              </div>
                              <p className="text-sm text-gray-400">{role.description}</p>
                          </div>
                      ))}
                  </div>

                  <div className="p-4 border-t border-gray-700 bg-gray-800/30">
                      <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">{t.createRole}</h3>
                      <form onSubmit={handleCreateRole} className="space-y-3">
                          <input 
                              type="text" 
                              placeholder={t.roleName} 
                              value={roleForm.name}
                              onChange={e => setRoleForm({...roleForm, name: e.target.value})}
                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-brand-500 outline-none"
                              required
                          />
                          <input 
                              type="text" 
                              placeholder={t.roleDesc} 
                              value={roleForm.description}
                              onChange={e => setRoleForm({...roleForm, description: e.target.value})}
                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-brand-500 outline-none"
                              required
                          />
                          <select 
                              value={roleForm.color}
                              onChange={e => setRoleForm({...roleForm, color: e.target.value})}
                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-brand-500 outline-none text-gray-300"
                          >
                              <option value="gray">Gray</option>
                              <option value="purple">Purple</option>
                              <option value="blue">Blue</option>
                              <option value="green">Green</option>
                              <option value="red">Red</option>
                              <option value="orange">Orange</option>
                              <option value="yellow">Yellow</option>
                              <option value="pink">Pink</option>
                          </select>
                          <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-lg text-sm font-medium transition">
                              {t.createRole}
                          </button>
                      </form>
                  </div>
              </div>

              {/* Ad Management */}
              <div className="bg-dark-panel rounded-xl border border-gray-700 overflow-hidden shadow-xl flex flex-col max-h-[400px]">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/30">
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                          <Megaphone size={20} className="text-yellow-400" /> {t.adsManagement}
                      </h2>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                      {ads.length === 0 && <p className="text-gray-500 text-sm italic text-center py-4">{t.noAds}</p>}
                      {ads.map(ad => (
                          <div key={ad.id} className="p-3 rounded-lg bg-dark-bg border border-gray-700 flex gap-3 group relative overflow-hidden">
                              <img src={ad.posterUrl} className="w-12 h-16 object-cover rounded bg-gray-700 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-yellow-500 text-sm truncate">{ad.name}</h4>
                                  <p className="text-xs text-gray-400 line-clamp-2">{ad.text}</p>
                                  {ad.link && <p className="text-[10px] text-blue-400 truncate mt-1">{ad.link}</p>}
                              </div>
                              <button onClick={() => handleDeleteAd(ad.id)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400 transition bg-dark-bg/80 rounded-full p-1">
                                  <Trash2 size={14} />
                              </button>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t border-gray-700 bg-gray-800/30">
                      <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">{t.createAd}</h3>
                      <form onSubmit={handleCreateAd} className="space-y-3">
                          <input 
                              type="text" 
                              placeholder={t.adName}
                              value={adForm.name}
                              onChange={e => setAdForm({...adForm, name: e.target.value})}
                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-yellow-500 outline-none"
                              required
                          />
                          <input 
                              type="text" 
                              placeholder={t.adText}
                              value={adForm.text}
                              onChange={e => setAdForm({...adForm, text: e.target.value})}
                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-yellow-500 outline-none"
                              required
                          />
                          <input 
                              type="text" 
                              placeholder={t.adPosterUrl}
                              value={adForm.posterUrl}
                              onChange={e => setAdForm({...adForm, posterUrl: e.target.value})}
                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-yellow-500 outline-none"
                              required
                          />
                          <input 
                              type="text" 
                              placeholder={t.adLink}
                              value={adForm.link}
                              onChange={e => setAdForm({...adForm, link: e.target.value})}
                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-yellow-500 outline-none"
                          />
                          <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-black py-2 rounded-lg text-sm font-bold transition">
                              {t.createAd}
                          </button>
                      </form>
                  </div>
              </div>

              {/* Geo Blocking Management */}
              <div className="bg-dark-panel rounded-xl border border-gray-700 overflow-hidden shadow-xl flex flex-col flex-1 max-h-[400px]">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/30">
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        <MapPin size={20} className="text-red-400" /> {t.geoBlocking}
                      </h2>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                      {countryBans.length === 0 && <p className="text-gray-500 text-sm italic text-center py-4">{t.noBans}</p>}
                      {countryBans.map(ban => (
                          <div key={ban.id} className="p-3 rounded-lg bg-dark-bg border border-gray-700 flex justify-between items-center group">
                             <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono bg-white/5 px-1.5 rounded text-xs text-gray-300">{ban.countryCode}</span>
                                    <span className={`text-xs font-bold uppercase ${ban.type === 'FULL_CHAT' ? 'text-red-400' : 'text-orange-400'}`}>
                                      {ban.type === 'FULL_CHAT' ? t.fullChatBan : ban.type === 'ROLE_INTERACTION' ? t.roleInteractionBan : t.usernameBan}
                                    </span>
                                </div>
                                {ban.type === 'ROLE_INTERACTION' && (
                                   <p className="text-xs text-gray-500">Target: <span className="text-gray-300 font-medium">{roles.find(r => r.id === ban.targetRoleId)?.name}</span></p>
                                )}
                                {ban.type === 'USERNAME' && (
                                   <p className="text-xs text-gray-500">Target: <span className="text-gray-300 font-medium">{users.find(u => u.id === ban.targetUserId)?.username || 'Unknown'}</span></p>
                                )}
                             </div>
                             <button onClick={() => handleDeleteBan(ban.id)} className="text-gray-500 hover:text-red-400 transition">
                                <Trash2 size={16} />
                             </button>
                          </div>
                      ))}
                  </div>

                   <div className="p-4 border-t border-gray-700 bg-gray-800/30">
                      <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">{t.addBan}</h3>
                      <form onSubmit={handleAddBan} className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {/* Combined Select/Text Input for Country */}
                            <div className="relative">
                                <input 
                                    list="country-options"
                                    value={banForm.countryCode}
                                    onChange={e => setBanForm({...banForm, countryCode: e.target.value.toUpperCase()})}
                                    placeholder="Country Code (e.g. US)"
                                    className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-brand-500 outline-none text-white uppercase placeholder-gray-500"
                                    maxLength={2}
                                />
                                <datalist id="country-options">
                                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </datalist>
                            </div>

                            <select 
                                value={banForm.type}
                                onChange={e => setBanForm({...banForm, type: e.target.value as any})}
                                className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-brand-500 outline-none text-white"
                            >
                                <option value="FULL_CHAT">{t.fullChatBan}</option>
                                <option value="ROLE_INTERACTION">{t.roleInteractionBan}</option>
                                <option value="USERNAME">{t.usernameBan}</option>
                            </select>
                          </div>
                          
                          {banForm.type === 'ROLE_INTERACTION' && (
                             <select 
                                value={banForm.targetRoleId}
                                onChange={e => setBanForm({...banForm, targetRoleId: e.target.value})}
                                className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-brand-500 outline-none text-white"
                            >
                                <option value="" disabled>{t.targetRole}...</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          )}

                          {banForm.type === 'USERNAME' && (
                             <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                <input 
                                    type="text"
                                    placeholder={t.username}
                                    value={banForm.targetUserId ? users.find(u => u.id === banForm.targetUserId)?.username : ''}
                                    onChange={(e) => {
                                        const user = users.find(u => u.username.toLowerCase() === e.target.value.toLowerCase());
                                        if (user) setBanForm({...banForm, targetUserId: user.id});
                                        else setBanForm({...banForm, targetUserId: ''}); // Basic validation logic
                                    }}
                                    className="w-full bg-dark-bg border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-brand-500 outline-none"
                                    list="user-options"
                                />
                                <datalist id="user-options">
                                    {users.map(u => <option key={u.id} value={u.username} />)}
                                </datalist>
                             </div>
                          )}

                          <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium transition">
                              {t.addBan}
                          </button>
                      </form>
                      
                      {/* Ban by Username Shortcut */}
                      <div className="mt-4 pt-4 border-t border-gray-700">
                          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Ban by Username (Shortcut)</h4>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={banUsername}
                                  onChange={(e) => setBanUsername(e.target.value)}
                                  placeholder="username"
                                  className="flex-1 bg-dark-bg border border-gray-600 rounded-lg p-2 text-sm focus:border-red-500 outline-none"
                              />
                              <button 
                                onClick={handleBanByUsername}
                                className="bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 px-3 rounded-lg transition"
                              >
                                  Ban User
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      
      {/* Modals for Create User and Edit User are below here in original code, assumed preserved */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-dark-panel border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-dark-bg/50">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                      <Plus size={20} className="text-brand-500" /> {t.createUser}
                  </h3>
                  <button onClick={() => setShowCreateUserModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                      <X size={20} />
                  </button>
              </div>
              <div className="overflow-y-auto p-6 custom-scrollbar flex-1">
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.username}</label>
                        <input 
                            type="text" 
                            value={createUserForm.username}
                            onChange={e => setCreateUserForm({...createUserForm, username: e.target.value})}
                            className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.visibleName}</label>
                        <input 
                            type="text" 
                            value={createUserForm.displayName}
                            onChange={e => setCreateUserForm({...createUserForm, displayName: e.target.value})}
                            className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.password}</label>
                        <input 
                            type="text" 
                            value={createUserForm.password}
                            onChange={e => setCreateUserForm({...createUserForm, password: e.target.value})}
                            className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.role}</label>
                            <select 
                                value={createUserForm.role}
                                onChange={e => setCreateUserForm({...createUserForm, role: e.target.value})}
                                className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none text-white"
                            >
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.country}</label>
                            <input 
                                list="country-options-create"
                                value={createUserForm.country}
                                onChange={e => setCreateUserForm({...createUserForm, country: e.target.value.toUpperCase()})}
                                className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none text-white uppercase"
                                maxLength={2}
                                placeholder="US"
                            />
                            <datalist id="country-options-create">
                                 {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </datalist>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-xl font-medium transition shadow-lg">
                        {t.createUser}
                    </button>
                </form>
              </div>
           </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-dark-panel border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-dark-bg/50">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Edit2 size={20} className="text-blue-500" /> 
                {t.editUser}: {editingUser.username}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 custom-scrollbar flex-1">
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                   <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.username}</label>
                   <div className="relative">
                     <UserIcon className="absolute left-3 top-3 text-gray-500" size={16} />
                     <input 
                       type="text" 
                       value={editForm.username}
                       onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                       className="w-full bg-dark-bg border border-gray-600 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none transition"
                       placeholder={t.username}
                       required
                     />
                   </div>
                </div>

                <div>
                   <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.visibleName}</label>
                   <div className="relative">
                     <Smile className="absolute left-3 top-3 text-gray-500" size={16} />
                     <input 
                       type="text" 
                       value={editForm.displayName}
                       onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                       className="w-full bg-dark-bg border border-gray-600 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none transition"
                       placeholder={t.visibleName}
                       required
                     />
                   </div>
                </div>

                <div>
                   <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.password}</label>
                   <div className="relative">
                     <Lock className="absolute left-3 top-3 text-gray-500" size={16} />
                     <input 
                       type="text" 
                       value={editForm.password}
                       onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                       className="w-full bg-dark-bg border border-gray-600 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none transition"
                       placeholder={t.password}
                       required
                     />
                   </div>
                </div>

                {/* Auto Message Field */}
                <div>
                   <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block flex items-center gap-2">
                       <Zap size={14} className="text-gray-400" /> {t.autoMessage}
                   </label>
                   <input 
                     type="text" 
                     value={editForm.autoMessage}
                     onChange={(e) => setEditForm({...editForm, autoMessage: e.target.value})}
                     className="w-full bg-dark-bg border border-gray-600 rounded-lg py-2.5 pl-4 pr-4 text-sm focus:border-blue-500 focus:outline-none transition placeholder-gray-500"
                     placeholder={t.autoMessagePlaceholder}
                   />
                </div>

                {/* Modifiers Section */}
                <div className="bg-white/5 rounded-lg p-3 border border-gray-700">
                    <label className="text-xs text-gray-400 uppercase font-bold mb-2 block flex items-center gap-2">
                        <Zap size={14} className="text-yellow-400" /> {t.modifiers}
                    </label>
                    <div className="flex gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${editForm.modifiers.includes('ALWAYS_ONLINE') ? 'bg-green-500 border-green-500' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                {editForm.modifiers.includes('ALWAYS_ONLINE') && <Check size={14} className="text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={editForm.modifiers.includes('ALWAYS_ONLINE')} onChange={() => toggleEditModifier('ALWAYS_ONLINE')} />
                            <span className="text-sm text-gray-300 group-hover:text-white transition">{t.alwaysOnline}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${editForm.modifiers.includes('VIP') ? 'bg-yellow-500 border-yellow-500' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                {editForm.modifiers.includes('VIP') && <Check size={14} className="text-black" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={editForm.modifiers.includes('VIP')} onChange={() => toggleEditModifier('VIP')} />
                            <span className="text-sm text-gray-300 group-hover:text-white transition">{t.vipGold}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${editForm.modifiers.includes('CANT_CHAT') ? 'bg-red-500 border-red-500' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                {editForm.modifiers.includes('CANT_CHAT') && <Check size={14} className="text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={editForm.modifiers.includes('CANT_CHAT')} onChange={() => toggleEditModifier('CANT_CHAT')} />
                            <span className="text-sm text-gray-300 group-hover:text-white transition">{t.cantChat}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${editForm.modifiers.includes('CANT_SEE_MESSAGES') ? 'bg-red-500 border-red-500' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                {editForm.modifiers.includes('CANT_SEE_MESSAGES') && <Check size={14} className="text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={editForm.modifiers.includes('CANT_SEE_MESSAGES')} onChange={() => toggleEditModifier('CANT_SEE_MESSAGES')} />
                            <span className="text-sm text-gray-300 group-hover:text-white transition">{t.cantSeeMessages}</span>
                        </label>
                    </div>
                </div>
                
                {/* Role & Country Selector */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.role}</label>
                       <select 
                           value={editForm.role}
                           onChange={e => setEditForm({...editForm, role: e.target.value})}
                           className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none text-white"
                       >
                           {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                       </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.country}</label>
                        <input 
                           list="country-options-edit"
                           value={editForm.country}
                           onChange={e => setEditForm({...editForm, country: e.target.value.toUpperCase()})}
                           className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none text-white uppercase"
                           maxLength={2}
                           placeholder="US"
                        />
                        <datalist id="country-options-edit">
                           {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </datalist>
                    </div>
                </div>

                <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-xl font-medium transition shadow-lg mt-6">
                    {t.saveChanges}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;