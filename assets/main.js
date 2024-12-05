const infoBoxes = d3.selectAll(".comparison-info");
const tableRows = d3.selectAll("tbody tr");

infoBoxes.on("mouseenter", (evt) => {
  const compId = evt.target.dataset.id;
  const tableRows = d3.selectAll(`tr[data-id="${compId}"]`);
  tableRows.classed("highlight", true);
});

infoBoxes.on("mouseleave", (evt) => {
  const compId = evt.target.dataset.id;
  const tableRows = d3.selectAll(`tr[data-id="${compId}"]`);
  tableRows.classed("highlight", false);
});

tableRows.on("mouseenter", (evt) => {
  const compId = evt.target.dataset.id;
  d3.select(`.comparison-info[data-id="${compId}"]`)
    .classed("highlight", true);
});

tableRows.on("mouseleave", (evt) => {
  const compId = evt.target.dataset.id;
  d3.select(`.comparison-info[data-id="${compId}"]`)
    .classed("highlight", false);
});
