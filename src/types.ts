export interface ChatMetadata {
  customTitle?: string;
  isPinned?: boolean;
  folder?: string;
  tags?: string[];
  notes?: string;
}

export interface FolderConfig {
  name: string;
  emoji?: string;
  color?: string;
}

export interface OrganizerMetadata {
  version: number;
  folders: string[];
  folderConfigs?: Record<string, FolderConfig>;
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

export interface ArtifactItemInfo {
  id: string;
  conversationId: string;
  conversationTitle: string;
  fileName: string;
  filePath: string;
  type: 'plan' | 'walkthrough' | 'other';
  lastModified: number;
}

export interface DeepSearchResult {
  conversation: ConversationInfo;
  lineNumber: number;
  matchedText: string;
  contextSnippet: string;
}
