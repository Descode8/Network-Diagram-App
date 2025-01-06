import os
import pandas as pd
from collections import deque
import itertools

def fetch_graph_data(excel_file='data/network_diagram.xlsx') -> tuple:
    try:
        if not os.path.exists(excel_file):
            raise FileNotFoundError(f"{excel_file} not found.")
        
        data = pd.read_excel(excel_file)
        # For example, let's just pick the first row's CI_Name as active node
        active_node = data.loc[0, 'CI_Name']
        return data, active_node
    except Exception as e:
        print(f"An error occurred: {e}")
        return None, None

def build_hierarchy(data: pd.DataFrame, depth: int, active_node: str):
    """
    Builds a symmetrical hierarchical JSON structure around `active_node`.

    If active_node is a Type (e.g. "Procurements"):
        - If depth <= 2:
            * Only children typed the same as 'Procurements' are gathered
            * Skip all parents
        - If depth > 2:
            * Children typed the same
            * Also gather parents that depend on 'Procurements'
    If active_node is a normal node (e.g. "App 2"):
        - Parents = rows where `Dependency_Name == active_node`
        - Children = rows where `CI_Name == active_node`
    BFS continues up to `depth` layers.
    
    :param data: Your DataFrame with columns:
        [CI_Type, CI_Name, CI_Descrip, Rel_Type, 
        Dependency_Type, Dependency_Name, Dependency_Descrip]
    :param depth: int, how many "layers" of BFS expansion
    :param active_node: str, could be a type name, a CI_Name, or a dependency_name
    :return: dict hierarchy
    """

    # ---------------------- NEW PART ----------------------
    # Precompute the mapping of Dependency_Name to list of CI_Names that depend on it
    dependency_to_cis = data.groupby('Dependency_Name')['CI_Name'].apply(list).to_dict()
    # -----------------------------------------------------

    # Gather all known type names by combining CI_Type and Dependency_Type
    all_types = set(
        data['CI_Type'].dropna().unique().tolist() +
        data['Dependency_Type'].dropna().unique().tolist()
    )

    # Determine if active_node is Type, CI_Name, or Dependency_Name
    if active_node in data['CI_Name'].values:
        row = data[data['CI_Name'] == active_node].iloc[0]
        node_type = row['CI_Type'] if pd.notna(row['CI_Type']) else active_node
        node_desc = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else "No description available."
        node_rel  = row['Rel_Type'] or None
        is_type_node = False

    elif active_node in data['Dependency_Name'].values:
        row = data[data['Dependency_Name'] == active_node].iloc[0]
        node_type = row['Dependency_Type'] if pd.notna(row['Dependency_Type']) else active_node
        node_desc = row['Dependency_Descrip'] if pd.notna(row['Dependency_Descrip']) else "No description available."
        node_rel  = row['Rel_Type'] or None
        is_type_node = False

    elif active_node in all_types:
        # If active_node is literally a known Type (like "Procurements", "People", etc.)
        node_type = active_node
        node_desc = f"{active_node} Group Node"
        node_rel  = None
        is_type_node = True

    else:
        return {"error": f"No data found for active node: {active_node}"}

    # ------------------------- NEW PART -------------------------
    # Collect parents for the active node if it's not a type node
    if not is_type_node:
        parent_rows = data[data['Dependency_Name'] == active_node]
        parent_names = parent_rows['CI_Name'].unique().tolist()
    else:
        parent_names = []  # Type nodes might not have parents in this context
    # -------------------------------------------------------------

    # Initialize the top-level (root) of our hierarchy
    active_node_relationships = {
        "name": active_node,
        "type": node_type,
        "relationship": node_rel,
        "directRelationship": True,
        "description": node_desc,
        # ------------------------- MODIFIED PART -------------------------
        # Set 'parent' to the list of parent names or None
        "parent": parent_names if parent_names else None,
        # --------------------------------------------------------------
        "children": []
    }

    # ---------------------- NEW PART ----------------------
    # Add 'indirectRelationships' if applicable
    if active_node in dependency_to_cis and len(dependency_to_cis[active_node]) > 1:
        active_node_relationships["indirectRelationships"] = dependency_to_cis[active_node]
    # -----------------------------------------------------

    # If only depth=1, just display the node itself
    if depth == 1:
        active_node_relationships["totalNodesDisplayed"] = 1
        return active_node_relationships

    visited = set([active_node])
    total_count = 1

    # Each queue item => (current_dict, current_name, current_depth, current_is_type_node)
    queue = deque([(active_node_relationships, active_node, depth, is_type_node)])

    while queue:
        current_dict, current_name, current_depth, current_is_type_node = queue.popleft()

        # If we're at the last layer (e.g. current_depth=2), we do not enqueue further expansions
        # If current_depth=3, we can still enqueue children, etc.
        expand_further = (current_depth > 2)

        if current_is_type_node:
            # Gather children typed the same as current_name
            child_rows_ci = data[(data['CI_Type'] == current_name) & (data['CI_Name'] != current_name)]
            child_rows_dep = data[(data['Dependency_Type'] == current_name) & (data['Dependency_Name'] != current_name)]

            # --------------- GROUP NODE LOGIC ---------------
            # If the current node is a "Type", e.g. "Procurements".
            # 1. If depth <= 2 => skip parents; only gather children typed the same as current_name.
            # 2. If depth > 2  => gather both parents and children typed the same as current_name.

            if current_depth <= 2:
                # Skip parents. Only gather children where (CI_Type == current_name) or (Dependency_Type == current_name).
                child_rows_ci  = data[(data['CI_Type'] == current_name)]
                child_rows_dep = data[(data['Dependency_Type'] == current_name)]
                combined_children_rows = pd.concat([child_rows_ci, child_rows_dep], ignore_index=True)

                if not combined_children_rows.empty:
                    child_info = []

                    for _, c_row in combined_children_rows.iterrows():
                        if pd.notna(c_row['CI_Type']) and c_row['CI_Type'] == current_name:
                            c_name = str(c_row['CI_Name'])
                            c_type = str(c_row['CI_Type'])
                            c_desc = str(c_row['CI_Descrip']) if pd.notna(c_row['CI_Descrip']) else "No description available."
                            c_rel  = c_row['Rel_Type'] or None
                        elif pd.notna(c_row['Dependency_Type']) and c_row['Dependency_Type'] == current_name:
                            c_name = str(c_row['Dependency_Name'])
                            c_type = str(c_row['Dependency_Type'])
                            c_desc = str(c_row['Dependency_Descrip']) if pd.notna(c_row['Dependency_Descrip']) else "No description available."
                            c_rel  = c_row['Rel_Type'] or None
                        else:
                            continue

                        child_info.append({
                            "groupType": c_type, 
                            "name": c_name,
                            "description": c_desc,
                            "relationship": c_rel
                        })

                    if child_info:
                        # Group them by groupType
                        child_info.sort(key=lambda x: x["groupType"])
                        for group_type, items_in_group in itertools.groupby(child_info, key=lambda x: x["groupType"]):
                            group_type = group_type if group_type else "Unknown"
                            items_in_group = list(items_in_group)
                            relationship_val = items_in_group[0]["relationship"]  # or None

                            new_group = {
                                "groupType": group_type,
                                "relationship": relationship_val,
                                "children": []
                            }
                            for obj in items_in_group:
                                c_name = obj["name"]
                                if c_name not in visited:
                                    visited.add(c_name)
                                    c_desc = obj["description"]
                                    c_rel  = obj["relationship"]
                                    c_node_is_type = (c_name in all_types)

                                    c_node = {
                                        "name": c_name,
                                        "parent": current_dict["name"],
                                        "type": group_type,
                                        "relationship": c_rel,
                                        "description": c_desc,
                                        # ------------------------- MODIFIED PART -------------------------
                                        # Add 'indirectRelationships' if applicable
                                        "indirectRelationships": dependency_to_cis[c_name] if c_name in dependency_to_cis and len(dependency_to_cis[c_name]) > 1 else None,
                                        # --------------------------------------------------------------
                                        "children": []
                                    }

                                    # Remove 'indirectRelationships' key if it's None
                                    if c_node["indirectRelationships"] is None:
                                        del c_node["indirectRelationships"]

                                    new_group["children"].append(c_node)
                                    total_count += 1

                                    if expand_further:
                                        queue.append((c_node, c_name, current_depth - 1, c_node_is_type))
                            
                            if new_group["children"]:
                                current_dict["children"].append(new_group)

            else:
                # If current_depth > 2, do normal BFS logic: gather both parents and children typed as current_name

                # PARENTS => rows where Dependency_Type == current_name
                parent_rows = data[data['Dependency_Type'] == current_name]

                if not parent_rows.empty:
                    parents_by_type = parent_rows.groupby(parent_rows['CI_Type'].fillna("Unknown"))
                    for p_type, p_group in parents_by_type:
                        parent_group = {
                            "groupType": p_type,
                            "relationship": p_group.iloc[0]['Rel_Type'] or None,
                            "children": []
                        }
                        for _, p_row in p_group.iterrows():
                            p_name = p_row['CI_Name']
                            if pd.notna(p_name):
                                p_name = str(p_name)
                                if p_name not in visited:
                                    visited.add(p_name)
                                    p_desc = p_row['CI_Descrip'] if pd.notna(p_row['CI_Descrip']) else "No description available."
                                    p_rel  = p_row['Rel_Type'] or None
                                    p_node_type = p_row['CI_Type'] if pd.notna(p_row['CI_Type']) else "Unknown"
                                    is_parent_type_node = (p_name in all_types)

                                    p_node = {
                                        "name": p_name,
                                        "parent": current_dict["name"],
                                        "type": p_node_type,
                                        "relationship": p_rel,
                                        "description": p_desc,
                                        # ------------------------- MODIFIED PART -------------------------
                                        # Add 'indirectRelationships' if applicable
                                        "indirectRelationships": dependency_to_cis[p_name] if p_name in dependency_to_cis and len(dependency_to_cis[p_name]) > 1 else None,
                                        # --------------------------------------------------------------
                                        "children": []
                                    }

                                    # Remove 'indirectRelationships' key if it's None
                                    if p_node["indirectRelationships"] is None:
                                        del p_node["indirectRelationships"]

                                    parent_group["children"].append(p_node)
                                    total_count += 1

                                    if expand_further:
                                        queue.append((p_node, p_name, current_depth - 1, is_parent_type_node))
                        
                        if parent_group["children"]:
                            current_dict["children"].append(parent_group)

                # CHILDREN => where (CI_Type == current_name) or (Dependency_Type == current_name)
                child_rows_ci  = data[(data['CI_Type'] == current_name)]
                child_rows_dep = data[(data['Dependency_Type'] == current_name)]
                combined_children_rows = pd.concat([child_rows_ci, child_rows_dep], ignore_index=True)

                if not combined_children_rows.empty:
                    child_info = []
                    for _, c_row in combined_children_rows.iterrows():
                        if pd.notna(c_row['CI_Type']) and c_row['CI_Type'] == current_name:
                            c_name = str(c_row['CI_Name'])
                            c_type = str(c_row['CI_Type'])
                            c_desc = c_row['CI_Descrip'] if pd.notna(c_row['CI_Descrip']) else "No description available."
                            c_rel  = c_row['Rel_Type'] or None
                        elif pd.notna(c_row['Dependency_Type']) and c_row['Dependency_Type'] == current_name:
                            c_name = str(c_row['Dependency_Name'])
                            c_type = str(c_row['Dependency_Type'])
                            c_desc = c_row['Dependency_Descrip'] if pd.notna(c_row['Dependency_Descrip']) else "No description available."
                            c_rel  = c_row['Rel_Type'] or None
                        else:
                            continue

                        child_info.append({
                            "groupType": c_type, 
                            "name": c_name,
                            "description": c_desc,
                            "relationship": c_rel
                        })

                    if child_info:
                        child_info.sort(key=lambda x: x["groupType"])
                        for group_type, items_in_group in itertools.groupby(child_info, key=lambda x: x["groupType"]):
                            group_type = group_type if group_type else "Unknown"
                            items_in_group = list(items_in_group)
                            relationship_val = items_in_group[0]["relationship"]

                            new_group = {
                                "groupType": group_type,
                                "relationship": relationship_val,
                                "children": []
                            }
                            for obj in items_in_group:
                                c_name = obj["name"]
                                if c_name not in visited:
                                    visited.add(c_name)
                                    c_desc = obj["description"]
                                    c_rel  = obj["relationship"]
                                    c_node_is_type = (c_name in all_types)

                                    c_node = {
                                        "name": c_name,
                                        "parent": current_dict["name"],
                                        "type": group_type,
                                        "relationship": c_rel,
                                        "description": c_desc,
                                        # ------------------------- MODIFIED PART -------------------------
                                        # Add 'indirectRelationships' if applicable
                                        "indirectRelationships": dependency_to_cis[c_name] if c_name in dependency_to_cis and len(dependency_to_cis[c_name]) > 1 else None,
                                        # --------------------------------------------------------------
                                        "children": []
                                    }

                                    # Remove 'indirectRelationships' key if it's None
                                    if c_node["indirectRelationships"] is None:
                                        del c_node["indirectRelationships"]

                                    new_group["children"].append(c_node)
                                    total_count += 1

                                    if expand_further:
                                        queue.append((c_node, c_name, current_depth - 1, c_node_is_type))
                            
                            if new_group["children"]:
                                current_dict["children"].append(new_group)

        else:
            # --------------- NORMAL NODE LOGIC ---------------
            # If current node is NOT a group node => BFS as usual:
            #   Parents  = rows where `Dependency_Name == current_name`
            #   Children = rows where `CI_Name == current_name`

            parent_data = data[data['Dependency_Name'] == current_name]
            child_data  = data[data['CI_Name'] == current_name]

            # --- Parents ---
            if not parent_data.empty:
                parents_by_type = parent_data.groupby(parent_data['CI_Type'].fillna("Unknown"))
                for p_type, p_group in parents_by_type:
                    parent_group = {
                        "groupType": p_type,
                        "relationship": p_group.iloc[0]['Rel_Type'] or None,
                        "children": []
                    }
                    for _, p_row in p_group.iterrows():
                        p_name = str(p_row['CI_Name'])
                        if p_name not in visited:
                            visited.add(p_name)
                            p_desc = p_row['CI_Descrip'] if pd.notna(p_row['CI_Descrip']) else "No description available."
                            p_rel  = p_row['Rel_Type'] or None
                            p_node_is_type = (p_name in all_types)

                            p_node = {
                                "name": p_name,
                                "parent": current_dict["name"],
                                "type": p_type,
                                "relationship": p_rel,
                                "description": p_desc,
                                # ------------------------- MODIFIED PART -------------------------
                                # Add 'indirectRelationships' if applicable
                                "indirectRelationships": dependency_to_cis[p_name] if p_name in dependency_to_cis and len(dependency_to_cis[p_name]) > 1 else None,
                                # --------------------------------------------------------------
                                "children": []
                            }

                            # Remove 'indirectRelationships' key if it's None
                            if p_node["indirectRelationships"] is None:
                                del p_node["indirectRelationships"]

                            parent_group["children"].append(p_node)
                            total_count += 1

                            if expand_further:
                                queue.append((p_node, p_name, current_depth - 1, p_node_is_type))
                    
                    if parent_group["children"]:
                        current_dict["children"].append(parent_group)

            # --- Children ---
            if not child_data.empty:
                children_by_type = child_data.groupby(child_data['Dependency_Type'].fillna("Unknown"))
                for c_type, c_group in children_by_type:
                    child_group = {
                        "groupType": c_type,
                        "relationship": c_group.iloc[0]['Rel_Type'] or None,
                        "children": []
                    }
                    for _, c_row in c_group.iterrows():
                        c_name = str(c_row['Dependency_Name'])
                        if c_name not in visited:
                            visited.add(c_name)
                            c_desc = c_row['Dependency_Descrip'] if pd.notna(c_row['Dependency_Descrip']) else "No description available."
                            c_rel  = c_row['Rel_Type'] or None
                            c_node_is_type = (c_name in all_types)

                            c_node = {
                                "name": c_name,
                                "parent": current_dict["name"],
                                "type": c_type,
                                "relationship": c_rel,
                                "description": c_desc,
                                # ------------------------- MODIFIED PART -------------------------
                                # Add 'indirectRelationships' if applicable
                                "indirectRelationships": dependency_to_cis[c_name] if c_name in dependency_to_cis and len(dependency_to_cis[c_name]) > 1 else None,
                                # --------------------------------------------------------------
                                "children": []
                            }

                            # Remove 'indirectRelationships' key if it's None
                            if c_node["indirectRelationships"] is None:
                                del c_node["indirectRelationships"]

                            child_group["children"].append(c_node)
                            total_count += 1

                            if expand_further:
                                queue.append((c_node, c_name, current_depth - 1, c_node_is_type))
                    
                    if child_group["children"]:
                        current_dict["children"].append(child_group)

    # Once BFS completes, store how many nodes we displayed
    active_node_relationships["totalNodesDisplayed"] = total_count

    return active_node_relationships
