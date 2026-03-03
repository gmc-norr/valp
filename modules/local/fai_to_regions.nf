process FAI_TO_REGIONS {
    tag "${meta.id}"

    input:
    tuple val(meta), path(fai)
    val(include_chr)

    output:
    tuple val(meta), path("*.tsv"), emit: region_file

    script:
    def chroms = include_chr ? "--include ${include_chr.join(',')}" : ""
    def prefix = task.ext.prefix ?: "${meta.id}.regions"
    """
    fai_to_regions.py \\
        ${chroms} \\
        ${fai} > ${prefix}.tsv
    """
}
