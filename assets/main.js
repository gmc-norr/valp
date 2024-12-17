d3.selectAll(".region-navigation")
  .on("click", function(evt) {
    const comparisonId = evt.target.dataset.id;
    const regionName = evt.target.dataset.region;
    const plotSelect = d3.select(`.coverage-region-selector[data-id="${comparisonId}"]`);
    plotSelect.node().value = regionName;
    plotSelect.node().dispatchEvent(new Event("change"));
  });
