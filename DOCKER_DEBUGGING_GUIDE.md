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
peer channel fetch oldest genesis.block -c hijosupplychain


```

### How to Verify All Organizations Are on the Same Network
While `peer channel list` tells you that a peer joined a channel, it doesn't prove they are synchronized. To definitively prove that all organizations (Agri, Logistics, Port) are connected and sharing the same ledger, you must compare their blockchain height and hash.

Run this locally (outside the docker container):
```bash
# Point to your fabric installation config
export FABRIC_CFG_PATH=/home/jeb/fabric-samples/config

# Check Agri Peer
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer channel getinfo -c hijosupplychain

# Check Logistics Peer (Swap Address and MSP)
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer channel getinfo -c hijosupplychain
```
*If all peers return the exact same `height` and `currentBlockHash`, they are successfully connected to the same network.*

### How to Run Admin Commands (e.g., queryinstalled)
If you try to run `peer lifecycle chaincode queryinstalled` from inside the `peer0.agri.hijo.com` container, you will get an error: `Failed to authorize invocation due to failed ACL check`. 

This happens because you are logged in using the **Peer's** identity, not the **Admin's** identity. The peer container does not have the Admin certificates inside it.

To fix this and successfully query chaincodes, you must run the command from your **host machine**, where all the certificates in `crypto-config` are accessible:

```bash
# Point to your fabric installation config
export FABRIC_CFG_PATH=/home/jeb/fabric-samples/config

# Tell the terminal to act as the Agri Admin
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Now query the installed chaincodes successfully
peer lifecycle chaincode queryinstalled
```


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
