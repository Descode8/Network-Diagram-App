document.addEventListener('DOMContentLoaded', () => { 
    let width = document.querySelector('.graph-container').clientWidth;
    let height = document.querySelector('.graph-container').clientHeight;
    const svg = d3.select('.graph-container svg');
    const activeNodeSize = 7;
    const nodeSize = 5;
    const linkWidth = 1;
    const linkColor = '#85929E';
    const nodeBorderColor = 'black';

    let currentActiveNodeName = null; // Track the currently active node name
    let graphPadding = 75;  // Adjust padding as needed
    let visibleNodes = [];
    let isNodeClicked = false;

    const depthSlider = document.getElementById('depthSlider');
    const depthValueLabel = document.getElementById('depthValue');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    // Define zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5]) // Adjust min/max zoom as desired
        .on('zoom', (event) => {
            graphGroup.attr('transform', event.transform);
        });

    svg.call(zoom);

    function nodeColor(node) {
        const nodes = node.data.groupType || node.data.type; 
        switch (nodes) {
            case 'Applications': return 'var(--app-nde-clr)';
            case 'People': return 'var(--ppl-nde-clr)';
            case 'Technology': return 'var(--tech-nde-clr)';
            case 'Data': return 'var(--data-nde-clr)';
            case 'Procurements': return 'var(--procure-nde-clr)';
            case 'Facilities': return 'var(--fclty-nde-clr)';
            default: return 'var(--home-nde-clr)';
        }
    }    

    document.getElementById('groupNodeSwitch').addEventListener('change', () => {
        // Re-fetch and re-render graph to apply changes
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });    

    svg.attr('width', width).attr('height', height);

    const graphGroup = svg.append('g'); // Group to hold links and nodes

    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

    function fetchAndRenderGraph(depth = depthSlider.value, activeNodeParam = searchInput.value.trim()) {
        console.log('activeNodeParam:', activeNodeParam);
        const url = `/?depth=${depth}&activeNode=${encodeURIComponent(activeNodeParam)}`;
    
        fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Fetched data:', data);
                if (data.error) {
                    console.error('Backend error:', data.error);
                    return;
                }
                renderGraph(data);
            })
            .catch(error => {
                console.error('Error fetching graph data:', error);
            });
    }
    

    function renderGraph(data) {
        graphGroup.selectAll('*').remove();
    
        // Determine whether type nodes should be displayed
        const displayGroupNodes = document.getElementById('groupNodeSwitch') ? document.getElementById('groupNodeSwitch').checked : true;
    
        // Flatten type nodes if the toggle is off
        hideGroupNodes(data, displayGroupNodes);
    
        const root = d3.hierarchy(data);
        const links = root.links();
        const nodes = root.descendants();
    
        visibleNodes = nodes;
    
        simulation.nodes(nodes)
            .force("link", d3.forceLink(links).id(d => d.data.name).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));
    
        simulation.force("link").links(links);
    
        const link = graphGroup.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', linkColor)
            .attr('stroke-width', linkWidth);
    
        const node = graphGroup.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', d => d.data.name === data.name ? activeNodeSize : nodeSize)
            .attr('fill', d => nodeColor(d))
            .attr('stroke', nodeBorderColor)
            .call(drag(simulation));
    
        const labels = graphGroup.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('fill', 'black')
            .text(d => d.data.name);
    
        // Update current active node name
        currentActiveNodeName = data.name;
    
        // Center active node logic
        const foundActiveNode = nodes.find(node => node.data.name === data.name);
        if (foundActiveNode) {
            simulation.alpha(1).restart();
            foundActiveNode.fx = width / 2;
            foundActiveNode.fy = height / 2;
        }
    
        simulation.on('tick', () => ticked(link, node, labels));
    
        node.on('click', (event, d) => handleNodeClicked(d.data));
    
        // Ensure graph fits after rendering
        fitGraphToContainer();
    }
    

    function hideGroupNodes(node, displayGroupNodes) {
        if (!node.children || node.children.length === 0) {
            return node;
        }
    
        let flattenedChildren = [];
    
        node.children.forEach(child => {
            // Check if this child has a 'groupType' property indicating it's a group node
            // If displayGroupNodes is false, we want to flatten these nodes
            if (child.groupType && !displayGroupNodes) {
                // Instead of keeping the child as a grouping node,
                // we'll skip it and take all of its children
                if (child.children && child.children.length > 0) {
                    // Recursively flatten the child's children before merging
                    child.children.forEach(grandChild => {
                        hideGroupNodes(grandChild, displayGroupNodes);
                    });
                    flattenedChildren.push(...child.children);
                }
                // If no children, it simply removes the group node
            } else {
                // Recursively flatten the child's subtree if needed
                hideGroupNodes(child, displayGroupNodes);
                flattenedChildren.push(child);
            }
        });
    
        node.children = flattenedChildren;
        return node;
    }    

    function handleNodeClicked(nodeData) {
        // Try name first, if not available, use groupNode
        const clickedName = nodeData.name || nodeData.groupType;
        console.log(`Node clicked: ${clickedName}`);
    
        if (!clickedName) {
            console.error('Clicked node has neither name nor groupNode:', nodeData);
            return;
        }
    
        // If the clicked node is the same as the current active node, do nothing
        if (clickedName === currentActiveNodeName) {
            return;
        }
    
        searchInput.value = clickedName;
        isNodeClicked = true;
        fetchAndRenderGraph(depthSlider.value, clickedName);
    }    

    function ticked(link, node, labels) {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr("transform", d => {
            if (isNaN(d.x) || isNaN(d.y)) {
                d.x = centerX;
                d.y = centerY;
            }
            return `translate(${d.x},${d.y})`;
        });

        labels
            .attr('x', d => d.x)
            .attr('y', d => d.y - 15);

        if (simulation.alpha() < 0.05) {
            fitGraphToContainer();
            simulation.stop();
        }
    }
    
    const drag = simulation => {
        function dragstarted(event, d) {
            // Fix positions of all other nodes except the dragged node
            visibleNodes.forEach(node => {
                if (node !== d) {
                    node.fx = node.x;
                    node.fy = node.y;
                }
            });
            
            // Prevent initial jump by setting the dragged node's position to its current coordinates
            d.fx = d.x;
            d.fy = d.y;
    
            // Restart the simulation with reduced alpha for smooth dragging
            simulation.alphaTarget(0.1).restart();
        }
    
        function dragged(event, d) {
            // Update the position of the dragged node
            d.fx = event.x;
            d.fy = event.y;
        }
    
        function dragended(event, d) {
            // Keep the dragged node fixed at its final position
            d.fx = event.x;
            d.fy = event.y;
    
            // Stop the simulation's influence
            simulation.alphaTarget(0);
        }
    
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    };  

    function fitGraphToContainer() {
        width = document.querySelector('.graph-container').clientWidth;
        height = document.querySelector('.graph-container').clientHeight;
    
        const containerWidth = width;
        const containerHeight = height;
    
        const nodesBBox = {
            xMin: d3.min(visibleNodes, d => d.x),
            xMax: d3.max(visibleNodes, d => d.x),
            yMin: d3.min(visibleNodes, d => d.y),
            yMax: d3.max(visibleNodes, d => d.y)
        };
    
        const nodesWidth = nodesBBox.xMax - nodesBBox.xMin;
        const nodesHeight = nodesBBox.yMax - nodesBBox.yMin;
    
        const scale = Math.min(
            (containerWidth - 2 * graphPadding) / nodesWidth,
            (containerHeight - 2 * graphPadding) / nodesHeight
        );
    
        const translateX = (containerWidth - nodesWidth * scale) / 2 - nodesBBox.xMin * scale;
        const translateY = (containerHeight - nodesHeight * scale) / 2 - nodesBBox.yMin * scale;
    
        // Apply the transform instantly
        svg.call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
    }
    
    function updateDepthSlider() {
        const value = (depthSlider.value - depthSlider.min) / (depthSlider.max - depthSlider.min) * 100;
        depthSlider.style.setProperty('--value', `${value}%`);
        depthValueLabel.textContent = depthSlider.value;
    }

    updateDepthSlider();

    depthSlider.addEventListener('input', () => {
        updateDepthSlider();
        fetchAndRenderGraph();
    });

    searchButton.addEventListener('click', () => {
        fetchAndRenderGraph();
    });

    window.addEventListener('resize', () => {
        fitGraphToContainer();
    });

    // Initial fetch and render when the page loads
    fetchAndRenderGraph();
});
