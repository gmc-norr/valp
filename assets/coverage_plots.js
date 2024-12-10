function all(x, f) {
    return x.every(f)
}

function roundToDecimals(v, d) {
    return Math.round(10 ** d * v) / 10 ** d
}

function showTooltip(evt, message) {
    evt.preventDefault();
    const [x, y] = [evt.clientX, evt.clientY];
    d3.select("body").selectAll(".mouse-tooltip")
        .data([1], (d) => d)
        .join(
            enter => enter
                .append("div")
                .attr("class", "mouse-tooltip")
                .style("position", "fixed")
                .style("top", `${y + 20}px`)
                .style("left", `${x}px`)
                .style("pointer-events", "none")
                .append("p")
                .html(message),
            update => update
                .style("top", `${y + 20}px`)
                .style("left", `${x}px`),
            exit => exit.remove()
        );
}

function hideTooltip() {
    d3.selectAll(".mouse-tooltip").remove();
}

function regionCoveragePlot(config) {
    const parent = config.parent ? config.parent : "body";
    const width = config.width ? config.width : 800;
    const height = config.height ? config.height : 200;
    const data = config.data;

    const margin = {
        top: 20,
        right: 20,
        bottom: 50,
        left: 60,
    };

    if (data === undefined) {
        throw Error("no data supplied to CoveragePlot")
    }

    const binSize = data.bin_size;
    const chromosome = data.chromosome;

    d3.select(parent)
        .select("p.plot-description")
        .text(`Coverage data across all chromosomes included in the analysis.
               Each point represents the average coverage for a ${binSize.toLocaleString()} bp region.
               Alternating colours denote chromosome boundaries.`)

    const minX = data.start;
    const maxX = data.end;
    const maxY = Math.max(5, data.coverage.reduce((acc, x) => x > acc ? x : acc));

    const svg = d3.select(parent)
        .selectAll("svg")
        .data([data])
        .join("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    xScale = d3.scaleLinear()
        .range([0, width - (margin.left + margin.right)])
        .domain([minX, maxX]);
    yScale = d3.scaleLinear()
        .range([height - (margin.bottom + margin.top), 0])
        .domain([0, maxY]);
    xAxis = (g) => g.call(
        d3.axisBottom(xScale)
            .tickFormat((x) => (x / 1e6).toLocaleString()));
    yAxis = (g) => g.call(d3.axisLeft(yScale).ticks(5));

    const areaGenerator = d3.area()
        .x((d) => xScale(d.x))
        .y0(yScale(0))
        .y1((d) => yScale(d.y));

    svg
        .selectAll(".x-axis")
        .data([xAxis])
        .join("g")
        .classed("x-axis", true)
        .attr("transform", `translate(${margin.left},${height - margin.bottom})`)
        .transition()
        .duration(300)
        .call(xAxis);

    svg
        .selectAll(".y-axis")
        .data([yAxis])
        .join("g")
        .classed("y-axis", true)
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .transition()
        .duration(300)
        .call(yAxis);

    svg
        .selectAll(".x-label") 
        .data((d) => [d.chromosome])
        .join(
            (enter) => enter
                .append("text")
                .classed("x-label", true)
                .attr("transform", `translate(${width / 2},${height})`)
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "after-edge")
                .attr("opacity", 0)
                .text((d) => `${d} genomic position (Mbp)`)
                .transition()
                .duration(300)
                .attr("opacity", 1),
            (update) => update
                .attr("opacity", 0)
                .transition()
                .duration(300)
                .text((d) => `${d} genomic position (Mbp)`)
                .attr("opacity", 1),
            (exit) => exit.remove()
        );

    svg
        .selectAll(".y-label")
        .data(["Coverage"])
        .join("text")
        .classed("y-label", true)
        .attr("transform", `translate(0,${margin.top + (height - (margin.bottom + margin.top)) / 2}) rotate(270)`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "before-edge")
        .text("Coverage");

    svg
        .selectAll(".plot-area")
        .data((d) => [d])
        .join("g")
        .classed("plot-area", true)
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .attr("fill", "#AAD1F2")
        .selectAll("path")
        .data((d) => {
            return [d.coverage.map((d, i) => {
                return {x: minX + i * binSize, y: d};
            })];
        })
        .join(
            (enter) => enter
                .append("path")
                .attr("d", (d) => areaGenerator(d)),
            (update) => update
                .transition()
                .duration(300)
                .attr("d", (d) => areaGenerator(d)),
            (exit) => exit.remove()
        );
}

function chromosomeCoveragePlot(config) {
    const parent = config.parent ? config.parent : "body";
    const width = config.width ? config.width : 800;
    const height = config.height ? config.height : 200;
    const data = config.data;

    const margin = {
        top: 20,
        right: 20,
        bottom: 50,
        left: 60,
    };

    if (data === undefined) {
        throw Error("no data supplied to CoveragePlot")
    }

    if (!all(data, (d) => d.bin_size === data[0].bin_size)) {
        throw Error("expected all chromosomes to have the same bin size")
    }

    const bin_size = data[0].bin_size;

    d3.select(parent)
        .select("p.plot-description")
        .text(`Coverage data across all chromosomes included in the analysis.
               Each point represents the average coverage for a ${bin_size.toLocaleString()} bp region.
               Alternating colours denote chromosome boundaries.`)

    const svg = d3.select(parent)
        .append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    const maxX = data.reduce((acc, x) => acc + x.length, 0);
    const maxY = data.reduce((acc, x) => {
        let chrMax = x.coverage.reduce((acc, x) => x > acc ? x : acc, 0);
        return chrMax > acc ? chrMax : acc;
    }, 0)

    xScale = d3.scaleLinear()
        .range([0, width - (margin.left + margin.right)])
        .domain([0, maxX]);
    yScale = d3.scaleLinear()
        .range([height - (margin.bottom + margin.top), 0])
        .domain([0, maxY]);
    xAxis = (g) => g.call(
        d3.axisBottom(xScale)
            .tickFormat((x) => (x / 1e6).toLocaleString()));
    yAxis = (g) => g.call(d3.axisLeft(yScale));

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
        .text("Genomic position (Mbp)")

    svg
        .append("text")
        .attr("transform", `translate(0,${margin.top + (height - (margin.bottom + margin.top)) / 2}) rotate(270)`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "before-edge")
        .text("Coverage")

    // Calculate cumulative positions to be able to plot all chromosomes
    // side by side.
    let cumulativeData = data.reduce((acc, d) => {
        return {
            cumulativeLength: acc.cumulativeLength + d.length,
            chromosomes: [...acc.chromosomes, {
                name: d.name,
                start: acc.cumulativeLength,
                end: acc.cumulativeLength + d.length,
                length: d.length,
                meanCoverage: d.mean_coverage,
            }],
            points: [...acc.points, ...(d.coverage.map((c, i) => {
                return {
                    x: acc.cumulativeLength + ((i + 1) * d.bin_size),
                    y: c,
                }
            }))],
        }
    }, { cumulativeLength: 0, chromosomes: [], points: [] });

    // Chromosome backgrounds
    svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .selectAll("chrom-background")
        .data(cumulativeData.chromosomes)
        .join("rect")
        .attr("transform", (d) => `translate(${xScale(d.start)},0)`)
        .attr("width", (d) => xScale(d.length))
        .attr("height", height - (margin.top + margin.bottom))
        .attr("fill", (_, i) => i % 2 === 0 ? "#FF7676" : "#AAD1F2")
        .attr("opacity", 0.5)
        .on("mouseenter mousemove", (evt, data) => {
            evt.preventDefault();
            const message = `${data.name}<br>mean cov: ${roundToDecimals(data.meanCoverage, 2)}`;
            showTooltip(evt, message);
        })
        .on("mouseleave", hideTooltip);

    // Coverage
    svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .selectAll("circle")
        .data(cumulativeData.points)
        .join("circle")
        .attr("cx", (d) => xScale(d.x))
        .attr("cy", (d) => yScale(d.y))
        .attr("r", 2)
        .on("mouseenter mousemove", (evt, data) => {
            evt.preventDefault();
            d3.select(evt.target).attr("r", 4);
            const message = `${roundToDecimals(data.y, 2)}`;
            showTooltip(evt, message);
        })
        .on("mouseleave", (evt) => {
            d3.select(evt.target).attr("r", 2);
            hideTooltip();
        });
}

for (plotData of coverageData) {
    chromosomeCoveragePlot({
        parent: `#global-coverage-${plotData.id}`,
        data: plotData.coverage.global_coverage,
    })
}

const coverageSelector = d3.selectAll(".coverage-region-selector");
coverageSelector.on("change", (evt) => {
    const regionIndex = +evt.target.value;
    const comparisonId = evt.target.dataset.id;
    regionCoveragePlot({
        parent: `.regional-coverage[data-id="${comparisonId}"]`,
        data: coverageData.filter((d) => d.id === comparisonId)[0].coverage.regional_coverage[regionIndex]
    });
});

for (cs of coverageSelector) {
    const regionIndex = +cs.value;
    const comparisonId = cs.dataset.id;
    regionCoveragePlot({
        parent: `.regional-coverage[data-id="${comparisonId}"]`,
        data: coverageData.filter((d) => d.id === comparisonId)[0].coverage.regional_coverage[regionIndex]
    });
}

