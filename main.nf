include { PIPELINE_INITIALISATION } from "./subworkflows/initialisation"
include { VALP } from "./workflows/valp"

workflow {
    PIPELINE_INITIALISATION(params.input)

    VALP (
        PIPELINE_INITIALISATION.out.truthset,
        PIPELINE_INITIALISATION.out.queryset,
        PIPELINE_INITIALISATION.out.confRegions,
        PIPELINE_INITIALISATION.out.limitRegions
    )
}
