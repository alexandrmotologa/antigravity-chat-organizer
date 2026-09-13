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
    const vscdbTitles = this.parseStateVscdbSummaries();

    // Merge: vscdb has the exact titles shown by Antigravity IDE Cascade Past Conversations
    const allTitles = new Map<string, { title: string; workspace?: string }>(protoTitles);
    for (const [id, info] of vscdbTitles) {
      const existing = allTitles.get(id);
      allTitles.set(id, {
        title: info.title,
        workspace: existing?.workspace || info.workspace
      });
    }

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
            const convoInfo = this.extractFromBrain(id, folderPath, allTitles.get(id));
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
              const titleInfo = allTitles.get(id);

              const meta = this.metadataStore.getChatMetadata(id);
              const title = meta.customTitle || titleInfo?.title || `Conversation ${id.substring(0, 8)}`;

              conversationMap.set(id, {
                id,
                title,
                originalTitle: titleInfo?.title || title,
                customTitle: meta.customTitle,
                firstPrompt: '(No transcript recorded)',
                lastModified: stats.mtimeMs,
                createdAt: stats.birthtimeMs || stats.mtimeMs,
                messageCount: 0,
                isPinned: !!meta.isPinned,
                folder: meta.folder,
                tags: meta.tags || [],
                notes: meta.notes,
                workspacePath: titleInfo?.workspace || 'Scratch / Unassigned',
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
      // Try to determine workspace from transcript if not in proto/vscdb
      if (firstPrompt.includes('.gemini\\antigravity-ide\\scratch') || folderPath.includes('scratch')) {
        isScratch = true;
        workspace = 'Scratch / Unassigned';
      } else {
        const wsMatch = firstPrompt.match(/([a-zA-Z]:\\[^\s"']+)/);
        if (wsMatch) {
          workspace = path.dirname(wsMatch[1]);
        } else {
          workspace = 'General / Direct Chat';
        }
      }
    }

    return {
      id,
      title,
      originalTitle,
      customTitle: meta.customTitle,
      firstPrompt: firstPrompt || '(No transcript recorded)',
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

  private parseStateVscdbSummaries(): Map<string, { title: string; workspace?: string }> {
    const map = new Map<string, { title: string; workspace?: string }>();
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
    const dbPath = path.join(appData, 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb');
    if (!fs.existsSync(dbPath)) {
      return map;
    }

    let b64Val = '';
    try {
      // 1. Try native Node sqlite if available
      // @ts-ignore
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get('antigravityUnifiedStateSync.trajectorySummaries') as { value?: string } | undefined;
      db.close();
      if (row && row.value) {
        b64Val = row.value;
      }
    } catch {
      // 2. Fallback: query via python if available
      try {
        const cp = require('child_process');
        const script = `import sqlite3; con=sqlite3.connect(r'${dbPath}'); cur=con.cursor(); cur.execute("SELECT value FROM ItemTable WHERE key='antigravityUnifiedStateSync.trajectorySummaries'"); row=cur.fetchone(); print(row[0] if row else "")`;
        b64Val = cp.execSync(`python -c "${script}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
      } catch {
        // Fallback ignore
      }
    }

    if (!b64Val) {
      return map;
    }

    try {
      const raw = Buffer.from(b64Val, 'base64');
      const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
      const text = raw.toString('latin1');
      let m: RegExpExecArray | null;
      while ((m = uuidRegex.exec(text)) !== null) {
        const id = m[1].toLowerCase();
        const start = m.index + m[0].length;
        const sub = raw.subarray(start, start + 350).toString('latin1');
        const bMatch = sub.match(/C[A-Za-z0-9+/=]{10,120}/);
        if (bMatch) {
          try {
            const dec = Buffer.from(bMatch[0], 'base64');
            if (dec[0] === 0x0a) {
              const len = dec[1];
              const title = dec.subarray(2, 2 + len).toString('utf8');
              if (title && title.length > 1 && !map.has(id)) {
                map.set(id, { title });
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('[ChatOrganizer] Error parsing state.vscdb summaries:', err);
    }

    return map;
  }
}
