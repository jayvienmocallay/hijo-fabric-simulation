# Comprehensive Guide: Simulating, Detecting & Tracing Blockchain Tamper Attacks

This guide provides a step-by-step technical tutorial on how to simulate **two different types of tamper attacks** on the Hijo Resource Corporation Hyperledger Fabric v2.5 simulation network:

1. **Scenario 1: Off-Chain Direct Database Tamper Attack** (Altering CouchDB directly behind a peer's back).
2. **Scenario 2: On-Chain Rogue Insider / Policy Bypass Attack** (A rogue employee attempting to submit fraudulent data with missing organization signatures).

It details how the blockchain automatically detects, blocks, and self-heals tampered data, and how to perform forensic tracing to catch the attacker.

---

## Scenario 1: Off-Chain Direct Database Tamper Attack

### 1. Attack Concept
CouchDB holds the local **World State** for each peer node:
- **`couchdb.agri`** (Port `5984`) — Agriculture Peer Database
- **`couchdb.logistics`** (Port `5985`) — Logistics Peer Database
- **`couchdb.port`** (Port `5986`) — Port Operations Peer Database

**The Attack:** An attacker with local database access bypasses the Hyperledger Fabric peer software and sends a direct HTTP `PUT` request to `couchdb.agri` to illegally modify a batch's ownership (`HACKER_ORG`) and temperature (`99.9°C`).

---

### 2. Step-by-Step Attack Execution

#### Step A: Create Legitimate Asset `BATCH101`
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

#### Step B: Execute Direct DB Tamper (Bypassing Blockchain)
```bash
# Fetch document revision tag
DOC=$(curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101)
REV=$(echo $DOC | jq -r '._rev')

# Inject tampered data direct to couchdb.agri
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

---

### 3. Seeing & Verifying the Discrepancy
Compare `couchdb.agri` (tampered) against `couchdb.logistics` and `couchdb.port` (untouched):

```bash
echo "=== AGRI PEER DB (PORT 5984 - TAMPERED) ==="
curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101 | jq -c '{currentOwner, temperatureDegC, transportStatus}'

echo "=== LOGISTICS PEER DB (PORT 5985 - UNTOUCHED) ==="
curl -s http://admin:adminpw@localhost:5985/hijosupplychain_banana_tracking/BATCH101 | jq -c '{currentOwner, temperatureDegC, transportStatus}'
```

---

### 4. Automatic Blockchain Detection & Self-Healing Fix
Trigger the next legitimate business transaction (`ClearForExport`):

```bash
peer chaincode invoke -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.hijo.com \
  --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
  -C hijosupplychain -n banana_tracking \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
  --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
  --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt \
  -c '{"Args":["ClearForExport","BATCH101","EMP-PORT-999"]}'
```

#### What Happens Automatically:
1. **Detection Log:** `peer0.agri.hijo.com` detects a document revision conflict (`Reason: Document update conflict`).
2. **Self-Healing:** The peer committer **automatically overwrites `couchdb.agri`** with the consensus block data, erasing `TAMPERED_LOCATION`, `HACKER_ORG`, and `99.9°C`!

---

### 5. Catching the Attacker (Forensic Audit Trail)
Check CouchDB's internal audit logs:
```bash
docker logs --tail 20 couchdb.agri
```

**Captured Forensic Data:**
```text
[notice] 2026-07-30T02:17:18Z 172.18.0.1 admin PUT /hijosupplychain_banana_tracking/BATCH101 201 ok
```
- **Attacker IP Address:** `172.18.0.1`
- **Timestamp:** `2026-07-30T02:17:18Z`
- **User Account:** `admin`

---

## Scenario 2: On-Chain Rogue Insider / Policy Bypass Attack

### 1. Attack Concept
A rogue internal employee (`EMP-AGRI-007`) at **Hijo Agriculture** attempts to single-handedly create a fraudulent batch **`BATCH-ROGUE-999`** (`"Forbidden Farm"`, `9999.0` kg weight) by sending a proposal signed **ONLY by Agri Peer** (`peer0.agri.hijo.com`), omitting required endorsements from **Logistics** and **Port**.

---

### 2. Step-by-Step Attack Execution

Execute the proposal targeting only Agri Peer:

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
  -c '{"Args":["CreateBatch","BATCH-ROGUE-999","Forbidden Farm","2026-07-30","9999.0","EMP-AGRI-007"]}'
```

---

### 3. Automatic Blockchain Detection & Blocking Proof

#### Step A: Peer Validation Logs
Inspect the committer logs of `peer0.logistics.hijo.com`:

```bash
docker logs --tail 25 peer0.logistics.hijo.com
```

**Log Evidence:**
```text
WARN [vscc] Validate -> Endorsement policy failure error: 
     "implicit policy evaluation failed - 1 sub-policies were satisfied, 
      but this policy requires 2 of the 'Endorsement' sub-policies to be satisfied"

WARN [validation] Block [14] TxId [ecf64c8a...] marked as INVALID by committer. 
     Reason code [ENDORSEMENT_POLICY_FAILURE]
```

#### Step B: World State Query Verification
Query the ledger for `BATCH-ROGUE-999`:

```bash
peer chaincode query -C hijosupplychain -n banana_tracking -c '{"Args":["QueryBatch","BATCH-ROGUE-999"]}'
```

**Result:**
```text
Error: endorsement failure during query. response: status:500 message:"batch BATCH-ROGUE-999 does not exist"
```
✅ **Result:** The fraudulent transaction was marked **`INVALID`** and **100% blocked** from entering the world state database.

---

### 4. Catching the Rogue Employee (Forensic Audit Trail)

On-chain transactions permanently record the user's cryptographic identity in the block envelope:
- **User ID / UID:** `EMP-AGRI-007`
- **MSP ID:** `HijoAgriMSP`
- **X.509 Certificate Serial Number:** Permanently stored in Block `[14]` header.

---

## 7. How to View Terminal Logs on Web UI (`http://localhost:8080`)

1. Open browser to **[http://localhost:8080](http://localhost:8080)**.
2. Scroll to the bottom section: **📜 Live Container Log Dashboard**.
3. Select **`peer0.logistics.hijo.com (Logistics Peer)`** in the dropdown.
4. Observe the live highlighted red/yellow security logs (`Reason code [ENDORSEMENT_POLICY_FAILURE]`).

---

*Guide compiled and updated for Hijo Resource Corporation Hyperledger Fabric v2.5 Simulation Network.*
