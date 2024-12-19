import os
import pandas as pd
from collections import deque

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
    Builds a symmetrical hierarchical JSON structure showing both upward and downward
    relationships around the active_node, including type nodes.
    For a type node:
        - depth=1 returns just the type node
        - depth>1 returns the type node, all nodes of that type as children,
        and for each of those children, their parents and children according to the reduced depth.
    """
    all_types = set(data['CI_Type'].dropna().unique().tolist() + data['Dependency_Type'].dropna().unique().tolist())

    # Determine if active_node is CI, Dependency, or Type node
    is_type_node = False
    if active_node in data['CI_Name'].values:
        node_data = data[data['CI_Name'] == active_node].iloc[0]
        node_type = node_data['CI_Type'] if pd.notna(node_data['CI_Type']) else active_node
        node_desc = node_data['CI_Descrip'] if pd.notna(node_data['CI_Descrip']) else "No description available..."
        node_rel = node_data['Rel_Type'] or None
    elif active_node in data['Dependency_Name'].values:
        node_data = data[data['Dependency_Name'] == active_node].iloc[0]
        node_type = node_data['Dependency_Type'] if pd.notna(node_data['Dependency_Type']) else active_node
        node_desc = node_data['Dependency_Descrip'] if pd.notna(node_data['Dependency_Descrip']) else "No description available..."
        node_rel = node_data['Rel_Type'] or None
    elif active_node in all_types:
        # It's a type node
        is_type_node = True
        node_type = active_node
        node_desc = f"{active_node} Group Node"
        node_rel = None
    else:
        return {"error": f"No data found for active node: {active_node}"}

    active_node_relationships = {
        "name": active_node,
        "type": node_type,
        "relationship": node_rel,
        "directRelationship": True,
        "description": node_desc,
        "children": []
    }

    # If depth = 1, just return the node
    if depth == 1:
        active_node_relationships["totalNodesDisplayed"] = 1
        return active_node_relationships

    visited = set([active_node])
    total_names_count = 1
    queue = deque()

    # If it's a type node, we first add all nodes of that type as children
    # Then we run BFS expansions from these children.
    if is_type_node:
        type_data = data[(data['CI_Type'] == active_node) | (data['Dependency_Type'] == active_node)]
        
        # If no members of that type are found, just return the type node
        if type_data.empty:
            active_node_relationships["totalNodesDisplayed"] = 1
            return active_node_relationships

        # Add all members as children of the type node
        for _, row in type_data.iterrows():
            child_name = row['CI_Name'] if pd.notna(row['CI_Name']) else row['Dependency_Name']
            # Determine child's properties
            child_type = row['CI_Type'] if pd.notna(row['CI_Type']) else row['Dependency_Type']
            child_descrip = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else row['Dependency_Descrip']
            child_rel = row['Rel_Type'] or None

            if child_name not in visited:
                visited.add(child_name)
                c_node = {
                    "name": child_name,
                    "type": child_type,
                    "relationship": child_rel,
                    "description": child_descrip or "No description available...",
                    "children": []
                }

                total_names_count += 1
                active_node_relationships["children"].append(c_node)

                # Add this child to the BFS queue with depth-1 (because we've used one "level" to get here)
                if depth > 2:  # Only enqueue if we have more depth to go
                    queue.append((c_node, child_name, depth - 1))

    else:
        # If not a type node, we start BFS directly from the active node
        queue.append((active_node_relationships, active_node, depth))

    # BFS to expand parents/children symmetrically
    while queue:
        current_node, current_name, current_depth = queue.popleft()
        if current_depth <= 1:
            continue

        # Parents: where current_name = Dependency_Name
        parent_data = data[data['Dependency_Name'] == current_name]
        # Children: where current_name = CI_Name
        child_data = data[data['CI_Name'] == current_name]

        # Handle parents
        if not parent_data.empty:
            parents_by_type = parent_data.groupby('CI_Type')
            for p_type, p_group in parents_by_type:
                parent_group = {
                    "groupType": p_type if pd.notna(p_type) else "Unknown",
                    "relationship": p_group.iloc[0]['Rel_Type'] or None,
                    "children": []
                }

                for _, row in p_group.iterrows():
                    p_name = row['CI_Name']
                    if p_name not in visited:
                        visited.add(p_name)
                        p_type_val = row['CI_Type'] if pd.notna(row['CI_Type']) else "Unknown"
                        p_desc = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else "No description available..."
                        p_rel = row['Rel_Type'] or None

                        p_node = {
                            "name": p_name,
                            "type": p_type_val,
                            "relationship": p_rel,
                            "description": p_desc,
                            "children": []
                        }

                        total_names_count += 1
                        parent_group["children"].append(p_node)

                        if current_depth > 2:
                            queue.append((p_node, p_name, current_depth - 1))

                if parent_group["children"]:
                    current_node["children"].append(parent_group)

        # Handle children
        if not child_data.empty:
            children_by_type = child_data.groupby('Dependency_Type')
            for c_type, c_group in children_by_type:
                child_group = {
                    "groupType": c_type if pd.notna(c_type) else "Unknown",
                    "relationship": c_group.iloc[0]['Rel_Type'] or None,
                    "children": []
                }

                for _, row in c_group.iterrows():
                    c_name = row['Dependency_Name']
                    if c_name not in visited:
                        visited.add(c_name)
                        c_type_val = row['Dependency_Type'] if pd.notna(row['Dependency_Type']) else "Unknown"
                        c_desc = row['Dependency_Descrip'] if pd.notna(row['Dependency_Descrip']) else "No description available..."
                        c_rel = row['Rel_Type'] or None

                        c_node = {
                            "name": c_name,
                            "type": c_type_val,
                            "relationship": c_rel,
                            "description": c_desc,
                            "children": []
                        }

                        total_names_count += 1
                        child_group["children"].append(c_node)

                        if current_depth > 2:
                            queue.append((c_node, c_name, current_depth - 1))

                if child_group["children"]:
                    current_node["children"].append(child_group)

    active_node_relationships["totalNodesDisplayed"] = total_names_count
    return active_node_relationships
