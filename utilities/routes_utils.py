import pandas as pd

def fetch_graph_data():
    """
    Fetch data from Excel and build nodes and links for D3.js.
    """
    try:
        # Read the Excel sheet
        excel_file = 'utilities/data/network_diagram.xlsx'
        df = pd.read_excel(excel_file)

        # Create nodes with all necessary information
        nodes = []
        for _, row in df.iterrows():
            # Add the parent node (if not already added)
            nodes.append({
                "id": row["CI_Name"],
                "type": row["CI_Type"],
                "ci_descrip": row["CI_Descrip"],
                "isChild": False
            })

            # Add the child node (dependency)
            nodes.append({
                "id": row["Dependency"],
                "type": row["CI_Type"],
                "dependency_descrip": row["Dependency_Descrip"],
                "isChild": True
            })

        # Remove duplicate nodes
        nodes = [dict(t) for t in {tuple(d.items()) for d in nodes}]

        # Create links between parent and child nodes
        links = [
            {"source": row["CI_Name"], "target": row["Dependency"]}
            for _, row in df.iterrows()
        ]

        return {"nodes": nodes, "links": links}

    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return {"error": "Failed to read data from Excel"}
