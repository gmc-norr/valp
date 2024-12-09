include { BENCHMARK_REPORT } from '../modules/local/benchmark_report.nf'
include { CSV_TO_JSON as SUMMARY_TO_JSON } from '../modules/local/csv_to_json.nf'
include { CSV_TO_JSON as EXTENDED_TO_JSON } from '../modules/local/csv_to_json.nf'

workflow REPORTING {
    take:
    happy_summaries
    happy_extended
    coverage_stats

    main:
    // Convert csv to json
    SUMMARY_TO_JSON(happy_summaries)
    EXTENDED_TO_JSON(happy_extended)

    SUMMARY_TO_JSON.out.json
        .join(EXTENDED_TO_JSON.out.json)
        .set { ch_all_results }

    ch_all_results
        .collectFile(newLine: false, keepHeader: true){ meta, summary, extended ->
            ["report_input_files.csv", "id,genome,original_truth_genome,truthset_name,queryset_name,happy_summary,happy_extended\n${meta.id},${meta.genome},${meta.original_truth_genome},${meta.truthset_name},${meta.queryset_name},${summary},${extended}\n"]
        }
        .map { [[id: "all"], it] }
        .set { ch_happy_files }

    coverage_stats
        .collectFile(newLine: false, keepHeader: true){ meta, json ->
            ["report_coverage_json_files.csv", "id,sample,genome,json\n${meta.id},${meta.sample},${meta.genome},${json}\n"]
        }
        .map { [[id: "all"], it] }
        .set { ch_coverage_files }
    
    Channel.fromPath("${projectDir}/assets/report_template.html").first().set { ch_template }
    Channel.fromPath([
        "${projectDir}/assets/d3.v7.min.js",
        "${projectDir}/assets/main.js",
        "${projectDir}/assets/coverage_plots.js"
    ]).collect().set { ch_js }
    Channel.fromPath(["${projectDir}/assets/report_style.css"]).collect().set { ch_css }

    BENCHMARK_REPORT(
        ch_happy_files,
        ch_coverage_files,
        ch_template,
        ch_js,
        ch_css
    )

    // emit:
    // html = BENCHMARK_REPORT.out.html
}
