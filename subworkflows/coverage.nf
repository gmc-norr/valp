include { COVERAGE_STATS } from '../modules/local/coverage_stats.nf'

workflow COVERAGE {
    take:
    d4
    include_chr
    regions

    main:
    COVERAGE_STATS(
        d4,
        regions,
        include_chr
    )

    emit:
    coverage_json = COVERAGE_STATS.out.json
}
