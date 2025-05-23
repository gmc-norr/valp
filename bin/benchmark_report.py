#!/usr/bin/env python3

import argparse
import csv
from datetime import datetime
import json
import jinja2
import numpy as np
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


def render_template(template, comparisons, coverage, af_comparisons, thresholds, js, css):
    with open(template) as f:
        t = jinja2.Template(source=f.read())

    return t.render(
        now=datetime.now(),
        comparisons=comparisons,
        coverage=coverage,
        af_comparisons=af_comparisons,
        thresholds=thresholds,
        js=js,
        css=css,
    )


def hexbin_summary(x, y, radius, xlim=(0, 1), ylim=(0, 1)):
    return []


def parse_af_comparison(filename):
    query_af = []
    truth_af = []
    # ss = 0
    with open(filename) as f:
        reader = csv.DictReader(f, delimiter="\t")
        for line in reader:
            assert line["query_chrom"] == line["truth_chrom"]
            assert line["query_pos"] == line["truth_pos"]
            assert line["query_ref"] == line["truth_ref"]
            assert line["query_alt"] == line["truth_alt"]
            if line["query_af"] == "NA" or line["truth_af"] == "NA":
                continue
            for raw_query_af, raw_truth_af in zip(
                line["query_af"].split(","), line["truth_af"].split(",")
            ):
                qaf = float(raw_query_af)
                taf = float(raw_truth_af)
                # ss += (qaf - taf)**2
                query_af.append(qaf)
                truth_af.append(taf)

    query_af = np.array(query_af)
    truth_af = np.array(truth_af)

    assert len(query_af) == len(truth_af)

    ss = np.sum(np.square(query_af - truth_af))
    mse = ss / len(query_af)
    r = np.corrcoef(query_af, truth_af)[0, 1]
    r2 = np.square(r)

    res = dict(
        mse=mse,
        r=r,
        r2=r2,
    )

    if len(query_af) < 1_000:
        res["data"] = dict(
            type="points",
            af=dict(
                truth=list(truth_af),
                query=list(query_af),
            )
        )
    else:
        res["data"] = dict(
            type="hexbin",
            radius=0.05,
            af=hexbin_summary(truth_af, query_af, 0.05),
        )

    return res

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
                seq_median = seq["median_coverage"]
                means.append(seq_mean)
                lengths.append(seq["length"])

                # If the median of the chromosome is under the warning threshold,
                # fail the sample.
                if seq_median < warn_th:
                    state = "fail"
                    break

                # If the median is below the upper threshold, issue a warning,
                # but continue to see if it would fail later on.
                if seq_median < th:
                    state = "warn"

            assert len(means) == len(lengths)

            mean_cov = sum(x * y for x, y in zip(means, lengths)) / sum(lengths)

            if state != "fail" and mean_cov < th:
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


def add_happy_labels(d: Dict, names: Dict[str, str]):
    old_names = d["column_names"]
    labels = dict((x, names.get(x, x)) for x in old_names)
    d["column_labels"] = labels
    return d


def main(
    template: Union[str, Path],
    javascript: Optional[List[Union[str, Path]]],
    css: Optional[List[Union[str, Path]]],
    happy_csv: Optional[Union[str, Path]],
    coverage_csv: Optional[Union[str, Path]],
    snv_af_csv: Optional[Union[str, Path]],
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

    snv_af_data = {}
    if snv_af_csv is not None:
        for line in read_csv(snv_af_csv):
            snv_af_data[line["id"]] = parse_af_comparison(line["tsv"])
            snv_af_data[line["id"]]["id"] = line["id"]

    happy_results = []
    if happy_csv is not None:
        happy_results = read_csv(happy_csv)

    comparisons = []
    for comp in happy_results:
        hsum = read_json(comp["happy_summary"])
        hext = read_json(comp["happy_extended"])
        comp["happy_summary"] = add_happy_labels(
            hsum,
            names={
                "type": "Type",
                "filter": "Filter",
                "truth.total": "Truth count",
                "truth.tp": "Truth TP",
                "truth.fn": "Truth FN",
                "query.total": "Query count",
                "query.fp": "Query FP",
                "query.unk": "Query UNK",
                "fp.gt": "FP GT",
                "fp.al": "FP AL",
                "metric.recall": "Recall",
                "metric.precision": "Precision",
                "metric.frac_na": "Frac NA",
                "metric.f1_score": "F1 score",
                "truth.total.titv_ratio": "Truth ti/tv",
                "query.total.titv_ratio": "Query ti/tv",
                "truth.total.het_hom_ratio": "Truth het/hom ratio",
                "query.total.het_hom_ratio": "Query het/hom ratio",
            },
        )
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
        snv_af_data,
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
        "--snv-af-csv",
        dest="snv_af_csv",
        help="CSV file with SNV allele frequency comparison results.",
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
        args.snv_af_csv,
        args.coverage_th,
        args.coverage_warn_th,
        args.coverage_warn_fraction,
        args.snv_precision_th,
        args.snv_recall_th,
        args.indel_precision_th,
        args.indel_recall_th,
        args.output,
    )
