$(document).ready(function() {
    let allDependencies = []; // Will hold the distinct dependencies from get_all_dependencies()

    let width = $('.graph-container')[0].clientWidth;
    let height = $('.graph-container')[0].clientHeight;
    let rightPaneInitialized = false;

    let rootNode = null;
    let activeNode = null;
    let graphData = null;
    let currentActiveNodeName = null;
    let allGroups = [];
    let allChildren = [];
    let nodesDisplayed = [];
    let visibleGroups = {};

    const svg = d3.select('.graph-container svg');
    const activeNodeSize = 5;
    const groupNodeSize = 4;
    const nodeSize = 4;
    const linkWidth = 1;
    let indirectLinkWidth = 1.2; // slightly smaller than your original

    const labelColor = 'var(--label-clr)';
    const linkColor = 'var(--link-clr)';
    const nodeBorderColor = 'var(--nde-bdr-clr)';

    const collapseLeftPane = $('.expand-collapse-buttonLeft');
    let leftPaneIsVisible = true;
    let rightPaneIsVisible = true;
    const collapseRightPane = $('.expand-collapse-buttonRight');

    const depthSlider = $('#depthSlider')[0];
    const depthValueLabel = $('#depthValue');

    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    const searchButton = document.getElementById('searchButton');
    const failedSearch = document.querySelector('.failed-search');
    const rightContainer = d3.select('.right-pane');

    const switchesContainer = document.querySelector('.switches-container');
    const assetNodesSwitch = document.getElementById('assetNodesSwitch');
    const groupNodeSwitch = document.getElementById('groupNodeSwitch');
    const indirectRelationshipNodeSwitch = document.getElementById('indirectRelationshipNodeSwitch');

    const onHomeButton = document.getElementById('homeButton');
    const onRefreshButton = document.getElementById('refreshButton');

    const dropdown = document.createElement('div');
    dropdown.className = 'search-menu';
    searchInput.parentNode.appendChild(dropdown);

    let allNodes = []; // Holds all node names and group types

    // -----------------------------------------------------
    // Fetch all assets for autocomplete from /all-assets route
    // -----------------------------------------------------
    function fetchAllAssetsForAutocomplete() {
        fetch('/all-assets', { headers: { 'Accept': 'application/json' } })
            .then(response => response.json())
            .then(grouped => {
                let assetNames = [];
                for (const type in grouped) {
                    if (grouped.hasOwnProperty(type)) {
                        assetNames = assetNames.concat(grouped[type]);
                    }
                }
                // Merge the fetched asset names with any names already in allNodes
                allNodes = [...new Set([...allNodes, ...assetNames])];
            })
            .catch(err => console.error('Error fetching all assets for auto complete:', err));
    }
    
    // Call it once on page load
    fetchAllAssetsForAutocomplete();

    // -----------------------------------------------------
    // Left/Right Pane Toggle
    // -----------------------------------------------------
    collapseLeftPane.click(function() {
        if ($('.left-pane').is(':visible')) {
            $('.left-pane').css('display', 'none');
            leftPaneIsVisible = false;
            $('.expand-collapse-buttonLeft').css('transform', 'rotate(180deg)');
            $('.graph-container').css('width', '85vw');
            $('.expand-collapse-buttonLeft').attr('title', 'Expand Left Pane');
        } else {
            if (!rightPaneIsVisible) {
                $('.left-pane').css({'display': 'flex', 'width': '17vw'});
                $('.expand-collapse-buttonLeft').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '85vw');
            } else {
                $('.left-pane').css({'display': 'flex', 'width': '17vw'});
                $('.expand-collapse-buttonLeft').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '68vw');
                leftPaneIsVisible = true;
            }
            $('.expand-collapse-buttonLeft').attr('title', 'Collapse Left Pane');
        }
        checkBothPanesVisibility();
        fitGraphToContainer();
    });

    // const rightPane = document.querySelector('.right-pane');
    // rightPane.addEventListener('scroll', () => {
    //     const scrollY = rightPane.scrollTop;
    //     const offsetValue = -scrollY + 'px';
    //     document.documentElement.style.setProperty('--scroll-offset', offsetValue);
    // });

    collapseRightPane.click(function() {
        if ($('.right-pane').is(':visible')) {
            $('.right-pane').css('display', 'none');
            rightPaneIsVisible = false;
            $('.expand-collapse-buttonRight').css('transform', 'rotate(180deg)');
            $('.graph-container').css('width', '83vw');
            $('.expand-collapse-buttonRight').attr('title', 'Expand Right Pane');
        } else {
            if (!leftPaneIsVisible) {
                $('.right-pane').css({'display': 'flex', 'width': '17vw'});
                $('.expand-collapse-buttonRight').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '83vw');
            } else {
                $('.right-pane').css({'display': 'flex', 'width': '17vw'});
                $('.expand-collapse-buttonRight').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '66vw');
                rightPaneIsVisible = true;
            }
            $('.expand-collapse-buttonRight').attr('title', 'Collapse Right Pane');
        }
        checkBothPanesVisibility();
        fitGraphToContainer();
    });

    function checkBothPanesVisibility() {
        if (!leftPaneIsVisible && !rightPaneIsVisible) {
            $('.graph-container').css('width', '100vw');
        }
    }

    // -----------------------------------------------------
    // The “All Assets” Overlay
    // -----------------------------------------------------
    // Use event delegation so dynamically created buttons are handled.
    // Show the overlay
    $(document).on('click', '.see-all-assets', function(e) {
        e.preventDefault();
        $.ajax({
            url: '/all-assets',
            method: 'GET',
            dataType: 'json',
            success: function(groupedData) {
                populateAllAssetsPane(groupedData);
                // Instead of $('.all-assets-overlay').fadeIn();
                $('.all-assets-overlay').addClass('show');
            },
            error: function() {
                alert('Error fetching all assets.');
            }
        });
    });

    // Hide the overlay
    $(document).on('click', '.close-all-assets', function() {
        // Instead of $('.all-assets-overlay').fadeOut();
        $('.all-assets-overlay').removeClass('show');
    });

    // Populates the All Assets overlay with clickable items
    function populateAllAssetsPane(groupedData) {
        const container = $('#allAssetsContainer');
        container.empty(); // Clear old data, if any

        // groupedData example:
        // {
        //   "Applications": ["Help Desk...", "IT Service..."],
        //   "Data": [...],
        //   ...
        // }

        Object.entries(groupedData).forEach(([groupName, assetList]) => {
            // Make a group wrapper
            const groupDiv = $('<div>').addClass('asset-group');

            // Group header
            const groupHeader = $('<h3>')
                .text(groupName)
                .addClass('asset-group-header')
                .css('background-color', getGroupColor(groupName));
            groupDiv.append(groupHeader);

            // Create a container for the items
            const itemsContainer = $('<div>').addClass('asset-items-container');

            // Loop through each asset and append to itemsContainer
            assetList.forEach(assetName => {
                const assetItem = $('<p>')
                    .addClass('asset-item')  // For hover underline
                    .text(assetName)
                    .on('click', () => {
                        // Make this asset the active node
                        handleNodeClicked({ name: assetName });

                        // ---- CLOSE THE OVERLAY AFTER CLICKING ----
                        $('.all-assets-overlay').removeClass('show');
                    });

                itemsContainer.append(assetItem);
            });

            // Append itemsContainer to the main groupDiv
            groupDiv.append(itemsContainer);

            // Then append groupDiv to your main overlay container
            container.append(groupDiv);
        });
    }

    // Maps group name to color
    function getGroupColor(groupName) {
        switch (groupName) {
            case 'Organization': return 'var(--org-nde-clr)';
            case 'Applications': return 'var(--app-nde-clr)';
            case 'Data':         return 'var(--data-nde-clr)';
            case 'Facilities':   return 'var(--fclty-nde-clr)';
            case 'People':       return 'var(--ppl-nde-clr)';
            case 'Procurements': return 'var(--procure-nde-clr)';
            case 'Technology':   return 'var(--tech-nde-clr)';
            case 'Server':       return 'var(--server-nde-clr)';
            case 'Network':      return 'var(--netwrk-nde-clr)';
            default:             return 'yellow';
        }
    }

    function fetchAllDependencies() {
        fetch('/all-dependencies', { headers: { 'Accept': 'application/json' } })
            .then(response => response.json())
            .then(data => {
                allDependencies = data;  // Store them for later usage
            })
            .catch(err => console.error('Error fetching all dependencies:', err));
    }  

    // -----------------------------------------------------
    // Search and Clear Buttons
    // -----------------------------------------------------
    searchInput.addEventListener('input', () => {
        var input = searchInput.value.trim();
        var dropdown = document.getElementById('autocompleteSuggestions');

        if (input) {
            clearButton.style.display = 'flex';
            dropdown.style.display = 'block';
        } else {
            clearButton.style.display = 'none';
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
        }
    });

    clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        searchInput.value = '';
        clearButton.style.display = 'none';
        var dropdown = document.getElementById('autocompleteSuggestions');
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
    });

    function showInvalidSearchMessage(input) {
        failedSearch.style.display = 'block';
        if(!input) {
            failedSearch.textContent = 'Please enter a search term';
            return;
        }
        failedSearch.textContent = `${input} does not exist.\nPlease search again.`;
        setTimeout(() => {
            failedSearch.style.display = 'none';
            failedSearch.textContent = '';
        }, 3000);
    }

    function populateNodeList(data) {
        function traverse(node) {
            if (typeof node.name === 'string') {
                allNodes.push(node.name);
            }
            if (typeof node.groupType === 'string') {
                allNodes.push(node.groupType);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        traverse(data);
        allNodes = [...new Set(allNodes)]; // Remove duplicates
    }

    function searchNode() {
        var input = searchInput.value.trim().toLowerCase();
        if (input) {
            var matchingNode = allNodes.find(node =>
                typeof node === 'string' && node.toLowerCase() === input
            );
            if (matchingNode) {
                fetchAndRenderGraph(depthSlider.value, matchingNode);
            } else {
                showInvalidSearchMessage(searchInput.value);
            }
        } else {
            showInvalidSearchMessage(searchInput.value);
        }
    }

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchNode();
            dropdown.innerHTML = '';
        }
    });

    searchButton.addEventListener('click', () => {
        searchNode();
        dropdown.innerHTML = '';
    });

    // -----------------------------------------------------
    // Autocomplete
    // -----------------------------------------------------
    searchInput.addEventListener('input', () => {
        var input = searchInput.value.toLowerCase();
        var dropdown = document.getElementById('autocompleteSuggestions');
        dropdown.innerHTML = '';

        if (!input) {
            dropdown.style.display = 'none';
            return;
        }

        var matches = allNodes.filter(item =>
            typeof item === 'string' && item.toLowerCase().includes(input)
        );

        if (matches.length === 0) {
            var noMatch = document.createElement('div');
            noMatch.className = 'autocomplete-suggestions';
            noMatch.textContent = 'No matches found';
            dropdown.appendChild(noMatch);
        } else {
            matches.forEach(match => {
                var item = document.createElement('div');
                item.className = 'autocomplete-suggestions';
                item.textContent = match;
                item.addEventListener('click', () => {
                    searchInput.value = match;
                    searchNode();
                    dropdown.innerHTML = '';
                    dropdown.style.border = 'none';
                });
                dropdown.appendChild(item);
            });
        }
        dropdown.style.display = 'block';
    });

    // -----------------------------------------------------
    // Zoom Behavior
    // -----------------------------------------------------
    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
            var transform = event.transform;
            currentZoomScale = transform.k;

            graphGroup.attr('transform', transform);

            if (nodeSelectionGlobal) {
                nodeSelectionGlobal
                    .attr('r', d => {
                        if (d.data.name === currentActiveNodeName) {
                            return activeNodeSize / currentZoomScale;
                        } else if (d.data.groupType) {
                            return groupNodeSize / currentZoomScale;
                        } else {
                            return nodeSize / currentZoomScale;
                        }
                    })
                    .attr('stroke-width', 1 / currentZoomScale);
            }

            if (linkSelectionGlobal) {
                linkSelectionGlobal
                    .attr('stroke-width', linkWidth / currentZoomScale);
            }

            if (labelsSelectionGlobal) {
                labelsSelectionGlobal
                    .attr('font-size', `${12 / currentZoomScale}px`);
            }

            if (indirectLinkSelectionGlobal) {
                indirectLinkSelectionGlobal
                    .attr('stroke-width', (indirectLinkWidth / currentZoomScale))
                    .attr('stroke-dasharray', `${(indirectLinkWidth / currentZoomScale)}, ${(indirectLinkWidth / currentZoomScale) * 2}`);
            }
        });

    svg.call(zoom);

    // -----------------------------------------------------
    // Color function (for nodes)
    // -----------------------------------------------------
    function nodeColor(node) {
        let nodes = node.data.groupType || node.data.type;
        switch (nodes) {
            case 'Organization':
                return 'var(--org-nde-clr)' || 'blue';
            case 'Applications':
                return 'var(--app-nde-clr)' || 'purple';
            case 'People':
                return 'var(--ppl-nde-clr)' || 'orange';
            case 'Technology':
                return 'var(--tech-nde-clr)' || 'green';
            case 'Data':
                return 'var(--data-nde-clr)' || 'teal';
            case 'Procurements':
                return 'var(--procure-nde-clr)' || 'pink';
            case 'Facilities':
                return 'var(--fclty-nde-clr)' || 'brown';
            case 'Server':
                return 'var(--server-nde-clr)' || 'red';
            case 'Network':
                return 'var(--netwrk-nde-clr)' || 'yellow';
            default:
                return 'yellow';
        }
    }

    // Set up main group + force simulation
    svg.attr('width', width).attr('height', height);
    const graphGroup = svg.append('g');
    const simulation = d3.forceSimulation();

    onHomeButton.addEventListener('click', () => {
        location.reload();
    });

    onRefreshButton.addEventListener('click', () => {
        shuffleNodeForForces();
    });

    function shuffleNodeForForces() {
        nodesDisplayed.forEach(d => {
            d.fx = null;
            d.fy = null;
        });
        simulation.alphaDecay(0.01).alpha(1).restart();
    }

    // -----------------------------------------------------
    // Indirect Relationship Handling
    // -----------------------------------------------------
    function findNodeByName(obj, name) {
        if (!obj) return null;
        if (obj.name === name) {
            return obj;
        }
        if (Array.isArray(obj.children)) {
            for (const child of obj.children) {
                const found = findNodeByName(child, name);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function ensureIndirectNodesVisible(data) {
        if (!indirectRelationshipNodeSwitch.checked) return;

        const indirectNodes = getIndirectRelationshipNodes(data);
        indirectNodes.forEach(sourceItem => {
            const sourceNode = findNodeByName(data, sourceItem.name);
            if (!sourceNode) return;

            sourceItem.indirectRelationships.forEach(targetObj => {
                const { name: targetName, type: targetType } = targetObj;
                const targetExists = findNodeByName(data, targetName);

                if (!targetExists) {
                    const newIndirectNode = {
                        name: targetName,
                        type: targetType || 'Unknown',
                        description: "Automatically added via indirect relationship",
                        children: []
                    };
                    if (!sourceNode.children) {
                        sourceNode.children = [];
                    }
                    sourceNode.children.push(newIndirectNode);
                }
            });
        });
    }

    groupNodeSwitch.addEventListener('change', () => {
        resetSimulationForForces();
        // Re-fetch to flatten or remove group nodes properly
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    indirectRelationshipNodeSwitch.addEventListener('change', () => {
        updateIndirectLinks();
    });

    function updateIndirectLinks() {
        // If switch isn't checked, just remove any existing indirect lines
        if (!indirectRelationshipNodeSwitch.checked) {
            if (indirectLinkSelectionGlobal) {
                indirectLinkSelectionGlobal.remove();
                indirectLinkSelectionGlobal = null;
            }
            return;
        }
        // If switch IS checked, figure out which indirect lines to draw
        const hasIndirectRelationships = containsIndirectRelationships(graphData);
        if (!hasIndirectRelationships) return;

        let indirectNodes = getIndirectRelationshipNodes(graphData);
        let indirectLinks = [];

        indirectNodes.forEach(sourceObj => {
            let src = nodesDisplayed.find(n => n.data.name === sourceObj.name);
            if (!src) return;

            (sourceObj.indirectRelationships || []).forEach(targetObj => {
                let tgt = nodesDisplayed.find(n => n.data.name === targetObj.name);
                if (tgt) {
                    indirectLinks.push({ source: src, target: tgt });
                }
            });
        });

        if (indirectLinkSelectionGlobal) {
            indirectLinkSelectionGlobal.remove();
        }

        let indirectLinkGroup = graphGroup.select('g.indirectLinks');
        indirectLinkSelectionGlobal = indirectLinkGroup
            .selectAll('line.indirect-link')
            .data(indirectLinks, d => d.source.data.name + '->' + d.target.data.name)
            .enter()
            .append('line')
            .attr('class', 'indirect-link')
            .attr('stroke', 'var(--indirect-link-clr)')
            .attr('stroke-width', indirectLinkWidth)
            .attr('stroke-dasharray', `${indirectLinkWidth}, ${indirectLinkWidth * 5}`);

        indirectLinkSelectionGlobal
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        fitGraphToContainer(true);
    }

    // -----------------------------------------------------
    // Fetch & Render
    // -----------------------------------------------------
    function fetchAndRenderGraph(depth = depthSlider.value, activeNodeParam = searchInput.value.trim()) {
        var url = `/?depth=${depth}&activeNode=${encodeURIComponent(activeNodeParam)}`;
        fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!rootNode) {
                    rootNode = data;
                }
                graphData = data;

                const hasIndirectRelationships = containsIndirectRelationships(data);
                const indirectSwitch = document.querySelector('.indirectRelationshipSwitch');
                if (hasIndirectRelationships) {
                    indirectSwitch.style.display = 'block';
                } else {
                    indirectSwitch.style.display = 'none';
                }

                getAllChildren(data);
                showGroupToggles();

                mergeSameGroupNodes(data);
                populateNodeList(data);
                initializeGroupToggles(data);
                renderGraph(data);
            })
            .catch(error => {
                console.error('Error fetching graph data:', error);
            });
    }

    function getAllChildren(data) {
        if (data.children) {
            data.children.forEach(child => {
                allChildren.push(child);
            });
        } else {
            allChildren.push('No Children');
        }
    }

    function getUniqueGroups(node, groups = new Set()) {
        if (!node) return groups;
        if (node.groupType || node.type) {
            groups.add(node.groupType || node.type);
        }
        if (node.children) {
            node.children.forEach(child => getUniqueGroups(child, groups));
        }
        return groups;
    }

    function initializeGroupToggles(data) {
        allGroups = Array.from(getUniqueGroups(data));
        allGroups.sort((a, b) => a.localeCompare(b));
        if (Object.keys(visibleGroups).length === 0) {
            allGroups.forEach(group => {
                visibleGroups[group] = true;
            });
        }

        let dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
        if (!dynamicTogglesContainer) {
            dynamicTogglesContainer = document.createElement('div');
            dynamicTogglesContainer.className = 'dynamic-group-toggles';
            switchesContainer.appendChild(dynamicTogglesContainer);
        } else {
            dynamicTogglesContainer.innerHTML = '';
        }

        allGroups.forEach(group => {
            // Skip if group is the same as the active node
            if (group === data.type) {
                return;
            }

            var label = document.createElement('label');
            label.className = 'switch span';

            var input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = visibleGroups[group] ?? true;

            var span = document.createElement('span');
            span.className = 'slider round';
            span.style.backgroundColor = nodeColor({ data: { groupType: group } });
            span.title = `Toggle ${group} Nodes`;

            var checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            checkSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            checkSvg.setAttribute("height", "10px");
            checkSvg.setAttribute("width", "10px");
            checkSvg.setAttribute("viewBox", "0 -960 960 960");
            checkSvg.setAttribute("class", "checkmark");

            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M382-200 113-469l97-97 172 173 369-369 97 96-466 466Z");
            path.setAttribute("fill", nodeColor({ data: { groupType: group } }));

            checkSvg.appendChild(path);
            span.appendChild(checkSvg);

            label.appendChild(input);
            label.appendChild(span);
            label.append(`${group}`);

            dynamicTogglesContainer.appendChild(label);

            input.addEventListener('change', () => {
                visibleGroups[group] = input.checked;
                fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
            });
        });
    }

    function resetSimulationForForces() {
        simulation.stop();
        simulation.force('charge', null);
        simulation.force('center', null);
        simulation.force('collide', null);
        simulation.force('radial', null);
        simulation.force('circularChildren', null);
    }

    function containsIndirectRelationships(obj) {
        if (obj && typeof obj === 'object') {
            if ('indirectRelationships' in obj) {
                return true;
            }
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (containsIndirectRelationships(obj[key])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function getIndirectRelationshipNodes(obj, result = []) {
        if (Array.isArray(obj)) {
            obj.forEach(element => getIndirectRelationshipNodes(element, result));
        } else if (obj && typeof obj === 'object') {
            if (obj.hasOwnProperty('indirectRelationships') && Array.isArray(obj.indirectRelationships)) {
                result.push({
                    name: obj.name,
                    indirectRelationships: obj.indirectRelationships
                });
            }
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    getIndirectRelationshipNodes(obj[key], result);
                }
            }
        }
        return result;
    }

    // -----------------------------------------------------
    // renderGraph
    // -----------------------------------------------------
    function renderGraph(data) {
        // Remove old groups so we can re-append them in correct z-order
        graphGroup.selectAll('g.indirectLinks').remove();
        graphGroup.selectAll('g.links').remove();
        graphGroup.selectAll('g.nodes').remove();
        graphGroup.selectAll('g.labels').remove();

        currentActiveNodeName = data.name;

        var displayGroupNodes = groupNodeSwitch.checked;
        var displayAssetNodes = assetNodesSwitch.checked;
        var displayIndirectRelationship = indirectRelationshipNodeSwitch.checked;
        var hasIndirectRelationships = containsIndirectRelationships(data);

        const isActiveNodeAGroup = (
            (data.groupType && data.groupType === data.name) ||
            (data.type && data.type === data.name)
        );

        if (isActiveNodeAGroup && depthSlider.value < 3) {
            displayGroupNodes = false;
        } else {
            resetSimulationForForces();
        }

        hideGroupNodes(data, displayGroupNodes);
        filterDataByVisibleGroups(data);

        const root = d3.hierarchy(data);
        const links = root.links();
        let nodes = root.descendants();

        // Filter out root group node if it is the same name as active:
        nodes = nodes.filter(node => {
            return node.data.name !== currentActiveNodeName || !node.data.groupType;
        });

        nodesDisplayed = nodes;

        const centerX = width / 2;
        const centerY = height / 2;
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = 100;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);

            if (node.data.name === data.name) {
                node.x = centerX;
                node.y = centerY;
                node.fx = centerX;
                node.fy = centerY;
            }
        });

        simulation
            .nodes(nodes)
            .alpha(0)
            .alphaDecay(0.005)
            .velocityDecay(0.5)
            .force("charge", d3.forceManyBody().strength(-1000).distanceMin(150))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(50));

        function forceCircularChildren(radius) {
            let nodesByParent = {};
            function force(alpha) {
                Object.values(nodesByParent).forEach(childArr => {
                    if (!childArr.length) return;
                    const parent = childArr[0].parentNode;
                    if (!parent) return;

                    const n = childArr.length;
                    childArr.forEach((child, i) => {
                        const angle = (2 * Math.PI / n) * i;
                        const targetX = parent.x + radius * Math.cos(angle);
                        const targetY = parent.y + radius * Math.sin(angle);
                        child.vx += (targetX - child.x) * 0.9 * alpha;
                        child.vy += (targetY - child.y) * 0.9 * alpha;
                    });
                });
            }
            force.initialize = function(ns) {
                nodesByParent = {};
                ns.forEach(node => {
                    const pName = node.data.parent;
                    if (!pName) return;
                    if (!nodesByParent[pName]) {
                        nodesByParent[pName] = [];
                    }
                    nodesByParent[pName].push(node);
                    node.parentNode = ns.find(n => n.data.name === pName);
                });
            };
            return force;
        }

        if (displayGroupNodes) {
            simulation
                .force("radial", d3.forceRadial(50, width / 2, height / 2))
                .force("link", d3.forceLink(links)
                    .id(d => d.data.name)
                    .distance(link => {
                        const source = link.source.data.name;
                        if (source === currentActiveNodeName) {
                            return 120;
                        } else if (source !== currentActiveNodeName && depthSlider.value > 2) {
                            return 100;
                        } else {
                            return 50;
                        }
                    })
                );
        } else {
            simulation
                .alpha(0)
                .alphaDecay(0.01)
                .velocityDecay(0.5)
                .force("link", d3.forceLink(links).strength(1)
                    .id(d => d.data.name)
                    .distance(link => {
                        const source = link.source.data.name;
                        return (source === currentActiveNodeName) ? 10 : 0;
                    })
                )
                .force("circularChildren", forceCircularChildren(50))
                .force("collide", d3.forceCollide().radius(15));
        }

        if (currentActiveNodeName !== rootNode.name && depthSlider.value == 2) {
            simulation
                .force("radial", null)
                .force("charge", d3.forceManyBody().strength(-1000));
        }

        const totalNodes = data.totalNodesDisplayed;
        if (totalNodes >= 2 && totalNodes <= 6) {
            resetSimulationForForces();
            simulation
                .force("radial", null)
                .force("charge", d3.forceManyBody().strength(-1000))
                .force("link", d3.forceLink(links)
                    .id(d => d.data.name)
                    .distance(75)
                );
        }

        simulation.force("link").links(links);

        // Create <g> layers in correct z-order:
        let indirectLinkGroup = graphGroup.append('g').attr('class', 'indirectLinks');
        let linkGroup = graphGroup.append('g').attr('class', 'links');
        let nodeGroup = graphGroup.append('g').attr('class', 'nodes');
        let labelGroup = graphGroup.append('g').attr('class', 'labels');

        // Indirect links
        let indirectLinks = [];
        if (hasIndirectRelationships && displayIndirectRelationship) {
            const indirectNodes = getIndirectRelationshipNodes(data);
            indirectNodes.forEach(sourceNode => {
                const source = nodes.find(n => n.data.name === sourceNode.name);
                if (source) {
                    sourceNode.indirectRelationships.forEach(targetObj => {
                        const found = nodes.find(n => n.data.name === targetObj.name);
                        if (found) {
                            indirectLinks.push({ source: source, target: found });
                        }
                    });
                }
            });
        }
        indirectLinkSelectionGlobal = indirectLinkGroup
            .selectAll('line.indirect-link')
            .data(indirectLinks, d => d.source.data.name + '->' + d.target.data.name)
            .enter()
            .append('line')
            .attr('class', 'indirect-link')
            .attr('stroke', 'var(--indirect-link-clr)')
            .attr('stroke-width', indirectLinkWidth)
            .attr('stroke-dasharray', `${indirectLinkWidth}, ${indirectLinkWidth * 5}`);

        // Main links
        let linkSelection = linkGroup
            .selectAll('line.link')
            .data(links, d => d.source.data.name + '->' + d.target.data.name);

        linkSelection.exit().remove();

        let linkEnter = linkSelection.enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke', linkColor)
            .attr('stroke-width', linkWidth);

        linkSelection = linkEnter.merge(linkSelection);
        linkSelectionGlobal = linkSelection;

        // Nodes
        let nodeSelection = nodeGroup
            .selectAll('circle.node')
            .data(nodes, d => d.data.name);

        nodeSelection.exit().remove();

        let nodeEnter = nodeSelection.enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', d => {
                if (d.data.name === currentActiveNodeName) {
                    return activeNodeSize;
                } else if (d.data.groupType) {
                    return groupNodeSize;
                } else {
                    return nodeSize;
                }
            })
            .attr('fill', d => nodeColor(d))
            .attr('stroke', nodeBorderColor)
            .on('click', (event, d) => handleNodeClicked(d.data))
            .call(drag(simulation));

        nodeSelection = nodeEnter.merge(nodeSelection);
        nodeSelectionGlobal = nodeSelection;

        // Labels
        let labelSelection = labelGroup
            .selectAll('text.label')
            .data(nodes, d => d.data.name);

        labelSelection.exit().remove();

        let labelEnter = labelSelection.enter()
            .append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .attr('fill', labelColor)
            .style('cursor', 'pointer')
            .text(d => d.data.name)
            .on('click', (event, d) => handleNodeClicked(d.data))
            .call(drag(simulation));

        labelSelection = labelEnter.merge(labelSelection);
        labelsSelectionGlobal = labelSelection;

        simulation.on('tick', () => {
            if (indirectLinkSelectionGlobal) {
                indirectLinkSelectionGlobal
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
            }

            linkSelection
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodeSelection
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            labelSelection
                .attr('x', d => d.x)
                .attr('y', d => {
                    const r = getCircleScreenRadius(d);
                    return d.y - (r + 3);
                });

            preventLabelOverlap(labelSelection);

            if (simulation.alpha() < 0.3) { fitGraphToContainer(true); }
            if (simulation.alpha() < 0.05) {
                simulation.stop();
                fitGraphToContainer();
            }

            if (simulation.alpha() < 0.3) {
                fitGraphToContainer(true);
            }
            if (simulation.alpha() < 0.05) {
                simulation.stop();
                fitGraphToContainer();
            }
        });

        // Also update the local toggles for assets:
        updateAssetNodesVisibility();
        fitGraphToContainer(true);
        simulation.alpha(0.3).restart();
        updateRightContainer(data);
    }

    // Helper for label overlap
    function preventLabelOverlap(selection) {
        const labels = selection.nodes();

        for (let i = 0; i < labels.length - 1; i++) {
            for (let j = i + 1; j < labels.length; j++) {
                const a = labels[i].getBBox();
                const b = labels[j].getBBox();
                if (isOverlap(a, b)) {
                    const dy = (a.y + a.height) - b.y;
                    d3.select(labels[j])
                        .attr('y', parseFloat(labels[j].getAttribute('y')) + dy + 2);
                }
            }
        }
    }

    function isOverlap(a, b) {
        return !(
            a.x + a.width < b.x ||
            a.x > b.x + b.width ||
            a.y + a.height < b.y ||
            a.y > b.y + b.height
        );
    }

    function getCircleScreenRadius(d) {
        if (d.data.name === currentActiveNodeName) {
            return activeNodeSize / currentZoomScale;
        } else if (d.data.groupType) {
            return groupNodeSize / currentZoomScale;
        } else {
            return nodeSize / currentZoomScale;
        }
    }

    function hideGroupNodes(node, displayGroupNodes) {
        if (!node.children || node.children.length === 0) {
            return node;
        }
        let flattenedChildren = [];
        node.children.forEach(child => {
            if (child.groupType && !displayGroupNodes) {
                if (child.name === currentActiveNodeName) {
                    hideGroupNodes(child, displayGroupNodes);
                    flattenedChildren.push(child);
                } else {
                    if (child.children && child.children.length > 0) {
                        child.children.forEach(grandChild => {
                            hideGroupNodes(grandChild, displayGroupNodes);
                        });
                        flattenedChildren.push(...child.children);
                    }
                }
            } else {
                hideGroupNodes(child, displayGroupNodes);
                flattenedChildren.push(child);
            }
        });
        node.children = flattenedChildren;
        return node;
    }

    function filterDataByVisibleGroups(node) {
        if (!node.children) return;
        node.children = node.children.filter(child => {
            var key = child.groupType || child.type;
            if (key && visibleGroups.hasOwnProperty(key)) {
                if (!visibleGroups[key]) {
                    return false;
                }
            }
            filterDataByVisibleGroups(child);
            return true;
        });
    }

    // Called when user clicks a node’s label/circle or from All Assets
    function handleNodeClicked(nodeData) {
        var clickedName = nodeData.name || nodeData.groupType;
        if (!clickedName) return;
        if (clickedName === currentActiveNodeName) return;

        searchInput.value = clickedName;
        fetchAndRenderGraph(depthSlider.value, clickedName);
    }

    const drag = simulation => {
        function dragstarted(event, d) {
            nodesDisplayed.forEach(node => {
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

    function mergeSameGroupNodes(node) {
        if (!node.children || node.children.length === 0) return node;
        node.children.forEach(child => mergeSameGroupNodes(child));

        var groupNodesMap = new Map();
        var newChildren = [];

        for (const child of node.children) {
            if (child.groupType) {
                if (!groupNodesMap.has(child.groupType)) {
                    groupNodesMap.set(child.groupType, child);
                } else {
                    let existing = groupNodesMap.get(child.groupType);
                    existing.children = existing.children.concat(child.children || []);
                }
            } else {
                newChildren.push(child);
            }
        }
        for (const [, groupNode] of groupNodesMap) {
            newChildren.push(groupNode);
        }
        node.children = newChildren;
        return node;
    }

    function fitGraphToContainer(noTransition = false) {
        var containerWidth = document.querySelector('.graph-container').clientWidth;
        var containerHeight = document.querySelector('.graph-container').clientHeight;
        var nonGroupNodes = nodesDisplayed.filter(node => !node.isGroup);

        var nodesBBox = {
            xMin: d3.min(nonGroupNodes, d => d.x),
            xMax: d3.max(nonGroupNodes, d => d.x),
            yMin: d3.min(nonGroupNodes, d => d.y),
            yMax: d3.max(nonGroupNodes, d => d.y)
        };

        var nodesWidth = nodesBBox.xMax - nodesBBox.xMin;
        var nodesHeight = nodesBBox.yMax - nodesBBox.yMin;

        let scale, translateX, translateY;
        let graphPadding;

        // Adjust graphPadding based on groupNodeSwitch and node count
        if (groupNodeSwitch.checked) {
            if (nonGroupNodes.length > 50) {
                graphPadding = 75;
            } else if (nonGroupNodes.length > 20) {
                graphPadding = 100;
            } else if (nonGroupNodes.length > 5) {
                graphPadding = 225;
            } else if (nonGroupNodes.length <= 5 && nonGroupNodes.length > 3) {
                graphPadding = 275;
            } else if (nonGroupNodes.length <= 3 ) {
                graphPadding = 300;
            } else if (nonGroupNodes.length === 2 ) {
                graphPadding = 400;
            } else {
                graphPadding = 50;
            }
        } else {
            if (nonGroupNodes.length > 50) {
                graphPadding = 75;
            } else if (nonGroupNodes.length > 20) {
                graphPadding = 120;
            } else if (nonGroupNodes.length > 5) {
                graphPadding = 225;
            } else if (nonGroupNodes.length <= 5 && nonGroupNodes.length > 3) {
                graphPadding = 275;
            } else if (nonGroupNodes.length <= 3 ) {
                graphPadding = 300;
            } else if (nonGroupNodes.length === 2 ) {
                graphPadding = 400;
            } else {
                graphPadding = 50;
            }
        }

        if (nodesWidth === 0 && nodesHeight === 0) {
            scale = 1;
            translateX = (containerWidth / 2) - nodesBBox.xMin;
            translateY = (containerHeight / 2) - nodesBBox.yMin;
        } else {
            scale = Math.min(
                (containerWidth - 2 * graphPadding) / nodesWidth,
                (containerHeight - 2 * graphPadding) / nodesHeight
            );
            translateX = (containerWidth - nodesWidth * scale) / 2 - nodesBBox.xMin * scale;
            translateY = (containerHeight - nodesHeight * scale) / 2 - nodesBBox.yMin * scale;
        }
        if (noTransition) {
            svg.call(
                zoom.transform,
                d3.zoomIdentity.translate(translateX, translateY).scale(scale)
            );
        } else {
            svg.transition().duration(0).call(
                zoom.transform,
                d3.zoomIdentity.translate(translateX, translateY).scale(scale)
            );
        }
    }

    function updateDepthSlider() {
        var value = (depthSlider.value - depthSlider.min) / (depthSlider.max - depthSlider.min) * 100;
        $(depthSlider).css('--value', `${value}%`);
        $(depthValueLabel).text(depthSlider.value);
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
        fitGraphToContainer(/* noTransition = false */);
    });

    /*****************************************************************
    * Comment back to use 'See All Assets' button to view all assets *
    ******************************************************************/
    // function updateRightContainer(data) {
    //     rightContainer.html("");

    //     rightContainer
    //         .append("h2")
    //         .style("background-color", nodeColor({ data: { type: data.type } }))
    //         .html(`${data.name}`);

    //     rightContainer
    //         .append("p")
    //         .html(`<strong>Type: </strong>${data.type || 'Unknown'}`);

    //     const description = (data.description || 'No description available').replace(/\n/g, '<br>');
    //     rightContainer
    //         .append("h3")
    //         .attr("class", "description-header")
    //         .html("Description");
    //     rightContainer
    //         .append("p")
    //         .style("text-align", "left")
    //         .html(description);

    //     rightContainer
    //         .append("h3")
    //         .attr("class", "dependencies-header")
    //         .html("Dependencies");

    //     rightContainer
    //         .append("button")
    //         .attr("class", "see-all-assets")
    //         .attr('title', 'View All Assets')
    //         .html("View All Assets");

    // Then modify updateRightContainer like this:
    ////////////////////////////////////////////////////////////////
    // updateRightContainer: Shows active node info at top
    // and ALWAYS shows rootNode’s groups/items as dependencies.
    //
    // 1) The .description-header & .dependencies-header
    //    match your old naming & styling.
    // 2) The "See All Assets" button also matches the old naming.
    ////////////////////////////////////////////////////////////////
    
    function updateRightContainer(activeNodeData) {
        // 1) Clear the right pane
        rightContainer.html("");
    
        //---------------------------------------------------
        // 2) Top Section (Active Node Info)
        //---------------------------------------------------
        const topSection = rightContainer
            .append("div")
            .attr("class", "top-section");
    
        // Active node name (H2)
        topSection
            .append("h2")
            .style("background-color", nodeColor({ data: { type: activeNodeData.type } }))
            .html(`${activeNodeData.name}`);
    
        // Type line
        topSection
            .append("p")
            .html(`<strong>Type: </strong>${activeNodeData.type || "Unknown"}`);
    
        // Description header
        topSection
            .append("h3")
            .attr("class", "description-header")
            .html("Description");
    
        // Description text
        const description = (activeNodeData.description || "No description available")
            .replace(/\n/g, "<br>");
        topSection
            .append("p")
            .style("text-align", "left")
            .html(description);
    
        // Dependencies header - moved to top section
        topSection
            .append("h3")
            .attr("class", "dependencies-header")
            .html("Dependencies");
    
        //---------------------------------------------------
        // 3) Dependencies Wrapper (Scroll Area) - no gap after header
        //---------------------------------------------------
        const dependenciesWrapper = rightContainer
            .append("div")
            .attr("class", "dependencies-wrapper");
    
        // If no rootNode or children, bail out
        if (!rootNode || !rootNode.children || rootNode.children.length === 0) {
            dependenciesWrapper
                .append("p")
                .attr("class", "no-dependencies")
                .html("No dependencies available.");
            return;
        }
    
        //---------------------------------------------------
        // 5) "All Dependencies" Section - immediately after header
        //---------------------------------------------------
        // Check if `allDependencies` is loaded
        if (!allDependencies || !allDependencies.length) {
            return;
        }
    
        // Get all children names of the active node
        const getChildrenNames = (node) => {
            const names = new Set();
            const traverse = (n) => {
                if (n.children) {
                    n.children.forEach(child => {
                        names.add(child.name);
                        traverse(child);
                    });
                }
            };
            traverse(node);
            return names;
        };
    
        // Get the set of active node's children names
        const activeNodeChildren = getChildrenNames(activeNodeData);
        // Add the active node's name to the set
        activeNodeChildren.add(activeNodeData.name);
    
        // Group by Dependency_Type
        const depsByType = d3.group(allDependencies, d => d.Dependency_Type);
    
        depsByType.forEach((depItems, depType) => {
            // Type header
            dependenciesWrapper
                .append("p")
                .attr("class", "dependency-type-header")
                .style("background-color", nodeColor({ data: { type: depType } }))
                .text(depType || "Unknown Type");
    
            // Container for these items
            const depTypeContainer = dependenciesWrapper
                .append("div")
                .attr("class", "dependency-nodes-container");
    
            // Separate active and non-active dependencies
            const activeDeps = depItems.filter(item => activeNodeChildren.has(item.Dependency_Name));
            const nonActiveDeps = depItems.filter(item => !activeNodeChildren.has(item.Dependency_Name));
    
            // Sort both groups alphabetically
            activeDeps.sort((a, b) => a.Dependency_Name.localeCompare(b.Dependency_Name));
            nonActiveDeps.sort((a, b) => a.Dependency_Name.localeCompare(b.Dependency_Name));
    
            // Create active dependencies section if there are any active dependencies
            if (activeDeps.length > 0) {
                const activeContainer = depTypeContainer
                    .append("div")
                    .attr("class", "active-dependencies");
    
                // Render active dependencies
                activeDeps.forEach(item => {
                    const nodeContainer = activeContainer
                        .append("div")
                        .attr("class", "dependency-node-container");
    
                    nodeContainer
                        .append("p")
                        .attr("class", "dependency-node active-dependency")
                        .style("cursor", "pointer")
                        .text(item.Dependency_Name)
                        .on("click", () => handleNodeClicked({ name: item.Dependency_Name }));
    
                    nodeContainer
                        .append("div")
                        .attr("class", "tool-tip")
                        .html(
                            item.Dependency_Descrip
                                ? item.Dependency_Descrip.replace(/\n/g, "<br>")
                                : "No description available"
                        );
                });
            }
    
            // Render non-active dependencies
            nonActiveDeps.forEach(item => {
                const nodeContainer = depTypeContainer
                    .append("div")
                    .attr("class", "dependency-node-container");
    
                nodeContainer
                    .append("p")
                    .attr("class", "dependency-node inactive-dependency")
                    .style("cursor", "pointer")
                    .text(item.Dependency_Name)
                    .on("click", () => handleNodeClicked({ name: item.Dependency_Name }));
    
                nodeContainer
                    .append("div")
                    .attr("class", "tool-tip")
                    .html(
                        item.Dependency_Descrip
                            ? item.Dependency_Descrip.replace(/\n/g, "<br>")
                            : "No description available"
                    );
            });
        });
    }
    /**
     * A helper function for displaying each child node in the "Dependencies" section.
     */
    // function createNodeElement(parentContainer, node) {
    //     // Outer wrapper
    //     const nodeContainer = parentContainer.append("div")
    //         .attr("class", "dependency-node-container");

    //     // The clickable node name
    //     nodeContainer
    //         .append("p")
    //         .attr("class", "dependency-node")
    //         .style("cursor", "pointer")
    //         .html(node.name)
    //         .on("click", () => handleNodeClicked(node));

    //     // Tool tip or description
    //     nodeContainer
    //         .append("div")
    //         .attr("class", "tool-tip")
    //         .html(
    //             node.description
    //                 ? node.description.replace(/\n/g, "<br>")
    //                 : "No description available"
    //         );
    // }

    function showGroupToggles() {
        var dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
        if (dynamicTogglesContainer) {
            dynamicTogglesContainer.style.display = 'block';
        }
    }

    // -----------------------------------------------------
    // Toggle ONLY circles for asset nodes, keep labels on
    // -----------------------------------------------------
    assetNodesSwitch.addEventListener('change', () => {
        updateAssetNodesVisibility();
    });

    function updateAssetNodesVisibility() {
        if (!nodeSelectionGlobal || !labelsSelectionGlobal) return;

        nodeSelectionGlobal.each(function(d) {
            const circle = d3.select(this);

            // Always show the active node if it's an asset
            if (d.data.name === currentActiveNodeName) {
                circle.attr('display', null);
            }
            // If it's a group node, do nothing
            else if (d.data.groupType) {
                // let the fetch-based logic handle group toggling
            }
            // Otherwise, it's an asset node
            else {
                if (assetNodesSwitch.checked) {
                    circle.attr('display', null);
                } else {
                    circle.attr('display', 'none');
                }
            }
        });

        // Asset labels always on:
        labelsSelectionGlobal.each(function(d) {
            const label = d3.select(this);
            if (!d.data.groupType || d.data.name === currentActiveNodeName) {
                label.attr('display', null);
            } else {
                label.attr('display', null);
            }
        });
    }

    // Kick it off (initial load)
        // Call it once on page load
    fetchAllDependencies();  
    fetchAndRenderGraph();
});
