include { HAPPY_HAPPY } from '../modules/nf-core/happy/happy/main'

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

    emit:
    happy_summary = HAPPY_HAPPY.out.summary_csv
    happy_extended = HAPPY_HAPPY.out.extended_csv
}
