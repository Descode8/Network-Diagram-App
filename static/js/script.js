/***************************************************************
 * VARIABLE DECLARATIONS AND INITIAL SETUP
 ***************************************************************/
// Root node for the visualization; this is the main point from which other nodes connect
let rootNode;

// Select the <svg> element and the tooltip element using D3.js
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

// Get the actual dimensions of the SVG element
const svgElement = svg.node();
let width = svgElement.getBoundingClientRect().width;
let height = svgElement.getBoundingClientRect().height;

// Create a group <g> element where all the graph elements (nodes and links) will reside
// Apply a transform to this group when zooming and panning
const g = svg.append("g");

// A Map to store node colors by their ID for quick reference
const nodeColorMap = new Map();

// Declare the simulation outside to make it accessible across functions
let simulation;

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
    const graphData = await response.json();
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
function renderGraph(graphData) {

    /*****************************************************
    * CREATE A MAP TO REFERENCE NODE OBJECTS BY THEIR ID *
    ******************************************************/
    const nodeById = new Map(graphData.nodes.map(node => [node.id, node]));

    // Replace source and target IDs in links with actual node objects
    graphData.links.forEach(link => {
        link.source = nodeById.get(link.source);
        link.target = nodeById.get(link.target);
    });

    /***************************************************************
    * DYNAMICALLY ASSIGN CLUSTER CENTERS FOR NODE TYPES
    ***************************************************************/
    // Extract unique node types from the data (excluding the root node type)
    const types = [...new Set(graphData.nodes
        .filter(node => node.id !== rootNode)
        .map(node => node.type))];

    // Assign cluster centers to types, evenly spaced around a circle centered on the root node
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

    /***************************************************
    * CREATE LINKS BETWEEN NODES                       *
    * Links are represented as lines connecting nodes. *
    ****************************************************/
    const link = g.append("g") // Append group element for links
        .attr("class", "links")
        .selectAll("line") // Select all lines for links
        .data(graphData.links) // Bind link data to the elements
        .enter().append("line") // Append a line for each link
        .attr("stroke-width", 1) // Set the thickness of the link lines
        .attr("stroke", "#999"); // Set the line color

    /****************************************************
    * CREATE NODES AND ASSIGN CSS CLASSES BASED ON TYPE *
    * Each node consists of a circle and a text label.  *
    *****************************************************/
    const node = g.append("g") // Append group element for nodes
        .attr("class", "nodes")
        .selectAll("g") // Select all group elements for nodes
        .data(graphData.nodes) // Bind node data to the elements
        .enter().append("g") // Append a group for each node
        .call(d3.drag() // Enable dragging functionality on nodes
            .on("start", dragstarted) // Handle drag start event
            .on("drag", dragged) // Handle dragging event
            .on("end", dragended)); // Handle drag end event

    /**************************************************************************
    * APPEND CIRCLES FOR NODES                                                *
    * Circles visually represent each node, filled with colors based on type. *
    ***************************************************************************/
    node.append("circle") // Append a circle for each node
        .attr("r", d => {
            if (d.id === rootNode) return 5; // Root node is larger
            return 3; // Other nodes have a standard size
        })
        .attr("fill", d => nodeColorMap.get(d.id)) // Set circle color based on node ID
        .on("mouseover", (event, d) => showTooltip(event, d)) // Show tooltip on hover
        .on("mousemove", moveTooltip) // Move tooltip with mouse
        .on("mouseout", hideTooltip); // Hide tooltip when mouse leaves

    /************************************
    * APPEND TEXT LABELS FOR NODES      *
    * Text labels display the node IDs. *
    *************************************/
    node.append("text")
        .attr("dx", "1ex") // Slightly offset for child nodes
        .attr("dy", ".5ex") // Adjust vertical alignment
        .text(d => d.id) // Display the node ID
        .attr("class", d => {
            // Assign 'root-node' if it's the root node, otherwise assign child class
            if (d.id === rootNode) return 'root-node';
            return 'child-node';
        });

    /*****************************************************************
    * INITIALIZE THE FORCE SIMULATION                                *
    * The simulation applies physics-like behavior to nodes, such as *
    * repelling or attracting forces and centering the graph.        *
    ******************************************************************/
    simulation = d3.forceSimulation(graphData.nodes)
        .force("link", d3.forceLink(graphData.links)
        .distance(d => {
            // Check if the source node's type is 'Application'
            if (d.source.type === 'Application') {
                return 200;
            } else {
                return 100;
            }
        })
            .strength(0.1))         // Link strength
        .force("charge", d3.forceManyBody()
            .strength(-300)       // Repulsion between nodes; more negative = stronger repulsion
            .distanceMax(200))   // Limit the distance over which nodes repel each other; nodes more than x val away will not repel
        .force("center", d3.forceCenter(width / 2.5, height / 2)) // Center the graph
        .force("collision", d3.forceCollide()
            .radius(10)          // Set collision radius to prevent overlapping
            .strength(-100))      // Adjust strength to smooth out interactions
        .force("cluster", clusteringForce()) // Custom clustering force
        .force("clusterCollide", clusterCollideForce(10)) // Custom force to repel clusters
        .alphaDecay(0.03)        // Control the cooling rate for smoother animation
        .on("tick", ticked);

        graphData.nodes.forEach(node => {
            if (node.type === 'root') {
                node.fx = width / 2;  // Lock x position to the center
                node.fy = 100;          // Lock y position to the top (50 pixels down)
            }
        });

    /********************************************************************
    * SIMULATION TICK FUNCTION: UPDATE POSITIONS OF NODES AND LINKS     *
    * This function runs on every tick of the simulation, ensuring that *
    * the positions of nodes and links are updated continuously.        *
    *********************************************************************/
    function ticked() {
        node
        .attr("transform", d => {
            d.x = Math.max(0, Math.min(width, d.x)); // Ensure nodes stay within width
            d.y = Math.max(0, Math.min(height, d.y)); // Ensure nodes stay within height
            return `translate(${d.x},${d.y})`;
        });
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    }

    /********************************************************************
    * CUSTOM CLUSTERING FORCE TO ATTRACT NODES TO THEIR CLUSTER CENTERS *
    *********************************************************************/
    function clusteringForce() {
        // Return a function that gets called on each simulation step
        return function(alpha) {
            graphData.nodes.forEach(function(d) {
                // Skip the root node itself
                if (d.id !== rootNode) {
                    // Determine the cluster center for this node based on its type
                    const cluster = clusterCenters[d.type];
    
                    // Check if the node is connected to a 'root'-type node through any link
                    const isRootChild = graphData.links.some(link => 
                        (link.target.id === d.id && link.source.type === 'root') ||
                        (link.source.id === d.id && link.target.type === 'root')
                    );
    
                    // Use different alpha scaling based on whether the node is connected to a 'root'-type node
                    const scalingFactor = isRootChild ? 0.01 : 0.1;
    
                    // Adjust the x and y velocities towards the cluster center
                    d.vx -= (d.x - cluster.x) * alpha * scalingFactor;
                    d.vy -= (d.y - cluster.y) * alpha * scalingFactor;
                }
            });
        };
    }
    

    /*************************************************
    * CUSTOM FORCE TO REPEL CLUSTERS FROM EACH OTHER *
    **************************************************/
    function clusterCollideForce() {
        const padding = 50; // Minimum distance between cluster centers
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

        // Recalculate cluster centers
        const clusterRadius = Math.min(width, height) / 3;
        types.forEach((type, index) => {
            const angle = (index / numTypes) * 2 * Math.PI;
            clusterCenters[type].x = width / 2 + clusterRadius * Math.cos(angle);
            clusterCenters[type].y = height / 2 + clusterRadius * Math.sin(angle);
        });

        simulation.alpha(0.3).restart(); // Restart simulation for smooth transition
    });
}

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
    if (!event.active) simulation.alphaTarget(0.3).restart(); // Restart simulation
    event.subject.fx = event.subject.x; // Fix x position
    event.subject.fy = event.subject.y; // Fix y position
}

function dragged(event) {
    event.subject.fx = event.x; // Set new x position
    event.subject.fy = event.y; // Set new y position
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0); // Stop the simulation after drag
    event.subject.fx = null; // Release fixed x position, allowing it to move freely
    event.subject.fy = null; // Release fixed y position, restoring natural movement
}

/*****************************************************
 * INITIALIZING AND FETCHING GRAPH DATA ON PAGE LOAD *
 *****************************************************/

// Ensure the SVG element is fully loaded before starting
window.onload = function() {
    // Calls `fetchGraphData` when the page loads to initialize the graph.
    // This will retrieve the graph data from the backend and render it in the SVG element.
    fetchGraphData(); // Start fetching and rendering the graph
};
