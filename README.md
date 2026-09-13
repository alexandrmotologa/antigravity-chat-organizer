# Antigravity Chat Organizer 🚀

A dedicated VS Code & Antigravity IDE extension to **organize, rename, pin, categorize into folders, and search** all your agent conversations in Google Antigravity.

---

## ✨ Features

- **📂 Folders & Categories**: Create custom folders (e.g. *Diskwatch*, *Telegram Bots*, *Architecture*, *Archive*) and sort your past chats neatly.
- **📌 Pin to Top**: Keep critical sessions right at the top for instant access.
- **✏️ Custom Renaming**: Give any conversation a meaningful, human-friendly title that won't get lost or overwritten.
- **🔍 Universal Discovery (100% of Chats)**:
  - Finds **all** chats: repository projects, ad-hoc scratch conversations, and non-workspace dialogues.
  - Automatically parses original titles and prompts.
- **⚡ 1-Click Native Focus**: Clicking any conversation in the tree immediately opens and focuses that exact session in the native Antigravity Cascade chat!
- **📝 Takeaway Notes**: Attach quick summary notes or architectural decisions to any conversation.
- **🔎 Instant Fuzzy Search**: Search across titles, user prompts, tags, and folders with a quick keyboard shortcut.
- **🔄 Real-Time Sync**: Automatically reflects new conversations as you chat with your agents.

---

## 📸 Overview

```text
CHAT ORGANIZER (Activity Bar)
├── 📌 Pinned Chats (2)
│   ├── Diskwatch - Memory Leak Fix (Today, 14:03)
│   └── Architecture Guidelines (Sep 10)
├── 📁 Telegram Bots (5)
│   ├── Bot Father Webhook Setup
│   └── Payment Gateway Flow
├── 📁 Infrastructure & DevOps (3)
│   └── Docker Compose & SSL Certs
└── 💬 Recent / All Chats (285)
    ├── Telegram Mini App Ideas [Scratch]
    └── Fixing Duplicate Code
```

---

## 🛠️ Installation

### Option 1: Install VSIX directly in Antigravity IDE
1. Download or build the `.vsix` file:
   ```bash
   npm run compile
   npx @vscode/vsce package
   ```
2. Open Antigravity IDE.
3. Open Extensions (`Ctrl+Shift+X`), click `...` (Views and More Actions) -> **Install from VSIX...**, and select `antigravity-chat-organizer-0.1.0.vsix`.

### Option 2: Development Mode
1. Clone this repository:
   ```bash
   git clone https://github.com/alexandrmotologa/antigravity-chat-organizer.git
   cd antigravity-chat-organizer
   ```
2. Install dependencies:
   ```bash
   npm install
   npm run compile
   ```
3. Press `F5` inside VS Code / Antigravity IDE to launch an Extension Development Host window.

---

## 🎯 Commands

| Command | Description |
| :--- | :--- |
| `Search All Chats...` | Fast fuzzy search across all past conversations and prompts |
| `New Folder...` | Create a new custom organization folder |
| `Rename Chat...` | Set a custom name for the selected conversation |
| `Pin / Unpin Chat` | Pin or unpin the session to the top section |
| `Move to Folder...` | Assign a chat to a folder |
| `Add / Edit Note...` | Attach a quick takeaway note |
| `Copy Conversation ID` | Copy the UUID to clipboard |
| `Open Raw Transcript` | Inspect the raw JSONL transcript file |

---

## 📄 License

MIT License - Copyright (c) 2026 Alexandr Motologa
