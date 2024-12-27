import os
import pandas as pd
from collections import deque

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
    
    If active_node is a Type (e.g. 'Procurements'):
        - children = all (CI_Name, Dependency_Name) typed 'Procurements'
        - parents  = any that depend on 'Procurements'
    
    If active_node is a normal node (CI_Name or Dependency_Name):
        - parents = rows where `Dependency_Name == active_node`
        - children = rows where `CI_Name == active_node`
    
    BFS continues up to `depth`.

    :param data: Your DataFrame with columns:
        [CI_Type, CI_Name, CI_Descrip, Rel_Type, Dependency_Type, Dependency_Name, Dependency_Descrip]
    :param depth: int, how many "layers" of expansion
    :param active_node: str, the active_node_relationships node (could be type name, CI_Name, or dependency_name)
    :return: dict hierarchy
    """

    # 1) Identify all known type names
    all_types = set(
        data['CI_Type'].dropna().unique().tolist() +
        data['Dependency_Type'].dropna().unique().tolist()
    )

    # 2) Determine if active_node is Type, CI_Name, or Dependency_Name
    if active_node in data['CI_Name'].values:
        row = data[data['CI_Name'] == active_node].iloc[0]
        node_type = row['CI_Type'] if pd.notna(row['CI_Type']) else active_node
        node_desc = row['CI_Descrip'] if pd.notna(row['CI_Descrip']) else "No description available..."
        node_rel  = row['Rel_Type'] or None
        is_type_node = False

    elif active_node in data['Dependency_Name'].values:
        row = data[data['Dependency_Name'] == active_node].iloc[0]
        node_type = row['Dependency_Type'] if pd.notna(row['Dependency_Type']) else active_node
        node_desc = row['Dependency_Descrip'] if pd.notna(row['Dependency_Descrip']) else "No description available..."
        node_rel  = row['Rel_Type'] or None
        is_type_node = False

    elif active_node in all_types:
        node_type = active_node
        node_desc = f"{active_node} Group Node"
        node_rel  = None
        is_type_node = True

    else:
        return {"error": f"No data found for active node: {active_node}"}

    # 3) Build the top-level node
    active_node_relationships = {
        "name": active_node,
        "type": node_type,
        "relationship": node_rel,
        "directRelationship": True,
        "description": node_desc,
        "parent": None,  # active_node_relationships has no parent
        "children": []
    }

    if depth == 1:
        active_node_relationships["totalNodesDisplayed"] = 1
        return active_node_relationships

    visited = set([active_node])
    total_count = 1

    # BFS each item is (node_dict, node_name, current_depth, is_type_node).
    queue = deque([(active_node_relationships, active_node, depth, is_type_node)])

    while queue:
        current_dict, current_name, current_depth, current_is_type_node = queue.popleft()

        # If we're at the last layer, we do not enqueue further expansions
        expand_further = (current_depth > 2)

        # 4) Gather parents/children
        if current_is_type_node:
            # -----------------------------------------------------
            # If the current node is a "Type" like "Procurements":
            #    children = all CI_Name or Dependency_Name that are typed 'Procurements'
            #    parents  = all distinct CIs that "depend on" 'Procurements'
            # -----------------------------------------------------

            # 4A) Parents => rows where `Dependency_Type == current_name`
            parent_rows = data[data['Dependency_Type'] == current_name]

            # 4B) Children => union of:
            #    - all CI_Name where `CI_Type == current_name`
            #    - all Dependency_Name where `Dependency_Type == current_name`
            child_rows_ci = data[data['CI_Type'] == current_name]
            child_rows_dep = data[data['Dependency_Type'] == current_name]

            # ============ PARENTS ============
            if not parent_rows.empty:
                parents_by_type = parent_rows.groupby(parent_rows['CI_Type'].fillna("Unknown"))
                for p_type, p_group in parents_by_type:
                    parent_group = {
                        "groupType": p_type,
                        "relationship": p_group.iloc[0]['Rel_Type'] or None,
                        "children": []
                    }
                    for _, p_row in p_group.iterrows():
                        p_name = p_row['CI_Name']  # Typically the parent is the CI_Name
                        if pd.notna(p_name):
                            p_name = str(p_name)
                            if p_name not in visited:
                                visited.add(p_name)
                                p_desc = p_row['CI_Descrip'] if pd.notna(p_row['CI_Descrip']) else "No description available..."
                                p_rel = p_row['Rel_Type'] or None
                                p_node_type = p_row['CI_Type'] if pd.notna(p_row['CI_Type']) else "Unknown"
                                # Decide if that parent might also be a type node
                                is_parent_type_node = (p_name in all_types)

                                p_node = {
                                    "name": p_name,
                                    "parent": current_dict["name"],  # <--- ADD PARENT
                                    "type": p_node_type,
                                    "relationship": p_rel,
                                    "description": p_desc,
                                    "children": []
                                }
                                parent_group["children"].append(p_node)
                                total_count += 1

                                if expand_further:
                                    queue.append((p_node, p_name, current_depth - 1, is_parent_type_node))

                    if parent_group["children"]:
                        current_dict["children"].append(parent_group)

            # ============ CHILDREN ============
            combined_children_rows = pd.concat([child_rows_ci, child_rows_dep], ignore_index=True)

            if not combined_children_rows.empty:
                import itertools
                # Create a standardized child list that has (groupType, name, description, relationship)
                child_info = []
                for _, c_row in combined_children_rows.iterrows():
                    if pd.notna(c_row['CI_Type']) and c_row['CI_Type'] == current_name:
                        c_name = str(c_row['CI_Name'])
                        c_type = str(c_row['CI_Type'])
                        c_desc = str(c_row['CI_Descrip']) if pd.notna(c_row['CI_Descrip']) else "No description..."
                        c_rel = c_row['Rel_Type'] or None
                    elif pd.notna(c_row['Dependency_Type']) and c_row['Dependency_Type'] == current_name:
                        c_name = str(c_row['Dependency_Name'])
                        c_type = str(c_row['Dependency_Type'])
                        c_desc = str(c_row['Dependency_Descrip']) if pd.notna(c_row['Dependency_Descrip']) else "No description..."
                        c_rel = c_row['Rel_Type'] or None
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
                                    "parent": current_dict["name"],  # <--- ADD PARENT
                                    "type": group_type,
                                    "relationship": c_rel,
                                    "description": c_desc,
                                    "children": []
                                }
                                new_group["children"].append(c_node)
                                total_count += 1

                                if expand_further:
                                    queue.append((c_node, c_name, current_depth - 1, c_node_is_type))
                        
                        if new_group["children"]:
                            current_dict["children"].append(new_group)

        else:
            # -----------------------------------------------------
            # If current node is NOT a type node => normal BFS
            #   parents = rows where Dependency_Name == current_name
            #   children = rows where CI_Name == current_name
            # -----------------------------------------------------
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
                            p_desc = p_row['CI_Descrip'] if pd.notna(p_row['CI_Descrip']) else "No description available..."
                            p_rel  = p_row['Rel_Type'] or None
                            p_node_is_type = (p_name in all_types)

                            p_node = {
                                "name": p_name,
                                "parent": current_dict["name"],  # <--- ADD PARENT
                                "type": p_type,
                                "relationship": p_rel,
                                "description": p_desc,
                                "children": []
                            }
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
                            c_desc = c_row['Dependency_Descrip'] if pd.notna(c_row['Dependency_Descrip']) else "No description available..."
                            c_rel  = c_row['Rel_Type'] or None
                            c_node_is_type = (c_name in all_types)

                            c_node = {
                                "name": c_name,
                                "parent": current_dict["name"],  # <--- ADD PARENT
                                "type": c_type,
                                "relationship": c_rel,
                                "description": c_desc,
                                "children": []
                            }
                            child_group["children"].append(c_node)
                            total_count += 1

                            if expand_further:
                                queue.append((c_node, c_name, current_depth - 1, c_node_is_type))

                    if child_group["children"]:
                        current_dict["children"].append(child_group)

    # 5) Once BFS is done, attach total count
    active_node_relationships["totalNodesDisplayed"] = total_count
    return active_node_relationships
