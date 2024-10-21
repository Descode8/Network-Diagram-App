import pandas as pd
import os

def fetch_graph_data(excel_file='utilities/data/network_diagram.xlsx'):
    """
    Dynamically extracts graph data from the Excel file based on its structure.
    It ensures all child nodes are correctly linked to their parent nodes.
    """

    # Check if the Excel file exists
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"{excel_file} not found.")

    # Load the Excel file and replace NaN values with 'None'
    df = pd.read_excel(excel_file).fillna('None')

    # Dynamically detect the columns based on common keywords in their names
    ci_name_col = next(col for col in df.columns if 'CI_Name' in col)
    ci_type_col = next(col for col in df.columns if 'CI_Type' in col)
    dependency_name_col = next(col for col in df.columns if 'Dependency_Name' in col)
    dependency_type_col = next(col for col in df.columns if 'Dependency_Type' in col)

    # Initialize containers for nodes and links
    nodes = []
    links = []
    node_ids = set()  # Track added nodes to avoid duplicates

    # Create nodes and links dynamically from the detected columns
    for _, row in df.iterrows():
        ci_name = row[ci_name_col]
        ci_type = row[ci_type_col]
        dependency_name = row[dependency_name_col]
        dependency_type = row[dependency_type_col]

        # Add CI node if not already added
        if ci_name != 'None' and ci_name not in node_ids:
            nodes.append({'id': ci_name, 'type': ci_type})
            node_ids.add(ci_name)

        # Add Dependency node if not already added
        if dependency_name != 'None' and dependency_name not in node_ids:
            nodes.append({'id': dependency_name, 'type': dependency_type})
            node_ids.add(dependency_name)

        # Create a link between CI and its dependency
        if dependency_name != 'None' and ci_name != 'None':
            links.append({'source': dependency_name, 'target': ci_name})

    # Handle additional parent-child links 
    for node in nodes:
        if node['type'] == 'Technology' and node['id'] != 'Technologies':
            links.append({'source': 'Technologies', 'target': node['id']})
        elif node['type'] == 'Server' and node['id'] != 'Servers':
            links.append({'source': 'Servers', 'target': node['id']})
        elif node['type'] == 'Software':    
            links.append({'source': 'Software', 'target': node['id']})
        elif node['type'] == 'People':
            links.append({'source': 'People', 'target': node['id']}) 
            
    # Prepare the final graph data structure
    graph_data = {'nodes': nodes, 'links': links}
    return graph_data
