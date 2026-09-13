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

  public generateMarkdown(convo: ConversationInfo): string {
    const transcriptPath = path.join(
      this.brainDir,
      convo.id,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    const lines: string[] = [];
    lines.push(`# 💬 ${convo.title}`);
    lines.push('');
    lines.push(`> **Session ID**: \`${convo.id}\`  `);
    lines.push(`> **Date**: ${new Date(convo.lastModified).toLocaleString()}  `);
    lines.push(`> **Workspace**: ${convo.workspacePath || 'None / Scratch'}  `);
    if (convo.folder) lines.push(`> **Folder**: \`${convo.folder}\`  `);
    if (convo.notes) lines.push(`> **Notes**: *${convo.notes}*  `);
    lines.push(`> **Total Messages**: ${convo.messageCount}  `);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Check for implementation_plan.md or walkthrough.md
    const planPath = path.join(this.brainDir, convo.id, 'implementation_plan.md');
    const walkthroughPath = path.join(this.brainDir, convo.id, 'walkthrough.md');

    if (fs.existsSync(planPath) || fs.existsSync(walkthroughPath)) {
      lines.push('## 📑 Project Artifacts');
      lines.push('');
      if (fs.existsSync(planPath)) {
        lines.push(`- 📋 [Implementation Plan](file:///${planPath.replace(/\\/g, '/')})`);
      }
      if (fs.existsSync(walkthroughPath)) {
        lines.push(`- ✅ [Walkthrough Summary](file:///${walkthroughPath.replace(/\\/g, '/')})`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('## 🗨️ Conversation Dialogue');
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
              lines.push('---');
              lines.push('');
              turnIndex++;
            } else if (type === 'PLANNER_RESPONSE' || data.source === 'MODEL') {
              if (content.trim()) {
                lines.push(`### 🤖 Assistant`);
                lines.push('');
                lines.push(content.trim());
                lines.push('');
                lines.push('---');
                lines.push('');
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      } catch (err) {
        lines.push(`> ⚠️ Error reading transcript: ${err}`);
      }
    } else {
      lines.push('> ℹ️ No local transcript file was found for this session.');
    }

    return lines.join('\n');
  }

  // Opens the chat transcript immediately in an editor tab (no prompts)
  public async openChat(convo: ConversationInfo): Promise<void> {
    const content = this.generateMarkdown(convo);
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, {
      preview: true,
      viewColumn: vscode.ViewColumn.One
    });
  }

  // Explicit export action (prompts user to save to file)
  public async exportChat(convo: ConversationInfo): Promise<void> {
    const content = this.generateMarkdown(convo);
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One
    });

    const sanitizedName = convo.title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 40);
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Desktop', `${sanitizedName}.md`)),
      filters: { 'Markdown': ['md'] }
    });

    if (uri) {
      fs.writeFileSync(uri.fsPath, content, 'utf-8');
      vscode.window.showInformationMessage(`Saved Markdown to: ${uri.fsPath}`);
    }
  }
}
