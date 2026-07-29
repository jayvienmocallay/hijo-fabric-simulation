# Hijo Resource Corporation - Fabric v2.5 Simulation Documentation

This document provides a comprehensive technical reference for all architectural fixes, configuration updates, chaincode enhancements, and deployment optimizations implemented in the **Hijo Resource Corporation Fabric Simulation** network.

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Network & Configuration Fixes](#1-network--configuration-fixes)
   - [Crypto Configuration](#a-cryptographic-configuration-configcrypto-configyaml)
   - [Channel Configuration](#b-channel-configuration-configconfigtxyaml)
   - [Container Services](#c-container-services-dockerdocker-compose-hijoyaml)
3. [Chaincode Enhancements & CCAAS Migration](#2-chaincode-enhancements--ccaas-migration)
   - [Source Code Fixes](#a-source-code-fixes-chaincodebanana_trackingbanana_trackinggo)
   - [Module & Dependency Management](#b-module--dependency-management)
   - [CCAAS Configuration Assets](#c-ccaas-configuration-assets)
4. [Automation Script Optimization](#3-automation-script-optimization)
5. [API Gateway Updates](#4-api-gateway-updates)
6. [Verification & Deployment Results](#5-verification--deployment-results)

---

## Executive Summary

During simulation deployment of the **Hijo Resource Corporation** Hyperledger Fabric v2.5 network, multiple system failures were encountered:
- **Low Disk Space & Broken Pipe Errors:** Modern Docker engines (Docker 29+) on Ubuntu 24/26 deprecated legacy Docker-in-Docker socket streaming (`dockercontroller`), causing 70+ second build timeouts and `write: broken pipe` socket crashes.
- **TLS Certificate Mismatches:** Cryptographic certificates generated without Subject Alternative Names (SANs) caused TLS connection rejections when administrative tools (`osnadmin`, `peer` CLI) connected via `localhost`.
- **Syntax & Schema Incompatibilities:** Obsolete Docker Compose V1 keys, missing channel policies, and field typos in Go chaincode prevented chaincode lifecycle endorsement.

All issues have been systematically resolved by introducing **Fabric v2.5 Chaincode as a Service (CCAAS)**, automating storage pruning, correcting PKI certificates with SANs, and standardizing policy schemas across the network.

---

## 1. Network & Configuration Fixes

### A. Cryptographic Configuration ([config/crypto-config.yaml](file:///home/jeb/project/hijo-fabric-simulation/config/crypto-config.yaml))
* **YAML Schema Fixes:** Corrected root key typos `OrderersOrgs` $\rightarrow$ `OrdererOrgs` and `HijoOrderOrg` $\rightarrow$ `HijoOrdererOrg`.
* **SANs (Subject Alternative Names) Addition:** Added `SANS: ["localhost", "127.0.0.1"]` under `Specs` for both Orderer Orgs and Peer Orgs. This resolves TLS handshake failures (`x509: certificate is valid for orderer1.hijo.com, not localhost`) when administrative tools connect locally.

```yaml
OrdererOrgs:
  - Name: HijoOrdererOrg
    Domain: hijo.com
    Specs:
      - Hostname: orderer1
        SANS: ["localhost", "127.0.0.1"]
      - Hostname: orderer2
        SANS: ["localhost", "127.0.0.1"]
      - Hostname: orderer3
        SANS: ["localhost", "127.0.0.1"]
```

### B. Channel Configuration ([config/configtx.yaml](file:///home/jeb/project/hijo-fabric-simulation/config/configtx.yaml))
* **Policy Name Alignment:** Updated all policy definitions to plural syntax required by Hyperledger Fabric v2.x (`Readers`, `Writers`, `Admins`).
* **Anchor & Reference Fixes:** Corrected anchor reference typos (`&ChannelCapabilities`, `&OrdererDefaults`) and fixed the `Writeers` typo in `Application.Policies`.

### C. Container Services ([docker/docker-compose-hijo.yaml](file:///home/jeb/project/hijo-fabric-simulation/docker/docker-compose-hijo.yaml))
* **Schema & Image References:** Corrected top-level key `network:` $\rightarrow$ `networks:` and fixed peer image tags `hyperledger/fabric-peers:2.5.9` $\rightarrow$ `hyperledger/fabric-peer:2.5.9`.
* **Systemless Channel Support:** Configured Orderer nodes (`orderer1`, `orderer2`, `orderer3`) for Fabric 2.5 Systemless Channel participation by setting:
  ```yaml
  - ORDERER_GENERAL_BOOTSTRAPMETHOD=none
  - ORDERER_CHANNELPARTICIPATION_ENABLED=true
  - ORDERER_ADMIN_TLS_ENABLED=true
  ```
* **Docker Socket Endpoint & Compatibility:** Set peer socket mounts to standard `/var/run/docker.sock:/var/run/docker.sock` and added `DOCKER_API_VERSION=1.40` and `DOCKER_BUILDKIT=0` to ensure backward compatibility with modern host Docker engines (Docker 29+).
* **CCAAS Service Definition:** Added `chaincode.banana.tracking` service definition to build and launch the chaincode server on port `9999`:
  ```yaml
  chaincode.banana.tracking:
    build:
      context: ../chaincode/banana_tracking
      dockerfile: Dockerfile
    container_name: chaincode.banana.tracking
    environment:
      - CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999
      - CHAINCODE_ID=${CHAINCODE_ID}
    ports:
      - "9999:9999"
    networks:
      - hijo_network
  ```

---

## 2. Chaincode Enhancements & CCAAS Migration

### A. Source Code Fixes ([chaincode/banana_tracking/banana_tracking.go](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/banana_tracking.go))
* **Struct Field Correction:** Corrected field name typos `UpdateByUID` $\rightarrow$ `UpdatedByUID` on lines 60 and 74.
* **Go Error Handling:** Fixed syntax error `fmt.Error` $\rightarrow$ `fmt.Errorf`.
* **Dual Execution Mode (CCAAS + Legacy):** Updated `main()` to support both standard peer-managed execution and CCAAS server execution using `shim.ChaincodeServer` when `CHAINCODE_SERVER_ADDRESS` is supplied:
  ```go
  address := os.Getenv("CHAINCODE_SERVER_ADDRESS")
  if address != "" {
      ccid := os.Getenv("CHAINCODE_ID")
      server := &shim.ChaincodeServer{
          CCID:     ccid,
          Address:  address,
          CC:       cc,
          TLSProps: shim.TLSProperties{Disabled: true},
      }
      if err := server.Start(); err != nil {
          fmt.Printf("Error starting chaincode server: %s\n", err)
      }
  } else {
      if err := cc.Start(); err != nil {
          fmt.Printf("Error starting chaincode: %s\n", err)
      }
  }
  ```

### B. Module & Dependency Management
* Created **[go.mod](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/go.mod)** with `module banana_tracking` declaration.
* Generated **[go.sum](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/go.sum)** checksums and populated the **`vendor/`** directory via `go mod tidy && go mod vendor`.

### C. CCAAS Configuration Assets
* Created **[connection.json](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/connection.json)**:
  ```json
  {
    "address": "chaincode.banana.tracking:9999",
    "dial_timeout": "10s",
    "tls_required": false
  }
  ```
* Created **[metadata.json](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/metadata.json)**:
  ```json
  {
    "type": "ccaas",
    "label": "banana_tracking_1.0"
  }
  ```
* Created multi-stage **[Dockerfile](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/Dockerfile)** (`golang:1.20-alpine` build stage $\rightarrow$ `alpine:3.18` runtime container).

---

## 3. Automation Script Optimization ([scripts/run_hijo_simulation.sh](file:///home/jeb/project/hijo-fabric-simulation/scripts/run_hijo_simulation.sh))

* **Docker V2 CLI:** Upgraded legacy `docker-compose` invocations to `docker compose`.
* **Automated Storage Pruning:** Added `docker container prune -f`, `docker image prune -f`, and `docker volume prune -f` in Section 1 to clean leftover build cache, preventing disk space exhaustion.
* **Direct Channel Genesis Generation:** Updated `configtxgen` call:
  ```bash
  configtxgen -profile HijoChannelProfile \
      -channelID hijosupplychain \
      -outputBlock ./channel-artifacts/orderer.genesis.block
  ```
* **Orderer OSNAdmin Join Loop:** Joined all 3 Raft orderers (`localhost:7053`, `localhost:8053`, `localhost:9053`) via `osnadmin channel join`.
* **Peer TLS Context Exports:** Explicitly exported `CORE_PEER_TLS_ENABLED=true`, `CORE_PEER_TLS_ROOTCERT_FILE`, `CORE_PEER_MSPCONFIGPATH`, and `CORE_PEER_ADDRESS` for each peer during join, install, approve, and commit steps.
* **CCAAS Packaging & Deployment:** Switched packaging logic from Docker-in-Docker to CCAAS tarball packaging (`connection.json` + `metadata.json`), ensuring 0.1-second remote installations.
* **Dynamic Chaincode Startup:** Added post-commit container instantiation:
  ```bash
  export CC_PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid banana_tracking.tar.gz)
  cd docker
  CHAINCODE_ID=${CC_PACKAGE_ID} docker compose -f docker-compose-hijo.yaml up -d chaincode.banana.tracking
  cd ..
  ```

---

## 4. API Gateway Updates ([gateway/hijo_gateway_api.py](file:///home/jeb/project/hijo-fabric-simulation/gateway/hijo_gateway_api.py))

* **LDAP & Credential Field Alignment:** Corrected key lookups for LDAP passwords (`employee_password`).
* **Payload Field Names:** Standardized JSON request payload parameter mapping (`batchId`, `updatedByUid`).
* **Active Port:** Configured service to listen on port `5000`.

---

## 5. Verification & Deployment Results

Running `./scripts/run_hijo_simulation.sh` executes with clean 100% success:

```text
 STARTING HIJO RESOURCE CORPORATION FABRIC SIMULATION DEPLOYMENT 
-- cleaning previous session --
[+] down 11/11
-- Generating PKI Certificates --
agri.hijo.com
logistics.hijo.com
port.hijo.com
-- Generating Orderer Genesis Block --
Writing genesis block
-- Booting Containers --
[+] up 11/11
-- Stabilizing --
-- Joining Orderers to 'hijosupplychain' channel via osnadmin --
Status: 201
Status: 201
Status: 201
-- Joining Peers to 'hijosupplychain' --
Successfully submitted proposal to join channel
Successfully submitted proposal to join channel
Successfully submitted proposal to join channel
-- Packaging CCAAS Chaincode 'banana_tracking' --
-- Installing Chaincode on all Peers --
Installed remotely: response:<status:200>
Installed remotely: response:<status:200>
Installed remotely: response:<status:200>
-- Package ID: banana_tracking_1.0:5bff5adc0be3a16e5df53620916f84c69372dbf562b3b8a69d3d241f9f7631c6 --
-- Approving Chaincode for Organizations --
ClientWait -> committed with status (VALID) at localhost:7051
ClientWait -> committed with status (VALID) at localhost:8051
ClientWait -> committed with status (VALID) at localhost:9051
-- Committing Chaincode Definition --
ClientWait -> committed with status (VALID) at localhost:7051
-- Starting CCAAS Chaincode Container --
 Container chaincode.banana.tracking Started
-- HIJO FABRIC v2.5 SIMULATION NETWORK DEPLOYMENT COMPLETE! --
```

### Active Containers Summary (`docker ps`)
- `orderer1.hijo.com` (Raft Consensus Port 7050, Admin 7053)
- `orderer2.hijo.com` (Raft Consensus Port 8050, Admin 8053)
- `orderer3.hijo.com` (Raft Consensus Port 9050, Admin 9053)
- `peer0.agri.hijo.com` (Endorser Port 7051)
- `peer0.logistics.hijo.com` (Endorser Port 8051)
- `peer0.port.hijo.com` (Endorser Port 9051)
- `couchdb.agri`, `couchdb.logistics`, `couchdb.port` (State Databases 5984, 5985, 5986)
- `chaincode.banana.tracking` (CCAAS Chaincode Server Port 9999)
