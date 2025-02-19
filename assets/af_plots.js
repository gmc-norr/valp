function afPointsPlot(config) {
    const data = config.data;
    const parent = config.parent;
    const id = config.id;
    const width = config.width ? config.width : 300;
    const height = config.height ? config.height : 300;
    const margin = {
        top: 20,
        right: 20,
        bottom: 50,
        left: 50,
    };

    if (data === undefined) {
        throw new Error("data can not be undefined");
    }
    if (parent === undefined) {
        throw new Error("data can not be undefined");
    }
    if (id === undefined) {
        throw new Error("data can not be undefined");
    }

    const svg = d3.select(parent)
        .append("svg")
        .attr("class", "block grow mb-6")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    const xScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, width - (margin.left + margin.right)]);
    const yScale = d3.scaleLinear()
        .domain([0, 1])
        .range([height - (margin.top + margin.bottom), 0]);

    const xAxis = (g) => g.call(d3.axisBottom(xScale));
    const yAxis = (g) => g.call(d3.axisLeft(yScale));

    svg
        .append("g")
        .attr("transform", `translate(${margin.left},${height - margin.bottom})`)
        .call(xAxis);

    svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .call(yAxis);

    svg
        .append("text")
        .attr("transform", `translate(${width / 2},${height})`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "after-edge")
        .text("Truth AF")

    svg
        .append("text")
        .attr("transform", `translate(0,${margin.top + (height - (margin.bottom + margin.top)) / 2}) rotate(270)`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "before-edge")
        .text("Query AF")

    const plotArea = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    plotArea
        .selectAll(".point")
        .data(data.af.truth.map((x, i) => {
            return {
                x: x,
                y: data.af.query[i],
            };
        }))
        .join("circle")
            .attr("cx", (d) => xScale(d.x))
            .attr("cy", (d) => yScale(d.y))
            .attr("r", 2)
            .attr("fill", "red");
}

for (plotData of Object.values(afData)) {
    switch (plotData.data.type) {
        case "points":
            console.log(`plotting points for ${plotData.id}`);
            afPointsPlot({
                id: plotData.id,
                parent: `#af-comparison-plot-${plotData.id}`,
                data: plotData.data,
            });
            break;
        case "hexbin":
            console.log(`plotting hexbin for ${plotData.id}`);
            console.warn("hexbin plotting not implemented yet");
            break;
        default:
            console.error(`invalid type for af plot: ${plotData.data.type}`);
            break;
    }
}
