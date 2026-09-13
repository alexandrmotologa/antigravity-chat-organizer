import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ArtifactItemInfo, ConversationInfo } from './types';
import { ConversationScanner } from './conversationScanner';

export class ArtifactTreeItem extends vscode.TreeItem {
  public artifact?: ArtifactItemInfo;
  public conversationId?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    artifact?: ArtifactItemInfo,
    conversationId?: string
  ) {
    super(label, collapsibleState);
    this.artifact = artifact;
    this.conversationId = conversationId;

    if (artifact) {
      this.contextValue = 'artifactItem';
      const dateStr = new Date(artifact.lastModified).toLocaleDateString();
      this.description = `${dateStr} (${artifact.type === 'plan' ? 'Plan' : 'Walkthrough'})`;

      if (artifact.type === 'plan') {
        this.iconPath = new vscode.ThemeIcon('book', new vscode.ThemeColor('charts.blue'));
      } else {
        this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
      }

      this.tooltip = new vscode.MarkdownString(
        `**${artifact.fileName}**\n\n` +
        `- **Conversation**: ${artifact.conversationTitle}\n` +
        `- **File**: \`${artifact.filePath}\`\n` +
        `- **Last Modified**: ${new Date(artifact.lastModified).toLocaleString()}`
      );

      this.command = {
        command: 'antigravityChatOrganizer.openArtifact',
        title: 'Open Artifact',
        arguments: [artifact.filePath]
      };
    } else {
      this.contextValue = 'artifactGroup';
      this.iconPath = new vscode.ThemeIcon('folder-library');
    }
  }
}

export class ArtifactsProvider implements vscode.TreeDataProvider<ArtifactTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ArtifactTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ArtifactTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ArtifactTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private scanner: ConversationScanner;
  private brainDir: string;
  private cachedArtifacts: ArtifactItemInfo[] = [];

  constructor(scanner: ConversationScanner) {
    this.scanner = scanner;
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
  }

  public refresh(): void {
    this.cachedArtifacts = this.scanArtifacts();
    this._onDidChangeTreeData.fire();
  }

  private scanArtifacts(): ArtifactItemInfo[] {
    const items: ArtifactItemInfo[] = [];
    if (!fs.existsSync(this.brainDir)) return items;

    const allChats = this.scanner.scanAll();
    const chatTitleMap = new Map<string, string>();
    for (const c of allChats) {
      chatTitleMap.set(c.id, c.title);
    }

    try {
      const entries = fs.readdirSync(this.brainDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.name)) {
          const convoId = entry.name.toLowerCase();
          const convoDir = path.join(this.brainDir, entry.name);
          const convoTitle = chatTitleMap.get(convoId) || `Session ${convoId.substring(0, 8)}`;

          const checkFiles = [
            { name: 'implementation_plan.md', type: 'plan' as const },
            { name: 'walkthrough.md', type: 'walkthrough' as const }
          ];

          for (const cf of checkFiles) {
            const fp = path.join(convoDir, cf.name);
            if (fs.existsSync(fp)) {
              try {
                const stats = fs.statSync(fp);
                items.push({
                  id: `${convoId}-${cf.name}`,
                  conversationId: convoId,
                  conversationTitle: convoTitle,
                  fileName: cf.name,
                  filePath: fp,
                  type: cf.type,
                  lastModified: stats.mtimeMs
                });
              } catch {
                // Ignore stat errors
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[ArtifactsProvider] Error scanning artifacts:', e);
    }

    items.sort((a, b) => b.lastModified - a.lastModified);
    return items;
  }

  getTreeItem(element: ArtifactTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ArtifactTreeItem): Promise<ArtifactTreeItem[]> {
    if (this.cachedArtifacts.length === 0) {
      this.cachedArtifacts = this.scanArtifacts();
    }

    if (!element) {
      // Group by Plans and Walkthroughs
      const plans = this.cachedArtifacts.filter(a => a.type === 'plan');
      const walkthroughs = this.cachedArtifacts.filter(a => a.type === 'walkthrough');

      const planGroup = new ArtifactTreeItem(
        `📋 Implementation Plans (${plans.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        'plans-group'
      );

      const walkGroup = new ArtifactTreeItem(
        `✅ Walkthroughs & Reports (${walkthroughs.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        'walkthroughs-group'
      );

      return [planGroup, walkGroup];
    }

    if (element.conversationId === 'plans-group') {
      return this.cachedArtifacts
        .filter(a => a.type === 'plan')
        .map(a => new ArtifactTreeItem(a.conversationTitle, vscode.TreeItemCollapsibleState.None, a));
    }

    if (element.conversationId === 'walkthroughs-group') {
      return this.cachedArtifacts
        .filter(a => a.type === 'walkthrough')
        .map(a => new ArtifactTreeItem(a.conversationTitle, vscode.TreeItemCollapsibleState.None, a));
    }

    return [];
  }
}
