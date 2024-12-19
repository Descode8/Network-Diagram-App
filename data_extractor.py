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
    Handles CI, Dependency, and Type nodes.
    """

    is_ci_node = False
    is_dependency_node = False
    is_type_node = False
    total_names_count = 0  # Initialize the counter for 'name'

    # Check if active_node exists in either CI_Name or Dependency_Name
    if active_node in data['CI_Name'].values:
        is_ci_node = True
        active_data = data[data['CI_Name'] == active_node]

    elif active_node in data['Dependency_Name'].values:
        is_dependency_node = True
        print(f"Active node '{active_node}' found in Dependency_Name.")
        active_data = data[data['Dependency_Name'] == active_node]

    elif active_node in data['Dependency_Type'].values or active_node in data['CI_Type'].values:
        is_type_node = True

    else:
        # Handle the case where active_node doesn't exist in CI_Name, Dependency_Name, or as a type
        print(f"Error: Active node '{active_node}' not found in CI_Name, Dependency_Name, CI_Type, or Dependency_Type.")
        return {"error": f"No data found for active node: {active_node}"}

    # Handle the type node scenario
    if is_type_node:
        type_data = data[
            (data['CI_Type'] == active_node) | 
            (data['Dependency_Type'] == active_node)
        ]

        if type_data.empty:
            return {"error": f"No data found for type node: {active_node}"}

        # Build a node representing this type category and all of its children
        total_names_count = 1
        active_node_relationships = {
            "name": active_node,
            "type": active_node,  # The type node's type is just the node name
            "relationship": None,
            "directRelationship": True,
            "description": f"{active_node} Group Node",
            "children": []
        }

        # Each row in type_data can be considered a child node
        for _, row in type_data.iterrows():
            # Determine child properties
            child_name = row['CI_Name'] if pd.notna(row['CI_Name']) else row['Dependency_Name']
            child_type = row['CI_Type'] if pd.notna(row['CI_Type']) else row['Dependency_Type']
            child_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
            child_relationship = row['Rel_Type'] or None

            child_node = {
                "name": child_name,
                "type": child_type,
                "relationship": child_relationship,
                "description": child_descrip or "No description available...",
                "children": []
            }

            total_names_count += 1
            active_node_relationships["children"].append(child_node)

        active_node_relationships["totalNodesDisplayed"] = total_names_count
        return active_node_relationships

    # Active node relationships for CI node
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
        # Active node relationships for Dependency node
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
                "groupType": dependency_type,
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
