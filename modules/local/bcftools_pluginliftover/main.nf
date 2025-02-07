process BCFTOOLS_PLUGINLIFTOVER {
    tag "$meta.id"
    
    container "${ workflow.containerEngine == 'singularity' && !task.ext.singularity_pull_docker_container ?
            'https://depot.galaxyproject.org/singularity/bcftools:1.20--h8b25389_0':
            'biocontainers/bcftools:1.20--h8b25389_0' }"

    input:
    tuple val(meta), path(vcf)
    path(source_ref, name: "source.fa")
    path(target_ref, name: "target.fa")
    path(chain_file)

    output:
    tuple val(meta), path("*.liftover.vcf.gz"), emit: vcf
    tuple val(meta), path("*.rejected.vcf.gz"), emit: rejected_vcf

    script:
    def plugin_path = task.ext.plugin_path ?: ''
    def prefix = task.ext.prefix ?: "${meta.id}"
    def extra = task.ext.extra ?: ""
    
    """
    bcftools +${plugin_path} \
        -Oz \
        -o ${prefix}.liftover.vcf.gz \
        ${vcf} \
        -- \
        -s ${source_ref} \
        -f ${target_ref} \
        -c ${chain_file} \
        -Oz \
        --write-reject \
        --reject ${prefix}.rejected.vcf.gz \
        ${extra}
    """
}
