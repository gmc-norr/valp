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
        .map { meta1, meta2, query, truth, regions, target ->
            [meta2, query, truth, regions, target]
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
