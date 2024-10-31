import pandas as pd
import os

def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
    """
    Extracts graph data from the Excel file, ensuring dependencies like 'Procurement'
    connect directly to relevant nodes (e.g., 'McCoy, Eric') without creating redundant
    parent nodes.
    """

    # Check if Excel file exists
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"{excel_file} not found.")

    # Load and clean the data
    df = pd.read_excel(excel_file).fillna('None')
    df = df.apply(lambda col: col.str.strip() if col.dtype == 'object' else col)

    # Initialize structures to hold graph components
    nodes = []  # All nodes
    links = []  # All links between nodes
    node_ids = set()  # Track nodes to avoid duplication

    # Define parent nodes and map them to their types
    parent_nodes = ['Home', 'Peoples', 'Technologies', 'Servers', 'Staff Augmentation']
    parent_to_type = {
        'Home': 'OIT',
        'Peoples': 'People',
        'Technologies': 'Technology',
        'Servers': 'Server',
        'Staff Augmentation': 'Procurement'
    }

    # Track parent-child relationships
    ci_to_parents = {}

    # Iterate over the Excel rows to populate nodes and links
    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        ci_type = row['CI_Type']
        ci_description = row['CI_Descrip']
        dependency_name = row['Dependency_Name']
        dependency_type = row['Dependency_Type']
        dependency_description = row['Dependency_Descrip']

        # Add CI node if not already present
        if ci_name != 'None' and ci_name not in node_ids:
            nodes.append({
                'id': ci_name,
                'type': ci_type,
                'description': ci_description
            })
            node_ids.add(ci_name)

        # Add dependency node if not a parent node and not already present
        if dependency_name != 'None' and dependency_name not in parent_nodes and dependency_name not in node_ids:
            nodes.append({
                'id': dependency_name,
                'type': dependency_type,
                'description': dependency_description
            })
            node_ids.add(dependency_name)

        # Record parent-child relationships
        if dependency_name in parent_nodes:
            if ci_name not in ci_to_parents:
                ci_to_parents[ci_name] = set()
            ci_to_parents[ci_name].add(dependency_name)

        # Add link between CI and its dependency (if valid)
        if dependency_name != 'None' and dependency_name not in parent_nodes:
            links.append({
                'source': dependency_name,
                'target': ci_name
            })

    # Create links between CIs and their parents based on parent-child relationships
    for ci, parents in ci_to_parents.items():
        for parent in parents:
            node_type = parent_to_type[parent]
            # Connect all nodes of the same type to the CI
            for node in nodes:
                if node['type'] == node_type:
                    links.append({
                        'source': node['id'],
                        'target': ci
                    })

    # Return the final graph structure
    return {'nodes': nodes, 'links': links}
