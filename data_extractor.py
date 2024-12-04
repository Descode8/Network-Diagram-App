import pandas as pd
import os
import networkx as nx

#def fetch_graph_data(excel_file='data/network_diagram.xlsx'):
def fetch_graph_data(excel_file='data/network_diagram2.xlsx'):
    """
    Data Extraction with Centrality and Community Detection
    """
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"{excel_file} not found.")

    # Load and clean data
    df = pd.read_excel(excel_file).fillna('None')
    df = df.apply(lambda col: col.str.strip() if col.dtype == 'object' else col)

    # Initialize NetworkX directed graph
    G = nx.DiGraph()
    
    # Initialize sets to store unique center_nodes and types
    center_nodes = set()
    types = set()

    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        dependency_name = row['Dependency_Name']
        ci_type = row['CI_Type']
        dependency_type = row['Dependency_Type']
        ci_description = row['CI_Descrip']
        dependency_description = row['Dependency_Descrip']
        
        # Capture the CI_Type for ci_name and dependency_name if they are not 'None'
        if ci_type != 'None' and row['Rel_Type'] == 'Depends On':
            center_nodes.add(ci_name)
            
        # Capture dependency_type for each node
        if dependency_type != 'None':
            types.add(dependency_type)

        # Add nodes with attributes
        G.add_node(ci_name, type=ci_type, description=ci_description)
        G.add_node(dependency_name, type=dependency_type, description=dependency_description, is_dependency_name=True)
        G.add_node(dependency_type, type=dependency_type, description=f'Type Node for {dependency_type}')

        # Add edges for both scenarios
        # Edge from CI_Name to Dependency_Type
        G.add_edge(ci_name, dependency_type, edge_type='with_type')

        # Edge from Dependency_Type to Dependency_Name
        G.add_edge(dependency_type, dependency_name, edge_type='with_type')

        # Direct edge from CI_Name to Dependency_Name
        G.add_edge(ci_name, dependency_name, edge_type='without_type')

    # Identify nodes that are depended on by more than one CI_Type
    for node in G.nodes:
        predecessors = list(G.predecessors(node))
        ci_types = set()
        for pred in predecessors:
            ci_type = G.nodes[pred].get('type')
            if ci_type and ci_type != node:
                ci_types.add(ci_type)
        G.nodes[node]['is_multi_dependent'] = len(ci_types) > 1

    # Convert graph to JSON-friendly format for frontend
    nodes = [
        {
            'id': node,
            'type': G.nodes[node]['type'],
            'description': G.nodes[node]['description'],
            'is_multi_dependent': G.nodes[node]['is_multi_dependent'],
            'is_dependency_name': G.nodes[node].get('is_dependency_name', False),
        }
        for node in G.nodes
    ]
    
    links = [
        {'source': source, 'target': target, 'edge_type': data['edge_type']}
        for source, target, data in G.edges(data=True)
    ]

    return {
        'nodes': nodes, 
        'links': links, 
        'center_nodes': list(center_nodes), 
        'types': list(types)
    }
