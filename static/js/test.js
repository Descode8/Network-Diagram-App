function fetchHierarchy(depth, activeNode) {
    let url = '/';
    
    // Only add query parameters if they are provided.
    // This way, on page load, we just fetch the defaults from the backend.
    if (depth || activeNode) {
        const params = new URLSearchParams();
        if (depth) params.set('depth', depth);
        if (activeNode) params.set('activeNode', activeNode);
        url += `?${params.toString()}`;
        }

        fetch(url, { headers: { 'Accept': 'application/json' }})
        .then(response => response.json())
        .then(data => {
            console.log(`Updated Hierarchy Data for ${activeNode || 'OIT'}:`, data);
            console.log(`Current Depth: ${depth || 2}, Current Active Node: ${activeNode || 'OIT'}`);
        })
        .catch(err => console.error(err));
    }

    document.addEventListener('DOMContentLoaded', () => {
        // On initial page load, just fetch without parameters
        // The backend will return its default depth and active node
        console.log('App started. Fetching initial hierarchy...');
        fetchHierarchy();

        const updateForm = document.getElementById('updateForm');
        const activeNodeInput = document.getElementById('activeNodeInput');
        const depthInput = document.getElementById('depthInput');

        updateForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const newActiveNode = activeNodeInput.value.trim() || null;
        const newDepth = depthInput.value ? parseInt(depthInput.value, 10) : null;

        // Fetch with the updated parameters
        fetchHierarchy(newDepth, newActiveNode);
        });
    });