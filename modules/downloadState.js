// modules/downloadState.js
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.resolve(__dirname, '../downloads.json');

// Load or initialize the state object
function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// Save the entire state object to disk
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Create or update a download entry (with offset, total, and outputFile)
function updateState(mediaId, { offset, outputFile, total }) {
  const state = loadState();
  state[mediaId] = Object.assign(state[mediaId] || {}, { offset, outputFile, total });
  saveState(state);
}

// Remove a completed download
function clearDownload(mediaId) {
  const state = loadState();
  delete state[mediaId];
  saveState(state);
}

// Retrieve the saved offset for a given mediaId
function getOffset(mediaId) {
  const state = loadState();
  return state[mediaId]?.offset || 0;
}

module.exports = { loadState, saveState, updateState, clearDownload, getOffset };
