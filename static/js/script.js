/***************************************************************
 * VARIABLE DECLARATIONS AND INITIAL SETUP
 ***************************************************************/
let rootNode;

// Select the <svg> element and the tooltip element using D3.js
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

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
let activeNode; // Currently active node
let parentNodes = []; // Stack of parent nodes

/**********************************
 * ADD ZOOM AND PAN FUNCTIONALITY *
 **********************************/
const zoom = d3.zoom()
    .scaleExtent([0.8, 2]) // Set the minimum and maximum zoom scale
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
    // Extract unique node types from the data
    const types = [...new Set(data.nodes.map(node => node.type))];

    // Create a color scale with a unique color for each type
    const colorScale = d3.scaleOrdinal()
        .domain(types)
        .range(d3.schemeCategory10); // You can choose a different color scheme if you prefer

    // Assign colors to nodes based on their type
    data.nodes.forEach(node => {
        if (node.id === rootNode) {
            nodeColorMap.set(node.id, '#231f20');
        } else {
            const color = colorScale(node.type); // Get color from scale based on type
            nodeColorMap.set(node.id, color);
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

    // Identify the root node
    const rootNodeId = rootNode; // Assuming `rootNode` is defined globally
    const rootNodeObj = nodeById.get(rootNodeId);

    if (!rootNodeObj) {
        console.error("Root node not found in graph data");
        return;
    }

    // Set root node as active node
    rootNodeObj.isActive = true;
    activeNode = rootNodeObj;
    parentNodes = []; // No parent nodes at the beginning

    // Add root node to visible nodes
    visibleNodes.push(rootNodeObj);

    // Find immediate children of the root node
    const immediateLinks = data.links.filter(
        link => link.source.id === rootNodeId || link.target.id === rootNodeId
    );

    immediateLinks.forEach(link => {
        visibleLinks.push(link);

        // Get the child node connected to the root
        const childNode = link.source.id === rootNodeId ? link.target : link.source;

        if (childNode && !visibleNodes.includes(childNode)) {
            visibleNodes.push(childNode);
        }
    });

    // Proceed with creating the visualization using visibleNodes and visibleLinks

    /***************************************************
    * CREATE LINKS BETWEEN NODES                       *
    ****************************************************/
    link = g.append("g") // Append group element for links
        .attr("class", "links")
        .selectAll("line")
        .data(visibleLinks)
        .enter().append("line")
        .attr("stroke-width", 1)
        .attr("stroke", "#D8D8D8");

    /****************************************************
    * CREATE NODES AND ASSIGN CSS CLASSES BASED ON TYPE *
    *****************************************************/
    node = g.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(visibleNodes)
        .enter().append("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    /**************************************************************************
    * APPEND CIRCLES FOR NODES                                                *
    ***************************************************************************/
    node.append("circle")
        .attr("r", d => (d.id === rootNodeId ? 5: 3))
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", nodeClicked)
        .on("mouseover", (event, d) => showTooltip(event, d))
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    /************************************
    * APPEND TEXT LABELS FOR NODES      *
    *************************************/
    node.append("text")
        .attr("dx", d => (d.id === rootNodeId ? "1ex" : ".8ex"))
        .attr("dy", d => (d.id === rootNodeId ? "0.5ex" : ".3ex"))
        .text(d => d.id)
        .attr("class", d => (d.id === rootNodeId ? 'root-node' : 'child-node'));

    /*****************************************************************
    * INITIALIZE THE FORCE SIMULATION                                *
    ******************************************************************/
    simulation = d3.forceSimulation(visibleNodes)
        .force("link", d3.forceLink(visibleLinks)
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

    updateNodePositions();
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
            if (!d.isActive && !parentNodes.includes(d)) {
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
    const padding = 10; // Minimum distance between cluster centers

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
    if (d === activeNode) {
        return; // Do nothing if the clicked node is already active
    }

    // Update parentNodes stack
    if (!parentNodes.includes(activeNode)) {
        parentNodes.push(activeNode);
    }

    activeNode.isActive = false; // Mark previous active node as inactive
    d.isActive = true; // Mark clicked node as active
    activeNode = d; // Update active node

    // Expand new active node's immediate children
    expandNode(d);

    updateNodePositions();
    updateGraph();
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
        .attr("r", d => (d.id === rootNode ? 5 : 4))
        .attr("fill", d => nodeColorMap.get(d.id))
        .on("click", nodeClicked)
        .on("mouseover", (event, d) => showTooltip(event, d))
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    nodeEnter.append("text")
        .attr("dx", d => (d.id === rootNode ? "-1.5ex" : "1.5ex"))
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
        if (n.isActive) {
            n.fx = width / 2;
            n.fy = height / 2;
        } else if (parentNodes.includes(n)) {
            // Stack parent nodes at the top
            const index = parentNodes.indexOf(n);
            n.fx = width / 2;
            n.fy = 50 + index * 30; // Stack with some spacing
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
    if (!event.subject.isActive && !parentNodes.includes(event.subject)) {
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
