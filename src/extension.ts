import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { MetadataStore } from './metadataStore';
import { ConversationScanner } from './conversationScanner';
import { ChatTreeProvider } from './chatTreeProvider';
import { registerCommands } from './commands';

let refreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('[ChatOrganizer] Antigravity Chat Organizer activating...');

  const metadataStore = new MetadataStore();
  const scanner = new ConversationScanner(metadataStore);
  const treeProvider = new ChatTreeProvider(scanner, metadataStore);

  // Register TreeView
  const treeView = vscode.window.createTreeView('antigravity.chatOrganizerView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Register all commands
  registerCommands(context, treeProvider, metadataStore);

  // Setup file system watcher for real-time updates when new chats/turns happen
  const geminiDir = path.join(os.homedir(), '.gemini', 'antigravity-ide');
  const convosPattern = new vscode.RelativePattern(path.join(geminiDir, 'conversations'), '*.{db,pb}');
  const watcher = vscode.workspace.createFileSystemWatcher(convosPattern);

  const debounceRefresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      treeProvider.refresh();
    }, 1500);
  };

  watcher.onDidCreate(debounceRefresh);
  watcher.onDidChange(debounceRefresh);
  watcher.onDidDelete(debounceRefresh);
  context.subscriptions.push(watcher);

  console.log('[ChatOrganizer] Antigravity Chat Organizer activated successfully.');
}

export function deactivate(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
}
