import pandas as pd
import os

def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"{excel_file} not found.")

    # Load data without filling NA to preserve actual 'None' values
    df = pd.read_excel(excel_file)

    # Strip whitespace from string columns
    str_cols = df.select_dtypes(include=['object']).columns
    df[str_cols] = df[str_cols].apply(lambda x: x.str.strip())

    # Replace actual None values with 'No description available' in description columns
    description_cols = ['CI_Descrip', 'Dependency_Descrip']
    for col in description_cols:
        df[col] = df[col].fillna('No description available')

    # Initialize graph data structures
    nodes = {}
    edges = []
    root_node = set()

    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        dependency_name = row['Dependency_Name']
        ci_type = row['CI_Type']
        dependency_type = row['Dependency_Type']
        ci_description = row['CI_Descrip'] or 'No description available'
        dependency_description = row['Dependency_Descrip'] or 'No description available'

        # Add or update ci_name node
        if ci_name not in nodes:
            nodes[ci_name] = {
                'id': ci_name,
                'type': ci_type,
                'description': ci_description,
                'is_dependency_name': False,
                'type_relations': [],
                'is_multi_dependent': False,
                'indirect_relationships': []
            }

        # Add or update dependency_name node
        if dependency_name not in nodes:
            nodes[dependency_name] = {
                'id': dependency_name,
                'type': dependency_type,
                'description': dependency_description,
                'is_dependency_name': True,
                'type_relations': [],
                'is_multi_dependent': False,
                'indirect_relationships': []
            }

        # Add edge
        edges.append({
            'source': ci_name,
            'target': dependency_name,
            'edge_type': 'without_type'
        })

        # Add type node if not already present
        if dependency_type not in nodes:
            nodes[dependency_type] = {
                'id': dependency_type,
                'type': dependency_type,
                'description': 'No description available',
                'is_dependency_name': False,
                'type_relations': [],
                'is_multi_dependent': False,
                'indirect_relationships': []
            }

    # Identify root nodes
    root_node.update(df[df['CI_Type'] == 'Organization']['CI_Name'])

    # Identify nodes that are depended on by more than one CI_Type
    for node_id in nodes:
        predecessors = [edge['source'] for edge in edges if edge['target'] == node_id]
        ci_types = set(nodes[pred]['type'] for pred in predecessors if pred in nodes)
        nodes[node_id]['is_multi_dependent'] = len(ci_types) > 1

    # Identify indirect relationships
    for node_id, node_data in nodes.items():
        if node_data['is_dependency_name']:
            successors = [edge['target'] for edge in edges if edge['source'] == node_id]
            indirect_dependencies = [succ for succ in successors if nodes[succ]['is_dependency_name']]
            nodes[node_id]['indirect_relationships'] = indirect_dependencies

    # Group nodes by their type
    nodes_by_type = {}
    for node_id, node_data in nodes.items():
        node_type = node_data['type']
        if node_type not in nodes_by_type:
            nodes_by_type[node_type] = []
        nodes_by_type[node_type].append(node_id)

    # Assign type relations for type nodes
    for node_id, node_data in nodes.items():
        if node_data['id'] == node_data['type']:  # Type node
            node_data['type_relations'] = [
                nid for nid in nodes_by_type.get(node_data['type'], []) if nid != node_id
            ]

    # Convert graph data to JSON-friendly format
    graph_nodes = list(nodes.values())
    graph_links = edges

    return {
        'nodes': graph_nodes,
        'links': graph_links,
        'root_node': list(root_node),
        'indirect_relationships': {
            node_id: data['indirect_relationships']
            for node_id, data in nodes.items() if data['indirect_relationships']
        }
    }
