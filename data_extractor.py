import pandas as pd
import os
import networkx as nx

def fetch_graph_data(excel_file='data/network_diagram_alt.xlsx'):
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"{excel_file} not found.")

    # Load data without filling NA to preserve actual 'None' values
    df = pd.read_excel(excel_file)

    # Strip whitespace from string columns
    str_cols = df.select_dtypes(include=['object']).columns
    df[str_cols] = df[str_cols].apply(lambda x: x.str.strip())

    # Replace actual None values with 'No description available' in description columns
    description_cols = ['CI_Descrip', 'Dependency_Descrip', 'Dependency_Type_Descrip']
    for col in description_cols:
        df[col] = df[col].fillna('No description available')

    # Initialize NetworkX directed graph
    G = nx.DiGraph()
    
    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        dependency_name = row['Dependency_Name']
        ci_type = row['CI_Type']
        dependency_type = row['Dependency_Type']
        ci_description = row['CI_Descrip'] or 'No description available'
        dependency_description = row['Dependency_Descrip'] or 'No description available'
        dependency_type_description = row['Dependency_Type_Descrip'] or 'No description available'

        # Add ci_name node
        if not G.has_node(ci_name):
            G.add_node(ci_name, type=ci_type, description=ci_description, is_dependency_name=False)
        else:
            # Update description if necessary
            if not G.nodes[ci_name].get('description'):
                G.nodes[ci_name]['description'] = ci_description

        # Add dependency_name node
        if not G.has_node(dependency_name):
            G.add_node(dependency_name, type=dependency_type, description=dependency_description, is_dependency_name=True)
        else:
            if not G.nodes[dependency_name].get('description'):
                G.nodes[dependency_name]['description'] = dependency_description
            G.nodes[dependency_name]['type'] = dependency_type
            G.nodes[dependency_name]['is_dependency_name'] = True

        # Add dependency_type node (Type Node)
        if not G.has_node(dependency_type):
            G.add_node(dependency_type, type=dependency_type, description=dependency_type_description, is_dependency_name=False)
        else:
            # Update description if necessary
            if not G.nodes[dependency_type].get('description') or G.nodes[dependency_type]['description'] == 'No description available':
                G.nodes[dependency_type]['description'] = dependency_type_description

        # Add edges
        G.add_edge(ci_name, dependency_type, edge_type='with_type')
        G.add_edge(dependency_type, dependency_name, edge_type='with_type')
        G.add_edge(ci_name, dependency_name, edge_type='without_type')

    # Identify center nodes
    center_nodes = set(df[df['CI_Type'] == 'Organization']['CI_Name'])

    # Identify nodes that are depended on by more than one CI_Type
    for node in G.nodes:
        predecessors = list(G.predecessors(node))
        ci_types = set()
        for pred in predecessors:
            ci_type_pred = G.nodes[pred].get('type')
            if ci_type_pred and ci_type_pred != node:
                ci_types.add(ci_type_pred)
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
        'center_nodes': list(center_nodes)
    }
