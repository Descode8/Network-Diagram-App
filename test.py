import os
import pandas as pd
import json

# Function to fetch data from an Excel file
def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
    try:
        if not os.path.exists(excel_file):
            raise FileNotFoundError(f"{excel_file} not found.")
        
        data = pd.read_excel(excel_file)
        return data
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

def build_hierarchy(data, depth):
    """
    Builds a hierarchical JSON structure from tabular data.

    Parameters:
    - data (DataFrame): The input data containing CI information.
    - depth (int): The maximum depth of the hierarchy to build.

    Returns:
    - dict: A hierarchical JSON-like dictionary structure representing the data.
    """

    # Get the active node name from the first row of the dataset
    active_node_name = data.loc[0, 'CI_Name']

    # Filter rows corresponding to the active node
    active_data = data[data['CI_Name'] == active_node_name]

    # Initialize the root of the hierarchy (active node)
    # This represents the starting point for the hierarchy
    active_node = {
        "name": active_node_name,                          # Name of the active node
        "type": active_data.iloc[0]['CI_Type'],            # CI_Type for the active node
        "relationship": active_data.iloc[0]['Rel_Type'],   # Rel_Type of the active node
        "description": active_data.iloc[0]['CI_Descrip'],  # Description of the active node
        "children": []                                     # Placeholder for child nodes
    }

    # Use a queue to process nodes iteratively (breadth-first approach)
    queue = [
        {
            "node": active_node,                           # Current node being processed
            "current_depth": depth,                       # Remaining depth for this node
            "ci_name": active_node_name                   # CI_Name of the current node
        }
    ]

    # Process the hierarchy layer by layer
    while queue:
        # Get the current node and its depth from the queue
        current = queue.pop(0)
        current_node = current["node"]                    # Node currently being processed
        current_depth = current["current_depth"]          # Remaining depth for this node
        current_ci_name = current["ci_name"]              # CI_Name of the current node

        # Stop processing if the current depth reaches 1 (base case for recursion)
        if current_depth == 1:
            continue

        # Filter rows where CI_Name matches the current node's name
        current_data = data[data['CI_Name'] == current_ci_name]

        # Group the current node's dependencies by Dependency_Type
        dependency_types = current_data.groupby('Dependency_Type')

        # Iterate over each dependency type group
        for dependency_type, dependency_group in dependency_types:
            # Create a dependency node for this type
            dependency_node = {
                "type": dependency_type,                  # Type of dependency
                "relationship": dependency_group.iloc[0]['Rel_Type'],  # Relationship type
                "children": []                            # Placeholder for child dependencies
            }

            # Iterate over all dependencies in this group
            for _, row in dependency_group.iterrows():
                # Look ahead to see if this dependency has further children
                child_data = data[data['CI_Name'] == row["Dependency_Name"]]
                child_has_children = not child_data.empty  # True if child has dependencies

                # Create a child node for this dependency
                child_node = {
                    "name": row["Dependency_Name"],       # Name of the dependency
                    "type": row["Dependency_Type"],       # Type of the dependency
                    "relationship": row["Rel_Type"] if child_has_children else None,  # Rel_Type if it has children
                    "description": row["Dependency_Descrip"],  # Description of the dependency
                    "children": []                        # Placeholder for further children
                }

                # Add the child node to the processing queue if depth allows
                if current_depth > 2:
                    queue.append({
                        "node": child_node,               # The child node to process
                        "current_depth": current_depth - 1,  # Decrease depth for the child
                        "ci_name": row["Dependency_Name"]  # CI_Name of the child
                    })

                # Append the child node to this dependency's children
                dependency_node["children"].append(child_node)

            # Append the dependency node to the current node's children
            current_node["children"].append(dependency_node)

    # Return the fully built hierarchy
    return active_node

# Fetch data and build hierarchy
data = fetch_graph_data()
depth = 3 # Set the depth of the hierarchy
hierarchy = build_hierarchy(data, depth)

# Print or save the hierarchy as JSON
if hierarchy:
    print(json.dumps(hierarchy, indent=2))
