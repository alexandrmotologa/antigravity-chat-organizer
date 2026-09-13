# Antigravity Chat Organizer 🚀 (v0.2.0)

A powerful VS Code & Antigravity IDE extension to **organize, drag-and-drop, pin, categorize into folders, export, and deep search** all your agent conversations in Google Antigravity.

---

## ✨ Features

- **🖱️ Native Drag & Drop**:
  - Drag and drop conversations directly into folders in the Activity Bar tree view.
- **🎯 Current Workspace Filter**:
  - 1-Click toggle (`$(filter)`) to display only conversations belonging to the active project workspace, or all 360+ global chats.
- **📂 Custom Folders & Emojis**:
  - Create categorized folders (e.g., 🟢 *Active*, 📦 *Archive*, 🐞 *Bugfixes*, 💡 *Ideas*, 🧪 *Scratch*).
  - Customize folder icons with preset badges or custom emojis.
- **📌 Pin to Top**:
  - Keep your most important sessions permanently anchored at the top.
- **✏️ Custom Renaming**:
  - Rename auto-generated titles to human-friendly names that persist across sessions.
- **🔎 Deep Full-Text Transcript Search**:
  - Fast search across all historical `transcript.jsonl` files for code snippets, error messages, terminal logs, or past questions with highlighted contextual preview snippets.
- **📑 Project Plans & Artifacts Explorer**:
  - Dedicated companion view in the sidebar listing all `implementation_plan.md` and `walkthrough.md` files ever created across all sessions. Click any artifact to open it directly!
- **📄 Export to Markdown**:
  - Convert any chat session into clean, formatted Markdown document with 1-click. Ready to share or save to disk.
- **⚡ 1-Click Native Focus**:
  - Clicking any conversation immediately opens and loads that conversation in Antigravity's Cascade chat panel.
- **📝 Takeaway Notes**:
  - Attach summary notes or key architectural decisions to each chat.
- **🔄 Real-Time Sync**:
  - File watcher detects newly started conversations or prompt turns automatically.

---

## 📸 Sidebar Structure

```text
CHAT ORGANIZER (Activity Bar)
├── 📌 Pinned Chats (2)
│   ├── Diskwatch - Memory Leak Fix (Today, 14:03)
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

## 🛠️ Installation

### Option 1: Install VSIX in Antigravity IDE
1. Package the extension:
   ```bash
   npm run compile
   npx @vscode/vsce package
   ```
2. Install via CLI or IDE:
   ```bash
   antigravity-ide --install-extension antigravity-chat-organizer-0.2.0.vsix
   ```

### Option 2: Development Mode
1. Clone this repository:
   ```bash
   git clone https://github.com/alexandrmotologa/antigravity-chat-organizer.git
   cd antigravity-chat-organizer
   npm install
   npm run compile
   ```
2. Open in Antigravity IDE / VS Code and press `F5` to launch Extension Development Host.

---

## 🎯 Commands & Shortcuts

| Action | How to Trigger |
| :--- | :--- |
| **Deep Full-Text Search** | Click `$(search-fuzzy)` in view header or run `Deep Full-Text Search in Transcripts...` |
| **Filter by Workspace** | Click `$(filter)` in view header to toggle between Current Project vs All Chats |
| **Drag and Drop** | Grab any chat with your mouse and drop it into a folder |
| **Set Folder Emoji** | Right-click folder -> `Set Folder Emoji / Icon...` |
| **Export to Markdown** | Right-click chat -> `Export to Markdown Document` |
| **Quick Search Titles** | Click `$(search)` in view header |
| **Rename Chat** | Hover chat -> click `$(edit)` or right-click -> `Rename Chat...` |
| **Pin / Unpin** | Hover chat -> click `$(pin)` or right-click -> `Pin / Unpin Chat` |
| **Move to Folder** | Right-click chat -> `Move to Folder...` |
| **Add / Edit Note** | Right-click chat -> `Add / Edit Note...` |
| **Open Artifact** | Click any plan or walkthrough in the **Project Plans & Artifacts** view |

---

## 📄 License

MIT License - Copyright (c) 2026 Alexandr Motologa
