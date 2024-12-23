import os
import pandas as pd
from collections import deque

def fetch_graph_data(excel_file='data/network_diagram.xlsx') -> tuple:
    try:
        if not os.path.exists(excel_file):
            raise FileNotFoundError(f"{excel_file} not found.")
        
        data = pd.read_excel(excel_file)
        # Assuming the active node is provided elsewhere; replace with actual logic if needed
        active_node = data.loc[0, 'CI_Name']
        return data, active_node
    except Exception as e:
        print(f"An error occurred: {e}")
        return None, None

def build_hierarchy(data, depth, active_node):
    """
    Builds a symmetrical hierarchical JSON structure showing both upward and downward
    relationships around the active_node, including group nodes.
    """
    # Identify all unique types
    all_types = set(data['CI_Type'].dropna().unique().tolist() + data['Dependency_Type'].dropna().unique().tolist())
    print("All Types:", all_types)

    # Determine if active_node is a CI, Dependency, or Type node
    is_type_node = False
    is_group_node = False
    if active_node in data['CI_Name'].values:
        node_data = data[data['CI_Name'] == active_node].iloc[0]
        node_type = node_data['CI_Type'] if pd.notna(node_data['CI_Type']) else active_node
        node_desc = node_data['CI_Descrip'] if pd.notna(node_data['CI_Descrip']) else "No description available..."
        node_rel = node_data['Rel_Type'] or None
        is_group_node = False
    elif active_node in data['Dependency_Name'].values:
        node_data = data[data['Dependency_Name'] == active_node].iloc[0]
        node_type = node_data['Dependency_Type'] if pd.notna(node_data['Dependency_Type']) else active_node
        node_desc = node_data['Dependency_Descrip'] if pd.notna(node_data['Dependency_Descrip']) else "No description available..."
        node_rel = node_data['Rel_Type'] or None
        is_group_node = False
    elif active_node in all_types:
        # It's a type node
        is_type_node = True
        node_type = active_node
        node_desc = f"{active_node} Group Node"
        node_rel = None
        is_group_node = True
    else:
        return {"error": f"No data found for active node: {active_node}"}

    # Initialize the root node with separate 'children' and 'parents'
    root = {
        "name": active_node,
        "type": node_type,
        "relationship": node_rel,
        "directRelationship": True,
        "description": node_desc,
        "children": [],  # Downward relationships
        "parents": [],   # Upward relationships
        "isGroupNode": is_group_node
    }

    # If depth = 1, just return the node
    if depth == 1:
        root["totalNodesDisplayed"] = 1
        return root

    # Initialize BFS queue
    # Each entry: (current_node_dict, node_name, current_depth, direction)
    # direction: 'both' indicates to process both parents and children
    queue = deque()
    visited = set([active_node])
    total_names_count = 1

    if is_type_node:
        # Process downward relationships (children) where CI_Type == active_node
        ci_type_data = data[data['CI_Type'] == active_node]
        for _, row in ci_type_data.iterrows():
            child_name = row['CI_Name']
            if pd.notna(child_name) and child_name not in visited:
                visited.add(child_name)
                child_type = row['CI_Type'] if pd.notna(row['CI_Type']) else "Unknown"
                child_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
                child_rel = row['Rel_Type'] or None

                c_node = {
                    "name": child_name,
                    "type": child_type,
                    "relationship": child_rel,
                    "description": child_descrip or "No description available...",
                    "children": [],
                    "parents": [],
                    "isGroupNode": False  # Regular node
                }

                root["children"].append(c_node)
                print(f"Added child (CI_Type match): {child_name}")
                total_names_count += 1

                # Enqueue for further exploration if depth allows
                if depth > 2:
                    queue.append((c_node, child_name, depth - 1, 'both'))

        # Process downward relationships where Dependency_Type == active_node
        dependency_type_data = data[data['Dependency_Type'] == active_node]
        for _, row in dependency_type_data.iterrows():
            dependency_name = row['Dependency_Name']
            if pd.notna(dependency_name) and dependency_name not in visited:
                visited.add(dependency_name)
                dependency_type = row['Dependency_Type'] if pd.notna(row['Dependency_Type']) else "Unknown"
                dependency_descrip = row['Dependency_Descrip'] if pd.notna(row['Dependency_Descrip']) else row['CI_Descrip']
                dependency_rel = row['Rel_Type'] or None

                dep_node = {
                    "name": dependency_name,
                    "type": dependency_type,
                    "relationship": dependency_rel,
                    "description": dependency_descrip or "No description available...",
                    "children": [],
                    "parents": [],
                    "isGroupNode": False  # Regular node
                }

                root["children"].append(dep_node)
                print(f"Added child (Dependency_Type match): {dependency_name}")
                total_names_count += 1

                # Enqueue for further exploration if depth allows
                if depth > 2:
                    queue.append((dep_node, dependency_name, depth - 1, 'both'))

        # Process upward relationships where Dependency_Type == active_node
        # This seems incorrect; for type nodes, it's appropriate
        for _, row in dependency_type_data.iterrows():
            parent_name = row['CI_Name']
            if pd.notna(parent_name) and parent_name not in visited:
                visited.add(parent_name)
                parent_type = row['CI_Type'] if pd.notna(row['CI_Type']) else "Unknown"
                parent_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
                parent_rel = row['Rel_Type'] or None

                p_node = {
                    "name": parent_name,
                    "type": parent_type,
                    "relationship": parent_rel,
                    "description": parent_descrip or "No description available...",
                    "children": [],
                    "parents": [],
                    "isGroupNode": False  # Regular node
                }

                root["parents"].append(p_node)
                print(f"Added parent: {parent_name}")
                total_names_count += 1

                # Enqueue for further exploration if depth allows
                if depth > 2:
                    queue.append((p_node, parent_name, depth - 1, 'both'))
    else:
        # Not a type node, process as a regular node

        # **1. Process Downward Relationships via CI_Type == active_node**
        ci_type_data = data[data['CI_Type'] == active_node]
        for _, row in ci_type_data.iterrows():
            child_name = row['CI_Name']
            if pd.notna(child_name) and child_name not in visited:
                visited.add(child_name)
                child_type = row['CI_Type'] if pd.notna(row['CI_Type']) else "Unknown"
                child_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
                child_rel = row['Rel_Type'] or None

                c_node = {
                    "name": child_name,
                    "type": child_type,
                    "relationship": child_rel,
                    "description": child_descrip or "No description available...",
                    "children": [],
                    "parents": [],
                    "isGroupNode": False  # Regular node
                }

                root["children"].append(c_node)
                print(f"Added child (CI_Type match): {child_name}")
                total_names_count += 1

                # Enqueue for further exploration if depth allows
                if depth > 2:
                    queue.append((c_node, child_name, depth - 1, 'both'))

        # **2. Process Downward Relationships via Dependencies (CI_Name == active_node)**
        dependencies_data = data[data['CI_Name'] == active_node]
        for _, row in dependencies_data.iterrows():
            dependency_type = row['Dependency_Type']
            dependency_name = row['Dependency_Name']
            dependency_descrip = row['Dependency_Descrip'] if pd.notna(row['Dependency_Descrip']) else row['CI_Descrip']
            dependency_rel = row['Rel_Type'] or None

            if pd.notna(dependency_name) and dependency_name not in visited:
                visited.add(dependency_name)
                c_node = {
                    "name": dependency_name,
                    "type": dependency_type if pd.notna(dependency_type) else "Unknown",
                    "relationship": dependency_rel,
                    "description": dependency_descrip or "No description available...",
                    "children": [],
                    "parents": [],
                    "isGroupNode": False
                }

                root["children"].append(c_node)
                print(f"Added child (Dependency of {active_node}): {dependency_name}")
                total_names_count += 1

                # Enqueue for further exploration if depth allows
                if depth > 2:
                    queue.append((c_node, dependency_name, depth - 1, 'both'))

        # **3. Process Upward Relationships (Parents) via Dependency_Name == active_node**
        dependency_name_data = data[data['Dependency_Name'] == active_node]
        for _, row in dependency_name_data.iterrows():
            parent_name = row['CI_Name']
            if pd.notna(parent_name) and parent_name not in visited:
                visited.add(parent_name)
                parent_type = row['CI_Type'] if pd.notna(row['CI_Type']) else "Unknown"
                parent_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
                parent_rel = row['Rel_Type'] or None

                p_node = {
                    "name": parent_name,
                    "type": parent_type,
                    "relationship": parent_rel,
                    "description": parent_descrip or "No description available...",
                    "children": [],
                    "parents": [],
                    "isGroupNode": False  # Regular node
                }

                root["parents"].append(p_node)
                print(f"Added parent: {parent_name}")
                total_names_count += 1

                # Enqueue for further exploration if depth allows
                if depth > 2:
                    queue.append((p_node, parent_name, depth - 1, 'both'))

    # BFS to expand both parents and children
    while queue:
        current_node, current_name, current_depth, direction = queue.popleft()
        if current_depth <= 1:
            continue

        if direction in ['child', 'both']:
            # **1. Process Children via CI_Type == current_name**
            child_data = data[data['CI_Type'] == current_name]
            for _, row in child_data.iterrows():
                child_name = row['CI_Name']
                if pd.notna(child_name) and child_name not in visited:
                    visited.add(child_name)
                    child_type = row['CI_Type'] if pd.notna(row['CI_Type']) else "Unknown"
                    child_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
                    child_rel = row['Rel_Type'] or None

                    c_node = {
                        "name": child_name,
                        "type": child_type,
                        "relationship": child_rel,
                        "description": child_descrip or "No description available...",
                        "children": [],
                        "parents": [],
                        "isGroupNode": False  # Regular node
                    }

                    current_node["children"].append(c_node)
                    print(f"Added child (BFS CI_Type match): {child_name}")
                    total_names_count += 1

                    # Enqueue for further exploration if depth allows
                    if current_depth > 2:
                        queue.append((c_node, child_name, current_depth - 1, 'both'))

            # **2. Process Children via Dependencies (CI_Name == current_name)**
            dependencies_data = data[data['CI_Name'] == current_name]
            for _, row in dependencies_data.iterrows():
                dependency_type = row['Dependency_Type']
                dependency_name = row['Dependency_Name']
                dependency_descrip = row['Dependency_Descrip'] if pd.notna(row['Dependency_Descrip']) else row['CI_Descrip']
                dependency_rel = row['Rel_Type'] or None

                if pd.notna(dependency_name) and dependency_name not in visited:
                    visited.add(dependency_name)
                    dep_node = {
                        "name": dependency_name,
                        "type": dependency_type if pd.notna(dependency_type) else "Unknown",
                        "relationship": dependency_rel,
                        "description": dependency_descrip or "No description available...",
                        "children": [],
                        "parents": [],
                        "isGroupNode": False
                    }

                    current_node["children"].append(dep_node)
                    print(f"Added child (BFS Dependency match): {dependency_name}")
                    total_names_count += 1

                    # Enqueue for further exploration if depth allows
                    if current_depth > 2:
                        queue.append((dep_node, dependency_name, current_depth - 1, 'both'))

        if direction in ['parent', 'both']:
            # **Process Parents via Dependency_Name == current_name**
            parent_data = data[data['Dependency_Name'] == current_name]
            for _, row in parent_data.iterrows():
                parent_name = row['CI_Name']
                if pd.notna(parent_name) and parent_name not in visited:
                    visited.add(parent_name)
                    parent_type = row['CI_Type'] if pd.notna(row['CI_Type']) else "Unknown"
                    parent_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
                    parent_rel = row['Rel_Type'] or None

                    p_node = {
                        "name": parent_name,
                        "type": parent_type,
                        "relationship": parent_rel,
                        "description": parent_descrip or "No description available...",
                        "children": [],
                        "parents": [],
                        "isGroupNode": False  # Regular node
                    }

                    current_node["parents"].append(p_node)
                    print(f"Added parent (BFS): {parent_name}")
                    total_names_count += 1

                    # Enqueue for further exploration if depth allows
                    if current_depth > 2:
                        queue.append((p_node, parent_name, current_depth - 1, 'both'))

    # Set total nodes displayed
    root["totalNodesDisplayed"] = total_names_count

    return root
