import pandas as pd
import os

def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
    """
    Dynamically extracts graph data from the Excel file based on its structure.
    This function ensures that all child nodes are correctly linked to the main
    configuration items (CIs) without hard-coding specific CI names like UPMIS.

    Args:
        excel_file (str): Path to the Excel file containing the network diagram data.

    Returns:
        dict: A dictionary containing:
            - 'nodes': List of dictionaries representing nodes, each with 'id', 'type', and 'description'.
            - 'links': List of dictionaries representing links, each with 'source' and 'target' keys.
    """

    # Check if the Excel file exists; raise an error if not found
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"{excel_file} not found.")

    # Load the Excel file and replace any NaN values with 'None' for easier handling
    df = pd.read_excel(excel_file).fillna('None')

    # Strip leading and trailing whitespaces from all string-type columns to prevent data inconsistencies
    df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x)

    # Initialize containers for nodes, links, and a set to track added node IDs (to avoid duplicates)
    nodes = []  # List of all nodes with their attributes (id, type, description)
    links = []  # List of all links between nodes (source and target)
    node_ids = set()  # Set to keep track of nodes added to avoid duplication

    # List of parent nodes and a mapping of parent node names to their types
    parent_nodes = ['People', 'Technologies', 'Servers', 'Staff Augmentation']
    parent_to_type = {
        'People': 'People',
        'Technologies': 'Technology',
        'Servers': 'Server',
        'Staff Augmentation': 'Procurement'
    }

    # Dictionary to keep track of configuration items (CIs) and their parent dependencies
    ci_to_parents = {}

    # Iterate over each row in the DataFrame to process nodes and their dependencies
    for _, row in df.iterrows():
        # Extract values from the current row
        ci_name = row['CI_Name']
        ci_type = row['CI_Type']
        ci_description = row['CI_Descrip']
        dependency_name = row['Dependency_Name']
        dependency_type = row['Dependency_Type']
        dependency_description = row['Dependency_Descrip']

        # If the CI name is valid (not 'None'), not already added, and not in parent nodes, add it as a new node
        if ci_name != 'None' and ci_name not in node_ids and ci_name not in parent_nodes:
            nodes.append({
                'id': ci_name,  # The unique identifier of the node
                'type': ci_type,  # The type/category of the node (e.g., Application, Server)
                'description': ci_description  # Description of the node
            })
            node_ids.add(ci_name)  # Track the node to avoid duplicates

        # Similarly, if the dependency name is valid, not already added, and not in parent nodes, add it as a new node
        if dependency_name != 'None' and dependency_name not in node_ids:
            nodes.append({
                'id': dependency_name,  # The unique identifier of the dependency node
                'type': dependency_type,  # The type/category of the dependency node
                'description': dependency_description  # Description of the dependency node
            })
            node_ids.add(dependency_name)  # Track the dependency node to avoid duplicates

        # If the dependency is a parent node, associate it with the CI in the ci_to_parents dictionary
        if dependency_name in parent_nodes:
            # If the CI name is not yet a key in ci_to_parents, initialize a set for it
            if ci_name not in ci_to_parents:
                ci_to_parents[ci_name] = set()
            # Add the parent node to the set of parents associated with this CI
            ci_to_parents[ci_name].add(dependency_name)

        # If both the CI name and dependency name are valid, and the dependency is not a parent node, create a link
        if dependency_name != 'None' and ci_name != 'None' and dependency_name not in parent_nodes:
            links.append({
                'source': dependency_name,  # The dependency node acts as the source in the link
                'target': ci_name  # The CI node acts as the target in the link
            })

    # Now, link all nodes of corresponding types to their associated CIs based on parent dependencies
    for ci, parents in ci_to_parents.items():
        for parent in parents:
            node_type = parent_to_type[parent]  # Get the type associated with the parent node
            # Link all nodes of the same type directly to the CI
            for node in nodes:
                if node['type'] == node_type:
                    links.append({
                        'source': node['id'],  # The node of the same type acts as the source
                        'target': ci  # The CI acts as the target in the link
                    })

    # Prepare the final graph data structure containing nodes and links
    graph_data = {'nodes': nodes, 'links': links}
    return graph_data  # Return the graph data structure for further use
