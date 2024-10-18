from flask import Flask, jsonify, render_template, request
from utilities.routes_utils import fetch_graph_data
import os

# Explicitly set the template folder path to 'utilities/templates'
app = Flask(__name__, template_folder=os.path.join('utilities', 'templates'))

@app.route("/", methods=["GET"])
def index():
    """
    Serve the index page or return JSON if requested.
    """
    if request.headers.get("Accept") == "application/json":
        data = fetch_graph_data()
        return jsonify(data)
    else:
        return render_template('index.html')  # Now it will look in 'utilities/templates/index.html'

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
