/*******************************************
 * VARIABLE DECLARATIONS AND INITIAL SETUP *
 *******************************************/
var rootStyles = getComputedStyle(document.documentElement);
var homeNodeClr = rootStyles.getPropertyValue('--home-nde-clr').trim();
var appNodeClr = rootStyles.getPropertyValue('--app-nde-clr').trim();
var pplNodeClr = rootStyles.getPropertyValue('--ppl-nde-clr').trim();
var techNodeClr = rootStyles.getPropertyValue('--tech-nde-clr').trim();
var dataNodeClr = rootStyles.getPropertyValue('--data-nde-clr').trim();
var procureNodeClr = rootStyles.getPropertyValue('--procure-nde-clr').trim();
var fcltyNodeClr = rootStyles.getPropertyValue('--fclty-nde-clr').trim();
var textClr = rootStyles.getPropertyValue('--text-clr').trim();
var lineClr = rootStyles.getPropertyValue('--bdr-clr').trim();
const typeColorMap = new Map([
    ['Home', homeNodeClr],   
    ['Applications', appNodeClr], 
    ['People', pplNodeClr],           
    ['Technology', techNodeClr],  
    ['Data', dataNodeClr], 
    ['Procurements', procureNodeClr],
    ['Facilities', fcltyNodeClr] 
]);

let homeNode;
let activeNodeId;
const svg = d3.select("svg");
var rightContainer = d3.select(".right-pane");
var searchInput = document.getElementById('searchInput');
var searchButton = document.getElementById('searchButton');
var homeButton = document.getElementById('homeButton');
var depthSlider = document.getElementById('depthSlider');
var depthValueDisplay = document.getElementById('depthValue');
var svgElement = svg.node();
const width = svgElement.getBoundingClientRect().width;
const height = svgElement.getBoundingClientRect().height;
var g = svg.append("g");
var nodeColorMap = new Map();
let simulation;
let graphData;
let nodeById;
let visibleNodes = [];
let visibleLinks = [];
let node;
let link;

var slider = document.getElementById('depthSlider');
        // Function to update the gradient and the displayed value
        function updateSlider() {
            var value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
            slider.style.setProperty('--value', `${value}%`);
            depthValue.textContent = slider.value; // Update the displayed value
        }
        // Initialize the slider with the default value on page load
        updateSlider();
        // Update the slider whenever its value changes
        slider.addEventListener('input', updateSlider);

var zoom = d3.zoom()
    .scaleExtent([0.5, 1.5])
    .on('zoom', (event) => {
        g.attr('transform', event.transform);
    });
svg.call(zoom);

/**********************************
 * FETCHING DATA FROM THE BACKEND *
 **********************************/
async function fetchGraphData() {
    var response = await fetch("/", {
        headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
        console.error("Failed to fetch graph data:", response.statusText);
        return;
    }

    graphData = await response.json();

    // Dynamically assign home and active nodes from the graph data
    var homeLink = graphData.links.find(link => link.target === 'Home') || graphData.links[0];
    homeNode = activeNodeId = homeLink ? homeLink.target : 'Home';

    console.log("Active Node:", activeNodeId);
    console.log("Graph data fetched successfully:", graphData);

    assignColors(graphData);
    renderGraph(graphData);
}

/*************************************************
 * ASSIGNING COLORS TO NODES BASED ON THEIR TYPE *
 *************************************************/
function assignColors(data) {
    // Iterate through each node in the dataset
    data.nodes.forEach(node => {
        if (node.id === activeNodeId) {
            var color = typeColorMap.get('Home');
            nodeColorMap.set(node.id, color);
        } else {
            // Get the color associated with the node's type from the type-color mapping
            var color = typeColorMap.get(node.type);
            if (color) {
                // If a color exists for this type, use it
                nodeColorMap.set(node.id, color);
            } else {
                // If no color is defined for this type, use gray as default
                nodeColorMap.set(node.id, 'yellow');
            }
        }
    });
}

/*************************************
 * RENDERING THE GRAPH VISUALIZATION *
*************************************/
function renderGraph(data) {
    // Create a map for quick node lookups by ID, enabling faster access to nodes by their ID.
    nodeById = new Map(data.nodes.map(node => [node.id, node]));

    // Convert string IDs to actual node objects in the links array.
    data.links.forEach(link => {
        if (typeof link.source === 'string') {
            link.source = nodeById.get(link.source);
        }
        if (typeof link.target === 'string') {
            link.target = nodeById.get(link.target);
        }
    });

    // Track visible nodes and links
    visibleNodes = [];
    visibleLinks = [];

    // Create link elements
    link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);

    // Define the drag behavior function
    const drag = simulation => {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    };

    // Create node elements
    node = g.append("g")
        .attr("class", "nodes")
        .style("stroke", textClr)           // Outline color for nodes
        .style("stroke-width", 2)           // Outline thickness for nodes
        .style("text-anchor", "middle")     // Centers text inside nodes
        .selectAll("g")
        .data(visibleNodes, d => d.id)
        .enter()
        .append("g")
        .call(drag(simulation));            // Apply drag behavior here

    // Append circles to each node
    node.append("circle")
        .attr("r", d => (d.id === activeNodeId ? 8 : 5)) // Increased radius for active node
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", nodeClicked);

    // Append text to each node
    node.append("text")
        .text(d => d.id);

    // Initialize the force simulation with visible nodes
    simulation = d3.forceSimulation(visibleNodes)
        .force("link", d3.forceLink(visibleLinks)
            .id(d => d.id)
            .distance(100)                       // Preferred link length
            .strength(0.2))                     // Rigidity of links
        .force("charge", d3.forceManyBody()
            .strength(-200)                     // Repulsion strength
            .distanceMax(100))                  // Max range for repulsion
        .force("collide", d3.forceCollide()
            .radius(30)                         // Minimum separation distance
            .strength(0.01))                    // Strength of collision force
        .force("cluster", clusteringForce())    // Custom clustering force
        .on("tick", ticked);                    // Event listener for each tick

    // Set initial depth from slider and render graph layout
    resetGraph(parseInt(depthSlider.value));
}

/****************************************
* Unified logic for resetting the graph *
*****************************************/
function resetGraph(depth = parseInt(depthSlider.value), nodeId = activeNodeId) {
    activeNodeId = nodeId;
    visibleNodes = [];
    visibleLinks = [];

    var nodeObj = nodeById.get(nodeId);
    expandNodeByDepth(nodeObj, depth);

    // Update force settings based on the depth value
    if (depth > 2) {
        setTreeForces();
    } else {
        setGraphForces();
    }

    updateNodePositions();
    updateGraph();
    updateRightContainer();
}

function setTreeForces() {
    simulation
        .force("link", d3.forceLink(visibleLinks)
            .id(d => d.id)
            .distance(100)     // Longer distance for tree-like branches
            .strength(1))      // Stronger link force for tree structure
        .force("charge", d3.forceManyBody()
            .strength(-30))    // Reduced repulsion for a tree layout
        .force("center", null) // Remove centering force for tree layout
        .force("y", d3.forceY()   // Pull nodes downwards for tree hierarchy
            .strength(0.2))
        .force("x", d3.forceX(width / 2)   // Center nodes horizontally
            .strength(0.1));
}

function setGraphForces() {
    simulation
        .force("link", d3.forceLink(visibleLinks)
            .id(d => d.id)
            .distance(75)   // Lower the distance value to bring nodes closer
            .strength(1)) // Adjust strength to balance link rigidity
        .force("charge", d3.forceManyBody()
            .strength(-50)) // Set this to a less negative value for less repulsion
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide()
            .radius(30)    // Lower radius for smaller gaps between nodes
            .strength(0.2)); // Increase strength if you want collision to be stricter
}

/******************************
* EXPAND ACTIVE NODE BY DEPTH *
*******************************/
function expandNodeByDepth(node, depth, currentDepth = 1) {
    if (currentDepth > depth) return;  // Stop recursion when the target depth is reached

    if (!visibleNodes.includes(node)) {
        visibleNodes.push(node);  // Add the current node to the visible list
    }

    // If the current depth is the maximum, stop expanding further
    if (currentDepth === depth) return;

    // Find only the immediate children of the current node
    var childLinks = graphData.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
    );

    childLinks.forEach(link => {
        if (!visibleLinks.includes(link)) {
            visibleLinks.push(link);  // Add the link to visible links

            // Get the connected node (either source or target of the link)
            var childNode = link.source.id === node.id ? link.target : link.source;

            // Recursively expand the graph if the connected node isn't already visible
            if (!visibleNodes.includes(childNode)) {
                expandNodeByDepth(childNode, depth, currentDepth + 1);
            }
        }
    });
}

/*********************************************
* UPDATE NODE POSITIONS BASED ON ACTIVE NODE *
**********************************************/
function updateNodePositions() {
    // Fix the active node at the center
    visibleNodes.forEach(n => {
        if (n.id === activeNodeId) {
            n.fx = width / 2;
            n.fy = height / 2;
        } else {
            n.fx = null;
            n.fy = null;
        }
    });

    simulation.alpha(0.3).restart();
}

/**************************************
* UPDATE THE GRAPH AFTER NODE CHANGES *
***************************************/
function updateGraph() {
    // Update links
    link = g.select(".links")
        .selectAll("line")
        .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);

    link.exit().remove();

    var linkEnter = link.enter().append("line")
        .attr("stroke-width", .75)
        .attr("stroke", lineClr);

    link = linkEnter.merge(link);

    // Update nodes
    node = g.select(".nodes").selectAll("g")
        .data(visibleNodes, d => d.id);

    node.exit().remove();

    var nodeEnter = node.enter().append("g")
        .call(drag(simulation)); // Apply the drag behavior here using the drag function

    // Append circles with conditional radius for active node
    nodeEnter.append("circle")
        .attr("r", d => (d.id === activeNodeId ? 7 : 4)) // Increased radius for active node
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", nodeClicked);

    // Append text element
    nodeEnter.append("text")
        .attr("dx", "0ex")
        .attr("dy", "-1.5ex") // Default positioning for non-active nodes
        .text(d => d.id);

    node = nodeEnter.merge(node);

    // Update the circle and text attributes for both new and existing nodes
    node.select("circle")
        .attr("r", d => (d.id === activeNodeId ? 7 : 4)); // Update radius based on active node

    node.select("text")
        .attr("stroke-width", d => (d.id === activeNodeId ? 1 : 0)) // Outline text for active node
        .attr("font-size", d => (d.id === activeNodeId ? 1.2 : .7) + "em"); // Ensure active node has larger font size

    // Restart the simulation
    simulation.nodes(visibleNodes);
    simulation.force("link")
        .links(visibleLinks);
    simulation.alpha(0.3).restart();
}

/**********************************************
* UPDATE right-pane WITH NODE ATTRIBUTES *
***********************************************/
function updateRightContainer() {
    // Clear the existing content
    rightContainer.html("");

    // Get the active node object
    var activeNode = nodeById.get(activeNodeId);

    // Display the active node's ID at the top
    var color = typeColorMap.get(activeNode.id);
            nodeColorMap.set(node.id, color);
    rightContainer.append("h2")
    .style("background-color", typeColorMap.get(activeNode.type) || '#000')
    .html(`${activeNode.id}`);

    // Display the active node's name
    // rightContainer.append("h3").text("Name:");

    // Display the active node's type
    rightContainer.append("p").html(`<strong>Type: </strong>${activeNode.type}`);

    // Display the active node's description
    var description = activeNode.description ? activeNode.description : 'No description available';
    // Add the Description header with a specific class
        rightContainer.append("h3")
        .attr("class", "description-header")
        .html(`Description`);

        // Add the description text
        rightContainer.append("p").html(`${description}`);

        // Add the Dependencies header with a different class
        rightContainer.append("h3")
        .attr("class", "dependencies-header")
        .html("Dependencies");

    // Get the types of the active node's immediate children
    var immediateChildren = visibleNodes.filter(n => {
        return visibleLinks.some(link =>
            (link.source.id === activeNodeId && link.target.id === n.id) ||
            (link.target.id === activeNodeId && link.source.id === n.id)
        ) && n.id !== activeNodeId;
    });

    // Group children by type
    var types = d3.group(immediateChildren, d => d.type);

    // Define the desired display order
    var orderedTypes = ["People", "Technology"];

    // Display "People" and "Technology" first, in that order
    orderedTypes.forEach(type => {
        if (types.has(type)) {
            var nodes = types.get(type);
            rightContainer.append("p")
                .style("background-color", typeColorMap.get(type) || '#000')
                .attr("class", "dependency-type")
                .html(`${type}`);

            nodes.forEach(node => {
                var nodeName = node.id;
                rightContainer.append("p")
                    .attr("class", "dependency-node")
                    .html(`${nodeName}`);
            });
        }
    });

    // Display remaining types 
    types.forEach((nodes, type) => {
        if (!orderedTypes.includes(type)) {
            rightContainer.append("p")
                .style("background-color", typeColorMap.get(type) || '#000')
                .attr("class", "dependency-type")
                .html(`${type}`);

            nodes.forEach(node => {
                var nodeName = node.id;
                rightContainer.append("p")
                    .attr("class", "dependency-node")
                    .html(`${nodeName}`);
            });
        }
    });
}

/****************************************************************
* SIMULATION TICK FUNCTION: UPDATE POSITIONS OF NODES AND LINKS *
*****************************************************************/
function ticked() {
    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
    node
        .attr("transform", d => {
        d.x = Math.max(0, Math.min(width, d.x)); // Ensure nodes stay within width
        d.y = Math.max(0, Math.min(height, d.y)); // Ensure nodes stay within height
        return `translate(${d.x},${d.y})`;
    });    
}

/********************************************************************
 * CUSTOM CLUSTERING FORCE TO ATTRACT NODES TO THEIR CLUSTER CENTERS *
 *********************************************************************/
function clusteringForce() {
    // Create an array of unique node types, excluding the home node type
    var types = [...new Set(graphData.nodes
        .filter(node => node.id !== activeNodeId)
        .map(node => node.type))];

    // Set up the structure for positioning cluster centers
    var clusterCenters = {};
    var numTypes = types.length;
    var clusterRadius = Math.min(width, height);

    // Calculate position for each cluster type's center
    types.forEach((type, index) => {
        var angle = (index / numTypes) * 2 * Math.PI;
        clusterCenters[type] = {
            x: width / 2 + clusterRadius * Math.cos(angle),
            y: height / 2 + clusterRadius * Math.sin(angle)
        };
    });

    // Return the force function
    return function(alpha) {
        visibleNodes.forEach(function(d) {
            // Exclude nodes connected to multiple center nodes (shared nodes)
            const connections = visibleLinks.filter(link =>
                link.source.id === d.id || link.target.id === d.id
            ).map(link => link.source.id === d.id ? link.target.id : link.source.id);

            const uniqueCenters = new Set(connections.filter(nodeId => {
                return visibleNodes.some(n => n.id === nodeId && n.id !== d.id);
            }));

            // If the node is connected to multiple unique centers, allow it to float freely
            // if (uniqueCenters.size > 1) {
            //     return;
            // }

            // Otherwise, apply clustering force
            if (d.id !== activeNodeId && d.id !== homeNode) {
                var cluster = clusterCenters[d.type];
                var clusterStrength = 0.05; // Change strength of groups (higher number = closer together)
                d.vx -= (d.x - cluster.x) * alpha * clusterStrength;
                d.vy -= (d.y - cluster.y) * alpha * clusterStrength;
            }
        });
    };
}

/*************************************************
 * CUSTOM FORCE TO REPEL CLUSTERS FROM EACH OTHER *
 **************************************************/
function clusterRepulsionForce() {
    return function(alpha) {
        // Step 1: Identify center nodes (nodes with more than one connection)
        var centerNodes = visibleNodes.filter(node => {
            var connectedLinks = visibleLinks.filter(link => 
                link.source.id === node.id || link.target.id === node.id
            );
            return connectedLinks.length > 1; // Center node if degree > 1
        });

        // Step 2: For each center node, collect its cluster (center node + connected nodes)
        var clusters = [];
        centerNodes.forEach(centerNode => {
            var clusterNodes = [centerNode];
            visibleLinks.forEach(link => {
                if (link.source.id === centerNode.id && link.target.id !== centerNode.id) {
                    clusterNodes.push(link.target);
                } else if (link.target.id === centerNode.id && link.source.id !== centerNode.id) {
                    clusterNodes.push(link.source);
                }
            });
            clusters.push({ center: centerNode, nodes: clusterNodes });
        });

        // Step 3: Apply repulsion between clusters
        for (var i = 0; i < clusters.length; i++) {
            var clusterA = clusters[i];
            // Calculate centroid of cluster A
            var centroidA = calculateCentroid(clusterA.nodes);
            for (var j = i + 1; j < clusters.length; j++) {
                var clusterB = clusters[j];
                // Calculate centroid of cluster B
                var centroidB = calculateCentroid(clusterB.nodes);
                var dx = centroidB.x - centroidA.x;
                var dy = centroidB.y - centroidA.y;
                var distance = Math.sqrt(dx * dx + dy * dy);
                var minDistance = 150; // Minimum distance between clusters
                var strength = .9;    // Strength of the repulsive force

                if (distance < minDistance) {
                    var force = (minDistance - distance) * strength * alpha;
                    var fx = (dx / distance) * force;
                    var fy = (dy / distance) * force;

                    // Distribute the force among the nodes in each cluster
                    clusterA.nodes.forEach(node => {
                        node.vx -= fx / clusterA.nodes.length;
                        node.vy -= fy / clusterA.nodes.length;
                    });
                    clusterB.nodes.forEach(node => {
                        node.vx += fx / clusterB.nodes.length;
                        node.vy += fy / clusterB.nodes.length;
                    });
                }
            }
        }
    };
}

/*************************************************
* CUSTOM FORCE TO REPEL CLUSTERS FROM EACH OTHER *
**************************************************/
function clusterCollideForce() {
    var padding = 20;  // Minimum pixels between cluster centers

    // Same type extraction as in clusteringForce()
    var types = [...new Set(graphData.nodes
        // .filter(node => node.id !== homeNode)
        .map(node => node.type))];

    // Same cluster center calculation as in clusteringForce()
    var clusterCenters = {};
    var numTypes = types.length;
    var clusterRadius = Math.min(width, height);

    // Calculate initial positions of cluster centers
    types.forEach((type, index) => {
        var angle = (index / numTypes) * 2 * Math.PI;
        clusterCenters[type] = {
            x: width / 2 + clusterRadius * Math.cos(angle),
            y: height / 2 + clusterRadius * Math.sin(angle)
        };
    });

    // Return the force function that prevents cluster overlap
    return function() {
        // Compare each cluster with every other cluster
        types.forEach((typeA, i) => {
            var clusterA = clusterCenters[typeA];
            // Only compare with clusters we haven't checked yet (slice(i + 1))
            types.slice(i + 1).forEach(typeB => {
                var clusterB = clusterCenters[typeB];
                // Calculate distance between clusters
                let dx = clusterB.x - clusterA.x;  // X distance
                let dy = clusterB.y - clusterA.y;  // Y distance
                let distance = Math.sqrt(dx * dx + dy * dy);  // Pythagorean theorem
                let minDistance = padding;  // Minimum allowed distance

                // If clusters are too close, push them apart
                if (distance < minDistance) {
                    // Calculate how far to move each cluster
                    // Movement is proportional to how much they overlap
                    let moveX = dx / distance * (minDistance - distance);
                    let moveY = dy / distance * (minDistance - distance);

                    // Move clusters in opposite directions
                    clusterA.x -= moveX;  // Move cluster A left
                    clusterA.y -= moveY;  // Move cluster A up
                    clusterB.x += moveX;  // Move cluster B right
                    clusterB.y += moveY;  // Move cluster B down
                }
            });
        });
    };
}

/*******************************************************
* NODE CLICK EVENT HANDLERS FOR ACTIVE NODE MANAGEMENT *
********************************************************/
function nodeClicked(event, d) {
    if (d.id === activeNodeId) return;  // Do nothing if the clicked node is already active

    activeNodeId = d.id;  // Update active node ID
    console.log("Active Node:", activeNodeId);

    var depth = parseInt(depthSlider.value);  // Get current depth from slider
    visibleNodes = [];  // Clear visible nodes
    visibleLinks = [];  // Clear visible links

    // Expand nodes based on new active node and depth
    expandNodeByDepth(d, depth); 

    // Center the active node
    updateNodePositions();
    updateGraph();
    updateRightContainer();  // Update info pane
}

/**************************************
 * EXPAND NODES BASED ON SEARCH INPUT *
 * ************************************/
function expandNode(node) {
    /*
    Step 1: Identify Immediate Children
    - Filter the links in `graphData` to find those connected directly to the specified `node`.
    - A link is considered a match if the source or target of the link matches the `node`'s ID.

    Step 2: Iterate Through Each Link
    - For each link connected to `node`, check if it is already in `visibleLinks`.
    - If the link is not already visible, add it to `visibleLinks`.

    Step 3: Find and Add Connected Nodes
    - Determine the "other" node connected by this link (the node at the opposite end).
    - If this `otherNode` is not already in `visibleNodes`, add it to `visibleNodes`.
    - This ensures that any node directly connected to `node` becomes visible in the graph.

    Result:
    - This function expands the visibility of nodes and links around the specified `node`,
        gradually revealing the network structure as nodes are expanded.
    */
    
    // Find immediate children of the node
    var newLinks = graphData.links.filter(
        link => (link.source.id === node.id || link.target.id === node.id)
    );

    newLinks.forEach(link => {
        // Ensure the link isn't already visible
        if (!visibleLinks.includes(link)) {
            visibleLinks.push(link);

            // Get the connected node
            var otherNode = link.source.id === node.id ? link.target : link.source;

            // Add the connected node if it's not already visible
            if (otherNode && !visibleNodes.includes(otherNode)) {
                visibleNodes.push(otherNode);
            }
        }
    });
}

/*************************
* FUNCTIONS FOR CONTROLS *
**************************/
function searchNode(nodeId) {
    if (nodeById.has(nodeId)) {
        var node = nodeById.get(nodeId); // Get the node object
        nodeClicked(null, node); // Trigger the same logic as a click
    } else {
        alert("Node not found!");
    }
}

/******************************************
* FUNCTIONS FOR CONTROLS AND INTERACTIONS *
*******************************************/
function resetToInitialState() {
    // Set the depth slider to its initial value
    depthSlider.value = 1;
    depthValueDisplay.textContent = 1;

    // Reset graph to the home node with depth 1
    resetGraph(1, activeNodeId);
}

/*****************************************************
* DRAG FUNCTIONS TO ENABLE INTERACTIVE NODE MOVEMENT *
******************************************************/
const drag = simulation => {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
};

// Helper function to calculate the centroid of a set of nodes
function calculateCentroid(nodes) {
    var x = 0, y = 0, n = nodes.length;
    nodes.forEach(d => {
        x += d.x;
        y += d.y;
    });
    return { x: x / n, y: y / n };
}


/*******************************
* EVENT LISTENERS FOR CONTROLS *
********************************/
// Modify the home button event listener to use the current slider depth
homeButton.addEventListener('click', () => {
    var depth = parseInt(depthSlider.value);  
    resetGraph(depth, homeNode);  
});

// Add event listener for the search button
searchButton.addEventListener('click', () => {
    var searchTerm = searchInput.value.trim();
    if (searchTerm) {
        searchNode(searchTerm);
    }
});

// Add event listener for 'Enter' key press on the input field
searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        var searchTerm = searchInput.value.trim();
        if (searchTerm) {
            searchNode(searchTerm);
        }
    }
});

// Add event listener for the depth slider
depthSlider.addEventListener('input', () => {
    var depth = parseInt(depthSlider.value);
    depthValueDisplay.textContent = depth;
    resetGraph(depth, activeNodeId);
});

/*****************************************************
 * INITIALIZING AND FETCHING GRAPH DATA ON PAGE LOAD *
 *****************************************************/
// Ensure the SVG element is fully loaded before starting
window.onload = function() {
    fetchGraphData().then(() => {
        resetGraph(2, activeNodeId);  // Set initial depth to 2
    });
};

