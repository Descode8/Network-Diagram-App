/***************************************************************
 * VARIABLE DECLARATIONS AND INITIAL SETUP
 ***************************************************************/
let rootNode;
let activeNodeId; // Variable to store the ID of the active node
let parentNodes = []; // Stack of parent nodes

// Select the <svg> element and the tooltip element using D3.js
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

// Select the right-container div
const rightContainer = d3.select(".right-container");

// Select the controls from the DOM
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const homeButton = document.getElementById('homeButton');
const depthSlider = document.getElementById('depthSlider');
const depthValueDisplay = document.getElementById('depthValue');

// Get the actual dimensions of the SVG element
const svgElement = svg.node();
let width = svgElement.getBoundingClientRect().width;
let height = svgElement.getBoundingClientRect().height;

// Create a group <g> element where all the graph elements (nodes and links) will reside
const g = svg.append("g");

// A Map to store node colors by their ID for quick reference
const nodeColorMap = new Map();

// Declare the simulation and other variables to make them accessible across functions
let simulation;
let graphData;
let nodeById;
let visibleNodes = [];
let visibleLinks = [];
let node; // Selection of nodes
let link; // Selection of links

/**********************************
 * ADD ZOOM AND PAN FUNCTIONALITY *
 **********************************/
const zoom = d3.zoom()
    .scaleExtent([0.5, 1.5]) // Set the minimum and maximum zoom scale
    .on('zoom', (event) => {
        g.attr('transform', event.transform);
    });

svg.call(zoom); // Attach zoom behavior to the SVG element

/**********************************
 * FETCHING DATA FROM THE BACKEND *
 **********************************/

async function fetchGraphData() {
    const response = await fetch("/", {
        headers: { "Accept": "application/json" } // Expecting JSON data from the server
    });

    // If the request fails, log an error and exit
    if (!response.ok) {
        console.error("Failed to fetch graph data:", response.statusText);
        return;
    }

    // Parse the response into JSON
    graphData = await response.json();
    rootNode = graphData.links[0].target;
    console.log("Root node:", rootNode);
    console.log("Graph data fetched successfully:", graphData);

    // Assign colors to the nodes
    assignColors(graphData);

    // Render the graph visualization
    renderGraph(graphData);
}

/*************************************************
 * ASSIGNING COLORS TO NODES BASED ON THEIR TYPE *
 *************************************************/
function assignColors(data) {
    // Map of node types to their specified colors
    const typeColorMap = new Map([
        ['Applications', '#000000'], // Root node
        ['Application', '#4F81BD'],
        ['Software', '#C0504D'],
        ['People', '#9BBB59'],
        ['Server', '#F79646'],
        ['Technology', '#7030A0']
    ]);

    // Assign colors to nodes based on their type
    data.nodes.forEach(node => {
        if (node.id === rootNode) {
            nodeColorMap.set(node.id, '#000000'); // Root node color
        } else {
            const color = typeColorMap.get(node.type);
            if (color) {
                nodeColorMap.set(node.id, color);
            } else {
                nodeColorMap.set(node.id, '#808080'); // Default color if type not specified
            }
        }
    });
}

/*******************************************************
 * HELPER FUNCTION TO CHECK IF A NODE IS A PARENT NODE *
 *******************************************************/
function isParentNode(node, graphData) {
    // A node is a parent if it is the source of at least one link
    return graphData.links.some(link => link.source.id === node.id);
}

/*************************************
 * RENDERING THE GRAPH VISUALIZATION *
 *************************************/
function renderGraph(data) {

    /*****************************************************
    * CREATE A MAP TO REFERENCE NODE OBJECTS BY THEIR ID *
    ******************************************************/
    nodeById = new Map(data.nodes.map(node => [node.id, node]));

    // Replace source and target IDs in links with actual node objects
    data.links.forEach(link => {
        if (typeof link.source === 'string') {
            link.source = nodeById.get(link.source);
        }
        if (typeof link.target === 'string') {
            link.target = nodeById.get(link.target);
        }
    });

    // Initialize visible nodes and links
    visibleNodes = [];
    visibleLinks = [];

    // Create initial selections for nodes and links
    link = g.append("g") // Append group element for links
        .attr("class", "links")
        .selectAll("line");

    node = g.append("g")
        .attr("class", "nodes")
        .selectAll("g");

    // Initialize the force simulation
    simulation = d3.forceSimulation()
        .force("link", d3.forceLink()
            .distance(d => {
                // Check if the source node's type is 'Application'
                if (d.source.type === 'Application') {
                    return 75;
                } else {
                    return 150;
                }
            })
            .strength(0.1))
        .force("charge", d3.forceManyBody()
            .strength(-100)
            .distanceMax(1000))
        .force("center", d3.forceCenter(width / 2.5, height / 2))
        .force("collision", d3.forceCollide()
            .radius(10)
            .strength(-100))
        .force("cluster", clusteringForce()) // Custom clustering force
        .force("clusterCollide", clusterCollideForce(10)) // Custom force to repel clusters
        .alphaDecay(0.03)
        .on("tick", ticked);

    // Initial render with default depth
    resetGraph(parseInt(depthSlider.value));
}

/********************************************************************
* CUSTOM CLUSTERING FORCE TO ATTRACT NODES TO THEIR CLUSTER CENTERS *
*********************************************************************/
function clusteringForce() {
    // Extract unique node types from the data (excluding the root node type)
    const types = [...new Set(graphData.nodes
        .filter(node => node.id !== rootNode)
        .map(node => node.type))];

    // Assign cluster centers to types, evenly spaced around a circle centered on the active node
    const clusterCenters = {};
    const numTypes = types.length;
    const clusterRadius = Math.min(width, height) / 3; // Radius of the circle for clusters

    types.forEach((type, index) => {
        const angle = (index / numTypes) * 2 * Math.PI;
        clusterCenters[type] = {
            x: width / 2 + clusterRadius * Math.cos(angle),
            y: height / 2 + clusterRadius * Math.sin(angle)
        };
    });

    // Return a function that gets called on each simulation step
    return function(alpha) {
        visibleNodes.forEach(function(d) {
            // Skip the active node and parent nodes
            if (d.id !== activeNodeId && !parentNodes.includes(d)) {
                // Determine the cluster center for this node based on its type
                const cluster = clusterCenters[d.type];

                // Adjust the x and y velocities towards the cluster center
                d.vx -= (d.x - cluster.x) * alpha * 0.1;
                d.vy -= (d.y - cluster.y) * alpha * 0.1;
            }
        });
    };
}

/*************************************************
* CUSTOM FORCE TO REPEL CLUSTERS FROM EACH OTHER *
**************************************************/
function clusterCollideForce() {
    const padding = 50; // Minimum distance between cluster centers

    // Extract unique node types from the data (excluding the root node type)
    const types = [...new Set(graphData.nodes
        .filter(node => node.id !== rootNode)
        .map(node => node.type))];

    // Assign cluster centers to types, evenly spaced around a circle centered on the active node
    const clusterCenters = {};
    const numTypes = types.length;
    const clusterRadius = Math.min(width, height) / 3; // Radius of the circle for clusters

    types.forEach((type, index) => {
        const angle = (index / numTypes) * 2 * Math.PI;
        clusterCenters[type] = {
            x: width / 2 + clusterRadius * Math.cos(angle),
            y: height / 2 + clusterRadius * Math.sin(angle)
        };
    });

    return function() {
        types.forEach((typeA, i) => {
            const clusterA = clusterCenters[typeA];
            types.slice(i + 1).forEach(typeB => {
                const clusterB = clusterCenters[typeB];
                let dx = clusterB.x - clusterA.x;
                let dy = clusterB.y - clusterA.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                let minDistance = padding;

                if (distance < minDistance) {
                    let moveX = dx / distance * (minDistance - distance) / 2;
                    let moveY = dy / distance * (minDistance - distance) / 2;

                    clusterA.x -= moveX;
                    clusterA.y -= moveY;
                    clusterB.x += moveX;
                    clusterB.y += moveY;
                }
            });
        });
    };
}

/*************************************************
* NODE CLICK EVENT HANDLERS FOR ACTIVE NODE MANAGEMENT *
**************************************************/
function nodeClicked(event, d) {
    if (d.id === activeNodeId) {
        return; // Do nothing if the clicked node is already active
    }

    // Update parentNodes stack
    const previousActiveNode = nodeById.get(activeNodeId);
    if (previousActiveNode && !parentNodes.includes(previousActiveNode)) {
        parentNodes.push(previousActiveNode);
    }

    activeNodeId = d.id; // Update active node ID

    // Expand new active node's immediate children
    expandNode(d);

    updateNodePositions();
    updateGraph();

    // Update the right-container with the new active node's attributes
    updateRightContainer();
}

function expandNode(node) {
    // Find immediate children of the node
    const newLinks = graphData.links.filter(
        link => (link.source.id === node.id || link.target.id === node.id)
    );

    newLinks.forEach(link => {
        // Ensure the link isn't already visible
        if (!visibleLinks.includes(link)) {
            visibleLinks.push(link);

            // Get the connected node
            const otherNode = link.source.id === node.id ? link.target : link.source;

            if (otherNode && !visibleNodes.includes(otherNode)) {
                visibleNodes.push(otherNode);
            }
        }
    });

    // Optionally, you can collapse previous active node's children here if desired
}

/**************************************
* UPDATE THE GRAPH AFTER NODE CHANGES *
***************************************/
function updateGraph() {
    // Update links
    link = g.select(".links").selectAll("line")
        .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);

    link.exit().remove();

    const linkEnter = link.enter().append("line")
        .attr("stroke-width", 1)
        .attr("stroke", "#D8D8D8");

    link = linkEnter.merge(link);

    // Update nodes
    node = g.select(".nodes").selectAll("g")
        .data(visibleNodes, d => d.id);

    node.exit().remove();

    const nodeEnter = node.enter().append("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    nodeEnter.append("circle")
        .attr("r", d => (d.id === rootNode ? 4 : 3))
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", nodeClicked)
        .on("mouseover", (event, d) => showTooltip(event, d))
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    nodeEnter.append("text")
        .attr("dx", "1ex")
        .attr("dy", ".5ex")
        .text(d => d.id)
        .attr("class", d => (d.id === rootNode ? 'root-node' : 'child-node'));

    node = nodeEnter.merge(node);

    // Restart the simulation
    simulation.nodes(visibleNodes);
    simulation.force("link").links(visibleLinks);
    simulation.alpha(0.3).restart();
}

/********************************************************************
* SIMULATION TICK FUNCTION: UPDATE POSITIONS OF NODES AND LINKS     *
*********************************************************************/
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

/************************************************
* UPDATE NODE POSITIONS BASED ON ACTIVE NODE    *
*************************************************/
function updateNodePositions() {
    // Fix the active node at the center
    visibleNodes.forEach(n => {
        if (n.id === activeNodeId) {
            n.fx = width / 2;
            n.fy = height / 2;
        } else if (parentNodes.includes(n)) {
            // Stack parent nodes at the top
            const index = parentNodes.indexOf(n);
            n.fx = width / 2;
            n.fy = 50 + index * 1; // Stack with some spacing
        } else {
            n.fx = null;
            n.fy = null;
        }
    });

    // Reinitialize the clustering force to recalculate cluster centers based on the active node
    simulation.force("cluster", clusteringForce());
    simulation.force("clusterCollide", clusterCollideForce());

    simulation.alpha(0.3).restart();
}

/************************************************
* UPDATE RIGHT-CONTAINER WITH NODE ATTRIBUTES   *
*************************************************/
function updateRightContainer() {
    // Clear the existing content
    rightContainer.html("");

    // Get the active node object
    const activeNode = nodeById.get(activeNodeId);

    // Display the active node's ID at the top
    rightContainer.append("h2").text(`${activeNode.id}`);

    // Display the active node's name
    // rightContainer.append("h3").text("Name:");

    // Display the active node's type
    rightContainer.append("p").html(`Type: <strong>${activeNode.type}</strong>`);

    // Display the active node's description
    const description = activeNode.description ? activeNode.description : 'No description available';
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
    const immediateChildren = visibleNodes.filter(n => {
        return visibleLinks.some(link =>
            (link.source.id === activeNodeId && link.target.id === n.id) ||
            (link.target.id === activeNodeId && link.source.id === n.id)
        ) && n.id !== activeNodeId && n.id !== rootNode && !parentNodes.includes(n);
    });

    // Group children by type
    const types = d3.group(immediateChildren, d => d.type);

    // Display each type and its nodes
    types.forEach((nodes, types) => {
        rightContainer.append("p").html(`Type: <strong>${types}</strong>`);
        nodes.forEach(node => {
            const nodeDescription = node.description ? node.description : 'No description available';
            rightContainer.append("p")
            .attr("class", "dependency-node")
            .html(`${node.id}`)
            .html(`${nodeDescription}`);
        });
    });
}

/************************************************
* EVENT LISTENERS FOR CONTROLS                 *
************************************************/

// Modify the home button event listener to reset to the initial state
homeButton.addEventListener('click', () => {
    resetToInitialState(); // Reset to the same state as the initial render
});

// Add event listener for the search button
searchButton.addEventListener('click', () => {
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        searchNode(searchTerm);
    }
});

// Add event listener for the depth slider
depthSlider.addEventListener('input', () => {
    const depth = parseInt(depthSlider.value);
    depthValueDisplay.textContent = depth;
    resetGraph(depth, activeNodeId); // Use the active node instead of root
});

/************************************************
* FUNCTIONS FOR CONTROLS                        *
*************************************************/
function searchNode(nodeId) {
    if (nodeById.has(nodeId)) {
        const node = nodeById.get(nodeId); // Get the node object
        nodeClicked(null, node); // Trigger the same logic as a click
    } else {
        alert("Node not found!");
    }
}

/************************************************
* FUNCTIONS FOR CONTROLS AND INTERACTIONS       *
************************************************/

// Reset the graph to the initial state as when the app loads
function resetToInitialState() {
    // Set the depth slider to its initial value
    depthSlider.value = 1;
    depthValueDisplay.textContent = 1;

    // Reset graph to the root node with depth 1
    resetGraph(1, rootNode);
}

// Unified logic for resetting the graph
function resetGraph(depth = parseInt(depthSlider.value), nodeId = rootNode) {
    activeNodeId = nodeId;
    parentNodes = [];
    visibleNodes = [];
    visibleLinks = [];

    const nodeObj = nodeById.get(nodeId);
    visibleNodes.push(nodeObj);
    expandNodeByDepth(nodeObj, depth);

    updateNodePositions();
    updateGraph();
    updateRightContainer();
}

function expandNodeByDepth(node, depth) {
    if (depth > 0) {
        // Find immediate children of the node
        const newLinks = graphData.links.filter(
            link => (link.source.id === node.id || link.target.id === node.id)
        );

        newLinks.forEach(link => {
            // Ensure the link isn't already visible
            if (!visibleLinks.includes(link)) {
                visibleLinks.push(link);

                // Get the connected node
                const otherNode = link.source.id === node.id ? link.target : link.source;

                if (otherNode && !visibleNodes.includes(otherNode)) {
                    visibleNodes.push(otherNode);
                    // Recursively expand the child node
                    expandNodeByDepth(otherNode, depth - 1);
                }
            }
        });
    }
}

/************************************************
* RESPONSIVENESS: CENTER GRAPH ON WINDOW RESIZE *
*************************************************/
window.addEventListener("resize", () => {
    // Get the actual dimensions of the SVG element
    const svgElement = svg.node();
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
function showTooltip(event, d) {
    // Use the node's description if available
    const description = d.description ? `${d.description}` : 'No description available';
    tooltip.style("visibility", "visible").text(description);
}

function moveTooltip(event) {
    tooltip.style("top", (event.pageY + 10) + "px")
        .style("left", (event.pageX + 10) + "px");
}

function hideTooltip() {
    tooltip.style("visibility", "hidden");
}

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
    if (event.subject.id !== activeNodeId && !parentNodes.includes(event.subject)) {
        event.subject.fx = null;
        event.subject.fy = null;
    }
}

/*****************************************************
 * INITIALIZING AND FETCHING GRAPH DATA ON PAGE LOAD *
 *****************************************************/

// Ensure the SVG element is fully loaded before starting
window.onload = function() {
    fetchGraphData();
};
