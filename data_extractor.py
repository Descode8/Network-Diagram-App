import pandas as pd
import os
import networkx as nx

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

    # Initialize NetworkX directed graph
    G = nx.DiGraph()
    
    for _, row in df.iterrows():
        ci_name = row['CI_Name']
        dependency_name = row['Dependency_Name']
        ci_type = row['CI_Type']
        dependency_type = row['Dependency_Type']
        ci_description = row['CI_Descrip'] or 'No description available'
        dependency_description = row['Dependency_Descrip'] or 'No description available'

        # Add ci_name node
        if not G.has_node(ci_name):
            G.add_node(ci_name, type=ci_type, description=ci_description, is_dependency_name=False)

        # Add dependency_name node
        if not G.has_node(dependency_name):
            G.add_node(dependency_name, type=dependency_type, description=dependency_description, is_dependency_name=True)

        # Add dependency_type node (Type Node)
        if not G.has_node(dependency_type):
            G.add_node(dependency_type, type=dependency_type, description='No description available', is_dependency_name=False)

        # Add edges
        G.add_edge(ci_name, dependency_name, edge_type='without_type')

    # Identify center nodes
    root_node = set(df[df['CI_Type'] == 'Organization']['CI_Name'])

    # Identify nodes that are depended on by more than one CI_Type
    for node in G.nodes:
        predecessors = list(G.predecessors(node))
        ci_types = set()
        for pred in predecessors:
            ci_type_pred = G.nodes[pred].get('type')
            if ci_type_pred and ci_type_pred != node:
                ci_types.add(ci_type_pred)
        G.nodes[node]['is_multi_dependent'] = len(ci_types) > 1

    # Identify special relationships for "App 2"
    indirect_relationshps = {}
    for node in G.nodes:
        if G.nodes[node].get('is_dependency_name', False):
            successors = list(G.successors(node))
            dependent_on_other_dependencies = [
                succ for succ in successors if G.nodes[succ].get('is_dependency_name', False)
            ]
            if dependent_on_other_dependencies:
                indirect_relationshps[node] = dependent_on_other_dependencies

    # Add indirect_relationshps attribute to nodes
    for node, dependencies in indirect_relationshps.items():
        G.nodes[node]['indirect_relationshps'] = dependencies

    # Convert graph to JSON-friendly format for frontend
    nodes = [
        {
            'id': node,
            'type': G.nodes[node]['type'],
            'description': G.nodes[node]['description'],
        }
        for node in G.nodes
    ]
    
    links = [
        {'source': source, 'target': target, 'edge_type': data['edge_type']}
        for source, target, data in G.edges(data=True)
    ]
    
    print()

    return {
        'nodes': nodes,
        'links': links,
        'root_node': list(root_node),
        'indirect_relationshps': indirect_relationshps
    }

