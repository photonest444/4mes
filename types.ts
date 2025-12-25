
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface Role {
  id: string;
  name: string;
  description: string;
  color: string; // Tailwind color class or hex
  isSystem?: boolean; // Cannot be deleted
}

export type Language = 'en' | 'ru' | 'fr' | 'es' | 'zh';

export interface UserPreferences {
  themeColor: 'blue' | 'purple' | 'emerald' | 'rose' | 'amber';
  wallpaper: string; // CSS background value
  bubbleStyle: 'rounded' | 'modern';
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable';
  privacyMode: boolean; // Blurs sidebar message previews
  language: Language;
  censorshipEnabled?: boolean;
  censorshipLevel?: 'low' | 'medium' | 'max';
}

export interface User {
  id: string;
  username: string; // Unique identifier used for login/search
  displayName: string; // Visible name shown in UI
  password?: string;
  role: string; // References Role.id
  avatarUrl: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: number;
  blockedUserIds: string[]; // List of IDs this user has blocked
  preferences: UserPreferences;
  isBanned?: boolean;
  isVerified?: boolean;
  country: string; // ISO 2-letter country code (e.g., 'US', 'GB')
  autoMessage?: string; // Message sent automatically when a chat is created
  modifiers?: string[]; // Special flags like 'ALWAYS_ONLINE', 'VIP'
}

export interface Ad {
  id: string;
  name: string;
  text: string;
  posterUrl: string;
  link?: string;
}

export interface CountryBan {
  id: string;
  countryCode: string;
  type: 'FULL_CHAT' | 'ROLE_INTERACTION' | 'USERNAME';
  targetRoleId?: string; // Only required if type is ROLE_INTERACTION
  targetUserId?: string; // Only required if type is USERNAME
}

export interface Reaction {
  emoji: string;
  userId: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'system';
  reactions?: Reaction[];
  replyToId?: string;
}

export interface Conversation {
  id: string;
  participants: string[]; // User IDs
  messages: Message[];
  unreadCount: Record<string, number>; // UserId -> count
  lastMessageTimestamp: number;
  isGroup: boolean;
  name?: string;
  avatarUrl?: string; // Group Avatar
  adminIds?: string[]; // IDs of group admins
  mutedUsers?: Record<string, number>; // UserId -> Timestamp (epoch) or -1 (forever)
  typingUsers?: string[]; // List of User IDs currently typing
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface SyncPayload {
  type: 'FULL_SYNC' | 'UPDATE';
  data: {
    users?: User[];
    conversations?: Conversation[];
    roles?: Role[];
    countryBans?: CountryBan[];
    ads?: Ad[];
  };
  timestamp: number;
}
