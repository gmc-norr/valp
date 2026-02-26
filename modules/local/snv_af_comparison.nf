process SNV_AF_COMPARISON {
    tag "${meta.id}"
    container "oras://community.wave.seqera.io/library/cyvcf2_pip_click:8e3810ffbdcc3966"

    input:
    tuple val(meta), path(happy_vcf), path(query_vcf), path(query_tbi), path(truth_vcf), path(truth_tbi)

    output:
    tuple val(meta), path("*.tsv"), emit: tsv

    script:
    """
    snv_af_comparison.py ${happy_vcf} ${truth_vcf} ${query_vcf} > ${meta.id}.af_comparison.tsv
    """
}
