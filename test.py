import pandas as pd
import os

def extract_direct_relationships(file_path, ci_name):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"{file_path} not found.")

    # Load the Excel file
    data = pd.read_excel(file_path)

    # Check for required columns (Optional: if specific columns are mandatory)
    if 'CI_Name' not in data.columns or 'Dependency_Name' not in data.columns:
        raise ValueError("The required columns are missing in the data.")

    # Filter rows where CI_Name matches
    direct_relationships = data[data['CI_Name'] == ci_name]

    # Return all columns of the filtered rows
    return direct_relationships

# def extract_indirect_relationships(file_path, direct_relationships):
#     # Load the Excel file
#     data = pd.read_excel(file_path)

#     if 'CI_Name'

    

# Path to the Excel file
file_path = 'data/network_diagram.xlsx'
ci_name = 'OIT'

try:
    # Get all rows for direct relationships
    direct_relationships = extract_direct_relationships(file_path, ci_name)

    # Print the direct relationships
    print("Direct Relationships:")
    print(direct_relationships)
except Exception as e:
    print(f"Error: {e}")
