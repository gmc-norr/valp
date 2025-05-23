function all(x, f) {
    return x.every(f);
}

function roundToDecimals(v, d) {
    return Math.round(10 ** d * v) / 10 ** d;
}

function showTooltip(evt, message) {
    evt.preventDefault();
    const [x, y] = [evt.clientX, evt.clientY];
    d3.select("body").selectAll(".mouse-tooltip")
        .data([1], (d) => d)
        .join(
            enter => enter
                .append("div")
                .attr("class", "mouse-tooltip bg-gray-100 rounded border border-gray-400 text-sm px-3 py-2 opacity-75")
                .style("position", "fixed")
                .style("top", `${y + 20}px`)
                .style("left", `${x}px`)
                .style("pointer-events", "none")
                .append("p")
                .html(message),
            update => update
                .style("top", `${y + 20}px`)
                .style("left", `${x}px`)
                .html(message),
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
    const threshold = config.threshold;
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

    const minX = data.start;
    const maxX = data.end;
    const maxY = 1.1 * Math.max(5, data.coverage.reduce((acc, x) => x > acc ? x : acc));

    const svg = d3.select(parent)
        .selectAll("svg")
        .data([data])
        .join("svg")
        .attr("class", "block w-full max-w-screen-2xl h-full grow mb-6")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    const plotArea = svg
        .selectAll(".plot-area")
        .data((d) => {
            return [d.coverage.map((d, i) => {
                return {x: minX + i * binSize, y: d};
            })];
        })
        .join("g")
        .classed("plot-area", true)
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
        .range([0, width - (margin.left + margin.right)])
        .domain([minX, maxX]);
    const yScale = d3.scaleLinear()
        .range([height - (margin.bottom + margin.top), 0])
        .domain([0, maxY]);
    const xAxis = (g) => g.call(
        d3.axisBottom(xScale)
            .tickFormat((x) => (x / 1e6).toLocaleString()));
    const yAxis = (g) => g.call(d3.axisLeft(yScale).ticks(5));

    const lineGenerator = d3.line()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y));

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

    function updateMouseMarker(d) {
        plotArea
            .selectAll(".mouse-marker")
            .data([d])
            .join("circle")
            .attr("class", "mouse-marker")
            .attr("cx", (d) => xScale(d.x))
            .attr("cy", (d) => yScale(d.y))
            .attr("r", 3)
            .attr("stroke", "black")
            .attr("fill", "firebrick")
            .attr("pointer-events", "none");
    }

    function hideMouseMarker() {
        plotArea.selectAll(".mouse-marker").remove();
    }

    const bisector = d3.bisector((d) => d.x);

    // Add a background
    plotArea
        .selectAll("rect")
        .data([1])
        .join("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width - (margin.left + margin.right))
        .attr("height", height - (margin.top + margin.bottom))
        .attr("fill", "white");

    plotArea
        .on("mouseenter mousemove", (evt, d) => {
            evt.preventDefault();
            const mouseX = d3.pointer(evt)[0];
            const xPos = xScale.invert(mouseX);
            const idx = bisector.center(d, xPos)
            const p = d[idx];
            const message = `cov: ${roundToDecimals(p.y, 2).toLocaleString()}`;
            showTooltip(evt, message);
            updateMouseMarker(p);
        })

    plotArea
        .on("mouseleave", () => {
            hideTooltip();
            hideMouseMarker();
        })

    plotArea
        .selectAll("path")
        .data((d) => [d])
        .join(
            (enter) => enter
                .append("path")
                .attr("d", (d) => lineGenerator(d))
                .attr("fill", "transparent")
                .attr("stroke", "black"),
            (update) => update
                .transition()
                .duration(300)
                .attrTween("d", function(d) {
                    let previous = d3.select(this).attr("d");
                    let current = lineGenerator(d);
                    return d3.interpolatePath(previous, current);
                }),
            (exit) => exit.remove()
        );

    // Threshold
    if (threshold !== undefined) {
        svg
            .selectAll(".threshold-line")
            .data([threshold])
            .join("g")
            .attr("class", "threshold-line")
            .attr("transform", `translate(${margin.left},${margin.top})`)
            .selectAll("line")
            .data((d) => [d])
            .join(
                (enter) => enter
                    .append("line")
                    .attr("x1", 0)
                    .attr("x2", width - (margin.left + margin.right))
                    .attr("y1", (d) => yScale(d))
                    .attr("y2", (d) => yScale(d))
                    .attr("stroke", "red")
                    .attr("stroke-dasharray", "4")
                    .attr("pointer-events", "none"),
                (update) => update
                    .transition()
                    .duration(300)
                    .attr("y1", (d) => yScale(d))
                    .attr("y2", (d) => yScale(d)),
                (exit) => exit.remove()
            );
    }

    d3.select(parent)
        .selectAll("p.plot-description")
        .data([1])
        .join("p")
        .classed("plot-description", true)
        .text(`Each point represents the average coverage for a ${binSize.toLocaleString()} bp region.
               The average coverage is ${roundToDecimals(data.mean_coverage, 1).toLocaleString()} over
               ${data.length.toLocaleString()} bp.`)

    hideTooltip();
    hideMouseMarker();
}

function chromosomeCoveragePlot(config) {
    const id = config.id;
    const parent = config.parent ? config.parent : "body";
    const width = config.width ? config.width : 800;
    const height = config.height ? config.height : 200;
    const threshold = config.threshold;
    const data = config.data;
    const absoluteMaxY = 100;
    const margin = {
        top: 20,
        right: 20,
        bottom: 50,
        left: 60,
    };

    if (id === undefined) {
        throw Error("no id supplied");
    }

    if (data === undefined) {
        throw Error("no data supplied to CoveragePlot");
    }

    if (!all(data, (d) => d.bin_size === data[0].bin_size)) {
        throw Error("expected all chromosomes to have the same bin size");
    }

    const bin_size = data[0].bin_size;

    const svg = d3.select(parent)
        .append("svg")
        .attr("class", "block w-full max-w-screen-2xl h-full grow mb-6")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    const maxX = data.reduce((acc, x) => acc + x.length, 0);
    const maxY = data.reduce((acc, x) => {
        let chrMax = x.coverage.reduce((acc, x) => x > acc ? x : acc, 0);
        return chrMax > acc ? chrMax : acc;
    }, 0);

    let means = data.map((x) => x.mean_coverage);
    let lengths = data.map((x) => x.length);
    let mean_sum = means.map((x, i) => x * lengths[i]).reduce((acc, x) => acc + x, 0);
    let length_sum = lengths.reduce((acc, x) => acc + x);
    let mean_global_coverage = mean_sum / length_sum;

    let descriptionText = `Coverage data across all chromosomes included in the analysis.
               The mean autosomal coverage is ${roundToDecimals(mean_global_coverage, 1).toLocaleString()}.
               Each point represents the average coverage for a ${bin_size.toLocaleString()} bp region.
               Alternating colours denote chromosome boundaries.`;

    if (maxY > absoluteMaxY) {
        descriptionText += ` Coverage above ${absoluteMaxY} is hidden. Maximum coverage observed
            was ${Math.round(maxY)}.`
    }

    d3.select(parent)
        .select("p.plot-description")
        .text(descriptionText);

    const xScale = d3.scaleLinear()
        .range([0, width - (margin.left + margin.right)])
        .domain([0, maxX]);
    const yScale = d3.scaleLinear()
        .range([height - (margin.bottom + margin.top), 0])
        .domain([0, Math.min(absoluteMaxY, 1.1 * maxY)]);
    const xAxis = (g) => g.call(
        d3.axisBottom(xScale)
            .tickFormat((x) => (x / 1e6).toLocaleString()));
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
        .text("Genomic position (Mbp)")

    svg
        .append("text")
        .attr("transform", `translate(0,${margin.top + (height - (margin.bottom + margin.top)) / 2}) rotate(270)`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "before-edge")
        .text("Coverage")

    svg.append("clipPath")
        .attr("id", `plot-area-clip-${id}`)
        .append("rect")
        .attr("height", height - (margin.top + margin.bottom))
        .attr("width", width - (margin.left + margin.right));

    // Where chromosome backgrounds should be drawn
    const background = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Where all the plotting should happen
    const plotArea = svg
        .append("g") .attr("clip-path", `url(#plot-area-clip-${id})`)
        .attr("transform", `translate(${margin.left},${margin.top})`);

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
                medianCoverage: d.median_coverage,
            }],
            points: [...acc.points, ...(d.coverage.map((c, i) => {
                return {
                    x: acc.cumulativeLength + ((i + 1) * d.bin_size),
                    y: c,
                }
            }))],
        }
    }, { cumulativeLength: 0, chromosomes: [], points: [] });

    function updateMouseMarker(d) {
        plotArea
            .selectAll(".mouse-marker")
            .data([d])
            .join("circle")
            .attr("class", "mouse-marker")
            .attr("cx", (d) => xScale(d.x))
            .attr("cy", (d) => yScale(d.y))
            .attr("r", 3)
            .attr("stroke", "black")
            .attr("fill", "firebrick")
            .attr("pointer-events", "none");
    }

    function hideMouseMarker() {
        plotArea.selectAll(".mouse-marker").remove();
    }

    const bisector = d3.bisector((d) => d.x)

    // Chromosome backgrounds
    background
        .selectAll(".chrom-background")
        .data(cumulativeData.chromosomes)
        .join("rect")
        .attr("class", "chrom-background")
        .attr("transform", (d) => `translate(${xScale(d.start)},0)`)
        .attr("width", (d) => xScale(d.length))
        .attr("height", height - (margin.top + margin.bottom))
        .attr("fill", (_, i) => i % 2 === 0 ? "#FF7676" : "#AAD1F2")
        .attr("opacity", 0.5)
        .on("mouseenter mousemove", (evt, data) => {
            evt.preventDefault();
            const mouseX = d3.pointer(evt, evt.currentTarget.parentElement)[0];
            const xPos = xScale.invert(mouseX);
            const idx = bisector.center(cumulativeData.points, xPos)
            const p = cumulativeData.points[idx];
            const message = `${data.name}<br>mean cov: ${roundToDecimals(data.meanCoverage, 2)}<br>median cov: ${data.medianCoverage}<br>cov: ${roundToDecimals(p.y, 2).toLocaleString()}`;
            showTooltip(evt, message);
            updateMouseMarker(p);
        })
        .on("mouseleave", () => {
            hideTooltip();
            hideMouseMarker();
        });

    // Coverage
    plotArea
        .selectAll("path")
        .data([cumulativeData.points])
        .join("path")
        .attr("d", d3.line().x((d) => xScale(d.x)).y((d) => yScale(d.y)))
        .attr("fill", "transparent")
        .attr("stroke", "black")
        .attr("pointer-events", "none");

    // Threshold
    if (threshold !== undefined) {
        svg
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`)
            .selectAll("line")
            .data([threshold])
            .join("line")
            .attr("x1", 0)
            .attr("x2", width - (margin.left + margin.right))
            .attr("y1", (d) => yScale(d))
            .attr("y2", (d) => yScale(d))
            .attr("stroke", "red")
            .attr("stroke-dasharray", "4")
            .attr("pointer-events", "none");
    }
}

for (plotData of coverageData) {
    const coverageThreshold = thresholds.filter((d) => d.name === "Coverage")[0].value;
    chromosomeCoveragePlot({
        id: plotData.id,
        parent: `#global-coverage-${plotData.id}`,
        data: plotData.coverage.global_coverage,
        threshold: coverageThreshold,
    });
}

function plotRegionCoverage(id, region) {
    const d = coverageData.filter((d) => d.id === id)[0].coverage.regional_coverage;
    const regionData = d.filter((d) => d.name === region)[0];
    const coverageThreshold = thresholds.filter((d) => d.name === "Coverage")[0].value;
    if (regionData === undefined) {
        throw Error(`no data found for region ${region}`);
    }
    regionCoveragePlot({
        parent: `.regional-coverage[data-id="${id}"]`,
        data: regionData,
        threshold: coverageThreshold,
    });
}

const coverageSelector = d3.selectAll(".coverage-region-selector");
coverageSelector.on("change", (evt) => {
    const comparisonId = evt.target.dataset.id;
    const regionName = evt.target.value;
    plotRegionCoverage(comparisonId, regionName);
});

for (cs of coverageSelector) {
    const comparisonId = cs.dataset.id;
    const regionName = cs.value;
    plotRegionCoverage(comparisonId, regionName);
}

