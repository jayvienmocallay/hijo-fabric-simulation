# ==============================================================
# HIJO RESOURCE CORPORATION - SSO/LDAP TO FABRIC GATEWAY API
# ==============================================================

import time
from flask import Flask, request, jsonify

app = Flask(__name__)

LDAP_USER_DIRECTORY = {
    "jervis.pedotim@hijo.com":      {"password_hash":   "secret_pass_123", "cn": "Jervis Pedotim", 
    "ou": "Agriculture",        "uid": "EMP-AGRI-001"},
    "kyndel.suarez@hijo.com":       {"pasword_hash":    "secret_pass_456", "cn": "Kyndel Suarez", 
    "ou": "Logistics",          "uid": "EMP-LOG-002"},
    "domince.aseberos@hijo.com":    {"password_hash":   "secret_pass_789", "cn": "Domince Aseberos", 
    "ou": "Port Operations",    "uid": "EMP-PORT-003"}
}

def authenticate_ldap_user(email, password):
    user = LDAP_USER_DIRECTORY.get(email)
    if user and user["password_hash"] == password:
        return user
    return None

@app.route('/api/v1/agriculture/batch', methods=['POST'])
def create_batch():
    data = request.json or {}
    ldap_user = authenticate_ldap_user(data.get("employee_email"), data.get("employee_pass"))
    if not ldap_user or ldap_user["ou"] != "Agriculture":
        return jsonify({"status": "FAILED", "error": "Unauthorized Agricultural LDAP credentials"}), 401

    tx_id = f"TX_AGRI_{int(time.time())}"
    return jsonify({
        "status":           "SUCCESS",
        "department":       "Hijo Agriculture",
        "fabric_response":  {
            "channel"   :   "hijosupplychain",
            "chaincode" :   "banana_tracking",
            "function"  :   "CreateBatch",
            "tx_id"     :   tx_id,
            "payload"   :   { "batchID": data.get("batchID"), "farmLocation": data.get("farm_location"),
    "harvestdate": data.get("harvest_date"), "weightKg": data.get("weight_kg"), "updateByUid": ldap_user["uid"] },
            "status"    :   "COMMITED_TO_WORLD_STATE"
        }
    }), 200

@app.route('/api/v1/logistics/telemetry', methods=['PUT'])
def update_telemetry():
    data = request.json or {}
    ldap_user = authenticate_ldap_user(data.get("employee_email"), data.get("employee_pass"))
    if not ldap_user or ldap_user["ou"] != "Logistics":
        return jsonify({"status": "FAILED", "error": "Unauthorized Logistics LDAP credentials"}), 401

    tx_id = f"TX_LOG_{int(time.time())}"
    return jsonify({
        "status":           "SUCCESS",
        "department":       "Hijo Logistics",
        "fabric_response":  {
            "channel"   :   "hijosupplychain",
            "chaincode" :   "banana_tracking",
            "function"  :   "CreateBatch",
            "tx_id"     :   tx_id,
            "payload"   :   { "batchID": data.get("batchID"), "transportStatus": data.get("transport_status"),
    "temperatureDegC": data.get("temperature_deg_c"), "newOwner": data.get("new_owner"), "updateByUid": ldap_user["uid"] },
            "status"    :   "COMMITED_TO_WORLD_STATE"
        }
    }), 200

@app.route('/api/v1/port/telemetry', methods=['PUT'])
def update_telemetry():
    data = request.json or {}
    ldap_user = authenticate_ldap_user(data.get("employee_email"), data.get("employee_pass"))
    if not ldap_user or ldap_user["ou"] != "Port Operations":
        return jsonify({"status": "FAILED", "error": "Unauthorized Port Ops LDAP credentials"}), 401

    tx_id = f"TX_PORT_{int(time.time())}"
    return jsonify({
        "status":           "SUCCESS",
        "department":       "Hijo Port Operations",
        "fabric_response":  {
            "channel"   :   "hijosupplychain",
            "chaincode" :   "banana_tracking",
            "function"  :   "CreateBatch",
            "tx_id"     :   tx_id,
            "payload"   :   { "batchID": data.get("batchID"), "portCustomsClear": True,
    "transportStatus": "LOADED_ON_VESSEL", "updateByUid": ldap_user["uid"] },
            "status"    :   "COMMITED_TO_WORLD_STATE"
        }
    }), 200

@app.route('/api/v1/batch/', methods=["GET"])
def query_batch(batch_id):
    return jsonify({
        "status": "SUCCESS",
        "world_state": {
            ""
        }
        }
    })