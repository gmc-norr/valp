process SNV_AF_COMPARISON {
    tag "${meta.id}"
    container "${ workflow.containerEngine == 'singularity' && !task.ext.singularity_pull_docker_container ?
            'https://depot.galaxyproject.org/singularity/bcftools:1.20--h8b25389_0':
            'biocontainers/bcftools:1.20--h8b25389_0' }"

    input:
    tuple val(meta), path(happy_vcf), path(query_vcf), path(query_tbi), path(truth_vcf), path(truth_tbi)

    output:
    tuple val(meta), path("*.tsv"), emit: tsv

    script:
    """
    bcftools view \\
        -i 'FORMAT/BD[0]=\"TP\" && FORMAT/BD[1]=\"TP\" && FORMAT/BVT[0]=\"SNP\"' \\
        -H \\
        ${happy_vcf} | \\
    cut -f1,2 > snv_positions

    bcftools query \\
        -R snv_positions \\
        -i 'TYPE="snp"' \\
        -f '%CHROM\\t%POS\\t%REF\\t%ALT\\t[%AD]'\\
        ${query_vcf} | \\
    awk 'BEGIN {FS=\"\\t\"; OFS=\"\\t\"} {
        split(\$5, ad, \",\");
        d = 0;
        for (key in ad) {
            d += ad[key];
        }
        af = "NA"
        if (d > 0) {
            af = ""
            for (i = 2; i <= length(ad); ++i) {
                if (i == length(ad)) {
                    af = sprintf("%s%s", af, ad[i] / d)
                } else {
                    af = sprintf("%s%s,", af, ad[i] / d)
                }
            }
        }
        print \$0, af;
    }' | \\
    sort -k1,1 -k2,2n -k3,3 -k4,4 \\
    > query_af

    bcftools query \\
        -R snv_positions \\
        -i 'TYPE="snp"' \\
        -f '%CHROM\\t%POS\\t%REF\\t%ALT\\t[%AD]'\\
        ${truth_vcf} | \\
    awk 'BEGIN {FS=\"\\t\"; OFS=\"\\t\"} {
        split(\$5, ad, \",\");
        d = 0;
        for (key in ad) {
            d += ad[key];
        }
        af = "NA"
        if (d > 0) {
            af = ""
            for (i = 2; i <= length(ad); ++i) {
                if (i == length(ad)) {
                    af = sprintf("%s%s", af, ad[i] / d)
                } else {
                    af = sprintf("%s%s,", af, ad[i] / d)
                }
            }
        }
        print \$0, af;
    }' | \\
    sort -k1,1 -k2,2n -k3,3 -k4,4 \\
    > truth_af

    echo -e \"query_chrom\\tquery_pos\\tquery_ref\\tquery_alt\\tquery_ad\\tquery_af\\ttruth_chrom\\ttruth_pos\\ttruth_ref\\ttruth_alt\\ttruth_ad\\ttruth_af\" > ${meta.id}.af_comparison.tsv
    paste query_af truth_af >> ${meta.id}.af_comparison.tsv

    if [ \$(awk '\$1 == \$7 && \$2 != \$8' | wc -l) -gt 0 ]; then
        echo >&2 \"truth and query out of sync\"
        exit 1
    fi
    """
}
