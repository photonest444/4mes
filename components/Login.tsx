
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/database';
import { User, Language } from '../types';
import { translations } from '../translations';
import { MessageSquare, Lock, User as UserIcon, Eye, EyeOff, Smile, Globe } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('en');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const t = translations[selectedLang];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Fetch country first if registering
    let countryCode = 'US';
    if (isRegistering) {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            countryCode = data.country_code || 'US';
        } catch (e) {
            console.warn("Location detection failed, defaulting to US");
        }
    }

    setTimeout(() => { // Simulate network delay
      try {
        if (!username.trim()) throw new Error(t.usernameRequired);
        if (!password.trim()) throw new Error(t.passwordRequired);
        if (isRegistering && !displayName.trim()) throw new Error(t.visibleNameRequired);

        let user: User | null;
        if (isRegistering) {
          user = db.register(username, password, displayName, countryCode);
          // Update language after register
          if (user) {
             db.updateProfile(user.id, { preferences: { ...user.preferences, language: selectedLang } });
             user.preferences.language = selectedLang;
          }
        } else {
          user = db.login(username, password);
        }
        
        if (user) {
           onLogin(user);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 800);
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setUsername('');
    setPassword('');
    setDisplayName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-500/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]" />

      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-20" ref={langMenuRef}>
         <div className="relative">
            <button 
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 flex items-center gap-2 transition"
            >
              <Globe size={18} />
              <span className="uppercase text-xs font-bold">{selectedLang}</span>
            </button>
            {isLangMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-dark-panel border border-gray-700 rounded-xl overflow-hidden shadow-xl animate-fade-in z-50">
                 {(['en', 'ru', 'fr', 'es', 'zh'] as Language[]).map(lang => (
                   <button 
                     key={lang}
                     onClick={() => { setSelectedLang(lang); setIsLangMenuOpen(false); }}
                     className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${selectedLang === lang ? 'text-brand-400 font-bold' : 'text-gray-400'}`}
                   >
                     {lang === 'en' ? 'English' : 
                      lang === 'ru' ? 'Русский' : 
                      lang === 'fr' ? 'Français' : 
                      lang === 'es' ? 'Español' : '中文'}
                   </button>
                 ))}
              </div>
            )}
         </div>
      </div>

      <div className="w-full max-w-md p-8 bg-dark-panel/50 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl relative z-10 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl mb-4 shadow-lg shadow-brand-500/30">
            <MessageSquare size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">4 Messenger</h1>
          <p className="text-gray-400">Connect instantly. Securely. Beautifully.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t.username}</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-3.5 text-gray-500" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-dark-bg border border-gray-600 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition text-white placeholder-gray-500"
                placeholder={t.username}
              />
            </div>
          </div>

          {isRegistering && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-gray-300 mb-2">{t.visibleName}</label>
              <div className="relative">
                <Smile className="absolute left-4 top-3.5 text-gray-500" size={20} />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-bg border border-gray-600 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition text-white placeholder-gray-500"
                  placeholder={t.visibleName}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t.password}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-500" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 bg-dark-bg border border-gray-600 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition text-white placeholder-gray-500"
                placeholder={t.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-500 hover:text-white transition"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition shadow-lg shadow-brand-500/25 flex justify-center items-center gap-2 mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              isRegistering ? t.register : t.login
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            {isRegistering ? t.hasAccount : t.noAccount}{' '}
            <button 
              onClick={toggleMode}
              className="text-brand-400 hover:text-brand-300 font-medium transition"
            >
              {isRegistering ? t.switchToLogin : t.switchToRegister}
            </button>
          </p>
          {!isRegistering && (
             <p className="text-xs text-gray-500 mt-4">
               Tip: Default admin pass is <b>123</b>
             </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
