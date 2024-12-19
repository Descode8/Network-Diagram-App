document.addEventListener('DOMContentLoaded', () => { 
    let width = document.querySelector('.graph-container').clientWidth;
    let height = document.querySelector('.graph-container').clientHeight;
    const svg = d3.select('.graph-container svg');
    const activeNodeSize = 7;
    const nodeSize = 5;
    const linkWidth = 1;
    const linkColor = '#85929E';
    const nodeBorderColor = 'black';

    let currentActiveNodeName = null; 
    let graphPadding = 75;  
    let visibleNodes = [];
    let isNodeClicked = false;

    const depthSlider = document.getElementById('depthSlider');
    const depthValueLabel = document.getElementById('depthValue');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    const labelNodesSwitch = document.getElementById('labelNodesSwitch');
    const groupNodeSwitch = document.getElementById('groupNodeSwitch');

    // Add event listener for labelNodesSwitch to re-render graph
    labelNodesSwitch.addEventListener('change', () => {
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    // Add event listener for groupNodeSwitch to re-render graph
    groupNodeSwitch.addEventListener('change', () => {
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    // Define zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5])
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

    svg.attr('width', width).attr('height', height);

    const graphGroup = svg.append('g'); 

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
        
        const displayGroupNodes = groupNodeSwitch.checked;
        const displayAssetNodes = labelNodesSwitch.checked;
    
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
    
        // Identify the active node name
        const activeNodeName = data.name;
    
        // Function to determine if a node should have a circle
        function shouldHaveCircle(d) {
            // Active node always has a circle
            if (d.data.name === activeNodeName) return true;
            // Group nodes always have a circle
            if (d.data.groupType) return true;
            // If displayAssetNodes is ON, all nodes get a circle
            if (displayAssetNodes) return true;
            // Otherwise (displayAssetNodes is OFF and node is not active or group node), no circle
            return false;
        }
    
        let nodeSelection = graphGroup.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes);
    
        // Append circles conditionally
        nodeSelection = nodeSelection.enter()
            .filter(d => shouldHaveCircle(d))  // Only enter nodes that should have a circle
            .append('circle')
            .attr('r', d => d.data.name === activeNodeName ? activeNodeSize : nodeSize)
            .attr('fill', d => nodeColor(d))
            .attr('stroke', nodeBorderColor)
            .call(drag(simulation));
    
        nodeSelection.on('click', (event, d) => handleNodeClicked(d.data));
    
        // Always render labels for all nodes
        const labels = graphGroup.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => shouldHaveCircle(d) ? 5 : 0) // If no circle, center label on node position
            .attr('fill', 'black')
            .text(d => d.data.name);
    
        currentActiveNodeName = data.name;
    
        const foundActiveNode = nodes.find(node => node.data.name === data.name);
        if (foundActiveNode) {
            simulation.alpha(1).restart();
            foundActiveNode.fx = width / 2;
            foundActiveNode.fy = height / 2;
        }
    
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
    
            // Apply transform to circles (only for nodes that have them)
            graphGroup.selectAll('circle')
                .attr("transform", d => `translate(${d.x},${d.y})`);
    
            // Labels positioned at node coordinates (if no circle, label is at node coords)
            labels
                .attr('x', d => d.x)
                .attr('y', d => {
                    // If node has a circle, raise label above the circle slightly
                    return shouldHaveCircle(d) ? d.y - 15 : d.y;
                });
    
            if (simulation.alpha() < 0.05) {
                fitGraphToContainer();
                simulation.stop();
            }
        });
    
        fitGraphToContainer();
    }
    
    

    function hideGroupNodes(node, displayGroupNodes) {
        if (!node.children || node.children.length === 0) {
            return node;
        }
    
        let flattenedChildren = [];
    
        node.children.forEach(child => {
            // Check if this child has a 'groupType' property
            if (child.groupType && !displayGroupNodes) {
                // Flatten
                if (child.children && child.children.length > 0) {
                    child.children.forEach(grandChild => {
                        hideGroupNodes(grandChild, displayGroupNodes);
                    });
                    flattenedChildren.push(...child.children);
                }
            } else {
                hideGroupNodes(child, displayGroupNodes);
                flattenedChildren.push(child);
            }
        });
    
        node.children = flattenedChildren;
        return node;
    }    

    function handleNodeClicked(nodeData) {
        const clickedName = nodeData.name || nodeData.groupType;
        console.log(`Node clicked: ${clickedName}`);
    
        if (!clickedName) {
            console.error('Clicked node has neither name nor groupNode:', nodeData);
            return;
        }
    
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

        if (node) {
            node.attr("transform", d => {
                if (isNaN(d.x) || isNaN(d.y)) {
                    d.x = width / 2;
                    d.y = height / 2;
                }
                return `translate(${d.x},${d.y})`;
            });
        }

        labels
            .attr('x', d => d.x)
            .attr('y', d => d.y - (node ? 15 : 0)); // If no node, put label closer to center

        if (simulation.alpha() < 0.05) {
            fitGraphToContainer();
            simulation.stop();
        }
    }
    
    const drag = simulation => {
        function dragstarted(event, d) {
            visibleNodes.forEach(node => {
                if (node !== d) {
                    node.fx = node.x;
                    node.fy = node.y;
                }
            });
            d.fx = d.x;
            d.fy = d.y;
            simulation.alphaTarget(0.1).restart();
        }
    
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
    
        function dragended(event, d) {
            d.fx = event.x;
            d.fy = event.y;
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

    // Initial fetch
    fetchAndRenderGraph();
});
