import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ChatTreeItem, ChatTreeProvider } from './chatTreeProvider';
import { MetadataStore } from './metadataStore';
import { ConversationInfo } from './types';
import { DeepSearchEngine } from './deepSearch';
import { MarkdownExporter } from './markdownExporter';
import { ArtifactsProvider } from './artifactsProvider';

export function registerCommands(
  context: vscode.ExtensionContext,
  treeProvider: ChatTreeProvider,
  metadataStore: MetadataStore,
  artifactsProvider?: ArtifactsProvider
): void {
  const deepSearchEngine = new DeepSearchEngine();
  const markdownExporter = new MarkdownExporter();

  // 1. Focus / Open Chat in Cascade
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.focusChat', async (chatId?: string | ChatTreeItem) => {
      let id: string | undefined;
      let convo: ConversationInfo | undefined;

      if (typeof chatId === 'string') {
        id = chatId;
        convo = treeProvider.getChats().find(c => c.id === id);
      } else if (chatId instanceof ChatTreeItem && chatId.conversation) {
        id = chatId.conversation.id;
        convo = chatId.conversation;
      }

      if (!id) {
        vscode.window.showErrorMessage('No conversation ID provided.');
        return;
      }

      // Copy the original/searchable title so the user can paste it directly into Past Conversations
      const searchTitle = convo ? (convo.originalTitle || convo.title) : id;
      await vscode.env.clipboard.writeText(searchTitle);

      // Open Cascade chat panel in the sidebar so the user can continue talking with the agent
      try {
        await vscode.commands.executeCommand('antigravity.openAgent');
      } catch {
        try {
          await vscode.commands.executeCommand('antigravity.openChatView');
        } catch {
          // Fallback ignore
        }
      }

      const shortTitle = convo ? convo.title : id.substring(0, 8);
      vscode.window.setStatusBarMessage(`📋 Copied title "${searchTitle}" to clipboard for Past Conversations search`, 5000);

      // Check if this conversation belongs to an external workspace folder
      const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const hasWorkspace = convo?.workspacePath && 
        convo.workspacePath !== 'Scratch / Unassigned' && 
        convo.workspacePath !== 'General / Direct Chat' &&
        fs.existsSync(convo.workspacePath);

      const isDifferentWorkspace = hasWorkspace && (
        !currentWorkspace ||
        path.normalize(currentWorkspace).toLowerCase() !== path.normalize(convo!.workspacePath!).toLowerCase()
      );

      const actions: string[] = ['📄 View Transcript', '🆔 Copy ID'];
      if (isDifferentWorkspace) {
        actions.unshift('📁 Open Workspace');
      }

      const message = isDifferentWorkspace
        ? `Selected "${shortTitle}". Created in workspace: ${path.basename(convo!.workspacePath!)}.`
        : `Selected "${shortTitle}". Title copied to clipboard — in Cascade, click 🕒 Past Conversations and press Ctrl+V to jump to this chat!`;

      const choice = await vscode.window.showInformationMessage(message, ...actions);

      if (choice === '📁 Open Workspace' && convo) {
        await vscode.commands.executeCommand('antigravityChatOrganizer.openWorkspace', convo);
      } else if (choice === '📄 View Transcript' && convo) {
        await markdownExporter.openChat(convo);
      } else if (choice === '🆔 Copy ID' && convo) {
        await vscode.commands.executeCommand('antigravityChatOrganizer.copyChatId', convo);
      }
    })
  );

  // 1b. Open Associated Workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.openWorkspace', async (item?: ChatTreeItem | ConversationInfo) => {
      let convo: ConversationInfo | undefined;
      if (item instanceof ChatTreeItem) {
        convo = item.conversation;
      } else if (item && 'id' in item) {
        convo = item;
      }

      if (!convo || !convo.workspacePath || convo.workspacePath === 'Scratch / Unassigned' || convo.workspacePath === 'General / Direct Chat') {
        vscode.window.showInformationMessage('This conversation is not linked to a specific workspace directory.');
        return;
      }

      if (!fs.existsSync(convo.workspacePath)) {
        vscode.window.showWarningMessage(`Workspace path does not exist on disk: ${convo.workspacePath}`);
        return;
      }

      try {
        await vscode.commands.executeCommand('antigravity.openConversationWorkspaceQuickPick', {
          cascadeId: convo.id,
          workspaceUris: [vscode.Uri.file(convo.workspacePath).toString()]
        });
      } catch {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(convo.workspacePath), { forceNewWindow: true });
      }
    })
  );

  // 1d. View Transcript as Markdown (explicit user action only)
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.viewMarkdown', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;
      await markdownExporter.openChat(convo);
    })
  );

  // 2. Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.refresh', () => {
      treeProvider.refresh();
      if (artifactsProvider) {
        artifactsProvider.refresh();
      }
    })
  );

  // 3. Toggle Workspace Filter
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.toggleWorkspaceFilter', () => {
      const active = metadataStore.toggleWorkspaceFilter();
      treeProvider.refresh();
      vscode.window.showInformationMessage(
        active
          ? '🔍 Filter active: Showing only chats for current project workspace.'
          : '🌐 Filter cleared: Showing all global conversations.'
      );
    })
  );

  // 4. Rename Chat
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.renameChat', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) {
        vscode.window.showInformationMessage('Please select a chat to rename.');
        return;
      }

      const newTitle = await vscode.window.showInputBox({
        title: 'Rename Conversation',
        prompt: 'Enter a new descriptive title for this conversation:',
        value: convo.title,
        placeHolder: 'e.g. Diskwatch Memory Optimization'
      });

      if (newTitle !== undefined) {
        metadataStore.setCustomTitle(convo.id, newTitle);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Conversation renamed to: "${newTitle}"`);
      }
    })
  );

  // 5. Toggle Pin
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.togglePin', (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;

      const isPinnedNow = metadataStore.togglePin(convo.id);
      treeProvider.refresh();
      vscode.window.showInformationMessage(
        isPinnedNow ? `📌 Pinned "${convo.title}"` : `Unpinned "${convo.title}"`
      );
    })
  );

  // 6. Create Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.createFolder', async () => {
      const folderName = await vscode.window.showInputBox({
        title: 'Create Conversation Folder',
        prompt: 'Enter a folder name to organize your chats:',
        placeHolder: 'e.g. Telegram Bots, Bugfixes, Arhiva'
      });

      if (folderName && folderName.trim().length > 0) {
        metadataStore.addFolder(folderName.trim());
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Created folder: "${folderName.trim()}"`);
      }
    })
  );

  // 7. Move to Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.moveToFolder', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;

      const existingFolders = metadataStore.getFolders();
      const options: vscode.QuickPickItem[] = [
        {
          label: '$(add) Create New Folder...',
          description: 'Create a new folder and move this chat into it'
        },
        {
          label: '$(close) None (Uncategorized)',
          description: 'Remove from folder'
        },
        ...existingFolders.map(f => ({
          label: `$(folder) ${f}`,
          description: convo.folder === f ? '(Current)' : undefined
        }))
      ];

      const selected = await vscode.window.showQuickPick(options, {
        title: `Move "${convo.title}" to Folder`
      });

      if (!selected) return;

      if (selected.label === '$(add) Create New Folder...') {
        const newFolder = await vscode.window.showInputBox({
          title: 'New Folder Name',
          prompt: 'Enter the new folder name:'
        });
        if (newFolder && newFolder.trim()) {
          metadataStore.setFolder(convo.id, newFolder.trim());
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Moved to folder "${newFolder.trim()}"`);
        }
      } else if (selected.label === '$(close) None (Uncategorized)') {
        metadataStore.setFolder(convo.id, undefined);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Removed from folder`);
      } else {
        const folderName = selected.label.replace('$(folder) ', '').trim();
        metadataStore.setFolder(convo.id, folderName);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Moved to folder "${folderName}"`);
      }
    })
  );

  // 8. Remove from Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.removeFromFolder', (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;
      metadataStore.setFolder(convo.id, undefined);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Removed "${convo.title}" from folder`);
    })
  );

  // 9. Delete Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.deleteFolder', async (item?: ChatTreeItem) => {
      if (!item?.folderName) return;
      const folderName = item.folderName;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete folder "${folderName}"? (Chats will NOT be deleted, only moved to Uncategorized)`,
        { modal: true },
        'Delete Folder'
      );

      if (confirm === 'Delete Folder') {
        metadataStore.deleteFolder(folderName);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Deleted folder "${folderName}"`);
      }
    })
  );

  // 10. Set Folder Emoji / Icon
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.setFolderIcon', async (item?: ChatTreeItem) => {
      if (!item?.folderName) return;
      const folderName = item.folderName;
      const currentEmoji = metadataStore.getFolderEmoji(folderName);

      const presets: vscode.QuickPickItem[] = [
        { label: '🟢 Active / In Progress' },
        { label: '📦 Archive' },
        { label: '🐞 Bugfixes & Issues' },
        { label: '🚀 Releases & Deployments' },
        { label: '🧪 Experimental / Scratch' },
        { label: '💡 Ideas & Architecture' },
        { label: '📚 Documentation & Notes' },
        { label: '✏️ Custom Emoji...' },
        { label: '❌ Remove Icon' }
      ];

      const selected = await vscode.window.showQuickPick(presets, {
        title: `Choose Icon for "${folderName}"`
      });

      if (!selected) return;

      let emoji = '';
      if (selected.label === '❌ Remove Icon') {
        emoji = '';
      } else if (selected.label === '✏️ Custom Emoji...') {
        const input = await vscode.window.showInputBox({
          title: 'Custom Emoji',
          prompt: 'Enter an emoji or symbol character:',
          value: currentEmoji
        });
        if (input !== undefined) emoji = input.trim();
      } else {
        emoji = selected.label.split(' ')[0];
      }

      metadataStore.setFolderEmoji(folderName, emoji || undefined);
      treeProvider.refresh();
    })
  );

  // 11. Add / Edit Note
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.addNote', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;

      const note = await vscode.window.showInputBox({
        title: `Note for "${convo.title}"`,
        prompt: 'Add a summary note or key takeaway for this chat:',
        value: convo.notes || '',
        placeHolder: 'e.g. Decided to use SQLite for caching layer'
      });

      if (note !== undefined) {
        metadataStore.setNotes(convo.id, note);
        treeProvider.refresh();
      }
    })
  );

  // 12. Copy Chat Title (For pasting into Past Conversations search)
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.copyChatTitle', async (item?: ChatTreeItem | ConversationInfo) => {
      let convo: ConversationInfo | undefined;
      if (item instanceof ChatTreeItem) {
        convo = item.conversation;
      } else if (item && 'id' in item) {
        convo = item as ConversationInfo;
      }
      if (!convo) return;
      const titleToCopy = convo.originalTitle || convo.title;
      await vscode.env.clipboard.writeText(titleToCopy);
      vscode.window.showInformationMessage(`📋 Copied title "${titleToCopy}". Paste into 🕒 Past Conversations to open!`);
    })
  );

  // 12b. Copy Chat ID
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.copyChatId', async (item?: ChatTreeItem | ConversationInfo) => {
      let convo: ConversationInfo | undefined;
      if (item instanceof ChatTreeItem) {
        convo = item.conversation;
      } else if (item && 'id' in item) {
        convo = item as ConversationInfo;
      }
      if (!convo) return;
      await vscode.env.clipboard.writeText(convo.id);
      vscode.window.showInformationMessage(`Copied Conversation ID: ${convo.id}`);
    })
  );

  // 13. Open Transcript (JSONL)
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.openTranscript', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;

      const transcriptPath = path.join(
        os.homedir(),
        '.gemini',
        'antigravity-ide',
        'brain',
        convo.id,
        '.system_generated',
        'logs',
        'transcript.jsonl'
      );

      if (fs.existsSync(transcriptPath)) {
        const doc = await vscode.workspace.openTextDocument(transcriptPath);
        await vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showWarningMessage(`No transcript file found for this session.`);
      }
    })
  );

  // 14. Export to Markdown
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.exportMarkdown', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;
      await markdownExporter.exportChat(convo);
    })
  );

  // 15. Open Artifact (Plans & Walkthroughs)
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.openArtifact', async (filePath: string) => {
      if (fs.existsSync(filePath)) {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
      }
    })
  );

  // 16. Fast Search (Titles & Prompts)
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.searchChats', async () => {
      const chats = treeProvider.getChats();
      if (chats.length === 0) {
        vscode.window.showInformationMessage('No conversations found to search.');
        return;
      }

      interface ChatQuickPick extends vscode.QuickPickItem {
        chat: ConversationInfo;
      }

      const items: ChatQuickPick[] = chats.map(c => {
        const pinIcon = c.isPinned ? '📌 ' : '';
        const folderInfo = c.folder ? ` [📁 ${c.folder}]` : '';
        const scratchInfo = c.isScratch ? ' [Scratch]' : '';
        const dateStr = new Date(c.lastModified).toLocaleDateString();

        return {
          label: `${pinIcon}${c.title}`,
          description: `${dateStr}${folderInfo}${scratchInfo}`,
          detail: c.notes ? `Note: ${c.notes} | ${c.firstPrompt}` : c.firstPrompt,
          chat: c
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        title: 'Search All Conversations',
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Type keyword to search across titles, prompts, and notes...'
      });

      if (selected) {
        vscode.commands.executeCommand('antigravityChatOrganizer.focusChat', selected.chat.id);
      }
    })
  );

  // 17. Deep Search (Full-Text in Transcripts)
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.deepSearch', async () => {
      const query = await vscode.window.showInputBox({
        title: 'Deep Full-Text Search in All Transcripts',
        prompt: 'Enter code snippet, error message, or keyword to search inside all historical transcripts:',
        placeHolder: 'e.g. SQLite error, Dockerfile, pip install, git commit'
      });

      if (!query || query.trim().length < 2) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Searching transcripts for "${query}"...`,
          cancellable: false
        },
        async () => {
          const chats = treeProvider.getChats();
          const matches = await deepSearchEngine.search(query, chats);

          if (matches.length === 0) {
            vscode.window.showInformationMessage(`No matches found in any transcripts for "${query}".`);
            return;
          }

          const items = matches.map(m => ({
            label: `$(comment) ${m.conversation.title}`,
            description: `Line ${m.lineNumber} (${new Date(m.conversation.lastModified).toLocaleDateString()})`,
            detail: m.contextSnippet,
            chatId: m.conversation.id
          }));

          const selected = await vscode.window.showQuickPick(items, {
            title: `Found ${matches.length} matches for "${query}"`,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Select a match to jump to that conversation in Cascade'
          });

          if (selected) {
            vscode.commands.executeCommand('antigravityChatOrganizer.focusChat', selected.chatId);
          }
        }
      );
    })
  );
}
