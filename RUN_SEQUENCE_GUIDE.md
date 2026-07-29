# Hijo Fabric Simulation: Deployment Sequence Guide

This guide details the exact step-by-step sequence executed by the `scripts/run_hijo_simulation.sh` script to bring up the Hijo Supply Chain network from scratch.

---

### 1. Environment Cleanup
Before starting the network, the script ensures a clean slate to avoid conflicts with previous runs.
*   **Stop and Remove Containers:** Runs `docker compose down -v` to kill any running nodes, CouchDB instances, or chaincode containers and removes their attached data volumes.
*   **Remove Old Artifacts:** Deletes all previously generated certificates inside `crypto-config/` and channel blocks inside `channel-artifacts/`.
*   **Docker Prune:** Cleans up orphaned Docker build layers, old unused chaincode images, and dangling volumes to free up space.

### 2. Generate Cryptographic Identities (PKI)
Hyperledger Fabric requires X.509 certificates for all nodes and users to authenticate transactions.
*   **Tool Used:** `cryptogen`
*   **Action:** The script reads `./config/crypto-config.yaml` to determine the network topology (3 Orderers, 3 Peer Organizations: Agri, Logistics, Port) and generates the corresponding public/private key pairs and MSP (Membership Service Provider) structures into the `crypto-config/` directory.

### 3. Generate Genesis Block
The network needs an initial configuration block (the Genesis Block) to bootstrap the channel.
*   **Tool Used:** `configtxgen`
*   **Action:** It reads `./config/configtx.yaml` (specifically the `HijoChannelProfile`) and outputs the genesis block to `./channel-artifacts/orderer.genesis.block`. This block contains the definitions of all the organizations, consortiums, and orderer configurations for the `hijosupplychain` channel.

### 4. Boot Infrastructure
With the certificates and genesis block ready, the core network components are started.
*   **Tool Used:** `docker compose`
*   **Action:** The script boots the infrastructure using `docker/docker-compose-hijo.yaml`. This starts the 3 Raft Orderer nodes, the 3 Peer nodes, and the 3 CouchDB state databases in the background (`-d`). It then pauses for 10 seconds to let the containers stabilize.

### 5. Create Channel & Join Nodes
The network components are running, but they need to join the `hijosupplychain` channel to communicate.
*   **Join Orderers:** The script uses the `osnadmin` tool (acting as an Orderer Admin) to tell each of the 3 orderer nodes (`orderer1`, `orderer2`, `orderer3`) to join the channel using the genesis block.
*   **Join Peers:** The script switches its identity to act as the Admin for each organization (Agri, Logistics, Port) one by one. Using the `peer channel join` command, it makes `peer0.agri`, `peer0.logistics`, and `peer0.port` join the `hijosupplychain` channel.

### 6. Chaincode Lifecycle (CCAAS)
Hyperledger Fabric v2.x requires a specific lifecycle to deploy smart contracts. This project uses Chaincode-as-a-Service (CCAAS), meaning the chaincode runs in its own external Docker container rather than being built dynamically by the peers.
*   **Step A: Package Chaincode:** It creates a `.tar.gz` archive containing a `connection.json` and `metadata.json`. This tells the peers *where* to find the external chaincode service.
*   **Step B: Install Chaincode:** Acting as the Admin for each organization, the script installs the package on `peer0.agri`, `peer0.logistics`, and `peer0.port`.
*   **Step C: Approve Chaincode:** Fabric requires organizations to explicitly agree to the chaincode definition. The script approves version `1.0` of `banana_tracking` on behalf of all three organizations.
*   **Step D: Commit Chaincode:** Once a majority of organizations have approved it, the chaincode definition is formally committed to the channel using `peer lifecycle chaincode commit`.
*   **Step E: Start Chaincode Container:** Finally, the actual chaincode logic container (`chaincode.banana.tracking`) is booted via Docker Compose, passing the generated `CC_PACKAGE_ID` so the chaincode knows how to register itself with the peers.

---
*Once these steps complete successfully, the network is active, the chaincode is ready to receive transactions, and the API Gateway can be started to interact with the ledger.*
