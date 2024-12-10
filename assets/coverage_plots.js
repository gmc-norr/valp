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