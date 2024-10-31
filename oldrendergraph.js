function renderGraph(data) {
    // Create a map for quick node lookups by ID
    nodeById = new Map(data.nodes.map(node => [node.id, node]));

    // Convert string IDs to actual node objects in the links array
    data.links.forEach(link => {
        // Replace source ID with source node object if it's a string
        if (typeof link.source === 'string') {
            link.source = nodeById.get(link.source);
        }
        // Replace target ID with target node object if it's a string
        if (typeof link.target === 'string') {
            link.target = nodeById.get(link.target);
        }
    });

    // Clear the arrays that track visible elements
    visibleNodes = [];
    visibleLinks = [];

    // Create container for link elements
    link = g.append("g")
        .attr("class", "links")
        .selectAll("line");

    // Create container for node elements
    node = g.append("g")
        .attr("class", "nodes")
        .style("stroke", textClr) // put circle around nodes for better visibility
        .style("text-anchor", "middle")
        .selectAll("g");

    // Initialize the force simulation with multiple forces
    simulation = d3.forceSimulation(visibleNodes)
        // Link force: controls the distance and strength between connected nodes
        .force("link", d3.forceLink(visibleLinks)
            .distance(150)  // Desired link length
            .strength(0.1)) // Strength of the link force
        // Charge force: makes nodes repel each other
        .force("charge", d3.forceManyBody()
            .strength(-200)    // Repulsion strength
            .distanceMax(100)) // Maximum effect distance

        // Center force: pulls the entire graph toward the center
        .force("center", d3.forceCenter(width / 2, height / 2))

        // Collision force: prevents nodes from overlapping
        .force("collision", d3.forceCollide()
            .radius(10)     // This defines how close nodes can get to each other before the force kicks in to prevent overlap
            .strength(2))   // This controls how strongly nodes repel each other when they collide.

        // Custom forces for clustering and cluster separation
        .force("cluster", clusteringForce())
        .force("clusterCollide", clusterCollideForce(10))

        // Control simulation cooling rate
        .alphaDecay(0.01)

        // Update positions on each simulation step
        .on("tick", ticked);

    // Initialize the graph with the current depth setting
    resetGraph(parseInt(depthSlider.value));
}

/********************************************************************
* CUSTOM CLUSTERING FORCE TO ATTRACT NODES TO THEIR CLUSTER CENTERS *
*********************************************************************/
function clusteringForce() {
    // Create an array of unique node types, excluding the home node type
    // Using Set to remove duplicates and spread operator to convert back to array
    var types = [...new Set(graphData.nodes
        .filter(node => node.id !== homeNode)  // Remove home node from consideration
        .map(node => node.type))];             // Extract just the type property

    // Set up the structure for positioning cluster centers
    var clusterCenters = {};                   // Object to store center coordinates for each type
    var numTypes = types.length;               // Count of unique types
    // Calculate radius for arranging clusters in a circle
    // Uses 1/3 of the smaller dimension to ensure clusters fit on screen
    var clusterRadius = Math.min(width, height) / 2;

    // Calculate position for each cluster type's center
    types.forEach((type, index) => {
        // Calculate angle for even spacing around a circle (in radians)
        var angle = (index / numTypes) * 2 * Math.PI;
        // Store the x,y coordinates for this cluster's center
        clusterCenters[type] = {
            // Use trigonometry to place centers in a circle
            x: width / 2 + clusterRadius * Math.cos(angle),   // Center X + radius * cos(angle)
            y: height / 2 + clusterRadius * Math.sin(angle)   // Center Y + radius * sin(angle)
        };
    });

    // Return the actual force function that D3 will call during simulation
    return function(alpha) {  // alpha is the simulation's "temperature"
        visibleNodes.forEach(function(d) {
            // Don't move active node or parent nodes - they have fixed positions
            if (d.id !== activeNodeId) {
                // Get the target cluster center for this node's type
                var cluster = clusterCenters[d.type];
                // These lines control how each node moves towards its assigned cluster center
                d.vx -= (d.x - cluster.x) * alpha * 0.05;  
                d.vy -= (d.y - cluster.y) * alpha * 0.05;  
            }
        });
    };
}