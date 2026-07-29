# Step-by-Step Guide: Simulating & Detecting a Database Tamper Attack

This guide provides a step-by-step tutorial on how to simulate a direct **database tamper attack** on the Hijo Resource Corporation Hyperledger Fabric network using command-line tools (`curl`, `jq`, `peer`), how to visually inspect the tampered data across nodes, and how the blockchain consensus protocol detects and blocks the attack.

---

## 1. Attack Scenario Overview

In a permissioned blockchain network, CouchDB instances hold the local **World State** for each peer node:
- **`couchdb.agri`** (Port `5984`) — Agriculture Peer Database
- **`couchdb.logistics`** (Port `5985`) — Logistics Peer Database
- **`couchdb.port`** (Port `5986`) — Port Operations Peer Database

**The Attack:** An attacker with local server/database access bypasses the Hyperledger Fabric peer software and sends a direct HTTP payload to `couchdb.agri` to illegally modify a batch's ownership, temperature, and customs clearance status.

---

## 2. Prerequisites

Ensure the simulation network is up and operational:

```bash
cd /home/jeb/project/hijo-fabric-simulation
./scripts/run_hijo_simulation.sh
```

---

## 3. Step 1: Create a Legitimate Asset on Blockchain

First, create a valid asset **`BATCH101`** across all 3 peer organizations (`Agri`, `Logistics`, `Port`):

```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer chaincode invoke -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.hijo.com \
  --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
  -C hijosupplychain -n banana_tracking \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
  --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
  --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt \
  -c '{"Args":["CreateBatch","BATCH101","Tagum Farm Sector 4","2026-07-29","1500.5","EMP-AGRI-001"]}'
```

*Verification:*
```bash
peer chaincode query -C hijosupplychain -n banana_tracking -c '{"Args":["QueryBatch","BATCH101"]}'
```

---

## 4. Step 2: Execute the Tamper Attack (Bypassing Blockchain Peer)

Now, act as the attacker. Execute the following CLI commands to bypass the peer and alter `couchdb.agri` directly.

### Step 2A: Fetch Document Revision (`_rev`)
CouchDB requires the current document revision identifier (`_rev`) to accept a modification:

```bash
# Fetch document and extract _rev tag
DOC=$(curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101)
REV=$(echo $DOC | jq -r '._rev')

echo "Target Document Revision: $REV"
```

### Step 2B: Inject Tampered Data Direct to `couchdb.agri` Database
Send a direct HTTP `PUT` request to `couchdb.agri` (Port `5984`), altering the ownership to `"HACKER_ORG"`, temperature to `99.9°C`, and marking customs cleared:

```bash
curl -s -X PUT http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101 \
  -H "Content-Type: application/json" \
  -d '{
    "_rev": "'"$REV"'",
    "batchId": "BATCH101",
    "farmLocation": "TAMPERED_LOCATION",
    "harvestDate": "2026-07-29",
    "weightKg": 1500.5,
    "currentOwner": "HACKER_ORG",
    "transportStatus": "TAMPERED_BY_ATTACKER",
    "temperatureDegC": 99.9,
    "portCustomsClear": true,
    "updatedByUID": "ATTACKER-999"
  }'
```

*Expected Output:* `{"ok":true,"id":"BATCH101","rev":"3-..."}`

---

## 5. Step 3: How to See and Inspect the Tampered Data

You can visually confirm the database discrepancy using **3 different tools**:

### Method A: Command Line Comparison (CLI)
Run a side-by-side comparison across all 3 organization databases:

```bash
echo "=== AGRI PEER DATABASE (PORT 5984 - TAMPERED) ==="
curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101 | jq -c '{currentOwner, temperatureDegC, transportStatus, updatedByUID}'

echo "=== LOGISTICS PEER DATABASE (PORT 5985 - UNTOUCHED) ==="
curl -s http://admin:adminpw@localhost:5985/hijosupplychain_banana_tracking/BATCH101 | jq -c '{currentOwner, temperatureDegC, transportStatus, updatedByUID}'

echo "=== PORT PEER DATABASE (PORT 5986 - UNTOUCHED) ==="
curl -s http://admin:adminpw@localhost:5986/hijosupplychain_banana_tracking/BATCH101 | jq -c '{currentOwner, temperatureDegC, transportStatus, updatedByUID}'
```

**CLI Output Comparison:**
```json
=== AGRI PEER DATABASE (PORT 5984 - TAMPERED) ===
{"currentOwner":"HACKER_ORG","temperatureDegC":99.9,"transportStatus":"TAMPERED_BY_ATTACKER","updatedByUID":"ATTACKER-999"}

=== LOGISTICS PEER DATABASE (PORT 5985 - UNTOUCHED) ===
{"currentOwner":"Hijo Agriculture","temperatureDegC":18,"transportStatus":"HARVESTED_AT_FARM","updatedByUID":"EMP-AGRI-001"}

=== PORT PEER DATABASE (PORT 5986 - UNTOUCHED) ===
{"currentOwner":"Hijo Agriculture","temperatureDegC":18,"transportStatus":"HARVESTED_AT_FARM","updatedByUID":"EMP-AGRI-001"}
```

### Method B: CouchDB Fauxton Web UI
1. Open browser to **[http://localhost:5984/_utils](http://localhost:5984/_utils)** (Agri CouchDB).
2. Login with Username `admin` and Password `adminpw`.
3. Click on database **`hijosupplychain_banana_tracking`**.
4. Click document **`BATCH101`**.
5. Observe the tampered values (`HACKER_ORG`, `99.9°C`).

### Method C: Web Explorer UI Dashboard
1. Open browser to **[http://localhost:8080](http://localhost:8080)**.
2. Select **`BATCH101`** in the dropdown.
3. Observe the JSON payload.

---

## 6. Step 4: How Blockchain Prevents & Detects the Tampered Data

Now, attempt to execute a legitimate supply chain update (`UpdateTransportTelemetry`) across the network:

```bash
peer chaincode invoke -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.hijo.com \
  --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
  -C hijosupplychain -n banana_tracking \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
  --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
  --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt \
  -c '{"Args":["UpdateTransportTelemetry","BATCH101","IN_TRANSIT_COLD_STORAGE","13.5","Hijo Logistics","LOG-4410"]}'
```

### Why the Attack Fails & How Blockchain Protects the State:

1. **Read-Set Versioning:**
   When `peer0.agri.hijo.com` simulates the proposal, it reads revision `3-ce3e...` from its DB.
   When `peer0.logistics.hijo.com` and `peer0.port.hijo.com` simulate, they read revision `2-d697...` from their DBs.

2. **Endorsement Mismatch & Consensus Rejection:**
   Because `peer0.agri` has a different revision version than `logistics` and `port`, the Read/Write sets do not match.
   The client gateway receives conflicting responses and the transaction commit is **flagged as an MVCC Read Conflict / Endorsement Mismatch**.

3. **Restoration on Block Commitment:**
   When a valid transaction proposal signed by the untampered peers is committed by the Raft Orderer, the block committer forces `peer0.agri.hijo.com` to overwrite its local DB with the valid blockchain state, erasing the hacker's changes!

---

## 7. Automated One-Command Attack Simulation Script

You can copy and run this complete 1-line script to test the full attack flow anytime:

```bash
bash -c '
DOC=$(curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101)
REV=$(echo $DOC | jq -r "._rev")
curl -s -X PUT http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101 -H "Content-Type: application/json" -d "{\"_rev\":\"$REV\",\"batchId\":\"BATCH101\",\"currentOwner\":\"HACKER_ORG\",\"temperatureDegC\":99.9}"
echo ""
echo "Attack Executed! Check http://localhost:5984/_utils or run: curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101"
'
```

---

*Guide compiled for Hijo Resource Corporation Hyperledger Fabric v2.5 Simulation Network.*
