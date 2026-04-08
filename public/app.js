// State
const state = {
  files: [],
  isProcessing: false,
};

// DOM Elements
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const processBtn = document.getElementById("process-btn");
const btnText = processBtn.querySelector(".btn-text");
const btnLoader = processBtn.querySelector(".btn-loader");
const resultsSection = document.getElementById("results-section");
const summaryDiv = document.getElementById("summary");
const resultsDiv = document.getElementById("results");
const keyInput = document.getElementById("key-input");
const addKeyBtn = document.getElementById("add-key-btn");
const keysTable = document.getElementById("keys-table");
const keysTbody = document.getElementById("keys-tbody");
const keysMessage = document.getElementById("keys-message");

// Utility: format file size
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// Utility: format date
function formatDate(dateStr) {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// File Management
function addFile(file) {
  state.files.push(file);
  renderFileList();
}

function removeFile(index) {
  state.files.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  if (state.files.length === 0) {
    fileList.innerHTML = "";
    processBtn.disabled = true;
    return;
  }

  processBtn.disabled = false;
  fileList.innerHTML = state.files
    .map(
      (file, index) => `
    <div class="file-item">
      <div class="file-info">
        <span class="file-icon">${getFileIcon(file.name)}</span>
        <div>
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-size">${formatSize(file.size)}</div>
        </div>
      </div>
      <button class="file-remove" onclick="removeFile(${index})" title="Remove">✕</button>
    </div>
  `
    )
    .join("");
}

function getFileIcon(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📄";
  return "🖼️";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Drag & Drop
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const files = Array.from(e.dataTransfer.files);
  files.forEach((file) => addFile(file));
});

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files || []);
  files.forEach((file) => addFile(file));
  fileInput.value = ""; // Reset so same file can be re-added
});

// Process Button
processBtn.addEventListener("click", async () => {
  if (state.isProcessing || state.files.length === 0) return;

  state.isProcessing = true;
  processBtn.disabled = true;
  btnText.hidden = true;
  btnLoader.hidden = false;
  resultsSection.hidden = true;

  try {
    const formData = new FormData();
    state.files.forEach((file) => formData.append("files", file));

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    renderResults(data);
  } catch (error) {
    renderError(error.message);
  } finally {
    state.isProcessing = false;
    processBtn.disabled = false;
    btnText.hidden = false;
    btnLoader.hidden = true;
  }
});

// Results Rendering
function renderResults(data) {
  resultsSection.hidden = false;

  // Summary
  let summaryClass = "success";
  let summaryText = `✅ All ${data.total} files processed successfully!`;

  if (data.failCount > 0 && data.successCount > 0) {
    summaryClass = "partial";
    summaryText = `⚠️ ${data.successCount}/${data.total} succeeded, ${data.failCount} failed`;
  } else if (data.failCount === data.total) {
    summaryClass = "error";
    summaryText = `❌ All ${data.total} files failed to process`;
  }

  summaryDiv.className = `summary ${summaryClass}`;
  summaryDiv.textContent = summaryText;

  // Individual results
  resultsDiv.innerHTML = data.results
    .map((result) => {
      if (result.success) {
        const invoice = result.invoiceData;
        const lineItemsHtml = invoice.lineItems
          .map(
            (item) => `
          <li>${escapeHtml(item.description)} — Qty: ${item.quantity} × ${invoice.currency} ${item.unitPrice.toFixed(2)} = <strong>${invoice.currency} ${item.total.toFixed(2)}</strong></li>
        `
          )
          .join("");

        return `
          <div class="result-card success">
            <div class="result-header">
              <span class="result-file">${escapeHtml(result.fileName)}</span>
              <span class="status-badge success">✓ Success</span>
            </div>
            <div class="invoice-summary">
              <div class="invoice-field">
                <label>Invoice #</label>
                <value>${escapeHtml(invoice.invoiceNumber)}</value>
              </div>
              <div class="invoice-field">
                <label>Date</label>
                <value>${invoice.date}</value>
              </div>
              <div class="invoice-field">
                <label>Due Date</label>
                <value>${invoice.dueDate || "Not specified"}</value>
              </div>
              <div class="invoice-field">
                <label>Vendor</label>
                <value>${escapeHtml(invoice.vendor.name)}</value>
              </div>
              <div class="invoice-field">
                <label>Customer</label>
                <value>${escapeHtml(invoice.customer.name)}</value>
              </div>
              <div class="invoice-field">
                <label>Total</label>
                <value>${invoice.currency} ${invoice.total.toFixed(2)}</value>
              </div>
            </div>
            ${
              invoice.lineItems.length > 0
                ? `
              <h4 style="margin-top: 0.75rem; margin-bottom: 0.5rem; font-size: 0.9rem;">Line Items</h4>
              <ol class="line-items-list">${lineItemsHtml}</ol>
              <div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: var(--bg); border-radius: var(--radius); font-size: 0.875rem;">
                <div>Subtotal: ${invoice.currency} ${invoice.subtotal.toFixed(2)}</div>
                <div>Tax: ${invoice.currency} ${invoice.tax.toFixed(2)}</div>
                <div><strong>Total: ${invoice.currency} ${invoice.total.toFixed(2)}</strong></div>
              </div>
            `
                : ""
            }
            ${result.error ? `<div class="message warning" style="margin-top: 0.75rem;">⚠️ ${escapeHtml(result.error)}</div>` : ""}
          </div>
        `;
      } else {
        return `
          <div class="result-card error">
            <div class="result-header">
              <span class="result-file">${escapeHtml(result.fileName)}</span>
              <span class="status-badge error">✗ Failed</span>
            </div>
            <p class="error-message">${escapeHtml(result.error)}</p>
          </div>
        `;
      }
    })
    .join("");

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderError(message) {
  resultsSection.hidden = false;
  summaryDiv.className = "summary error";
  summaryDiv.textContent = "❌ Processing failed";
  resultsDiv.innerHTML = `
    <div class="result-card error">
      <p class="error-message">${escapeHtml(message)}</p>
    </div>
  `;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// API Key Management
addKeyBtn.addEventListener("click", async () => {
  const key = keyInput.value.trim();
  if (!key) return;

  addKeyBtn.disabled = true;
  addKeyBtn.textContent = "Adding...";

  try {
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || "Failed to add key", "error");
      return;
    }

    showMessage("✅ API key added successfully!", "success");
    keyInput.value = "";
    loadKeys();
  } catch (error) {
    showMessage("Failed to connect to server", "error");
  } finally {
    addKeyBtn.disabled = false;
    addKeyBtn.textContent = "Add Key";
  }
});

// Allow Enter key to add API key
keyInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addKeyBtn.click();
  }
});

function showMessage(text, type) {
  keysMessage.textContent = text;
  keysMessage.className = `message ${type}`;
  keysMessage.hidden = false;
  setTimeout(() => {
    keysMessage.hidden = true;
  }, 3000);
}

async function loadKeys() {
  try {
    const response = await fetch("/api/keys");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    renderKeys(data.keys);
  } catch (error) {
    console.error("Failed to load keys:", error);
  }
}

function renderKeys(keys) {
  if (keys.length === 0) {
    keysTable.hidden = true;
    return;
  }

  keysTable.hidden = false;
  keysTbody.innerHTML = keys
    .map(
      (keyInfo) => `
    <tr>
      <td><span class="key-id">${escapeHtml(keyInfo.id)}</span></td>
      <td>${keyInfo.requestCount}</td>
      <td>${
        keyInfo.lastUsed
          ? formatDate(keyInfo.lastUsed)
          : '<span class="never-used">Never</span>'
      }</td>
      <td>
        <button class="btn btn-danger" onclick="deleteKey('${keyInfo.id}')">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

async function deleteKey(keyId) {
  if (!confirm("Delete this API key?")) return;

  try {
    const response = await fetch(`/api/keys/${keyId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    showMessage("✅ API key deleted", "success");
    loadKeys();
  } catch (error) {
    showMessage("Failed to delete key", "error");
  }
}

// Make functions available globally
window.removeFile = removeFile;
window.deleteKey = deleteKey;

// Initial load
loadKeys();
