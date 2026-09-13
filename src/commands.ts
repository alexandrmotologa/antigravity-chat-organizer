import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ChatTreeItem, ChatTreeProvider } from './chatTreeProvider';
import { MetadataStore } from './metadataStore';
import { ConversationInfo } from './types';

export function registerCommands(
  context: vscode.ExtensionContext,
  treeProvider: ChatTreeProvider,
  metadataStore: MetadataStore
): void {
  // 1. Focus / Open Chat in Cascade
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.focusChat', async (chatId?: string | ChatTreeItem) => {
      let id: string | undefined;
      if (typeof chatId === 'string') {
        id = chatId;
      } else if (chatId instanceof ChatTreeItem && chatId.conversation) {
        id = chatId.conversation.id;
      }

      if (!id) {
        vscode.window.showErrorMessage('No conversation ID provided.');
        return;
      }

      try {
        await vscode.commands.executeCommand('workbench.action.smartFocusConversation', id);
      } catch (err) {
        console.error('[ChatOrganizer] Error focusing conversation:', err);
        vscode.window.showErrorMessage(`Failed to switch to conversation: ${err}`);
      }
    })
  );

  // 2. Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.refresh', () => {
      treeProvider.refresh();
    })
  );

  // 3. Rename Chat
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

  // 4. Toggle Pin
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.togglePin', (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) {
        return;
      }

      const isPinnedNow = metadataStore.togglePin(convo.id);
      treeProvider.refresh();
      vscode.window.showInformationMessage(
        isPinnedNow ? `📌 Pinned "${convo.title}"` : `Unpinned "${convo.title}"`
      );
    })
  );

  // 5. Create Folder
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

  // 6. Move to Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.moveToFolder', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) {
        return;
      }

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

  // 7. Remove from Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.removeFromFolder', (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;
      metadataStore.setFolder(convo.id, undefined);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Removed "${convo.title}" from folder`);
    })
  );

  // 8. Delete Folder
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

  // 9. Add / Edit Note
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

  // 10. Copy Chat ID
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityChatOrganizer.copyChatId', async (item?: ChatTreeItem) => {
      const convo = item?.conversation;
      if (!convo) return;
      await vscode.env.clipboard.writeText(convo.id);
      vscode.window.showInformationMessage(`Copied Conversation ID: ${convo.id}`);
    })
  );

  // 11. Open Transcript (JSONL)
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

  // 12. Search All Chats
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
        placeHolder: 'Type keyword to search across all chats, prompts, notes and folders...'
      });

      if (selected) {
        vscode.commands.executeCommand('antigravityChatOrganizer.focusChat', selected.chat.id);
      }
    })
  );
}
