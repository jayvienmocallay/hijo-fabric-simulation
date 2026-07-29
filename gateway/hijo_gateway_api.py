# ==============================================================
# HIJO RESOURCE CORPORATION - SSO/LDAP TO FABRIC GATEWAY API
# ==============================================================

import time
from flask import Flask, request, jsonify

app = Flask(__name__)

LDAP_USER_DIRECTORY = {
    "jervis.pedotim@hijo.com":      {"password_hash":   "secret_pass_123", "cn": "Jervis Pedotim", 
    "ou": "Agriculture",        "uid": "EMP-AGRI-001"},
    "kyndel.suarez@hijo.com":       {"password_hash":    "secret_pass_456", "cn": "Kyndel Suarez", 
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
    ldap_user = authenticate_ldap_user(data.get("employee_email"), data.get("employee_password"))
    if not ldap_user or ldap_user["ou"] != "Agriculture":
        return jsonify({"status": "FAILED", "error": "Unauthorized Agriculture LDAP credentials"}), 401

    tx_id = f"TX_AGRI_{int(time.time())}"
    return jsonify({
        "status":           "SUCCESS",
        "department":       "Hijo Agriculture",
        "fabric_response":  {
            "channel"   :   "hijosupplychain",
            "chaincode" :   "banana_tracking",
            "function"  :   "CreateBatch",
            "tx_id"     :   tx_id,
            "payload"   :   { "batchId": data.get("batchId"), "farmLocation": data.get("farm_location"),
    "harvestDate": data.get("harvest_date"), "weightKg": data.get("weight_kg"), "updatedByUid": ldap_user["uid"] },
            "status"    :   "COMMITTED_TO_WORLD_STATE"
        }
    }), 200

@app.route('/api/v1/logistics/telemetry', methods=['PUT'])
def update_telemetry():
    data = request.json or {}
    ldap_user = authenticate_ldap_user(data.get("employee_email"), data.get("employee_password"))
    if not ldap_user or ldap_user["ou"] != "Logistics":
        return jsonify({"status": "FAILED", "error": "Unauthorized Logistics LDAP credentials"}), 401

    tx_id = f"TX_LOG_{int(time.time())}"
    return jsonify({
        "status":           "SUCCESS",
        "department":       "Hijo Logistics",
        "fabric_response":  {
            "channel"   :   "hijosupplychain",
            "chaincode" :   "banana_tracking",
            "function"  :   "UpdateTransportTelemetry",
            "tx_id"     :   tx_id,
            "payload"   :   { "batchId": data.get("batchId"), "transportStatus": data.get("transport_status"),
    "temperatureDegC": data.get("temperature_deg_c"), "newOwner": data.get("new_owner"), "updatedByUid": ldap_user["uid"] },
            "status"    :   "COMMITTED_TO_WORLD_STATE"
        }
    }), 200

@app.route('/api/v1/port/clearance', methods=['PUT'])
def clear_for_export():
    data = request.json or {}
    ldap_user = authenticate_ldap_user(data.get("employee_email"), data.get("employee_password"))
    if not ldap_user or ldap_user["ou"] != "Port Operations":
        return jsonify({"status": "FAILED", "error": "Unauthorized Port Ops LDAP credentials"}), 401

    tx_id = f"TX_PORT_{int(time.time())}"
    return jsonify({
        "status":           "SUCCESS",
        "department":       "Hijo Port Operations",
        "fabric_response":  {
            "channel"   :   "hijosupplychain",
            "chaincode" :   "banana_tracking",
            "function"  :   "ClearForExport",
            "tx_id"     :   tx_id,
            "payload"   :   { "batchId": data.get("batchId"), "portCustomsClear": True,
    "transportStatus": "LOADED_ON_VESSEL", "updatedByUid": ldap_user["uid"] },
            "status"    :   "COMMITTED_TO_WORLD_STATE"
        }
    }), 200

@app.route('/api/v1/batch/', methods=["GET"])
def query_batch(batch_id):
    return jsonify({
        "status": "SUCCESS",
        "world_state": {
            "batchId"           : batch_id,
            "farmLocation"      : "Tagum City Sector A4",
            "harvestDate"       : "2026-07-27",
            "weightKg"          : 12500.0,
            "currentOwner"      : "Hijo Port Operations",
            "transportStatus"   : "LOADED_ON_VESSEL",
            "temperatureDegC"   : 13.5,
            "portCustomsClear"  : True,
            "updatedByUid"       : "EMP-PORT-003"
        }
    }), 200

if __name__ == '__main__':
    print("HIJO RESOURCE CORPORATION - FABRIC API GATEWAY ACTIVE (PORT 5000)")
    app.run(host='0.0.0.0', port=5000)