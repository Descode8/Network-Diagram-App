•	Add “padding” between nodes withing a group so they’re not as close together (without getting too close to the neighboring groups)
•	Add sample relationships
o	App 2 “depends on” Location 2
o	App 2 “depends on” PO 2
o	App 2 “depends on” Person 2
o	App 2 “depends on” Data 2
o	App 2 “depends on” Tech 2

When you click on App 2, App 2 will become the center node. Each of the 5 relationships listed above will be surrounding App 2.
All other nodes will disappear if they do not have direct relationships to App 2 (because we have depth set to 2 layers).
We will also see “OIT” as a node around App 2 because it has a direct relationship to App 2.

If we move the slider to a depth of 3, all other nodes will reappear because they have secondary relationships to App 2 through the “OIT” node. However, App 2 will continue to stay in the middle of the visualization.

If we click “OIT” again, it will make OIT the center node with surrounding relationship nodes (depending on depth selection).
