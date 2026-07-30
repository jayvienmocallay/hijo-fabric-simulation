#!/usr/bin/env python3
import os
import json
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ALLOWED_NODES = {
    "peer0.agri.hijo.com": "peer0.agri.hijo.com",
    "peer0.logistics.hijo.com": "peer0.logistics.hijo.com",
    "peer0.port.hijo.com": "peer0.port.hijo.com",
    "orderer1.hijo.com": "orderer1.hijo.com",
    "orderer2.hijo.com": "orderer2.hijo.com",
    "orderer3.hijo.com": "orderer3.hijo.com",
    "chaincode.banana.tracking": "chaincode.banana.tracking",
    "couchdb.agri": "couchdb.agri",
    "couchdb.logistics": "couchdb.logistics",
    "couchdb.port": "couchdb.port"
}

CERT_PATHS = {
    "agri": "crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/msp/signcerts/peer0.agri.hijo.com-cert.pem",
    "logistics": "crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/msp/signcerts/peer0.logistics.hijo.com-cert.pem",
    "port": "crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/msp/signcerts/peer0.port.hijo.com-cert.pem",
    "orderer": "crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/msp/signcerts/orderer1.hijo.com-cert.pem"
}

class LogServerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(__file__), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/logs":
            params = parse_qs(parsed.query)
            node = params.get("node", ["peer0.agri.hijo.com"])[0]
            lines = params.get("lines", ["60"])[0]

            container = ALLOWED_NODES.get(node)
            if not container:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": "Invalid node"}).encode())
                return

            try:
                cmd = ["docker", "logs", "--tail", lines, container]
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=5)
                payload = {
                    "status": "SUCCESS",
                    "node": container,
                    "logs": res.stdout or "No log output recorded."
                }
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": str(e)}).encode())

        elif parsed.path == "/api/cert":
            params = parse_qs(parsed.query)
            org = params.get("org", ["agri"])[0]
            rel_path = CERT_PATHS.get(org, CERT_PATHS["agri"])
            cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            full_path = os.path.join(cwd, rel_path)

            if not os.path.exists(full_path):
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": f"Cert file {rel_path} not found"}).encode())
                return

            try:
                with open(full_path, "r") as f:
                    pem_content = f.read()

                cmd = ["openssl", "x509", "-in", full_path, "-text", "-noout"]
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "SUCCESS",
                    "org": org,
                    "path": rel_path,
                    "pem": pem_content,
                    "text": res.stdout
                }).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": str(e)}).encode())

        elif parsed.path == "/api/query":
            params = parse_qs(parsed.query)
            batch_id = params.get("batchId", ["BATCH101"])[0]
            cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            env = os.environ.copy()
            env["CORE_PEER_TLS_ENABLED"] = "true"
            env["CORE_PEER_LOCALMSPID"] = "HijoAgriMSP"
            env["CORE_PEER_TLS_ROOTCERT_FILE"] = f"{cwd}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt"
            env["CORE_PEER_MSPCONFIGPATH"] = f"{cwd}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp"
            env["CORE_PEER_ADDRESS"] = "localhost:7051"

            args_json = json.dumps({"Args": ["QueryBatch", batch_id]})
            cmd = ["peer", "chaincode", "query", "-C", "hijosupplychain", "-n", "banana_tracking", "-c", args_json]
            
            try:
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=cwd, env=env)
                self.send_response(200 if res.returncode == 0 else 400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                if res.returncode == 0:
                    payload = json.loads(res.stdout)
                    self.wfile.write(json.dumps({"status": "SUCCESS", "data": payload}).encode())
                else:
                    self.wfile.write(json.dumps({"status": "ERROR", "output": res.stdout}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": str(e)}).encode())

        elif parsed.path == "/api/history":
            params = parse_qs(parsed.query)
            batch_id = params.get("batchId", ["BATCH101"])[0]
            cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            env = os.environ.copy()
            env["CORE_PEER_TLS_ENABLED"] = "true"
            env["CORE_PEER_LOCALMSPID"] = "HijoAgriMSP"
            env["CORE_PEER_TLS_ROOTCERT_FILE"] = f"{cwd}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt"
            env["CORE_PEER_MSPCONFIGPATH"] = f"{cwd}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp"
            env["CORE_PEER_ADDRESS"] = "localhost:7051"

            args_json = json.dumps({"Args": ["GetBatchHistory", batch_id]})
            cmd = ["peer", "chaincode", "query", "-C", "hijosupplychain", "-n", "banana_tracking", "-c", args_json]

            try:
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=cwd, env=env)
                self.send_response(200 if res.returncode == 0 else 400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                if res.returncode == 0:
                    payload = json.loads(res.stdout)
                    self.wfile.write(json.dumps({"status": "SUCCESS", "history": payload}).encode())
                else:
                    self.wfile.write(json.dumps({"status": "ERROR", "output": res.stdout}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": str(e)}).encode())

        elif parsed.path == "/api/batches":
            try:
                cmd = ["curl", "-s", "http://admin:adminpw@localhost:5984/hijosupplychain_banana_tracking/_all_docs?include_docs=true"]
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=5)
                data = json.loads(res.stdout)
                docs = []
                if "rows" in data:
                    for row in data["rows"]:
                        if "doc" in row and not row["id"].startswith("_design") and not row["id"].startswith("~"):
                            docs.append(row["doc"])
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "SUCCESS", "batches": docs}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": str(e)}).encode())
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/invoke":
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body.decode())

            func = data.get("function")
            args = data.get("args", [])

            cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            env = os.environ.copy()
            env["CORE_PEER_TLS_ENABLED"] = "true"
            env["CORE_PEER_LOCALMSPID"] = "HijoAgriMSP"
            env["CORE_PEER_TLS_ROOTCERT_FILE"] = f"{cwd}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt"
            env["CORE_PEER_MSPCONFIGPATH"] = f"{cwd}/crypto-config/peerOrganizations/agri.hijo.com/users/Admin@agri.hijo.com/msp"
            env["CORE_PEER_ADDRESS"] = "localhost:7051"

            args_json = json.dumps({"Args": [func] + [str(a) for a in args]})

            cmd = [
                "peer", "chaincode", "invoke", "-o", "localhost:7050",
                "--ordererTLSHostnameOverride", "orderer1.hijo.com",
                "--tls", "--cafile", f"{cwd}/crypto-config/ordererOrganizations/hijo.com/orderers/orderer1.hijo.com/tls/ca.crt",
                "-C", "hijosupplychain", "-n", "banana_tracking",
                "--peerAddresses", "localhost:7051", "--tlsRootCertFiles", f"{cwd}/crypto-config/peerOrganizations/agri.hijo.com/peers/peer0.agri.hijo.com/tls/ca.crt",
                "--peerAddresses", "localhost:8051", "--tlsRootCertFiles", f"{cwd}/crypto-config/peerOrganizations/logistics.hijo.com/peers/peer0.logistics.hijo.com/tls/ca.crt",
                "--peerAddresses", "localhost:9051", "--tlsRootCertFiles", f"{cwd}/crypto-config/peerOrganizations/port.hijo.com/peers/peer0.port.hijo.com/tls/ca.crt",
                "-c", args_json
            ]

            try:
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=cwd, env=env)
                self.send_response(200 if res.returncode == 0 else 400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "SUCCESS" if res.returncode == 0 else "ERROR",
                    "output": res.stdout
                }).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": str(e)}).encode())

def run():
    server_address = ("0.0.0.0", 8080)
    httpd = HTTPServer(server_address, LogServerHandler)
    print("Serving Live Fabric Log Dashboard & Cert Inspector API on http://0.0.0.0:8080 ...")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
