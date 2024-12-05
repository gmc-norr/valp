include { PIPELINE_INITIALISATION } from "./subworkflows/initialisation.nf"
include { VALP } from "./workflows/valp.nf"

workflow {
    PIPELINE_INITIALISATION(params.input)

    VALP (
        PIPELINE_INITIALISATION.out.truthset,
        PIPELINE_INITIALISATION.out.queryset,
        PIPELINE_INITIALISATION.out.confRegions,
        PIPELINE_INITIALISATION.out.limitRegions,
        PIPELINE_INITIALISATION.out.d4
    )
}
