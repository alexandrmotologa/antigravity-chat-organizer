import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { ConversationInfo, DeepSearchResult } from './types';

export class DeepSearchEngine {
  private brainDir: string;

  constructor() {
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
  }

  public async search(
    query: string,
    allChats: ConversationInfo[],
    maxResults = 40
  ): Promise<DeepSearchResult[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const chatMap = new Map<string, ConversationInfo>();
    for (const c of allChats) {
      chatMap.set(c.id, c);
    }

    const results: DeepSearchResult[] = [];

    // Sort chats by lastModified so more recent matches appear first
    const sortedChats = [...allChats].sort((a, b) => b.lastModified - a.lastModified);

    for (const chat of sortedChats) {
      if (results.length >= maxResults) break;

      const transcriptPath = path.join(
        this.brainDir,
        chat.id,
        '.system_generated',
        'logs',
        'transcript.jsonl'
      );

      if (!fs.existsSync(transcriptPath)) continue;

      try {
        const fileStream = fs.createReadStream(transcriptPath, { encoding: 'utf-8' });
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });

        let lineNum = 0;
        for await (const line of rl) {
          lineNum++;
          if (!line) continue;

          const lowerLine = line.toLowerCase();
          const matchIdx = lowerLine.indexOf(trimmed);

          if (matchIdx !== -1) {
            let extractedContent = line;
            try {
              const parsed = JSON.parse(line);
              if (parsed.content) {
                extractedContent = String(parsed.content);
              }
            } catch {
              // fallback to raw line
            }

            // Extract context snippet
            const clean = extractedContent
              .replace(/<[^>]+>/g, ' ')
              .replace(/\\n/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            const cLower = clean.toLowerCase();
            const cIdx = cLower.indexOf(trimmed);
            const start = Math.max(0, (cIdx !== -1 ? cIdx : 0) - 40);
            const end = Math.min(clean.length, start + 120);
            const snippet = (start > 0 ? '...' : '') + clean.substring(start, end) + (end < clean.length ? '...' : '');

            results.push({
              conversation: chat,
              lineNumber: lineNum,
              matchedText: clean.substring(Math.max(0, cIdx), cIdx + trimmed.length),
              contextSnippet: snippet
            });

            if (results.length >= maxResults) {
              break;
            }
          }
        }
      } catch (err) {
        console.error(`[DeepSearch] Error searching in ${chat.id}:`, err);
      }
    }

    return results;
  }
}
