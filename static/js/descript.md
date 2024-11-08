# fetchGraphData()
    Asynchronously fetches the graph data from the backend and initializes the graph visualization.

# assignColors(data)
    Assigns colors to nodes based on their types using a predefined color mapping.

# initializeGraph(data)
    Initializes the SVG elements for nodes and links and sets up the force simulation.

# expandNodeByDepth(node, depth, currentDepth = 1)
    Recursively expands nodes and links starting from a given node up to a specified depth.

# setTreeForces()
    Configures simulation forces for a tree-like layout when the depth exceeds a certain threshold.

# setGraphForces()
    Configures simulation forces for a graph-like layout suitable for shallow depths.

# updateNodePositions()
    Fixes the active node's position to the center and restarts the simulation.

# renderGraphElements()
    Updates the nodes and links in the SVG based on the current visible data and restarts the simulation.

# clusteringForce()
    Creates a custom force function that clusters nodes by their types.

# handleNodeClick()
    Handles click events on nodes to update the active node and re-render the graph accordingly.

# updateRightContainer()
    Updates the information pane with details about the active node.

# ticked()
    Updates node and link positions on each tick of the simulation.

# drag(simulation)
    Returns drag behavior functions to enable interactive movement of nodes.

# resetToInitialState()
    Resets the graph to its initial state with default depth and active node.

# searchNode(nodeId)
    Searches for a node by ID and simulates a click event on it if found.

## renderActiveNodeGraph()
    Description: Resets and redraws the graph visualization based on the specified depth and active node.
    Assessment of Necessity: The function is necessary as it orchestrates several steps to update the graph when the depth or active node changes.
    Assessment of Name: The name renderActiveNodeGraph() may be misleading because it does more than just resetting; it updates and redraws the graph based on new parameters.
    Suggestion: Rename renderActiveNodeGraph() to renderActiveNodeGraph() or updateVisualization() to reflect its role in updating the graph's layout and visualization. 