import * as vscode from 'vscode';
import { ConversationInfo } from './types';
import { ConversationScanner } from './conversationScanner';
import { MetadataStore } from './metadataStore';

export type TreeItemType = 'category' | 'folder' | 'chat';

export class ChatTreeItem extends vscode.TreeItem {
  public conversation?: ConversationInfo;
  public folderName?: string;
  public categoryType?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    type: TreeItemType,
    conversation?: ConversationInfo,
    folderName?: string,
    categoryType?: string
  ) {
    super(label, collapsibleState);
    this.conversation = conversation;
    this.folderName = folderName;
    this.categoryType = categoryType;

    if (type === 'chat' && conversation) {
      this.contextValue = 'chatItem';
      this.id = conversation.id;
      
      const dateStr = this.formatDate(conversation.lastModified);
      const scratchLabel = conversation.isScratch ? ' [Scratch]' : '';
      const notesIndicator = conversation.notes ? ' 📝' : '';
      this.description = `${dateStr}${scratchLabel}${notesIndicator}`;

      const tooltipLines = [
        `Title: ${conversation.title}`,
        conversation.customTitle ? `Original: ${conversation.originalTitle}` : '',
        `Last Active: ${new Date(conversation.lastModified).toLocaleString()}`,
        `Messages: ${conversation.messageCount}`,
        `Workspace: ${conversation.workspacePath || 'None'}`,
        conversation.folder ? `Folder: ${conversation.folder}` : '',
        conversation.notes ? `\nNote: ${conversation.notes}` : '',
        `\nFirst Prompt:\n${conversation.firstPrompt.substring(0, 300)}...`
      ].filter(Boolean);

      this.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'));

      if (conversation.isPinned) {
        this.iconPath = new vscode.ThemeIcon('pin', new vscode.ThemeColor('charts.yellow'));
      } else if (conversation.isScratch) {
        this.iconPath = new vscode.ThemeIcon('terminal');
      } else {
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
      }

      this.command = {
        command: 'antigravityChatOrganizer.focusChat',
        title: 'Open in Cascade',
        arguments: [conversation.id]
      };
    } else if (type === 'folder') {
      this.contextValue = 'folderItem';
      this.iconPath = new vscode.ThemeIcon('folder');
    } else if (type === 'category') {
      this.contextValue = 'categoryItem';
    }
  }

  private formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[d.getDay()];
    }

    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

export class ChatTreeProvider implements vscode.TreeDataProvider<ChatTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ChatTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ChatTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ChatTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private scanner: ConversationScanner;
  private metadataStore: MetadataStore;
  private cachedChats: ConversationInfo[] = [];

  constructor(scanner: ConversationScanner, metadataStore: MetadataStore) {
    this.scanner = scanner;
    this.metadataStore = metadataStore;
  }

  public refresh(): void {
    this.cachedChats = this.scanner.scanAll();
    this._onDidChangeTreeData.fire();
  }

  public getChats(): ConversationInfo[] {
    if (this.cachedChats.length === 0) {
      this.cachedChats = this.scanner.scanAll();
    }
    return this.cachedChats;
  }

  getTreeItem(element: ChatTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ChatTreeItem): Promise<ChatTreeItem[]> {
    if (this.cachedChats.length === 0) {
      this.cachedChats = this.scanner.scanAll();
    }

    const chats = this.cachedChats;
    const folders = this.metadataStore.getFolders();

    // Root level
    if (!element) {
      const items: ChatTreeItem[] = [];

      // 1. Pinned Chats category (if any)
      const pinnedChats = chats.filter(c => c.isPinned);
      if (pinnedChats.length > 0) {
        const pinnedItem = new ChatTreeItem(
          `📌 Pinned Chats`,
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          undefined,
          undefined,
          'pinned'
        );
        pinnedItem.description = `(${pinnedChats.length})`;
        items.push(pinnedItem);
      }

      // 2. Folders
      for (const f of folders) {
        const count = chats.filter(c => c.folder === f).length;
        const folderItem = new ChatTreeItem(
          `📁 ${f}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'folder',
          undefined,
          f
        );
        folderItem.description = `(${count})`;
        items.push(folderItem);
      }

      // 3. Uncategorized / Recent Chats
      const uncategorized = chats.filter(c => !c.folder);
      const recentItem = new ChatTreeItem(
        `💬 Recent / All Chats`,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        undefined,
        'recent'
      );
      recentItem.description = `(${uncategorized.length})`;
      items.push(recentItem);

      return items;
    }

    // Children of Pinned
    if (element.categoryType === 'pinned') {
      return chats
        .filter(c => c.isPinned)
        .map(c => new ChatTreeItem(c.title, vscode.TreeItemCollapsibleState.None, 'chat', c));
    }

    // Children of a specific Folder
    if (element.folderName) {
      return chats
        .filter(c => c.folder === element.folderName)
        .map(c => new ChatTreeItem(c.title, vscode.TreeItemCollapsibleState.None, 'chat', c));
    }

    // Children of Recent / All Chats
    if (element.categoryType === 'recent') {
      return chats
        .filter(c => !c.folder)
        .map(c => new ChatTreeItem(c.title, vscode.TreeItemCollapsibleState.None, 'chat', c));
    }

    return [];
  }
}
