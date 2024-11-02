import pandas as pd
import os

def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
    """
    Data Extraction and Preparation
    File Check: Verifies if the network diagram data (network_diagram.xlsx) exists. If missing, raises a FileNotFoundError.
    Data Cleaning: Loads data from Excel, stripping whitespace and handling empty values.
    Node and Link Initialization:
    Creates lists to store nodes and links and uses a set to track unique node IDs.
    Data Parsing: Iterates over each row in the data:
    Node Creation: Adds nodes if they are not duplicates.
    Link Creation: Connects each CI_Name to its dependencies, organizing relationships.
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

        # Add dependency node if not already present
        if dependency_name != 'None' and dependency_name not in node_ids:
            nodes.append({
                'id': dependency_name,
                'type': dependency_type,
                'description': dependency_description
            })
            node_ids.add(dependency_name)

        # Add link between CI and its dependency (if valid)
        if dependency_name != 'None':
            links.append({
                'source': dependency_name,
                'target': ci_name
            })

    # Return the final graph structure
    return {'nodes': nodes, 'links': links}
