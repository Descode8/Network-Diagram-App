from flask import Flask, jsonify, render_template, request
from data_extractor import build_hierarchy
from data_extractor import fetch_graph_data
from data_extractor import get_grouped_assets
from data_extractor import get_all_dependencies
import os


app = Flask(__name__)

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
        return render_template('index.html')
    
@app.route('/all-dependencies', methods=['GET'])
def all_dependencies():
    try:
        dependencies_list = get_all_dependencies()  # returns list of {Dependency_Type, Dependency_Name, Dependency_Descrip}
        return jsonify(dependencies_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/all-assets', methods=['GET'])
def all_assets():
    groups = get_grouped_assets()
    return jsonify(groups)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))  # Default to 5000 if PORT is not set
    app.run(host="0.0.0.0", port=port, debug=True)
