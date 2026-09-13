import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ChatMetadata, OrganizerMetadata, FolderConfig } from './types';

export class MetadataStore {
  private filePath: string;
  private metadata: OrganizerMetadata;
  private workspaceFilterActive = false;

  constructor() {
    const geminiDir = path.join(os.homedir(), '.gemini', 'antigravity-ide');
    if (fs.existsSync(geminiDir)) {
      this.filePath = path.join(geminiDir, 'chat_organizer_metadata.json');
    } else {
      this.filePath = path.join(os.homedir(), '.chat_organizer_metadata.json');
    }
    this.metadata = this.load();
  }

  private load(): OrganizerMetadata {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        return {
          version: data.version || 2,
          folders: Array.isArray(data.folders) ? data.folders : [],
          folderConfigs: data.folderConfigs || {},
          conversations: data.conversations || {}
        };
      }
    } catch (e) {
      console.error('[ChatOrganizer] Error loading metadata:', e);
    }
    return {
      version: 2,
      folders: [],
      folderConfigs: {},
      conversations: {}
    };
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.metadata, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ChatOrganizer] Error saving metadata:', e);
    }
  }

  public getChatMetadata(id: string): ChatMetadata {
    return this.metadata.conversations[id] || {};
  }

  public setCustomTitle(id: string, title?: string): void {
    if (!this.metadata.conversations[id]) {
      this.metadata.conversations[id] = {};
    }
    if (title && title.trim().length > 0) {
      this.metadata.conversations[id].customTitle = title.trim();
    } else {
      delete this.metadata.conversations[id].customTitle;
    }
    this.save();
  }

  public togglePin(id: string): boolean {
    if (!this.metadata.conversations[id]) {
      this.metadata.conversations[id] = {};
    }
    const current = !!this.metadata.conversations[id].isPinned;
    this.metadata.conversations[id].isPinned = !current;
    this.save();
    return !current;
  }

  public setFolder(id: string, folder?: string): void {
    if (!this.metadata.conversations[id]) {
      this.metadata.conversations[id] = {};
    }
    if (folder && folder.trim().length > 0) {
      this.metadata.conversations[id].folder = folder.trim();
      this.addFolder(folder.trim());
    } else {
      delete this.metadata.conversations[id].folder;
    }
    this.save();
  }

  public setNotes(id: string, notes?: string): void {
    if (!this.metadata.conversations[id]) {
      this.metadata.conversations[id] = {};
    }
    if (notes && notes.trim().length > 0) {
      this.metadata.conversations[id].notes = notes.trim();
    } else {
      delete this.metadata.conversations[id].notes;
    }
    this.save();
  }

  public getFolders(): string[] {
    return this.metadata.folders;
  }

  public addFolder(name: string, emoji?: string): void {
    const trimmed = name.trim();
    if (trimmed && !this.metadata.folders.includes(trimmed)) {
      this.metadata.folders.push(trimmed);
      this.metadata.folders.sort((a, b) => a.localeCompare(b));
    }
    if (!this.metadata.folderConfigs) {
      this.metadata.folderConfigs = {};
    }
    if (emoji) {
      this.metadata.folderConfigs[trimmed] = { name: trimmed, emoji };
    }
    this.save();
  }

  public setFolderEmoji(folder: string, emoji?: string): void {
    if (!this.metadata.folderConfigs) {
      this.metadata.folderConfigs = {};
    }
    if (emoji && emoji.trim()) {
      this.metadata.folderConfigs[folder] = { name: folder, emoji: emoji.trim() };
    } else {
      delete this.metadata.folderConfigs[folder];
    }
    this.save();
  }

  public getFolderEmoji(folder: string): string {
    return this.metadata.folderConfigs?.[folder]?.emoji || '';
  }

  public deleteFolder(name: string): void {
    this.metadata.folders = this.metadata.folders.filter(f => f !== name);
    if (this.metadata.folderConfigs) {
      delete this.metadata.folderConfigs[name];
    }
    for (const id in this.metadata.conversations) {
      if (this.metadata.conversations[id].folder === name) {
        delete this.metadata.conversations[id].folder;
      }
    }
    this.save();
  }

  public isWorkspaceFilterActive(): boolean {
    return this.workspaceFilterActive;
  }

  public toggleWorkspaceFilter(): boolean {
    this.workspaceFilterActive = !this.workspaceFilterActive;
    return this.workspaceFilterActive;
  }
}
