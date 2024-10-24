import pandas as pd
import os

def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
    """
    Dynamically extracts graph data from the Excel file based on its structure.
    It ensures all child nodes are directly linked to UPMIS, without intermediate parent nodes.
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

    parent_nodes = ['Technologies', 'People', 'Software', 'Servers']
    parent_to_type = {
        'Technologies': 'Technology',
        'People': 'People',
        'Software': 'Software',
        'Servers': 'Server'
    }

    # Keep track of parent dependencies for UPMIS
    upmis_parents = set()

    for _, row in df.iterrows():
        ci_name = row[ci_name_col]
        ci_type = row[ci_type_col]
        ci_description = row['CI_Descrip']
        dependency_name = row[dependency_name_col]
        dependency_type = row[dependency_type_col]
        dependency_description = row['Dependency_Descrip']

        # Skip adding parent nodes to nodes list
        if ci_name != 'None' and ci_name not in node_ids and ci_name not in parent_nodes:
            nodes.append({
                'id': ci_name,
                'type': ci_type,
                'description': ci_description
            })
            node_ids.add(ci_name)

        if dependency_name != 'None' and dependency_name not in node_ids and dependency_name not in parent_nodes:
            nodes.append({
                'id': dependency_name,
                'type': dependency_type,
                'description': dependency_description
            })
            node_ids.add(dependency_name)

        # Collect parent dependencies for UPMIS
        if ci_name == 'UPMIS' and dependency_name in parent_nodes:
            upmis_parents.add(dependency_name)

        # If dependency_name is not 'None' and not in parent_nodes, create link from dependency_name to ci_name
        if dependency_name != 'None' and ci_name != 'None' and dependency_name not in parent_nodes:
            links.append({'source': dependency_name, 'target': ci_name})

    # Now, for each parent node UPMIS depends on, link all nodes of corresponding type directly to UPMIS
    for parent in upmis_parents:
        node_type = parent_to_type[parent]
        for node in nodes:
            if node['type'] == node_type:
                links.append({'source': node['id'], 'target': 'UPMIS'})

    # Prepare the final graph data structure
    graph_data = {'nodes': nodes, 'links': links}
    return graph_data
