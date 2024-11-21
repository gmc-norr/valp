include { HAPPY_HAPPY } from '../modules/nf-core/happy/happy/main'

workflow SMALL_VARIANT_BENCHMARK {
    take:
    vcf_pairs
    regions
    target
    fasta
    fai

    main:
    vcf_pairs
        .join(regions)
        .join(target)
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
    summary_csv = HAPPY_HAPPY.out.summary_csv
    extended_csv = HAPPY_HAPPY.out.extended_csv
}
