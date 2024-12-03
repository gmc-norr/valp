process CSV_TO_JSON {
    tag "${meta.id}"

    input:
    tuple val(meta), path(csv)

    output:
    tuple val(meta), path("*.json"), emit: json

    script:
    def prefix = task.ext.prefix ?: "${meta.id}"
    """
    csv_to_json.py -o ${prefix}.json ${csv}
    """
}
