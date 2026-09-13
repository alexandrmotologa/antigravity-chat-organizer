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
    categoryType?: string,
    customId?: string
  ) {
    super(label, collapsibleState);
    this.conversation = conversation;
    this.folderName = folderName;
    this.categoryType = categoryType;

    if (customId) {
      this.id = customId;
    }

    if (type === 'chat' && conversation) {
      this.contextValue = 'chatItem';
      if (!this.id) {
        this.id = conversation.id;
      }
      
      const dateStr = this.formatDate(conversation.lastModified);
      const scratchLabel = conversation.isScratch ? ' [Scratch]' : '';
      const notesIndicator = conversation.notes ? ' 📝' : '';
      const hasCustomTitle = !!(conversation.customTitle && conversation.customTitle.trim() !== conversation.originalTitle.trim());
      const origSnippet = hasCustomTitle ? ` [Orig: ${conversation.originalTitle}]` : '';
      this.description = `${dateStr}${origSnippet}${scratchLabel}${notesIndicator}`;

      const tooltipLines = [
        hasCustomTitle ? `Title (Custom): ${conversation.title}` : `Title: ${conversation.title}`,
        hasCustomTitle ? `Original Title: ${conversation.originalTitle}` : '',
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

export class ChatDragAndDropController implements vscode.TreeDragAndDropController<ChatTreeItem> {
  dropMimeTypes = ['application/vnd.code.tree.antigravityChatOrganizer'];
  dragMimeTypes = ['application/vnd.code.tree.antigravityChatOrganizer'];

  private metadataStore: MetadataStore;
  private treeProvider: ChatTreeProvider;

  constructor(metadataStore: MetadataStore, treeProvider: ChatTreeProvider) {
    this.metadataStore = metadataStore;
    this.treeProvider = treeProvider;
  }

  handleDrag(source: readonly ChatTreeItem[], treeDataTransfer: vscode.DataTransfer): void {
    const chatIds = source.filter(s => s.conversation).map(s => s.conversation!.id);
    if (chatIds.length > 0) {
      treeDataTransfer.set(
        'application/vnd.code.tree.antigravityChatOrganizer',
        new vscode.DataTransferItem(chatIds)
      );
    }
  }

  handleDrop(target: ChatTreeItem | undefined, sources: vscode.DataTransfer): void {
    const transferItem = sources.get('application/vnd.code.tree.antigravityChatOrganizer');
    if (!transferItem) return;

    const chatIds = transferItem.value as string[];
    let targetFolder: string | undefined = undefined;

    if (target?.folderName) {
      targetFolder = target.folderName;
    }

    for (const id of chatIds) {
      this.metadataStore.setFolder(id, targetFolder);
    }

    this.treeProvider.refresh();
    const folderName = targetFolder ? `"${targetFolder}"` : 'Uncategorized';
    vscode.window.showInformationMessage(`Moved ${chatIds.length} chat(s) to ${folderName}`);
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

  private filterByWorkspace(chats: ConversationInfo[]): ConversationInfo[] {
    if (!this.metadataStore.isWorkspaceFilterActive()) {
      return chats;
    }

    const workspaces = vscode.workspace.workspaceFolders;
    if (!workspaces || workspaces.length === 0) {
      return chats;
    }

    const currentPaths = workspaces.map(w => w.uri.fsPath.toLowerCase().replace(/\\/g, '/'));
    const folderNames = workspaces.map(w => w.name.toLowerCase());

    return chats.filter(c => {
      if (!c.workspacePath) return false;
      const cWs = c.workspacePath.toLowerCase().replace(/\\/g, '/');
      return (
        currentPaths.some(cp => cWs.includes(cp) || cp.includes(cWs)) ||
        folderNames.some(fn => cWs.includes(fn) || c.title.toLowerCase().includes(fn))
      );
    });
  }

  getTreeItem(element: ChatTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ChatTreeItem): Promise<ChatTreeItem[]> {
    if (this.cachedChats.length === 0) {
      this.cachedChats = this.scanner.scanAll();
    }

    const allChats = this.cachedChats;
    const chats = this.filterByWorkspace(allChats);
    const folders = this.metadataStore.getFolders();
    const isFiltered = this.metadataStore.isWorkspaceFilterActive();

    // Root level
    if (!element) {
      const items: ChatTreeItem[] = [];

      // Filter status indicator if active
      if (isFiltered) {
        const filterStatusItem = new ChatTreeItem(
          `🔍 Filter: Current Workspace (${chats.length}/${allChats.length})`,
          vscode.TreeItemCollapsibleState.None,
          'category',
          undefined,
          undefined,
          'filter-banner',
          'cat_filter'
        );
        filterStatusItem.iconPath = new vscode.ThemeIcon('filter');
        filterStatusItem.command = {
          command: 'antigravityChatOrganizer.toggleWorkspaceFilter',
          title: 'Toggle Filter'
        };
        items.push(filterStatusItem);
      }

      // 1. Pinned Chats category (if any)
      const pinnedChats = chats.filter(c => c.isPinned);
      if (pinnedChats.length > 0) {
        const pinnedItem = new ChatTreeItem(
          `📌 Pinned Chats`,
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          undefined,
          undefined,
          'pinned',
          'cat_pinned'
        );
        pinnedItem.description = `(${pinnedChats.length})`;
        items.push(pinnedItem);
      }

      // 2. Folders
      for (const f of folders) {
        const count = chats.filter(c => c.folder === f).length;
        const emoji = this.metadataStore.getFolderEmoji(f);
        const folderLabel = emoji ? `${emoji} ${f}` : `📁 ${f}`;
        const folderItem = new ChatTreeItem(
          folderLabel,
          vscode.TreeItemCollapsibleState.Collapsed,
          'folder',
          undefined,
          f,
          undefined,
          `cat_folder_${f}`
        );
        folderItem.description = `(${count})`;
        items.push(folderItem);
      }

      // 3. Uncategorized / Recent Chats (exclude pinned to avoid duplicate IDs)
      const uncategorized = pinnedChats.length > 0
        ? chats.filter(c => !c.folder && !c.isPinned)
        : chats.filter(c => !c.folder);

      const recentLabel = pinnedChats.length > 0 ? `💬 Other / Recent Chats` : `💬 Recent / All Chats`;
      const recentItem = new ChatTreeItem(
        recentLabel,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        undefined,
        'recent',
        'cat_recent'
      );
      recentItem.description = `(${uncategorized.length})`;
      items.push(recentItem);

      return items;
    }

    // Children of Pinned
    if (element.categoryType === 'pinned') {
      return chats
        .filter(c => c.isPinned)
        .map(c => new ChatTreeItem(c.title, vscode.TreeItemCollapsibleState.None, 'chat', c, undefined, undefined, `pin_${c.id}`));
    }

    // Children of a specific Folder
    if (element.folderName) {
      return chats
        .filter(c => c.folder === element.folderName)
        .map(c => new ChatTreeItem(c.title, vscode.TreeItemCollapsibleState.None, 'chat', c, element.folderName, undefined, `folder_${element.folderName}_${c.id}`));
    }

    // Children of Recent / All Chats
    if (element.categoryType === 'recent') {
      const pinnedCount = chats.filter(c => c.isPinned).length;
      const targetChats = pinnedCount > 0
        ? chats.filter(c => !c.folder && !c.isPinned)
        : chats.filter(c => !c.folder);

      return targetChats
        .map(c => new ChatTreeItem(c.title, vscode.TreeItemCollapsibleState.None, 'chat', c, undefined, undefined, `rec_${c.id}`));
    }

    return [];
  }
}
