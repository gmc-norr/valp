#!/usr/bin/env python3

import argparse
import csv
from datetime import datetime
import json
import jinja2
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


def read_json(filename: Union[str, Path]) -> Dict[str, Any]:
    with open(filename) as f:
        return json.load(f)


def read_csv(filename: Union[str, Path]) -> List[Dict[str, Any]]:
    with open(filename) as f:
        reader = csv.DictReader(f)
        return list(reader)


def files_to_strings(filenames):
    file_contents = []
    if not filenames:
        return file_contents
    for fname in filenames:
        with open(fname) as f:
            file_contents.append(f.read())
    return file_contents


def render_template(template, comparisons, coverage, thresholds, js, css):
    with open(template) as f:
        t = jinja2.Template(source=f.read())

    return t.render(
        now=datetime.now(),
        comparisons=comparisons,
        coverage=coverage,
        thresholds=thresholds,
        js=js,
        css=css,
    )


def call_metric(hsum, metric, th=0.9, var_type="snp"):
    for row in hsum.get("rows", []):
        if row.get("type", "").lower() == var_type and row.get("filter", "").lower() == "pass":
            m = row.get(f"metric.{metric}")
            state = "pass"
            if m < th:
                state = "fail"
            return {"value": m, "state": state}
    return None


def coverage_state(
    coverage_data,
    comp_id,
    th: int = 30,
    cov_type: str = "global",
    warn_th: int = 25,
    warn_fraction: float = 0.25,
):
    for comp in coverage_data:
        if comp["id"] != comp_id:
            continue

        if cov_type == "global":
            means = []
            lengths = []
            state = "pass"

            for seq in comp["coverage"]["global_coverage"]:
                if seq["name"] in ("X", "Y", "chrX", "chrY"):
                    continue
                seq_mean = seq["mean_coverage"]
                means.append(seq_mean)
                lengths.append(seq["length"])

                # Only do the coming check if necessary
                if state == "warn":
                    continue

                # Scan the genome and issue a warning if the coverage is under the threshold.
                window_size = round(seq["length"] * warn_fraction) // seq["bin_size"]
                i = 0
                while i < len(seq["coverage"]) - window_size:
                    window = [x for x in seq["coverage"][i : i + window_size] if x > 0]
                    window_mean = sum(window) / len(window)
                    if window_mean < warn_th:
                        state = "warn"
                        break
                    i += 1

            assert len(means) == len(lengths)

            mean_cov = sum(x * y for x, y in zip(means, lengths)) / sum(lengths)

            if mean_cov < th:
                state = "fail"
            return {"mean_coverage": mean_cov, "state": state}

        if cov_type == "regional":
            fail_regions = []
            warn_regions = []
            means = []
            lengths = []
            state = "pass"

            if len(comp["coverage"]["regional_coverage"]) == 0:
                return {
                    "mean_coverage": None,
                    "state": None,
                    "fail_regions": [],
                    "warn_regions": [],
                }

            for seq in comp["coverage"]["regional_coverage"]:
                seq_mean = seq["mean_coverage"]
                region_state = None
                if seq_mean < th:
                    fail_regions.append(seq["name"])
                    region_state = "fail"
                    state = "fail"
                if region_state != "fail" and any(x < th for x in seq["coverage"]):
                    warn_regions.append(seq["name"])
                    state = "warn"
                means.append(seq_mean)
                lengths.append(seq["length"])

            assert len(means) == len(lengths)

            mean_cov = sum(x * y for x, y in zip(means, lengths)) / sum(lengths)

            if mean_cov < th:
                state = "fail"

            return {
                "mean_coverage": mean_cov,
                "state": state,
                "fail_regions": fail_regions,
                "warn_regions": warn_regions,
            }


def main(
    template: Union[str, Path],
    javascript: Optional[List[Union[str, Path]]],
    css: Optional[List[Union[str, Path]]],
    happy_csv: List[Union[str, Path]],
    coverage_csv: Optional[Union[str, Path]],
    coverage_th: int,
    coverage_warn_th: int,
    coverage_warn_fraction: float,
    snv_precision_th: float,
    snv_recall_th: float,
    indel_precision_th: float,
    indel_recall_th: float,
    output: Optional[Union[str, Path]],
):
    coverage_results = []
    if coverage_csv is not None:
        for line in read_csv(coverage_csv):
            coverage_data = read_json(line["json"])
            coverage_results.append(
                dict(
                    id=line["id"],
                    sample=line["sample"],
                    genome=line["genome"],
                    coverage=coverage_data,
                )
            )

    happy_results = read_csv(happy_csv)
    comparisons = []
    for comp in happy_results:
        hsum = read_json(comp["happy_summary"])
        hext = read_json(comp["happy_extended"])
        comp["happy_summary"] = hsum
        comp["happy_extended"] = hext
        comp["snv_precision"] = call_metric(hsum, "precision", th=snv_precision_th, var_type="snp")
        comp["snv_recall"] = call_metric(hsum, "recall", th=snv_recall_th, var_type="snp")
        comp["indel_precision"] = call_metric(
            hsum, "precision", th=indel_precision_th, var_type="indel"
        )
        comp["indel_recall"] = call_metric(hsum, "recall", th=indel_recall_th, var_type="indel")
        comp["global_coverage"] = coverage_state(
            coverage_results,
            comp["id"],
            th=coverage_th,
            cov_type="global",
            warn_th=coverage_warn_th,
            warn_fraction=coverage_warn_fraction,
        )
        comp["regional_coverage"] = coverage_state(
            coverage_results, comp["id"], th=coverage_th, cov_type="regional"
        )
        comparisons.append(comp)

    thresholds = [
        {
            "name": "Coverage",
            "value": coverage_th,
        },
        {
            "name": "SNV precision",
            "value": snv_precision_th,
        },
        {
            "name": "SNV recall",
            "value": snv_recall_th,
        },
        {
            "name": "INDEL precision",
            "value": indel_precision_th,
        },
        {
            "name": "INDEL recall",
            "value": indel_recall_th,
        },
    ]

    report = render_template(
        template,
        dict((c["id"], c) for c in sorted(comparisons, key=lambda x: x["id"])),
        dict((c["id"], c) for c in sorted(coverage_results, key=lambda x: x["id"])),
        thresholds,
        files_to_strings(javascript) if javascript else None,
        files_to_strings(css) if css else None,
    )

    if output is None:
        print(report)
    else:
        with open(output, "w") as f:
            f.write(report)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--happy-csv",
        dest="happy_csv",
        help="CSV file with results from hap.py.",
        type=Path,
    )
    parser.add_argument(
        "--coverage-csv",
        dest="coverage_csv",
        help="CSV file with coverage results.",
        type=Path,
    )
    parser.add_argument(
        "--template",
        default="assets/report_template.html",
        help="HTML template to use for the report",
        type=Path,
    )
    parser.add_argument(
        "--js",
        default=None,
        help="Javascript files that should be inserted in the template. "
        "They are inserted in the order given.",
        type=Path,
        action="extend",
        nargs="+",
    )
    parser.add_argument(
        "--css",
        default=None,
        help="CSS files that should be inserted into the template. "
        "They are inserted in the order given.",
        type=Path,
        action="extend",
        nargs="+",
    )
    parser.add_argument(
        "--coverage-threshold",
        dest="coverage_th",
        default=30,
        help="Minimum mean coverage threshold value.",
        type=int,
    )
    parser.add_argument(
        "--coverage-warning",
        dest="coverage_warn_th",
        default=25,
        help="Minimum chromosomal fractional coverage that needs to be exceeded to not issue a warning.",
        type=int,
    )
    parser.add_argument(
        "--coverage-warning-fraction",
        dest="coverage_warn_fraction",
        default=0.25,
        help="Fraction of each chromosome that need to exceed `--coverage-warning` to not issue a warning.",
        type=float,
    )
    parser.add_argument(
        "--snv-precision-threshold",
        dest="snv_precision_th",
        default=0.9,
        help="SNV precision threshold value.",
        type=float,
    )
    parser.add_argument(
        "--snv-recall-threshold",
        dest="snv_recall_th",
        default=0.9,
        help="SNV recall threshold value.",
        type=float,
    )
    parser.add_argument(
        "--indel-precision-threshold",
        dest="indel_precision_th",
        default=0.9,
        help="INDEL precision threshold value.",
        type=float,
    )
    parser.add_argument(
        "--indel-recall-threshold",
        dest="indel_recall_th",
        default=0.9,
        help="INDEL recall threshold value.",
        type=float,
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="File to write the resulting HTML report to (default: stdout).",
        type=Path,
    )

    args = parser.parse_args()
    main(
        args.template,
        args.js,
        args.css,
        args.happy_csv,
        args.coverage_csv,
        args.coverage_th,
        args.coverage_warn_th,
        args.coverage_warn_fraction,
        args.snv_precision_th,
        args.snv_recall_th,
        args.indel_precision_th,
        args.indel_recall_th,
        args.output,
    )
