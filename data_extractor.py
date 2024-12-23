import os
import pandas as pd
from collections import deque

def fetch_graph_data(excel_file='data/network_diagram.xlsx') -> tuple:
    """
    Fetches graph data from an Excel file.

    Parameters:
        excel_file (str): Path to the Excel file containing network data.

    Returns:
        tuple: A tuple containing the pandas DataFrame and the default active node name.
    """
    try:
        if not os.path.exists(excel_file):
            raise FileNotFoundError(f"{excel_file} not found.")
        
        data = pd.read_excel(excel_file)
        if data.empty:
            raise ValueError("Excel file is empty.")
        
        # Determine a default active node, e.g., the first CI_Name
        active_node = data.loc[0, 'CI_Name']
        return data, active_node
    except Exception as e:
        print(f"An error occurred while fetching graph data: {e}")
        return None, None

def build_hierarchy(data, depth, active_node, group_nodes=False):
    """
    Builds a symmetrical hierarchical JSON structure showing both upward and downward
    relationships around the active_node, including group nodes if group_nodes is True.

    Parameters:
        data (pd.DataFrame): DataFrame containing network data.
        depth (int): The depth of the hierarchy to explore.
        active_node (str): The name of the active node.
        group_nodes (bool): Whether to group child nodes under their types.

    Returns:
        dict: Hierarchical JSON structure representing the network graph.
    """
    # Identify all unique types from CI_Type and Dependency_Type
    all_types = set(data['CI_Type'].dropna().unique().tolist() + data['Dependency_Type'].dropna().unique().tolist())

    # Determine the nature of the active node
    is_group_node = False
    node_type = "Unknown"
    node_desc = "No description available..."
    node_rel = None

    if active_node in data['CI_Name'].values:
        # Active node is a CI (Configuration Item)
        node_data = data[data['CI_Name'] == active_node].iloc[0]
        node_type = node_data['CI_Type'] if pd.notna(node_data['CI_Type']) else active_node
        node_desc = node_data['CI_Descrip'] if pd.notna(node_data['CI_Descrip']) else node_desc
        node_rel = node_data['Rel_Type'] if pd.notna(node_data['Rel_Type']) else node_rel
    elif active_node in data['Dependency_Name'].values:
        # Active node is a Dependency
        node_data = data[data['Dependency_Name'] == active_node].iloc[0]
        node_type = node_data['Dependency_Type'] if pd.notna(node_data['Dependency_Type']) else active_node
        node_desc = node_data['Dependency_Descrip'] if pd.notna(node_data['Dependency_Descrip']) else node_desc
        node_rel = node_data['Rel_Type'] if pd.notna(node_data['Rel_Type']) else node_rel
    elif active_node in all_types:
        # Active node is a Group Node (Type)
        is_group_node = True
        node_type = active_node
        node_desc = f"{active_node} Group Node"
        node_rel = None
    else:
        return {"error": f"No data found for active node: {active_node}"}

    # Initialize the active node data
    active_node_data = {
        "name": active_node,
        "type": node_type,
        "relationship": node_rel,
        "directRelationship": True,
        "description": node_desc,
        "children": [],
        "parents": [],
        "isGroupNode": is_group_node
    }

    # If depth is 1, return the active node only
    if depth == 1:
        active_node_data["totalNodesDisplayed"] = 1
        return active_node_data

    # Initialize BFS queue
    # Each entry: (current_node_dict, node_name, current_depth, direction)
    # direction: 'child', 'parent', 'both' indicates which relationships to process
    queue = deque()
    visited = set([active_node])
    total_nodes_count = 1

    if is_group_node:
        # Active node is a Group Node
        # Fetch children: Nodes where Dependency_Type == active_node
        children_data = data[data['Dependency_Type'] == active_node]

        for _, record in children_data.iterrows():
            child_name = record['Dependency_Name'] if pd.notna(record['Dependency_Name']) else record['CI_Name']
            if pd.isna(child_name) or child_name in visited:
                continue

            child_type = record['Dependency_Type'] if pd.notna(record['Dependency_Type']) else record['CI_Type']
            child_type = child_type if pd.notna(child_type) else "Unknown"

            child_descrip = record['Dependency_Descrip'] if pd.notna(record['Dependency_Descrip']) else record['CI_Descrip']
            child_descrip = child_descrip if pd.notna(child_descrip) else "No description available..."

            child_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

            # Create child node
            child_node = {
                "name": child_name,
                "type": child_type,
                "relationship": child_rel,
                "description": child_descrip,
                "children": [],
                "parents": [],
                "isGroupNode": False
            }

            active_node_data["children"].append(child_node)
            visited.add(child_name)
            total_nodes_count += 1

            # Enqueue child node for further exploration if depth allows
            if depth > 2:
                queue.append((child_node, child_name, depth - 1, 'both'))

        # Fetch parents: Nodes where Dependency_Name == active_node
        parents_data = data[data['Dependency_Name'] == active_node]

        for _, record in parents_data.iterrows():
            parent_name = record['CI_Name']
            if pd.isna(parent_name) or parent_name in visited:
                continue

            parent_type = record['CI_Type'] if pd.notna(record['CI_Type']) else "Unknown"
            parent_descrip = record['CI_Descrip'] if pd.notna(record['CI_Descrip']) else record['Dependency_Descrip']
            parent_descrip = parent_descrip if pd.notna(parent_descrip) else "No description available..."

            parent_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

            # Create parent node
            parent_node = {
                "name": parent_name,
                "type": parent_type,
                "relationship": parent_rel,
                "description": parent_descrip,
                "children": [],
                "parents": [],
                "isGroupNode": False
            }

            active_node_data["parents"].append(parent_node)
            visited.add(parent_name)
            total_nodes_count += 1

            # Enqueue parent node for further exploration if depth allows
            if depth > 2:
                queue.append((parent_node, parent_name, depth - 1, 'both'))

    else:
        # Active node is a Regular Node
        if group_nodes:
            # Group children under their respective types
            # Fetch children where CI_Type == active_node or Dependency_Name == active_node
            ci_children = data[data['CI_Type'] == active_node]
            dependency_children = data[data['CI_Name'] == active_node]

            # Create a combined DataFrame
            combined_children = pd.concat([ci_children, dependency_children], ignore_index=True)

            # Group by Dependency_Type for consistent grouping
            grouped = combined_children.groupby('Dependency_Type')

            for group_type, records in grouped:
                group_type = group_type if pd.notna(group_type) else "Unknown"

                # Create group node
                group_node = {
                    "name": group_type,
                    "type": group_type,
                    "relationship": None,
                    "description": f"{group_type} Group Node",
                    "isGroupNode": True,
                    "children": [],
                    "parents": []
                }

                for _, record in records.iterrows():
                    # Correctly assign child names by prioritizing Dependency_Name
                    child_name = record['Dependency_Name'] if pd.notna(record['Dependency_Name']) else record['CI_Name']
                    if pd.isna(child_name):
                        continue  # Skip if no valid child name

                    child_type = record['Dependency_Type'] if pd.notna(record['Dependency_Type']) else record['CI_Type']
                    child_type = child_type if pd.notna(child_type) else "Unknown"

                    child_descrip = record['Dependency_Descrip'] if pd.notna(record['Dependency_Descrip']) else record['CI_Descrip']
                    child_descrip = child_descrip if pd.notna(child_descrip) else "No description available..."

                    child_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

                    # Create child node
                    child_node = {
                        "name": child_name,
                        "type": child_type,
                        "relationship": child_rel,
                        "description": child_descrip,
                        "children": [],
                        "parents": [],
                        "isGroupNode": False
                    }

                    group_node["children"].append(child_node)
                    visited.add(child_name)
                    total_nodes_count += 1

                if group_node["children"]:
                    active_node_data["children"].append(group_node)
                    total_nodes_count += 1

                    # Enqueue group node for further exploration if depth allows
                    if depth > 2:
                        queue.append((group_node, group_type, depth - 1, 'both'))
        else:
            # Directly add child nodes without grouping
            ci_children = data[data['CI_Type'] == active_node]
            dependency_children = data[data['CI_Name'] == active_node]

            combined_children = pd.concat([ci_children, dependency_children], ignore_index=True)

            for _, record in combined_children.iterrows():
                child_name = record['Dependency_Name'] if pd.notna(record['Dependency_Name']) else record['CI_Name']
                if pd.isna(child_name) or child_name in visited:
                    continue

                child_type = record['Dependency_Type'] if pd.notna(record['Dependency_Type']) else record['CI_Type']
                child_type = child_type if pd.notna(child_type) else "Unknown"

                child_descrip = record['Dependency_Descrip'] if pd.notna(record['Dependency_Descrip']) else record['CI_Descrip']
                child_descrip = child_descrip if pd.notna(child_descrip) else "No description available..."

                child_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

                # Create child node
                child_node = {
                    "name": child_name,
                    "type": child_type,
                    "relationship": child_rel,
                    "description": child_descrip,
                    "children": [],
                    "parents": [],
                    "isGroupNode": False
                }

                active_node_data["children"].append(child_node)
                visited.add(child_name)
                total_nodes_count += 1

                # Enqueue child node for further exploration if depth allows
                if depth > 2:
                    queue.append((child_node, child_name, depth - 1, 'both'))

        # Fetch parents: Nodes where Dependency_Name == active_node
        parents_data = data[data['Dependency_Name'] == active_node]

        for _, record in parents_data.iterrows():
            parent_name = record['CI_Name']
            if pd.isna(parent_name) or parent_name in visited:
                continue

            parent_type = record['CI_Type'] if pd.notna(record['CI_Type']) else "Unknown"
            parent_descrip = record['CI_Descrip'] if pd.notna(record['CI_Descrip']) else record['Dependency_Descrip']
            parent_descrip = parent_descrip if pd.notna(parent_descrip) else "No description available..."

            parent_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

            # Create parent node
            parent_node = {
                "name": parent_name,
                "type": parent_type,
                "relationship": parent_rel,
                "description": parent_descrip,
                "children": [],
                "parents": [],
                "isGroupNode": False
            }

            active_node_data["parents"].append(parent_node)
            visited.add(parent_name)
            total_nodes_count += 1

            # Enqueue parent node for further exploration if depth allows
            if depth > 2:
                queue.append((parent_node, parent_name, depth - 1, 'both'))

    # BFS to traverse the graph
    while queue:
        current_node, current_name, current_depth, direction = queue.popleft()

        if current_depth <= 1:
            continue

        if direction in ['child', 'both']:
            if current_node["isGroupNode"]:
                # For group nodes, process their children based on group type
                group_type = current_node["name"]

                # Fetch children where Dependency_Type == group_type
                group_children = data[data['Dependency_Type'] == group_type]

                for _, record in group_children.iterrows():
                    # Correctly assign child names by prioritizing Dependency_Name
                    child_name = record['Dependency_Name'] if pd.notna(record['Dependency_Name']) else record['CI_Name']
                    if pd.isna(child_name) or child_name in visited:
                        continue

                    child_type = record['Dependency_Type'] if pd.notna(record['Dependency_Type']) else record['CI_Type']
                    child_type = child_type if pd.notna(child_type) else "Unknown"

                    child_descrip = record['Dependency_Descrip'] if pd.notna(record['Dependency_Descrip']) else record['CI_Descrip']
                    child_descrip = child_descrip if pd.notna(child_descrip) else "No description available..."

                    child_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

                    # Create child node
                    child_node = {
                        "name": child_name,
                        "type": child_type,
                        "relationship": child_rel,
                        "description": child_descrip,
                        "children": [],
                        "parents": [],
                        "isGroupNode": False
                    }

                    current_node["children"].append(child_node)
                    visited.add(child_name)
                    total_nodes_count += 1

                    # Enqueue child node for further exploration if depth allows
                    if current_depth > 2:
                        queue.append((child_node, child_name, current_depth - 1, 'both'))
            else:
                # For regular nodes, process both CI_Type and Dependency_Name relationships
                ci_children = data[data['CI_Type'] == current_name]
                dependency_children = data[data['CI_Name'] == current_name]

                combined_children = pd.concat([ci_children, dependency_children], ignore_index=True)

                for _, record in combined_children.iterrows():
                    child_name = record['Dependency_Name'] if pd.notna(record['Dependency_Name']) else record['CI_Name']
                    if pd.isna(child_name) or child_name in visited:
                        continue

                    child_type = record['Dependency_Type'] if pd.notna(record['Dependency_Type']) else record['CI_Type']
                    child_type = child_type if pd.notna(child_type) else "Unknown"

                    child_descrip = record['Dependency_Descrip'] if pd.notna(record['Dependency_Descrip']) else record['CI_Descrip']
                    child_descrip = child_descrip if pd.notna(child_descrip) else "No description available..."

                    child_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

                    # Create child node
                    child_node = {
                        "name": child_name,
                        "type": child_type,
                        "relationship": child_rel,
                        "description": child_descrip,
                        "children": [],
                        "parents": [],
                        "isGroupNode": False
                    }

                    current_node["children"].append(child_node)
                    visited.add(child_name)
                    total_nodes_count += 1

                    # Enqueue child node for further exploration if depth allows
                    if current_depth > 2:
                        queue.append((child_node, child_name, current_depth - 1, 'both'))

        if direction in ['parent', 'both']:
            # Process parents via Dependency_Name == current_name
            parent_data = data[data['Dependency_Name'] == current_name]

            for _, record in parent_data.iterrows():
                parent_name = record['CI_Name']
                if pd.isna(parent_name) or parent_name in visited:
                    continue

                parent_type = record['CI_Type'] if pd.notna(record['CI_Type']) else "Unknown"
                parent_descrip = record['CI_Descrip'] if pd.notna(record['CI_Descrip']) else record['Dependency_Descrip']
                parent_descrip = parent_descrip if pd.notna(parent_descrip) else "No description available..."

                parent_rel = record['Rel_Type'] if pd.notna(record['Rel_Type']) else None

                # Create parent node
                parent_node = {
                    "name": parent_name,
                    "type": parent_type,
                    "relationship": parent_rel,
                    "description": parent_descrip,
                    "children": [],
                    "parents": [],
                    "isGroupNode": False
                }

                current_node["parents"].append(parent_node)
                visited.add(parent_name)
                total_nodes_count += 1

                # Enqueue parent node for further exploration if depth allows
                if current_depth > 2:
                    queue.append((parent_node, parent_name, current_depth - 1, 'both'))

    # Set total nodes displayed
    active_node_data["totalNodesDisplayed"] = total_nodes_count

    return active_node_data
