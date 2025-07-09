// index.js

const fs = require("fs");
const path = require("path");
const { loadState, updateState, clearDownload } = require("./modules/downloadState");
const { downloadMessageMedia } = require("./modules/messages");
const ChannelDownloader = require("./scripts/download-channel");

// ---- CONFIGURATION ----
const CHANNEL_ID = ""; // ← set your target channel ID here
const DOWNLOAD_DIR = path.resolve(__dirname, "export");
const DOWNLOADABLE_TYPES = {
  webpage: true,
  poll:    true,
  geo:     true,
  contact: true,
  venue:   true,
  sticker: true,
  image:   true,
  video:   true,
  audio:   true,
  pdf:     true,
};
// -----------------------

async function main() {
  // 1. Ensure download dir exists
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  // 2. Load persisted resume state and reconcile with actual files
  const state = loadState();
  for (const [mediaId, entry] of Object.entries(state)) {
    if (entry.outputFile && fs.existsSync(entry.outputFile)) {
      const actualSize = fs.statSync(entry.outputFile).size;
      // If total known and file is already complete, clear its state
      if (entry.total != null && actualSize >= entry.total) {
        clearDownload(mediaId);
      } else {
        // Update offset to the larger of actual file size or saved offset
        const offset = Math.max(actualSize, entry.offset || 0);
        updateState(mediaId, {
          offset,
          total: entry.total,
          outputFile: entry.outputFile,
        });
      }
    }
  }

  // 3. Instantiate ChannelDownloader and collect tasks instead of downloading
  const channelDownloader = new ChannelDownloader();
  const allTasks = await channelDownloader.handle({
    channelId: CHANNEL_ID,
    downloadableFiles: DOWNLOADABLE_TYPES,
    downloadDir: DOWNLOAD_DIR,
    collectOnly: true,      // <-- MUST be supported: returns [{message,mediaPath},…]
  });

  // 4. Split into resume-first and new queues
  const resumeQueue = [];
  const newQueue = [];

  for (const task of allTasks) {
    const id = String(task.message.id);
    const entry = state[id];
    if (entry && entry.offset < entry.total) {
      resumeQueue.push(task);
    } else if (!entry) {
      newQueue.push(task);
    }
  }

  // 5. Process resume queue, then new downloads
  console.log("Resuming incomplete downloads...");
  for (const { message, mediaPath } of resumeQueue) {
    await downloadMessageMedia(channelDownloader.client, message, mediaPath);
  }

  console.log("Starting new downloads...");
  for (const { message, mediaPath } of newQueue) {
    await downloadMessageMedia(channelDownloader.client, message, mediaPath);
  }

  console.log("All downloads complete.");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
