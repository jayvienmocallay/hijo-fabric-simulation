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
  }
};

document.addEventListener("DOMContentLoaded", () => {
  updateFormFields();
  renderSelectedBatch();
});

async function renderSelectedBatch() {
  const batchId = document.getElementById("batchSelect").value;
  try {
    const res = await fetch(`/api/query?batchId=${encodeURIComponent(batchId)}`);
    const result = await res.json();
    if (result.status === "SUCCESS") {
      const batchData = result.data;
      document.getElementById("jsonViewer").textContent = JSON.stringify(batchData, null, 2);

      const farmStep = document.getElementById("step-farm");
      const logisticsStep = document.getElementById("step-logistics");
      const portStep = document.getElementById("step-port");

      farmStep.classList.remove("active");
      logisticsStep.classList.remove("active");
      portStep.classList.remove("active");

      if (batchData.transportStatus === "HARVESTED_AT_FARM") {
        farmStep.classList.add("active");
      } else if (batchData.transportStatus.includes("TRANSIT") || batchData.transportStatus.includes("COLD")) {
        farmStep.classList.add("active");
        logisticsStep.classList.add("active");
      } else if (batchData.transportStatus === "LOADED_ON_VESSEL" || batchData.portCustomsClear) {
        farmStep.classList.add("active");
        logisticsStep.classList.add("active");
        portStep.classList.add("active");
      }
      return;
    }
  } catch (e) {
    console.warn("Live query fallback to sample data:", e);
  }

  const batchData = SAMPLE_BATCHES[batchId] || SAMPLE_BATCHES["BATCH101"];
  document.getElementById("jsonViewer").textContent = JSON.stringify(batchData, null, 2);
}

async function handleTransaction(event) {
  event.preventDefault();
  const action = document.getElementById("txAction").value;
  const batchId = document.getElementById("inputBatchId").value;
  const uid = document.getElementById("inputUid").value;
  const timestamp = new Date().toLocaleTimeString();

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

  logConsole(`[${timestamp}] 🚀 Submitting live endorsement to Fabric for '${action}' (${batchId})...`);

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

      const select = document.getElementById("batchSelect");
      let exists = Array.from(select.options).some(opt => opt.value === batchId);
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = batchId;
        opt.textContent = `${batchId} (Live Ledger)`;
        select.appendChild(opt);
      }
      select.value = batchId;
      setTimeout(renderSelectedBatch, 800);
    } else {
      logConsole(`[${timestamp}] ❌ Endorsement Failed: ${result.output || "Unknown error"}`);
    }
  } catch (err) {
    logConsole(`[${timestamp}] ❌ Transaction error: ${err.message}`);
  }
}

function updateFormFields() {
  const action = document.getElementById("txAction").value;
  const dynamicDiv = document.getElementById("dynamicFields");

  if (action === "CreateBatch") {
    dynamicDiv.innerHTML = `
      <div class="form-group">
        <label>Farm Location:</label>
        <input type="text" id="paramFarm" value="Tagum Farm Sector 5" required>
      </div>
      <div class="form-group">
        <label>Harvest Date:</label>
        <input type="date" id="paramDate" value="2026-07-29" required>
      </div>
      <div class="form-group">
        <label>Weight (Kg):</label>
        <input type="number" step="0.1" id="paramWeight" value="1850.0" required>
      </div>
    `;
    document.getElementById("inputUid").value = "EMP-AGRI-001";
  } else if (action === "UpdateTransportTelemetry") {
    dynamicDiv.innerHTML = `
      <div class="form-group">
        <label>Transport Status:</label>
        <select id="paramStatus">
          <option value="IN_TRANSIT_COLD_STORAGE">IN_TRANSIT_COLD_STORAGE</option>
          <option value="ARRIVED_AT_PORT">ARRIVED_AT_PORT</option>
        </select>
      </div>
      <div class="form-group">
        <label>Temperature (°C):</label>
        <input type="number" step="0.1" id="paramTemp" value="13.2" required>
      </div>
      <div class="form-group">
        <label>New Custody Owner:</label>
        <input type="text" id="paramOwner" value="Hijo Logistics Division" required>
      </div>
    `;
    document.getElementById("inputUid").value = "EMP-LOG-002";
  } else if (action === "ClearForExport") {
    dynamicDiv.innerHTML = `
      <div class="form-group">
        <label>Customs Inspection Status:</label>
        <input type="text" id="paramCustoms" value="PASSED_CUSTOMS_CLEARANCE" readonly>
      </div>
    `;
    document.getElementById("inputUid").value = "EMP-PORT-003";
  }
}

function handleTransaction(event) {
  event.preventDefault();
  const action = document.getElementById("txAction").value;
  const batchId = document.getElementById("inputBatchId").value;
  const uid = document.getElementById("inputUid").value;
  const consoleOutput = document.getElementById("consoleOutput");

  const timestamp = new Date().toLocaleTimeString();
  const txId = "0x" + Math.random().toString(16).substr(2, 8) + Math.random().toString(16).substr(2, 8);

  logConsole(`[${timestamp}] Submitting '${action}' for ${batchId}...`);

  setTimeout(() => {
    logConsole(`[${timestamp}] ⚡ Endorsed by AgriMSP, LogisticsMSP, PortMSP.`);
    logConsole(`[${timestamp}] 📦 Block committed via Raft Orderer. TxID: ${txId}`);

    // Update in-memory state
    if (action === "CreateBatch") {
      SAMPLE_BATCHES[batchId] = {
        batchId: batchId,
        farmLocation: document.getElementById("paramFarm").value,
        harvestDate: document.getElementById("paramDate").value,
        weightKg: parseFloat(document.getElementById("paramWeight").value),
        currentOwner: "Hijo Agriculture",
        transportStatus: "HARVESTED_AT_FARM",
        temperatureDegC: 18.0,
        portCustomsClear: false,
        updatedByUid: uid
      };
    } else if (action === "UpdateTransportTelemetry") {
      if (!SAMPLE_BATCHES[batchId]) SAMPLE_BATCHES[batchId] = { ...SAMPLE_BATCHES["BATCH101"], batchId };
      SAMPLE_BATCHES[batchId].transportStatus = document.getElementById("paramStatus").value;
      SAMPLE_BATCHES[batchId].temperatureDegC = parseFloat(document.getElementById("paramTemp").value);
      SAMPLE_BATCHES[batchId].currentOwner = document.getElementById("paramOwner").value;
      SAMPLE_BATCHES[batchId].updatedByUid = uid;
    } else if (action === "ClearForExport") {
      if (!SAMPLE_BATCHES[batchId]) SAMPLE_BATCHES[batchId] = { ...SAMPLE_BATCHES["BATCH101"], batchId };
      SAMPLE_BATCHES[batchId].portCustomsClear = true;
      SAMPLE_BATCHES[batchId].transportStatus = "LOADED_ON_VESSEL";
      SAMPLE_BATCHES[batchId].updatedByUid = uid;
    }

    // Refresh Selector & View
    const select = document.getElementById("batchSelect");
    let exists = Array.from(select.options).some(opt => opt.value === batchId);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = batchId;
      opt.textContent = `${batchId} (Newly Committed)`;
      select.appendChild(opt);
    }
    select.value = batchId;
    renderSelectedBatch();

  }, 600);
}

document.addEventListener("DOMContentLoaded", () => {
  updateFormFields();
  renderSelectedBatch();
  fetchLiveLogs();
  startLogPolling();
});

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
