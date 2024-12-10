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
        .map { x -> x[5] != x[2] }
        .merge(ch_original_input)
        .map { x -> [
            [
                id: i++,
                truthset_name: x[1],
                truth_genome: x[3],
                queryset_name: x[4],
                query_genome: x[6],
                liftover: x[0]
            ],
            [x[2], x[5], x[7], x[8], x[9], x[10]]
        ]}
        .multiMap { meta, files ->
            truth: [
                [
                    id: meta.id,
                    sample: meta.truthset_name,
                    genome: meta.truth_genome,
                    type: "truth",
                    liftover: meta.liftover,
                    liftover_to: meta.liftover ? meta.query_genome : null,
                ],
                files[0]
            ]
            query: [
                [
                    id: meta.id,
                    sample: meta.queryset_name,
                    genome: meta.query_genome,
                    type: "query",
                    liftover: false,
                    liftover_to: null,
                ],
                files[1]
            ] 
            conf_regions: [[id: meta.id, genome: meta.query_genome], files[2]]
            limit_regions: [[id: meta.id, genome: meta.query_genome], files[3]]
            d4: [[id: meta.id, sample: meta.queryset_name, genome: meta.query_genome], files[4]]
            coverage_regions: [[id: meta.id, sample: meta.queryset_name, genome: meta.query_genome], files[5]]
        }
        .set { ch_comparisons }

    emit:
    truthset = ch_comparisons.truth
    queryset = ch_comparisons.query
    confRegions = ch_comparisons.conf_regions
    limitRegions = ch_comparisons.limit_regions
    d4 = ch_comparisons.d4
    coverage_regions = ch_comparisons.coverage_regions
}
