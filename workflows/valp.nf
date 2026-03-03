include { VCF_PREPROCESSING } from '../subworkflows/vcf_preprocessing.nf'
include { SMALL_VARIANT_BENCHMARK } from '../subworkflows/small_variant_benchmark.nf'
include { REPORTING } from '../subworkflows/reporting.nf'
include { COVERAGE } from '../subworkflows/coverage.nf'

workflow VALP {
    take:
    truthset // queue channel with truth set VCFs (meta, vcf)
    queryset // queue channel with query set VCFs (meta, vcf)
    confRegions // queue channel with confident regions that should be used for comparison
    limitRegions // not used at the moment
    d4 // queue channel with d4 coverage files for the query (meta, d4)
    coverage_regions // queue channel with bed files for focused coverage analysis (meta, bed)

    main:
    ch_vcf = truthset
        .mix(queryset)
        .transpose()

    // At the moment only performs lift-over, if necessary
    VCF_PREPROCESSING(
        ch_vcf,
        params.include_chr,
    )

    // Create a new channel [meta, query_vcf, truth_vcf]
    // This will strip all the liftover information from the meta map
    // and add back information on the original genome version for both
    // query and truth sets.
    ch_processed_pairs = VCF_PREPROCESSING.out.vcf
        .map { meta, vcf -> [[
            id: meta.id,
            genome: meta.liftover ? meta.liftover_to : meta.genome,
        ], [type: meta.type, sample: meta.sample, original_genome: meta.genome, vcf: vcf]] }
        .groupTuple(size: 2, sort: { a, _b ->
            return a.type == 'query' ? -1 : 1
        })
        .map { meta, x -> [meta + [original_query_genome: x[0].original_genome, original_truth_genome: x[1].original_genome, queryset_name: x[0].sample, truthset_name: x[1].sample], x[0].vcf, x[1].vcf] }

    ch_comparison_ref = ch_processed_pairs
        .multiMap { meta, _query, _truth ->
            fasta: [meta, params.references[meta.genome].fasta]
            fai: [meta, params.references[meta.genome].fai]
        }

    // Run the small variant benchmarking.
    SMALL_VARIANT_BENCHMARK(
        ch_processed_pairs,
        confRegions,
        limitRegions,
        ch_comparison_ref.fasta,
        ch_comparison_ref.fai,
    )

    ch_coverage = d4
        .filter { _meta, cov -> cov != [] }
        .join(coverage_regions)
        .multiMap { meta, cov, bed ->
            d4: [meta, cov]
            bed: [meta, bed]
        }

    COVERAGE(
        ch_coverage.d4,
        params.include_chr,
        ch_coverage.bed
    )

    REPORTING(
        SMALL_VARIANT_BENCHMARK.out.happy_summary,
        SMALL_VARIANT_BENCHMARK.out.happy_extended,
        SMALL_VARIANT_BENCHMARK.out.snv_af_comparison,
        COVERAGE.out.coverage_json
    )
}
