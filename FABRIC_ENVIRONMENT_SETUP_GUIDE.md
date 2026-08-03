# Hyperledger Fabric v2.5 Environment Setup & Configuration Guide

This comprehensive guide details how to fully configure, bootstrap, and deploy an enterprise-grade **Hyperledger Fabric v2.5** blockchain network from scratch, using the **Hijo Resource Corporation Supply Chain Simulation** topology as a reference implementation.

---

## 1. System Requirements & Toolchain Prerequisites

### A. Core Operating Environment
* **OS:** Linux (Ubuntu 22.04 LTS / 24.04 LTS recommended) or WSL2 (Windows Subsystem for Linux 2).
* **Shell:** GNU Bash (`bash`).

### B. Required Dependencies

| Software / Tool | Required Version | Purpose |
| :--- | :--- | :--- |
| **Docker Engine** | `v24.0+` | Container runtime for peers, orderers, state databases, and chaincode. |
| **Docker Compose** | `v2.20+` (`docker compose`) | Multi-container architecture orchestration. |
| **Go Programming Language** | `v1.20+` | Chaincode smart contract compilation and dependency management. |
| **Python 3** | `v3.8+` | Web monitoring server (`web/server.py`) and REST API gateway (`gateway/hijo_gateway_api.py`). |
| **Hyperledger Fabric Binaries** | `v2.5.9` | Core fabric CLI tools: `cryptogen`, `configtxgen`, `osnadmin`, `peer`. |

### C. Installing Hyperledger Fabric v2.5 Binaries

If the Fabric binaries are not yet installed on your system:

```bash
# Download Hyperledger Fabric v2.5.9 binaries (without installing samples or docker images if not needed)
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.9 1.5.12 -s

# Add binaries to PATH (Add to ~/.bashrc for persistence)
export PATH=${PWD}/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/config
```

Verify binary installation:
```bash
cryptogen version
configtxgen -version
osnadmin version
peer version
```

---

## 2. Network Topology & Architecture Blueprint

The network consists of **11 active containers** configured across a 3-Organization supply chain:

```
+---------------------------------------------------------------------------------------------------+
|                                 HIJO FABRIC SIMULATION NETWORK                                    |
|                                     Channel: hijosupplychain                                      |
+---------------------------------------------------------------------------------------------------+
|  ORDERER CLUSTER (Raft Consensus)                                                                 |
|  * orderer1.hijo.com (Port 7050 / Admin 7053)                                                     |
|  * orderer2.hijo.com (Port 8050 / Admin 8053)                                                     |
|  * orderer3.hijo.com (Port 9050 / Admin 9053)                                                     |
+---------------------------------------------------------------------------------------------------+
|  PEER NODES & COUCHDB STATE DATABASES                                                             |
|  * HijoAgriMSP      : peer0.agri.hijo.com      (Port 7051) <---> couchdb0 (Port 5984)             |
|  * HijoLogisticsMSP : peer0.logistics.hijo.com (Port 8051) <---> couchdb1 (Port 5985)             |
|  * HijoPortMSP      : peer0.port.hijo.com      (Port 9051) <---> couchdb2 (Port 5986)             |
+---------------------------------------------------------------------------------------------------+
|  CHAINCODE SERVICE (Chaincode-as-a-Service - CCAAS)                                               |
|  * chaincode.banana.tracking (Port 9999) [Go 1.20 Runtime]                                         |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Step-by-Step Configuration & Deployment

### Step 1: Configure Cryptographic Identities (PKI)

Create `./config/crypto-config.yaml` defining the organizations, domains, orderers, and peers:

```yaml
OrdererOrgs:
  - Name: HijoOrdererOrg
    Domain: hijo.com
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer1
        SANS: ["localhost", "127.0.0.1"]
      - Hostname: orderer2
        SANS: ["localhost", "127.0.0.1"]
      - Hostname: orderer3
        SANS: ["localhost", "127.0.0.1"]

PeerOrgs:
  - Name: HijoAgriOrg
    Domain: agri.hijo.com
    EnableNodeOUs: true
    Specs: [{ Hostname: peer0, SANS: ["localhost", "127.0.0.1"] }]
    Users: { Count: 1 }

  - Name: HijoLogisticsOrg
    Domain: logistics.hijo.com
    EnableNodeOUs: true
    Specs: [{ Hostname: peer0, SANS: ["localhost", "127.0.0.1"] }]
    Users: { Count: 1 }

  - Name: HijoPortOrg
    Domain: port.hijo.com
    EnableNodeOUs: true
    Specs: [{ Hostname: peer0, SANS: ["localhost", "127.0.0.1"] }]
    Users: { Count: 1 }
```

**Generate PKI Certificates:**
```bash
mkdir -p crypto-config
cryptogen generate --config=./config/crypto-config.yaml --output="crypto-config"
```

---

### Step 2: Configure & Generate Channel Genesis Block

> [!IMPORTANT]
> **Channel Creation in Fabric v2.5 (Systemless Channel Architecture)**
> In Hyperledger Fabric v2.5+, channels are created using the **Systemless Channel Architecture (Channel Participation API)**. 
> Unlike legacy Fabric (v1.x/v2.2) which required generating a `.tx` channel transaction file and calling `peer channel create`, Fabric v2.5 creates application channels **directly from a genesis block** using `osnadmin channel join`.

Create `./config/configtx.yaml` specifying MSP definitions, Raft consenters, batch sizes, policies, and channel profiles (`HijoChannelProfile`).

**Generate Systemless Channel Genesis Block:**
```bash
mkdir -p channel-artifacts
FABRIC_CFG_PATH=${PWD}/config configtxgen -profile HijoChannelProfile \
    -channelID hijosupplychain \
    -outputBlock ./channel-artifacts/orderer.genesis.block
```

---

### Step 3: Launch Infrastructure Services

Boot Orderers, Peers, and CouchDB state databases via Docker Compose:

```bash
cd docker
docker compose -f docker-compose-hijo.yaml up -d
cd ..
```

Wait 10 seconds for container stabilization:
```bash
sleep 10
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

### Step 4: Create Channel & Join Orderers via Channel Participation API (`osnadmin`)

> [!NOTE]
> **How the Channel is Formally Created**
> Executing `osnadmin channel join` for the first orderer node **creates and bootstraps the `hijosupplychain` channel** on the orderer cluster using the `orderer.genesis.block`. Joining subsequent orderers adds them as Raft consenters to the active channel.

```bash
# 1. Create/Join Channel on Orderer 1 (Admin Port 7053)
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:7053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.key

# 2. Join Orderer 2 (Admin Port 8053)
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:8053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.key

# 3. Join Orderer 3 (Admin Port 9053)
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:9053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/server.key

# Verify channel creation on orderer
osnadmin channel list -o localhost:7053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.key
```

---

### Step 5: Join Peer Nodes to the Channel

Set organization MSP context and join each peer to `hijosupplychain`:

```bash
# 1. Join Agri Peer (Port 7051)
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer channel join -b ./channel-artifacts/orderer.genesis.block

# 2. Join Logistics Peer (Port 8051)
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer channel join -b ./channel-artifacts/orderer.genesis.block

# 3. Join Port Ops Peer (Port 9051)
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer channel join -b ./channel-artifacts/orderer.genesis.block
```

---

### Step 6: Deploy Chaincode-as-a-Service (CCAAS) Smart Contract

#### A. Package Chaincode
```bash
cd chaincode/banana_tracking
tar -czf code.tar.gz connection.json
tar -czf ../../banana_tracking.tar.gz metadata.json code.tar.gz
rm -f code.tar.gz
cd ../..
```

#### B. Install Package on All Peers
```bash
# Agri Peer
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode install banana_tracking.tar.gz

# Logistics Peer
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode install banana_tracking.tar.gz

# Port Peer
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode install banana_tracking.tar.gz
```

#### C. Calculate Package ID & Approve Chaincode
```bash
export CC_PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid banana_tracking.tar.gz)
echo "Package ID: ${CC_PACKAGE_ID}"

# Approve Agri Org
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt

# Approve Logistics Org
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt

# Approve Port Org
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt
```

#### D. Commit Chaincode Definition
```bash
peer lifecycle chaincode commit -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
    --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
    --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
```

#### E. Start Chaincode Container
```bash
export CC_PACKAGE_ID
cd docker
CHAINCODE_ID=${CC_PACKAGE_ID} docker compose -f docker-compose-hijo.yaml up -d chaincode.banana.tracking
cd ..
```

---

## 4. Automated One-Step Execution

Rather than running each CLI command manually, the entire configuration sequence is automated in `scripts/run_hijo_simulation.sh`:

```bash
chmod +x scripts/run_hijo_simulation.sh
./scripts/run_hijo_simulation.sh
```

---

## 5. Verification & Testing Commands

### A. Physical Layer: Verify Docker Network Connectivity
Check that all 11 infrastructure containers (Peers, Orderers, CouchDBs, Chaincode) are attached to the same Docker bridge network (`hijo_network`):

```bash
docker network inspect hijo_network --format '{{range .Containers}}{{.Name}} -> {{.IPv4Address}}{{"\n"}}{{end}}'
```

---

### B. Blockchain Layer: Verify Peer Ledger Block Synchronization
To confirm that **all organization peers are on the exact same blockchain state**, run `peer channel getinfo` on each peer and compare the output.

If the **`height`** and **`currentBlockHash`** match across all peers, they are synchronized on the exact same channel ledger!

```bash
# 1. Query Agri Peer (Port 7051)
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
echo "--- AGRI PEER INFO ---"
peer channel getinfo -c hijosupplychain

# 2. Query Logistics Peer (Port 8051)
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
echo "--- LOGISTICS PEER INFO ---"
peer channel getinfo -c hijosupplychain

# 3. Query Port Peer (Port 9051)
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
echo "--- PORT PEER INFO ---"
peer channel getinfo -c hijosupplychain
```

---

### C. Orderer Cluster Consensus Verification
Check that all 3 Raft orderer nodes are active consenters on the `hijosupplychain` channel:

```bash
# Query Orderer 1 (Port 7053)
osnadmin channel list -o localhost:7053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.key

# Query Orderer 2 (Port 8053)
osnadmin channel list -o localhost:8053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.key

# Query Orderer 3 (Port 9053)
osnadmin channel list -o localhost:9053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/server.key
```

---

### D. Smart Contract Approval Readiness Verification
Verify that all 3 organization MSPs (`HijoAgriMSP`, `HijoLogisticsMSP`, `HijoPortMSP`) have approved the smart contract definition on the network:

```bash
peer lifecycle chaincode checkcommitreadiness --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --sequence 1 --output json
```

---

### E. Test Transaction Invocation & Query
```bash
# Create a test batch
peer chaincode invoke -o localhost:7050 \
    --ordererTLSHostnameOverride orderer1.hijo.com \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    -C hijosupplychain -n banana_tracking \
    --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
    --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
    --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt \
    -c '{"function":"RegisterHarvestBatch","Args":["BATCH-001","Cavendish","5000","2026-08-03","Farm-Alpha"]}'

# Query the test batch
peer chaincode query -C hijosupplychain -n banana_tracking -c '{"function":"GetBatchHistory","Args":["BATCH-001"]}'
```

---

## 6. Troubleshooting Common Issues

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `osnadmin: error: rejected by orderer` | Mismatched TLS certificates or incorrect Admin port. | Verify port is `7053`/`8053`/`9053` and root CA file matches `orderer1.hijo.com`. |
| `endorsement failure: signature set did not satisfy policy` | Missing signatures from all required org peers. | Ensure `--peerAddresses` lists all 3 org peers (`agri`, `logistics`, `port`) in `commit` and `invoke`. |
| `Chaincode registration failed: container connection refused` | `CHAINCODE_ID` env variable mismatch in Docker container. | Ensure `CHAINCODE_ID` matches `CC_PACKAGE_ID` output by `peer lifecycle chaincode calculatepackageid`. |
