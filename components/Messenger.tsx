
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/database';
import { User, Conversation, UserPreferences, Role, Message, Ad } from '../types';
import { translations } from '../translations';
import { Send, LogOut, Search, Image as ImageIcon, Phone, Video, MoreVertical, Settings, Ban, X, Check, Camera, Palette, Layout, Type, Shield, EyeOff, CheckCircle, LayoutDashboard, Reply, XCircle, Star, Link, Copy, Users, UserPlus, Mic, MicOff, Crown, DoorOpen, Info, Globe } from 'lucide-react';
import { generateAIResponse } from '../services/gemini';

interface MessengerProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
  onOpenAdminPanel?: () => void;
  initialChatUsername?: string;
  initialGroupId?: string;
}

// Configuration Constants
const THEME_COLORS = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', ring: 'ring-blue-500', hoverBg: 'hover:bg-blue-500', lightBg: 'bg-blue-500/20' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-500', border: 'border-purple-500', ring: 'ring-purple-500', hoverBg: 'hover:bg-purple-600', lightBg: 'bg-purple-500/20' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-500', hoverBg: 'hover:bg-emerald-500', lightBg: 'bg-emerald-500/20' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500', ring: 'ring-rose-500', hoverBg: 'hover:bg-rose-500', lightBg: 'bg-rose-500/20' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', ring: 'ring-amber-500', hoverBg: 'hover:bg-amber-500', lightBg: 'bg-amber-500/20' },
};

const WALLPAPERS = [
  { name: 'Dark Nebula', value: 'linear-gradient(to bottom right, #0f172a, #1e293b)' },
  { name: 'Midnight', value: '#000000' },
  { name: 'Deep Ocean', value: 'linear-gradient(to bottom, #0f172a, #1e3a8a)' },
  { name: 'Royal', value: 'linear-gradient(to top right, #2e1065, #000000)' },
  { name: 'Sunset', value: 'linear-gradient(45deg, #4c0519, #0f172a)' },
];

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// Mock DeepSeek Filter Logic
const censorText = (text: string, level: 'low' | 'medium' | 'max'): string => {
    let badWords: string[] = [];
    const low = ['fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'whore', 'bastard', 'cunt', 'damn', 'hell'];
    const medium = ['stupid', 'idiot', 'moron', 'dumb', 'loser', 'ugly', 'fat', 'shut up', 'hate', 'crappy'];
    const max = ['bad', 'annoying', 'boring', 'weird', 'mess', 'suck', 'fail', 'trash', 'lazy', 'terrible', 'worst'];

    if (level === 'low') badWords = [...low];
    else if (level === 'medium') badWords = [...low, ...medium];
    else if (level === 'max') badWords = [...low, ...medium, ...max];

    let censored = text;
    badWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        censored = censored.replace(regex, '*'.repeat(word.length));
    });
    return censored;
};

// Robust Copy to Clipboard Helper
const copyToClipboard = async (text: string) => {
    if (!text) return false;
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers or insecure contexts (http/file://)
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (e) {
            console.error("Copy failed", e);
            return false;
        }
    }
};

const Messenger: React.FC<MessengerProps> = ({ currentUser, onLogout, onUpdateUser, onOpenAdminPanel, initialChatUsername, initialGroupId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [sidebarUsers, setSidebarUsers] = useState<User[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAd, setCurrentAd] = useState<Ad | null>(null);
  const adsRef = useRef<Ad[]>([]); // Ref to hold latest ads for interval
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'account' | 'appearance' | 'privacy'>('account');
  const [showChatMenu, setShowChatMenu] = useState(false);
  
  // Group Feature States
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupInviteLinkCopied, setGroupInviteLinkCopied] = useState(false);
  
  // New Feature States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);

  // Profile Form State
  const [newAvatarUrl, setNewAvatarUrl] = useState(currentUser.avatarUrl);
  const [newDisplayName, setNewDisplayName] = useState(currentUser.displayName || currentUser.username);
  const [newPassword, setNewPassword] = useState(currentUser.password || '');
  const [newAutoMessage, setNewAutoMessage] = useState(currentUser.autoMessage || '');
  const [newPreferences, setNewPreferences] = useState<UserPreferences>(currentUser.preferences || { 
    themeColor: 'blue', 
    wallpaper: WALLPAPERS[0].value, 
    bubbleStyle: 'rounded',
    fontSize: 'medium',
    density: 'comfortable',
    privacyMode: false,
    language: 'en',
    censorshipEnabled: false,
    censorshipLevel: 'medium'
  });
  const [customWallpaper, setCustomWallpaper] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for tracking scroll state logic
  const prevConversationId = useRef<string | null>(null);
  const prevLastMessageId = useRef<string | null>(null);

  const t = translations[currentUser.preferences?.language || 'en'];
  const activeTheme = THEME_COLORS[currentUser.preferences?.themeColor || 'blue'];
  const currentFontSize = currentUser.preferences?.fontSize || 'medium';
  const currentDensity = currentUser.preferences?.density || 'comfortable';
  const isVip = currentUser.modifiers?.includes('VIP');

  // --- Handle Deep Linking / Initial Chat ---
  useEffect(() => {
    // 1. Join Group via ID
    if (initialGroupId) {
        try {
            const joinedGroup = db.joinGroup(initialGroupId, currentUser.id);
            setActiveConversation(joinedGroup);
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
        } catch (e: any) {
            alert("Could not join group: " + e.message);
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
        }
    }
    // 2. Open Chat via Username
    else if (initialChatUsername) {
      const allUsers = db.getUsers();
      const targetUser = allUsers.find(u => u.username.toLowerCase() === initialChatUsername.toLowerCase());
      
      if (targetUser && targetUser.id !== currentUser.id) {
        handleUserSelect(targetUser);
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      } else if (!targetUser) {
        alert(t.userNotFound + ": " + initialChatUsername);
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, [initialChatUsername, initialGroupId, currentUser.id]);

  // --- Data Fetching & Polling ---
  useEffect(() => {
    const fetchData = async () => {
      // Sync with "Server" (database.json) then reload local view
      await db.sync(); 
      db.reload();
      
      const freshUser = db.getUser(currentUser.id);
      if (freshUser && (freshUser.isBanned || freshUser.role === 'BANNED')) {
        alert(t.bannedAlert);
        onLogout();
        return;
      }

      const allUsers = db.getUsers();
      const myConvs = db.getConversations(currentUser.id);
      setConversations(myConvs);
      setRoles(db.getRoles());
      setAds(db.getAds());

      // Search Filter
      if (searchQuery.trim()) {
        const results = allUsers.filter(u => 
          u.id !== currentUser.id && 
          u.username.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSidebarUsers(results);
      } else {
        const contactIds = new Set<string>();
        myConvs.forEach(c => {
          c.participants.forEach(p => {
            if (p !== currentUser.id) contactIds.add(p);
          });
        });
        const contacts = allUsers.filter(u => contactIds.has(u.id));
        setSidebarUsers(contacts);
      }

      // Active Conversation Update
      if (activeConversation) {
        const updated = myConvs.find(c => c.id === activeConversation.id);
        if (updated) {
          setActiveConversation(updated);
        } else {
           // Conversation removed/kicked
           setActiveConversation(null);
           setShowGroupInfo(false); // Close modals if kicked
        }
      }
    };

    fetchData();
    // Poll every 2 seconds as requested for new info from database
    const interval = setInterval(fetchData, 2000); 
    return () => clearInterval(interval);
  }, [currentUser.id, activeConversation?.id, searchQuery]); 

  // Scroll to bottom Logic
  useEffect(() => {
    if (!activeConversation) return;

    const lastMessage = activeConversation.messages[activeConversation.messages.length - 1];
    const currentLastMessageId = lastMessage ? lastMessage.id : null;
    const currentConversationId = activeConversation.id;

    const isNewConversation = currentConversationId !== prevConversationId.current;
    const isNewMessage = currentLastMessageId !== prevLastMessageId.current;

    if (isNewConversation || isNewMessage) {
        messagesEndRef.current?.scrollIntoView({ behavior: isNewConversation ? 'auto' : 'smooth' });
    }

    prevConversationId.current = currentConversationId;
    prevLastMessageId.current = currentLastMessageId;
  }, [activeConversation]);

  // Sync adsRef and handle initial load/empty state
  useEffect(() => {
    adsRef.current = ads;
    
    // If no ad is showing but we have ads, show one immediately
    if (!currentAd && ads.length > 0) {
        setCurrentAd(ads[Math.floor(Math.random() * ads.length)]);
    }
    
    // If ad is showing but it was deleted (not in current list), pick new one or clear
    if (currentAd && !ads.find(a => a.id === currentAd.id)) {
        if (ads.length > 0) {
             setCurrentAd(ads[Math.floor(Math.random() * ads.length)]);
        } else {
             setCurrentAd(null);
        }
    }
  }, [ads]); 

  // Rotation Interval
  useEffect(() => {
    const interval = setInterval(() => {
        const list = adsRef.current;
        if (list.length > 0) {
            // Pick random
            const random = list[Math.floor(Math.random() * list.length)];
            setCurrentAd(random);
        } else {
            setCurrentAd(null);
        }
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---
  const handleUserSelect = (otherUser: User) => {
    const conv = db.getConversation(currentUser.id, otherUser.id);
    setActiveConversation(conv);
    db.markAsRead(conv.id, currentUser.id);
    setSidebarOpen(false);
    setShowChatMenu(false);
    setSearchQuery('');
    setReplyingTo(null);
  };

  const handleConversationSelect = (conv: Conversation) => {
      setActiveConversation(conv);
      db.markAsRead(conv.id, currentUser.id);
      setSidebarOpen(false);
      setShowChatMenu(false);
      setSearchQuery('');
      setReplyingTo(null);
  };

  const getAvailableContacts = () => {
      const allUsers = db.getUsers();
      // Users I have a chat with
      const contactIds = new Set<string>();
      conversations.forEach(c => {
          c.participants.forEach(p => {
              if (p !== currentUser.id) contactIds.add(p);
          });
      });
      
      let contacts = allUsers.filter(u => contactIds.has(u.id));
      
      // If userSearchTerm is present, also search by EXACT username match from all users
      if (userSearchTerm.trim()) {
          const searchMatch = allUsers.find(u => 
              u.id !== currentUser.id && 
              u.username.toLowerCase() === userSearchTerm.toLowerCase().trim()
          );
          if (searchMatch && !contactIds.has(searchMatch.id)) {
              contacts.push(searchMatch);
          }
      }
      
      // Filter blocked users
      contacts = contacts.filter(u => !u.blockedUserIds?.includes(currentUser.id));
      
      return contacts;
  };

  const handleCreateGroup = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newGroupName.trim() || selectedGroupMembers.length === 0) return;
      
      const newGroup = db.createGroup(newGroupName, currentUser.id, selectedGroupMembers);
      setActiveConversation(newGroup);
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setSelectedGroupMembers([]);
      setUserSearchTerm('');
  };

  const handleAddMembers = (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeConversation || selectedGroupMembers.length === 0) return;
      
      try {
          db.addMembersToGroup(activeConversation.id, currentUser.id, selectedGroupMembers);
          setShowAddMemberModal(false);
          setSelectedGroupMembers([]);
          setUserSearchTerm('');
      } catch(e: any) {
          alert(e.message);
      }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.modifiers?.includes('CANT_CHAT')) return;
    if (!messageInput.trim() || !activeConversation) return;

    const content = messageInput;
    const replyId = replyingTo?.id;

    try {
      db.addMessage(activeConversation.id, currentUser.id, content, 'text', replyId);
      setMessageInput('');
      setReplyingTo(null);
      
      const otherUserId = activeConversation.participants.find(p => p !== currentUser.id);
      
      // AI Assistant Handlers
      if (otherUserId === 'ai-assistant') {
         db.setTyping(activeConversation.id, 'ai-assistant', true);
        setTimeout(async () => {
          const response = await generateAIResponse(content, 'gemini');
          db.setTyping(activeConversation.id, 'ai-assistant', false);
          db.addMessage(activeConversation.id, 'ai-assistant', response, 'text');
        }, 1500);
      } else if (otherUserId === 'deepseek-assistant') {
         db.setTyping(activeConversation.id, 'deepseek-assistant', true);
        setTimeout(async () => {
          const response = await generateAIResponse(content, 'deepseek');
          db.setTyping(activeConversation.id, 'deepseek-assistant', false);
          db.addMessage(activeConversation.id, 'deepseek-assistant', response, 'text');
        }, 1500);
      } else if (otherUserId === 'chatgpt-assistant') {
         db.setTyping(activeConversation.id, 'chatgpt-assistant', true);
        setTimeout(async () => {
          const response = await generateAIResponse(content, 'chatgpt');
          db.setTyping(activeConversation.id, 'chatgpt-assistant', false);
          db.addMessage(activeConversation.id, 'chatgpt-assistant', response, 'text');
        }, 1500);
      }

    } catch (error: any) {
      if (error.message === 'chatRestrictedRegion') {
          alert(t.chatRestrictedRegion);
      } else if (error.message === 'roleRestrictedRegion') {
          alert(t.roleRestrictedRegion);
      } else if (error.message === 'messageMuted') {
          alert(t.messageMuted);
      } else {
          alert(error.message || "Unable to send message.");
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentUser.modifiers?.includes('CANT_CHAT')) return;
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    // Check file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert("File size exceeds 10MB limit.");
        e.target.value = ''; // Reset input
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      try {
        db.addMessage(activeConversation.id, currentUser.id, base64String, 'image', replyingTo?.id);
        setReplyingTo(null);
        
        const otherUserId = activeConversation.participants.find(p => p !== currentUser.id);
        if (otherUserId === 'ai-assistant') {
          db.setTyping(activeConversation.id, 'ai-assistant', true);
          setTimeout(() => {
            db.setTyping(activeConversation.id, 'ai-assistant', false);
            db.addMessage(activeConversation.id, 'ai-assistant', "I received your image! (Visual analysis pending)", 'text');
          }, 1500);
        }
      } catch (error: any) {
         if (error.message === 'messageMuted') alert(t.messageMuted);
         else alert("Failed to send image.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReaction = (msgId: string, emoji: string) => {
      if (!activeConversation) return;
      if (currentUser.modifiers?.includes('CANT_CHAT')) return; 
      
      // Check group mute
      if (activeConversation.isGroup && activeConversation.mutedUsers && activeConversation.mutedUsers[currentUser.id]) {
          const muteExpiry = activeConversation.mutedUsers[currentUser.id];
          if (muteExpiry === -1 || muteExpiry > Date.now()) return;
      }
      
      db.toggleReaction(activeConversation.id, msgId, currentUser.id, emoji);
      setHoveredMessageId(null); 
  };

  const handleKickUser = (userId: string) => {
      if (!activeConversation) return;
      if (confirm(t.confirmKick)) {
          db.kickUser(activeConversation.id, userId);
          // Manually update local state for immediate feedback
          setActiveConversation(prev => {
              if (!prev) return null;
              return {
                  ...prev,
                  participants: prev.participants.filter(id => id !== userId),
                  adminIds: prev.adminIds?.filter(id => id !== userId)
              };
          });
      }
  };

  const handleMuteUser = (userId: string, duration: number) => {
      if (!activeConversation) return;
      db.muteUser(activeConversation.id, userId, duration);
  };

  const handlePromote = (userId: string) => {
      if (!activeConversation) return;
      db.promoteToAdmin(activeConversation.id, userId);
  };

  const handleLeaveGroup = () => {
      if (!activeConversation) return;
      if (confirm(t.leaveGroup + "?")) {
          const groupId = activeConversation.id;
          db.leaveGroup(groupId, currentUser.id);
          // Update UI immediately
          setActiveConversation(null);
          setShowGroupInfo(false);
          setConversations(prev => prev.filter(c => c.id !== groupId));
      }
  };

  const handleUpdateGroup = (name: string, avatar: string) => {
      if (!activeConversation) return;
      db.updateGroupSettings(activeConversation.id, name, avatar);
  };

  const handleCopyGroupInvite = async () => {
      if (!activeConversation) return;
      // Build a robust link using Query Params that works on static hosts
      const baseUrl = window.location.href.split('?')[0].split('#')[0];
      const link = `${baseUrl}?group=${activeConversation.id}`;
      
      const success = await copyToClipboard(link);
      if (success) {
          setGroupInviteLinkCopied(true);
          setTimeout(() => setGroupInviteLinkCopied(false), 2000);
      } else {
          alert("Failed to copy link. Please manually copy: " + link);
      }
  };

  // --- Helpers ---
  const getFontSizeClass = (size: 'small' | 'medium' | 'large', context: 'msg' | 'ui') => {
    const map = {
      small: { msg: 'text-sm', ui: 'text-xs' },
      medium: { msg: 'text-[15px]', ui: 'text-sm' },
      large: { msg: 'text-lg', ui: 'text-base' }
    };
    return map[size || 'medium'][context];
  };

  const getRoleStyle = (roleId: string) => {
      const role = roles.find(r => r.id === roleId) || { color: 'gray', name: roleId };
      const styles: Record<string, string> = {
          purple: 'bg-purple-500 text-white',
          gray: 'bg-gray-600 text-gray-200',
          red: 'bg-red-500 text-white',
          blue: 'bg-blue-500 text-white',
          green: 'bg-green-500 text-white',
          orange: 'bg-orange-500 text-white',
          yellow: 'bg-yellow-500 text-black',
          pink: 'bg-pink-500 text-white',
      };
      return { 
          className: styles[role.color] || styles.gray,
          name: role.name
      };
  };

  const getConversationDetails = (conv: Conversation) => {
      if (conv.isGroup) {
          return {
              id: conv.id,
              name: conv.name || 'Group',
              avatarUrl: conv.avatarUrl || 'https://picsum.photos/seed/group/200/200',
              status: `${conv.participants.length} ${t.participants}`,
              isGroup: true
          };
      } else {
          const otherId = conv.participants.find(id => id !== currentUser.id);
          const allUsers = db.getUsers();
          const u = allUsers.find(u => u.id === otherId) || { id: 'unknown', username: 'Unknown', displayName: 'Unknown', avatarUrl: '', status: 'offline', role: 'USER' } as User;
          return {
              id: u.id,
              name: u.displayName || u.username,
              avatarUrl: u.avatarUrl,
              status: u.status,
              isGroup: false,
              user: u
          };
      }
  };

  const isBlocked = (targetUserId: string) => {
    return (currentUser.blockedUserIds || []).includes(targetUserId);
  };

  const handleToggleBlock = () => {
    if (!activeConversation || activeConversation.isGroup) return;
    const details = getConversationDetails(activeConversation);
    if (details.user) {
        const updatedUser = db.toggleBlockUser(currentUser.id, details.user.id);
        onUpdateUser(updatedUser);
        setShowChatMenu(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    if (activeConversation) {
      db.setTyping(activeConversation.id, currentUser.id, true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        if (activeConversation) {
          db.setTyping(activeConversation.id, currentUser.id, false);
        }
      }, 2000);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const updatedUser = db.updateProfile(currentUser.id, {
            displayName: newDisplayName,
            avatarUrl: newAvatarUrl,
            password: newPassword, // Note: In a real app, handle password change securely
            preferences: newPreferences,
            autoMessage: newAutoMessage
        });
        onUpdateUser(updatedUser);
        setShowProfileModal(false);
    } catch (error: any) {
        alert("Failed to update profile: " + error.message);
    }
  };

  const handleCopyLink = async () => {
      const baseUrl = window.location.href.split('?')[0].split('#')[0];
      const link = `${baseUrl}?user=${currentUser.username}`;
      const success = await copyToClipboard(link);
      if (success) {
          setProfileLinkCopied(true);
          setTimeout(() => setProfileLinkCopied(false), 2000);
      } else {
          alert("Failed to copy link. Please manually copy: " + link);
      }
  };

  const isChatDisabled = currentUser.modifiers?.includes('CANT_CHAT');
  const isMessagesHidden = currentUser.modifiers?.includes('CANT_SEE_MESSAGES');
  const isGroupAdmin = (conv: Conversation, userId: string) => {
      return (conv.adminIds?.includes(userId) || currentUser.role === 'ADMIN');
  };
  const isMutedInGroup = activeConversation?.isGroup && activeConversation.mutedUsers && activeConversation.mutedUsers[currentUser.id] && (activeConversation.mutedUsers[currentUser.id] === -1 || activeConversation.mutedUsers[currentUser.id] > Date.now());

  // --- Render ---
  return (
    <div className={`flex h-screen bg-dark-bg text-white overflow-hidden font-sans ${getFontSizeClass(currentFontSize, 'ui')}`}>
      {/* Lightbox Modal */}
      {lightboxImage && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fade-in" onClick={() => setLightboxImage(null)}>
              <div className="relative max-w-4xl max-h-[90vh]">
                  <img src={lightboxImage} alt="Full size" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl animate-scale-in" />
                  <button onClick={() => setLightboxImage(null)} className="absolute top-[-40px] right-[-40px] p-2 bg-white/10 hover:bg-white/20 rounded-full transition">
                      <X size={24} />
                  </button>
              </div>
          </div>
      )}
      
      {/* Sidebar */}
      <div className={`
        absolute z-20 md:relative h-full w-full md:w-80 glass-panel border-r border-gray-700/50 flex flex-col transition-all duration-300 ease-in-out shadow-2xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-700/50 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-3">
             <div 
               className={`w-9 h-9 rounded-full overflow-hidden border-2 ${activeTheme.border} cursor-pointer hover:opacity-80 transition transform hover:scale-105 duration-200`}
               onClick={() => setShowProfileModal(true)}
             >
                <img src={currentUser.avatarUrl} alt="Me" className="w-full h-full object-cover" />
             </div>
             <div className="flex flex-col">
               <span className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                 Messenger
               </span>
               <div className="flex items-center gap-1">
                   <span className="text-[10px] text-gray-400">@{currentUser.username}</span>
                   <span className={`text-[9px] px-1.5 rounded-full font-bold ${getRoleStyle(currentUser.role).className}`}>
                       {getRoleStyle(currentUser.role).name}
                   </span>
                   {/* Current User VIP Indicator */}
                   {currentUser.modifiers?.includes('VIP') && <Star size={12} className="text-yellow-400 fill-current" />}
               </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {currentUser.role === 'ADMIN' && onOpenAdminPanel && (
               <button 
                 onClick={onOpenAdminPanel}
                 className="p-2 text-gray-400 hover:text-brand-400 hover:bg-white/10 rounded-full transition" 
                 title={t.adminPanel}
               >
                 <LayoutDashboard size={20} />
               </button>
            )}
             <button onClick={() => setShowCreateGroupModal(true)} className="p-2 text-gray-400 hover:text-brand-400 hover:bg-white/10 rounded-full transition" title={t.createGroup}>
              <Users size={20} />
            </button>
            <button onClick={() => setShowProfileModal(true)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition" title={t.settings}>
              <Settings size={20} />
            </button>
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-full transition" title={t.logout}>
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative group">
            <Search className={`absolute left-3 top-2.5 text-gray-400 group-focus-within:${activeTheme.text} transition duration-300`} size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder} 
              className={`w-full bg-dark-surface/50 backdrop-blur-sm rounded-xl pl-10 pr-4 py-2 border border-gray-600 focus:${activeTheme.border} focus:outline-none transition-all duration-300`}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
          {/* Ads Section - Show if not VIP */}
          {!isVip && currentAd && (
            <div 
                key={currentAd.id} 
                onClick={() => currentAd.link && window.open(currentAd.link, '_blank')}
                className={`mb-2 p-3 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/30 shadow-lg relative overflow-hidden group animate-fade-in ${currentAd.link ? 'cursor-pointer hover:opacity-90 transition' : ''}`}
            >
               <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg z-10">AD</div>
               <div className="flex gap-3">
                  <img src={currentAd.posterUrl} className="w-12 h-16 object-cover rounded-lg bg-gray-700 flex-shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                     <h3 className="font-bold text-yellow-500 text-sm truncate">{currentAd.name}</h3>
                     <p className="text-xs text-gray-400 line-clamp-2">{currentAd.text}</p>
                  </div>
               </div>
            </div>
          )}

          {conversations.map(conv => {
            const details = getConversationDetails(conv);
            const unread = conv.unreadCount[currentUser.id] || 0;
            const blocked = !details.isGroup && details.user && isBlocked(details.user.id);
            const isActive = activeConversation?.id === conv.id;
            
            return (
              <div 
                key={conv.id} 
                onClick={() => handleConversationSelect(conv)}
                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 mb-1 relative group
                  ${isActive ? `${activeTheme.lightBg} border ${activeTheme.border} shadow-lg` : 'hover:bg-white/5 border border-transparent'}
                  ${blocked ? 'opacity-50 grayscale' : ''}
                `}
              >
                <div className="relative">
                  <img src={details.avatarUrl} alt={details.name} className="w-12 h-12 rounded-full bg-gray-700 object-cover ring-2 ring-transparent group-hover:ring-white/10 transition" />
                  {!blocked && (
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-dark-panel rounded-full
                      ${details.status === 'online' ? 'bg-emerald-500' : details.status === 'busy' ? 'bg-rose-500' : details.isGroup ? 'bg-transparent' : 'bg-gray-500'}
                      shadow-sm
                    `}/>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-semibold truncate flex items-center gap-1 text-gray-200">
                      {details.name}
                      {!details.isGroup && details.user?.modifiers?.includes('VIP') && <Star size={12} className="text-yellow-400 fill-current" />}
                      {!details.isGroup && details.user?.isVerified && <CheckCircle size={12} className="text-blue-400" fill="currentColor" />}
                      {details.isGroup && <Users size={12} className="text-gray-400" />}
                    </h3>
                     {conv.lastMessageTimestamp > 0 && (
                        <span className="text-[10px] text-gray-500">
                            {new Date(conv.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                     )}
                  </div>
                  <p className={`text-xs text-gray-400 truncate ${currentUser.preferences?.privacyMode ? 'blur-[4px] hover:blur-none transition-all' : ''}`}>
                    {blocked ? (
                      <span className="text-red-400 italic">{t.blocked}</span>
                    ) : conv.messages.length ? (
                        <>
                           {conv.isGroup && <span className="text-gray-500 mr-1">{db.getUsers().find(u=>u.id === conv.messages[conv.messages.length-1].senderId)?.displayName.split(' ')[0]}:</span>}
                           {conv.messages[conv.messages.length - 1].type === 'image' ? t.image : 
                            (currentUser.preferences?.censorshipEnabled && conv.messages[conv.messages.length - 1].type === 'text' 
                                ? censorText(conv.messages[conv.messages.length - 1].content, currentUser.preferences.censorshipLevel || 'medium').substring(0, 30)
                                : conv.messages[conv.messages.length - 1].content.substring(0, 30))
                           }
                        </>
                    ) : (
                       <span className="text-gray-500 italic">{t.startChat}</span>
                    )}
                  </p>
                </div>
                {unread > 0 && (
                  <div className={`w-5 h-5 ${activeTheme.bg} rounded-full flex items-center justify-center text-[10px] font-bold shadow-md animate-bounce`}>
                    {unread}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Also show users not in convo yet if searching */}
          {searchQuery && sidebarUsers.map(user => {
               if (conversations.some(c => !c.isGroup && c.participants.includes(user.id))) return null;
               
               return (
                   <div 
                    key={user.id} 
                    onClick={() => handleUserSelect(user)}
                    className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 mb-1 relative group hover:bg-white/5 border border-transparent`}
                  >
                    <img src={user.avatarUrl} alt={user.username} className="w-12 h-12 rounded-full bg-gray-700 object-cover" />
                    <div className="flex-1 min-w-0">
                         <h3 className="font-semibold text-gray-200">{user.displayName}</h3>
                         <span className="text-xs text-gray-500">@{user.username}</span>
                    </div>
                  </div>
               )
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col min-w-0 relative transition-all duration-500"
        style={{ 
          background: currentUser.preferences?.wallpaper || WALLPAPERS[0].value, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center' 
        }}
      >
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center animate-fade-in relative z-10 backdrop-blur-sm bg-black/30">
             <div className="w-24 h-24 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-white/10 animate-pulse-slow">
               <span className={`text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400`}>4</span>
             </div>
             <h2 className="text-3xl font-bold text-white mb-2">{t.welcomeBack}</h2>
             <p className="max-w-md text-lg text-gray-400">{t.selectChat}</p>
             <button 
                className={`mt-8 md:hidden px-8 py-3 ${activeTheme.bg} hover:opacity-90 rounded-full text-white font-medium shadow-lg transition transform hover:scale-105`}
                onClick={() => setSidebarOpen(true)}
             >
               {t.startChat}
             </button>
          </div>
        ) : (
          <>
             {/* Conversation Details Helper */}
             {(() => {
                 const details = getConversationDetails(activeConversation);
                 const typingUsers = activeConversation.typingUsers?.filter(id => id !== currentUser.id) || [];
                 return (
                 <>
                    {/* Top Bar */}
                    <div className="h-16 px-6 border-b border-gray-700/50 flex justify-between items-center bg-dark-bg/80 backdrop-blur-lg sticky top-0 z-10 shadow-sm">
                      <div className="flex items-center gap-4">
                        <button className="md:hidden text-gray-400" onClick={() => setSidebarOpen(true)}>
                          <MoreVertical className="rotate-90" />
                        </button>
                        <div className="relative group cursor-pointer" onClick={() => details.isGroup && setShowGroupInfo(true)}>
                          <img 
                            src={details.avatarUrl} 
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent group-hover:ring-white/20 transition" 
                            alt="" 
                          />
                          {!details.isGroup && (
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-dark-bg rounded-full ${
                                details.status === 'online' ? 'bg-emerald-500' : details.status === 'busy' ? 'bg-rose-500' : 'bg-gray-500'
                            }`} />
                          )}
                        </div>
                        <div className={`cursor-pointer ${details.isGroup ? 'hover:opacity-80' : ''}`} onClick={() => details.isGroup && setShowGroupInfo(true)}>
                          <h3 className="font-bold flex items-center gap-2 text-white">
                            {details.name}
                            {!details.isGroup && details.user?.modifiers?.includes('VIP') && <Star size={14} className="text-yellow-400 fill-current" />}
                            {!details.isGroup && details.user?.isVerified && <CheckCircle size={14} className="text-blue-400" fill="currentColor" />}
                          </h3>
                          <div className="text-xs text-gray-400 flex items-center gap-1 min-h-[16px]">
                             {typingUsers.length > 0 ? (
                              <span className={`${activeTheme.text} font-semibold animate-pulse`}>
                                  {typingUsers.length > 1 ? `${typingUsers.length} people typing...` : t.typing}
                              </span>
                            ) : (
                               details.isGroup ? (
                                   <span>{details.status}</span>
                               ) : (
                                  details.status === 'online' ? <span className="text-emerald-400">{t.online}</span> : <span className="text-gray-500 capitalize">{details.status === 'busy' ? t.busy : t.offline}</span>
                               )
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`flex gap-3 ${activeTheme.text} items-center relative`}>
                        <button className="p-2.5 hover:bg-white/10 rounded-full transition duration-300"><Phone size={18} /></button>
                        <button className="p-2.5 hover:bg-white/10 rounded-full transition duration-300"><Video size={20} /></button>
                        <div className="relative" ref={chatMenuRef}>
                          <button onClick={() => setShowChatMenu(!showChatMenu)} className="p-2.5 hover:bg-white/10 rounded-full transition duration-300">
                            <MoreVertical size={20} />
                          </button>
                          {showChatMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-dark-panel border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in backdrop-blur-xl">
                              {details.isGroup ? (
                                   <button 
                                    onClick={() => { setShowGroupInfo(true); setShowChatMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 transition"
                                  >
                                     <Info size={16} className="text-gray-400" /><span className="text-gray-200">{t.groupInfo}</span>
                                  </button>
                              ) : (
                                  <button 
                                    onClick={handleToggleBlock}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 transition"
                                  >
                                     {details.user && isBlocked(details.user.id) ? (
                                       <><Check size={16} className="text-green-400" /><span className="text-green-400">{t.unblock}</span></>
                                     ) : (
                                       <><Ban size={16} className="text-red-400" /><span className="text-red-400">{t.block}</span></>
                                     )}
                                  </button>
                              )}
                              {/* System Admin Settings Access */}
                              {currentUser.role === 'ADMIN' && details.isGroup && (
                                   <button 
                                    onClick={() => { setShowGroupInfo(true); setShowChatMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 transition border-t border-gray-700"
                                  >
                                     <LayoutDashboard size={16} className="text-brand-400" /><span className="text-brand-400">Manage Group</span>
                                  </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                 </>
                 )
             })()}

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto p-6 relative z-0 custom-scrollbar ${currentDensity === 'compact' ? 'space-y-2' : 'space-y-4'}`}>
              {activeConversation.messages.map((msg, idx) => {
                if (msg.type === 'system') {
                    return (
                        <div key={msg.id} className="flex justify-center my-4 opacity-70">
                            <span className="text-xs bg-black/20 px-3 py-1 rounded-full text-gray-400 border border-white/5">{msg.content}</span>
                        </div>
                    )
                }
                const isMe = msg.senderId === currentUser.id;
                const isFirst = idx === 0 || activeConversation.messages[idx - 1].senderId !== msg.senderId;
                const sender = db.getUsers().find(u => u.id === msg.senderId);
                const bubbleRadius = currentUser.preferences?.bubbleStyle === 'modern' ? 'rounded-3xl' : 'rounded-2xl';
                const paddingClass = currentDensity === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2.5';
                
                // Censorship
                const displayContent = (msg.type === 'text' && currentUser.preferences?.censorshipEnabled && !isMe) 
                    ? censorText(msg.content, currentUser.preferences.censorshipLevel || 'medium') 
                    : msg.content;
                
                // Group Reactions
                const reactionGroups = (msg.reactions || []).reduce((acc, curr) => {
                    acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                // Find replied message
                const replyParent = msg.replyToId ? activeConversation.messages.find(m => m.id === msg.replyToId) : null;
                const replyParentUser = replyParent ? db.getUsers().find(u => u.id === replyParent.senderId) : null;

                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-message-pop group relative`}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    {!isMe && isFirst && activeConversation.isGroup && (
                        <div className="mr-2 flex flex-col justify-end">
                            <img src={sender?.avatarUrl} className="w-8 h-8 rounded-full bg-gray-700 mb-1" />
                        </div>
                    )}
                    <div className={`flex flex-col max-w-[80%] md:max-w-[60%] ${isMe ? 'items-end' : 'items-start'} relative`}>
                       {!isMe && isFirst && activeConversation.isGroup && (
                          <span className={`text-[10px] ml-2 mb-1 font-bold ${activeTheme.text}`}>{sender?.displayName || sender?.username}</span>
                       )}
                       {!isMe && isFirst && !activeConversation.isGroup && (
                          <span className="text-[10px] text-gray-300 ml-2 mb-1 opacity-75">{sender?.displayName || sender?.username}</span>
                       )}
                       
                       {/* Reply Context Bubble */}
                       {replyParent && (
                           <div className={`text-xs mb-1 px-3 py-1.5 rounded-lg border-l-2 bg-black/20 border-gray-400 text-gray-300 opacity-80 cursor-pointer hover:opacity-100 transition max-w-full truncate`}>
                               <span className="font-bold mr-1">{replyParentUser?.displayName || "User"}:</span>
                               {isMessagesHidden ? '******' : (replyParent.type === 'image' ? 'Image Attachment' : replyParent.content.substring(0, 40) + (replyParent.content.length > 40 ? '...' : ''))}
                           </div>
                       )}

                       <div className={`${paddingClass} ${getFontSizeClass(currentFontSize, 'msg')} leading-relaxed shadow-sm transition-all duration-300
                         ${bubbleRadius}
                         ${isMe 
                           ? `${activeTheme.bg} text-white ${currentUser.preferences?.bubbleStyle === 'modern' ? 'rounded-br-md' : 'rounded-br-none'} shadow-lg shadow-${activeTheme.bg}/10` 
                           : `bg-dark-surface/90 backdrop-blur-md text-gray-100 ${currentUser.preferences?.bubbleStyle === 'modern' ? 'rounded-bl-md' : 'rounded-bl-none'} border border-gray-700/50`
                         }
                         relative
                       `}>
                         {isMessagesHidden ? (
                             <span className="italic opacity-50 blur-[3px]">Content hidden by restriction</span>
                         ) : (
                             msg.type === 'image' ? (
                               <img 
                                  src={msg.content} 
                                  alt="attachment" 
                                  className="rounded-lg max-w-full border border-white/10 cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setLightboxImage(msg.content)} 
                               />
                             ) : (
                               displayContent
                             )
                         )}

                         {/* Reactions Display */}
                         {Object.keys(reactionGroups).length > 0 && (
                             <div className={`absolute -bottom-4 ${isMe ? 'right-0' : 'left-0'} flex gap-1 z-10`}>
                                 {Object.entries(reactionGroups).map(([emoji, count]) => (
                                     <div key={emoji} className="bg-dark-panel border border-gray-700 rounded-full px-1.5 py-0.5 text-[10px] flex items-center shadow-sm">
                                         <span>{emoji}</span>
                                         {(count as number) > 1 && <span className="ml-1 font-bold text-gray-400">{count as number}</span>}
                                     </div>
                                 ))}
                             </div>
                         )}
                       </div>
                       <span className="text-[10px] text-gray-400 mt-1 mx-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>

                       {/* Hover Action Menu */}
                       {hoveredMessageId === msg.id && !isChatDisabled && (
                           <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} bg-dark-panel border border-gray-700 rounded-full flex shadow-lg animate-scale-in z-20 overflow-hidden`}>
                               <button onClick={() => setReplyingTo(msg)} className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition" title="Reply">
                                   <Reply size={14} />
                               </button>
                               <div className="w-px bg-gray-700 h-full"></div>
                               <div className="flex px-1">
                                   {REACTION_EMOJIS.map(emoji => (
                                       <button 
                                          key={emoji} 
                                          onClick={() => handleReaction(msg.id, emoji)}
                                          className="p-1.5 hover:scale-125 transition transform"
                                       >
                                           {emoji}
                                       </button>
                                   ))}
                               </div>
                           </div>
                       )}
                    </div>
                  </div>
                );
              })}
              
              {(activeConversation.typingUsers?.filter(id => id !== currentUser.id).length || 0) > 0 && (
                 <div className="flex justify-start animate-fade-in mt-2">
                    <div className={`px-4 py-2.5 rounded-2xl bg-dark-surface/50 border border-gray-700/50 flex items-center gap-1.5`}>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-dark-bg/80 backdrop-blur-lg border-t border-gray-700/50 relative z-10">
              {getConversationDetails(activeConversation).user && isBlocked(getConversationDetails(activeConversation).user!.id) ? (
                <div className="flex flex-col items-center justify-center p-4 bg-red-900/10 rounded-xl border border-red-500/20 text-center animate-fade-in">
                  <p className="text-red-400 text-sm mb-2 font-medium">You have blocked this user.</p>
                  <button 
                    onClick={handleToggleBlock} 
                    className="text-xs text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-full transition shadow-lg shadow-red-500/20"
                  >
                    Unblock to send messages
                  </button>
                </div>
              ) : isChatDisabled ? (
                 <div className="flex flex-col items-center justify-center p-4 bg-red-900/10 rounded-xl border border-red-500/20 text-center animate-fade-in">
                    <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                        <Ban size={16} /> {t.cantChatPlaceholder}
                    </p>
                 </div>
              ) : isMutedInGroup ? (
                 <div className="flex flex-col items-center justify-center p-4 bg-red-900/10 rounded-xl border border-red-500/20 text-center animate-fade-in">
                    <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                        <MicOff size={16} /> {t.messageMuted}
                    </p>
                 </div>
              ) : (
                <div className="max-w-4xl mx-auto flex flex-col gap-2">
                  {/* Reply Banner */}
                  {replyingTo && (
                      <div className="flex items-center justify-between bg-dark-surface/50 border border-gray-700/50 rounded-lg px-4 py-2 text-sm animate-slide-up">
                          <div className="flex items-center gap-2 overflow-hidden">
                              <Reply size={14} className="text-brand-400" />
                              <span className="text-gray-400">Replying to <span className="text-white font-medium">{db.getUsers().find(u => u.id === replyingTo.senderId)?.displayName}:</span></span>
                              <span className="text-gray-500 truncate max-w-[200px]">{isMessagesHidden ? '***' : (replyingTo.type === 'image' ? 'Image' : replyingTo.content)}</span>
                          </div>
                          <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white">
                              <XCircle size={16} />
                          </button>
                      </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
                    <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       accept="image/*" 
                       onChange={handleImageUpload} 
                    />
                    <button 
                       type="button" 
                       onClick={() => fileInputRef.current?.click()}
                       className={`p-3 text-gray-400 hover:${activeTheme.text} bg-white/5 hover:bg-white/10 rounded-2xl border border-transparent transition-all duration-300 transform hover:scale-105`}
                    >
                      <ImageIcon size={22} />
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={handleInputChange}
                        placeholder={t.typeMessage}
                        className={`w-full bg-white/5 text-white placeholder-gray-500 border border-gray-700/50 focus:${activeTheme.border} focus:bg-white/10 rounded-2xl px-5 py-3.5 pr-14 focus:outline-none transition-all duration-300 shadow-inner`}
                      />
                      <button 
                        type="submit" 
                        disabled={!messageInput.trim()}
                        className={`absolute right-2 top-2 p-2 ${activeTheme.bg} text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:hover:opacity-50 transition shadow-lg transform hover:scale-105 active:scale-95`}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-dark-panel border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[80vh]">
               <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-dark-bg/50">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                      <Users size={20} className="text-brand-500" /> {t.createGroup}
                  </h3>
                  <button onClick={() => setShowCreateGroupModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                      <X size={20} />
                  </button>
               </div>
               <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                   <form onSubmit={handleCreateGroup}>
                       <div className="mb-4">
                           <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.groupName}</label>
                           <input 
                               type="text"
                               value={newGroupName}
                               onChange={e => setNewGroupName(e.target.value)}
                               className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none"
                               placeholder="My Cool Group"
                               required
                           />
                       </div>
                       
                       <div className="mb-4">
                           <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.selectMembers}</label>
                           
                           {/* User Search Input */}
                           <div className="relative mb-2">
                               <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                               <input 
                                   type="text"
                                   placeholder={t.addMemberDesc}
                                   value={userSearchTerm}
                                   onChange={e => setUserSearchTerm(e.target.value)}
                                   className="w-full bg-dark-bg border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-brand-500 outline-none"
                               />
                           </div>

                           <div className="max-h-48 overflow-y-auto custom-scrollbar border border-gray-700 rounded-lg bg-dark-bg p-2">
                               {getAvailableContacts().map(user => (
                                   <div key={user.id} onClick={() => {
                                       setSelectedGroupMembers(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]);
                                   }} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-white/5 ${selectedGroupMembers.includes(user.id) ? 'bg-brand-500/20' : ''}`}>
                                       <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedGroupMembers.includes(user.id) ? 'bg-brand-500 border-brand-500' : 'border-gray-500'}`}>
                                           {selectedGroupMembers.includes(user.id) && <Check size={12} />}
                                       </div>
                                       <img src={user.avatarUrl} className="w-8 h-8 rounded-full" />
                                       <div className="flex-1 min-w-0">
                                           <span className="text-sm font-medium block">{user.displayName}</span>
                                           <span className="text-xs text-gray-500 block">@{user.username}</span>
                                       </div>
                                   </div>
                               ))}
                               {getAvailableContacts().length === 0 && <p className="text-center text-gray-500 text-xs py-4">No users found</p>}
                           </div>
                       </div>
                       <button type="submit" disabled={!newGroupName || selectedGroupMembers.length === 0} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-xl font-medium transition shadow-lg disabled:opacity-50">
                           {t.createGroup}
                       </button>
                   </form>
               </div>
           </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && activeConversation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-dark-panel border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[80vh]">
               <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-dark-bg/50">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                      <UserPlus size={20} className="text-brand-500" /> {t.addMember}
                  </h3>
                  <button onClick={() => setShowAddMemberModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                      <X size={20} />
                  </button>
               </div>
               <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                   <form onSubmit={handleAddMembers}>
                       <div className="mb-4">
                           <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.selectMembers}</label>
                           
                           {/* User Search Input */}
                           <div className="relative mb-2">
                               <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                               <input 
                                   type="text"
                                   placeholder={t.addMemberDesc}
                                   value={userSearchTerm}
                                   onChange={e => setUserSearchTerm(e.target.value)}
                                   className="w-full bg-dark-bg border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-brand-500 outline-none"
                               />
                           </div>

                           <div className="max-h-64 overflow-y-auto custom-scrollbar border border-gray-700 rounded-lg bg-dark-bg p-2">
                               {getAvailableContacts()
                                   .filter(u => !activeConversation.participants.includes(u.id)) // Exclude already in group
                                   .map(user => (
                                   <div key={user.id} onClick={() => {
                                       setSelectedGroupMembers(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]);
                                   }} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-white/5 ${selectedGroupMembers.includes(user.id) ? 'bg-brand-500/20' : ''}`}>
                                       <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedGroupMembers.includes(user.id) ? 'bg-brand-500 border-brand-500' : 'border-gray-500'}`}>
                                           {selectedGroupMembers.includes(user.id) && <Check size={12} />}
                                       </div>
                                       <img src={user.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                                       <div className="flex-1 min-w-0">
                                           <span className="text-sm font-medium block">{user.displayName}</span>
                                           <span className="text-xs text-gray-500 block">@{user.username}</span>
                                       </div>
                                   </div>
                               ))}
                               {getAvailableContacts().filter(u => !activeConversation.participants.includes(u.id)).length === 0 && <p className="text-center text-gray-500 text-xs py-4">No users found</p>}
                           </div>
                       </div>
                       <button type="submit" disabled={selectedGroupMembers.length === 0} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-xl font-medium transition shadow-lg disabled:opacity-50">
                           {t.addMember}
                       </button>
                   </form>
               </div>
           </div>
        </div>
      )}

      {/* Group Info Modal */}
      {showGroupInfo && activeConversation && activeConversation.isGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-dark-panel border border-gray-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                   <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-dark-bg/50">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <Users size={20} className="text-brand-500" /> {t.groupInfo}
                      </h3>
                      <button onClick={() => setShowGroupInfo(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                          <X size={20} />
                      </button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                       {/* Group Header Edit */}
                       <div className="flex items-center gap-4 mb-6">
                           <div className="w-20 h-20 rounded-full bg-gray-700 overflow-hidden relative group">
                               <img src={activeConversation.avatarUrl} className="w-full h-full object-cover" />
                               {isGroupAdmin(activeConversation, currentUser.id) && (
                                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                       <Camera size={20} />
                                   </div>
                               )}
                           </div>
                           <div className="flex-1">
                               {isGroupAdmin(activeConversation, currentUser.id) ? (
                                   <input 
                                     type="text" 
                                     defaultValue={activeConversation.name}
                                     onBlur={(e) => handleUpdateGroup(e.target.value, activeConversation.avatarUrl || '')}
                                     className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-gray-600 focus:border-brand-500 focus:outline-none w-full"
                                   />
                               ) : (
                                   <h2 className="text-2xl font-bold">{activeConversation.name}</h2>
                               )}
                               <p className="text-gray-400 text-sm">{activeConversation.participants.length} {t.participants}</p>
                           </div>
                       </div>

                       {/* Invite Link Section */}
                        <div className="mb-6 p-4 bg-brand-900/10 border border-brand-500/20 rounded-xl">
                            <h4 className="text-xs font-bold text-brand-400 uppercase mb-2 flex items-center gap-2">
                                <Link size={12} /> Invite via Link
                            </h4>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-dark-bg border border-gray-600 rounded-lg p-2 text-xs text-gray-400 truncate font-mono">
                                    {window.location.href.split('?')[0].split('#')[0]}?group={activeConversation.id}
                                </div>
                                <button 
                                    onClick={handleCopyGroupInvite}
                                    className="bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 p-2 rounded-lg transition"
                                    title="Copy Link"
                                >
                                    {groupInviteLinkCopied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                       {/* Add Member Button */}
                       {isGroupAdmin(activeConversation, currentUser.id) && (
                           <button 
                               onClick={() => setShowAddMemberModal(true)}
                               className="w-full mb-4 py-2 bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 border border-brand-600/30 rounded-lg transition font-medium text-sm flex items-center justify-center gap-2"
                           >
                               <UserPlus size={16} /> {t.addMember}
                           </button>
                       )}

                       {/* Participants List */}
                       <div className="space-y-1">
                           <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{t.participants}</h4>
                           {activeConversation.participants.map(partId => {
                               const user = db.getUsers().find(u => u.id === partId);
                               const isAdmin = activeConversation.adminIds?.includes(partId);
                               const isMuted = activeConversation.mutedUsers && activeConversation.mutedUsers[partId] && (activeConversation.mutedUsers[partId] === -1 || activeConversation.mutedUsers[partId] > Date.now());
                               const canManage = isGroupAdmin(activeConversation, currentUser.id) && currentUser.id !== partId;

                               if (!user) return null;

                               return (
                                   <div key={partId} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 group">
                                       <div className="flex items-center gap-3">
                                           <img src={user.avatarUrl} className="w-10 h-10 rounded-full bg-gray-700" />
                                           <div>
                                               <div className="flex items-center gap-2">
                                                   <span className="font-medium text-gray-200">{user.displayName}</span>
                                                   {isAdmin && <Crown size={12} className="text-yellow-500 fill-current" />}
                                                   {isMuted && <MicOff size={12} className="text-red-400" />}
                                               </div>
                                               <span className="text-xs text-gray-500">
                                                   {partId === currentUser.id ? t.you : `@${user.username}`}
                                                   {isAdmin ? ` • ${t.admin}` : ''}
                                               </span>
                                           </div>
                                       </div>
                                       {canManage && (
                                           <div className="flex items-center gap-1">
                                               {!isAdmin && (
                                                   <button onClick={() => handlePromote(partId)} className="p-1.5 hover:bg-green-500/20 text-green-400 rounded" title={t.promoteAdmin}>
                                                       <Crown size={16} />
                                                   </button>
                                               )}
                                               <button onClick={() => handleMuteUser(partId, isMuted ? 0 : 60)} className={`p-1.5 hover:bg-yellow-500/20 rounded ${isMuted ? 'text-white' : 'text-yellow-400'}`} title={isMuted ? t.unmute : t.mute1h}>
                                                   {isMuted ? <Mic size={16} /> : <MicOff size={16} />}
                                               </button>
                                               <button onClick={() => handleKickUser(partId)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded" title={t.kick}>
                                                   <DoorOpen size={16} />
                                               </button>
                                           </div>
                                       )}
                                   </div>
                               )
                           })}
                       </div>
                   </div>

                   <div className="p-4 border-t border-gray-700 bg-dark-bg/50">
                       <button onClick={handleLeaveGroup} className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg transition font-medium text-sm flex items-center justify-center gap-2">
                           <LogOut size={16} /> {t.leaveGroup}
                       </button>
                   </div>
              </div>
          </div>
      )}

      {/* Profile/Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-dark-panel border border-gray-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-dark-bg/50">
                  <div className="flex gap-4">
                     <button onClick={() => setSettingsTab('account')} className={`text-sm font-bold uppercase pb-1 border-b-2 transition ${settingsTab === 'account' ? 'text-white border-brand-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>{t.account}</button>
                     <button onClick={() => setSettingsTab('appearance')} className={`text-sm font-bold uppercase pb-1 border-b-2 transition ${settingsTab === 'appearance' ? 'text-white border-brand-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>{t.appearance}</button>
                     <button onClick={() => setSettingsTab('privacy')} className={`text-sm font-bold uppercase pb-1 border-b-2 transition ${settingsTab === 'privacy' ? 'text-white border-brand-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>{t.privacy}</button>
                  </div>
                  <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                      <X size={20} />
                  </button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                  <form onSubmit={handleSaveSettings}>
                      {settingsTab === 'account' && (
                          <div className="space-y-4 animate-fade-in">
                              {/* Avatar */}
                              <div className="flex justify-center mb-6">
                                  <div className="relative group">
                                      <img src={newAvatarUrl} className="w-24 h-24 rounded-full object-cover border-4 border-dark-bg bg-gray-700" />
                                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                          <Camera size={24} />
                                      </div>
                                      <input 
                                          type="text" 
                                          value={newAvatarUrl}
                                          onChange={e => setNewAvatarUrl(e.target.value)}
                                          className="absolute inset-0 opacity-0 cursor-pointer"
                                          title="Paste Avatar URL"
                                      />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.visibleName}</label>
                                  <input 
                                      type="text" 
                                      value={newDisplayName}
                                      onChange={e => setNewDisplayName(e.target.value)}
                                      className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.password}</label>
                                  <input 
                                      type="password" 
                                      value={newPassword}
                                      onChange={e => setNewPassword(e.target.value)}
                                      className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.autoMessage}</label>
                                  <input 
                                      type="text" 
                                      value={newAutoMessage}
                                      onChange={e => setNewAutoMessage(e.target.value)}
                                      className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2.5 text-sm focus:border-brand-500 outline-none"
                                      placeholder={t.autoMessagePlaceholder}
                                  />
                                  <p className="text-[10px] text-gray-500 mt-1">{t.autoMessageDesc}</p>
                              </div>
                              <div className="pt-4 border-t border-gray-700">
                                  <button type="button" onClick={handleCopyLink} className="w-full py-2 bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 border border-brand-600/30 rounded-lg transition font-medium text-sm flex items-center justify-center gap-2">
                                      {profileLinkCopied ? <Check size={16} /> : <Link size={16} />} {profileLinkCopied ? t.copied : t.shareProfile}
                                  </button>
                                  <p className="text-[10px] text-gray-500 mt-1 text-center">{t.shareProfileDesc}</p>
                              </div>
                          </div>
                      )}

                      {settingsTab === 'appearance' && (
                          <div className="space-y-6 animate-fade-in">
                              {/* Theme Color */}
                              <div>
                                  <label className="text-xs text-gray-400 uppercase font-bold mb-2 block flex items-center gap-2">
                                      <Palette size={14} /> {t.accentColor}
                                  </label>
                                  <div className="flex gap-3">
                                      {Object.keys(THEME_COLORS).map(color => (
                                          <button
                                              key={color}
                                              type="button"
                                              onClick={() => setNewPreferences({...newPreferences, themeColor: color as any})}
                                              className={`w-8 h-8 rounded-full ${THEME_COLORS[color as keyof typeof THEME_COLORS].bg} transition transform hover:scale-110 ${newPreferences.themeColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-panel' : 'opacity-70 hover:opacity-100'}`}
                                          />
                                      ))}
                                  </div>
                              </div>

                              {/* Wallpaper */}
                              <div>
                                  <label className="text-xs text-gray-400 uppercase font-bold mb-2 block flex items-center gap-2">
                                      <ImageIcon size={14} /> {t.chatWallpaper}
                                  </label>
                                  <div className="grid grid-cols-3 gap-2 mb-2">
                                      {WALLPAPERS.map((wp, i) => (
                                          <div 
                                              key={i}
                                              onClick={() => { setNewPreferences({...newPreferences, wallpaper: wp.value}); setCustomWallpaper(''); }}
                                              className={`h-16 rounded-lg cursor-pointer border-2 transition relative overflow-hidden ${newPreferences.wallpaper === wp.value ? 'border-brand-500' : 'border-transparent hover:border-gray-500'}`}
                                              style={{ background: wp.value, backgroundSize: 'cover' }}
                                          >
                                              {newPreferences.wallpaper === wp.value && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Check size={20} className="text-white drop-shadow-md" /></div>}
                                          </div>
                                      ))}
                                  </div>
                                  <input 
                                      type="text" 
                                      placeholder="Custom Image URL" 
                                      value={customWallpaper}
                                      onChange={(e) => { setCustomWallpaper(e.target.value); setNewPreferences({...newPreferences, wallpaper: `url(${e.target.value})`}); }}
                                      className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-xs focus:border-brand-500 outline-none"
                                  />
                              </div>
                              
                              {/* Bubble Style */}
                              <div>
                                   <label className="text-xs text-gray-400 uppercase font-bold mb-2 block flex items-center gap-2">
                                      <Layout size={14} /> {t.bubbleStyle}
                                   </label>
                                   <div className="flex bg-dark-bg rounded-lg p-1 border border-gray-700">
                                       <button 
                                          type="button"
                                          onClick={() => setNewPreferences({...newPreferences, bubbleStyle: 'rounded'})}
                                          className={`flex-1 py-1.5 text-xs rounded-md transition ${newPreferences.bubbleStyle === 'rounded' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                       >
                                           {t.classic}
                                       </button>
                                       <button 
                                          type="button"
                                          onClick={() => setNewPreferences({...newPreferences, bubbleStyle: 'modern'})}
                                          className={`flex-1 py-1.5 text-xs rounded-md transition ${newPreferences.bubbleStyle === 'modern' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                       >
                                           {t.modern}
                                       </button>
                                   </div>
                              </div>
                              
                              {/* Font & Density */}
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                       <label className="text-xs text-gray-400 uppercase font-bold mb-2 block flex items-center gap-2">
                                          <Type size={14} /> {t.fontSize}
                                       </label>
                                       <select 
                                          value={newPreferences.fontSize} 
                                          onChange={(e) => setNewPreferences({...newPreferences, fontSize: e.target.value as any})}
                                          className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-xs focus:border-brand-500 outline-none text-white"
                                       >
                                           <option value="small">Small</option>
                                           <option value="medium">Medium</option>
                                           <option value="large">Large</option>
                                       </select>
                                  </div>
                                  <div>
                                       <label className="text-xs text-gray-400 uppercase font-bold mb-2 block flex items-center gap-2">
                                          <Layout size={14} /> {t.density}
                                       </label>
                                       <select 
                                          value={newPreferences.density} 
                                          onChange={(e) => setNewPreferences({...newPreferences, density: e.target.value as any})}
                                          className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-xs focus:border-brand-500 outline-none text-white"
                                       >
                                           <option value="compact">{t.compact}</option>
                                           <option value="comfortable">{t.comfortable}</option>
                                       </select>
                                  </div>
                              </div>
                          </div>
                      )}

                      {settingsTab === 'privacy' && (
                          <div className="space-y-6 animate-fade-in">
                              <div className="bg-white/5 rounded-lg p-4 border border-gray-700">
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="font-medium text-sm flex items-center gap-2">
                                          <EyeOff size={16} className="text-brand-400" /> {t.hidePreviews}
                                      </label>
                                      <div 
                                          onClick={() => setNewPreferences({...newPreferences, privacyMode: !newPreferences.privacyMode})}
                                          className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${newPreferences.privacyMode ? 'bg-brand-500' : 'bg-gray-600'}`}
                                      >
                                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${newPreferences.privacyMode ? 'left-6' : 'left-1'}`} />
                                      </div>
                                  </div>
                                  <p className="text-xs text-gray-400">{t.blurPreviews}</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-gray-700">
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="font-medium text-sm flex items-center gap-2">
                                          <Shield size={16} className="text-red-400" /> {t.aiCensorship}
                                      </label>
                                      <div 
                                          onClick={() => setNewPreferences({...newPreferences, censorshipEnabled: !newPreferences.censorshipEnabled})}
                                          className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${newPreferences.censorshipEnabled ? 'bg-brand-500' : 'bg-gray-600'}`}
                                      >
                                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${newPreferences.censorshipEnabled ? 'left-6' : 'left-1'}`} />
                                      </div>
                                  </div>
                                  <p className="text-xs text-gray-400 mb-3">{t.censorshipDesc}</p>
                                  
                                  {newPreferences.censorshipEnabled && (
                                      <div className="animate-fade-in">
                                          <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block">{t.censorshipLevel}</label>
                                          <select 
                                              value={newPreferences.censorshipLevel}
                                              onChange={(e) => setNewPreferences({...newPreferences, censorshipLevel: e.target.value as any})}
                                              className="w-full bg-dark-bg border border-gray-600 rounded-lg p-2 text-xs focus:border-brand-500 outline-none text-white"
                                          >
                                              <option value="low">{t.levelLow}</option>
                                              <option value="medium">{t.levelMedium}</option>
                                              <option value="max">{t.levelMax}</option>
                                          </select>
                                      </div>
                                  )}
                              </div>
                              
                              <div className="bg-white/5 rounded-lg p-4 border border-gray-700">
                                  <label className="text-xs text-gray-400 uppercase font-bold mb-1.5 block flex items-center gap-2">
                                      <Globe size={14} /> {t.language}
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                      {['en', 'ru', 'fr', 'es', 'zh'].map((lang) => (
                                          <button
                                              key={lang}
                                              type="button"
                                              onClick={() => setNewPreferences({...newPreferences, language: lang as any})}
                                              className={`py-2 px-3 rounded text-xs border transition ${newPreferences.language === lang ? 'bg-brand-500/20 border-brand-500 text-brand-400' : 'bg-dark-bg border-gray-600 text-gray-400 hover:border-gray-500'}`}
                                          >
                                              {lang === 'en' ? 'English' : lang === 'ru' ? 'Русский' : lang === 'fr' ? 'Français' : lang === 'es' ? 'Español' : '中文'}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}

                      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-700">
                          <button 
                             type="button" 
                             onClick={() => setShowProfileModal(false)}
                             className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
                          >
                              {t.cancel}
                          </button>
                          <button 
                             type="submit"
                             className="px-6 py-2 rounded-lg text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white transition shadow-lg"
                          >
                              {t.saveChanges}
                          </button>
                      </div>
                  </form>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Messenger;
