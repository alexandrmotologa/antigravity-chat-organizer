export interface ChatMetadata {
  customTitle?: string;
  isPinned?: boolean;
  folder?: string;
  tags?: string[];
  notes?: string;
}

export interface OrganizerMetadata {
  version: number;
  folders: string[];
  conversations: Record<string, ChatMetadata>;
}

export interface ConversationInfo {
  id: string;
  title: string;
  originalTitle: string;
  customTitle?: string;
  firstPrompt: string;
  lastModified: number;
  createdAt: number;
  messageCount: number;
  isPinned: boolean;
  folder?: string;
  tags: string[];
  notes?: string;
  workspacePath?: string;
  isScratch: boolean;
  hasTranscript: boolean;
}
