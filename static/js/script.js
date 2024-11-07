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
var searchInput = document.getElementById('searchInput');
var searchButton = document.getElementById('searchButton');
var homeButton = document.getElementById('homeButton');
var refreshButton = document.getElementById('refreshButton');
var depthSlider = document.getElementById('depthSlider');
let currentDepth = 2;  // Initialize with default depth
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

/******************************************
* FUNCTIONS FOR CONTROLS AND INTERACTIONS *
*******************************************/
function resetToInitialState() {
    const targetValue = 2; // The value you always want to set
    const maxValue = depthSlider.max; // Get the current maximum value from the slider

    // Set the slider's value to the target value
    depthSlider.value = targetValue;
    depthValueDisplay.textContent = targetValue;

    // Calculate the percentage position based on the target and maximum values
    const percentage = (targetValue - depthSlider.min) / (maxValue - depthSlider.min) * 100;

    // Update the custom CSS property to reflect the calculated percentage
    depthSlider.style.setProperty('--value', `${percentage}%`);

    // Reset graph to the home node with depth 1
    resetGraph(targetValue, activeNodeId = graphData.nodes[0].id);
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

/*******************************
* EVENT LISTENERS FOR CONTROLS *
********************************/
// Modify the home button event listener to use the current slider depth
homeButton.addEventListener('click', () => {
    resetToInitialState();  
});

refreshButton.addEventListener('click', () => {
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
    resetGraph(parseInt(depthSlider.value), activeNodeId);
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
    .scaleExtent([0.5, 2.5])
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
    console.log("Graph data fetched successfully:", graphData);

    console.log("Home Node", graphData.nodes[0].id);
    activeNodeId = graphData.nodes[0].id;
    
    assignColors(graphData);
    renderGraph(graphData);
}

/*************************************************
 * ASSIGNING COLORS TO NODES BASED ON THEIR TYPE *
 *************************************************/
function assignColors(data) {
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
function renderGraph(data) {
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
    link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);

    // Create node elements
    node = g.append("g")
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
        .on("click", nodeClicked);

    // Append text to each node
    node.append("text")
        .text(d => d.id);

    // Initialize the force simulation with visible nodes
    simulation = d3.forceSimulation(visibleNodes)
        // .force("link", d3.forceLink(visibleLinks).id(d => d.id).distance(75).strength(.5))
        // //.force("charge", d3.forceManyBody().strength(-50))
        // .force("collide", d3.forceCollide()
        //     .radius(25)                         // Minimum separation distance
        //     .strength(.5))                    // Strength of collision force
        // .force("cluster", clusteringForce())    // Custom clustering force
        .on("tick", ticked);                    // Event listener for each tick

    // Set initial depth from slider and render graph layout
    resetGraph(parseInt(depthSlider.value));
}

/********************************************************************
 * CUSTOM CLUSTERING FORCE TO ATTRACT NODES TO THEIR CLUSTER CENTERS *
 *********************************************************************/
function clusteringForce() {
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
        // Skip creating a cluster center for the type of the active node
        if (type === nodeById.get(activeNodeId).type) {
            console.log("Skipping cluster center for active node type:", type);
            return;
        }
    
        var angle = (index / numTypes) * 2 * Math.PI;
        // console.log("Cluster center for type", type);
        clusterCenters[type] = {
            x: width / 2 + clusterRadius * Math.cos(angle),
            y: height / 2 + clusterRadius * Math.sin(angle)
        };
    });    

    // Return the force function
    return function(alpha) {
        visibleNodes.forEach(function(d) {
            if (d.is_multi_dependent) return;  // Skip multi_dependents nodes

            var cluster = clusterCenters[d.type];
            if (cluster) {
                var clusterStrength = 0.1;
                d.vx -= (d.x - cluster.x) * alpha * clusterStrength;
                d.vy -= (d.y - cluster.y) * alpha * clusterStrength;
            }
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
    simulation
        .force("cluster", clusteringForce())
    // Center the active node
    updateNodePositions();
    updateGraph();
    updateRightContainer();  // Update info pane
}

/**************************************
 * EXPAND NODES BASED ON SEARCH INPUT *
 * ************************************/
function expandNode(node) {
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

/****************************************
* Unified logic for resetting the graph *
*****************************************/
function resetGraph(depth = parseInt(depthSlider.value), nodeId = activeNodeId) {
    currentDepth = depth;
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
        .force("link", d3.forceLink(visibleLinks).id(d => d.id).distance(75).strength(.5))
        .force("charge", d3.forceManyBody().strength(-50))
        .force("center", null) // Remove centering force for tree layout
        .force("y", d3.forceY(height / 2)   // Pull nodes downwards for tree hierarchy
            .strength(.5))
        .force("x", d3.forceX(width / 2)   // Center nodes horizontally
            .strength(.01));
}

function setGraphForces() {
    simulation
        .force("link", d3.forceLink(visibleLinks).id(d => d.id).distance(75).strength(.5))
        .force("charge", d3.forceManyBody()
            .strength(d => d.id === activeNodeId ? -300 : -50) // Stronger repulsion for the active node
        )
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide()
            .radius(25) // Minimum distance between nodes
            .strength(.5)); // Increase strength for stronger collision enforcement
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
        .attr("r", 5) // Increased radius for active node
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", nodeClicked);

    // Append text element
    nodeEnter.append("text")
        .attr("dx", "0ex")
        .attr("dy", "-1.5ex") // Default positioning for non-active nodes
        .text(d => d.id);

    node = nodeEnter.merge(node);
    node.select("text")
        .attr("stroke-width", 0) // Outline text for active node
        .attr("font-size", .8 + "em"); // Ensure active node has larger font size

    // Restart the simulation
    simulation.nodes(visibleNodes);

    // Modify link force to exclude multi_dependents nodes
    simulation.force("link", d3.forceLink(visibleLinks)
        .id(d => d.id)
        .distance(75)
        .strength(link => 
            (link.source.is_multi_dependent || link.target.is_multi_dependent) ? 0.1 : 0.5
        )
    );


    // Modify other forces to exclude multi_dependents nodes
    simulation.force("charge", d3.forceManyBody()
        .strength(d => (d.is_multi_dependent ? -10 : -50))
    );

    simulation.force("collide", d3.forceCollide()
        .radius(d => d.is_multi_dependent ? 5 : 25)
        .strength(0.5)
    );

    // Remove clustering force from multi_dependents nodes
    simulation.force("cluster", clusteringForce());

    // Restart the simulation
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
let initialPositionsSaved = false;

function ticked() {
    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node.attr("transform", d => {
        if (isNaN(d.x) || isNaN(d.y)) {
            d.x = width / 2;
            d.y = height / 2;
        }
        if (!d.is_multi_dependent) {
            d.x = Math.max(0, Math.min(width, d.x));
            d.y = Math.max(0, Math.min(height, d.y));
        }
        return `translate(${d.x},${d.y})`;
    });
}

/*****************************************************
* DRAG FUNCTIONS TO ENABLE INTERACTIVE NODE MOVEMENT *
******************************************************/
// const drag = simulation => {
//     function dragstarted(event, d) {
//         if (d.is_multi_dependent) return;
//         // When drag starts, fix the current position of all nodes to prevent them from moving
//         visibleNodes.forEach(node => {
//             if (!node.fx || !node.fy) {
//                 node.fx = node.x;
//                 node.fy = node.y;
//             }
//         });

//         if (!event.active) simulation.alphaTarget(0.3).restart();
//         d.fx = d.x;
//         d.fy = d.y;
//     }

//     function dragged(event, d) {
//         if (d.is_multi_dependent) {
//             d.x = event.x;
//             d.y = event.y;
//         } else {
//             d.fx = event.x;
//             d.fy = event.y;
//         }
//     }

//     function dragended(event, d) {
//         if (d.is_multi_dependent) return;
//         if (!event.active) simulation.alphaTarget(0);

//         // Leave the dragged node fixed in its new position
//         d.fx = d.x;
//         d.fy = d.y;
//     }

//     return d3.drag()
//         .on("start", dragstarted)
//         .on("drag", dragged)
//         .on("end", dragended);
// };

const drag = simulation => {
    function dragstarted(event, d) {
        if (d.is_multi_dependent) return;
        // When drag starts, fix the current position of all nodes to prevent them from moving
        visibleNodes.forEach(node => {
            if (!node.fx || !node.fy) {
                node.fx = node.x;
                node.fy = node.y;
            }
        });

        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        if (d.is_multi_dependent) {
            d.x = event.x;
            d.y = event.y;
        } else {
            d.fx = event.x;
            d.fy = event.y;
        }
    }

    function dragended(event, d) {
        if (d.is_multi_dependent) return;
        if (!event.active) simulation.alphaTarget(0);

        // Leave the dragged node fixed in its new position
        d.fx = d.x;
        d.fy = d.y;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
};


