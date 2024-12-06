process BENCHMARK_REPORT {
    tag "${meta.id}"
    container 'community.wave.seqera.io/library/pip_jinja2_click:e68c7851fdf3218a'

    input:
    tuple val(meta), val(happy_output)
    tuple val(meta2), val(coverage_csv)
    val(report_template)
    val(js)
    val(css)

    output:
    tuple val(meta), path("*.html"), emit: html

    script:
    def prefix = task.ext.prefix ?: "${meta.id}"
    def template_arg = "--template ${report_template}"
    def css_arg = css.collect { "--css ${it}" }.join(" ")
    def js_arg = js.collect { "--js ${it}" }.join(" ")
    """
    benchmark_report.py \\
        ${css_arg} \\
        ${js_arg} \\
        ${template_arg} \\
        --happy-csv ${happy_output} \\
        --coverage-csv ${coverage_csv} \\
        --output ${prefix}.benchmark_report.html
    """
}
