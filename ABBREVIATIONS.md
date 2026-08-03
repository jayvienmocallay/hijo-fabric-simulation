# Hijo Resource Corporation - Fabric Simulation Abbreviations & Glossary

This document provides a comprehensive reference of all abbreviations, acronyms, and technical terms used throughout the **Hijo Resource Corporation Hyperledger Fabric v2.5 Simulation** repository.

---

## 1. Hyperledger Fabric & Blockchain Architecture

| Abbreviation | Full Name | Technical Description & Context in Repository |
| :--- | :--- | :--- |
| **CC** | Chaincode | Hyperledger Fabric's term for smart contracts implementing business logic on the ledger (e.g., [`banana_tracking.go`](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/banana_tracking.go)). |
| **CCAAS** | Chaincode as a Service | Fabric v2.5+ deployment mode where chaincode runs as an external HTTP server container (`chaincode.banana.tracking`) instead of peer-managed Docker-in-Docker containers. |
| **CCID** | Chaincode Identifier | Unique hash identifier string assigned to a deployed chaincode package (e.g., `banana_tracking_1.0:<hash>`). |
| **MSP** | Membership Service Provider | Component that defines organization identities, roles, and cryptographic access rights across the network. |
| **OSN** | Orderer Service Node | The consensus node service managing block creation and channel transactions (`orderer1`, `orderer2`, `orderer3`). |
| **`osnadmin`** | Orderer Service Node Administration | Fabric v2.x CLI/REST utility used for systemless channel management (e.g., `osnadmin channel join`). |
| **RAFT** | Raft Consensus Algorithm | Crash Fault-Tolerant (CFT) consensus protocol utilized by the orderer cluster for block ordering. |
| **Org / Orgs** | Organization(s) | Member entities participating in the simulation network (`AgriOrg`, `LogisticsOrg`, `PortOrg`, `HijoOrdererOrg`). |
| **PDC** | Private Data Collection | Mechanism for storing confidential transaction data off-ledger between authorized orgs while committing data hashes to the public channel. |

---

## 2. Security, Cryptography & PKI

| Abbreviation | Full Name | Technical Description & Context in Repository |
| :--- | :--- | :--- |
| **PKI** | Public Key Infrastructure | System of digital certificates, public/private key pairs, and CAs governing network security. |
| **CA** | Certificate Authority | Entity that issues X.509 digital certificates to network identities (generated via `cryptogen` using [`config/crypto-config.yaml`](file:///home/jeb/project/hijo-fabric-simulation/config/crypto-config.yaml)). |
| **TLS** | Transport Layer Security | Cryptographic protocol providing encrypted communication channels between network nodes. |
| **mTLS** | Mutual Transport Layer Security | Two-way authentication requiring both client and server to validate each other's TLS certificates. |
| **SAN / SANs** | Subject Alternative Name(s) | X.509 extension specifying hostnames and IP addresses (`localhost`, `127.0.0.1`) to resolve local TLS verification issues. |
| **PEM** | Privacy-Enhanced Mail | Text-based encoding format used for storing certificates and private keys (`.crt`, `.pem`, `.key`). |
| **X.509** | ITU-T X.509 Standard | Digital certificate format standard defining public keys and identity metadata. |
| **ECDSA** | Elliptic Curve Digital Signature Algorithm | Cryptographic algorithm used to sign transactions and verify block integrity. |
| **SKI** | Subject Key Identifier | Unique SHA hash of a public key embedded inside X.509 certificates. |
| **AKI** | Authority Key Identifier | SHA hash identifying the public key of the issuing Certificate Authority. |

---

## 3. Containerization & Infrastructure

| Abbreviation | Full Name | Technical Description & Context in Repository |
| :--- | :--- | :--- |
| **CLI** | Command Line Interface | Terminal administrative utilities used in automation scripts (e.g., `docker`, `peer`, `osnadmin`). |
| **CPU** | Central Processing Unit | Compute processor resources allocated to Docker containers. |
| **IP** | Internet Protocol | Network layer address (`127.0.0.1`, `0.0.0.0`) used by peer and orderer endpoints. |
| **OS** | Operating System | Host operating platform executing the simulation (Linux / Ubuntu). |

---

## 4. Data Formats, Protocols & Web APIs

| Abbreviation | Full Name | Technical Description & Context in Repository |
| :--- | :--- | :--- |
| **API** | Application Programming Interface | Exposed interface endpoints for external system integration (e.g., [`gateway/hijo_gateway_api.py`](file:///home/jeb/project/hijo-fabric-simulation/gateway/hijo_gateway_api.py)). |
| **REST** | Representational State Transfer | Architectural style used for HTTP API web services and CouchDB interactions. |
| **LDAP** | Lightweight Directory Access Protocol | Protocol utilized in the API Gateway for authenticating employee identities. |
| **JSON** | JavaScript Object Notation | Data serialization format used for API payloads and CCAAS configuration metadata ([`connection.json`](file:///home/jeb/project/hijo-fabric-simulation/chaincode/banana_tracking/connection.json)). |
| **YAML** | YAML Ain't Markup Language | Data serialization format used for infrastructure configurations ([`configtx.yaml`](file:///home/jeb/project/hijo-fabric-simulation/config/configtx.yaml), [`docker-compose-hijo.yaml`](file:///home/jeb/project/hijo-fabric-simulation/docker/docker-compose-hijo.yaml)). |
| **HTTP / HTTPS**| Hypertext Transfer Protocol (Secure) | Web protocol underlying API, CouchDB, and CCAAS server communications. |
| **CRUD** | Create, Read, Update, Delete | Fundamental database operations executed by chaincode against ledger state databases. |

---

## 5. Identifiers & Application Terms

| Abbreviation | Full Name | Technical Description & Context in Repository |
| :--- | :--- | :--- |
| **UID** | Unique Identifier / User ID | Employee identification field tracked in chaincode transactions (`UpdatedByUID`). |
| **ID** | Identifier | Unique string key (e.g., `BatchID`, `ChannelID`). |
| **DB** | Database | Ledger state storage instances (CouchDB databases `couchdb.agri`, `couchdb.logistics`, `couchdb.port`). |
| **SDK** | Software Development Kit | Client libraries used by application gateways to interact with Fabric networks. |
| **URL** | Uniform Resource Locator | Endpoint address format for network services. |
| **MVCC** | Multi-Version Concurrency Control | Versioning control method used by Fabric peers to prevent race conditions and state write collisions. |
