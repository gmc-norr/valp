include { BCFTOOLS_PLUGINLIFTOVER } from "../modules/local/bcftools_pluginliftover"
include { BCFTOOLS_SORT } from "../modules/nf-core/bcftools/sort/main"
include { BCFTOOLS_VIEW } from "../modules/nf-core/bcftools/view/main.nf"
include { FAI_TO_REGIONS } from "../modules/local/fai_to_regions.nf"

workflow VCF_PREPROCESSING {
    take:
    in_vcf
    include_chr

    main:
    // Separate files into those that need liftover and the ones that don't
    ch_vcf = in_vcf
        .branch { meta, _vcf -> 
            liftover: meta.liftover
            no_liftover: !meta.liftover
        }

    ch_liftover_refs = ch_vcf.liftover
        .multiMap { meta, _vcf ->
            source_genome: file(params.references[meta.genome].fasta)
            target_genome: file(params.references[meta.liftover_to].fasta)
            chain_file: file(params.chainfiles[meta.genome][meta.liftover_to])
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

    ch_indexed_vcf = BCFTOOLS_SORT.out.vcf
        .join(BCFTOOLS_SORT.out.tbi)

    // Create region definitions from the include config param together with the fasta index for the sample in question
    ch_fai = ch_indexed_vcf
        .map { meta, _vcf, _tbi -> [meta, file(params.references[meta.liftover_to ? meta.liftover_to : meta.genome].fai)] }
    ch_view_input = FAI_TO_REGIONS(ch_fai, include_chr)
        .join(ch_indexed_vcf)
        .multiMap { meta, regions, vcf, tbi ->
            vcf: [meta, vcf, tbi]
            regions: regions
        }

    BCFTOOLS_VIEW(ch_view_input.vcf, ch_view_input.regions, [], [])

    emit:
    vcf = BCFTOOLS_VIEW.out.vcf
}
