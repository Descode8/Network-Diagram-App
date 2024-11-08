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

let activeNodeId;
const svg = d3.select("svg");
var rightContainer = d3.select(".right-pane");
var onSearchInput = document.getElementById('searchInput');
var onSearchButton = document.getElementById('searchButton');
var onHomeButton = document.getElementById('homeButton');
let isHomeButtonClicked = false;
var onRefreshButton = document.getElementById('refreshButton');
var isRefreshButtonClicked = false;
var onDepthSlider = document.getElementById('depthSlider');
let currentDepth = 2;  // Initialize with default depth
var depthValueLabel = document.getElementById('depthValue');
var svgElement = svg.node();
const width = svgElement.getBoundingClientRect().width;
const height = svgElement.getBoundingClientRect().height;
let centerX = width / 2;
let centerY = height / 2;
var graph = svg.append("g");
var nodeColorMap = new Map();
let simulation;
let graphData;
let nodeById;
let visibleNodes = [];
let visibleLinks = [];
let centralNodes = [];
let node;
let link;
let linkDistance = 150; // Default value on page load
let call = 0;
let nodesDependOnMoreThanOneCI_Type = [];

/*******************************
* EVENT LISTENERS FOR CONTROLS *
********************************/
// Modify the home button event listener to use the current slider depth
onHomeButton.addEventListener('click', () => {
    resetToInitialState();  
});

onRefreshButton.addEventListener('click', () => {
    // Clear fixed positions of all nodes
    graphData.nodes.forEach(node => {
        node.fx = null;
        node.fy = null;
    });

    // Reset positions of visible nodes to their initial positions
    visibleNodes.forEach(d => {
        if (d.initialX !== undefined && d.initialY !== undefined) {
            d.x = d.initialX;
            d.y = d.initialY;
            d.fx = null;
            d.fy = null;
        }
    });

    // Restart the simulation
    simulation.alpha(0.3).restart();

    // Reset the graph to the initial state
    renderActiveNodeGraph(parseInt(onDepthSlider.value), activeNodeId);
});

// Add event listener for the search button
onSearchButton.addEventListener('click', () => {
    var searchTerm = searchInput.value.trim();
    if (searchTerm) {
        searchNode(searchTerm);
    }
});

// Add event listener for 'Enter' key press on the input field
onSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        var searchTerm = searchInput.value.trim();
        if (searchTerm) {
            searchNode(searchTerm);
        }
    }
});

// Add event listener for the depth slider
onDepthSlider.addEventListener('input', () => {
    var depth = parseInt(onDepthSlider.value);
    depthValueLabel.textContent = depth;
    renderActiveNodeGraph(depth, activeNodeId);
});

    call = 0;
    ////console.log(`(${++call}) slider`);
    // Function to update the gradient and the displayed value
    function updateSlider() {
        var value = (onDepthSlider.value - onDepthSlider.min) / (onDepthSlider.max - onDepthSlider.min) * 100;
        onDepthSlider.style.setProperty('--value', `${value}%`);
        depthValue.textContent = onDepthSlider.value; // Update the displayed value
    }
// Initialize the slider with the default value on page load
updateSlider();
// Update the slider whenever its value changes
onDepthSlider.addEventListener('input', updateSlider);

var zoom = d3.zoom()
    .scaleExtent([0.5, 2.5])
    .on('zoom', (event) => {
        graph.attr('transform', event.transform);
    });
svg.call(zoom);

/*****************************************************
 * INITIALIZING AND FETCHING GRAPH DATA ON PAGE LOAD *
 *****************************************************/
// Ensure the SVG element is fully loaded before starting
window.onload = function() {
    ////console.log(`(${++call}) window.onload`);
    fetchGraphData().then(() => {
        // Set initial link distance
        // Set activeNodeId to initial node
        activeNodeId = graphData.nodes[0].id;
        renderActiveNodeGraph(2, activeNodeId);  // Set initial depth to 2
    });
};

/**********************************
 * FETCHING DATA FROM THE BACKEND *
 **********************************/
async function fetchGraphData() {
    ////console.log(`(${++call}) FetchGraphData`);
    var response = await fetch("/", {
        headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
        ////console.error("Failed to fetch graph data:", response.statusText);
        return;
    }

    graphData = await response.json();
    console.log("Graph data fetched successfully:", graphData);
    
    centralNodes = graphData.center_nodes;
    console.log("Central Nodes:", centralNodes);

    const multi_dependent_nodes = graphData.nodes.filter(node => 
        node.is_multi_dependent === true ? node : null);

    if(node.is_multi_dependent === true){
        nodesDependOnMoreThanOneCI_Type.push(multi_dependent_nodes);
        console.log("Multi Dependent Nodes:", nodesDependOnMoreThanOneCI_Type);
    }

    // ////console.log("Home Node", graphData.nodes[0].id);
    activeNodeId = graphData.nodes[0].id;

    assignColors(graphData);
    initializeGraph(graphData);
}

/*************************************************
 * ASSIGNING COLORS TO NODES BASED ON THEIR TYPE *
 *************************************************/
function assignColors(data) {
    ////console.log(`(${++call}) assignColors`);
    // Iterate through each node in the dataset
    data.nodes.forEach(node => {
        // Get the color associated with the node's type from the type-color mapping
        var color = typeColorMap.get(node.type);
        if (color) {
            // If a color exists for this type, use it
            nodeColorMap.set(node.id, color);
        } else {
            // If no color is defined for this type, use gray as default
            nodeColorMap.set(node.id, 'yellow');
        }
    });
}

/*************************************
 * RENDERING THE GRAPH VISUALIZATION *
*************************************/
function initializeGraph(data) {
    ////console.log(`(${++call}) initializeGraph`);
    // Create a map for quick node lookups by ID, enabling faster access to nodes by their ID.
    nodeById = new Map(data.nodes.map(node => [node.id, node]));

     // Include the 'is_multi_dependent' attribute
    data.nodes.forEach(node => {
        node.is_multi_dependent = node.is_multi_dependent || false;
    });

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
    link = graph.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);

    // Create node elements
    node = graph.append("g")
        .attr("class", "nodes")
        .style("stroke", textClr)           // Outline color for nodes
        .style("stroke-width", 1)           // Outline thickness for nodes
        .style("text-anchor", "middle")     // Centers text inside nodes
        .selectAll("g")
        .data(visibleNodes, d => d.id)
        .enter()
        .append("g")
        .call(drag(simulation));            // Apply drag behavior here

    // Append circles to each node
    node.append("circle")
        .attr("r", 5) // Increased radius for active node
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", handleNodeClick);

    // Append text to each node
    node.append("text")
        .text(d => d.id);

    // Initialize the force simulation with visible nodes
    simulation = d3.forceSimulation(visibleNodes)
        .on("tick", ticked);                    // Event listener for each tick
}

/****************************************
* Unified logic for resetting the graph *
*****************************************/
function renderActiveNodeGraph(depth = parseInt(onDepthSlider.value), nodeId = activeNodeId) {
    ////console.log(`(${++call}) renderActiveNodeGraph`);
    currentDepth = depth;
    activeNodeId = nodeId;
    visibleNodes = [];
    visibleLinks = [];

    var nodeObj = nodeById.get(nodeId);
    ////console.log(`(${++call}) expandNodeByDepth`);
    expandNodeByDepth(nodeObj, depth);

    // Adjust linkDistance based on whether it's the initial state
    if (depth === 2 && nodeId === graphData.nodes[0].id) {
        linkDistance = 175; // Initial link distance value
    } else if (depth > 2) {
        linkDistance = 20; // Reduced link distance for larger depths
    } else {
        linkDistance = 50; // Default link distance for other cases
    }

    // Update force settings based on the depth value
    if (depth > 2) {
        ////console.log(`(${++call}) setTreeForces`);
        setTreeForces();
    } else {
        ////console.log(`(${++call}) setGraphForces`);
        setGraphForces();
    }

    updateNodePositions();
    renderGraph();
    updateRightContainer();
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

/****************************************************
* SETTING UP FORCES BASED ON GRAPH LAYOUT (TREE) *
****************************************************/
function setTreeForces() {
    // Clear any existing 'tick' event handlers to prevent multiple calls
    simulation.on("tick", null);

    // Define the custom repulsion force between central nodes
    function centralNodesRepulsion() {
        // For each pair of central nodes, apply a strong mutual repulsion
        for (let i = 0; i < visibleNodes.length; i++) {
            let nodeA = visibleNodes[i];
            if (!centralNodes.includes(nodeA.id)) continue;

            for (let j = i + 1; j < visibleNodes.length; j++) {
                let nodeB = visibleNodes[j];
                if (!centralNodes.includes(nodeB.id)) continue;

                let dx = nodeB.x - nodeA.x;
                let dy = nodeB.y - nodeA.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                let minDistance;
                let repulsionStrength;
                
                if(centralNodes.includes(activeNodeId)){
                    //console.log("Central Nodes");
                    // Define the desired minimum distance between central nodes
                    minDistance = 400; // Adjust this value as needed
                    repulsionStrength = (minDistance - distance) / distance * 1;
                }else{
                    //console.log("Not Central Nodes");
                    minDistance = 10; // Adjust this value as needed
                    repulsionStrength = (minDistance - distance) / distance * .01; 
                }

                if (distance < minDistance) {
                     // Adjust strength as needed
                    let fx = dx * repulsionStrength;
                    let fy = dy * repulsionStrength;

                    nodeB.vx += fx;
                    nodeB.vy += fy;
                    nodeA.vx -= fx;
                    nodeA.vy -= fy;
                }
            }
        }
    }

    // Only apply central nodes repulsion when currentDepth > 2
    if (currentDepth > 2) {
        simulation.on("tick", () => {
            centralNodesRepulsion();
            ticked();
        });
    } else {
        simulation.on("tick", ticked);
    }

    // // Compute maximum closeness centrality
    // const maxCloseness = d3.max(visibleNodes, n => n.closeness_centrality);
    // const closenessScale = d3.scaleLinear()
    //     .domain([0, maxCloseness])
    //     .range([1, 5]); // Adjust the range as needed

    // // Continue with setting up other forces
    // simulation
    //     .force("charge", d3.forceManyBody()
    //         .strength(d => {
    //             const baseStrength = -50;
    //             return baseStrength * closenessScale(d.closeness_centrality);
    //         })
    //     )
    //     .force("center", null)
    //     .force("y", d3.forceY(centerY)
    //         .strength(0.1))
    //     .force("x", d3.forceX(centerX)
    //         .strength(0.01))
        
        if(centralNodes.includes(activeNodeId)){
            simulation
                .force("link", d3.forceLink(visibleLinks)
                .id(d => d.id)
                .distance(linkDistance)
                .strength(1))

                .force("collide", d3.forceCollide()
                .strength(0.05)
                .radius(200));
        }
        if(!centralNodes.includes(activeNodeId)){
            simulation
                .force("link", d3.forceLink(visibleLinks)
                .id(d => d.id)
                .distance(linkDistance = 0)
                .strength(.1))

                .force("collide", d3.forceCollide()
                .strength(0.05)
                .radius(10));
        }
}

/****************************************************
 * SETTING UP FORCES BASED ON GRAPH LAYOUT (GRAPH) *
 * **************************************************/
function setGraphForces() {
    //console.log(`setGraphForces Link Distance: ${linkDistance}`);
    simulation
    .force("link", d3.forceLink(visibleLinks)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(1))
        .force("charge", d3.forceManyBody()
            .strength(d => d.id === activeNodeId ? -300 : -50) // Stronger repulsion for the active node
        )
        .force("center", d3.forceCenter(centerX, centerY))
        .force("collide", d3.forceCollide() // Prevent node overlap
            .radius(25) // Minimum distance between nodes
            .strength(1)); // Increase strength for stronger collision enforcement
}

/*********************************************
* UPDATE NODE POSITIONS BASED ON ACTIVE NODE *
**********************************************/
function updateNodePositions() {
    // Fix the active node at the center
    visibleNodes.forEach(n => {
        if (n.id === activeNodeId) {
            n.fx = centerX;
            n.fy = centerY;
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
function renderGraph() {
    //console.log(`(${++call}) renderGraph`);
    // Update links
    link = graph.select(".links")
        .selectAll("line")
        .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);

    link.exit().remove();

    var linkEnter = link.enter().append("line")
        .attr("stroke-width", 0.75)
        .attr("stroke", lineClr);

    link = linkEnter.merge(link);

    // Update nodes
    node = graph.select(".nodes").selectAll("g")
        .data(visibleNodes, d => d.id);

    node.exit().remove();

    var nodeEnter = node.enter().append("g")
        .call(drag(simulation)); // Apply the drag behavior here using the drag function

    // Append circles with radius based on degree centrality
    nodeEnter.append("circle")
        .attr("r", 5) // Increased radius for active node
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", handleNodeClick);

    // Append text element
    nodeEnter.append("text")
        .attr("dx", "0ex")
        .attr("dy", "-1.5ex")
        .text(d => d.id);

    node = nodeEnter.merge(node);
    node.select("text")
        .attr("stroke-width", 0)
        .attr("font-size", ".8em");

    

    // Update force simulation
    simulation.nodes(visibleNodes);
    simulation.force("link", d3.forceLink(visibleLinks)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(1)
    );

    // // Adjust charge force based on closeness centrality
    // const maxCloseness = d3.max(visibleNodes, n => n.closeness_centrality);
    // const closenessScale = d3.scaleLinear()
    //     .domain([0, maxCloseness])
    //     .range([1, 5]); // Adjust the range as needed

    // simulation.force("charge", d3.forceManyBody()
    //     .strength(d => {
    //         const baseStrength = -50;
    //         return baseStrength * closenessScale(d.closeness_centrality);
    //     })
    // );

    simulation.force("center", null);

    // Remove positional forces
    simulation.force("x", null);
    simulation.force("y", null);

    // Always apply collision force to prevent overlap
    simulation.force("collide", d3.forceCollide()
        .radius(25)
        .strength(1)
    );

    // Adjust clustering force
    simulation.force("cluster", clusteringForce());
    simulation.alpha(0.3).restart();
}

/********************************************************************
* CUSTOM CLUSTERING FORCE TO ATTRACT NODES TO THEIR CLUSTER CENTERS *
*********************************************************************/
function clusteringForce() {
    //console.log(`(${++call}) clusteringForce`);
    // Create an array of unique node types, excluding the active node type
    var types = [...new Set(graphData.nodes
        .filter(node => node.id !== activeNodeId)
        .map(node => node.type))];

    // Set up the structure for positioning cluster centers
    var clusterCenters = {};
    var numTypes = types.length;
    var clusterRadius = Math.min(width, height);

    // Calculate position for each cluster type's center
    types.forEach((type, index) => {
        if (type === nodeById.get(activeNodeId).type) {
            return;
        }

        var angle = (index / numTypes) * 2 * Math.PI;
        clusterCenters[type] = {
            x: centerX + clusterRadius * Math.cos(angle),
            y: centerY + clusterRadius * Math.sin(angle)
        };
    });

    // Return the force function
    return function(alpha) {
        visibleNodes.forEach(function(d) {
            // Include 'is_multi_dependent' nodes when depth < 3 or if the node is the active node
            if ((currentDepth < 3 || d.id === activeNodeId) || !d.is_multi_dependent) {
                var cluster = clusterCenters[d.type];
                if (cluster) {
                    var clusterStrength = 0.1;
                    // Optionally adjust cluster strength based on centrality
                    const betweennessScale = d3.scaleLinear()
                        .domain([0, d3.max(visibleNodes, n => n.betweenness_centrality)])
                        .range([1, 0.5]);

                    var adjustedStrength = clusterStrength * betweennessScale(d.betweenness_centrality);

                    d.vx -= (d.x - cluster.x) * alpha * adjustedStrength;
                    d.vy -= (d.y - cluster.y) * alpha * adjustedStrength;
                }
            }
        });
    };
}

/**********************************************
* UPDATE right-pane WITH NODE ATTRIBUTES *
***********************************************/
function updateRightContainer() {
    ////console.log(`(${++call}) updateRightContainer`);
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
        );
    });

    // Group children by type
    var types = d3.group(immediateChildren, d => d.type);

    // Define the desired display order
    var orderedTypes = ["Home", "People", "Technology"];

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

    node.attr("transform", d => {
        if (isNaN(d.x) || isNaN(d.y)) {
            d.x = centerX;
            d.y = centerY;
        }
        // Include 'is_multi_dependent' nodes when depth < 3 or if the node is the active node
        if ((currentDepth < 3 || d.id === activeNodeId) || !d.is_multi_dependent) {
            d.x = Math.max(0, Math.min(width, d.x));
            d.y = Math.max(0, Math.min(height, d.y));
        }
        return `translate(${d.x},${d.y})`;
    });
}

/*******************************************************
* NODE CLICK EVENT HANDLERS FOR ACTIVE NODE MANAGEMENT *
********************************************************/
function handleNodeClick(event, d) {
    nodeClicked = true;
    call = 0;
    ////console.log(`(${++call}) handleNodeClick`);
    if (d.id === activeNodeId) return;  // Do nothing if the clicked node is already active

    activeNodeId = d.id;  // Update active node ID
    // ////console.log("Active Node:", activeNodeId);

    var depth = parseInt(onDepthSlider.value);  // Get current depth from slider
    visibleNodes = [];  // Clear visible nodes
    visibleLinks = [];  // Clear visible links

    // Expand nodes based on new active node and depth
    expandNodeByDepth(d, depth); 
    simulation
        .force("cluster", clusteringForce())
    // Center the active node
    updateNodePositions();
    renderGraph();
    updateRightContainer();  // Update info pane
}

/******************************************
* FUNCTIONS FOR CONTROLS AND INTERACTIONS *
*******************************************/
function resetToInitialState() {
    //console.log(`(${++call}) resetToInitialState`);
    call = 0;
    const targetValue = 2; // The initial depth value
    const maxValue = onDepthSlider.max; // Get the maximum value from the slider

    // Reset the slider's value and update the display
    onDepthSlider.value = targetValue;
    depthValueLabel.textContent = targetValue;

    // Update the slider's visual representation
    const percentage = (targetValue - onDepthSlider.min) / (maxValue - onDepthSlider.min) * 100;
    onDepthSlider.style.setProperty('--value', `${percentage}%`);

    // Reset activeNodeId to the initial node
    activeNodeId = graphData.nodes[0].id;

    // Reset linkDistance to its initial value
    linkDistance = 175;

    // **Reset node positions and fixings**
    graphData.nodes.forEach(node => {
        node.fx = null;
        node.fy = null;
        node.x = null;
        node.y = null;
    });

    // **Reinitialize the simulation forces to their initial state**
    simulation.alpha(1).restart(); // Reset the simulation's alpha for a fresh start

    // **Re-render the graph with initial settings**
    renderActiveNodeGraph(targetValue, activeNodeId);
}


/*************************
* FUNCTIONS FOR CONTROLS *
**************************/
function searchNode(nodeId) {
    call = 0;
    ////console.log(`(${++call}) searchNode`);
    if (nodeById.has(nodeId)) {
        var node = nodeById.get(nodeId); // Get the node object
        handleNodeClick(null, node); // Trigger the same logic as a click
    } else {
        alert("Node not found!");
    }
}


/*****************************************************
* DRAG FUNCTIONS TO ENABLE INTERACTIVE NODE MOVEMENT *
******************************************************/
const drag = simulation => {
    function dragstarted(event, d) {
        // ////console.log(centralNodes);
        // Fix all nodes at their current positions
        visibleNodes.forEach(node => {
            if(centralNodes.includes(activeNodeId)){
                ////console.log("Center Node");
                d.fx = null; // Unfix x position, allowing the simulation to adjust it
                d.fy = null; // Unfix y position, allowing the simulation to adjust it
            }else{
                d.fx = d.x; // Fix the node's x position at the cursor's x-coordinate
                d.fy = d.y; // Fix the node's y position at the cursor's y-coordinate
            }
        });
        // Lower the simulation’s influence but keep it running
        simulation.alphaTarget(0.1).restart();
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        // Fix the dragged node in its final position
        d.fx = d.x;
        d.fy = d.y;

        // Restore the simulation’s alpha target to allow natural settling afterward
        simulation.alphaTarget(0);
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
};