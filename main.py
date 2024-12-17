from flask import Flask, jsonify, render_template, request
# from data_extractor import fetch_graph_data
from test import build_hierarchy
from test import fetch_graph_data

app = Flask(__name__)

# @app.route("/", methods=["GET"])
# def index():
#     """
#     Serve the index page or return JSON if requested.
#     """
#     if request.headers.get("Accept") == "application/json":
#         data = fetch_graph_data()  # Fetch the graph data from Excel
#         return jsonify(data)  # Return as JSON
#     else:
#         return render_template('index.html')  # Serve HTML page

@app.route("/", methods=["GET"])
def index():
    if request.headers.get("Accept") == "application/json":
        depth = int(request.args.get('depth', 2))  # Default to 3 if not provided
        active_node = request.args.get('activeNode', None)
        data, active_node = fetch_graph_data()
        # If active_node is provided, filter or modify data accordingly before building hierarchy
        hierarchy = build_hierarchy(data, depth, active_node)
        return jsonify(hierarchy)
    else:
        return render_template('test.html')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
