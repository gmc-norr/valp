include { VCF_PREPROCESSING } from '../subworkflows/vcf_preprocessing.nf'
include { SMALL_VARIANT_BENCHMARK } from '../subworkflows/small_variant_benchmark.nf'
include { REPORTING } from '../subworkflows/reporting.nf'

workflow VALP {
    take:
    truthset // queue channel with truth set VCFs (meta, vcf)
    queryset // queue channel with query set VCFs (meta, vcf)
    confRegions // queue channel with confident regions that should be used for comparison
    limitRegions // not used at the moment

    main:
    truthset
        .mix(queryset)
        .transpose()
        .set { ch_vcf }

    // At the moment only performs lift-over, if necessary
    VCF_PREPROCESSING(
        ch_vcf,
        params.include_chr
    )

    // Create a new channel [meta, query_vcf, truth_vcf]
    // This will strip all the liftover information from the meta map
    // and add back information on the original genome version for both
    // query and truth sets.
    VCF_PREPROCESSING.out.vcf
        .map { meta, vcf -> [[
            id: meta.id,
            genome: meta.liftover ? meta.liftover_to : meta.genome,
        ], [type: meta.type, original_genome: meta.genome, vcf: vcf]] }
        .groupTuple(size: 2, sort: { a, b ->
            return a.type == 'query' ? -1 : 1
        })
        .map { meta, x -> [meta + [original_query_genome: x[0].original_genome, original_truth_genome: x[1].original_genome], x[0].vcf, x[1].vcf] }
        .set { ch_processed_pairs }

    ch_processed_pairs
        .multiMap { meta, query, truth ->
            fasta: [meta, params.references[meta.genome].fasta]
            fai: [meta, params.references[meta.genome].fai]
        }
        .set { ch_comparison_ref }

    // Run the small variant benchmarking. This only includes hap.py at the moment.
    SMALL_VARIANT_BENCHMARK(
        ch_processed_pairs,
        confRegions,
        limitRegions,
        ch_comparison_ref.fasta,
        ch_comparison_ref.fai
    )

    REPORTING(
        SMALL_VARIANT_BENCHMARK.out.happy_summary,
        SMALL_VARIANT_BENCHMARK.out.happy_extended
    )
}
