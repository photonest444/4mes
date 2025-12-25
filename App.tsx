
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Messenger from './components/Messenger';
import AdminDashboard from './components/AdminDashboard';
import { User, UserRole } from './types';
import { db, setAuthCookie, getAuthCookie, deleteAuthCookie } from './services/database';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [pendingChatUsername, setPendingChatUsername] = useState<string | null>(null);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  // Handle Deep Linking (Query Params > Path)
  useEffect(() => {
    // 1. Try Query Params (Best for single-file/static hosting)
    const params = new URLSearchParams(window.location.search);
    const queryGroup = params.get('group');
    const queryUser = params.get('user');
    
    if (queryGroup) {
      setPendingGroupId(queryGroup);
    } else if (queryUser) {
      setPendingChatUsername(queryUser);
    } else {
      // 2. Fallback to Path (Legacy/Server-side routing)
      const path = window.location.pathname;
      
      const userMatch = path.match(/^\/user\/([^/]+)$/);
      if (userMatch && userMatch[1]) {
        setPendingChatUsername(userMatch[1]);
      }

      const groupMatch = path.match(/^\/group\/([^/]+)$/);
      if (groupMatch && groupMatch[1]) {
        setPendingGroupId(groupMatch[1]);
      }
    }
  }, []);

  // Initialize DB and Check for existing session
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      
      // Initialize Database from external file if needed
      await db.initialize();
      
      // 1. Try Cookie Authentication
      const cookieData = getAuthCookie();
      if (cookieData && cookieData.username && cookieData.password) {
        try {
          const user = db.login(cookieData.username, cookieData.password);
          setCurrentUser(user);
          setIsLoading(false);
          return;
        } catch (e) {
          console.log("Cookie login failed:", e);
          deleteAuthCookie(); // Invalid credentials in cookie
        }
      }

      // 2. Fallback to session localStorage (legacy or single session)
      const stored = localStorage.getItem('4messenger_current_user');
      if (stored) {
        const user = JSON.parse(stored);
        // Validate user against DB to ensure they aren't banned/deleted
        try {
            const freshUser = db.getUser(user.id);
            if (freshUser && !freshUser.isBanned && freshUser.role !== 'BANNED') {
                 setCurrentUser(freshUser);
            } else {
                localStorage.removeItem('4messenger_current_user');
            }
        } catch (e) {
             localStorage.removeItem('4messenger_current_user');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setShowAdminPanel(false); // Default to chat view
    // Persist to local storage for basic session
    localStorage.setItem('4messenger_current_user', JSON.stringify(user));
    // Persist to Cookie for auto-login if password is available
    // (Note: In a real app, we'd use a token, not a password)
    if (user.password) {
      setAuthCookie(user.username, user.password);
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('4messenger_current_user', JSON.stringify(updatedUser));
    // Update cookie if password/username changed
    if (updatedUser.password) {
       setAuthCookie(updatedUser.username, updatedUser.password);
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      db.logout(currentUser.id);
    }
    setCurrentUser(null);
    setShowAdminPanel(false);
    localStorage.removeItem('4messenger_current_user');
    deleteAuthCookie(); // Delete the cookie files
  };

  if (isLoading) {
      return (
          <div className="h-screen w-screen bg-dark-bg flex items-center justify-center">
             <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (showAdminPanel && currentUser.role === UserRole.ADMIN) {
    return (
      <AdminDashboard 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onSwitchToChat={() => setShowAdminPanel(false)}
      />
    );
  }

  return (
    <Messenger 
      currentUser={currentUser} 
      onLogout={handleLogout} 
      onUpdateUser={handleUpdateUser} 
      onOpenAdminPanel={() => setShowAdminPanel(true)}
      initialChatUsername={pendingChatUsername || undefined}
      initialGroupId={pendingGroupId || undefined}
    />
  );
};

export default App;
