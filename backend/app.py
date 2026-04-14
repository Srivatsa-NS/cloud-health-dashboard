import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from flask import Flask, jsonify
from flask_cors import CORS

from routes import ecs, ec2, alarms, security, s3, logs, insights, monitor

app = Flask(__name__)
CORS(app)

# Register all blueprints
app.register_blueprint(ecs.bp)
app.register_blueprint(ec2.bp)
app.register_blueprint(alarms.bp)
app.register_blueprint(security.bp)
app.register_blueprint(s3.bp)
app.register_blueprint(logs.bp)
app.register_blueprint(insights.bp)
app.register_blueprint(monitor.bp)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
