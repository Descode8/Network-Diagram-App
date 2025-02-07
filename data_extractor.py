import os
import pandas as pd
from collections import deque
import itertools
from collections import defaultdict

def fetch_graph_data(excel_file='data/network_diagram.xlsx') -> tuple:
    try:
        if not os.path.exists(excel_file):
            raise FileNotFoundError(f"{excel_file} not found.")
        
        data = pd.read_excel(excel_file)
        # Normalize 'CI_Name' and 'Dependency_Name' by stripping spaces
        data['CI_Name'] = data['CI_Name'].astype(str).str.strip()
        data['Dependency_Name'] = data['Dependency_Name'].astype(str).str.strip()
        active_node = data.loc[0, 'CI_Name']
        return data, active_node
    except Exception as e:
        print(f"An error occurred: {e}")
        return None, None


def build_hierarchy(data: pd.DataFrame, depth: int, active_node: str):
    """
    Build the hierarchy (as a nested dict) for the given active_node, up to 'depth' levels.
    This version also attaches { "name": ..., "type": ... } objects for indirectRelationships,
    ensuring that indirectly related nodes can be colored properly.
    """

    # ---------------------------------------
    # 1) Preprocessing & normalizing
    # ---------------------------------------
    data['CI_Name'] = data['CI_Name'].astype(str).str.strip()
    data['Dependency_Name'] = data['Dependency_Name'].astype(str).str.strip()
    
    # Precompute the mapping of Dependency_Name -> [list of CI_Names that depend on it]
    dependency_to_cis = data.groupby('Dependency_Name')['CI_Name'].apply(list).to_dict()
    
    # Gather all known type names by combining CI_Type and Dependency_Type
    all_types = set(
        data['CI_Type'].dropna().unique().tolist() +
        data['Dependency_Type'].dropna().unique().tolist()
    )

    # ---------------------------------------
    # 2) Helper: get node type from name
    # ---------------------------------------
    def get_node_type(node_name: str) -> str:
        """
        Given node_name, return the best guess for its 'type' from the DataFrame, else 'Unknown'.
        """
        # 1) Check if it’s in CI_Name
        row_ci = data[data['CI_Name'] == node_name]
        if not row_ci.empty:
            if pd.notna(row_ci.iloc[0]['CI_Type']):
                return str(row_ci.iloc[0]['CI_Type'])
        
        # 2) Check if it’s in Dependency_Name
        row_dep = data[data['Dependency_Name'] == node_name]
        if not row_dep.empty:
            if pd.notna(row_dep.iloc[0]['Dependency_Type']):
                return str(row_dep.iloc[0]['Dependency_Type'])
        
        # 3) If node_name is literally a known “type” in the dataset
        if node_name in all_types:
            return node_name
        
        return "Unknown"

    # ---------------------------------------
    # 3) Helper: build list of { name, type } for indirectRelationships
    # ---------------------------------------
    def gather_indirect_relationships(node_name: str) -> list | None:
        """
        For a given node_name, if it has multiple parents in dependency_to_cis,
        return a list of { 'name': X, 'type': Y } for each, or None if none found.
        """
        if node_name not in dependency_to_cis:
            return None
        
        related_list = dependency_to_cis[node_name]
        # If fewer than 2 references, we’re not marking it as “indirectRelationships”
        if len(related_list) <= 1:
            return None

        # Build the array of { 'name', 'type' } for each indirectly related node
        results = []
        for related_name in related_list:
            # Avoid listing ourselves
            if related_name == node_name:
                continue
            i_type = get_node_type(related_name)
            results.append({"name": related_name, "type": i_type})

        return results if results else None

    # ---------------------------------------
    # 4) Identify if active_node is a type node or normal node
    # ---------------------------------------
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
        node_desc = f"{active_node}"
        node_rel  = None
        is_type_node = True

    else:
        return {"error": f"No data found for active node: {active_node}"}

    # ---------------------------------------
    # 5) Top-level node
    # ---------------------------------------
    if not is_type_node:
        # If it’s not a type node, find who depends on it
        parent_rows = data[data['Dependency_Name'] == active_node]
        parent_names = parent_rows['CI_Name'].unique().tolist()
    else:
        parent_names = []

    active_node_relationships = {
        "name": active_node,
        "type": node_type,
        "relationship": node_rel,
        "directRelationship": True,
        "description": node_desc,
        "parent": parent_names if parent_names else None,
        "children": []
    }

    # Attach indirectRelationships (now as array of { name, type })
    indirects = gather_indirect_relationships(active_node)
    if indirects is not None:
        active_node_relationships["indirectRelationships"] = indirects

    # If user asked for depth=1, return just the single node
    if depth == 1:
        active_node_relationships["totalNodesDisplayed"] = 1
        return active_node_relationships

    visited = set([active_node])
    total_count = 1

    # Each queue item => (dict_for_node, node_name, current_depth, is_type_node_bool)
    queue = deque([(active_node_relationships, active_node, depth, is_type_node)])

    # ---------------------------------------
    # 6) BFS through the relationships
    # ---------------------------------------
    while queue:
        current_dict, current_name, current_depth, current_is_type_node = queue.popleft()
        expand_further = (current_depth > 2)

        if current_is_type_node:
            # 6a) Handling “group” (type) nodes
            #     This logic is your existing approach, just updated for gather_indirect_relationships
            child_rows_ci = data[(data['CI_Type'] == current_name) & (data['CI_Name'] != current_name)]
            child_rows_dep = data[(data['Dependency_Type'] == current_name) & (data['Dependency_Name'] != current_name)]

            # If depth <= 2 => skip parents, gather children only
            if current_depth >= 1:
                child_rows_ci  = data[(data['CI_Type'] == current_name)]
                child_rows_dep = data[(data['Dependency_Type'] == current_name)]
                combined_children_rows = pd.concat([child_rows_ci, child_rows_dep], ignore_index=True)

                if not combined_children_rows.empty:
                    child_info = []
                    for _, c_row in combined_children_rows.iterrows():
                        # figure out which side the type is on
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

                                    # Build the child node
                                    c_node = {
                                        "name": c_name,
                                        "parent": current_dict["name"],
                                        "type": group_type,
                                        "relationship": c_rel,
                                        "description": c_desc,
                                        "children": []
                                    }
                                    # Attach indirect info
                                    c_indirects = gather_indirect_relationships(c_name)
                                    if c_indirects is not None:
                                        c_node["indirectRelationships"] = c_indirects

                                    new_group["children"].append(c_node)
                                    total_count += 1
                                    if expand_further:
                                        queue.append((c_node, c_name, current_depth - 1, c_node_is_type))
                            
                            if new_group["children"]:
                                current_dict["children"].append(new_group)

            else:
                # If current_depth > 2 => gather both parents & children
                # (existing logic)
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
                                        "children": []
                                    }
                                    # Attach indirect info
                                    p_indirects = gather_indirect_relationships(p_name)
                                    if p_indirects is not None:
                                        p_node["indirectRelationships"] = p_indirects

                                    parent_group["children"].append(p_node)
                                    total_count += 1

                                    if expand_further:
                                        queue.append((p_node, p_name, current_depth - 1, is_parent_type_node))
                        
                        if parent_group["children"]:
                            current_dict["children"].append(parent_group)

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
                                        "children": []
                                    }
                                    # Attach indirect info
                                    c_indirects = gather_indirect_relationships(c_name)
                                    if c_indirects is not None:
                                        c_node["indirectRelationships"] = c_indirects

                                    new_group["children"].append(c_node)
                                    total_count += 1

                                    if expand_further:
                                        queue.append((c_node, c_name, current_depth - 1, c_node_is_type))
                            
                            if new_group["children"]:
                                current_dict["children"].append(new_group)

        else:
            # 6b) Normal node BFS (non-type)
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
                                "children": []
                            }
                            # Attach indirect info
                            p_indirects = gather_indirect_relationships(p_name)
                            if p_indirects is not None:
                                p_node["indirectRelationships"] = p_indirects

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
                                "children": []
                            }
                            # Attach indirect info
                            c_indirects = gather_indirect_relationships(c_name)
                            if c_indirects is not None:
                                c_node["indirectRelationships"] = c_indirects

                            child_group["children"].append(c_node)
                            total_count += 1

                            if expand_further:
                                queue.append((c_node, c_name, current_depth - 1, c_node_is_type))
                    
                    if child_group["children"]:
                        current_dict["children"].append(child_group)

    active_node_relationships["totalNodesDisplayed"] = total_count
    return active_node_relationships

def get_all_assets(excel_file='data/network_diagram.xlsx'):
    """
    Retrieves all unique assets from both 'CI_Name' and 'Dependency_Name' columns.
    Think of this like merging two baskets (one for CI_Names and one for Dependency_Names)
    and removing duplicates to get a complete list of unique assets.
    """
    data, _ = fetch_graph_data(excel_file)
    if data is None:
        return []

    # Normalize the asset names (this ensures that any leading/trailing spaces are removed)
    data['CI_Name'] = data['CI_Name'].astype(str).str.strip()
    data['Dependency_Name'] = data['Dependency_Name'].astype(str).str.strip()
    
    # Extract assets from each column and use a set to remove duplicates
    ci_assets = set(data['CI_Name'].tolist())
    dependency_assets = set(data['Dependency_Name'].tolist())
    
    # Combine the two sets (like merging two lists and removing duplicate items)
    all_assets_set = ci_assets.union(dependency_assets)
    
    # Convert back to a list (or keep as a set if order is not important)
    return list(all_assets_set)

# print(get_all_assets())

def get_grouped_assets(excel_file='data/network_diagram.xlsx'):
    """
    Return a dict grouping asset names by their type. E.g.:
    {
        "Applications": ["IT Service Management System", "Help Desk ..."],
        "Data": [...],
        ...
    }
    """
    data, _ = fetch_graph_data(excel_file)
    if data is None:
        return {}

    # Ensure columns are strings, strip whitespace
    data['CI_Name'] = data['CI_Name'].astype(str).str.strip()
    data['Dependency_Name'] = data['Dependency_Name'].astype(str).str.strip()

    # Build a unified list of { name, type } for both CI and Dependency
    all_entries = []
    for _, row in data.iterrows():
        ci_name = row['CI_Name']
        ci_type = row['CI_Type'] if pd.notna(row['CI_Type']) else 'Unknown'
        all_entries.append({'name': ci_name, 'type': ci_type})

        dep_name = row['Dependency_Name']
        dep_type = row['Dependency_Type'] if pd.notna(row['Dependency_Type']) else 'Unknown'
        all_entries.append({'name': dep_name, 'type': dep_type})

    # Deduplicate by picking a single type for each asset name
    # (If the same name appears under multiple types, we use whichever is not "Unknown")
    asset_to_type = {}
    for item in all_entries:
        name = item['name']
        typ  = item['type']
        if name not in asset_to_type:
            asset_to_type[name] = typ
        else:
            # If the stored type is 'Unknown' but new type is better, replace
            if asset_to_type[name] == 'Unknown' and typ != 'Unknown':
                asset_to_type[name] = typ

    # Group assets by their final type
    grouped = defaultdict(list)
    for name, typ in asset_to_type.items():
        grouped[typ].append(name)

    # Sort the asset names in each group
    for typ in grouped:
        grouped[typ].sort()

    return dict(grouped)
