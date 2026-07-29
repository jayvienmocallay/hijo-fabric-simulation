# Docker Container Debugging Guide for Fabric

This guide outlines the common scenarios where you might need to enter a Docker container manually and the specific CLI commands you would use in those situations. 

To enter any running container, the general syntax is:
```bash
docker exec -it <container_name> bash
# or 'sh' if 'bash' is not available
```

---

## 1. Manual Fabric Commands (CLI)
Sometimes you need to interact with the blockchain ledger directly without using a client application or script. This is typically done inside a `peer` container (or a dedicated `cli` container).

**Command to enter the Agri Peer:**
```bash
docker exec -it peer0.agri.hijo.com bash
```

**Inside the container, you can run Fabric commands:**
```bash
# Check the peer's joined channels
peer channel list

# Fetch the oldest block of the channel
peer channel fetch oldest genesis.block -c hijosupplychain -o orderer1.hijo.com:7050

# Query the installed chaincodes
peer lifecycle chaincode queryinstalled
```

### Common Error: `Failed to authorize invocation due to failed ACL check`
If you get a 500 status error stating `The identity is not an admin under this MSP`, it means you are acting as a **Peer** instead of an **Admin**. Some commands (like `queryinstalled`) require Admin privileges. 

To fix this, you must copy the Admin certificates into the container and tell the CLI to use them:

**1. On your host machine (outside the container):**
Copy the Admin MSP to the container:
```bash
docker cp ./crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp peer0.agri.hijo.com:/etc/hyperledger/fabric/admin-msp
```

**2. Inside the container:**
Set the environment variable to use the Admin certificates, then try your command again:
```bash
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp
peer lifecycle chaincode queryinstalled
```

---

## 2. Troubleshooting Configuration Mounts (Certificates)
If a node fails to start with "certificate not found" errors, you need to verify that the Docker volume mounts correctly mapped your host machine's `crypto-config` files to the inside of the container.

**Command to enter the Orderer:**
```bash
docker exec -it orderer1.hijo.com sh
```

**Inside the container, verify the certificates exist:**
```bash
# Check if the MSP (Membership Service Provider) directory exists
ls -la /var/hyperledger/orderer/msp

# Check if the TLS certificates exist
ls -la /var/hyperledger/orderer/tls

# Verify the specific signing key is present
cat /var/hyperledger/orderer/msp/keystore/*_sk
```

---

## 3. Network Debugging
If containers cannot communicate (e.g., a peer cannot reach the CouchDB instance or an orderer), you can jump inside one container and test connectivity to the other.

**Command to enter the Logistics Peer:**
```bash
docker exec -it peer0.logistics.hijo.com bash
```

**Inside the container, test network connections:**
```bash
# Ping the CouchDB container by its Docker hostname
ping couchdb.logistics

# Check if the CouchDB port is reachable using curl
curl -v http://couchdb.logistics:5984

# Test connectivity to an orderer node on port 7050 using netcat (nc)
nc -zv orderer2.hijo.com 7050
```

---

## 4. Inspecting Environment Variables
To ensure the container booted with the exact configuration you intended (especially when debugging missing paths or wrong ports), you can inspect the active environment variables.

**Command to enter the Port Peer:**
```bash
docker exec -it peer0.port.hijo.com bash
```

**Inside the container, check the active environment:**
```bash
# View all environment variables
env

# Search for specific Fabric configuration variables
env | grep CORE_PEER

# Check the configured local MSP ID
echo $CORE_PEER_LOCALMSPID
```

---

## 5. Direct Database Access (CouchDB)
While CouchDB is usually queried via the host's exposed ports (e.g., `localhost:5984`), you might sometimes need to run database utilities directly inside the CouchDB container.

**Command to enter the Agri CouchDB:**
```bash
docker exec -it couchdb.agri bash
```

**Inside the container, query the local database:**
```bash
# Make a direct curl request to the local CouchDB instance
curl -s http://admin:adminpw@127.0.0.1:5984/_all_dbs

# Or interact with the CouchDB log files
tail -f /opt/couchdb/data/couch.log
```
