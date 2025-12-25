import { User, Conversation, Message, Role, CountryBan, Ad } from '../types';
import { MOCK_USERS, DEFAULT_ROLES, MOCK_ADS, DEFAULT_PREFERENCES } from '../data/initialData';

// LocalStorage Keys
const STORAGE_KEYS = {
  USERS: '4messenger_users',
  CONVERSATIONS: '4messenger_conversations',
  ROLES: '4messenger_roles',
  COUNTRY_BANS: '4messenger_country_bans',
  CURRENT_USER: '4messenger_current_user',
  ADS: '4messenger_ads',
};

// Cookie Helpers
export const setAuthCookie = (username: string, password?: string) => {
  const d = new Date();
  d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
  const expires = "expires="+ d.toUTCString();
  const value = JSON.stringify({ username, password });
  document.cookie = "4messenger_auth=" + encodeURIComponent(value) + ";" + expires + ";path=/";
};

export const getAuthCookie = (): { username: string, password?: string } | null => {
  const name = "4messenger_auth=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      try {
        return JSON.parse(c.substring(name.length, c.length));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

export const deleteAuthCookie = () => {
  document.cookie = "4messenger_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};

export class Database {
  private users: User[] = [];
  private conversations: Conversation[] = [];
  private roles: Role[] = [];
  private countryBans: CountryBan[] = [];
  private ads: Ad[] = [];
  private isInitialized: boolean = false;
  private serverAvailable: boolean = true; // Assume true initially

  constructor() {}

  public get isOnline(): boolean {
      return this.serverAvailable;
  }

  // Wrapper for app startup
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.sync();

    // If no users exist (fresh start), seed data
    if (this.users.length === 0) {
        await this.seedData();
    }

    this.ensureSystemConsistency();
    this.isInitialized = true;
  }

  // Get current state as JSON for export
  exportData(): string {
      return JSON.stringify({
          users: this.users,
          conversations: this.conversations,
          roles: this.roles,
          ads: this.ads,
          countryBans: this.countryBans
      }, null, 2);
  }

  // Seed data from Mocks
  async seedData(): Promise<void> {
    this.users = MOCK_USERS;
    this.roles = DEFAULT_ROLES;
    this.ads = MOCK_ADS;
    this.countryBans = [];
    this.conversations = [];
    this.save(); // Save to both server and local
  }

  async sync(): Promise<void> {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
          
          const response = await fetch('/api/database', { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
              const data = await response.json();
              this.mergeData(data);
              this.serverAvailable = true;
              this.saveToLocalStorage(); // Sync server data to local backup
          } else {
              throw new Error("Server Error");
          }
      } catch (e) {
          console.warn("Server unreachable, using local storage:", e);
          this.serverAvailable = false;
          this.reloadFromLocalStorage();
      }
  }

  private mergeData(data: any) {
    if (!data) return;
    if (data.users) this.users = data.users;
    if (data.conversations) this.conversations = data.conversations;
    if (data.roles) this.roles = data.roles;
    if (data.countryBans) this.countryBans = data.countryBans;
    if (data.ads) this.ads = data.ads;
  }

  private ensureSystemConsistency() {
    DEFAULT_ROLES.forEach(defRole => {
      if (!this.roles.find(r => r.id === defRole.id)) {
        this.roles.push(defRole);
      }
    });

    // Ensure admin exists
    const admin = this.users.find(u => u.username === 'admin');
    if (!admin) {
         const defaultAdmin = MOCK_USERS.find(u => u.username === 'admin');
         if (defaultAdmin) this.users.push(defaultAdmin);
    }

    // Ensure AI bots exist
    const bots = MOCK_USERS.filter(u => u.role === 'AI');
    bots.forEach(bot => {
        if (!this.users.find(u => u.id === bot.id)) {
            this.users.push(bot);
        }
    });
  }

  reload() {
      // In a real app, we might force a fetch here, but for responsiveness we usually
      // read from memory or local storage unless explicitly syncing.
      // For this implementation, we re-sync with server if possible.
      this.sync();
  }
  
  private reloadFromLocalStorage() {
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (storedUsers) {
        this.users = JSON.parse(storedUsers);
        this.conversations = this.load(STORAGE_KEYS.CONVERSATIONS, []);
        this.roles = this.load(STORAGE_KEYS.ROLES, DEFAULT_ROLES);
        this.countryBans = this.load(STORAGE_KEYS.COUNTRY_BANS, []);
        this.ads = this.load(STORAGE_KEYS.ADS, MOCK_ADS);
    }
  }

  private load<T>(key: string, defaultData: T): T {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultData;
  }

  private saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(this.conversations));
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(this.roles));
    localStorage.setItem(STORAGE_KEYS.COUNTRY_BANS, JSON.stringify(this.countryBans));
    localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(this.ads));
  }

  private async save() {
    this.saveToLocalStorage();
    
    if (this.serverAvailable) {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: this.exportData()
            });
        } catch (e) {
            console.error("Failed to save to server", e);
            this.serverAvailable = false;
        }
    }
  }

  // --- Role Methods ---
  
  getRoles(): Role[] { return this.roles; }

  addRole(name: string, description: string, color: string): Role {
      const id = name.toUpperCase().replace(/\s+/g, '_');
      if (this.roles.find(r => r.id === id)) throw new Error("Role already exists");
      
      const newRole: Role = { id, name, description, color, isSystem: false };
      this.roles.push(newRole);
      this.save();
      return newRole;
  }

  deleteRole(roleId: string) {
      const role = this.roles.find(r => r.id === roleId);
      if (!role) throw new Error("Role not found");
      if (role.isSystem) throw new Error("Cannot delete system roles");

      this.users = this.users.map(u => u.role === roleId ? { ...u, role: 'USER' } : u);
      this.roles = this.roles.filter(r => r.id !== roleId);
      this.save();
  }

  // --- Ad Methods ---

  getAds(): Ad[] { return this.ads; }

  addAd(name: string, text: string, posterUrl: string, link?: string): Ad {
      const newAd: Ad = { id: `ad-${Date.now()}`, name, text, posterUrl, link };
      this.ads.push(newAd);
      this.save();
      return newAd;
  }

  deleteAd(adId: string) {
      this.ads = this.ads.filter(a => a.id !== adId);
      this.save();
  }

  // --- Country Ban Methods ---

  getCountryBans(): CountryBan[] { return this.countryBans; }

  addCountryBan(countryCode: string, type: 'FULL_CHAT' | 'ROLE_INTERACTION' | 'USERNAME', targetRoleId?: string, targetUserId?: string): CountryBan {
    const newBan: CountryBan = { id: `ban-${Date.now()}`, countryCode, type, targetRoleId, targetUserId };
    this.countryBans.push(newBan);
    this.save();
    return newBan;
  }

  deleteCountryBan(banId: string) {
    this.countryBans = this.countryBans.filter(b => b.id !== banId);
    this.save();
  }

  // --- User Methods ---

  getUser(userId: string): User | undefined {
      const user = this.users.find(u => u.id === userId);
      if (user && user.modifiers?.includes('ALWAYS_ONLINE')) {
          return { ...user, status: 'online' };
      }
      return user;
  }
  
  getUsers(): User[] {
    return this.users.map(u => {
        if (u.modifiers?.includes('ALWAYS_ONLINE')) return { ...u, status: 'online' };
        return u;
    });
  }
  
  getUserByUsername(username: string): User | undefined {
      return this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  login(username: string, password: string): User {
    // We don't force a reload here to keep UI snappy, but rely on periodic sync
    
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    const userIndex = this.users.findIndex(u => u.username.toLowerCase() === cleanUsername);
    
    if (userIndex === -1) throw new Error("User not found");
    const user = this.users[userIndex];

    if (user.password !== cleanPassword) {
      throw new Error("Invalid password");
    }
    
    if (user.isBanned || user.role === 'BANNED') {
      throw new Error("Account is banned");
    }

    // Update status
    user.status = 'online';
    user.lastSeen = Date.now();
    this.users[userIndex] = user;
    this.save();

    return user;
  }

  logout(userId: string) {
      const idx = this.users.findIndex(u => u.id === userId);
      if (idx !== -1) {
          this.users[idx].status = 'offline';
          this.users[idx].lastSeen = Date.now();
          this.save();
      }
  }

  register(username: string, password?: string, displayName?: string, country: string = 'US'): User {
      if (this.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
          throw new Error("Username already taken");
      }

      const newUser: User = {
          id: `user-${Date.now()}`,
          username: username,
          displayName: displayName || username,
          password: password,
          role: 'USER',
          avatarUrl: `https://picsum.photos/seed/${username}/200/200`,
          status: 'online',
          lastSeen: Date.now(),
          blockedUserIds: [],
          preferences: { ...DEFAULT_PREFERENCES },
          country,
          modifiers: []
      };

      this.users.push(newUser);
      this.save();
      return newUser;
  }

  createUser(form: any): User {
      if (this.users.find(u => u.username.toLowerCase() === form.username.toLowerCase())) {
          throw new Error("Username already exists");
      }
      
      const newUser: User = {
          id: `user-${Date.now()}`,
          username: form.username,
          displayName: form.displayName,
          password: form.password,
          role: form.role,
          avatarUrl: `https://picsum.photos/seed/${form.username}/200/200`,
          status: 'offline',
          lastSeen: Date.now(),
          blockedUserIds: [],
          preferences: { ...DEFAULT_PREFERENCES },
          country: form.country || 'US',
          modifiers: []
      };
      
      this.users.push(newUser);
      this.save();
      return newUser;
  }

  deleteUser(userId: string) {
      this.users = this.users.filter(u => u.id !== userId);
      this.conversations = this.conversations.filter(c => !c.participants.includes(userId));
      this.save();
  }

  updateProfile(userId: string, updates: Partial<User>): User {
      const idx = this.users.findIndex(u => u.id === userId);
      if (idx === -1) throw new Error("User not found");
      
      this.users[idx] = { ...this.users[idx], ...updates };
      this.save();
      return this.users[idx];
  }

  getStats() {
      return {
          totalUsers: this.users.length,
          totalConversations: this.conversations.length,
          totalMessages: this.conversations.reduce((acc, c) => acc + c.messages.length, 0),
          activeNow: this.users.filter(u => u.status === 'online').length
      };
  }

  // --- Conversation Methods ---

  getConversations(userId: string): Conversation[] {
      return this.conversations
          .filter(c => c.participants.includes(userId))
          .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
  }

  getConversation(userId1: string, userId2: string): Conversation {
      let conv = this.conversations.find(c => 
          !c.isGroup && 
          c.participants.includes(userId1) && 
          c.participants.includes(userId2)
      );

      if (!conv) {
          conv = {
              id: `conv-${Date.now()}`,
              participants: [userId1, userId2],
              messages: [],
              unreadCount: { [userId1]: 0, [userId2]: 0 },
              lastMessageTimestamp: 0,
              isGroup: false
          };
          this.conversations.push(conv);
          this.save();
      }
      return conv;
  }

  markAsRead(conversationId: string, userId: string) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
          conv.unreadCount[userId] = 0;
          this.save();
      }
  }

  addMessage(conversationId: string, senderId: string, content: string, type: 'text' | 'image' | 'system', replyToId?: string) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (!conv) throw new Error("Conversation not found");

      // Check restrictions
      const sender = this.getUser(senderId);
      if (sender?.modifiers?.includes('CANT_CHAT')) throw new Error("You are restricted from sending messages.");

      // Check Mute
      if (conv.isGroup && conv.mutedUsers && conv.mutedUsers[senderId]) {
          const muteExpiry = conv.mutedUsers[senderId];
          if (muteExpiry === -1 || muteExpiry > Date.now()) {
              throw new Error('messageMuted');
          }
      }

      // Geo Blocking Logic
      const senderCountry = sender?.country || 'US';
      const bans = this.countryBans.filter(b => b.countryCode === senderCountry);
      
      for (const ban of bans) {
          if (ban.type === 'FULL_CHAT') {
             throw new Error('chatRestrictedRegion');
          }
          if (ban.type === 'USERNAME' && ban.targetUserId === senderId) {
             throw new Error('userRestrictedRegion');
          }
          if (ban.type === 'ROLE_INTERACTION' && !conv.isGroup) {
              const otherId = conv.participants.find(p => p !== senderId);
              const otherUser = this.getUser(otherId || '');
              if (otherUser && otherUser.role === ban.targetRoleId) {
                  throw new Error('roleRestrictedRegion');
              }
          }
      }

      const newMessage: Message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          senderId,
          content,
          timestamp: Date.now(),
          type,
          reactions: [],
          replyToId
      };

      conv.messages.push(newMessage);
      conv.lastMessageTimestamp = newMessage.timestamp;
      
      // Update unread counts
      conv.participants.forEach(pId => {
          if (pId !== senderId) {
              conv.unreadCount[pId] = (conv.unreadCount[pId] || 0) + 1;
          }
      });

      this.save();
  }

  setTyping(conversationId: string, userId: string, isTyping: boolean) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (!conv) return;

      if (!conv.typingUsers) conv.typingUsers = [];

      if (isTyping) {
          if (!conv.typingUsers.includes(userId)) {
              conv.typingUsers.push(userId);
              this.save(); 
          }
      } else {
          if (conv.typingUsers.includes(userId)) {
              conv.typingUsers = conv.typingUsers.filter(id => id !== userId);
              this.save();
          }
      }
  }

  toggleReaction(conversationId: string, messageId: string, userId: string, emoji: string) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (!conv) return;

      const msg = conv.messages.find(m => m.id === messageId);
      if (!msg) return;

      if (!msg.reactions) msg.reactions = [];

      const existingIdx = msg.reactions.findIndex(r => r.userId === userId && r.emoji === emoji);
      if (existingIdx !== -1) {
          msg.reactions.splice(existingIdx, 1); // Remove
      } else {
          msg.reactions.push({ emoji, userId }); // Add
      }
      this.save();
  }

  // --- Group Methods ---

  createGroup(name: string, creatorId: string, memberIds: string[]): Conversation {
      const newGroup: Conversation = {
          id: `group-${Date.now()}`,
          name,
          participants: [creatorId, ...memberIds],
          messages: [{
              id: `sys-${Date.now()}`,
              senderId: 'system',
              content: `Group "${name}" created`,
              timestamp: Date.now(),
              type: 'system'
          }],
          unreadCount: {},
          lastMessageTimestamp: Date.now(),
          isGroup: true,
          adminIds: [creatorId],
          avatarUrl: `https://picsum.photos/seed/${name}/200/200`
      };
      
      newGroup.participants.forEach(p => newGroup.unreadCount[p] = 1);
      this.conversations.push(newGroup);
      this.save();
      return newGroup;
  }
  
  joinGroup(groupId: string, userId: string): Conversation {
      const group = this.conversations.find(c => c.id === groupId && c.isGroup);
      if (!group) throw new Error("Group not found");
      if (group.participants.includes(userId)) return group;

      group.participants.push(userId);
      group.messages.push({
           id: `sys-${Date.now()}`,
           senderId: 'system',
           content: `${this.getUser(userId)?.username} joined via link`,
           timestamp: Date.now(),
           type: 'system'
      });
      this.save();
      return group;
  }

  addMembersToGroup(groupId: string, adminId: string, newMemberIds: string[]) {
      const group = this.conversations.find(c => c.id === groupId);
      if (!group || !group.isGroup) throw new Error("Invalid group");
      if (!group.adminIds?.includes(adminId)) throw new Error("Only admins can add members");

      const adminUser = this.getUser(adminId);
      
      // Verify blockers
      const validMembers: string[] = [];
      for(const newId of newMemberIds) {
           const user = this.getUser(newId);
           if (user && user.blockedUserIds.includes(adminId)) {
               // Skip users who blocked the admin
               continue; 
           }
           if (!group.participants.includes(newId)) {
               validMembers.push(newId);
           }
      }

      if (validMembers.length === 0) throw new Error("No valid members to add");

      group.participants.push(...validMembers);
      group.messages.push({
          id: `sys-${Date.now()}`,
          senderId: 'system',
          content: `${adminUser?.displayName} added ${validMembers.length} members`,
          timestamp: Date.now(),
          type: 'system'
      });
      this.save();
  }

  leaveGroup(groupId: string, userId: string) {
      const group = this.conversations.find(c => c.id === groupId);
      if (!group) return;

      group.participants = group.participants.filter(p => p !== userId);
      group.adminIds = group.adminIds?.filter(p => p !== userId);
      
      group.messages.push({
          id: `sys-${Date.now()}`,
          senderId: 'system',
          content: `${this.getUser(userId)?.username} left the group`,
          timestamp: Date.now(),
          type: 'system'
      });

      if (group.participants.length === 0) {
          // Delete empty group
          this.conversations = this.conversations.filter(c => c.id !== groupId);
      }
      this.save();
  }

  kickUser(groupId: string, userId: string) {
      const group = this.conversations.find(c => c.id === groupId);
      if (!group) return;

      group.participants = group.participants.filter(p => p !== userId);
      group.adminIds = group.adminIds?.filter(p => p !== userId);
      
      group.messages.push({
          id: `sys-${Date.now()}`,
          senderId: 'system',
          content: `${this.getUser(userId)?.username} was kicked`,
          timestamp: Date.now(),
          type: 'system'
      });
      this.save();
  }

  promoteToAdmin(groupId: string, userId: string) {
      const group = this.conversations.find(c => c.id === groupId);
      if (!group) return;
      
      if (!group.adminIds) group.adminIds = [];
      if (!group.adminIds.includes(userId)) {
          group.adminIds.push(userId);
          group.messages.push({
              id: `sys-${Date.now()}`,
              senderId: 'system',
              content: `${this.getUser(userId)?.username} is now an admin`,
              timestamp: Date.now(),
              type: 'system'
          });
          this.save();
      }
  }

  muteUser(groupId: string, userId: string, durationMinutes: number) {
      const group = this.conversations.find(c => c.id === groupId);
      if (!group) return;

      if (!group.mutedUsers) group.mutedUsers = {};
      
      if (durationMinutes === 0) {
          delete group.mutedUsers[userId]; // Unmute
      } else if (durationMinutes === -1) {
          group.mutedUsers[userId] = -1; // Forever
      } else {
          group.mutedUsers[userId] = Date.now() + (durationMinutes * 60 * 1000);
      }
      this.save();
  }

  updateGroupSettings(groupId: string, name: string, avatarUrl: string) {
      const group = this.conversations.find(c => c.id === groupId);
      if (!group) return;

      if (group.name !== name || group.avatarUrl !== avatarUrl) {
          group.name = name;
          group.avatarUrl = avatarUrl;
           group.messages.push({
              id: `sys-${Date.now()}`,
              senderId: 'system',
              content: `Group settings updated`,
              timestamp: Date.now(),
              type: 'system'
          });
          this.save();
      }
  }

  toggleBlockUser(myUserId: string, targetUserId: string): User {
      const me = this.users.find(u => u.id === myUserId);
      if (!me) throw new Error("User not found");

      if (!me.blockedUserIds) me.blockedUserIds = [];

      if (me.blockedUserIds.includes(targetUserId)) {
          me.blockedUserIds = me.blockedUserIds.filter(id => id !== targetUserId);
      } else {
          me.blockedUserIds.push(targetUserId);
      }
      this.save();
      return me;
  }
}

export const db = new Database();