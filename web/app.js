const SAMPLE_BATCHES = {
  "BATCH101": {
    "batchId": "BATCH101",
    "farmLocation": "Tagum Plantation Farm 4",
    "harvestDate": "2026-07-29",
    "weightKg": 1500.5,
    "currentOwner": "Hijo Logistics",
    "transportStatus": "IN_TRANSIT_COLD_STORAGE",
    "temperatureDegC": 13.5,
    "portCustomsClear": false,
    "updatedByUid": "EMP-LOG-002"
  },
  "BATCH102": {
    "batchId": "BATCH102",
    "farmLocation": "Davao Agri Sector 2",
    "harvestDate": "2026-07-29",
    "weightKg": 2100.0,
    "currentOwner": "Hijo Agriculture",
    "transportStatus": "HARVESTED_AT_FARM",
    "temperatureDegC": 18.0,
    "portCustomsClear": false,
    "updatedByUid": "EMP-AGRI-001"
  },
  "BATCH103": {
    "batchId": "BATCH103",
    "farmLocation": "Carmen Export Farm 1",
    "harvestDate": "2026-07-28",
    "weightKg": 3400.8,
    "currentOwner": "Global Shipping Line",
    "transportStatus": "LOADED_ON_VESSEL",
    "temperatureDegC": 12.0,
    "portCustomsClear": true,
    "updatedByUid": "EMP-PORT-003"
  },
  "BATCH106": {
    "batchId": "BATCH106",
    "farmLocation": "Tagum Plantation Sector 5",
    "harvestDate": "2026-07-30",
    "weightKg": 1850.0,
    "currentOwner": "Hijo Agriculture",
    "transportStatus": "HARVESTED_AT_FARM",
    "temperatureDegC": 18.0,
    "portCustomsClear": false,
    "updatedByUid": "EMP-AGRI-001"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  updateFormFields();
  loadActiveBatches();
  fetchLiveLogs();
  startLogPolling();
});

function handleBatchIdSelectChange() {
  const inputSelect = document.getElementById("inputBatchSelect");
  const newGroup = document.getElementById("newBatchGroup");
  const actionSelect = document.getElementById("txAction");
  if (!inputSelect || !newGroup) return;

  const action = actionSelect ? actionSelect.value : "CreateBatch";
  if (action === "CreateBatch" && inputSelect.value === "__NEW__") {
    newGroup.style.display = "block";
  } else {
    newGroup.style.display = "none";
  }
}

function calculateNextBatchId(batches) {
  if (!Array.isArray(batches) || batches.length === 0) {
    return "BATCH101";
  }

  let maxNum = 100;
  batches.forEach(b => {
    if (b && b.batchId) {
      const match = b.batchId.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });

  return "BATCH" + (maxNum + 1);
}

async function loadActiveBatches(selectedIdToKeep = null) {
  const select = document.getElementById("batchSelect");
  const existSelect = document.getElementById("inputExistingBatchSelect");
  const newIdInput = document.getElementById("inputNewBatchId");
  if (!select) return;

  try {
    const res = await fetch("/api/batches");
    const result = await res.json();
    if (result.status === "SUCCESS" && Array.isArray(result.batches)) {
      select.innerHTML = "";
      if (existSelect) {
        existSelect.innerHTML = "";
      }

      // Auto-increment New Batch UID
      const nextId = calculateNextBatchId(result.batches);
      if (newIdInput) {
        newIdInput.value = nextId;
      }

      if (result.batches.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "-- Fresh Ledger (Create a new batch below) --";
        select.appendChild(opt);

        if (existSelect) {
          const optE = document.createElement("option");
          optE.value = "BATCH101";
          optE.textContent = "BATCH101 (Sample)";
          existSelect.appendChild(optE);
        }

        document.getElementById("jsonViewer").textContent = JSON.stringify({ message: "Ledger is fresh and empty. Use the Blockchain Transaction Simulator form to create a new batch!" }, null, 2);
        document.getElementById("auditTimeline").innerHTML = "<div class='timeline-card'><div class='timeline-card-header'><span>FRESH LEDGER STATE</span></div><div class='timeline-body'><span class='timeline-tag'>Zero blocks committed yet</span></div></div>";
        document.getElementById("historyCount").textContent = "0 Revisions";
        updatePipelineUI(null);
        return;
      }

      result.batches.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.batchId;
        opt.textContent = `${b.batchId} - ${b.farmLocation || ''} (${b.transportStatus || 'ACTIVE'})`;
        select.appendChild(opt);

        if (existSelect) {
          const inOpt = document.createElement("option");
          inOpt.value = b.batchId;
          inOpt.textContent = `${b.batchId} - ${b.farmLocation || ''} (${b.transportStatus || 'ACTIVE'})`;
          existSelect.appendChild(inOpt);
        }
      });

      if (selectedIdToKeep) {
        select.value = selectedIdToKeep;
        if (existSelect && Array.from(existSelect.options).some(o => o.value === selectedIdToKeep)) {
          existSelect.value = selectedIdToKeep;
        }
      }
      renderSelectedBatch();
      return;
    }
  } catch (err) {
    console.warn("Failed to load active batches:", err);
  }
  renderSelectedBatch();
}

function updatePipelineUI(batchData) {
  const farmStep = document.getElementById("step-farm");
  const logisticsStep = document.getElementById("step-logistics");
  const portStep = document.getElementById("step-port");
  const line1 = document.getElementById("line-farm-logistics");
  const line2 = document.getElementById("line-logistics-port");

  if (!farmStep || !logisticsStep || !portStep) return;

  farmStep.classList.remove("active");
  logisticsStep.classList.remove("active");
  portStep.classList.remove("active");
  if (line1) line1.classList.remove("active");
  if (line2) line2.classList.remove("active");

  if (!batchData) return;

  const status = String(batchData.transportStatus || "").toUpperCase();
  const customsClear = Boolean(batchData.portCustomsClear);

  if (status.includes("VESSEL") || status.includes("EXPORT") || customsClear) {
    farmStep.classList.add("active");
    if (line1) line1.classList.add("active");
    logisticsStep.classList.add("active");
    if (line2) line2.classList.add("active");
    portStep.classList.add("active");
  } else if (status.includes("TRANSIT") || status.includes("COLD") || status.includes("ARRIVED") || status.includes("LOGISTICS")) {
    farmStep.classList.add("active");
    if (line1) line1.classList.add("active");
    logisticsStep.classList.add("active");
  } else {
    // HARVESTED_AT_FARM or default active stage 1 (Farm step lights up!)
    farmStep.classList.add("active");
  }
}

async function renderSelectedBatch() {
  const batchSelect = document.getElementById("batchSelect");
  if (!batchSelect) return;
  const batchId = batchSelect.value;
  let batchData = null;

  try {
    const res = await fetch(`/api/query?batchId=${encodeURIComponent(batchId)}`);
    const result = await res.json();
    if (result.status === "SUCCESS" && result.data) {
      batchData = result.data;
    }
  } catch (e) {
    console.warn("Live query fallback to sample data:", e);
  }

  if (!batchData) {
    batchData = SAMPLE_BATCHES[batchId] || SAMPLE_BATCHES["BATCH101"];
  }

  document.getElementById("jsonViewer").textContent = JSON.stringify(batchData, null, 2);
  updatePipelineUI(batchData);
  fetchBatchHistory(batchId);
}

async function fetchBatchHistory(batchId) {
  const timelineDiv = document.getElementById("auditTimeline");
  const countBadge = document.getElementById("historyCount");
  if (!timelineDiv) return;

  try {
    const res = await fetch(`/api/history?batchId=${encodeURIComponent(batchId)}`);
    const result = await res.json();

    if (result.status === "SUCCESS" && Array.isArray(result.history) && result.history.length > 0) {
      const history = result.history;
      countBadge.textContent = `${history.length} Blockchain Revisions`;

      timelineDiv.innerHTML = history.map((record, index) => {
        const val = record.value || {};
        const formattedDate = record.timestamp ? new Date(record.timestamp).toLocaleString() : "Tx Timestamp";
        const shortTx = record.txId ? record.txId.substring(0, 16) + "..." : "TxID";

        return `
          <div class="timeline-card">
            <div class="timeline-card-header">
              <span><strong>Rev #${index + 1}</strong> — ${val.transportStatus || 'CREATED'}</span>
              <span class="timeline-tx" title="${record.txId}">TxID: ${shortTx}</span>
            </div>
            <div class="timeline-body">
              <span class="timeline-tag"><i class="fa-solid fa-clock"></i> ${formattedDate}</span>
              <span class="timeline-tag"><i class="fa-solid fa-user"></i> ${val.updatedByUid || 'SYSTEM'}</span>
              <span class="timeline-tag"><i class="fa-solid fa-temperature-half"></i> ${val.temperatureDegC !== undefined ? val.temperatureDegC + ' °C' : 'N/A'}</span>
              <span class="timeline-tag"><i class="fa-solid fa-building"></i> ${val.currentOwner || 'N/A'}</span>
            </div>
          </div>
        `;
      }).reverse().join("");
      return;
    }
  } catch (err) {
    console.warn("History fetch fallback:", err);
  }

  countBadge.textContent = "1 Initial Revision";
  timelineDiv.innerHTML = `
    <div class="timeline-card">
      <div class="timeline-card-header">
        <span><strong>Rev #1</strong> — INITIAL CREATION</span>
        <span class="timeline-tx">Genesis Ledger State</span>
      </div>
      <div class="timeline-body">
        <span class="timeline-tag"><i class="fa-solid fa-clock"></i> Live Ledger Block</span>
        <span class="timeline-tag"><i class="fa-solid fa-user"></i> EMP-AGRI-001</span>
      </div>
    </div>
  `;
}

function showSuccessBanner(msg, txId = "") {
  const banner = document.getElementById("txSuccessBanner");
  const msgEl = document.getElementById("txSuccessMsg");
  const txEl = document.getElementById("txSuccessTxId");
  if (!banner) return;

  msgEl.textContent = msg;
  txEl.textContent = txId ? `TxID: ${txId.substring(0, 16)}...` : "";
  banner.style.display = "flex";

  const inspector = document.getElementById("batchSelect");
  if (inspector) {
    inspector.style.borderColor = "#10b981";
    inspector.style.boxShadow = "0 0 15px rgba(16, 185, 129, 0.5)";
    setTimeout(() => {
      inspector.style.borderColor = "";
      inspector.style.boxShadow = "";
    }, 2500);
  }

  setTimeout(() => {
    banner.style.display = "none";
  }, 6000);
}

async function handleTransaction(event) {
  event.preventDefault();
  const action = document.getElementById("txAction").value;
  
  let batchId = "";
  if (action === "CreateBatch") {
    const inputNew = document.getElementById("inputNewBatchId");
    batchId = (inputNew && inputNew.value.trim()) ? inputNew.value.trim() : "BATCH101";
  } else {
    const inputExist = document.getElementById("inputExistingBatchSelect");
    batchId = (inputExist && inputExist.value) ? inputExist.value : "BATCH101";
  }

  const uidSelect = document.getElementById("inputUidSelect");
  const uid = uidSelect ? uidSelect.value : "EMP-AGRI-001";
  const timestamp = new Date().toLocaleTimeString();

  const submitBtn = event.target.querySelector("button[type='submit']");
  const originalBtnContent = submitBtn ? submitBtn.innerHTML : "";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting Endorsement to Fabric...`;
  }

  let args = [];
  if (action === "CreateBatch") {
    args = [
      batchId,
      document.getElementById("paramFarm").value,
      document.getElementById("paramDate").value,
      document.getElementById("paramWeight").value,
      uid
    ];
  } else if (action === "UpdateTransportTelemetry") {
    args = [
      batchId,
      document.getElementById("paramStatus").value,
      document.getElementById("paramTemp").value,
      document.getElementById("paramOwner").value,
      uid
    ];
  } else if (action === "ClearForExport") {
    args = [batchId, uid];
  }

  logConsole(`[${timestamp}] 🚀 Submitting transaction for '${action}' (${batchId})...`);

  try {
    const response = await fetch("/api/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: action, args })
    });
    const result = await response.json();

    if (result.status === "SUCCESS") {
      logConsole(`[${timestamp}] ⚡ Endorsed by AgriMSP, LogisticsMSP, PortMSP! status:200`);
      logConsole(`[${timestamp}] 📦 Committed to World State (CouchDB).`);
      
      showSuccessBanner(`Batch ${batchId} successfully endorsed & committed to Block Ledger!`);

      // 1. Immediately force DOM dropdown update so user sees it with 0ms delay
      const mainSelect = document.getElementById("batchSelect");
      if (mainSelect) {
        let optFound = Array.from(mainSelect.options).find(o => o.value === batchId);
        if (!optFound) {
          optFound = document.createElement("option");
          optFound.value = batchId;
          optFound.textContent = `${batchId} (Newly Committed)`;
          mainSelect.appendChild(optFound);
        }
        mainSelect.value = batchId;
      }
      renderSelectedBatch();

      // 2. Fetch full updated batch list and auto-increment next batch ID
      await loadActiveBatches(batchId);
      setTimeout(() => loadActiveBatches(batchId), 600);
      setTimeout(() => loadActiveBatches(batchId), 1500);
    } else {
      logConsole(`[${timestamp}] ❌ Endorsement Failed: ${result.output || "Unknown error"}`);
    }
  } catch (err) {
    logConsole(`[${timestamp}] ℹ️ Transaction error: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnContent;
    }
  }
}

function updateFormFields() {
  const actionEl = document.getElementById("txAction");
  if (!actionEl) return;
  const action = actionEl.value;

  const gNew = document.getElementById("groupNewBatchId");
  const gExist = document.getElementById("groupExistingBatchId");
  const fCreate = document.getElementById("fieldsCreateBatch");
  const fTelem = document.getElementById("fieldsTelemetry");
  const fExport = document.getElementById("fieldsExport");
  const uidSel = document.getElementById("inputUidSelect");

  if (!gNew || !gExist || !fCreate || !fTelem || !fExport) return;

  if (action === "CreateBatch") {
    gNew.style.display = "block";
    gExist.style.display = "none";
    fCreate.style.display = "block";
    fTelem.style.display = "none";
    fExport.style.display = "none";

    if (uidSel) {
      uidSel.innerHTML = `
        <option value="EMP-AGRI-001">EMP-AGRI-001 (Farm Supervisor)</option>
        <option value="EMP-AGRI-002">EMP-AGRI-002 (Harvest Inspector)</option>
        <option value="EMP-AGRI-007">EMP-AGRI-007 (Rogue Insider Simulation)</option>
      `;
    }
  } else if (action === "UpdateTransportTelemetry") {
    gNew.style.display = "none";
    gExist.style.display = "block";
    fCreate.style.display = "none";
    fTelem.style.display = "block";
    fExport.style.display = "none";

    if (uidSel) {
      uidSel.innerHTML = `
        <option value="EMP-LOG-002">EMP-LOG-002 (Cold Truck Driver)</option>
        <option value="EMP-LOG-005">EMP-LOG-005 (Warehouse Manager)</option>
      `;
    }
  } else if (action === "ClearForExport") {
    gNew.style.display = "none";
    gExist.style.display = "block";
    fCreate.style.display = "none";
    fTelem.style.display = "none";
    fExport.style.display = "block";

    if (uidSel) {
      uidSel.innerHTML = `
        <option value="EMP-PORT-003">EMP-PORT-003 (Customs Officer)</option>
        <option value="EMP-PORT-009">EMP-PORT-009 (Berth Inspector)</option>
      `;
    }
  }
}

let autoRefreshEnabled = true;
let logPollTimer = null;

function startLogPolling() {
  if (logPollTimer) clearInterval(logPollTimer);
  logPollTimer = setInterval(() => {
    if (autoRefreshEnabled) {
      fetchLiveLogs();
    }
  }, 3000);
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  const btn = document.getElementById("autoRefreshBtn");
  if (autoRefreshEnabled) {
    btn.textContent = "Auto Refresh: ON";
    btn.className = "btn btn-secondary";
    fetchLiveLogs();
  } else {
    btn.textContent = "Auto Refresh: OFF";
    btn.className = "btn btn-primary";
  }
}

async function fetchLiveLogs() {
  const select = document.getElementById("logNodeSelect");
  if (!select) return;
  const node = select.value;
  document.getElementById("terminalTitle").textContent = `DOCKER LOG STREAM — ${node}`;

  try {
    const res = await fetch(`/api/logs?node=${encodeURIComponent(node)}&lines=60`);
    const data = await res.json();
    const terminal = document.getElementById("logTerminal");

    if (data.status === "SUCCESS") {
      let raw = data.logs;
      if (!raw || raw.trim() === "") {
        terminal.textContent = "[LOG ENGINE] Container connected. Waiting for new log events...";
        return;
      }
      terminal.textContent = raw;
      terminal.scrollTop = terminal.scrollHeight;
    } else {
      terminal.textContent = `[ERROR] Failed to read container logs: ${data.error}`;
    }
  } catch (err) {
    console.error("Log fetch error:", err);
  }
}

function logConsole(msg) {
  const consoleOutput = document.getElementById("consoleOutput");
  if (!consoleOutput) return;
  consoleOutput.innerHTML += `<br>${msg}`;
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function loadSampleData() {
  renderSelectedBatch();
  logConsole(`[SYSTEM] Refreshed world state from CouchDB cluster.`);
}

async function openCertModal(org) {
  const modal = document.getElementById("certModal");
  modal.classList.add("active");
  document.getElementById("certOrgTag").textContent = `ORGANIZATION: ${org.toUpperCase()} MSP`;
  document.getElementById("certText").textContent = "Fetching OpenSSL X.509 certificate data...";
  document.getElementById("certPem").textContent = "Fetching raw PEM string...";

  try {
    const res = await fetch(`/api/cert?org=${encodeURIComponent(org)}`);
    const data = await res.json();
    if (data.status === "SUCCESS") {
      document.getElementById("certPathTag").textContent = data.path;
      document.getElementById("certText").textContent = data.text;
      document.getElementById("certPem").textContent = data.pem;
    } else {
      document.getElementById("certText").textContent = `Error: ${data.error}`;
    }
  } catch (err) {
    document.getElementById("certText").textContent = `Network error: ${err.message}`;
  }
}

function closeCertModal() {
  document.getElementById("certModal").classList.remove("active");
}
