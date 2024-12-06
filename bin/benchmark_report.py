#!/usr/bin/env python3

import argparse
import csv
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


def render_template(template, comparisons, coverage_json, js, css):
    with open(template) as f:
        t = jinja2.Template(source=f.read())

    return t.render(
        comparisons=comparisons,
        json_data=json.dumps(comparisons),
        coverage_json=json.dumps(coverage_json),
        js=js,
        css=css,
    )


def main(
    template: Union[str, Path],
    javascript: Optional[List[Union[str, Path]]],
    css: Optional[List[Union[str, Path]]],
    happy_csv: List[Union[str, Path]],
    coverage_csv: Optional[Union[str, Path]],
    output: Optional[Union[str, Path]],
):
    happy_results = read_csv(happy_csv)
    comparisons = []
    for comp in happy_results:
        hsum = read_json(comp["happy_summary"])
        hext = read_json(comp["happy_extended"])
        comp["happy_summary"] = hsum
        comp["happy_extended"] = hext
        comparisons.append(comp)

    coverage_results = []
    if coverage_csv is not None:
        for line in read_csv(coverage_csv):
            coverage_results.append(dict(
                id=line["id"],
                sample=line["sample"],
                genome=line["genome"],
                coverage=read_json(line["json"]),
            ))

    report = render_template(
        template,
        sorted(comparisons, key=lambda x: x["id"]),
        sorted(coverage_results, key=lambda x: x["id"]),
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
        "-o",
        "--output",
        default=None,
        help="File to write the resulting HTML report to (default: stdout).",
        type=Path,
    )

    args = parser.parse_args()
    main(args.template, args.js, args.css, args.happy_csv, args.coverage_csv, args.output)
