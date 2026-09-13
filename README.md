# Antigravity Chat Organizer

A VS Code and Antigravity IDE extension to manage agent chat conversations with custom folders, dual-title search, artifact navigation, and session resumption.

---

## Features

### Dual search
- **Multi-field search (`Ctrl+Alt+S` / `Cmd+Alt+S`)**: Query custom titles, original Antigravity conversation titles, user notes, the initial prompt, folder labels, and UUIDs.
- **Tree filter (`Ctrl+F`)**: Filter directly within the sidebar tree view in real time.

### Smart resume
Resume previous sessions directly from the sidebar. Launching a session loads:
- Links to existing `implementation_plan.md` and `walkthrough.md` artifacts.
- User notes and recorded decisions from the conversation.
- The original prompt and objective.
- The path to the session transcript for context restoration.

### State synchronization
Reads and syncs conversation titles from Antigravity's internal SQLite database (`state.vscdb`), keeping names consistent with Cascade's native conversation history.

### Clipboard copy
Copy the original Antigravity title with one click to locate the session in Cascade's native search.

### Drag and drop
Drag conversations into custom folders within the Activity Bar tree view.

### Workspace filter
Toggle (`$(filter)`) to switch between showing conversations for the current workspace or all historical sessions.

### Custom folders and categories
Group chats into folders (such as Active, Archive, Bugfixes, Ideas, or Scratch) with custom icons and labels.

### Pinned conversations
Keep active or reference conversations at the top of the sidebar under the Pinned Chats section.

### Persistent renaming
Assign custom display names while retaining the original Antigravity title for search and history compatibility.

### Full-text transcript search
Search raw `transcript.jsonl` files for code snippets, error traces, or terminal output with contextual previews.

### Artifact explorer
A dedicated sidebar panel that indexes all `implementation_plan.md` and `walkthrough.md` files across sessions. Clicking an entry opens the artifact in the editor.

### Markdown export
Export any conversation transcript to a formatted Markdown file for review or documentation.

---

## Sidebar layout

```text
CHAT ORGANIZER (Activity Bar)
├── Pinned Chats (2)
│   ├── Fix Python Artemis Bug [Orig: VS Code Chat Management Extension] (Today, 14:03)
│   └── Architecture Guidelines (Sep 10)
├── Active Projects (3)
│   └── PayGate TMA Auth
├── Archive (12)
│   └── Old Setup Notes
└── Recent / All Chats (340)
    ├── Telegram Mini App Ideas [Scratch]
    └── Fixing Duplicate Code

PROJECT PLANS & ARTIFACTS (View)
├── Implementation Plans (45)
│   └── Antigravity Chat Organizer Plan
└── Walkthroughs & Reports (42)
    └── Diskwatch Overview Walkthrough
```

---

## Shortcuts and commands

| Action | Shortcut / Trigger | Description |
| :--- | :--- | :--- |
| Quick search | `Ctrl+Alt+S` / `Cmd+Alt+S` | Search by custom name, original name, prompt, notes, or ID |
| Tree filter | `Ctrl+F` (focused tree) | Filter conversations within the sidebar tree |
| Transcript search | Click `$(search-fuzzy)` | Search raw transcripts for code snippets or errors |
| Workspace filter | Click `$(filter)` | Toggle between current workspace and global chats |
| Smart resume | Right-click chat -> `Smart Resume` | Start a new session with previous context |
| Copy title | Right-click chat -> `Copy Conversation Title` | Copy original title to clipboard |
| Rename chat | Click `$(edit)` or press `F2` | Set a custom display title |
| Pin / Unpin | Click `$(pin)` | Pin or unpin from the top section |
| Drag and drop | Mouse drag | Move conversation into a folder |
| Export to Markdown | Right-click chat -> `Export to Markdown` | Save conversation as Markdown |
| View artifacts | Artifacts panel | Open saved plans and walkthroughs |

---

## Installation and development

### Package and install VSIX
```bash
# 1. Compile TypeScript
npm run compile

# 2. Package VSIX bundle
npx @vscode/vsce package --no-dependencies

# 3. Install in Antigravity IDE
antigravity-ide --install-extension antigravity-chat-organizer-0.2.8.vsix
```

### Development mode
```bash
git clone https://github.com/alexandrmotologa/antigravity-chat-organizer.git
cd antigravity-chat-organizer
npm install
npm run compile
```
Open the repository in Antigravity IDE or VS Code and press `F5` to launch the extension development host.

---

## License

MIT License. Copyright (c) 2026 Alexandr Motologa.
