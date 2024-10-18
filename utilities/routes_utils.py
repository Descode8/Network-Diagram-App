import mysql.connector

# Database configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'NoWay2023!!',
    'database': 'network_diagram'
}

def build_hierarchy(data, parent_name):
    """
    Recursively build a nested hierarchy of nodes and their children.
    """
    children = [
        {
            "name": item["child_name"],
            "description": item["child_description"],
            "tier": item["child_tier"],
            "children": build_hierarchy(data, item["child_name"])
        }
        for item in data if item["parent_name"] == parent_name
    ]
    return children

def fetch_graph_data():
    """
    Fetch hierarchical graph data from MySQL and convert it into a nested JSON structure.
    """
    try:
        # Connect to the MySQL database
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Query to get parent-child relationships and nodes details
        cursor.execute("""
            SELECT 
                parent.node_name AS parent_name, 
                parent.description AS parent_description, 
                parent.tier AS parent_tier,
                child.node_name AS child_name, 
                child.description AS child_description, 
                child.tier AS child_tier
            FROM edges
            JOIN nodes AS parent ON edges.parent_node_id = parent.node_id
            JOIN nodes AS child ON edges.child_node_id = child.node_id;
        """)
        data = cursor.fetchall()

        # Close the cursor and connection
        cursor.close()
        connection.close()

        # Build the hierarchy starting from the 'WittyAI' root nodes
        hierarchy = {
            "name": "WittyAI",
            "description": "A chatbot web application used to answer user questions.",
            "tier": "Presentation Tier",
            "children": build_hierarchy(data, "WittyAI")
        }

        return hierarchy

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return {"error": "Database connection failed"}
