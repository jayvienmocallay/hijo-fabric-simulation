# Hijo Resource Corporation - Comprehensive Granular Build & Dry-Run Guide
## Hyperledger Fabric v2.5 Supply Chain Simulation Network

---

## Table of Contents
1. [Project Overview & Architecture Topology](#1-project-overview--architecture-topology)
2. [Environment Setup & Toolchain Prerequisites](#2-environment-setup--toolchain-prerequisites)
   - [Operating System & Shell Requirements](#a-operating-system--shell-requirements)
   - [Core Software & Tool Dependencies](#b-core-software--tool-dependencies)
   - [Environment Variable & PATH Configuration](#c-environment-variable--path-configuration)
   - [System Verification Commands](#d-system-verification-commands)
3. [Repository Directory Structure](#3-repository-directory-structure)
4. [Granular Step-by-Step Manual Build Process](#4-granular-step-by-step-manual-build-process)
   - [Phase 1: Environment Sanitation & Storage Pruning](#phase-1-environment-sanitation--storage-pruning)
   - [Phase 2: Cryptographic Identity Generation (PKI)](#phase-2-cryptographic-identity-generation-pki)
   - [Phase 3: Systemless Channel Genesis Block Generation](#phase-3-systemless-channel-genesis-block-generation)
   - [Phase 4: Booting Infrastructure Services Container Cluster](#phase-4-booting-infrastructure-services-container-cluster)
   - [Phase 5: Raft Ordering Service Channel Join via osnadmin](#phase-5-raft-ordering-service-channel-join-via-osnadmin)
   - [Phase 6: Peer Node Channel Joining](#phase-6-peer-node-channel-joining)
   - [Phase 7: Smart Contract CCAAS Packaging & Lifecycle Deployment](#phase-7-smart-contract-ccaas-packaging--lifecycle-deployment)
5. [Launching Web Explorer, Simulator & REST API Gateway](#5-launching-web-explorer-simulator--rest-api-gateway)
   - [Starting Web Monitoring Explorer (Port 8080)](#a-starting-web-monitoring-explorer-port-8080)
   - [Starting REST API Gateway (Port 5000)](#b-starting-rest-api-gateway-port-5000)
6. [Granular Dry-Run Execution Procedures](#6-granular-dry-run-execution-procedures)
   - [Dry-Run Option A: Automated Deployment Script](#dry-run-option-a-automated-deployment-script)
   - [Dry-Run Option B: CLI Supply Chain Transaction Walkthrough](#dry-run-option-b-cli-supply-chain-transaction-walkthrough)
   - [Dry-Run Option C: Interactive Web Explorer & Simulator Testing](#dry-run-option-c-interactive-web-explorer--simulator-testing)
   - [Dry-Run Option D: Security & Tamper Attack Simulations](#dry-run-option-d-security--tamper-attack-simulations)
7. [Troubleshooting, Maintenance & FAQ](#7-troubleshooting-maintenance--faq)

---

## 1. Project Overview & Architecture Topology

The **Hijo Resource Corporation Fabric Simulation** is an enterprise-grade Hyperledger Fabric v2.5 blockchain network simulating multi-organization supply chain tracking for fresh agricultural produce (bananas).

### Network Architecture Components (11 Active Containers)

```
+---------------------------------------------------------------------------------------------------+
|                                 HIJO FABRIC SIMULATION NETWORK                                    |
|                                     Channel: hijosupplychain                                      |
+---------------------------------------------------------------------------------------------------+
|  ORDERER CLUSTER (Raft Consensus)                                                                 |
|  * orderer1.hijo.com (Ports 7050 / 7053 Admin)                                                    |
|  * orderer2.hijo.com (Ports 8050 / 8053 Admin)                                                    |
|  * orderer3.hijo.com (Ports 9050 / 9053 Admin)                                                    |
+---------------------------------------------------------------------------------------------------+
|  ORGANIZATION PEERS (Endorsement & Validation)                                                    |
|  * Agriculture Org Peer : peer0.agri.hijo.com      (Port 7051)  <---> CouchDB (Port 5984)        |
|  * Logistics Org Peer   : peer0.logistics.hijo.com (Port 8051)  <---> CouchDB (Port 5985)        |
|  * Port Ops Org Peer    : peer0.port.hijo.com      (Port 9051)  <---> CouchDB (Port 5986)        |
+---------------------------------------------------------------------------------------------------+
|  SMART CONTRACT CONTAINER (Chaincode-as-a-Service - CCAAS)                                        |
|  * chaincode.banana.tracking (Port 9999) [Go 1.20 Runtime]                                         |
+---------------------------------------------------------------------------------------------------+
|  APPLICATION & MANAGEMENT LAYER                                                                   |
|  * Web Monitoring Explorer & Simulator Backend : web/server.py (Port 8080)                         |
|  * SSO / LDAP REST API Gateway                 : gateway/hijo_gateway_api.py (Port 5000)         |
+---------------------------------------------------------------------------------------------------+
```

### Network Parameter Specifications
* **Fabric Version:** v2.5.9
* **Consensus Type:** Raft (etcdraft with 3 consenters)
* **Channel Management:** Fabric v2.5 Systemless Channel (Channel Participation API)
* **Chaincode Architecture:** Chaincode-as-a-Service (CCAAS) running on TCP port `9999`
* **Endorsement Policy:** `AND('HijoAgriMSP.peer', 'HijoLogisticsMSP.peer', 'HijoPortMSP.peer')` (Requires consensus from all 3 organizations)

---

## 2. Environment Setup & Toolchain Prerequisites

### A. Operating System & Shell Requirements
* **Operating System:** Linux (Ubuntu 22.04 LTS / 24.04 LTS / 26.04 LTS recommended) or WSL2 (Windows Subsystem for Linux 2 with Ubuntu).
* **Shell Environment:** Standard GNU Bash (`bash`).

### B. Core Software & Tool Dependencies

1. **Docker Engine & Docker Compose V2**
   - Docker Engine v24.0+ (Docker 29+ fully supported).
   - Docker Compose V2 (`docker compose` CLI plugin).
2. **Go Programming Language**
   - Go 1.20 or later (required for compiling chaincode, module vendoring, and dependency resolution).
3. **Python 3 Runtime**
   - Python 3.8+ (standard library modules used for web server; Flask required for gateway API).
4. **Hyperledger Fabric v2.5 Binary Utilities**
   - `cryptogen`: Generates X.509 cryptographic identities (certificates & private keys).
   - `configtxgen`: Generates genesis block artifacts.
   - `osnadmin`: Orderer Admin CLI tool for Raft channel management.
   - `peer`: Fabric peer CLI for channel joining and chaincode lifecycle management.
5. **Standard System Utilities**
   - `curl`, `jq`, `tar`, `gzip`, `openssl`, `git`.

### C. Environment Variable & PATH Configuration

Add the Fabric binaries to your shell path and set `FABRIC_CFG_PATH`:

```bash
# Set repository root directory
export HIJO_PROJECT_ROOT=/home/jeb/project/hijo-fabric-simulation
cd $HIJO_PROJECT_ROOT

# Export Fabric Config Path
export FABRIC_CFG_PATH=${PWD}/config

# Ensure Fabric binaries (if installed in custom location, e.g., /usr/local/bin or bin/) are in PATH
export PATH=$PATH:${PWD}/bin:/usr/local/bin
```

### D. System Verification Commands

Before starting the build, verify all required binary tools are accessible in your terminal session:

```bash
echo "=== VERIFYING TOOLCHAIN INSTALLATION ==="
docker --version
docker compose version
go version
python3 --version
cryptogen version
configtxgen --version
peer version
jq --version
curl --version
openssl version
```

---

## 3. Repository Directory Structure

```text
/home/jeb/project/hijo-fabric-simulation/
├── config/
│   ├── crypto-config.yaml       # PKI definitions for 3 Orderers & 3 Peer Orgs with SANs
│   └── configtx.yaml            # Channel profile, organization definitions, policies
├── crypto-config/               # Output directory for generated X.509 certs (git-ignored)
├── channel-artifacts/           # Output directory for genesis blocks (git-ignored)
├── docker/
│   └── docker-compose-hijo.yaml # 11-container Docker orchestration schema
├── chaincode/
│   └── banana_tracking/
│       ├── banana_tracking.go   # Go smart contract code (CCAAS + standalone support)
│       ├── go.mod               # Go module definition
│       ├── go.sum               # Dependency checksums
│       ├── vendor/              # Vendored dependencies
│       ├── connection.json      # CCAAS network endpoint configuration
│       ├── metadata.json        # CCAAS label & type configuration
│       └── Dockerfile           # Multi-stage Docker container build definition
├── gateway/
│   └── hijo_gateway_api.py      # Flask REST API Gateway with LDAP/SSO integration
├── web/
│   ├── index.html               # Real-time explorer, simulator & monitoring dashboard
│   ├── styles.css               # Glassmorphism dark-mode UI styling
│   ├── app.js                   # Client-side JavaScript AJAX engine
│   └── server.py                # Pure Python HTTP server & Fabric CLI bridge
├── scripts/
│   └── run_hijo_simulation.sh   # Full deployment automation script
├── DOCUMENTATION.md             # Architecture & deployment documentation
├── RUN_SEQUENCE_GUIDE.md        # Deployment sequence overview
├── SIMULATOR_AND_MONITORING.md  # Monitoring dashboard user guide
├── TAMPER_ATTACK_SIMULATION_GUIDE.md # Security attack simulation tutorial
└── BUILD_AND_DRY_RUN_GUIDE.md   # Comprehensive Granular Build & Dry-Run Guide (This Document)
```

---

## 4. Granular Step-by-Step Manual Build Process

Follow this section to build the network completely from scratch step-by-step.

### Phase 1: Environment Sanitation & Storage Pruning

Ensure no stale network containers, broken volume mounts, or certificate artifacts conflict with the new deployment.

```bash
# 1. Navigate to project root
cd /home/jeb/project/hijo-fabric-simulation

# 2. Stop and purge previous Docker containers and volumes
cd docker
docker compose -f docker-compose-hijo.yaml down -v --remove-orphans || true
cd ..

# 3. Purge existing crypto keys and channel artifacts
rm -rf channel-artifacts/* crypto-config/*
mkdir -p channel-artifacts crypto-config

# 4. Prune unused Docker cache and volumes to prevent disk exhaustion / broken pipe socket errors
docker container prune -f
docker image prune -f
docker volume prune -f
```

---

### Phase 2: Cryptographic Identity Generation (PKI)

Generate X.509 certificates and private keys using `cryptogen` based on `config/crypto-config.yaml`.

```bash
cryptogen generate --config=./config/crypto-config.yaml --output="crypto-config"
```

#### What is Generated:
* `crypto-config/ordererOrganizations/hijo.com/`: TLS and MSP certs for `orderer1`, `orderer2`, `orderer3`.
* `crypto-config/peerOrganizations/agri.hijo.com/`: TLS and MSP certs for `peer0.agri` and Admin users.
* `crypto-config/peerOrganizations/logistics.hijo.com/`: TLS and MSP certs for `peer0.logistics` and Admin users.
* `crypto-config/peerOrganizations/port.hijo.com/`: TLS and MSP certs for `peer0.port` and Admin users.

> [!NOTE]
> `config/crypto-config.yaml` explicitly includes `SANS: ["localhost", "127.0.0.1"]` under `Specs` to allow administrative local commands (`osnadmin`, `peer` CLI) over TLS without hostname validation mismatches.

---

### Phase 3: Systemless Channel Genesis Block Generation

Use `configtxgen` to build the channel bootstrap block (`orderer.genesis.block`).

```bash
FABRIC_CFG_PATH=${PWD}/config configtxgen -profile HijoChannelProfile \
    -channelID hijosupplychain \
    -outputBlock ./channel-artifacts/orderer.genesis.block
```

#### Verification:
Ensure `./channel-artifacts/orderer.genesis.block` exists and has a non-zero file size:
```bash
ls -lh ./channel-artifacts/orderer.genesis.block
```

---

### Phase 4: Booting Infrastructure Services Container Cluster

Boot all 10 base infrastructure containers (Orderers, Peers, CouchDB databases) using Docker Compose.

```bash
cd docker
docker compose -f docker-compose-hijo.yaml up -d
cd ..

# Wait 10 seconds for containers to complete initialization
echo "Waiting for containers to stabilize..."
sleep 10
```

#### Verify Active Containers (10 Base Containers):
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

You should see:
* `orderer1.hijo.com`, `orderer2.hijo.com`, `orderer3.hijo.com`
* `peer0.agri.hijo.com`, `peer0.logistics.hijo.com`, `peer0.port.hijo.com`
* `couchdb.agri`, `couchdb.logistics`, `couchdb.port`

---

### Phase 5: Raft Ordering Service Channel Join via osnadmin

Fabric v2.5 uses the Channel Participation API (`osnadmin`). Join all three Raft orderers to the `hijosupplychain` channel using their individual TLS administrative endpoints.

#### 1. Join Orderer 1 (Admin Port 7053):
```bash
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:7053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.key
```

#### 2. Join Orderer 2 (Admin Port 8053):
```bash
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:8053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.key
```

#### 3. Join Orderer 3 (Admin Port 9053):
```bash
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:9053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.key
```

> Each command will output JSON with `"status": "201"` confirming success.

---

### Phase 6: Peer Node Channel Joining

Join each organization peer to `hijosupplychain` by configuring shell TLS context variables.

#### 1. Join Agriculture Org Peer (`peer0.agri.hijo.com` - Port 7051):
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer channel join -b ./channel-artifacts/orderer.genesis.block
```

#### 2. Join Logistics Org Peer (`peer0.logistics.hijo.com` - Port 8051):
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051

peer channel join -b ./channel-artifacts/orderer.genesis.block
```

#### 3. Join Port Operations Org Peer (`peer0.port.hijo.com` - Port 9051):
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer channel join -b ./channel-artifacts/orderer.genesis.block
```

---

### Phase 7: Smart Contract CCAAS Packaging & Lifecycle Deployment

This simulation utilizes **Fabric Chaincode-as-a-Service (CCAAS)**. The peer installs a tiny metadata package pointing to an external Docker service (`chaincode.banana.tracking:9999`).

#### Step 7.1: Package the CCAAS Chaincode Archive
```bash
cd chaincode/banana_tracking
tar -czf code.tar.gz connection.json
tar -czf ../../banana_tracking.tar.gz metadata.json code.tar.gz
rm -f code.tar.gz
cd ../..
```

#### Step 7.2: Install Chaincode Archive on All Peers

**Agri Peer Install:**
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode install banana_tracking.tar.gz
```

**Logistics Peer Install:**
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode install banana_tracking.tar.gz
```

**Port Peer Install:**
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode install banana_tracking.tar.gz
```

#### Step 7.3: Calculate and Export Package ID
```bash
export CC_PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid banana_tracking.tar.gz)
echo "Generated Chaincode Package ID: ${CC_PACKAGE_ID}"
```

#### Step 7.4: Approve Chaincode Definition for Organizations

**Approve for Agriculture Org:**
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt
```

**Approve for Logistics Org:**
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051

peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt
```

**Approve for Port Operations Org:**
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt
```

#### Step 7.5: Commit Chaincode Definition to Channel
```bash
peer lifecycle chaincode commit -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
    --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
    --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
```

#### Step 7.6: Boot the CCAAS Smart Contract Server Container
Pass the calculated `${CC_PACKAGE_ID}` environment variable into Docker Compose:

```bash
cd docker
CHAINCODE_ID=${CC_PACKAGE_ID} docker compose -f docker-compose-hijo.yaml up -d chaincode.banana.tracking
cd ..
```

---

## 5. Launching Web Explorer, Simulator & REST API Gateway

With the 11 blockchain infrastructure containers active, launch the Web Explorer monitoring server and REST API gateway.

### A. Starting Web Monitoring Explorer (Port 8080)

The Web Explorer server is built with Python's standard library (`web/server.py`) and provides live transaction endorsement, log streaming, certificate inspection, and batch tracking.

Run in terminal:
```bash
python3 web/server.py
```
> The dashboard will be live at **[http://localhost:8080](http://localhost:8080)**.

### B. Starting REST API Gateway (Port 5000)

The API Gateway (`gateway/hijo_gateway_api.py`) provides an HTTP REST API layer with identity credential mapping.

Run in a separate terminal:
```bash
python3 gateway/hijo_gateway_api.py
```
> The Gateway API will listen on **[http://localhost:5000](http://localhost:5000)**.

---

## 6. Granular Dry-Run Execution Procedures

You can dry-run and verify the simulation through four distinct options:

---

### Dry-Run Option A: Automated Deployment Script

Instead of performing the manual commands in Section 4 line by line, you can execute the single automated deployment script:

```bash
./scripts/run_hijo_simulation.sh
```

#### Execution Checklist:
1. Cleans leftover state & prunes Docker cache.
2. Generates PKI keys in `crypto-config/`.
3. Creates `orderer.genesis.block`.
4. Boots containers and joins orderers via `osnadmin`.
5. Joins peers to `hijosupplychain`.
6. Packages, installs, approves, commits `banana_tracking` chaincode.
7. Instantiates `chaincode.banana.tracking` on port `9999`.

---

### Dry-Run Option B: CLI Supply Chain Transaction Walkthrough

Execute a complete end-to-end banana harvest, transportation, and customs clearance transaction workflow directly from the shell terminal.

#### Step 1: Harvest & Pack (`CreateBatch` - Agriculture Org)
Submit a proposal signed by all 3 peer organizations:

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
  -c '{"Args":["CreateBatch","BATCH101","Tagum Farm Sector 4","2026-07-31","1500.5","EMP-AGRI-001"]}'
```

#### Step 2: Transport & Cold Storage Telemetry (`UpdateTransportTelemetry` - Logistics Org)
Update storage temperature (e.g., `4.5°C`) and status during transit:

```bash
peer chaincode invoke -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.hijo.com \
  --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
  -C hijosupplychain -n banana_tracking \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
  --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
  --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt \
  -c '{"Args":["UpdateTransportTelemetry","BATCH101","4.5","IN_TRANSIT_COLD_STORAGE","EMP-LOG-102"]}'
```

#### Step 3: Customs & Port Export Approval (`ClearForExport` - Port Ops Org)
Clear batch `BATCH101` for vessel loading:

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

#### Step 4: Ledger Query & State Inspection
Query ledger state for `BATCH101`:

```bash
peer chaincode query -C hijosupplychain -n banana_tracking -c '{"Args":["QueryBatch","BATCH101"]}'
```

Direct CouchDB HTTP state query across peers:
```bash
echo "=== AGRI COUCHDB ==="
curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101 | jq .

echo "=== LOGISTICS COUCHDB ==="
curl -s http://admin:adminpw@localhost:5985/hijosupplychain_banana_tracking/BATCH101 | jq .

echo "=== PORT COUCHDB ==="
curl -s http://admin:adminpw@localhost:5986/hijosupplychain_banana_tracking/BATCH101 | jq .
```

---

### Dry-Run Option C: Interactive Web Explorer & Simulator Testing

1. Open **[http://localhost:8080](http://localhost:8080)** in any modern web browser.
2. Verify all **11 Node Status Cards** display green `ONLINE` status pills.
3. Test 1-click live transactions under **⚡ Live Blockchain Transaction Simulator**:
   - Select **`CreateBatch`**, enter Batch ID `BATCH202`, and click **Execute Transaction**.
   - Watch the transaction commit live across all 3 peer nodes.
4. Scroll to **📜 Live Container Log Dashboard**:
   - Select `peer0.agri.hijo.com` from the dropdown and toggle **Auto Refresh ON**.
   - Observe block commitment and endorsement logs streaming in real-time.
5. Click the **`Cert`** button on any Org node card to inspect the X.509 certificate subject, issuer, and SAN details.
6. Access CouchDB Fauxton Database interfaces:
   - Agri DB UI: [http://localhost:5984/_utils](http://localhost:5984/_utils) (`admin` / `adminpw`)
   - Logistics DB UI: [http://localhost:5985/_utils](http://localhost:5985/_utils) (`admin` / `adminpw`)
   - Port Ops DB UI: [http://localhost:5986/_utils](http://localhost:5986/_utils) (`admin` / `adminpw`)

---

### Dry-Run Option D: Security & Tamper Attack Simulations

Verify the blockchain's tamper-resistance mechanics with two attack simulations.

#### Scenario 1: Off-Chain Direct Database Tamper & Automatic Self-Healing
An attacker accesses `couchdb.agri` directly (bypassing Fabric consensus) and alters temperature to `99.9°C` and owner to `HACKER_ORG`.

```bash
# 1. Fetch current document revision from Agri CouchDB
DOC=$(curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101)
REV=$(echo $DOC | jq -r '._rev')

# 2. Inject tampered record directly to couchdb.agri
curl -s -X PUT http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101 \
  -H "Content-Type: application/json" \
  -d '{
    "_rev": "'"$REV"'",
    "batchId": "BATCH101",
    "farmLocation": "TAMPERED_FARM",
    "harvestDate": "2026-07-31",
    "weightKg": 1500.5,
    "currentOwner": "HACKER_ORG",
    "transportStatus": "TAMPERED_BY_ATTACKER",
    "temperatureDegC": 99.9,
    "portCustomsClear": true,
    "updatedByUID": "ATTACKER-999"
  }'

# 3. Observe the discrepancy between Agri DB (tampered) and Logistics DB (authentic)
curl -s http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/BATCH101 | jq -c '{currentOwner, temperatureDegC}'
curl -s http://admin:adminpw@localhost:5985/hijosupplychain_banana_tracking/BATCH101 | jq -c '{currentOwner, temperatureDegC}'

# 4. Trigger next legitimate transaction (e.g., UpdateTransportTelemetry)
peer chaincode invoke -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.hijo.com \
  --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
  -C hijosupplychain -n banana_tracking \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
  --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
  --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt \
  -c '{"Args":["UpdateTransportTelemetry","BATCH101","3.8","IN_TRANSIT_COLD_STORAGE","EMP-LOG-102"]}'
```

> **Result:** Fabric detects the revision conflict on `peer0.agri.hijo.com`, rejects the tampered document revision, and automatically self-heals `couchdb.agri` by overwriting it with the consensus state block!

#### Scenario 2: On-Chain Policy Bypass / Rogue Insider Attempt
A rogue employee attempts to register a batch `BATCH-ROGUE-999` by targeting only Agri peer, omitting required signatures from Logistics and Port peers.

```bash
peer chaincode invoke -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.hijo.com \
  --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
  -C hijosupplychain -n banana_tracking \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
  -c '{"Args":["CreateBatch","BATCH-ROGUE-999","Forbidden Farm","2026-07-31","9999.0","EMP-AGRI-007"]}'
```

> **Result:** The transaction is blocked by peer committers with log warning:
> `WARN [vscc] Endorsement policy failure error: implicit policy evaluation failed - 1 sub-policies were satisfied, but this policy requires 2 of the 'Endorsement' sub-policies`.
> Querying `QueryBatch BATCH-ROGUE-999` returns `batch BATCH-ROGUE-999 does not exist`.

---

## 7. Troubleshooting, Maintenance & FAQ

| Symptom / Error | Root Cause | Solution |
| :--- | :--- | :--- |
| `x509: certificate is valid for orderer1.hijo.com, not localhost` | TLS certificate missing `localhost` Subject Alternative Name (SAN). | Re-run `cryptogen generate` using the updated `config/crypto-config.yaml` containing `SANS: ["localhost", "127.0.0.1"]`. |
| `write: broken pipe` or build timeout during chaincode install | Modern Docker engine (Docker 29+) deprecated legacy `dockercontroller` socket streaming. | Deploy smart contract using Fabric v2.5 CCAAS mode (`banana_tracking.tar.gz` with `connection.json`). |
| `osnadmin: channel join failed: 403` | Client certificate / TLS key mismatch during orderer join. | Ensure `--client-cert` and `--client-key` point to `server.crt` and `server.key` of the corresponding orderer node in `crypto-config/`. |
| `bind: address already in use` | Previous network session containers or local processes are occupying ports (`7051`, `8051`, `9051`, `8080`, `5000`). | Execute `docker compose -f docker/docker-compose-hijo.yaml down -v --remove-orphans` and kill lingering Python processes (`pkill -f server.py`). |
| `endorsement policy failure` | Transaction proposal missing required MSP peer signatures. | Include `--peerAddresses` and `--tlsRootCertFiles` for all 3 organizations (`agri`, `logistics`, `port`) in `peer chaincode invoke`. |

### Full Reset Command (Clean Slate)

To perform a complete emergency reset of the entire network environment:

```bash
cd /home/jeb/project/hijo-fabric-simulation
cd docker && docker compose -f docker-compose-hijo.yaml down -v --remove-orphans && cd ..
rm -rf channel-artifacts/* crypto-config/*
docker container prune -f && docker image prune -f && docker volume prune -f
./scripts/run_hijo_simulation.sh
```

---

*Document compiled and verified for Hijo Resource Corporation Hyperledger Fabric v2.5 Simulation Project.*