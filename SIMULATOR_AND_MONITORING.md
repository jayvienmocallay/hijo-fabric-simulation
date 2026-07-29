# Hijo Resource Corporation - Fabric v2.5 Blockchain Explorer, Transaction Simulator & Monitoring Dashboard

This document provides a detailed technical record of the design, architecture, implementation, issues solved, and operational verification of the **Web Explorer, Live Transaction Simulator, Container Log Dashboard, and X.509 Digital Identity Certificate Inspector** for the Hijo Resource Corporation Hyperledger Fabric v2.5 Blockchain Simulation Network.

---

## 1. Executive Overview

To complement the underlying Hyperledger Fabric v2.5 infrastructure, a modern, real-time **Web Explorer & Transaction Simulator** was developed. It provides full visual telemetry, live block commitment capabilities, real-time Docker container log streaming, and X.509 cryptographic certificate inspection without requiring external third-party heavy dependencies.

### Key Access Endpoints:
- **Web Monitoring & Explorer Dashboard:** [http://localhost:8080](http://localhost:8080)
- **Agri Division CouchDB Fauxton UI:** [http://localhost:5984/_utils](http://localhost:5984/_utils) (User: `admin` / `adminpw`)
- **Logistics Division CouchDB Fauxton UI:** [http://localhost:5985/_utils](http://localhost:5985/_utils) (User: `admin` / `adminpw`)
- **Port Operations Division CouchDB Fauxton UI:** [http://localhost:5986/_utils](http://localhost:5986/_utils) (User: `admin` / `adminpw`)
- **SSO/LDAP REST Gateway API:** [http://localhost:5000](http://localhost:5000)

---

## 2. Web UI Architecture & System Components

The monitoring system is organized into a clean decoupled architecture:

```
+-----------------------------------------------------------------------------------+
|                            WEB BROWSER (PORT 8080)                                |
|  +---------------------+  +----------------------+  +--------------------------+  |
|  | Node Health Monitor |  | Live Batch Tracker   |  | Transaction Simulator    |  |
|  +---------------------+  +----------------------+  +--------------------------+  |
|  +---------------------+  +----------------------+                                |
|  | Log Terminal Stream |  | Certificate Modal    |                                |
|  +---------------------+  +----------------------+                                |
+------------------------------------------+----------------------------------------+
                                           | HTTP / REST API Calls
                                           v
+-----------------------------------------------------------------------------------+
|                        BACKEND SERVER (web/server.py)                             |
|  * Pure Python http.server (No external pip dependencies required)                |
|  * /api/invoke  ---> Triggers `peer chaincode invoke` across 3 Orgs               |
|  * /api/query   ---> Triggers `peer chaincode query` against World State          |
|  * /api/logs    ---> Executes `docker logs --tail 60 <container>`                 |
|  * /api/cert    ---> Parses X.509 certs via `openssl x509 -text -noout`            |
+------------------------------------------+----------------------------------------+
                                           | CLI / Socket Invocation
                                           v
+-----------------------------------------------------------------------------------+
|                     FABRIC BLOCKCHAIN NETWORK (11 NODES)                          |
|  * 3x Raft Orderers  * 3x Org Peers  * 3x CouchDB instances  * 1x CCAAS Server     |
+-----------------------------------------------------------------------------------+
```

---

## 3. Detailed Breakdown of Implemented UI Components

### A. Network Node Health Monitor (11 Operational Nodes)
Displays real-time status cards for all 11 active components in the network:
- **Orderer Cluster:** `orderer1.hijo.com` (7050), `orderer2.hijo.com` (8050), `orderer3.hijo.com` (9050)
- **Peer Nodes:** `peer0.agri.hijo.com` (7051), `peer0.logistics.hijo.com` (8051), `peer0.port.hijo.com` (9051)
- **World State Databases:** `couchdb.agri` (5984), `couchdb.logistics` (5985), `couchdb.port` (5986)
- **Smart Contract Server:** `chaincode.banana.tracking` (9999)
- **Gateway & Server:** Python HTTP Server (8080)

### B. Live Supply Chain Batch Tracker & Inspector
- Interactive pipeline tracker highlighting asset stage:
  1. **Harvest & Pack** (`HARVESTED_AT_FARM`)
  2. **Refrigerated Transit** (`IN_TRANSIT_COLD_STORAGE` / `ARRIVED_AT_PORT`)
  3. **Port Customs & Export** (`LOADED_ON_VESSEL` / `PortCustomsClear = true`)
- Renders live CouchDB JSON payloads directly fetched from the blockchain ledger.

### C. Live Blockchain Transaction Simulator
- Enables submitting 1-click live transactions directly to the network:
  - **`CreateBatch`** (Agri Division)
  - **`UpdateTransportTelemetry`** (Logistics Division)
  - **`ClearForExport`** (Port Operations Division)
- Submits proposals to `/api/invoke`, which executes a live endorsement request signed across all 3 peer organizations.

### D. Real-Time Docker Container Log Terminal
- Dropdown selector to stream live Docker logs from any container node (`peer`, `orderer`, `couchdb`, `chaincode`).
- Features auto-scrolling log engine and **Auto Refresh ON/OFF** toggle (3-second polling interval).

### E. X.509 Digital Identity Certificate Inspector
- Dedicated **`Cert`** button on each organization card.
- Modal opens showing:
  - **Subject CN & Organizational Unit** (e.g., `CN=peer0.agri.hijo.com`, `OU=peer`, `O=agri.hijo.com`)
  - **Issuer CA** (e.g., `CN=ca.agri.hijo.com`)
  - **Validity Window** (10-year PKI validity)
  - **Public Key Algorithm (ECDSA P-256)** and raw PEM string.

---

## 4. Summary of UI & Backend Issues Solved

| Issue Reported | Root Cause | Solution Applied |
| :--- | :--- | :--- |
| **No UI to Monitor Network** | Network previously interacted only via terminal CLI. | Built full-stack Web Monitoring Explorer in `web/` using HTML5, Vanilla CSS, JS, and Python server. |
| **Missing Live Container Log Dashboard** | Logs required running manual `docker logs` commands in bash. | Added `/api/logs` endpoint in `web/server.py` and built a dark-mode terminal log stream viewer. |
| **Card Layout Overlapping Fauxton DB Links & Badges** | `couch-link` and `status-pill` CSS used `position: absolute`, causing text collisions on long titles. | Restructured `.node-card` into flexbox header rows (`.node-card-header`), removing absolute positioning. |
| **Request to Replace Text Emojis** | Standard browser text emojis appeared plain/inconsistent across OS types. | Integrated FontAwesome 6.5.1 vector icons (`fa-boxes-stacked`, `fa-server`, `fa-seedling`, `fa-truck-ramp-box`, `fa-anchor`, `fa-microchip`, `fa-terminal`). |
| **Simulator Operating on Mock State** | Initial simulator UI used client-side memory state. | Connected simulator directly to `/api/invoke` and `/api/query` endpoints executing real 3-org consensus calls. |
| **Need to Inspect Organization Certificates** | Cryptographic X.509 certs were hidden deep inside `crypto-config/` folders. | Created `/api/cert` endpoint running `openssl x509 -text -noout` and built a 1-click Certificate Inspector Modal. |

---

## 5. What "11 Nodes Operational" Means

The system runs 11 active containers/services:

1. `orderer1.hijo.com` — Raft Consensus Orderer 1 (Port 7050)
2. `orderer2.hijo.com` — Raft Consensus Orderer 2 (Port 8050)
3. `orderer3.hijo.com` — Raft Consensus Orderer 3 (Port 9050)
4. `peer0.agri.hijo.com` — Agriculture Division Peer (Port 7051)
5. `peer0.logistics.hijo.com` — Logistics Division Peer (Port 8051)
6. `peer0.port.hijo.com` — Port Operations Division Peer (Port 9051)
7. `couchdb.agri` — Agriculture World State Database (Port 5984)
8. `couchdb.logistics` — Logistics World State Database (Port 5985)
9. `couchdb.port` — Port Operations World State Database (Port 5986)
10. `chaincode.banana.tracking` — CCAAS Chaincode Container (Port 9999)
11. `web/server.py` — Web Monitoring & API Backend Engine (Port 8080)

---

## 6. Automated Endorsement & Tamper-Proofing Mechanics

### Automated Endorsement
- **No manual human approval is required.** When a transaction proposal is submitted, each peer node automatically executes the Go smart contract code in `chaincode/banana_tracking/banana_tracking.go`.
- If all contract logic checks pass, the peer automatically signs the proposal response using its X.509 private key.

### Proven Tamper-Proofing
1. **Rule Enforcement:** Attempting to overwrite an existing asset (`BATCH101`) triggers an automatic error: `batch asset BATCH101 already exists`.
2. **Direct DB Tamper Detection:** Manually altering CouchDB documents directly (e.g. changing temperature to `99.9°C` on `couchdb.agri`) alters the document revision sequence. When a transaction occurs, Read-Set revision mismatches and consensus voting across `logistics` and `port` peers reject unapproved state modifications.
3. **SHA-256 Block Hash Chains:** Historical transaction blocks are immutable and chained cryptographically across orderers and peers.

---

## 7. File Manifest

- **`web/index.html`** — Web Explorer, Batch Inspector, Simulator, Terminal Logs, and Cert Modal HTML structure.
- **`web/styles.css`** — Glassmorphism dark-mode styles, responsive flex grid, and terminal log formatting.
- **`web/app.js`** — Client-side AJAX controller, live API polling, pipeline progress updater, and modal handler.
- **`web/server.py`** — Python standard library HTTP server handling static asset delivery, live container logging, cert parsing, and chaincode invocations/queries.
- **`SIMULATOR_AND_MONITORING.md`** — Comprehensive operational documentation (this file).

---

*Documentation compiled and verified on July 29, 2026 for Hijo Resource Corporation.*
