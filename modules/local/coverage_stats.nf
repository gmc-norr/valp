process COVERAGE_STATS {
    tag "${meta.id}"

    input:
    tuple val(meta), path(d4)
    tuple val(meta2), path(bed)
    val(include_chr)

    output:
    tuple val(meta), path("*.json"), emit: json

    script:
    def include = include_chr ? "--include ${include_chr.join(',')}" : ""
    def prefix = task.ext.prefix ?: "${meta.id}"
    def regions = bed ? "--regions ${bed}" : ""
    """
    coverage_stats.py \\
        ${include} \\
        ${regions} \\
        ${d4} > ${prefix}.json
    """
}
