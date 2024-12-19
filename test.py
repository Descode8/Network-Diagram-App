import os
import pandas as pd
from collections import OrderedDict

# Function to fetch data from an Excel file
def fetch_graph_data(excel_file='data/network_diagram.xlsx') -> tuple:
    try:
        if not os.path.exists(excel_file):
            raise FileNotFoundError(f"{excel_file} not found.")
        
        data = pd.read_excel(excel_file)
        active_node = data.loc[0, 'CI_Name']

        return data, active_node
    except Exception as e:
        print(f"An error occurred: {e}")
        return None, None

def build_hierarchy(data, depth, active_node):
    """
    Builds a hierarchical JSON structure from tabular data.

    Parameters:
    - data (DataFrame): The input data containing CI information.
    - depth (int): The maximum depth of the hierarchy to build.
    - active_node (str): The name of the active node from which to start building the hierarchy.

    Returns:
    - dict: A hierarchical JSON-like dictionary structure representing the data.
    """
    
    is_ci_node = False
    is_dependency_node = False
    total_names_count = 0  # Initialize the counter for 'name'

    # Check if active_node exists in either CI_Name or Dependency_Name
    if active_node in data['CI_Name'].values:
        is_ci_node = True
        active_data = data[data['CI_Name'] == active_node]

    elif active_node in data['Dependency_Name'].values:
        is_dependency_node = True
        print(f"Active node '{active_node}' found in Dependency_Name.")
        active_data = data[data['Dependency_Name'] == active_node]
    else:
        # Handle the case where active_node doesn't exist in either column
        print(f"Error: Active node '{active_node}' not found in CI_Name or Dependency_Name.")
        return {"error": f"No data found for active node: {active_node}"}

    # Active node relationships
    if is_ci_node:
        active_node_relationships = {
            "name": active_node,
            "type": active_data.iloc[0]['CI_Type'],
            "relationship": active_data.iloc[0]['Rel_Type'] or None,
            "directRelationship": True,
            "description": active_data.iloc[0]['CI_Descrip'] or "No description available...",
            "children": []
        }
    elif is_dependency_node:
        active_node_relationships = {
            "name": active_node,
            "type": active_data.iloc[0]['Dependency_Type'],
            "relationship": active_data.iloc[0]['Rel_Type'] or None,
            "description": active_data.iloc[0]['Dependency_Descrip'] or "No description available...",
            "children": []
        }

    # Increment the counter for the active node's name
    total_names_count += 1

    # Use a queue to process nodes iteratively (breadth-first approach)
    queue = [
        {
            "node": active_node_relationships,
            "current_depth": depth,
            "ci_name": active_node
        }
    ]

    # Process the hierarchy layer by layer
    while queue:
        current = queue.pop(0)
        current_node = current["node"]
        current_depth = current["current_depth"]
        current_ci_name = current["ci_name"]

        if current_depth == 1:
            continue

        current_data = data[data['CI_Name'] == current_ci_name]
        dependency_types = current_data.groupby('Dependency_Type')

        for dependency_type, dependency_group in dependency_types:
            dependency_node = {
                "type": dependency_type,
                "relationship": dependency_group.iloc[0]['Rel_Type'],
                "children": []
            }

            for _, row in dependency_group.iterrows():
                child_data = data[data['CI_Name'] == row["Dependency_Name"]]
                child_has_children = not child_data.empty

                child_node = {
                    "name": row["Dependency_Name"],
                    "type": row["Dependency_Type"],
                    "relationship": row["Rel_Type"] if child_has_children else None,
                    "description": row["Dependency_Descrip"],
                    "children": []
                }

                # Increment the counter for each child node added
                total_names_count += 1

                if current_depth > 2:
                    queue.append({
                        "node": child_node,
                        "current_depth": current_depth - 1,
                        "ci_name": row["Dependency_Name"]
                    })

                dependency_node["children"].append(child_node)

            current_node["children"].append(dependency_node)

    # Update the totalNamesCount for the active node
    active_node_relationships["totalNodesDisplayed"] = total_names_count

    # Return the fully built hierarchy
    return active_node_relationships

# Fetch data and build hierarchy
# data, active_node = fetch_graph_data()
# active_node='PO 2'
# depth = 1 # Set the depth of the hierarchy
# hierarchy = build_hierarchy(data, depth, active_node)

# # Print or save the hierarchy as JSON
# if hierarchy:
#     print(json.dumps(hierarchy, indent=2))
