import pandas as pd
import os
import networkx as nx

def fetch_graph_data_with_centrality(excel_file='data/network_diagram.xlsx'):
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

    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        dependency_name = row['Dependency_Name']

        # Add nodes with attributes
        G.add_node(ci_name, type=row['CI_Type'], description=row['CI_Descrip'])
        G.add_node(dependency_name, type=row['Dependency_Type'], description=row['Dependency_Descrip'])
        
        # Add edge for dependencies
        if dependency_name != 'None':
            G.add_edge(ci_name, dependency_name)

    # Calculate centrality metrics
    degree_centrality = nx.degree_centrality(G)
    closeness_centrality = nx.closeness_centrality(G)
    betweenness_centrality = nx.betweenness_centrality(G)

    # Assign centrality and type data to nodes
    for node in G.nodes:
        G.nodes[node]['degree_centrality'] = degree_centrality.get(node, 0)
        G.nodes[node]['closeness_centrality'] = closeness_centrality.get(node, 0)
        G.nodes[node]['betweenness_centrality'] = betweenness_centrality.get(node, 0)

    # Identify nodes that are depended on by more than one CI_Type
    multi_dependents = {}  # key: node, value: set of CI_Types that depend on it

    for node in G.nodes:
        predecessors = list(G.predecessors(node))
        ci_types = set()
        for pred in predecessors:
            ci_type = G.nodes[pred]['type']
            ci_types.add(ci_type)
        if len(ci_types) > 1:
            multi_dependents[node] = ci_types
            G.nodes[node]['is_multi_dependent'] = True  # Add flag to node
        else:
            G.nodes[node]['is_multi_dependent'] = False  # Add flag to node

    # Convert graph to JSON-friendly format for frontend
    nodes = [
        {
            'id': node,
            'type': G.nodes[node]['type'],
            'description': G.nodes[node]['description'],
            'degree_centrality': G.nodes[node]['degree_centrality'],
            'closeness_centrality': G.nodes[node]['closeness_centrality'],
            'betweenness_centrality': G.nodes[node]['betweenness_centrality'],
            'is_multi_dependent': G.nodes[node]['is_multi_dependent'],  # Include the flag
        }
        for node in G.nodes
    ]
    
    links = [
        {'source': source, 'target': target}
        for source, target in G.edges
    ]

    return {'nodes': nodes, 'links': links}
