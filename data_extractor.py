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
    
    # Initialize a set to store unique center_nodes
    center_nodes = set()

    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        dependency_name = row['Dependency_Name']
        
        # Capture the CI_Type for ci_name and dependency_name if they are not 'None'
        if row['CI_Type'] != 'None' and row['Rel_Type'] == 'Depends On':
            center_nodes.add(row['CI_Name'])

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
    multi_dependents = {}  # key: node, value: set of center_nodes that depend on it

    for node in G.nodes:
        predecessors = list(G.predecessors(node))
        center_nodes_for_node = set()
        for pred in predecessors:
            ci_type = G.nodes[pred]['type']
            center_nodes_for_node.add(ci_type)
        if len(center_nodes_for_node) > 1:
            multi_dependents[node] = center_nodes_for_node
            G.nodes[node]['is_multi_dependent'] = True  # Add flag to node
        else:
            G.nodes[node]['is_multi_dependent'] = False  # Add flag to node

    # Convert graph to JSON-friendly format for frontend
    nodes = [
        {
            # The unique identifier of the node in the graph
            'id': node,
            # The type or category of the node (e.g., person, organization)
            'type': G.nodes[node]['type'],
            # A textual description or summary of the node's purpose
            'description': G.nodes[node]['description'],
            # The degree centrality value, representing the number of direct connections the node has
            # 'degree_centrality': G.nodes[node]['degree_centrality'],
            # Closeness centrality, measuring how close the node is to all other nodes in the graph
            #'closeness_centrality': G.nodes[node]['closeness_centrality'],
            # Betweenness centrality, indicating the importance of the node in connecting different parts of the graph
            #'betweenness_centrality': G.nodes[node]['betweenness_centrality'],
            # Flag to indicate if the node is dependent on by more than one CI_Type
            'is_multi_dependent': G.nodes[node]['is_multi_dependent'],
        }
        
        for node in G.nodes
    ]
    
    links = [
        {'source': source, 'target': target}
        for source, target in G.edges
    ]
    print("Backend called")

    return {'nodes': nodes, 'links': links, 'center_nodes': list(center_nodes)}
