# Antigravity Chat Organizer 🚀 (v0.2.8)

A comprehensive VS Code & Antigravity IDE extension to **organize, search by dual names, drag-and-drop, pin, categorize into folders, smart resume, export, and explore artifacts** across all agent conversations in Google Antigravity.

---

## ✨ Key Features

### 🔍 Dual Search (Original & Custom Names)
- **Instant Multi-Field Search (`Ctrl+Alt+S`)**:
  - Quickly search across **both custom renamed titles AND original Antigravity titles** simultaneously.
  - Also filters by user notes, first user prompt, folder names, and conversation UUIDs.
- **Inline TreeView Filter (`Ctrl+F`)**:
  - Direct type-to-filter within the sidebar tree view matches both custom names and original titles in real time.

### 🚀 Smart Resume (Continue with Agent)
- Need to pick up where you left off? Click **Smart Resume** to launch a fresh Cascade agent session primed with:
  - Links to previously generated `implementation_plan.md` and `walkthrough.md` artifacts.
  - User notes and architectural decisions recorded during the session.
  - The original prompt and objective of the conversation.
  - The full transcript path for deep context restoration.

### 🔄 Automatic Antigravity State Sync
- Automatically reads and synchronizes conversation titles directly from Antigravity's internal `state.vscdb` database.
- Guarantees 100% name parity with Cascade's native `🕒 Past Conversations` panel.

### 📋 1-Click Copy Title for Past Conversations
- Easily copy the exact Antigravity title to your clipboard to find and reopen any conversation in Cascade's native history picker.

### 🖱️ Native Drag & Drop
- Drag conversations directly into custom folders within the Activity Bar tree view.

### 🎯 Workspace-Specific Filter
- 1-Click toggle (`$(filter)`) to switch between showing only conversations belonging to your current active project folder or all global conversations.

### 📂 Custom Folders & Emojis
- Organize chats into categories (e.g., 🟢 *Active*, 📦 *Archive*, 🐞 *Bugfixes*, 💡 *Ideas*, 🧪 *Scratch*).
- Personalize folder badges with custom emojis or preset icons.

### 📌 Pin to Top
- Pin critical conversations permanently to the top of the sidebar under the **📌 Pinned Chats** group.

### ✏️ Persistent Custom Renaming
- Rename chats to descriptive titles while preserving the original Antigravity title for search and history compatibility.

### 🔎 Deep Full-Text Transcript Search
- Full-text search across all historical `transcript.jsonl` files for code snippets, error messages, or terminal output with contextual previews.

### 📑 Project Plans & Artifacts Explorer
- Dedicated companion tree view in the sidebar listing all `implementation_plan.md` and `walkthrough.md` files ever created across all sessions. Click any artifact to open it directly in the editor.

### 📄 Export to Markdown
- Convert any conversation into a clean, beautifully formatted Markdown file for archiving, sharing, or documentation.

---

## 📸 Sidebar Layout

```text
CHAT ORGANIZER (Activity Bar)
├── 📌 Pinned Chats (2)
│   ├── Fix Python Artemis Bug [Orig: VS Code Chat Management Extension] (Today, 14:03)
│   └── Architecture Guidelines (Sep 10)
├── 🟢 Active Projects (3)
│   └── PayGate TMA Auth
├── 📦 Archive (12)
│   └── Old Setup Notes
└── 💬 Recent / All Chats (340)
    ├── Telegram Mini App Ideas [Scratch]
    └── Fixing Duplicate Code

PROJECT PLANS & ARTIFACTS (View)
├── 📋 Implementation Plans (45)
│   └── Antigravity Chat Organizer Plan
└── ✅ Walkthroughs & Reports (42)
    └── Diskwatch Overview Walkthrough
```

---

## ⌨️ Shortcuts & Commands

| Action | Shortcut / Trigger | Description |
| :--- | :--- | :--- |
| **Quick Search** | `Ctrl+Alt+S` / `Cmd+Alt+S` | Search by custom name, original name, prompt, notes, or ID |
| **Tree Filter** | `Ctrl+F` (focused tree) | Inline filter directly in the sidebar tree |
| **Deep Full-Text Search** | Click `$(search-fuzzy)` | Search inside raw transcripts for code snippets or errors |
| **Toggle Workspace Filter** | Click `$(filter)` | Toggle between current project chats and global chats |
| **Smart Resume** | Right-click chat -> `Smart Resume` | Start a new session pre-loaded with previous context |
| **Copy Title for Past Convo** | Right-click chat -> `Copy Conversation Title` | Copies original title to paste into Cascade search |
| **Rename Chat** | Click `$(edit)` or press F2 | Set custom title |
| **Pin / Unpin** | Click `$(pin)` | Pin to top |
| **Drag & Drop** | Mouse Drag | Drop into any folder |
| **Export to Markdown** | Right-click chat -> `Export to Markdown` | Save clean Markdown document |
| **View Artifacts** | Artifacts View | Open historical plans and walkthroughs |

---

## 🛠️ Build & Installation

### Option 1: Package and Install VSIX
```bash
# 1. Compile TypeScript
npm run compile

# 2. Package VSIX bundle
npx @vscode/vsce package --no-dependencies

# 3. Install in Antigravity IDE
antigravity-ide --install-extension antigravity-chat-organizer-0.2.8.vsix
```

### Option 2: Development Mode
```bash
git clone https://github.com/alexandrmotologa/antigravity-chat-organizer.git
cd antigravity-chat-organizer
npm install
npm run compile
```
Open the folder in Antigravity IDE and press `F5` to start debugging.

---

## 📄 License

MIT License - Copyright (c) 2026 Alexandr Motologa
