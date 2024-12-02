from flask import Flask, jsonify, render_template, request
from data_extractor import fetch_graph_data

app = Flask(__name__)

@app.route("/", methods=["GET"])
def index():
    """
    Serve the index page or return JSON if requested.
    """
    if request.headers.get("Accept") == "application/json":
        data = fetch_graph_data()  # Fetch the graph data from Excel
        return jsonify(data)  # Return as JSON
    else:
        return render_template('index.html')  # Serve HTML page

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
