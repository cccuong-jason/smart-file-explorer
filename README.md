# Smart File Explorer 🧠📂

A modern, client-side file explorer built with Next.js that leverages local AI to help you find, organize, and understand your files without uploading data to the cloud.

![Smart File Explorer Logo](public/logo.png)

## ✨ Features

- **🚀 Local-First Architecture**: Uses the File System Access API to scan folders directly on your device. No data is ever uploaded.
- **🔍 Intelligent Search**:
  - **Keyword Search**: Instant fuzzy matching for filenames.
  - **Semantic Search**: Powered by `@xenova/transformers` (all-MiniLM-L6-v2) to find files by *meaning* (e.g., search "budget" to find spreadsheets).
- **🏷️ Tagging System**: Organize files with custom tags for quick filtering.
- **📄 Instant Preview**: View text, code, and markdown files instantly with syntax highlighting support.
- **🔗 Related Files**: Automatically discovers contextually similar files based on vector embeddings.
- **📊 Rich Filtering**: Filter by file type, date modified, size, and tags.
- **⚡ Performance Optimized**: Incremental indexing using IndexedDB - only re-scans changed files.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Local Database**: IndexedDB (via `idb`)
- **AI/ML**: Transformers.js (in-browser embeddings)
- **Search**: Fuse.js + Cosine Similarity
- **Icons**: Lucide React

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/smart-file-explorer.git
   cd smart-file-explorer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   Navigate to [http://localhost:3000](http://localhost:3000).

## 🔒 Security & Privacy

- **Client-Side Only**: All processing (scanning, embedding generation, search) happens in your browser.
- **Sandboxed Access**: The browser requires explicit permission to read any folder.
- **No Telemetry**: The app does not track your file contents.

## 📦 Deployment

This project is optimized for deployment on Vercel. Since it relies on client-side APIs, it can be deployed as a static site or serverless app.

```bash
npm run build
```

## 📝 License

MIT License

