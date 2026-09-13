import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConversationInfo } from './types';
import { MetadataStore } from './metadataStore';

export class ConversationScanner {
  private geminiDir: string;
  private brainDir: string;
  private convosDir: string;
  private pbFile: string;
  private metadataStore: MetadataStore;

  constructor(metadataStore: MetadataStore) {
    this.metadataStore = metadataStore;
    this.geminiDir = path.join(os.homedir(), '.gemini', 'antigravity-ide');
    this.brainDir = path.join(this.geminiDir, 'brain');
    this.convosDir = path.join(this.geminiDir, 'conversations');
    this.pbFile = path.join(this.geminiDir, 'agyhub_summaries_proto.pb');
  }

  public scanAll(): ConversationInfo[] {
    const protoTitles = this.parseProtoSummaries();
    const conversationMap = new Map<string, ConversationInfo>();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // 1. Scan brain directory (conversations with rich logs and transcripts)
    if (fs.existsSync(this.brainDir)) {
      try {
        const entries = fs.readdirSync(this.brainDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && uuidRegex.test(entry.name)) {
            const id = entry.name.toLowerCase();
            const folderPath = path.join(this.brainDir, entry.name);
            const convoInfo = this.extractFromBrain(id, folderPath, protoTitles.get(id));
            conversationMap.set(id, convoInfo);
          }
        }
      } catch (err) {
        console.error('[ChatOrganizer] Error reading brain directory:', err);
      }
    }

    // 2. Scan conversations directory (*.db and *.pb) to guarantee 100% inclusion of scratch/ad-hoc chats
    if (fs.existsSync(this.convosDir)) {
      try {
        const files = fs.readdirSync(this.convosDir);
        for (const file of files) {
          const match = file.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(db|pb)$/i);
          if (match) {
            const id = match[1].toLowerCase();
            if (!conversationMap.has(id)) {
              // Not found in brain, but exists in conversations
              const filePath = path.join(this.convosDir, file);
              const stats = fs.statSync(filePath);
              const protoInfo = protoTitles.get(id);

              const meta = this.metadataStore.getChatMetadata(id);
              const title = meta.customTitle || protoInfo?.title || `Conversation ${id.substring(0, 8)}`;

              conversationMap.set(id, {
                id,
                title,
                originalTitle: protoInfo?.title || title,
                customTitle: meta.customTitle,
                firstPrompt: '(No transcript recorded)',
                lastModified: stats.mtimeMs,
                createdAt: stats.birthtimeMs || stats.mtimeMs,
                messageCount: 0,
                isPinned: !!meta.isPinned,
                folder: meta.folder,
                tags: meta.tags || [],
                notes: meta.notes,
                workspacePath: protoInfo?.workspace || 'Scratch / Unassigned',
                isScratch: true,
                hasTranscript: false
              });
            }
          }
        }
      } catch (err) {
        console.error('[ChatOrganizer] Error reading conversations directory:', err);
      }
    }

    const list = Array.from(conversationMap.values());
    // Sort: Pinned first, then by lastModified descending
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastModified - a.lastModified;
    });

    return list;
  }

  private extractFromBrain(
    id: string,
    folderPath: string,
    protoInfo?: { title: string; workspace?: string }
  ): ConversationInfo {
    let firstPrompt = '';
    let messageCount = 0;
    let hasTranscript = false;

    const transcriptPath = path.join(folderPath, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(transcriptPath)) {
      hasTranscript = true;
      try {
        const content = fs.readFileSync(transcriptPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          messageCount++;
          if (!firstPrompt) {
            try {
              const data = JSON.parse(line);
              if (data.type === 'USER_INPUT' && data.content) {
                firstPrompt = data.content
                  .replace(/<USER_REQUEST>/g, '')
                  .replace(/<\/USER_REQUEST>/g, '')
                  .replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/g, '')
                  .trim();
              }
            } catch {
              // Ignore line parse failure
            }
          }
        }
      } catch (e) {
        console.error(`[ChatOrganizer] Error reading transcript for ${id}:`, e);
      }
    }

    let stats: fs.Stats | undefined;
    try {
      stats = fs.statSync(folderPath);
    } catch {
      // stats fallback
    }

    const lastModified = stats ? stats.mtimeMs : Date.now();
    const createdAt = stats ? (stats.birthtimeMs || stats.mtimeMs) : Date.now();

    const meta = this.metadataStore.getChatMetadata(id);
    let originalTitle = protoInfo?.title || '';
    if (!originalTitle) {
      if (firstPrompt) {
        originalTitle = firstPrompt.split('\n')[0].substring(0, 50).trim();
      } else {
        originalTitle = `Chat ${id.substring(0, 8)}`;
      }
    }

    const title = meta.customTitle || originalTitle;
    let workspace = protoInfo?.workspace || '';
    let isScratch = false;

    if (!workspace) {
      if (firstPrompt.includes('scratch') || firstPrompt.includes('outside-of-project')) {
        isScratch = true;
        workspace = 'Scratch';
      } else {
        workspace = 'General / Direct Chat';
      }
    } else if (workspace.toLowerCase().includes('scratch')) {
      isScratch = true;
    }

    return {
      id,
      title,
      originalTitle,
      customTitle: meta.customTitle,
      firstPrompt: firstPrompt || '(Empty or initial conversation)',
      lastModified,
      createdAt,
      messageCount,
      isPinned: !!meta.isPinned,
      folder: meta.folder,
      tags: meta.tags || [],
      notes: meta.notes,
      workspacePath: workspace,
      isScratch,
      hasTranscript
    };
  }

  private parseProtoSummaries(): Map<string, { title: string; workspace?: string }> {
    const map = new Map<string, { title: string; workspace?: string }>();
    if (!fs.existsSync(this.pbFile)) {
      return map;
    }

    try {
      const buf = fs.readFileSync(this.pbFile);
      const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
      const text = buf.toString('latin1');

      let match: RegExpExecArray | null;
      while ((match = uuidRegex.exec(text)) !== null) {
        const id = match[1].toLowerCase();
        const start = match.index + match[0].length;
        const snippet = buf.subarray(start, Math.min(buf.length, start + 320));

        // Search for title: \x12 ... \n <len> <title>
        const titleRegex = /\x12[\x80-\xff]*[\x00-\x7f]\n([\x01-\x7f])([^\x00-\x1f]{3,80})/;
        const titleMatch = snippet.toString('latin1').match(titleRegex);

        let title = '';
        if (titleMatch && titleMatch[1] && titleMatch[2]) {
          const expectedLen = titleMatch[1].charCodeAt(0);
          title = Buffer.from(titleMatch[2].substring(0, expectedLen), 'latin1').toString('utf-8');
        }

        let workspace = '';
        const wsMatch = snippet.toString('latin1').match(/file:\/\/\/([^\x00-\x1f\x7f-\xff]+)/);
        if (wsMatch) {
          workspace = decodeURIComponent(wsMatch[0]);
        }

        if (title && (!map.has(id) || title.length > (map.get(id)?.title.length || 0))) {
          map.set(id, { title, workspace });
        }
      }
    } catch (err) {
      console.error('[ChatOrganizer] Error parsing proto summaries:', err);
    }

    return map;
  }
}
