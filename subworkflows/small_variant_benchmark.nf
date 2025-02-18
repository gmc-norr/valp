include { HAPPY_HAPPY } from '../modules/nf-core/happy/happy/main.nf'
include { SNV_AF_COMPARISON } from '../modules/local/snv_af_comparison.nf'
include { TABIX_TABIX as QUERY_TABIX } from '../modules/nf-core/tabix/tabix/main.nf'
include { TABIX_TABIX as TRUTH_TABIX } from '../modules/nf-core/tabix/tabix/main.nf'
include { BCFTOOLS_NORM as QUERY_BCFTOOLS_NORM } from '../modules/nf-core/bcftools/norm/main.nf'
include { BCFTOOLS_NORM as TRUTH_BCFTOOLS_NORM } from '../modules/nf-core/bcftools/norm/main.nf'

workflow SMALL_VARIANT_BENCHMARK {
    take:
    vcf_pairs
    regions
    target
    fasta
    fai

    main:
    // Only consider id and genome when joining
    vcf_pairs
        .map { meta, query, truth -> [[id: meta.id, genome: meta.genome], meta, query, truth] }
        .join(regions)
        .join(target)
        .map { _meta1, meta2, query, truth, reg_bed, tgt_bed ->
            [meta2, query, truth, reg_bed, tgt_bed]
        }
        .set { ch_comparison_input }

    HAPPY_HAPPY(
        ch_comparison_input,
        fasta,
        fai,
        [[], []],
        [[], []],
        [[], []]
    )

    ch_comparison_input
        .multiMap { meta, query, truth, _reg_bed, _tgt_bed ->
            query_vcf: [[id: meta.id, genome: meta.genome], query]
            truth_vcf: [[id: meta.id, genome: meta.genome], truth]
        }
        .set { query_truth_ch }

    QUERY_TABIX(query_truth_ch.query_vcf)
    TRUTH_TABIX(query_truth_ch.truth_vcf)

    query_truth_ch.query_vcf
        .join(QUERY_TABIX.out.tbi)
        .set { query_vcf_ch }

    query_truth_ch.truth_vcf
        .join(TRUTH_TABIX.out.tbi)
        .set { truth_vcf_ch }

    query_vcf_ch
        .join(fasta.map { meta, fa -> [[id: meta.id, genome: meta.genome], fa]})
        .map { meta, _vcf, _tbi, fa -> [meta, fa] }
        .set { query_fasta_ch }

    truth_vcf_ch
        .join(fasta.map { meta, fa -> [[id: meta.id, genome: meta.genome], fa]})
        .map { meta, _vcf, _tbi, fa -> [meta, fa] }
        .set { truth_fasta_ch }

    QUERY_BCFTOOLS_NORM(query_vcf_ch, query_fasta_ch)
    TRUTH_BCFTOOLS_NORM(truth_vcf_ch, truth_fasta_ch)

    HAPPY_HAPPY.out.vcf
        .map { meta, vcf ->
            [[id: meta.id, genome: meta.genome], vcf]
        }
        .join(QUERY_BCFTOOLS_NORM.out.vcf.filter { _meta, vcf -> vcf.name =~ /.+\.query\.norm\.vcf\.gz/ })
        .join(QUERY_BCFTOOLS_NORM.out.tbi.filter { _meta, tbi -> tbi.name =~ /.+\.query\.norm\.vcf\.gz\.tbi/ })
        .join(TRUTH_BCFTOOLS_NORM.out.vcf.filter { _meta, vcf -> vcf.name =~ /.+\.truth\.norm\.vcf\.gz/ })
        .join(TRUTH_BCFTOOLS_NORM.out.tbi.filter { _meta, tbi -> tbi.name =~ /.+\.truth\.norm\.vcf\.gz\.tbi/ })
        .set { benchmark_vcf_ch }

    SNV_AF_COMPARISON(
        benchmark_vcf_ch
    )

    emit:
    happy_summary = HAPPY_HAPPY.out.summary_csv
    happy_extended = HAPPY_HAPPY.out.extended_csv
    snv_af_comparison = SNV_AF_COMPARISON.out.tsv
}
