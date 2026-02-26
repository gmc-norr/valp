include { BCFTOOLS_PLUGINLIFTOVER } from "../modules/local/bcftools_pluginliftover"
include { BCFTOOLS_SORT } from "../modules/nf-core/bcftools/sort/main"

workflow VCF_PREPROCESSING {
    take:
    in_vcf
    include_chr

    main:
    // Separate files into those that need liftover and the ones that don't
    ch_vcf = in_vcf
        .branch { meta, vcf -> 
            liftover: meta.liftover
            no_liftover: !meta.liftover
        }

    ch_liftover_refs = ch_vcf.liftover
        .multiMap { meta, vcf ->
            source_genome: params.references[meta.genome].fasta
            target_genome: params.references[meta.liftover_to].fasta
            chain_file: params.chainfiles[meta.genome][meta.liftover_to]
        }

    BCFTOOLS_PLUGINLIFTOVER(
        ch_vcf.liftover,
        ch_liftover_refs.source_genome,
        ch_liftover_refs.target_genome,
        ch_liftover_refs.chain_file
    )

    ch_liftover_vcf = BCFTOOLS_PLUGINLIFTOVER.out.vcf
        // Collect all VCFs in a single channel
        .mix(ch_vcf.no_liftover)

    BCFTOOLS_SORT(ch_liftover_vcf)

    emit:
    vcf = BCFTOOLS_SORT.out.vcf
}
