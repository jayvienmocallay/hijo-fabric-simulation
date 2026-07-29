# ====================================================================
# HIJO RESOURCE CORPORATION - FABRIC v2.5 SIMULATION DEPLOYMENT SCRIPT
# ====================================================================

set -e

echo " STARTING HIJO RESOURCE CORPORATION FABRIC SIMULATION DEPLOYMENT "

# 1. Clean previous environment
echo "-- cleaning previous session --"
cd docker
docker compose -f docker-compose-hijo.yaml down -v --remove-orphans || true
cd ..

rm -rf channel-artifacts/* crypto-config/*
mkdir -p channel-artifacts crypto-config

# Prune unused Docker build layers, old chaincode images, and orphaned volumes
docker container prune -f
docker image prune -f
docker volume prune -f

# 2. Generate Cryptographic Identities
echo "-- Generating PKI Certificates --"
cryptogen generate --config=./config/crypto-config.yaml --output="crypto-config"

# 3. Generate Genesis Block and Channel Transactions
echo "-- Generating Orderer Genesis Block --"
FABRIC_CFG_PATH=${PWD}/config configtxgen -profile HijoChannelProfile \
    -channelID hijosupplychain \
    -outputBlock ./channel-artifacts/orderer.genesis.block

# echo "-- Generating Channel Creation Transaction --"
# FABRIC_CFG_PATH=${PWD}/config configtxgen -profile HijoChannelProfile \
#     -channelID hijosupplychain \
#     -outputCreateChannelTx ./channel-artifacts/hijosupplychain.tx

# 4. Boot Infrastructure
echo "-- Booting Containers --"
cd docker
docker compose -f docker-compose-hijo.yaml up -d
cd ..

echo "-- Stabilizing --"
sleep 10

# 5. Create Channel & Join Peers
echo "-- Joining Orderers to 'hijosupplychain' channel via osnadmin --"
# Join Orderer1
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:7053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/server.key
# Join Orderer2
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:8053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer2.hijo.com/tls/server.key
# Join Orderer3
osnadmin channel join --channelID hijosupplychain \
    --config-block ./channel-artifacts/orderer.genesis.block \
    -o localhost:9053 \
    --ca-file ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/ca.crt \
    --client-cert ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/server.crt \
    --client-key ./crypto-config/ordererOrganizations/hijo.com/orderers/orderer3.hijo.com/tls/server.key

echo "-- Joining Peers to 'hijosupplychain' --"
# Join Agri Peer
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer channel join -b ./channel-artifacts/orderer.genesis.block

# Join Logistics Peer
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer channel join -b ./channel-artifacts/orderer.genesis.block

# Join Port Peer
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer channel join -b ./channel-artifacts/orderer.genesis.block

# 6. Chaincode Lifecycle
echo "-- Packaging CCAAS Chaincode 'banana_tracking' --"
cd chaincode/banana_tracking
tar -czf code.tar.gz connection.json
tar -czf ../../banana_tracking.tar.gz metadata.json code.tar.gz
rm -f code.tar.gz
cd ../..

echo "-- Installing Chaincode on all Peers --"
# Agri Peer
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode install banana_tracking.tar.gz

# Logistics Peer
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode install banana_tracking.tar.gz

# Port Peer
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode install banana_tracking.tar.gz

export CC_PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid banana_tracking.tar.gz)
echo "-- Package ID:${CC_PACKAGE_ID} --"

echo "-- Approving Chaincode for Organizations --"
# Approve Agri
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoAgriMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt
    
# Approve Logistics
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoLogisticsMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/users/Admin@logistics.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt

# Approve Port
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HijoPortMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/crypto-config/peerOrganizations/port.hijo.com/users/Admin@port.hijo.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --package-id ${CC_PACKAGE_ID} --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt

echo "-- Committing Chaincode Definition --"
peer lifecycle chaincode commit -o localhost:7050 --channelID hijosupplychain \
    --name banana_tracking --version 1.0 --sequence 1 \
    --tls --cafile ${PWD}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt \
    --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt \
    --peerAddresses localhost:8051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt \
    --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt

echo "-- Starting CCAAS Chaincode Container --"
export CC_PACKAGE_ID
cd docker
CHAINCODE_ID=${CC_PACKAGE_ID} docker compose -f docker-compose-hijo.yaml up -d chaincode.banana.tracking
cd ..

echo "-- HIJO FABRIC v2.5 SIMULATION NETWORK DEPLOYMENT COMPLETE! --"