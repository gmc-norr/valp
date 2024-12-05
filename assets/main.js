const infoBoxes = d3.selectAll(".comparison-info");
const tableRows = d3.selectAll("tbody tr");

infoBoxes.on("mouseenter", (evt) => {
  const compId = evt.target.dataset.id;
  const tableRows = d3.selectAll(`tr[data-id="${compId}"]`);
  evt.target.classList.add("bg-blue-200");
  tableRows.classed("bg-blue-200", true);
});

infoBoxes.on("mouseleave", (evt) => {
  const compId = evt.target.dataset.id;
  const tableRows = d3.selectAll(`tr[data-id="${compId}"]`);
  evt.target.classList.remove("bg-blue-200");
  tableRows.classed("bg-blue-200", false);
});

tableRows.on("mouseenter", (evt) => {
  const compId = evt.target.dataset.id;
  evt.target.classList.add("bg-blue-200");
  d3.select(`.comparison-info[data-id="${compId}"]`)
    .classed("bg-blue-200", true);
});

tableRows.on("mouseleave", (evt) => {
  const compId = evt.target.dataset.id;
  evt.target.classList.remove("bg-blue-200");
  d3.select(`.comparison-info[data-id="${compId}"]`)
    .classed("bg-blue-200", false);
});
