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

# @app.route("/", methods=["GET"])
# def index():
#     if request.headers.get("Accept") == "application/json":
#         # Get depth and activeNode from query parameters
#         depth = int(request.args.get('depth', 2))  # Default to 2
#         requested_active_node = request.args.get('activeNode', None)  # Value sent from JS

#         # Fetch graph data and backend default active node
#         data, backend_default_active_node = fetch_graph_data()

#         # Use the requested active node if provided; otherwise, fallback to backend default
#         active_node = requested_active_node if requested_active_node else backend_default_active_node

#         # Log current state
#         print(f"Current Depth: {depth}")
#         print(f"Current Active Node: {active_node}")

#         # Build the hierarchy based on depth and active node
#         hierarchy = build_hierarchy(data, depth, active_node)

#         # Return the JSON response
#         return jsonify(hierarchy)
#     else:
#         # Render the HTML page for non-JSON requests
#         return render_template('index.html')

@app.route("/", methods=["GET"])
def index():
    if request.headers.get("Accept") == "application/json":
        try:
            # Get depth and activeNode from query parameters
            depth = int(request.args.get('depth', 2))  # Default to 2
            requested_active_node = request.args.get('activeNode', None)  # Value sent from JS

            # Fetch graph data and backend default active node
            data, backend_default_active_node = fetch_graph_data()

            if data is None or backend_default_active_node is None:
                return jsonify({"error": "Unable to load data"}), 500

            # Use the requested active node if provided; otherwise, fallback to backend default
            active_node = requested_active_node if requested_active_node else backend_default_active_node

            # Build the hierarchy based on depth and active node
            hierarchy = build_hierarchy(data, depth, active_node)

            # Return the JSON response
            return jsonify(hierarchy)
        except Exception as e:
            print(f"Error in index route: {e}")
            return jsonify({"error": str(e)}), 500
    else:
        # Render the HTML page for non-JSON requests
        return render_template('test2.html')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
