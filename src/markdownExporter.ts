import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { ConversationInfo } from './types';

export class MarkdownExporter {
  private brainDir: string;

  constructor() {
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
  }

  public async exportChat(convo: ConversationInfo): Promise<void> {
    const transcriptPath = path.join(
      this.brainDir,
      convo.id,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    const lines: string[] = [];
    lines.push(`# ${convo.title}`);
    lines.push('');
    lines.push(`- **Conversation ID**: \`${convo.id}\``);
    lines.push(`- **Date**: ${new Date(convo.lastModified).toLocaleString()}`);
    lines.push(`- **Workspace**: ${convo.workspacePath || 'None / Scratch'}`);
    if (convo.folder) lines.push(`- **Folder**: ${convo.folder}`);
    if (convo.notes) lines.push(`- **Notes**: ${convo.notes}`);
    lines.push(`- **Messages Count**: ${convo.messageCount}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Check for implementation_plan.md or walkthrough.md
    const planPath = path.join(this.brainDir, convo.id, 'implementation_plan.md');
    const walkthroughPath = path.join(this.brainDir, convo.id, 'walkthrough.md');

    if (fs.existsSync(planPath) || fs.existsSync(walkthroughPath)) {
      lines.push('## 📑 Linked Project Artifacts');
      lines.push('');
      if (fs.existsSync(planPath)) {
        lines.push(`- **Implementation Plan**: \`${planPath}\``);
      }
      if (fs.existsSync(walkthroughPath)) {
        lines.push(`- **Walkthrough Summary**: \`${walkthroughPath}\``);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('## 💬 Dialogue Transcript');
    lines.push('');

    if (fs.existsSync(transcriptPath)) {
      try {
        const raw = fs.readFileSync(transcriptPath, 'utf-8');
        const jsonLines = raw.split(/\r?\n/).filter(Boolean);

        let turnIndex = 1;
        for (const line of jsonLines) {
          try {
            const data = JSON.parse(line);
            const type = data.type;
            const content = data.content || '';

            if (type === 'USER_INPUT') {
              const cleanContent = content
                .replace(/<USER_REQUEST>/g, '')
                .replace(/<\/USER_REQUEST>/g, '')
                .replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/g, '')
                .trim();

              lines.push(`### 👤 User (Turn ${turnIndex})`);
              lines.push('');
              lines.push(cleanContent);
              lines.push('');
              turnIndex++;
            } else if (type === 'PLANNER_RESPONSE' || data.source === 'MODEL') {
              if (content.trim()) {
                lines.push(`### 🤖 Assistant`);
                lines.push('');
                lines.push(content.trim());
                lines.push('');
              }
            }
          } catch {
            // Ignore corrupted line
          }
        }
      } catch (err) {
        lines.push(`> ⚠️ Error reading transcript: ${err}`);
      }
    } else {
      lines.push('> ℹ️ No local transcript file was found for this session.');
    }

    const markdownContent = lines.join('\n');

    // Open in a new untitled editor document
    const doc = await vscode.workspace.openTextDocument({
      content: markdownContent,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, { preview: false });

    // Also ask if user wants to save to a specific file
    const action = await vscode.window.showInformationMessage(
      `Exported "${convo.title}" to Markdown editor tab.`,
      'Save to File...'
    );

    if (action === 'Save to File...') {
      const sanitizedName = convo.title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 40);
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Desktop', `${sanitizedName}.md`)),
        filters: { 'Markdown': ['md'] }
      });
      if (uri) {
        fs.writeFileSync(uri.fsPath, markdownContent, 'utf-8');
        vscode.window.showInformationMessage(`Saved Markdown to: ${uri.fsPath}`);
      }
    }
  }
}
