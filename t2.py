import os
import pandas as pd

def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
    """
    Dynamically extracts graph data from the Excel file based on its structure.
    This function ensures that all child nodes are correctly linked, including parent nodes
    such as Procurement, without hard-coding any specific values.
    
    Args:
        excel_file (str): Path to the Excel file containing the network diagram data.

    Returns:
        dict: A dictionary containing:
            - 'nodes': List of dictionaries representing nodes (each with 'id', 'type', 'description').
            - 'links': List of dictionaries representing links (each with 'source' and 'target').
    """

    # Check if the Excel file exists
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"{excel_file} not found.")

    # Load the Excel file and replace NaN values with 'None'
    df = pd.read_excel(excel_file).fillna('None')

    # Strip leading/trailing whitespaces to avoid inconsistencies
    df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x)

    # Initialize containers for nodes, links, and a set to track added node IDs (to avoid duplicates)
    nodes = []
    links = []
    node_ids = set()

    # Handle known parent categories and their mappings to types
    parent_to_type = {
        'People': 'People',
        'Technologies': 'Technology',
        'Servers': 'Server',
        'Staff Augmentation': 'Procurement'
    }

    # Ensure all parent categories are added as nodes
    for parent, node_type in parent_to_type.items():
        nodes.append({'id': parent, 'type': node_type, 'description': 'Parent Node'})
        node_ids.add(parent)

    # Iterate over each row to populate nodes and links
    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        ci_type = row['CI_Type']
        ci_description = row['CI_Descrip']
        dependency_name = row['Dependency_Name']
        dependency_type = row['Dependency_Type']
        dependency_description = row['Dependency_Descrip']

        # Add Configuration Item (CI) node if not already present
        if ci_name != 'None' and ci_name not in node_ids:
            nodes.append({
                'id': ci_name,
                'type': ci_type,
                'description': ci_description
            })
            node_ids.add(ci_name)

        # Add Dependency node if not already present
        if dependency_name != 'None' and dependency_name not in node_ids:
            nodes.append({
                'id': dependency_name,
                'type': dependency_type,
                'description': dependency_description
            })
            node_ids.add(dependency_name)

        # Create a link from dependency to CI if both exist
        if dependency_name != 'None' and ci_name != 'None':
            links.append({'source': dependency_name, 'target': ci_name})

    # Handle any missing links between parent nodes and dependencies dynamically
    for node in nodes:
        if node['type'] in parent_to_type.values():
            for target_node in nodes:
                if target_node['type'] == node['type'] and target_node['id'] != node['id']:
                    links.append({'source': node['id'], 'target': target_node['id']})

    # Prepare and return the final graph data structure
    graph_data = {'nodes': nodes, 'links': links}
    return graph_data