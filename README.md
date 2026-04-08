# 📄 Invoice Processor

An AI-powered invoice processing tool that extracts structured data from images and PDFs using **Google Gemini 3 Flash** and saves the results to **Notion** databases.

![Tech Stack](https://img.shields.io/badge/Runtime-Bun-yellow) ![AI](https://img.shields.io/badge/AI-Gemini%203%20Flash-blue) ![Database](https://img.shields.io/badge/Database-Notion-black)

## ✨ Features

- **Multi-Format Upload**: Process PNG, JPG, WEBP images and PDF documents
- **AI-Powered OCR**: Gemini 3 Flash extracts structured invoice data with high accuracy
- **Multi API Key Rotation**: Add multiple Gemini API keys for automatic load balancing and failover
- **Notion Integration**: Auto-creates a database and saves each invoice as a page with line items
- **Drag & Drop UI**: Simple, clean interface for uploading files and managing API keys
- **Fast & Lightweight**: Powered by Bun runtime, vanilla HTML/JS/CSS frontend

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime installed on your system
- Google Gemini API keys (free from [Google AI Studio](https://aistudio.google.com/))
- Notion API key (from [Notion Integrations](https://www.notion.so/my-integrations))

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd invoice-processor

# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your Notion API key
```

### Running the Server

```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun run start
```

The server starts at `http://localhost:3000` by default (configurable via `PORT` in `.env`).

## 🔑 API Key Setup

### 1. Google Gemini API Keys

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **"Create API Key"** in the left sidebar
4. Copy the generated key (starts with `AIza...`)
5. Add it to the Invoice Processor UI in the **⚙️ Gemini API Keys** section

> **Tip**: Create multiple API keys for automatic rotation and fallback. The system randomly selects a key per request and retries with other keys if one fails.

### 2. Notion API Key

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"New Integration"**
3. Name it (e.g., "Invoice Processor") and select your workspace
4. Copy the **"Internal Integration Token"** (starts with `secret_...`)
5. Add it to your `.env` file:

```env
NOTION_API_KEY=secret_your-token-here
NOTION_DATABASE_ID=  # Leave empty to auto-create
PORT=3000
```

### 3. Share Notion Page with Integration

1. Open Notion and navigate to any page in your workspace
2. Click the **"..."** menu in the top-right
3. Select **"Add connections"** → choose your "Invoice Processor" integration
4. The integration will now have access to create databases under this page

## 📋 Usage

1. **Open** `http://localhost:3000` in your browser
2. **Add Gemini API Keys** in the ⚙️ section at the bottom
3. **Upload invoices** by dragging & dropping files or clicking the upload zone
4. **Click "Process Invoices"** to start OCR processing
5. **View results** — extracted data appears in formatted cards
6. **Check Notion** — a new "Invoice Processor" database is auto-created with all invoice data

### Supported File Formats

| Format | Extensions | Max Size |
|--------|-----------|----------|
| Images | PNG, JPG, JPEG, WEBP | 50 MB |
| Documents | PDF | 50 MB |

> **Note**: PDFs are sent directly to Gemini as base64-encoded files. Gemini 3 Flash processes them natively with its vision pipeline.

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  Bun Server  │────▶│  Gemini 3 Flash  │
│  (Upload)   │     │  (Port 3000) │     │  (OCR + JSON)    │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Notion    │
                    │  (Database)  │
                    └──────────────┘
```

### Request Flow

1. User uploads invoice files (images or PDFs) via drag & drop
2. Bun server receives files, validates types/sizes, encodes to base64
3. Random Gemini API key selected from pool
4. File sent to `gemini-3-flash-preview` with structured JSON schema
5. Gemini returns extracted invoice data as JSON
6. Invoice data saved to Notion database (auto-created if needed)
7. Results displayed in browser with formatted cards

## 📁 Project Structure

```
invoice-processor/
├── src/
│   ├── server.ts              # Bun HTTP server with routing
│   ├── api/
│   │   ├── keys.ts            # Multi API key pool management
│   │   └── upload.ts          # File upload handler
│   ├── services/
│   │   ├── gemini.ts          # Gemini 3 Flash OCR integration
│   │   └── notion.ts          # Notion database & page creation
│   ├── types.ts               # TypeScript interfaces
│   └── utils.ts               # File encoding helpers
├── public/
│   ├── index.html             # Frontend UI
│   ├── app.js                 # Client-side logic
│   └── styles.css             # Styling
├── .env                       # Environment variables (gitignored)
├── .env.example               # Template for environment variables
├── package.json               # Dependencies and scripts
└── plan.md                    # Development plan with checkpoints
```

## 🔧 Configuration

| Variable | Description | Default |
|----------|------------|---------|
| `NOTION_API_KEY` | Notion integration token | _(required)_ |
| `NOTION_DATABASE_ID` | Existing database ID (leave empty to auto-create) | _(auto)_ |
| `PORT` | Server port number | `3000` |

## 🔄 API Key Rotation

The system supports multiple Gemini API keys for:

- **Load Balancing**: Random key selection distributes requests across keys
- **Failover**: If one key fails (rate limit, error), automatically retries with next key
- **Usage Tracking**: View request count and last used timestamp per key

### Managing Keys via UI

1. Scroll to **⚙️ Gemini API Keys** section
2. Paste a key and click **"Add Key"**
3. View all keys in the table with usage statistics
4. Delete keys with the **Delete** button

## 🐛 Troubleshooting

### "No Gemini API keys configured"

- Add at least one API key in the ⚙️ section of the UI
- Keys are stored in memory and lost on server restart — re-add after restart

### "No pages found in Notion workspace"

- Share at least one Notion page with your integration (see Step 3 in API Key Setup)
- The integration needs access to create databases under a parent page

### "NOTION_API_KEY not set"

- Ensure `.env` file exists with `NOTION_API_KEY=secret_...`
- Restart the server after modifying `.env`

### Gemini API rate limit errors

- Add more API keys to distribute the load
- The system automatically retries with different keys on failure

### TypeScript compilation errors

```bash
# Verify TypeScript compiles
bun run type-check

# Reinstall dependencies
bun install
```

## 📝 Development Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start server with hot reload |
| `bun run start` | Start server in production mode |
| `bun run type-check` | Run TypeScript type checking |

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/) — Fast JavaScript/TypeScript runtime
- **AI Model**: [Gemini 3 Flash Preview](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash) — Multimodal OCR with structured output
- **Database**: [Notion API](https://developers.notion.com/) — Workspace database for invoice storage
- **Frontend**: Vanilla HTML/CSS/JS — Simple, no build step required

## 📄 License

MIT
