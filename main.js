import * as d3 from 'd3';
import * as d3Sankey from "d3-sankey";

const width = 928;
const height = 600;
const format = d3.format(",.0f");
const linkColor = "source-target"; // source, target, source-target, or a color string.

// Create a SVG container.
const svg = d3.create("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [0, 0, width, height])
  .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

// Constructs and configures a Sankey generator.
const sankey = d3Sankey.sankey()
  .nodeId(d => d.name)
  .nodeAlign(d3Sankey.sankeyJustify) // d3.sankeyLeft, etc.
  .nodeWidth(15)
  .nodePadding(10)
  .extent([[1, 5], [width - 1, height - 5]]);

function wrangleKeys(revsAndExps) {
  let listOfCategories = []
  let id = 0; // number that increments for sankey's name
  let data = []; // array to return
  // wrangle that there data into the rootin' tootin' format, pardner
  for (let obj of revsAndExps) {
    let category = obj["type"];
    if (category === "Nonoperating revenues") { // I didn't ask for this
      category = "Nonoperating revenues (expenses)";
    }
    if (!listOfCategories.includes(category)) {
      listOfCategories.push(category);
    }
    // add wrangl'd node to data
    data.push({
      name: id,
      value: obj["2023"],
      title: obj["name"],
      category: category,
    });
    id++;
  }

  // Adds categories to data, because they'll be middlemen (middlenodes?)
  for (let cat of listOfCategories) {
    data.push({
      name: cat,
      value: 0,
      title: cat,
      category: cat,
    });
  }

  // Adds JMU to data, because it's the middle of everything
  data.push({
    name: "JMU",
    value: 0,
    title: "JMU",
    category: "JMU",
  });
  // Adds "Nonoperating expenses (revenues)" to data, because it's an edge case
  data.push({
    name: "Nonoperating expenses (revenues)",
    value: 0,
    title: "Nonoperating expenses (revenues)",
    category: "Nonoperating expenses (revenues)",
  });
  return data;
}

function createLinks(data) {
  let links = [];
  for (let obj of data) {
    let from; // source
    let to; // target
    const stringifiedTitle = String(obj.title);
    if (obj.name === "JMU") { continue; } // I believe JMU should simply be skipped
    // HANDLES CATEGORIES, which have IDs that aren't ints
    else if (!(typeof obj.name == typeof 1)) {
      // checks to see if it's an expense
      if (stringifiedTitle.includes("Nonoperating revenues (expenses)") || stringifiedTitle.includes("Expense")) { 
        from = "JMU";
        to = obj.title;
      } else {
        from = obj.title;
        to = "JMU";
      }
    }
    // HANDLES REGULAR VALUES
    // if it's a revenue, the object's flowing into its category
    // if it's an expense, the category is flowing into the object
    // this if statement figures that out
    else {
      if (obj.value < 0 || stringifiedTitle.includes("Expense")) {
        to = obj.name;
        // nonoperating revenues are counted as expenses, sometimes. This prevents a weird visualization
        if (stringifiedTitle.includes("Nonoperating revenues (expenses)")) {
          from = "Nonoperating expenses (revenues)";
        } else { from = obj.category; }
      } else {
        from = obj.name;
        to = obj.category;
      }
    } 
    
    // Add the link object to links
    links.push({
      source: from,
      target: to,
      // nonoperating revenues can be negative. No negatives!
      value: Math.abs(obj.value),
    });
  }
  console.log(links);
  return links;
}

function jmuNodesAndLinks(unwrangledData) {
  // creates sankey-schema-compliant object, with keys of arrays with objs
  // this'll be returned at the end
  let revsAndExps = unwrangledData["jmu-revenues"];
  let allNodes = wrangleKeys(revsAndExps);
  let data = {
    "nodes": wrangleKeys(revsAndExps),
    "links": createLinks(allNodes),
  };
  return data;
}

async function init() {
  //  TRANSFORM INTO THE FOLLOWING FORMAT:
  //  {
  //   name: N (unique integer)
  //   value: "Value: X" (number/whatever)
  //   title: "string"
  //   category: X (something)
  //  }
  //  ------------------
  //  {
  //   source: N1 (the same unique integer whatever you want at the start has)
  //   target: N2 (the same unique integer whatever you want at the end has)
  //   value: X (some number)
  //  }
  // If a node does not appear as a target, or a source, it'll be at the leftmost/rightmost


  const unwrangledData = await d3.json("data/jmu.json");
  const data = jmuNodesAndLinks(unwrangledData);

  // ALERT! LEAVE 28 AND BELOW AS IS

  // Applies it to the data. We make a copy of the nodes and links objects
  // so as to avoid mutating the original.
  const { nodes, links } = sankey({
    // const tmp = sankey({
    nodes: data.nodes.map(d => Object.assign({}, d)),
    links: data.links.map(d => Object.assign({}, d))
  });

  // console.log('tmp', tmp);
  console.log('nodes', nodes);
  console.log('links', links);

  // Defines a color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // Creates the rects that represent the nodes.
  const rect = svg.append("g")
    .attr("stroke", "#000")
    .selectAll()
    .data(nodes)
    .join("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => color(d.category));

  // Adds a title on the nodes.
  rect.append("title")
    .text(d => {
      console.log('d', d);
      return `${d.name}\n${format(d.value)}`
    });

  // Creates the paths that represent the links.
  const link = svg.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll()
    .data(links)
    .join("g")
    .style("mix-blend-mode", "multiply");

  // Creates a gradient, if necessary, for the source-target color option.
  if (linkColor === "source-target") {
    const gradient = link.append("linearGradient")
      .attr("id", d => (d.uid = `link-${d.index}`))
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", d => d.source.x1)
      .attr("x2", d => d.target.x0);
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", d => color(d.source.category));
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", d => color(d.target.category));
  }

  link.append("path")
    .attr("d", d3Sankey.sankeyLinkHorizontal())
    .attr("stroke", linkColor === "source-target" ? (d) => `url(#${d.uid})`
      : linkColor === "source" ? (d) => color(d.source.category)
        : linkColor === "target" ? (d) => color(d.target.category)
          : linkColor)
    .attr("stroke-width", d => Math.max(1, d.width));

  link.append("title")
    .text(d => `${d.source.name} → ${d.target.name}\n${format(d.value)}`);

  // Adds labels on the nodes.
  svg.append("g")
    .selectAll()
    .data(nodes)
    .join("text")
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => d.title);

  // Adds labels on the links.
  svg.append("g")
    .selectAll()
    .data(links)
    .join("text")
    .attr("x", d => {
      console.log('linkd', d)
      const midX = (d.source.x1 + d.target.x0) / 2;
      return midX < width / 2 ? midX + 6 : midX - 6
    })
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => {
      console.log('linkd', d);
      return `${d.source.title} → ${d.value} → ${d.target.title}`
    });

  const svgNode = svg.node();
  document.body.appendChild(svgNode);
  return svgNode;
}

init();