include { validateParameters } from "plugin/nf-schema"
include { samplesheetToList } from "plugin/nf-schema"

workflow PIPELINE_INITIALISATION {
    take:
    input // Path to input file

    main:
    validateParameters()

    Channel.fromList(samplesheetToList(input, "assets/schema_input.json"))
        .set { ch_input }

    // See if the truth needs to be translated to match the query set.
    def i = 1
    ch_input
        .tap { ch_original_input }
        .map { x -> x[3] != x[1] }
        .merge(ch_original_input)
        .map { x -> [
            [
                id: i++,
                truth_genome: x[2],
                query_genome: x[4],
                liftover: x[0]
            ],
            [x[1], x[3], x[5], x[6]]
        ]}
        .multiMap { meta, files ->
            truth: [
                [
                    id: meta.id,
                    genome: meta.truth_genome,
                    type: "truth",
                    liftover: meta.liftover,
                    liftover_to: meta.liftover ? meta.query_genome : null,
                    conf_regions: files[2]
                ],
                files[0]
            ]
            query: [
                [
                    id: meta.id,
                    genome: meta.query_genome,
                    type: "query",
                    liftover: false,
                    liftover_to: null,
                    conf_regions: meta.liftover ? files[3] : files[2]
                ],
                files[1]
            ] 
            conf_regions: [[id: meta.id, genome: meta.query_genome], files[2]]
            limit_regions: [[id: meta.id, genome: meta.query_genome], files[3]]
        }
        .set { ch_comparisons }

    emit:
    truthset = ch_comparisons.truth
    queryset = ch_comparisons.query
    confRegions = ch_comparisons.conf_regions
    limitRegions = ch_comparisons.limit_regions
}
