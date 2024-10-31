/*******************************************
 * VARIABLE DECLARATIONS AND INITIAL SETUP *
 *******************************************/
// Access CSS variables from the :root element
var rootStyles = getComputedStyle(document.documentElement);
// Retrieve the values of the variables
var homeNodeClr = rootStyles.getPropertyValue('--home-nde-clr').trim();
var appNodeClr = rootStyles.getPropertyValue('--app-nde-clr').trim();
var pplNodeClr = rootStyles.getPropertyValue('--ppl-nde-clr').trim();
var techNodeClr = rootStyles.getPropertyValue('--tech-nde-clr').trim();
var dataNodeClr = rootStyles.getPropertyValue('--data-nde-clr').trim();
var procureNodeClr = rootStyles.getPropertyValue('--procure-nde-clr').trim();
var fcltyNodeClr = rootStyles.getPropertyValue('--fclty-nde-clr').trim();
var textClr = rootStyles.getPropertyValue('--text-clr').trim();
var lineClr = rootStyles.getPropertyValue('--bdr-clr').trim();
// Define color mapping for different types of nodes
var typeColorMap = new Map([
    ['Home', homeNodeClr],   
    ['Applications', appNodeClr], 
    ['People', pplNodeClr],           
    ['Technology', techNodeClr],  
    ['Data', dataNodeClr], 
    ['Procurements', procureNodeClr],
    ['Facilities', fcltyNodeClr] 
]);

// Stores the home node of the graph
let homeNode;
// Variable to store the ID of the currently active/selected node
let activeNodeId;
// Select the main SVG element where the graph will be rendered using D3
var svg = d3.select("svg");
// Select the tooltip element that will show node information on hover
// var tooltip = d3.select("#tooltip");
// Select the container that will show detailed information about selected nodes
var rightContainer = d3.select(".right-pane");
// Get references to UI control elements
var searchInput = document.getElementById('searchInput');    // Input field for node search
var searchButton = document.getElementById('searchButton');  // Button to trigger search
var homeButton = document.getElementById('homeButton');      // Button to return to home view
var depthSlider = document.getElementById('depthSlider');   // Slider to control graph depth
var depthValueDisplay = document.getElementById('depthValue'); // Display current depth value
// Get the actual dimensions of the SVG container
var svgElement = svg.node();
let width = svgElement.getBoundingClientRect().width;   // Get actual width of SVG
let height = svgElement.getBoundingClientRect().height; // Get actual height of SVG
// Create a group element to contain all graph elements (nodes and links)
var g = svg.append("g");
// Map to store colors for each node, indexed by node ID
var nodeColorMap = new Map();
// Declare main graph variables to be accessible throughout the application
let simulation;  // Force simulation that positions nodes
let graphData;   // The complete graph data structure
let nodeById;    // Map to quickly look up nodes by their ID
let visibleNodes = []; // Array of currently visible nodes
let visibleLinks = []; // Array of currently visible links
let node;  // D3 selection of node elements
let link;  // D3 selection of link elements

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

/**********************************
 * ADD ZOOM AND PAN FUNCTIONALITY *
 **********************************/
// Create a D3 zoom behavior object
var zoom = d3.zoom()
    // Set zoom limits: 0.5 = 50% zoomed out, 1.5 = 150% zoomed in
    .scaleExtent([0.5, 1.5])
    // Event handler for zoom/pan actions that transforms the graph container
    .on('zoom', (event) => {
        g.attr('transform', event.transform);
    });

// Apply the zoom behavior to the SVG element
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

    console.log("Home Node:", homeNode);
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
        if (node.id === homeNode) {
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
//  *************************************/
function renderGraph(data) {
    // Create a map for quick node lookups by ID
    nodeById = new Map(data.nodes.map(node => [node.id, node]));

    // Convert string IDs to actual node objects in the links array
    data.links.forEach(link => {
        if (typeof link.source === 'string') {
            link.source = nodeById.get(link.source);
        }
        if (typeof link.target === 'string') {
            link.target = nodeById.get(link.target);
        }
    });

    // Clear the arrays that track visible elements
    visibleNodes = [];
    visibleLinks = [];

    // Assign the initial nodes and links for rendering
    // expandNodeByDepth(nodeById.get(homeNode), parseInt(depthSlider.value));

    // Create container for link elements
    link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);

    // Create container for node elements
    node = g.append("g")
        .attr("class", "nodes")
        .style("stroke", textClr)
        .style("text-anchor", "middle")
        .selectAll("g")
        .data(visibleNodes, d => d.id)
        .enter()
        .append("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        );

    node.append("text")
        .attr("dx", "0ex")
        .attr("dy", "-1.5ex")
        .attr("stroke-width", 0)
        .text(d => d.id);

    // Initialize the force simulation with nodes and links
    simulation = d3.forceSimulation(visibleNodes)
        .force("link", d3.forceLink(visibleLinks)
            .id(d => d.id)
            .distance(120)
            .strength(0.1))
        .force("charge", d3.forceManyBody()
            .strength(-200)
            .distanceMax(100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide()
            .radius(10)
            .strength(2))
        // Control simulation cooling rate
        .alphaDecay(0.01)
        .force("clusterCollide", clusterCollideForce(10))
        .force("cluster", clusteringForce())
        .on("tick", ticked);

    // Start the simulation to ensure proper node positioning before rendering links
    // simulation.alpha(0.3).restart();
    resetGraph(parseInt(depthSlider.value));
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
        .attr("stroke-width", 0.6)
        .attr("stroke", lineClr);

    link = linkEnter.merge(link);

    // Update nodes
    node = g.select(".nodes").selectAll("g")
        .data(visibleNodes, d => d.id);

    node.exit().remove();

    var nodeEnter = node.enter().append("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    nodeEnter.append("circle")
        .attr("r", d => (d.id === activeNodeId ? 7 : 5)) // Set active node radius to 6.5
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", nodeClicked);

    nodeEnter.append("text")
        .attr("dx", "0ex")
        .attr("dy", "-1.5ex")
        .attr("stroke-width", 0) // Stroke width for text outline
        .text(d => d.id);

    node = nodeEnter.merge(node);

    // Update the radius for existing nodes based on whether they are active
    node.select("circle")
        .attr("r", d => (d.id === activeNodeId ? 7 : 5)); // Update the radius for all nodes based on activeNodeId

    // Restart the simulation
    simulation.nodes(visibleNodes);
    simulation.force("link")
        .links(visibleLinks);
    simulation.alpha(0.3).restart();
}


/********************************************************************
* CUSTOM CLUSTERING FORCE TO ATTRACT NODES TO THEIR CLUSTER CENTERS *
*********************************************************************/
function clusteringForce() {
    // Create an array of unique node types, excluding the home node type
    var types = [...new Set(graphData.nodes
        .filter(node => node.id !== homeNode)
        .map(node => node.type))];

    // Set up the structure for positioning cluster centers
    var clusterCenters = {};
    var numTypes = types.length;
    var clusterRadius = Math.min(width, height); // Reduced radius for better separation

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
            if (d.id !== activeNodeId && d.id !== homeNode) {
                var cluster = clusterCenters[d.type];
                
                // Soften the clustering effect to allow other forces to influence node position
                var clusterStrength = 0.02; // Reduced strength to balance with other forces
                d.vx -= (d.x - cluster.x) * alpha * clusterStrength;
                d.vy -= (d.y - cluster.y) * alpha * clusterStrength;
            }
        });
    };
}

/*************************************************
* CUSTOM FORCE TO REPEL CLUSTERS FROM EACH OTHER *
**************************************************/
function clusterCollideForce() {
    var padding = 50;  // Minimum pixels between cluster centers

    // Same type extraction as in clusteringForce()
    var types = [...new Set(graphData.nodes
        .filter(node => node.id !== homeNode)
        .map(node => node.type))];

    // Same cluster center calculation as in clusteringForce()
    var clusterCenters = {};
    var numTypes = types.length;
    var clusterRadius = Math.min(width, height) / 2;

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
                    let moveX = dx / distance * (minDistance - distance) / 2;
                    let moveY = dy / distance * (minDistance - distance) / 2;

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

            if (otherNode && !visibleNodes.includes(otherNode)) {
                visibleNodes.push(otherNode);
            }
        }
    });
}

/****************************************************************
* SIMULATION TICK FUNCTION: UPDATE POSITIONS OF NODES AND LINKS *
*****************************************************************/
function ticked() {
    node.attr("transform", d => {
        d.x = Math.max(0, Math.min(width, d.x)); // Ensure nodes stay within width
        d.y = Math.max(0, Math.min(height, d.y)); // Ensure nodes stay within height
        return `translate(${d.x},${d.y})`;
    });

    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
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


/**********************************************
* UPDATE right-pane WITH NODE ATTRIBUTES *
***********************************************/
function updateRightContainer() {
    // Clear the existing content
    rightContainer.html("");

    // Get the active node object
    var activeNode = nodeById.get(activeNodeId);

    // Display the active node's ID at the top
    rightContainer.append("h2").text(`${activeNode.id}`);

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
        ) && n.id !== activeNodeId && n.id !== homeNode;
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
                var nodeDescription = node.description || 'No description available';
                var nodeName = node.id;
                rightContainer.append("p")
                    .attr("class", "dependency-node")
                    .html(`${nodeName}`);
            });
        }
    });

    // Display remaining types (excluding "People" and "Technology")
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
    console.log("Depth slider value in depthSlider:", depth);
    depthValueDisplay.textContent = depth;
    resetGraph(depth, activeNodeId);
});

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

// Reset the graph to the initial state as when the app loads
function resetToInitialState() {
    // Set the depth slider to its initial value
    depthSlider.value = 1;
    depthValueDisplay.textContent = 1;

    // Reset graph to the home node with depth 1
    resetGraph(1, homeNode);
}

// Unified logic for resetting the graph
function resetGraph(depth = parseInt(depthSlider.value), nodeId = homeNode) {
    console.log("Depth slider value:", depth);
    activeNodeId = nodeId;
    visibleNodes = [];
    visibleLinks = [];

    var nodeObj = nodeById.get(nodeId);
    expandNodeByDepth(nodeObj, depth);

    updateNodePositions();
    updateGraph();
    updateRightContainer();
}

/******************************
* EXPAND ACTIVE NODE BY DEPTH *
*******************************/
function expandNodeByDepth(node, depth, currentDepth = 1) {
    console.log("Expanding node:", node.id, "Depth:", currentDepth);
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

/************************************************
* RESPONSIVENESS: CENTER GRAPH ON WINDOW RESIZE *
*************************************************/
window.addEventListener("resize", () => {
    // Get the actual dimensions of the SVG element
    var svgElement = svg.node();
    width = svgElement.getBoundingClientRect().width;
    height = svgElement.getBoundingClientRect().height;

    // Update the SVG size
    svg.attr("width", width).attr("height", height);

    // Update the force center to keep the graph centered
    simulation.force("center", d3.forceCenter(width / 2, height / 2));

    updateNodePositions();

    simulation.alpha(0.3).restart(); // Restart simulation for smooth transition
});

/************************************************
* TOOLTIP FUNCTIONS TO DISPLAY NODE INFORMATION *
*************************************************/
// function showTooltip(event, d) {
//     // Use the node's description if available
//     var description = d.description ? `${d.description}` : 'No description available';
//     tooltip.style("visibility", "visible").text(description);
// }

// function moveTooltip(event) {
//     tooltip.style("top", (event.pageY + 10) + "px")
//         .style("left", (event.pageX + 10) + "px");
// }

// function hideTooltip() {
//     tooltip.style("visibility", "hidden");
// }

/*****************************************************
* DRAG FUNCTIONS TO ENABLE INTERACTIVE NODE MOVEMENT *
******************************************************/
function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    if (event.subject.id !== activeNodeId) {
        event.subject.fx = null;
        event.subject.fy = null;
    }
}

/*****************************************************
 * INITIALIZING AND FETCHING GRAPH DATA ON PAGE LOAD *
 *****************************************************/

// Ensure the SVG element is fully loaded before starting
window.onload = function() {
    fetchGraphData().then(() => {
        resetGraph(2, homeNode);  // Set initial depth to 2
    });
};

